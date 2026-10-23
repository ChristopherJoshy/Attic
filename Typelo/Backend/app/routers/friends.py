#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Friends API router - Friend requests, friendships, and friend management.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# search_users: Search for users by exact or partial username match.
# send_friend_request: Send a friend request to another user.
# get_friends: Retrieve the list of current friends.
# get_friend_requests: Retrieve pending friend requests.
# accept_friend_request: Accept a pending friend request.
# decline_friend_request: Decline a pending friend request.
# remove_friend: Unfriend a user.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# logger: Logger instance.
# router: FastAPI APIRouter instance.
# SendFriendRequestBody: Request model for sending friend requests.
# AcceptDeclineBody: Request model for accepting/declining requests.
# FriendListResponse: Response model for friend list.
# FriendRequestListResponse: Response model for friend requests.
# SuccessResponse: Generic success response model.
# UserSearchResult: Model for user search results.
# SearchUsersResponse: Response model for user search.
# RemoveFriendBody: Request model for removing a friend.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# fastapi: API components.
# pydantic: Data validation.
# typing: Type hints.
# re: Regex module.
# datetime: Date/time utilities.
# logging: Logging.
# uuid: UUID generation.
# app.database.Database: DB connection.
# app.models.user: User models.
# app.models.friend: Friend models.
# app.routers.auth: Auth dependencies.

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
import re as regex_module
from datetime import datetime, timezone
import logging
import uuid

from app.database import Database
from app.models.user import get_rank_from_elo
from app.models.friend import (
    FriendRequestStatus,
    FriendRequestResponse,
    FriendRequestUser,
    FriendInfo
)
from app.routers.auth import get_current_user, UserInfo


logger = logging.getLogger(__name__)
router = APIRouter()


class SendFriendRequestBody(BaseModel):
    to_user_id: str


class AcceptDeclineBody(BaseModel):
    request_id: str


class FriendListResponse(BaseModel):
    friends: List[FriendInfo]


class FriendRequestListResponse(BaseModel):
    requests: List[FriendRequestResponse]


class SuccessResponse(BaseModel):
    success: bool
    message: str = ""


class UserSearchResult(BaseModel):
    uid: str
    display_name: str
    photo_url: Optional[str] = None
    elo_rating: int
    rank: str


class SearchUsersResponse(BaseModel):
    users: List[UserSearchResult]


@router.get("/search", response_model=SearchUsersResponse)
async def search_users(
    query: str = Query("", min_length=1, max_length=50, description="Username to search for"),
    current_user: UserInfo = Depends(get_current_user)
):
    db = Database.get_db()
    
    escaped_query = regex_module.escape(query)
    
    cursor = db.users.find({
        "display_name": {"$regex": escaped_query, "$options": "i"},
        "firebase_uid": {"$ne": current_user.uid}
    }).limit(20)
    
    users = []
    async for user in cursor:
        elo = user.get("elo_rating", 1000)
        users.append(UserSearchResult(
            uid=user.get("firebase_uid"),
            display_name=user.get("display_name", "Unknown"),
            photo_url=user.get("photo_url"),
            elo_rating=elo,
            rank=get_rank_from_elo(elo).value
        ))
    
    return SearchUsersResponse(users=users)


