from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./cicawa.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class UserRole(str, enum.Enum):
    USER = "user"
    WORKER = "worker"
    NGO = "ngo"
    HARITHA_KARMA = "haritha_karma"
    ADMIN = "admin"

class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class WasteType(str, enum.Enum):
    PLASTIC = "plastic"
    GLASS = "glass"
    METAL = "metal"
    PAPER = "paper"
    ORGANIC = "organic"
    ELECTRONIC = "electronic"
    TEXTILE = "textile"
    HAZARDOUS = "hazardous"

class DonationType(str, enum.Enum):
    FOOD = "food"
    CLOTHES = "clothes"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String)
    address = Column(Text)
    latitude = Column(Float)
    longitude = Column(Float)
    role = Column(Enum(UserRole), default=UserRole.USER)
    is_business = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    waste_requests = relationship("WasteRequest", foreign_keys="WasteRequest.user_id", back_populates="user")
    donations = relationship("Donation", foreign_keys="Donation.user_id", back_populates="user")
    marketplace_listings = relationship("MarketplaceListing", back_populates="seller")
    worker_assignments = relationship("WasteRequest", foreign_keys="WasteRequest.worker_id", back_populates="worker")
    ngo_assignments = relationship("Donation", foreign_keys="Donation.ngo_id", back_populates="ngo")

class WasteRequest(Base):
    __tablename__ = "waste_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    waste_type = Column(Enum(WasteType), nullable=False)
    quantity = Column(Float, nullable=False)
    description = Column(Text)
    photo_url = Column(String)
    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING)
    pickup_latitude = Column(Float, nullable=False)
    pickup_longitude = Column(Float, nullable=False)
    pickup_address = Column(Text, nullable=False)
    estimated_price = Column(Float)
    final_price = Column(Float)
    confidence_score = Column(Float)  # AI classification confidence
    created_at = Column(DateTime, default=datetime.utcnow)
    assigned_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="waste_requests")
    worker = relationship("User", foreign_keys=[worker_id], back_populates="worker_assignments")
    chat_messages = relationship("ChatMessage", back_populates="waste_request")

class Donation(Base):
    __tablename__ = "donations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    ngo_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    donation_type = Column(Enum(DonationType), nullable=False)
    description = Column(Text, nullable=False)
    photo_url = Column(String)
    source = Column(String, nullable=False)  # home, hotel, business
    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING)
    pickup_latitude = Column(Float, nullable=False)
    pickup_longitude = Column(Float, nullable=False)
    pickup_address = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    assigned_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="donations")
    ngo = relationship("User", foreign_keys=[ngo_id], back_populates="ngo_assignments")
    worker = relationship("User", foreign_keys=[worker_id])

class MarketplaceListing(Base):
    __tablename__ = "marketplace_listings"
    
    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Float, nullable=False)
    photo_urls = Column(Text)  # JSON array of photo URLs
    category = Column(String, nullable=False)
    is_sold = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    sold_at = Column(DateTime)
    
    # Relationships
    seller = relationship("User", back_populates="marketplace_listings")
    chat_messages = relationship("ChatMessage", back_populates="marketplace_listing")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    waste_request_id = Column(Integer, ForeignKey("waste_requests.id"), nullable=True)
    marketplace_listing_id = Column(Integer, ForeignKey("marketplace_listings.id"), nullable=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
    waste_request = relationship("WasteRequest", back_populates="chat_messages")
    marketplace_listing = relationship("MarketplaceListing", back_populates="chat_messages")

class WastePrice(Base):
    __tablename__ = "waste_prices"
    
    id = Column(Integer, primary_key=True, index=True)
    waste_type = Column(Enum(WasteType), unique=True, nullable=False)
    price_per_kg = Column(Float, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow)

class WorkerLocation(Base):
    __tablename__ = "worker_locations"
    
    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    worker = relationship("User")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()