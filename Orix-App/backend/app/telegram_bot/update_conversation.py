
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ContextTypes,
    ConversationHandler,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
)
from telegram.constants import ParseMode

from app.database import get_db
from app.telegram_bot.utils import require_master_admin
from app.utils.timezone_utils import utc_now
import warnings
from telegram.warnings import PTBUserWarning

warnings.filterwarnings("ignore", category=PTBUserWarning, message="If 'per_message=False'")

# States
SELECT_ACTION, ENTER_VERSION, ENTER_TITLE, ENTER_NOTES = range(4)

# Callback data
CB_EDIT_VERSION = "upd_ver"
CB_EDIT_TITLE = "upd_title"
CB_EDIT_NOTES = "upd_notes"
CB_TOGGLE_FORCE = "upd_force"
CB_PUBLISH = "upd_pub"
CB_CANCEL = "upd_cancel"

async def start_update_manager(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start the update manager conversation."""
    if not await require_master_admin(update):
        return ConversationHandler.END

    db = get_db()
    current_config = await db.app_config.find_one({"_id": "version"})
    
    if not current_config:
        current_config = {
            "current_version": "1.0.0",
            "min_version": "1.0.0",
            "update_title": "Update Available",
            "update_notes": "Bug fixes.",
            "update_required": False
        }

    # Initialize session state from current config
    context.user_data['upd_session'] = {
        "new_version": current_config.get("current_version", "1.0.0"),
        "min_version": current_config.get("min_version", "1.0.0"), # Default to current min
        "title": current_config.get("update_title", "Update Available"),
        "notes": current_config.get("update_notes", "Bug fixes."),
        "force_update": current_config.get("update_required", False)
    }

    await _show_menu(update, context)
    return SELECT_ACTION

async def _show_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Display the main menu."""
    data = context.user_data.get('upd_session', {})
    
    version = data.get('new_version')
    title = data.get('title')
    notes = data.get('notes')
    force = data.get('force_update')
    
    msg = (
        f"📱 *App Update Manager*\n"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"🏷 *Version:* `{version}`\n"
        f"📝 *Title:* {title}\n"
        f"📋 *Notes:*\n_{notes}_\n\n"
        f"🚨 *Force Update:* {'YES' if force else 'NO'}\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"_Make changes below, then Publish._"
    )
    
    keyboard = [
        [
            InlineKeyboardButton("🏷 Version", callback_data=CB_EDIT_VERSION),
            InlineKeyboardButton("📝 Title", callback_data=CB_EDIT_TITLE),
        ],
        [
            InlineKeyboardButton("📋 Edit Notes", callback_data=CB_EDIT_NOTES)
        ],
        [
            InlineKeyboardButton(f"🚨 Toggle Force: {'ON' if force else 'OFF'}", callback_data=CB_TOGGLE_FORCE)
        ],
        [
            InlineKeyboardButton("✅ PUBLISH UPDATE", callback_data=CB_PUBLISH)
        ],
        [
            InlineKeyboardButton("❌ Cancel", callback_data=CB_CANCEL)
        ]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    if update.callback_query:
        await update.callback_query.edit_message_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=reply_markup)
    else:
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=reply_markup)

async def handle_action_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle menu button clicks."""
    query = update.callback_query
    await query.answer()
    data = query.data
    
    if data == CB_CANCEL:
        if 'upd_session' in context.user_data:
            del context.user_data['upd_session']
        await query.edit_message_text("❌ Update Manager Cancelled.")
        return ConversationHandler.END
        
    if data == CB_PUBLISH:
        return await _publish_update(update, context)
        
    if data == CB_TOGGLE_FORCE:
        context.user_data['upd_session']['force_update'] = not context.user_data['upd_session']['force_update']
        await _show_menu(update, context)
        return SELECT_ACTION
        
    if data == CB_EDIT_VERSION:
        await query.edit_message_text(
            "🏷 *Enter New Version*\n\n"
            "Reply with the version number (e.g. `1.0.2`).\n"
            "_Current: " + context.user_data['upd_session']['new_version'] + "_",
            parse_mode=ParseMode.MARKDOWN
        )
        return ENTER_VERSION
        
    if data == CB_EDIT_TITLE:
        await query.edit_message_text(
            "📝 *Enter Update Title*\n\n"
            "Reply with the title (e.g. `Major Spring Update`).",
            parse_mode=ParseMode.MARKDOWN
        )
        return ENTER_TITLE
        
    if data == CB_EDIT_NOTES:
        await query.edit_message_text(
            "📋 *Enter Update Notes*\n\n"
            "Reply with the release notes. You can use markdown and newlines.",
            parse_mode=ParseMode.MARKDOWN
        )
        return ENTER_NOTES
        
    return SELECT_ACTION

async def receive_version(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive version input."""
    text = update.message.text.strip()
    if len(text) > 20: 
        await update.message.reply_text("Version too long. Try again.")
        return ENTER_VERSION
        
    context.user_data['upd_session']['new_version'] = text
    # Auto-update min_version to match if forcing, but we'll leave logic simple for now
    # Ideally if force_update is true, min_version should be this version.
    
    await _show_menu(update, context)
    return SELECT_ACTION

async def receive_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive title input."""
    text = update.message.text.strip()
    context.user_data['upd_session']['title'] = text
    await _show_menu(update, context)
    return SELECT_ACTION

async def receive_notes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive notes input."""
    text = update.message.text.strip()
    context.user_data['upd_session']['notes'] = text
    await _show_menu(update, context)
    return SELECT_ACTION

async def _publish_update(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Commit changes to DB."""
    session = context.user_data.get('upd_session')
    if not session:
        return ConversationHandler.END
        
    db = get_db()
    
    update_data = {
        "current_version": session['new_version'],
        "update_title": session['title'],
        "update_notes": session['notes'],
        "update_required": session['force_update'],
        "updated_at": utc_now()
    }
    
    # If forced, update min_version too
    if session['force_update']:
        update_data["min_version"] = session['new_version']
    else:
        # Keep existing min_version if not forced, or maybe don't touch it
        # For safety/simplicity, we won't change min_version unless forced
        pass

    await db.app_config.update_one(
        {"_id": "version"},
        {"$set": update_data},
        upsert=True
    )
    
    del context.user_data['upd_session']
    
    await update.callback_query.edit_message_text(
        f"✅ *Update Published Successfully*\n\n"
        f"Version `{session['new_version']}` is now live.",
        parse_mode=ParseMode.MARKDOWN
    )
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel conversation."""
    if 'upd_session' in context.user_data:
        del context.user_data['upd_session']
    await update.message.reply_text("Update manager cancelled.")
    return ConversationHandler.END

# Handler definition
update_conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("update_manager", start_update_manager)],
    states={
        SELECT_ACTION: [CallbackQueryHandler(handle_action_selection)],
        ENTER_VERSION: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_version)],
        ENTER_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_title)],
        ENTER_NOTES: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_notes)],
    },
    fallbacks=[CommandHandler("cancel", cancel), CallbackQueryHandler(handle_action_selection, pattern=f"^{CB_CANCEL}$")],
    per_message=False,  # Track conversation by user (standard behavior)
)
