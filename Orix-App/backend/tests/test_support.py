
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime

from app.models.support import CreateTicketRequest, SupportTicket, TicketMessage
from app.services.support_service import SupportService

class TestSupportService:
    
    @pytest.fixture
    def mock_db(self):
        with patch('app.services.support_service.get_db') as mock_get_db:
            db = MagicMock()
            mock_get_db.return_value = db
            yield db

    @pytest.fixture
    def mock_audit_service(self):
        with patch('app.services.support_service.AuditService') as MockAuditService:
            instance = MockAuditService.return_value
            instance._send_telegram_log = AsyncMock()
            yield instance

    @pytest.fixture
    def service(self, mock_audit_service): 
        # We need to patch NotificationService as well to avoid real calls
        with patch('app.services.support_service.NotificationService') as MockNotificationService:
            instance = MockNotificationService.return_value
            instance.send_notification = AsyncMock()
            return SupportService()

    @pytest.mark.asyncio
    async def test_create_ticket_success(self, service, mock_db, mock_audit_service):
        # Setup
        user_id = "user_123"
        req = CreateTicketRequest(
            type="issue",
            subject="Bug report",
            description="Something is broken",
            reported_user_id=None
        )
        
        # Mock DB insert
        mock_db.support_tickets.insert_one = AsyncMock(return_value=MagicMock(inserted_id="ticket_abc"))
        mock_audit_service.log_audit_event = AsyncMock()
        mock_audit_service._send_telegram_log = AsyncMock()

        # Execute
        ticket = await service.create_ticket(user_id, req)

        # Verify
        assert ticket.user_id == user_id
        assert ticket.subject == "Bug report"
        assert ticket.status == "open"
        assert ticket.ticket_id.startswith("TICKET-")
        
        # Verify DB interactions
        mock_db.support_tickets.insert_one.assert_called_once()
        ca = mock_db.support_tickets.insert_one.call_args[0][0]
        assert ca['ticket_id'] == ticket.ticket_id # Verify the inserted doc has the same ID
        assert ca['user_id'] == user_id
        assert ca['type'] == "issue"
        
        # Verify Notifications
        mock_audit_service._send_telegram_log.assert_called_once()
        assert "NEW SUPPORT TICKET" in mock_audit_service._send_telegram_log.call_args[0][0]

    @pytest.mark.asyncio
    async def test_add_user_message_success(self, service, mock_db, mock_audit_service):
        # Setup
        ticket_id = "ticket_123"
        user_id = "user_123"
        content = "Here is more info"
        
        # Mock DB find
        mock_doc = {
            "ticket_id": ticket_id,
            "user_id": user_id,
            "messages": [],
            "status": "open",
            "type": "issue",
            "subject": "Test",
            "description": "Desc",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
        mock_db.support_tickets.find_one = AsyncMock(return_value=mock_doc)
        # Fix: ensure find_one_and_update is an AsyncMock that returns the updated doc
        mock_doc_updated = mock_doc.copy()
        mock_doc_updated["messages"].append({
            "sender_id": user_id, 
            "content": content, 
            "is_admin": False,
            "timestamp": datetime.now()
        })
        mock_db.support_tickets.find_one_and_update = AsyncMock(return_value=mock_doc_updated)
        
        # Mock Notification service for push notification
        # notification_service is already mocked in the service fixture via patch
        mock_notif = service.notification_service
        
        # Execute
        updated_ticket = await service.add_user_message(ticket_id, user_id, content)
             
        # Verify
        assert updated_ticket is not None
        assert len(updated_ticket.messages) == 1
        assert updated_ticket.messages[0].content == content
        assert updated_ticket.messages[0].sender_id == user_id
        assert updated_ticket.messages[0].is_admin is False
             
        # Verify Telegram notification to admin
        mock_audit_service._send_telegram_log.assert_called_once()
        assert "USER REPLY" in mock_audit_service._send_telegram_log.call_args[0][0]

    @pytest.mark.asyncio
    async def test_add_admin_reply_success(self, service, mock_db, mock_audit_service):
        # Setup
        ticket_id = "ticket_123"
        admin_id = "admin_999"
        content = "We fixed it"
        user_id = "user_123"
        
        mock_doc = {
            "ticket_id": ticket_id,
            "user_id": user_id,
            "messages": [],
            "status": "open",
            "type": "issue",
            "subject": "Test",
            "description": "Desc",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
        mock_db.support_tickets.find_one = AsyncMock(return_value=mock_doc)
        
        # Fix: ensure find_one_and_update is an AsyncMock
        mock_doc_updated = mock_doc.copy()
        mock_doc_updated["status"] = "in_progress" # STATUS MUST BE UPDATED
        mock_doc_updated["messages"].append({
            "sender_id": "admin", 
            "content": content, 
            "is_admin": True,
            "timestamp": datetime.now()
        })
        mock_db.support_tickets.find_one_and_update = AsyncMock(return_value=mock_doc_updated)
        
        mock_notif = service.notification_service
        mock_notif.send_notification = AsyncMock()
            
        # Execute
        updated_ticket = await service.add_admin_reply(ticket_id, admin_id, content)
            
        # Verify
        assert updated_ticket is not None
        assert updated_ticket.status == "in_progress" # Should auto-update status (though validation depends on mock return logic)
        assert len(updated_ticket.messages) == 1
        assert updated_ticket.messages[0].is_admin is True
            
        # Verify Push Notification to User
        mock_notif.send_notification.assert_called_once()
        call_kwargs = mock_notif.send_notification.call_args.kwargs
        assert call_kwargs['user_id'] == user_id
        assert "Support Update" in call_kwargs['title']

