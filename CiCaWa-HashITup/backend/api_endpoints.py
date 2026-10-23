from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
from datetime import datetime

from database import (
    get_db, User, WasteRequest, Donation, MarketplaceListing,
    ChatMessage, WorkerLocation, UserRole, RequestStatus,
    DonationType
)
from auth import get_current_user
from gemini_service import classify_waste, chat_with_ai
from schemas import (
    DonationCreate,
    MarketplaceCreate,
    ChatMessageCreate,
    StatusUpdate,
    LocationUpdate,
    AIQuery,
)

router = APIRouter()

# Additional API endpoints to extend main.py


async def _emit_event(request: Request, event: str, data: dict, room: str | None = None) -> None:
    sio = getattr(request.app.state, "sio", None)
    if sio is None:
        return
    await sio.emit(event, data, room=room)

# Worker endpoints
@router.put("/worker/requests/{request_id}/status")
async def update_request_status(
    request_id: int,
    status_data: StatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != UserRole.WORKER:
        raise HTTPException(status_code=403, detail="Only workers can update request status")
    
    waste_request = db.query(WasteRequest).filter(WasteRequest.id == request_id).first()
    if not waste_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if waste_request.worker_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to this request")
    
    try:
        waste_request.status = RequestStatus(status_data.status)
        if status_data.status == "completed":
            waste_request.completed_at = datetime.utcnow()
        elif status_data.status == "in_progress":
            waste_request.assigned_at = datetime.utcnow()
        
        db.commit()
        
        # Notify user via WebSocket
        await _emit_event(
            request,
            "status_update",
            {
                "request_id": request_id,
                "status": status_data.status,
            },
            room=f"user_{waste_request.user_id}",
        )
        
        return {"message": "Status updated successfully"}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")

@router.post("/worker/location")
async def update_worker_location(
    location_data: LocationUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != UserRole.WORKER:
        raise HTTPException(status_code=403, detail="Only workers can update location")
    
    # Update or create worker location
    location = db.query(WorkerLocation).filter(WorkerLocation.worker_id == current_user.id).first()
    if location:
        location.latitude = location_data.latitude
        location.longitude = location_data.longitude
        location.updated_at = datetime.utcnow()
    else:
        location = WorkerLocation(
            worker_id=current_user.id,
            latitude=location_data.latitude,
            longitude=location_data.longitude
        )
        db.add(location)
    
    db.commit()
    
    # Broadcast location to relevant users
    await _emit_event(
        request,
        "worker_location",
        {
            "worker_id": current_user.id,
            "latitude": location_data.latitude,
            "longitude": location_data.longitude,
        },
        room=f"worker_{current_user.id}",
    )
    
    return {"message": "Location updated successfully"}

@router.post("/worker/requests/{request_id}/accept")
async def accept_request(
    request_id: int,
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != UserRole.WORKER:
        raise HTTPException(status_code=403, detail="Only workers can accept requests")
    
    waste_request = db.query(WasteRequest).filter(WasteRequest.id == request_id).first()
    if not waste_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if waste_request.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not available")
    
    waste_request.worker_id = current_user.id
    waste_request.status = RequestStatus.ASSIGNED
    waste_request.assigned_at = datetime.utcnow()
    
    db.commit()
    
    # Notify user via WebSocket
    await _emit_event(
        http_request,
        "request_assigned",
        {
            "request_id": request_id,
            "worker_name": current_user.name,
        },
        room=f"user_{waste_request.user_id}",
    )
    
    return {"message": "Request accepted successfully"}

# NGO endpoints
@router.get("/ngos")
def get_ngos(db: Session = Depends(get_db)):
    ngos = db.query(User).filter(User.role == UserRole.NGO).all()
    return [{
        "id": n.id,
        "name": n.name,
        "email": n.email,
        "phone": n.phone,
        "address": n.address,
        "specialization": ["food", "clothes", "other"]  # Default specialization for now
    } for n in ngos]

@router.get("/donations")
def get_donations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == UserRole.NGO:
        # Get available donations for NGOs
        donations = db.query(Donation).filter(
            Donation.status.in_([RequestStatus.PENDING, RequestStatus.ASSIGNED])
        ).all()
    else:
        # Get user's own donations
        donations = db.query(Donation).filter(Donation.user_id == current_user.id).all()
    
    return [{
        "id": d.id,
        "donation_type": d.donation_type.value,
        "description": d.description,
        "source": d.source,
        "status": d.status.value,
        "pickup_address": d.pickup_address,
        "created_at": d.created_at.isoformat()
    } for d in donations]

@router.post("/donations")
async def create_donation(
    donation_data: DonationCreate,
    photo: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Handle photo upload
    photo_url = None
    if photo:
        os.makedirs("uploads", exist_ok=True)
        photo_url = f"uploads/{photo.filename}"
        with open(photo_url, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
    
    # Create donation
    donation = Donation(
        user_id=current_user.id,
        donation_type=DonationType(donation_data.donation_type),
        description=donation_data.description,
        source=donation_data.source,
        photo_url=photo_url,
        pickup_latitude=donation_data.pickup_latitude,
        pickup_longitude=donation_data.pickup_longitude,
        pickup_address=donation_data.pickup_address
    )
    
    db.add(donation)
    db.commit()
    db.refresh(donation)
    
    return {"id": donation.id, "status": donation.status.value}

@router.post("/donations/{donation_id}/accept")
async def accept_donation(
    donation_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != UserRole.NGO:
        raise HTTPException(status_code=403, detail="Only NGOs can accept donations")
    
    donation = db.query(Donation).filter(Donation.id == donation_id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    
    if donation.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Donation is not available")
    
    donation.ngo_id = current_user.id
    donation.status = RequestStatus.ASSIGNED
    donation.assigned_at = datetime.utcnow()
    
    db.commit()
    
    # Notify donor via WebSocket
    await _emit_event(
        request,
        "donation_accepted",
        {
            "donation_id": donation_id,
            "ngo_name": current_user.name,
        },
        room=f"user_{donation.user_id}",
    )
    
    return {"message": "Donation accepted successfully"}

# Marketplace endpoints
@router.get("/marketplace")
def get_marketplace_listings(db: Session = Depends(get_db)):
    listings = db.query(MarketplaceListing).filter(MarketplaceListing.is_sold == False).all()
    return [{
        "id": l.id,
        "title": l.title,
        "description": l.description,
        "price": l.price,
        "category": l.category,
        "photo_urls": l.photo_urls,
        "seller_id": l.seller_id,
        "seller_name": l.seller.name,
        "created_at": l.created_at.isoformat()
    } for l in listings]

@router.post("/marketplace")
async def create_listing(
    listing_data: MarketplaceCreate,
    photos: List[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Handle photo uploads
    photo_urls = []
    if photos:
        os.makedirs("uploads", exist_ok=True)
        for photo in photos:
            if photo.filename:
                photo_url = f"uploads/{photo.filename}"
                with open(photo_url, "wb") as buffer:
                    shutil.copyfileobj(photo.file, buffer)
                photo_urls.append(photo_url)
    
    # Create listing
    listing = MarketplaceListing(
        seller_id=current_user.id,
        title=listing_data.title,
        description=listing_data.description,
        price=listing_data.price,
        category=listing_data.category,
        photo_urls=",".join(photo_urls) if photo_urls else None
    )
    
    db.add(listing)
    db.commit()
    db.refresh(listing)
    
    return {"id": listing.id, "message": "Listing created successfully"}

@router.put("/marketplace/{listing_id}/sold")
def mark_listing_sold(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    listing = db.query(MarketplaceListing).filter(MarketplaceListing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this listing")
    
    listing.is_sold = True
    listing.sold_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Listing marked as sold"}

# Chat endpoints
@router.get("/chats")
def get_chats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Get all conversations for current user
    chats = db.query(ChatMessage).filter(
        (ChatMessage.sender_id == current_user.id) | 
        (ChatMessage.receiver_id == current_user.id)
    ).order_by(ChatMessage.created_at.desc()).all()
    
    return [{
        "id": c.id,
        "message": c.message,
        "sender_id": c.sender_id,
        "receiver_id": c.receiver_id,
        "waste_request_id": c.waste_request_id,
        "marketplace_listing_id": c.marketplace_listing_id,
        "created_at": c.created_at.isoformat(),
        "is_read": c.is_read
    } for c in chats]

@router.post("/chats")
async def send_chat_message(
    message_data: ChatMessageCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Create message
    message = ChatMessage(
        sender_id=current_user.id,
        receiver_id=message_data.receiver_id,
        message=message_data.message,
        waste_request_id=message_data.waste_request_id,
        marketplace_listing_id=message_data.marketplace_listing_id
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Send via WebSocket
    await _emit_event(
        request,
        "new_message",
        {
            "id": message.id,
            "message": message.message,
            "sender_id": current_user.id,
            "sender_name": current_user.name,
            "created_at": message.created_at.isoformat(),
        },
        room=f"user_{message_data.receiver_id}",
    )
    
    return {"id": message.id, "message": "Message sent successfully"}

@router.get("/chats/messages")
def get_chat_messages(
    receiver_id: int,
    marketplace_listing_id: int = None,
    waste_request_id: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ChatMessage).filter(
        (
            (ChatMessage.sender_id == current_user.id) & (ChatMessage.receiver_id == receiver_id)
        ) | (
            (ChatMessage.sender_id == receiver_id) & (ChatMessage.receiver_id == current_user.id)
        )
    )
    
    if marketplace_listing_id:
        query = query.filter(ChatMessage.marketplace_listing_id == marketplace_listing_id)
    elif waste_request_id:
        query = query.filter(ChatMessage.waste_request_id == waste_request_id)
    
    messages = query.order_by(ChatMessage.created_at.asc()).all()
    
    return [{
        "id": m.id,
        "message": m.message,
        "sender_id": m.sender_id,
        "receiver_id": m.receiver_id,
        "waste_request_id": m.waste_request_id,
        "marketplace_listing_id": m.marketplace_listing_id,
        "created_at": m.created_at.isoformat(),
        "is_read": m.is_read
    } for m in messages]

# AI endpoints
@router.post("/ai/classify")
async def classify_waste_endpoint(
    description: str,
    photo: UploadFile = File(None)
):
    image_data = None
    if photo:
        image_data = await photo.read()
    
    result = classify_waste(description, image_data)
    
    return result

@router.post("/ai/chat")
async def ai_chat_endpoint(query: AIQuery):
    result = chat_with_ai(query.message, query.context)
    
    return result