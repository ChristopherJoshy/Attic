#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Match WebSocket router - Real-time game communication, matchmaking, and state management.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# ConnectionManager.get_client_ip: Helper to extract client IP from headers or connection.
# ConnectionManager.check_ip_allowed: Anti-cheat check to prevent multiple connections from same IP.
# ConnectionManager.start_periodic_broadcast: Starts background task for online user counts.
# ConnectionManager._periodic_online_broadcast: Coroutine that sends updates every 10s.
# ConnectionManager.check_rate_limit: Rate limiter for WebSocket messages.
# ConnectionManager.connect: Accepts connection and stores user info.
# ConnectionManager.disconnect: Removes connection and cleans up state.
# ConnectionManager.send_json: Safe send method handling disconnects.
# ConnectionManager.get_connection: Retrieve WebSocket by user ID.
# ConnectionManager.get_online_count: Get number of active connections.
# ConnectionManager.get_online_users: Get list of active user profiles.
# ConnectionManager.update_user_elo: Updates stored Elo for a user.
# ConnectionManager.broadcast_online_count: Sends count to all connected clients.
# ConnectionManager.broadcast_online_users: Sends user list to all connected clients.
# ConnectionManager.broadcast_match_started: Notifies all clients a match started.
# ConnectionManager.broadcast_match_ended: Notifies all clients a match ended.
# match_websocket: Main WebSocket endpoint. Handles auth, matchmaking queues (Ranked, Training, Friends), game progress updates, and keystrokes.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# router: FastAPI router.
# logger: Logger instance.
# manager: Global ConnectionManager instance.
# ConnectionManager: Class managing WebSocket state.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# json, asyncio, logging: Standard libs.
# fastapi: Framework (APIRouter, WebSocket, etc).
# typing: hints.
# app.config: settings.
# app.services.matchmaking: Matchmaking logic.
# app.services.game: Game server logic.
# app.models.match: Match message models.
# app.models.user: User models.
# app.routers.auth: user auth.

import json
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional, Dict

from app.config import get_settings

logger = logging.getLogger(__name__)

from app.services.matchmaking import matchmaking_service, PendingMatch
from app.services.game import game_service
from app.models.match import (
    QueueUpdateMessage,
    MatchFoundMessage,
    GameStartMessage,
    OpponentProgressMessage,
    GameEndMessage,
    ErrorMessage,
    MatchResult
)
from app.models.user import get_rank_from_elo
from app.routers.auth import verify_firebase_token
from app.constants import get_bot_cursor


