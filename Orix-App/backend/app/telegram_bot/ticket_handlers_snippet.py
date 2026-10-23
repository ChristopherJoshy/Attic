
async def tickets(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View all open support tickets."""
    if not await require_admin(update):
        return
        
    tickets_list = await support_service.get_all_open_tickets()
    
    if not tickets_list:
        await update.message.reply_text("No open tickets! 🎉")
        return
        
    message = "*Open Tickets*\n\n"
    for ticket in tickets_list:
        emoji = "🐞" if ticket.type == "issue" else "💡" if ticket.type == "feature" else "🚨"
        msg_count = len(ticket.messages)
        message += (
            f"{emoji} `{ticket.ticket_id}`\n"
            f"Subject: {ticket.subject}\n"
            f"User: `{ticket.user_id}`\n"
            f"Msgs: {msg_count} | Status: {ticket.status}\n\n"
        )
        
    message += "Use `/reply <ticket_id> <message>` to respond."
    await update.message.reply_text(message, parse_mode="Markdown")

async def reply(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Reply to a support ticket."""
    if not await require_admin(update):
        return
        
    if len(context.args) < 2:
        await update.message.reply_text("Usage: /reply <ticket_id> <message>")
        return
        
    ticket_id = context.args[0]
    message_content = " ".join(context.args[1:])
    
    admin_id = f"telegram:{update.effective_user.id}"
    
    updated_ticket = await support_service.add_admin_reply(ticket_id, admin_id, message_content)
    
    if updated_ticket:
        await update.message.reply_text(f"✅ Reply sent to ticket `{ticket_id}`", parse_mode="Markdown")
        
        # Log action
        await audit_service.log_admin_action(
            admin_id=admin_id,
            admin_email=f"telegram:{update.effective_user.username}",
            action="reply_ticket",
            target_type="ticket",
            target_id=ticket_id,
            metadata={"content_preview": message_content[:50]}
        )
    else:
        await update.message.reply_text(f"❌ Ticket `{ticket_id}` not found.", parse_mode="Markdown")
