from typing import Optional

from pydantic import BaseModel


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


class DonationCreate(BaseModel):
    donation_type: str
    description: str
    source: str
    pickup_latitude: float
    pickup_longitude: float
    pickup_address: str


class MarketplaceCreate(BaseModel):
    title: str
    description: str
    price: float
    category: str


class ChatMessageCreate(BaseModel):
    message: str
    receiver_id: int
    waste_request_id: Optional[int] = None
    marketplace_listing_id: Optional[int] = None


class RoleUpdate(BaseModel):
    email: str
    role: str


class PriceUpdate(BaseModel):
    waste_type: str
    price_per_kg: float


class StatusUpdate(BaseModel):
    request_id: int
    status: str


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float


class AIQuery(BaseModel):
    message: str
    context: str = ""
