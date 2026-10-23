from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
import socketio
import uvicorn
from datetime import datetime
from math import radians, sin, cos, sqrt, atan2
import os
import shutil
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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
from schemas import (
    UserRegister,
    UserLogin,
    WasteRequestCreate,
    DonationCreate,
    MarketplaceCreate,
    ChatMessageCreate,
    RoleUpdate,
    PriceUpdate,
)
from api_endpoints import router as api_router

# Create database tables
try:
    print("Initializing database...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database initialized successfully")
except Exception as e:
    print(f"❌ Error initializing database: {str(e)}")
    print("Make sure your database configuration is correct in .env file")
    raise

app = FastAPI(title="CiCaWa API", version="1.0.0")
security = HTTPBearer()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Socket.IO setup
try:
    sio = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins="*"
    )
    print("Socket.IO server initialized successfully")
except Exception as e:
    print(f"Error setting up Socket.IO: {str(e)}")
    # Attempt a minimal Socket.IO server so event decorators remain usable
    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio, app)
app.state.sio = sio
app.include_router(api_router)


@app.get("/")
def read_root():
    return {"message": "CiCaWa API is running!"}


# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "version": "1.0.0",
        "timestamp": str(datetime.now()),
        "environment": os.environ.get("ENVIRONMENT", "development") 
    }
    
# Debug info endpoint - helpful for troubleshooting
@app.get("/debug")
async def debug_info():
    import platform
    import sys
    
    # Get middleware info for debugging
    cors_config = None
    for middleware in app.user_middleware:
        if "CORSMiddleware" in str(middleware.cls):
            cors_config = {
                "allow_origins": app.state.cors_allow_origins,
                "allow_methods": app.state.cors_allow_methods,
                "allow_headers": app.state.cors_allow_headers,
                "allow_credentials": app.state.cors_allow_credentials,
            }
    
    return {
        "server": {
            "host": os.environ.get("HOST", "0.0.0.0"),
            "port": int(os.environ.get("PORT", 8000)),
            "environment": os.environ.get("ENVIRONMENT", "development"),
            "database_url": os.environ.get("DATABASE_URL", "sqlite:///./cicawa.db").replace(":///", "://"),
        },
        "system": {
            "platform": platform.platform(),
            "python_version": sys.version,
        },
        "cors": cors_config,
        "routes": [{
            "path": route.path,
            "name": route.name,
            "methods": route.methods,
        } for route in app.routes],
    }

# CORS test endpoint and options preflight handling
@app.options("/{full_path:path}")
async def options_route(full_path: str):
    return {"status": "ok"}

@app.get("/cors-test")
async def cors_test():
    return {
        "cors": "working",
        "timestamp": str(datetime.now()),
        "message": "If you can see this message in your browser or frontend, CORS is configured correctly"
    }


@app.get("/waste-types")
def get_waste_types():
    return [{"value": wt.value, "label": wt.value.title()} for wt in WasteType]


@app.get("/waste-prices")
def get_waste_prices(db: Session = Depends(get_db)):
    prices = db.query(WastePrice).all()
    return {price.waste_type.value: price.price_per_kg for price in prices}

# Initialize default data
def init_default_data(db: Session):
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

# Startup event
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        init_default_data(db)
    finally:
        db.close()

# Socket.IO events
@sio.event
async def connect(sid, environ):
    print(f"Client {sid} connected")

@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")

@sio.event
async def join_room(sid, data):
    room = data['room']
    await sio.enter_room(sid, room)
    await sio.emit('joined', {'room': room}, room=sid)

@sio.event
async def leave_room(sid, data):
    room = data['room']
    await sio.leave_room(sid, room)

@sio.event
async def send_message(sid, data):
    room = data['room']
    await sio.emit('message', data, room=room, skip_sid=sid)

@sio.event
async def update_location(sid, data):
    room = f"worker_{data['worker_id']}"
    await sio.emit('location_update', data, room=room)

# Authentication endpoints
@app.post("/auth/register")
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Check if user exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
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
    
    # Create access token
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
    # Find user
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    # Create access token
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

