# IMPORTANT: This file is for reference only. The main.py file is the entry point for the application.
# Do not run this file directly. Use main.py instead.

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import List, Optional
import socketio
import uvicorn
from datetime import datetime, timedelta
import os
import shutil
import json
from pydantic import BaseModel

from database import (
    Base, engine, get_db, SessionLocal, User, WasteRequest, Donation, MarketplaceListing, 
    ChatMessage, WastePrice, WorkerLocation, UserRole, RequestStatus, 
    WasteType, DonationType
)
from auth import (
    get_password_hash, verify_password, create_access_token, 
    get_current_user, get_current_admin
)
from gemini_service import classify_waste, chat_with_ai

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="CiCaWa API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000", "http://127.0.0.1:5000", "https://*.replit.dev", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*"
)

# Pydantic models for API
class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    phone: str
    address: str
    latitude: float
    longitude: float
    is_business: bool = False

class UserLogin(BaseModel):
    email: str
    password: str

class WasteRequestCreate(BaseModel):
    waste_type: str
    quantity: float
    description: str
    pickup_latitude: float
    pickup_longitude: float
    pickup_address: str

class RoleUpdate(BaseModel):
    email: str
    role: str

class PriceUpdate(BaseModel):
    waste_type: str
    price_per_kg: float

# Initialize default data
def init_default_data():
    db = SessionLocal()
    try:
        # Create admin user
        admin = db.query(User).filter(User.email == "christopherjoshy4@gmail.com").first()
        if not admin:
            admin_user = User(
                email="christopherjoshy4@gmail.com",
                hashed_password=get_password_hash("password"),
                name="Christopher Joshy",
                phone="",
                address="",
                latitude=0.0,
                longitude=0.0,
                role=UserRole.ADMIN,
                is_business=False
            )
            db.add(admin_user)
            db.commit()
        
        # Create default waste prices
        for waste_type in WasteType:
            price = db.query(WastePrice).filter(WastePrice.waste_type == waste_type).first()
            if not price:
                default_prices = {
                    WasteType.PLASTIC: 2.0,
                    WasteType.GLASS: 1.5,
                    WasteType.METAL: 5.0,
                    WasteType.PAPER: 1.0,
                    WasteType.ORGANIC: 0.5,
                    WasteType.ELECTRONIC: 10.0,
                    WasteType.TEXTILE: 3.0,
                    WasteType.HAZARDOUS: 15.0
                }
                waste_price = WastePrice(
                    waste_type=waste_type,
                    price_per_kg=default_prices.get(waste_type, 1.0)
                )
                db.add(waste_price)
        db.commit()
    finally:
        db.close()

# Authentication endpoints
@app.post("/auth/register")
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        name=user_data.name,
        phone=user_data.phone,
        address=user_data.address,
        latitude=user_data.latitude,
        longitude=user_data.longitude,
        is_business=user_data.is_business,
        role=UserRole.USER
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role.value
        }
    }

@app.post("/auth/login")
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role.value
        }
    }

@app.get("/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "phone": current_user.phone,
        "address": current_user.address,
        "role": current_user.role.value,
        "is_business": current_user.is_business
    }

@app.get("/")
def read_root():
    return {"message": "CiCaWa API is running!"}

@app.get("/waste-types")
def get_waste_types():
    return [{"value": wt.value, "label": wt.value.title()} for wt in WasteType]

@app.get("/waste-prices")
def get_waste_prices(db: Session = Depends(get_db)):
    prices = db.query(WastePrice).all()
    return {p.waste_type.value: p.price_per_kg for p in prices}

# AI endpoints
@app.post("/ai/classify")
async def classify_waste_endpoint(
    description: str,
    photo: UploadFile = File(None)
):
    """Classify waste using Gemini AI"""
    try:
        image_data = None
        if photo:
            image_data = await photo.read()
        
        result = classify_waste(description, image_data)
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "fallback_type": "organic"
        }

@app.post("/ai/chat")
async def ai_chat_endpoint(query: dict):
    """Chat with CiCaWa AI assistant"""
    try:
        message = query.get('message', '')
        context = query.get('context', '')
        
        result = chat_with_ai(message, context)
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "response": "I'm sorry, I couldn't process your request right now. Please try again later."
        }

# Admin endpoints
@app.put("/admin/users/role")
def update_user_role(role_data: RoleUpdate, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == role_data.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        user.role = UserRole(role_data.role)
        db.commit()
        return {"message": "Role updated successfully"}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role")

@app.put("/admin/waste-prices")
def update_waste_price(price_data: PriceUpdate, admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    try:
        waste_type = WasteType(price_data.waste_type)
        price = db.query(WastePrice).filter(WastePrice.waste_type == waste_type).first()
        if price:
            price.price_per_kg = price_data.price_per_kg
            price.updated_at = datetime.utcnow()
        else:
            price = WastePrice(waste_type=waste_type, price_per_kg=price_data.price_per_kg)
            db.add(price)
        db.commit()
        return {"message": "Price updated successfully"}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid waste type")

# Startup event
@app.on_event("startup")
def startup_event():
    print("🚀 Starting CiCaWa API...")
    init_default_data()
    print("✅ Admin account seeded successfully!")
    print("✅ Default waste prices initialized!")

# Create Socket.IO app
socket_app = socketio.ASGIApp(sio, app)

if __name__ == "__main__":
    uvicorn.run("app:socket_app", host="0.0.0.0", port=8000, reload=True)