@router.post("/request", response_model=SuccessResponse)
async def send_friend_request(
    body: SendFriendRequestBody,
    current_user: UserInfo = Depends(get_current_user)
):
    db = Database.get_db()
    
    if body.to_user_id == current_user.uid:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
    
    target_user = await db.users.find_one({"firebase_uid": body.to_user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing_friendship = await db.friendships.find_one({
        "$or": [
            {"user1_id": current_user.uid, "user2_id": body.to_user_id},
            {"user1_id": body.to_user_id, "user2_id": current_user.uid}
        ]
    })
    if existing_friendship:
        raise HTTPException(status_code=400, detail="Already friends with this user")
    
    existing_request = await db.friend_requests.find_one({
        "$or": [
            {"from_user_id": current_user.uid, "to_user_id": body.to_user_id, "status": "pending"},
            {"from_user_id": body.to_user_id, "to_user_id": current_user.uid, "status": "pending"}
        ]
    })
    if existing_request:
        raise HTTPException(status_code=400, detail="Friend request already pending")
    
    request_id = str(uuid.uuid4())
    await db.friend_requests.insert_one({
        "request_id": request_id,
        "from_user_id": current_user.uid,
        "to_user_id": body.to_user_id,
        "status": FriendRequestStatus.PENDING.value,
        "created_at": datetime.now(timezone.utc)
    })
    
    logger.info(f"Friend request sent: {current_user.uid} -> {body.to_user_id}")
    return SuccessResponse(success=True, message="Friend request sent")


@router.get("", response_model=FriendListResponse)
async def get_friends(current_user: UserInfo = Depends(get_current_user)):
    db = Database.get_db()
    
    cursor = db.friendships.find({
        "$or": [
            {"user1_id": current_user.uid},
            {"user2_id": current_user.uid}
        ]
    })
    
    friend_ids = []
    friendship_map = {}
    async for friendship in cursor:
        friend_id = friendship["user2_id"] if friendship["user1_id"] == current_user.uid else friendship["user1_id"]
        friend_ids.append(friend_id)
        friendship_map[friend_id] = friendship.get("created_at", datetime.now(timezone.utc))
    
    if not friend_ids:
        return FriendListResponse(friends=[])
    
    friends_cursor = db.users.find({"firebase_uid": {"$in": friend_ids}})
    friends = []
    async for friend_user in friends_cursor:
        friend_id = friend_user.get("firebase_uid")
        elo = friend_user.get("elo_rating", 1000)
        friends.append(FriendInfo(
            uid=friend_id,
            display_name=friend_user.get("display_name", "Unknown"),
            photo_url=friend_user.get("photo_url"),
            elo_rating=elo,
            rank=get_rank_from_elo(elo).value,
            is_online=False,
            added_at=friendship_map.get(friend_id, datetime.now(timezone.utc))
        ))
    
    return FriendListResponse(friends=friends)


@router.get("/requests", response_model=FriendRequestListResponse)
async def get_friend_requests(current_user: UserInfo = Depends(get_current_user)):
    db = Database.get_db()
    
    cursor = db.friend_requests.find({
        "to_user_id": current_user.uid,
        "status": FriendRequestStatus.PENDING.value
    }).sort("created_at", -1)
    
    request_list = []
    sender_ids = []
    async for req in cursor:
        request_list.append(req)
        sender_ids.append(req["from_user_id"])
    
    if not request_list:
        return FriendRequestListResponse(requests=[])
    
    sender_map = {}
    sender_cursor = db.users.find({"firebase_uid": {"$in": sender_ids}})
    async for user in sender_cursor:
        sender_map[user.get("firebase_uid")] = user
    
    requests = []
    for req in request_list:
        from_user = sender_map.get(req["from_user_id"])
        if from_user:
            elo = from_user.get("elo_rating", 1000)
            requests.append(FriendRequestResponse(
                id=req["request_id"],
                from_user=FriendRequestUser(
                    uid=req["from_user_id"],
                    display_name=from_user.get("display_name", "Unknown"),
                    photo_url=from_user.get("photo_url"),
                    elo_rating=elo,
                    rank=get_rank_from_elo(elo).value
                ),
                sent_at=req["created_at"]
            ))
    
    return FriendRequestListResponse(requests=requests)


@router.post("/accept", response_model=SuccessResponse)
async def accept_friend_request(
    body: AcceptDeclineBody,
    current_user: UserInfo = Depends(get_current_user)
):
    db = Database.get_db()
    
    request = await db.friend_requests.find_one({
        "request_id": body.request_id,
        "to_user_id": current_user.uid,
        "status": FriendRequestStatus.PENDING.value
    })
    
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    await db.friend_requests.update_one(
        {"request_id": body.request_id},
        {"$set": {
            "status": FriendRequestStatus.ACCEPTED.value,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    friendship_id = str(uuid.uuid4())
    await db.friendships.insert_one({
        "friendship_id": friendship_id,
        "user1_id": request["from_user_id"],
        "user2_id": current_user.uid,
        "created_at": datetime.now(timezone.utc)
    })
    
    logger.info(f"Friendship created: {request['from_user_id']} <-> {current_user.uid}")
    return SuccessResponse(success=True, message="Friend request accepted")


@router.post("/decline", response_model=SuccessResponse)
async def decline_friend_request(
    body: AcceptDeclineBody,
    current_user: UserInfo = Depends(get_current_user)
):
    db = Database.get_db()
    
    request = await db.friend_requests.find_one({
        "request_id": body.request_id,
        "to_user_id": current_user.uid,
        "status": FriendRequestStatus.PENDING.value
    })
    
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    await db.friend_requests.update_one(
        {"request_id": body.request_id},
        {"$set": {
            "status": FriendRequestStatus.DECLINED.value,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    logger.info(f"Friend request declined: {request['from_user_id']} -> {current_user.uid}")
    return SuccessResponse(success=True, message="Friend request declined")


class RemoveFriendBody(BaseModel):
    friend_id: str


@router.post("/remove", response_model=SuccessResponse)
async def remove_friend(
    body: RemoveFriendBody,
    current_user: UserInfo = Depends(get_current_user)
):
    db = Database.get_db()
    
    result = await db.friendships.delete_one({
        "$or": [
            {"user1_id": current_user.uid, "user2_id": body.friend_id},
            {"user1_id": body.friend_id, "user2_id": current_user.uid}
        ]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Friendship not found")
    
    logger.info(f"Friendship removed: {current_user.uid} <-> {body.friend_id}")
    return SuccessResponse(success=True, message="Friend removed")
