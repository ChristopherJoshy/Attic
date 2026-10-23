from typing import List

from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.models.user import User
from app.models.support import SupportTicket, CreateTicketRequest, AddMessageRequest
from app.services.support_service import SupportService

router = APIRouter()
support_service = SupportService()

@router.post("/tickets", response_model=SupportTicket)
async def create_ticket(
    request: CreateTicketRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new support ticket."""
    return await support_service.create_ticket(current_user.user_id, request)

@router.get("/tickets", response_model=List[SupportTicket])
async def get_user_tickets(
    current_user: User = Depends(get_current_user)
):
    """Get all tickets for the current user."""
    return await support_service.get_user_tickets(current_user.user_id)

@router.get("/tickets/{ticket_id}", response_model=SupportTicket)
async def get_ticket_details(
    ticket_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get details of a specific ticket."""
    ticket = await support_service.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if ticket.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this ticket")
        
    return ticket

@router.post("/tickets/{ticket_id}/message", response_model=SupportTicket)
async def add_message(
    ticket_id: str,
    request: AddMessageRequest,
    current_user: User = Depends(get_current_user)
):
    """Add a user message to a ticket."""
    updated_ticket = await support_service.add_user_message(ticket_id, current_user.user_id, request.content)
    
    if not updated_ticket:
        # Check if it was not found or not authorized
        ticket = await support_service.get_ticket(ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        if ticket.user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
    return updated_ticket

@router.post("/tickets/{ticket_id}/close", response_model=SupportTicket)
async def close_ticket(
    ticket_id: str,
    current_user: User = Depends(get_current_user)
):
    """Close a support ticket by the user."""
    # Check if ticket exists and belongs to user
    ticket = await support_service.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if ticket.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if ticket.status == "closed":
        return ticket
        
    updated_ticket = await support_service.close_ticket(
        ticket_id=ticket_id,
        closed_by=current_user.user_id,
        reason="Closed by user"
    )
    
    return updated_ticket