router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_info: Dict[str, dict] = {}
        self._message_counts: Dict[str, int] = {}
        self._last_reset: float = asyncio.get_event_loop().time() if asyncio.get_event_loop().is_running() else 0
        self._rate_limit_window: float = 1.0
        self._max_messages_per_window: int = 50
        self._rate_limit_lock = asyncio.Lock()
        self._periodic_broadcast_task: Optional[asyncio.Task] = None
        self._ip_to_user: Dict[str, str] = {}
        self._user_to_ip: Dict[str, str] = {}
    
    def get_client_ip(self, websocket: WebSocket) -> str:
        forwarded = websocket.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = websocket.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        if websocket.client:
            return websocket.client.host
        return "unknown"
    
    def check_ip_allowed(self, ip: str, user_id: str) -> tuple[bool, Optional[str]]:
        if ip == "unknown" or ip == "127.0.0.1" or ip == "::1":
            return (True, None)
        existing_user = self._ip_to_user.get(ip)
        if existing_user and existing_user != user_id:
            return (False, existing_user)
        return (True, None)

    def start_periodic_broadcast(self):
        if self._periodic_broadcast_task is None or self._periodic_broadcast_task.done():
            self._periodic_broadcast_task = asyncio.create_task(self._periodic_online_broadcast())
            logger.info("Started periodic online count broadcast task")
    
    async def _periodic_online_broadcast(self):
        while True:
            try:
                await asyncio.sleep(10)
                if self.active_connections:
                    await self.broadcast_online_count()
                    await self.broadcast_online_users()
            except asyncio.CancelledError:
                logger.info("Periodic online broadcast task cancelled")
                break
            except Exception as e:
                logger.warning(f"Error in periodic online broadcast: {e}")

    async def check_rate_limit(self, user_id: str) -> bool:
        async with self._rate_limit_lock:
            try:
                current_time = asyncio.get_event_loop().time()
            except RuntimeError:
                return True
            
            if current_time - self._last_reset > self._rate_limit_window:
                self._message_counts.clear()
                self._last_reset = current_time
            
            count = self._message_counts.get(user_id, 0)
            if count >= self._max_messages_per_window:
                return False
            
            self._message_counts[user_id] = count + 1
            return True

    async def connect(self, websocket: WebSocket, user_id: str, display_name: str, photo_url: Optional[str], elo: int, client_ip: str, equipped_cursor: str = "default", equipped_effect: Optional[str] = None):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_info[user_id] = {
            "user_id": user_id,
            "display_name": display_name,
            "photo_url": photo_url,
            "elo": elo,
            "equipped_cursor": equipped_cursor,
            "equipped_effect": equipped_effect
        }
        self._ip_to_user[client_ip] = user_id
        self._user_to_ip[user_id] = client_ip
        logger.info(f"User {user_id} connected from IP {client_ip}")
        self.start_periodic_broadcast()

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_info:
            del self.user_info[user_id]
        self._message_counts.pop(user_id, None)
        ip = self._user_to_ip.pop(user_id, None)
        if ip and self._ip_to_user.get(ip) == user_id:
            del self._ip_to_user[ip]

    async def send_json(self, user_id: str, data: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(data)
            except Exception as e:
                logger.error(f"Error sending JSON to {user_id}: {e}")
                self.disconnect(user_id)

    def get_connection(self, user_id: str) -> Optional[WebSocket]:
        return self.active_connections.get(user_id)

    def get_online_count(self) -> int:
        return len(self.active_connections)

    def get_online_users(self):
        return list(self.user_info.values())
    
    def update_user_elo(self, user_id: str, new_elo: int):
        if user_id in self.user_info:
            self.user_info[user_id]["elo"] = new_elo

    async def broadcast_online_count(self):
        count = self.get_online_count()
        message = {"type": "ONLINE_COUNT", "count": count}
        disconnected = set()
        for user_id, ws in list(self.active_connections.items()):
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.add(user_id)
        for user_id in disconnected:
            self.disconnect(user_id)

    async def broadcast_online_users(self):
        users = self.get_online_users()
        message = {"type": "ONLINE_USERS", "users": users}
        disconnected = set()
        for user_id, ws in list(self.active_connections.items()):
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.add(user_id)
        for user_id in disconnected:
            self.disconnect(user_id)

    async def broadcast_match_started(
        self,
        match_id: str,
        player1_name: str,
        player1_photo: Optional[str],
        player2_name: str,
        player2_photo: Optional[str],
        is_bot_match: bool = False,
        game_mode: str = "ranked"
    ):
        message = {
            "type": "PUBLIC_MATCH_STARTED",
            "match_id": match_id,
            "player1_name": player1_name,
            "player1_photo": player1_photo,
            "player2_name": player2_name,
            "player2_photo": player2_photo,
            "is_bot_match": is_bot_match,
            "game_mode": game_mode
        }
        disconnected = set()
        for user_id, ws in list(self.active_connections.items()):
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.add(user_id)
        for user_id in disconnected:
            self.disconnect(user_id)
        logger.info(f"Broadcasted match started: {player1_name} vs {player2_name}")

    async def broadcast_match_ended(
        self,
        match_id: str,
        winner_name: str,
        winner_photo: Optional[str],
        loser_name: str,
        loser_photo: Optional[str],
        winner_wpm: int,
        loser_wpm: int,
        is_tie: bool = False,
        game_mode: str = "ranked"
    ):
        message = {
            "type": "PUBLIC_MATCH_ENDED",
            "match_id": match_id,
            "winner_name": winner_name,
            "winner_photo": winner_photo,
            "loser_name": loser_name,
            "loser_photo": loser_photo,
            "winner_wpm": winner_wpm,
            "loser_wpm": loser_wpm,
            "is_tie": is_tie,
            "game_mode": game_mode
        }
        disconnected = set()
        for user_id, ws in list(self.active_connections.items()):
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.add(user_id)
        for user_id in disconnected:
            self.disconnect(user_id)
        if is_tie:
            logger.info(f"Broadcasted match ended (TIE): {winner_name} vs {loser_name}")
        else:
            logger.info(f"Broadcasted match ended: {winner_name} won against {loser_name}")


manager = ConnectionManager()


@router.websocket("/ws")
async def match_websocket(
    websocket: WebSocket,
    token: str = Query(...),
    user_id: str = Query(..., max_length=128),
    display_name: str = Query(..., max_length=100),
    photo_url: Optional[str] = Query(None, max_length=500),
    elo: int = Query(0, ge=0, le=50000)
):
    settings = get_settings()
    origin = websocket.headers.get("origin")
    
    if origin:
        allowed_origins = settings.cors_origins_list
        if "*" not in allowed_origins and origin not in allowed_origins:
            logger.warning(f"WebSocket connection rejected from unauthorized origin: {origin}")
            logger.info(f"Allowed origins: {allowed_origins}")
            await websocket.close(code=1008, reason="Origin not allowed")
            return
    
    logger.info(f"WebSocket connection from origin: {origin}, user: {user_id}")
    
    if not user_id or not display_name:
        await websocket.close(code=1008, reason="Missing required parameters")
        return
    
    try:
        # First try guest token verification
        from app.routers.auth import verify_guest_token
        guest_uid = verify_guest_token(token)
        
        if guest_uid:
            # It's a valid guest token
            if guest_uid != user_id:
                logger.warning(f"Guest user ID mismatch: token={guest_uid}, param={user_id}")
                await websocket.close(code=1008, reason="User ID mismatch")
                return
        else:
            # Try Firebase token
            decoded_token = await verify_firebase_token(token)
            if decoded_token["uid"] != user_id:
                logger.warning(f"User ID mismatch: token={decoded_token['uid']}, param={user_id}")
                await websocket.close(code=1008, reason="User ID mismatch")
                return
    except Exception as e:
        logger.warning(f"WebSocket auth failed: {e}")
        await websocket.close(code=1008, reason="Authentication failed")
        return
    
    try:
        from app.database import Database
        db = Database.get_db()
        user_doc = await db.users.find_one({"firebase_uid": user_id})
        if user_doc:
            elo = user_doc.get("elo_rating", 1000)
            equipped_cursor = user_doc.get("equipped_cursor", "default")
            equipped_effect = user_doc.get("equipped_effect", None)
        else:
            elo = 1000
            equipped_cursor = "default"
            equipped_effect = None
            
    except Exception as e:
        logger.warning(f"Failed to fetch Elo from DB for {user_id}: {e}")
        if elo <= 0:
            elo = 1000
        equipped_cursor = "default"
        equipped_effect = None
    
    client_ip = manager.get_client_ip(websocket)
    ip_allowed, existing_user_id = manager.check_ip_allowed(client_ip, user_id)
    
    if not ip_allowed:
        existing_user_info = manager.user_info.get(existing_user_id, {})
        existing_user_name = existing_user_info.get("display_name", "Unknown")
        logger.warning(f"Duplicate IP blocked: {client_ip} - existing: {existing_user_id} ({existing_user_name}), blocked: {user_id} ({display_name})")
        
        try:
            from datetime import datetime, timezone
            await db.ip_logs.insert_one({
                "ip_address": client_ip,
                "existing_user_id": existing_user_id,
                "existing_user_name": existing_user_name,
                "blocked_user_id": user_id,
                "blocked_user_name": display_name,
                "timestamp": datetime.now(timezone.utc),
                "reason": "DUPLICATE_IP_BLOCKED"
            })
        except Exception as log_error:
            logger.error(f"Failed to log suspicious IP: {log_error}")
        
        await websocket.close(code=1008, reason="Another account is already playing from this network. Only one player per IP is allowed.")
        return
    
    await manager.connect(websocket, user_id, display_name, photo_url, elo, client_ip, equipped_cursor, equipped_effect)
    await manager.broadcast_online_count()
    await manager.broadcast_online_users()
    
    in_queue = False
    queue_task = None
    current_match_id = None
    connected = True
    
    last_sent_char_index = -1
    PROGRESS_THROTTLE_CHARS = 1
    
    try:
        while connected:
            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for user {user_id}")
                connected = False
                break
            except RuntimeError as e:
                # Handle "WebSocket is not connected. Need to call 'accept' first."
                if "WebSocket is not connected" in str(e):
                    logger.info(f"WebSocket closed (not connected) for user {user_id}")
                    connected = False
                    break
                logger.error(f"RuntimeError receiving WebSocket message from {user_id}: {e}")
                connected = False
                break
            except Exception as e:
                logger.error(f"Error receiving WebSocket message from {user_id}: {e}")
                connected = False
                break
            
            message_type = data.get("type")
            
            if not message_type:
                logger.warning(f"Received message without type from {user_id}")
                continue
            
            if not await manager.check_rate_limit(user_id):
                logger.warning(f"Rate limit exceeded for user {user_id}")
                error_msg = ErrorMessage(
                    code="RATE_LIMIT_EXCEEDED",
                    message="Too many messages. Please slow down."
                )
                await manager.send_json(user_id, error_msg.model_dump())
                continue
            
            if message_type == "JOIN_QUEUE":
                if in_queue:
                    continue
                
                in_queue = True
                
                async def on_match_found(pending: PendingMatch):
                    nonlocal current_match_id, in_queue, queue_task
                    
                    logger.info(f"on_match_found called for user {user_id}, match {pending.match_id}")
                    
                    in_queue = False
                    if queue_task:
                        queue_task.cancel()
                        try:
                            await queue_task
                        except asyncio.CancelledError:
                            pass
                        queue_task = None
                    
                    current_match_id = pending.match_id
                    last_sent_char_index = -1  # Reset throttle for new match
                    
                    try:
                        session = game_service.get_session(pending.match_id)
                        
                        if pending.is_bot_match:
                            if session is None:
                                session = await game_service.create_session(
                                    match_id=pending.match_id,
                                    player1_uid=user_id,
                                    player1_name=display_name,
                                    player1_photo=photo_url,
                                    player1_elo=elo,
                                    is_bot_match=True
                                )
                            opponent_name = "typelo Bot"
                            opponent_photo = None
                            opponent_rank = get_rank_from_elo(elo)
                            opponent_is_bot = True
                            # Get a cursor different from player's equipped cursor
                            player_cursor = pending.player1.equipped_cursor if pending.player1 else "default"
                            opponent_cursor = get_bot_cursor(player_cursor)
                            opponent_effect = None
                        else:
                            opponent = pending.player2 if pending.player1.user_id == user_id else pending.player1
                            if session is None:
                                session = await game_service.create_session(
                                    match_id=pending.match_id,
                                    player1_uid=pending.player1.user_id,
                                    player1_name=pending.player1.display_name,
                                    player1_photo=pending.player1.photo_url,
                                    player1_elo=pending.player1.elo,
                                    player2_uid=pending.player2.user_id,
                                    player2_name=pending.player2.display_name,
                                    player2_photo=pending.player2.photo_url,
                                    player2_elo=pending.player2.elo,
                                    is_training=pending.is_training
                                )
                            opponent_name = opponent.display_name
                            opponent_photo = opponent.photo_url
                            opponent_rank = get_rank_from_elo(opponent.elo)
                            opponent_is_bot = False
                            opponent_cursor = opponent.equipped_cursor
                            opponent_effect = opponent.equipped_effect
                        
                        opponent_elo_value = elo if pending.is_bot_match else opponent.elo
                        match_msg = MatchFoundMessage(
                            match_id=pending.match_id,
                            opponent_display_name=opponent_name,
                            opponent_photo_url=opponent_photo,
                            opponent_rank=opponent_rank.value,
                            opponent_elo=opponent_elo_value,
                            opponent_is_bot=opponent_is_bot,
                            words=session.words,
                            game_mode="training" if pending.is_training else "ranked",
                            opponent_cursor=opponent_cursor,
                            opponent_effect=opponent_effect
                        )
                        logger.info(f"Sending MATCH_FOUND to {user_id} for match {pending.match_id}")
                        await manager.send_json(user_id, match_msg.model_dump())
                        logger.info(f"MATCH_FOUND sent to {user_id}")
                        
                        async def on_game_start(timestamp: int, duration: int):
                            logger.info(f"Sending GAME_START to {user_id} at timestamp={timestamp}, duration={duration}")
                            start_msg = GameStartMessage(
                                timestamp=timestamp,
                                duration=duration
                            )
                            await manager.send_json(user_id, start_msg.model_dump())
                            logger.info(f"GAME_START sent to {user_id}")
                        
                        async def on_opponent_progress(char_index: int, word_index: int):
                            progress_msg = OpponentProgressMessage(
                                char_index=char_index,
                                word_index=word_index
                            )
                            await manager.send_json(user_id, progress_msg.model_dump())
                        
                        async def on_game_end(result: MatchResult):
                            # Manually construct dict to avoid Pydantic validation issues that might be swallowing errors
                            end_msg = {
                                "type": "GAME_END",
                                "result": result.model_dump()
                            }
                            await manager.send_json(user_id, end_msg)
                        
                        game_service.register_callbacks(
                            pending.match_id,
                            user_id,
                            on_game_start,
                            on_opponent_progress,
                            on_game_end
                        )
                        logger.info(f"Callbacks registered for {user_id} in match {pending.match_id}")
                        
                        matchmaking_service.remove_pending_match(pending.match_id)
                        
                        logger.info(f"Callback completed for {user_id} in match {pending.match_id}")
                        
                    except Exception as e:
                        logger.exception(f"Error in on_match_found for {user_id}: {e}")
                        error_msg = ErrorMessage(
                            code="MATCH_ERROR",
                            message="Failed to start match"
                        )
                        await manager.send_json(user_id, error_msg.model_dump())
                
                current_elo = elo
                current_cursor = equipped_cursor
                current_effect = equipped_effect
                
                if user_id in manager.user_info:
                    if "elo" in manager.user_info[user_id]:
                        current_elo = manager.user_info[user_id]["elo"]
                    if "equipped_cursor" in manager.user_info[user_id]:
                        current_cursor = manager.user_info[user_id]["equipped_cursor"]
                    if "equipped_effect" in manager.user_info[user_id]:
                        current_effect = manager.user_info[user_id]["equipped_effect"]
                
                await matchmaking_service.add_to_queue(
                    user_id=user_id,
                    elo=current_elo,
                    display_name=display_name,
                    photo_url=photo_url,
                    on_match_found=on_match_found,
                    equipped_cursor=current_cursor,
                    equipped_effect=current_effect
                )
                
                async def send_queue_updates():
                    while in_queue:
                        elapsed = await matchmaking_service.get_time_in_queue(user_id)
                        position = await matchmaking_service.get_queue_position(user_id)
                        
                        if position > 0:
                            update_msg = QueueUpdateMessage(
                                position=position,
                                elapsed=elapsed
                            )
                            await manager.send_json(user_id, update_msg.model_dump())
                        
                        await asyncio.sleep(1)
                
                queue_task = asyncio.create_task(send_queue_updates())
            
            elif message_type == "PING":
                import time
                await manager.send_json(user_id, {
                    "type": "PONG",
                    "server_time": int(time.time() * 1000)
                })
            
            elif message_type == "LEAVE_QUEUE":
                if in_queue:
                    in_queue = False
                    if queue_task:
                        queue_task.cancel()
                    await matchmaking_service.remove_from_queue(user_id)
                    await matchmaking_service.remove_from_training_queue(user_id)
            
            elif message_type == "JOIN_TRAINING_QUEUE":
                if in_queue:
                    continue
                
                in_queue = True
                
                async def on_training_match_found(pending: PendingMatch):
                    nonlocal current_match_id, in_queue, queue_task
                    
                    logger.info(f"on_training_match_found called for user {user_id}, match {pending.match_id}")
                    
                    in_queue = False
                    if queue_task:
                        queue_task.cancel()
                        try:
                            await queue_task
                        except asyncio.CancelledError:
                            pass
                        queue_task = None
                    
                    current_match_id = pending.match_id
                    last_sent_char_index = -1  # Reset throttle for new match
                    
                    try:
                        session = game_service.get_session(pending.match_id)
                        
                        if pending.is_bot_match:
                            if session is None:
                                session = await game_service.create_session(
                                    match_id=pending.match_id,
                                    player1_uid=user_id,
                                    player1_name=display_name,
                                    player1_photo=photo_url,
                                    player1_elo=elo,
                                    is_bot_match=True,
                                    is_training=True
                                )
                            opponent_name = "Training Bot"
                            opponent_photo = None
                            opponent_rank = get_rank_from_elo(elo)
                            opponent_is_bot = True
                            # Get a cursor different from player's equipped cursor
                            player_cursor = pending.player1.equipped_cursor if pending.player1 else "default"
                            opponent_cursor = get_bot_cursor(player_cursor)
                            opponent_effect = None
                        else:
                            opponent = pending.player2 if pending.player1.user_id == user_id else pending.player1
                            if session is None:
                                session = await game_service.create_session(
                                    match_id=pending.match_id,
                                    player1_uid=pending.player1.user_id,
                                    player1_name=pending.player1.display_name,
                                    player1_photo=pending.player1.photo_url,
                                    player1_elo=pending.player1.elo,
                                    player2_uid=pending.player2.user_id,
                                    player2_name=pending.player2.display_name,
                                    player2_photo=pending.player2.photo_url,
                                    player2_elo=pending.player2.elo,
                                    is_training=True
                                )
                            opponent_name = opponent.display_name
                            opponent_photo = opponent.photo_url
                            opponent_rank = get_rank_from_elo(opponent.elo)
                            opponent_is_bot = False
                            opponent_cursor = opponent.equipped_cursor
                            opponent_effect = opponent.equipped_effect
                        
                        opponent_elo_value = elo if pending.is_bot_match else opponent.elo
                        match_msg = MatchFoundMessage(
                            match_id=pending.match_id,
                            opponent_display_name=opponent_name,
                            opponent_photo_url=opponent_photo,
                            opponent_rank=opponent_rank.value,
                            opponent_elo=opponent_elo_value,
                            opponent_is_bot=opponent_is_bot,
                            words=session.words,
                            game_mode="training",
                            opponent_cursor=opponent_cursor,
                            opponent_effect=opponent_effect
                        )
                        logger.info(f"Sending MATCH_FOUND (training) to {user_id} for match {pending.match_id}")
                        await manager.send_json(user_id, match_msg.model_dump())
                        
                        async def on_game_start(timestamp: int, duration: int):
                            logger.info(f"Sending GAME_START (training) to {user_id}")
                            start_msg = GameStartMessage(
                                timestamp=timestamp,
                                duration=duration
                            )
                            await manager.send_json(user_id, start_msg.model_dump())
                        
                        async def on_opponent_progress(char_index: int, word_index: int):
                            progress_msg = OpponentProgressMessage(
                                char_index=char_index,
                                word_index=word_index
                            )
                            await manager.send_json(user_id, progress_msg.model_dump())
                        
                        async def on_game_end(result: MatchResult):
                            # Manually construct dict to avoid Pydantic validation issues
                            end_msg = {
                                "type": "GAME_END",
                                "result": result.model_dump()
                            }
                            await manager.send_json(user_id, end_msg)
                        
                        game_service.register_callbacks(
                            pending.match_id,
                            user_id,
                            on_game_start,
                            on_opponent_progress,
                            on_game_end
                        )
                        logger.info(f"Training callbacks registered for {user_id}")
                        
                        matchmaking_service.remove_pending_match(pending.match_id)
                        
                        logger.info(f"Training callback completed for {user_id} in match {pending.match_id}")
                        
                    except Exception as e:
                        logger.exception(f"Error in on_training_match_found for {user_id}: {e}")
                        error_msg = ErrorMessage(
                            code="MATCH_ERROR",
                            message="Failed to start training match"
                        )
                        await manager.send_json(user_id, error_msg.model_dump())
                
                await matchmaking_service.add_to_training_queue(
                    user_id=user_id,
                    elo=elo,
                    display_name=display_name,
                    photo_url=photo_url,
                    on_match_found=on_training_match_found,
                    equipped_cursor=equipped_cursor,
                    equipped_effect=equipped_effect
                )
                
                async def send_training_queue_updates():
                    while in_queue:
                        elapsed = await matchmaking_service.get_training_time_in_queue(user_id)
                        update_msg = QueueUpdateMessage(
                            position=1,
                            elapsed=elapsed
                        )
                        await manager.send_json(user_id, update_msg.model_dump())
                        await asyncio.sleep(1)
                
                queue_task = asyncio.create_task(send_training_queue_updates())
            
            elif message_type == "JOIN_FRIENDS_QUEUE":
                if in_queue:
                    continue
                
                from app.database import Database
                db = Database.get_db()
                
                friendships = db.friendships.find({
                    "$or": [
                        {"user1_id": user_id},
                        {"user2_id": user_id}
                    ]
                })
                
                friends_list = []
                async for friendship in friendships:
                    if friendship["user1_id"] == user_id:
                        friends_list.append(friendship["user2_id"])
                    else:
                        friends_list.append(friendship["user1_id"])
                
                if not friends_list:
                    error_msg = ErrorMessage(
                        code="NO_FRIENDS",
                        message="You need friends to play Friends Mode! Share your invite link."
                    )
                    await manager.send_json(user_id, error_msg.model_dump())
                    continue
                
                in_queue = True
                
                async def on_friends_match_found(pending: PendingMatch):
                    nonlocal current_match_id, in_queue, queue_task
                    
                    logger.info(f"on_friends_match_found called for user {user_id}, match {pending.match_id}")
                    
                    in_queue = False
                    if queue_task:
                        queue_task.cancel()
                        try:
                            await queue_task
                        except asyncio.CancelledError:
                            pass
                        queue_task = None
                    
                    current_match_id = pending.match_id
                    last_sent_char_index = -1  # Reset throttle for new match
                    
                    try:
                        session = game_service.get_session(pending.match_id)
                        
                        opponent = pending.player2 if pending.player1.user_id == user_id else pending.player1
                        if session is None:
                            session = await game_service.create_session(
                                match_id=pending.match_id,
                                player1_uid=pending.player1.user_id,
                                player1_name=pending.player1.display_name,
                                player1_photo=pending.player1.photo_url,
                                player1_elo=pending.player1.elo,
                                player2_uid=pending.player2.user_id,
                                player2_name=pending.player2.display_name,
                                player2_photo=pending.player2.photo_url,
                                player2_elo=pending.player2.elo,
                                is_friends_mode=True
                            )
                        opponent_name = opponent.display_name
                        opponent_photo = opponent.photo_url
                        opponent_rank = get_rank_from_elo(opponent.elo)
                        opponent_is_bot = False
                        opponent_cursor = opponent.equipped_cursor
                        opponent_effect = opponent.equipped_effect
                        
                        match_msg = MatchFoundMessage(
                            match_id=pending.match_id,
                            opponent_display_name=opponent_name,
                            opponent_photo_url=opponent_photo,
                            opponent_rank=opponent_rank.value,
                            opponent_elo=opponent.elo,
                            opponent_is_bot=opponent_is_bot,
                            words=session.words,
                            game_mode="friends",
                            opponent_cursor=opponent_cursor,
                            opponent_effect=opponent_effect
                        )
                        logger.info(f"Sending MATCH_FOUND (friends) to {user_id} for match {pending.match_id}")
                        await manager.send_json(user_id, match_msg.model_dump())
                        
                        async def on_game_start(timestamp: int, duration: int):
                            logger.info(f"Sending GAME_START (friends) to {user_id}")
                            start_msg = GameStartMessage(
                                timestamp=timestamp,
                                duration=duration
                            )
                            await manager.send_json(user_id, start_msg.model_dump())
                        
                        async def on_opponent_progress(char_index: int, word_index: int):
                            progress_msg = OpponentProgressMessage(
                                char_index=char_index,
                                word_index=word_index
                            )
                            await manager.send_json(user_id, progress_msg.model_dump())
                        
                        async def on_game_end(result: MatchResult):
                            # Manually construct dict to avoid Pydantic validation issues
                            end_msg = {
                                "type": "GAME_END",
                                "result": result.model_dump()
                            }
                            await manager.send_json(user_id, end_msg)
                        
                        game_service.register_callbacks(
                            pending.match_id,
                            user_id,
                            on_game_start,
                            on_opponent_progress,
                            on_game_end
                        )
                        logger.info(f"Friends callbacks registered for {user_id}")
                        
                        matchmaking_service.remove_pending_match(pending.match_id)
                        
                        logger.info(f"Friends callback completed for {user_id} in match {pending.match_id}")
                        
                    except Exception as e:
                        logger.exception(f"Error in on_friends_match_found for {user_id}: {e}")
                        error_msg = ErrorMessage(
                            code="MATCH_ERROR",
                            message="Failed to start friends match"
                        )
                        await manager.send_json(user_id, error_msg.model_dump())
                
                await matchmaking_service.add_to_friends_queue(
                    user_id=user_id,
                    elo=elo,
                    display_name=display_name,
                    photo_url=photo_url,
                    friends_list=friends_list,
                    on_match_found=on_friends_match_found,
                    equipped_cursor=equipped_cursor,
                    equipped_effect=equipped_effect
                )
                
                async def send_friends_queue_updates():
                    start_time = asyncio.get_event_loop().time()
                    while in_queue:
                        elapsed = int(asyncio.get_event_loop().time() - start_time)
                        update_msg = QueueUpdateMessage(
                            position=1,
                            elapsed=elapsed
                        )
                        await manager.send_json(user_id, update_msg.model_dump())
                        await asyncio.sleep(1)
                
                queue_task = asyncio.create_task(send_friends_queue_updates())
            
            elif message_type == "KEYSTROKE":
                if not current_match_id:
                    continue
                
                char = data.get("char", "")
                timestamp = data.get("timestamp", 0)
                char_index = data.get("char_index", 0)
                
                if not isinstance(char, str) or (len(char) != 1 and char != '\b'):
                    continue
                if not isinstance(timestamp, (int, float)) or timestamp <= 0:
                    continue
                if not isinstance(char_index, int) or char_index < 0:
                    continue
                
                if not current_match_id:
                    active_match_id = game_service.get_active_match_id(user_id)
                    if active_match_id:
                        current_match_id = active_match_id
                        logger.info(f"Picked up active match {current_match_id} for user {user_id}")
                    elif in_queue:
                         pass
                    else:
                        logger.warning(f"Keystroke ignored: No active match ID for user {user_id}. Char: {char}")
                        continue
                        
                if not current_match_id:
                    continue

                valid = game_service.process_keystroke(
                    current_match_id,
                    user_id,
                    char,
                    timestamp,
                    char_index
                )
                
                if not valid:
                    error_msg = ErrorMessage(
                        code="INVALID_KEYSTROKE",
                        message="Keystroke rejected by anti-cheat"
                    )
                    await manager.send_json(user_id, error_msg.model_dump())
                
                session = game_service.get_session(current_match_id)
                if session:
                    if session.player1.uid == user_id:
                        opponent = session.player2
                        current_player = session.player1
                    else:
                        opponent = session.player1
                        current_player = session.player2
                    
                    should_send = (
                        not opponent.is_bot and
                        (current_player.current_char_index - last_sent_char_index >= PROGRESS_THROTTLE_CHARS
                         or char == ' ')
                    )
                    if should_send:
                        last_sent_char_index = current_player.current_char_index
                        progress_msg = OpponentProgressMessage(
                            char_index=current_player.current_char_index,
                            word_index=current_player.current_word_index
                        )
                        await manager.send_json(opponent.uid, progress_msg.model_dump())
            
            elif message_type == "WORD_COMPLETE":
                if not current_match_id:
                    continue
                
                word_index = data.get("word_index", 0)
                await game_service.process_word_complete(
                    current_match_id,
                    user_id,
                    word_index
                )
                
                session = game_service.get_session(current_match_id)
                if session:
                    if session.player1.uid == user_id:
                        opponent = session.player2
                        current_player = session.player1
                    else:
                        opponent = session.player1
                        current_player = session.player2
                    
                    if not opponent.is_bot:
                        progress_msg = OpponentProgressMessage(
                            char_index=current_player.current_char_index,
                            word_index=current_player.current_word_index
                        )
                        await manager.send_json(opponent.uid, progress_msg.model_dump())
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user_id}")
    except Exception as e:
        logger.exception(f"WebSocket error for user {user_id}: {e}")
    finally:
        if queue_task:
            queue_task.cancel()
        if in_queue:
            await matchmaking_service.remove_from_queue(user_id)
            await matchmaking_service.remove_from_training_queue(user_id)
            await matchmaking_service.remove_from_friends_queue(user_id)
        if current_match_id:
            try:
                await game_service.handle_player_disconnect(current_match_id, user_id)
            except Exception as e:
                logger.error(f"Error handling player disconnect: {e}")
        manager.disconnect(user_id)
        logger.info(f"Cleaned up connection for user {user_id}")
        await manager.broadcast_online_count()
        await manager.broadcast_online_users()