@app.get("/admin/users")
def get_all_users(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [{"id": u.id, "email": u.email, "name": u.name, "role": u.role.value} for u in users]

# NGO endpoints
@app.get("/ngos")
def get_ngos(db: Session = Depends(get_db)):
    # Return mock NGO data for now
    mock_ngos = [
        {
            "id": 1,
            "name": "Green Earth Foundation",
            "email": "contact@greenearth.org",
            "phone": "+91 9876543210",
            "address": "123 Green Street, Kochi, Kerala 682001",
            "specialization": ["food", "clothes", "education"]
        },
        {
            "id": 2,
            "name": "Kerala Relief Foundation",
            "email": "help@keralarelief.org",
            "phone": "+91 9876543211",
            "address": "456 Relief Road, Thiruvananthapuram, Kerala 695001",
            "specialization": ["food", "medical", "disaster relief"]
        },
        {
            "id": 3,
            "name": "Hope for Tomorrow",
            "email": "info@hopefortomorrow.org",
            "phone": "+91 9876543212",
            "address": "789 Hope Avenue, Ernakulam, Kerala 682016",
            "specialization": ["clothes", "education", "orphanage"]
        },
        {
            "id": 4,
            "name": "Seva Charitable Trust",
            "email": "contact@sevatrust.org",
            "phone": "+91 9876543213",
            "address": "321 Service Lane, Kozhikode, Kerala 673001",
            "specialization": ["food", "medical", "elderly care"]
        },
        {
            "id": 5,
            "name": "Humanity First Kerala",
            "email": "kerala@humanityfirst.org",
            "phone": "+91 9876543214", 
            "address": "654 Humanity Street, Thrissur, Kerala 680001",
            "specialization": ["disaster relief", "food", "clothes"]
        }
    ]
    return mock_ngos

# Debug endpoint (fix CORS issue)
@app.get("/debug")
def get_debug_info():
    return {
        "status": "ok",
        "timestamp": str(datetime.now()),
        "message": "Debug endpoint working"
    }

# Waste request endpoints
@app.post("/waste-requests")
async def create_waste_request(
    request: WasteRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Classify waste using AI (simplified for now)
    try:
        waste_type = WasteType(request.waste_type)
    except ValueError:
        waste_type = WasteType.PLASTIC  # Default fallback
    
    confidence = 0.8
    quantity = request.quantity
    
    price = db.query(WastePrice).filter(WastePrice.waste_type == waste_type).first()
    estimated_price = (price.price_per_kg if price else 1.0) * quantity
    
    # Create waste request
    waste_request = WasteRequest(
        user_id=current_user.id,
        waste_type=waste_type,
        quantity=quantity,
        description=request.description,
        photo_url=None,  # Simplified for now
        pickup_latitude=request.pickup_latitude,
        pickup_longitude=request.pickup_longitude,
        pickup_address=request.pickup_address,
        estimated_price=estimated_price,
        confidence_score=confidence
    )
    
    db.add(waste_request)
    db.commit()
    db.refresh(waste_request)
    
    # Auto-assign to nearest worker if available
    await auto_assign_worker(waste_request, db)
    
    return {"id": waste_request.id, "status": waste_request.status.value, "estimated_price": estimated_price}

@app.get("/waste-requests")
def get_waste_requests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    requests = db.query(WasteRequest).filter(WasteRequest.user_id == current_user.id).all()
    return [{
        "id": req.id,
        "waste_type": req.waste_type.value,
        "quantity": req.quantity,
        "description": req.description,
        "status": req.status.value,
        "pickup_address": req.pickup_address,
        "pickup_latitude": req.pickup_latitude,
        "pickup_longitude": req.pickup_longitude,
        "estimated_price": req.estimated_price,
        "created_at": req.created_at.isoformat() if req.created_at else None
    } for req in requests]

# Marketplace endpoints
@app.post("/marketplace")
def create_marketplace_listing(
    listing: MarketplaceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    marketplace_listing = MarketplaceListing(
        title=listing.title,
        description=listing.description,
        price=listing.price,
        category=listing.category,
        seller_id=current_user.id
    )
    
    db.add(marketplace_listing)
    db.commit()
    db.refresh(marketplace_listing)
    
    return {"id": marketplace_listing.id, "message": "Listing created successfully"}

@app.get("/marketplace")
def get_marketplace_listings(db: Session = Depends(get_db)):
    listings = db.query(MarketplaceListing, User).join(User, MarketplaceListing.seller_id == User.id).all()
    return [{
        "id": listing.id,
        "title": listing.title,
        "description": listing.description,
        "price": listing.price,
        "category": listing.category,
        "seller_id": listing.seller_id,
        "seller_name": user.name,
        "created_at": listing.created_at.isoformat() if listing.created_at else None,
        "is_sold": False
    } for listing, user in listings]

# Donation endpoints
@app.post("/donations")
def create_donation(
    donation: DonationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_donation = Donation(
        user_id=current_user.id,
        donation_type=DonationType(donation.donation_type),
        description=donation.description,
        pickup_address=donation.pickup_address,
        pickup_latitude=donation.pickup_latitude,
        pickup_longitude=donation.pickup_longitude,
        source=donation.source
    )
    
    db.add(new_donation)
    db.commit()
    db.refresh(new_donation)
    
    return {"id": new_donation.id, "message": "Donation request created successfully"}

# AI Chat endpoint for waste advice
@app.post("/ai/chat")
def chat_with_ai_endpoint(query: dict, current_user: User = Depends(get_current_user)):
    try:
        user_message = query.get("message", "")
        if not user_message:
            raise HTTPException(status_code=400, detail="Message is required")
        
        # Use Gemini API for waste advice
        response = chat_with_ai(user_message)
        return {"response": response, "success": True}
    except Exception as e:
        return {"response": "I'm sorry, I'm having trouble processing your request right now. Please try again later.", "success": False, "error": str(e)}

async def auto_assign_worker(waste_request: WasteRequest, db: Session):
    if waste_request.worker_id is not None:
        return

    worker_locations = (
        db.query(WorkerLocation, User)
        .join(User, WorkerLocation.worker_id == User.id)
        .filter(User.role == UserRole.WORKER, User.is_active == True)
        .all()
    )

    if not worker_locations:
        return

    def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0  # Earth radius in kilometers
        phi1, phi2 = radians(lat1), radians(lat2)
        delta_phi = radians(lat2 - lat1)
        delta_lambda = radians(lon2 - lon1)

        a = sin(delta_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(delta_lambda / 2) ** 2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c

    nearest_worker = None
    nearest_distance = None

    for location, worker in worker_locations:
        distance_km = haversine(
            waste_request.pickup_latitude,
            waste_request.pickup_longitude,
            location.latitude,
            location.longitude,
        )
        if nearest_distance is None or distance_km < nearest_distance:
            nearest_worker = (location, worker, distance_km)
            nearest_distance = distance_km

    if nearest_worker is None:
        return

    location, worker, distance_km = nearest_worker

    waste_request.worker_id = worker.id
    waste_request.status = RequestStatus.ASSIGNED
    waste_request.assigned_at = datetime.utcnow()
    db.commit()
    db.refresh(waste_request)

    sio = getattr(app.state, "sio", None)
    if sio is not None:
        assignment_payload = {
            "request_id": waste_request.id,
            "worker_id": worker.id,
            "worker_name": worker.name,
            "distance_km": round(distance_km, 2),
        }
        await sio.emit(
            "request_assigned",
            assignment_payload,
            room=f"user_{waste_request.user_id}",
        )
        await sio.emit(
            "new_assignment",
            assignment_payload,
            room=f"worker_{worker.id}",
        )

@app.get("/waste-requests")
def get_waste_requests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == UserRole.WORKER:
        # Get nearby requests for workers
        requests = db.query(WasteRequest).filter(
            WasteRequest.status.in_([RequestStatus.PENDING, RequestStatus.ASSIGNED])
        ).all()
    else:
        # Get user's own requests
        requests = db.query(WasteRequest).filter(WasteRequest.user_id == current_user.id).all()
    
    return [{
        "id": r.id,
        "waste_type": r.waste_type.value,
        "quantity": r.quantity,
        "description": r.description,
        "status": r.status.value,
        "pickup_address": r.pickup_address,
        "pickup_latitude": r.pickup_latitude,
        "pickup_longitude": r.pickup_longitude,
        "estimated_price": r.estimated_price,
        "confidence_score": r.confidence_score,
        "worker_id": r.worker_id,
        "worker_name": r.worker.name if r.worker else None,
        "created_at": r.created_at.isoformat()
    } for r in requests]

# Continue with more endpoints...
if __name__ == "__main__":
    try:
        # Check if port is already in use
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        port = int(os.environ.get("PORT", 8000))
        host = os.environ.get("HOST", "0.0.0.0")
        
        # Test if port is available
        result = sock.connect_ex(("localhost", port))
        if result == 0:
            print(f"\n⚠️  WARNING: Port {port} is already in use!")
            print("⚠️  Another application might be running on this port.")
            print("⚠️  Stop the other application or set the PORT environment variable to a free port.\n")
        sock.close()
        
        print("="*80)
        print("CiCaWa Backend Server")
        print("="*80)
        print(f"🚀 Server starting on port: {port}")
        print(f"📡 Host: {host}")
        print(f"🔗 Local URL: http://localhost:{port}")
        print(f"🌍 Network URL: http://{host}:{port}")
        print("\n📚 API Documentation URLs:")
        print(f"   - Swagger UI: http://localhost:{port}/docs")
        print(f"   - ReDoc: http://localhost:{port}/redoc")
        print(f"   - Health Check: http://localhost:{port}/health")
        print(f"   - CORS Test: http://localhost:{port}/cors-test")
        print(f"\n⚠️  Make sure your frontend is configured to connect to http://localhost:{port}")
        print("="*80)
        print("Press Ctrl+C to stop the server")
        print("="*80)

        # Configure uvicorn reloader behaviour
        reload_env = os.environ.get("UVICORN_RELOAD", "0").lower()
        reload_enabled = reload_env in {"1", "true", "yes", "on"}
        app_target = "main:socket_app" if reload_enabled else socket_app

        uvicorn.run(app_target, host=host, port=port, reload=reload_enabled, log_level="info")
    except Exception as e:
        print("\n" + "!"*80)
        print(f"ERROR: Failed to start server: {str(e)}")
        print(f"Type of error: {type(e).__name__}")
        import traceback
        print("\nError details:")
        traceback.print_exc()
        print("!"*80)
        print("\nPossible solutions:")
        print("1. Check if another application is using port 8000")
        print("2. Check if you have permission to bind to the port")
        print("3. Verify your database connection settings")
        print("4. Make sure all required environment variables are set")
        print("5. Check for syntax errors in your code")
        print("\nPress Enter to exit...")
        input()
        import sys
        sys.exit(1)