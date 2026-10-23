import uuid
import logging
from typing import List, Optional, Dict, Any

from app.database import get_db
from app.models.support import SupportTicket, TicketMessage, CreateTicketRequest
from app.services.notification_service import NotificationService
from app.services.audit_service import AuditService
from app.models.notification import NotificationType
from app.utils.timezone_utils import utc_now, format_ist

logger = logging.getLogger(__name__)

class SupportService:
    """Service for managing support tickets and reports."""
    
    def __init__(self):
        self.notification_service = NotificationService()
        self.audit_service = AuditService()
    
    async def create_ticket(self, user_id: str, request: CreateTicketRequest) -> SupportTicket:
        """Create a new support ticket and notify admins via Telegram."""
        db = get_db()
        
        ticket_id = f"TICKET-{str(uuid.uuid4())[:8].upper()}"
        
        # Initial message from user description
        initial_message = TicketMessage(
            sender_id=user_id,
            content=request.description,
            timestamp=utc_now(),
            is_admin=False
        )
        
        ticket = SupportTicket(
            ticket_id=ticket_id,
            user_id=user_id,
            type=request.type,
            subject=request.subject,
            description=request.description,
            status="open",
            priority=request.priority,
            reported_user_id=request.reported_user_id,
            messages=[initial_message],
            created_at=utc_now(),
            updated_at=utc_now()
        )
        
        await db.support_tickets.insert_one(ticket.model_dump())
        
        # Log to Telegram Admin Channel
        await self._notify_admins_telegram(ticket)
        
        return ticket

    async def get_user_tickets(self, user_id: str) -> List[SupportTicket]:
        """Get all tickets for a user."""
        db = get_db()
        cursor = db.support_tickets.find({"user_id": user_id}).sort("updated_at", -1)
        return [SupportTicket(**doc) async for doc in cursor]

    async def get_ticket(self, ticket_id: str) -> Optional[SupportTicket]:
        """Get a single ticket by ID."""
        db = get_db()
        doc = await db.support_tickets.find_one({"ticket_id": ticket_id})
        return SupportTicket(**doc) if doc else None

    async def get_all_open_tickets(self) -> List[SupportTicket]:
        """Get all open tickets for admins."""
        db = get_db()
        cursor = db.support_tickets.find(
            {"status": {"$in": ["open", "in_progress"]}}
        ).sort("created_at", -1)
        
        tickets = []
        async for doc in cursor:
            try:
                tickets.append(SupportTicket(**doc))
            except Exception as e:
                logger.warning(f"Failed to parse ticket {doc.get('ticket_id', 'unknown')}: {e}")
                continue
        return tickets

    async def add_user_message(self, ticket_id: str, user_id: str, content: str) -> Optional[SupportTicket]:
        """Add a message from the user to the ticket."""
        db = get_db()
        
        ticket = await self.get_ticket(ticket_id)
        if not ticket or ticket.user_id != user_id:
            return None
            
        message = TicketMessage(
            sender_id=user_id,
            content=content,
            timestamp=utc_now(),
            is_admin=False
        )
        
        update_result = await db.support_tickets.find_one_and_update(
            {"ticket_id": ticket_id},
            {
                "$push": {"messages": message.model_dump()},
                "$set": {
                    "updated_at": utc_now(),
                    "status": "open" if ticket.status == "resolved" else ticket.status 
                }
            },
            return_document=True
        )
        
        if update_result:
            updated_ticket = SupportTicket(**update_result)
            # Notify admins of new reply
            await self._notify_admins_reply(updated_ticket, message)
            # Auto-reply acknowledgement to user
            await self._send_auto_reply(updated_ticket)
            return updated_ticket
            
        return None
    
    async def _send_auto_reply(self, ticket: SupportTicket):
        """Send auto-reply acknowledgement to user when they send a message."""
        try:
            await self.notification_service.send_notification(
                user_id=ticket.user_id,
                notification_type=NotificationType.SYSTEM,
                title="Message Received",
                body=f"We received your message on ticket {ticket.ticket_id}. An admin will respond shortly.",
                data={"type": "ticket_auto_reply", "ticket_id": ticket.ticket_id},
                send_push=True
            )
        except Exception as e:
            logger.warning(f"Failed to send auto-reply for ticket {ticket.ticket_id}: {e}")

    async def add_admin_reply(self, ticket_id: str, admin_id: str, content: str) -> Optional[SupportTicket]:
        """Add a reply from an admin via Telegram."""
        db = get_db()
        
        ticket = await self.get_ticket(ticket_id)
        if not ticket:
            return None
            
        message = TicketMessage(
            sender_id="admin",
            sender_name=f"Admin ({admin_id})",
            content=content,
            timestamp=utc_now(),
            is_admin=True
        )
        
        update_result = await db.support_tickets.find_one_and_update(
            {"ticket_id": ticket_id},
            {
                "$push": {"messages": message.model_dump()},
                "$set": {
                    "updated_at": utc_now(),
                    "status": "in_progress" # Mark in progress when admin replies
                }
            },
            return_document=True
        )
        
        if update_result:
            updated_ticket = SupportTicket(**update_result)
            
            # Notify user
            await self.notification_service.send_notification(
                user_id=ticket.user_id,
                notification_type=NotificationType.SYSTEM,
                title="Support Update",
                body=f"New reply on ticket {ticket.ticket_id}: {content[:50]}...",
                data={"type": "ticket_update", "ticket_id": ticket_id},
                send_push=True
            )
            
            return updated_ticket
            
        return None

    async def _notify_admins_telegram(self, ticket: SupportTicket):
        """Send formatted notification to Telegram log channel."""
        try:
            timestamp = format_ist(utc_now())
            
            type_tag = "[ISSUE]" if ticket.type == "issue" else "[FEATURE]" if ticket.type == "feature" else "[ALERT]"
            
            msg = (
                f"{type_tag} *NEW SUPPORT TICKET*\n"
                f"`{timestamp}`\n"
                f"ID: `{ticket.ticket_id}`\n"
                f"User: `{ticket.user_id}`\n"
                f"Type: *{ticket.type.upper()}*\n"
                f"Subject: {ticket.subject}\n"
                f"Desc: {ticket.description}\n\n"
                f"Reply usage: `/reply {ticket.ticket_id} <message>`"
            )
            
            await self.audit_service._send_telegram_log(msg)
        except Exception:
            pass

    async def _notify_admins_reply(self, ticket: SupportTicket, message: TicketMessage):
        """Notify admins that user replied."""
        try:
            timestamp = format_ist(utc_now())
            
            msg = (
                f"[USER REPLY]\n"
                f"`{timestamp}` | Ticket `{ticket.ticket_id}`\n"
                f"User: `{ticket.user_id}`\n"
                f"Message: {message.content}\n\n"
                f"Reply usage: `/reply {ticket.ticket_id} <message>`"
            )
            
            await self.audit_service._send_telegram_log(msg)
        except Exception:
            pass

    async def close_ticket(self, ticket_id: str, closed_by: str, reason: str = None) -> Optional[SupportTicket]:
        """Close a support ticket."""
        db = get_db()
        
        ticket = await self.get_ticket(ticket_id)
        if not ticket:
            return None
            
        update_result = await db.support_tickets.find_one_and_update(
            {"ticket_id": ticket_id},
            {
                "$set": {
                    "status": "closed",
                    "updated_at": utc_now(),
                    "resolved_at": utc_now(),
                    "resolved_by": closed_by
                }
            },
            return_document=True
        )
        
        if update_result:
            updated_ticket = SupportTicket(**update_result)
            
            # Notify User if closed by admin
            if closed_by != ticket.user_id:
                await self.notification_service.send_notification(
                    user_id=ticket.user_id,
                    notification_type=NotificationType.SYSTEM,
                    title="Ticket Closed",
                    body=f"Your ticket {ticket_id} has been closed by support.",
                    data={"type": "ticket_closed", "ticket_id": ticket_id},
                    send_push=True
                )
            
            timestamp = format_ist(utc_now())
            msg = (
                f"[TICKET CLOSED]\n"
                f"`{timestamp}` | Ticket `{ticket_id}`\n"
                f"Closed by: `{closed_by}`\n"
                f"Reason: {reason or 'Resolved'}"
            )
            await self.audit_service._send_telegram_log(msg)
            
            return updated_ticket
        
        return None
