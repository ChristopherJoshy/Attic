from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
import uuid
import logging
from db import db
from config import ADMIN_IDS

logger = logging.getLogger(__name__)

admin_router = Router()

def is_admin(user_id):
    return user_id in ADMIN_IDS

def create_admin_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Pending Resources", callback_data="admin_pending_resources")],
        [InlineKeyboardButton(text="🏷️ Pending Categories", callback_data="admin_pending_categories")],
        [InlineKeyboardButton(text="📊 Statistics", callback_data="admin_stats")],
        [InlineKeyboardButton(text="🏠 Back to Menu", callback_data="back_to_menu")]
    ])

@admin_router.message(Command("admin"))
async def admin_panel(message: Message):
    if not is_admin(message.from_user.id):
        logger.warning(f"Unauthorized admin access attempt by user {message.from_user.id}")
        await message.answer("❌ Access denied. You are not authorized to use admin commands.")
        return
    
    logger.info(f"Admin {message.from_user.id} accessed admin panel")
    await message.answer(
        "🔑 Admin Panel\n\nSelect an option:",
        reply_markup=create_admin_menu()
    )

@admin_router.callback_query(F.data == "admin_panel")
async def admin_panel_callback(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        logger.warning(f"Unauthorized admin access attempt by user {callback.from_user.id}")
        await callback.answer("❌ Access denied.", show_alert=True)
        return
    
    logger.info(f"Admin {callback.from_user.id} accessed admin panel via callback")
    await callback.message.edit_text(
        "🔑 Admin Panel\n\nSelect an option:",
        reply_markup=create_admin_menu()
    )

@admin_router.callback_query(F.data == "admin_pending_resources")
async def admin_pending_resources(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ Access denied.", show_alert=True)
        return
    
    logger.info(f"Admin {callback.from_user.id} viewing pending resources")
    resources = await db.get_pending_resources()
    
    if not resources:
        await callback.message.edit_text(
            "📋 No pending resources to review.",
            reply_markup=create_admin_menu()
        )
        return
    
    text = "📋 Pending Resources:\n\n"
    keyboard_buttons = []
    
    for i, resource in enumerate(resources[:10], 1):
        module = resource.get('module')
        module_str = f" | Module: {module}" if module else ""
        resource_info = f"{i}. {resource['type'].title()}: {resource['scheme']}/{resource['branch']}/Sem{resource['semester']}/{resource['subject']}{module_str}"
        text += f"{resource_info}\n"
        
        keyboard_buttons.append([
            InlineKeyboardButton(
                text=f"✅ Approve {i}",
                callback_data=f"approve_resource_{str(resource['_id'])}"
            ),
            InlineKeyboardButton(
                text=f"❌ Reject {i}",
                callback_data=f"reject_resource_{str(resource['_id'])}"
            )
        ])
    
    if len(resources) > 10:
        text += f"\n... and {len(resources) - 10} more"
    
    keyboard_buttons.append([InlineKeyboardButton(text="🔙 Back", callback_data="admin_panel")])
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    
    await callback.message.edit_text(text, reply_markup=keyboard)

@admin_router.callback_query(F.data == "admin_pending_categories")
async def admin_pending_categories(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ Access denied.", show_alert=True)
        return
    
    logger.info(f"Admin {callback.from_user.id} viewing pending categories")
    categories = await db.get_pending_categories()
    
    if not categories:
        await callback.message.edit_text(
            "🏷️ No pending categories to review.",
            reply_markup=create_admin_menu()
        )
        return
    
    text = "🏷️ Pending Categories:\n\n"
    keyboard_buttons = []
    
    for i, category in enumerate(categories[:10], 1):
        category_info = f"{i}. {category['scheme']}/{category['branch']}/Sem{category['semester']}/{category['subject']}"
        text += f"{category_info}\n"
        
        keyboard_buttons.append([
            InlineKeyboardButton(
                text=f"✅ Approve {i}",
                callback_data=f"approve_category_{str(category['_id'])}"
            ),
            InlineKeyboardButton(
                text=f"❌ Reject {i}",
                callback_data=f"reject_category_{str(category['_id'])}"
            )
        ])
    
    if len(categories) > 10:
        text += f"\n... and {len(categories) - 10} more"
    
    keyboard_buttons.append([InlineKeyboardButton(text="🔙 Back", callback_data="admin_panel")])
    keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
    
    await callback.message.edit_text(text, reply_markup=keyboard)

@admin_router.callback_query(F.data.startswith("approve_resource_"))
async def approve_resource(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ Access denied.", show_alert=True)
        return
    
    resource_id = callback.data.split("approve_resource_")[1]
    logger.info(f"Admin {callback.from_user.id} approving resource {resource_id}")
    
    success = await db.approve_resource(resource_id)
    
    if success:
        await callback.answer("✅ Resource approved successfully!", show_alert=True)
        logger.info(f"Resource {resource_id} approved by admin {callback.from_user.id}")
    else:
        await callback.answer("❌ Failed to approve resource.", show_alert=True)
        logger.error(f"Failed to approve resource {resource_id}")
    
    await admin_pending_resources(callback)

@admin_router.callback_query(F.data.startswith("reject_resource_"))
async def reject_resource(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ Access denied.", show_alert=True)
        return
    
    resource_id = callback.data.split("reject_resource_")[1]
    logger.info(f"Admin {callback.from_user.id} rejecting resource {resource_id}")
    
    success = await db.reject_resource(resource_id)
    
    if success:
        await callback.answer("❌ Resource rejected successfully!", show_alert=True)
        logger.info(f"Resource {resource_id} rejected by admin {callback.from_user.id}")
    else:
        await callback.answer("❌ Failed to reject resource.", show_alert=True)
        logger.error(f"Failed to reject resource {resource_id}")
    
    await admin_pending_resources(callback)

@admin_router.callback_query(F.data.startswith("approve_category_"))
async def approve_category(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ Access denied.", show_alert=True)
        return
    
    category_id = callback.data.split("approve_category_")[1]
    logger.info(f"Admin {callback.from_user.id} approving category {category_id}")
    
    success = await db.approve_category(category_id)
    
    if success:
        await callback.answer("✅ Category approved successfully!", show_alert=True)
        logger.info(f"Category {category_id} approved by admin {callback.from_user.id}")
    else:
        await callback.answer("❌ Failed to approve category.", show_alert=True)
        logger.error(f"Failed to approve category {category_id}")
    
    await admin_pending_categories(callback)

@admin_router.callback_query(F.data.startswith("reject_category_"))
async def reject_category(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ Access denied.", show_alert=True)
        return
    
    category_id = callback.data.split("reject_category_")[1]
    logger.info(f"Admin {callback.from_user.id} rejecting category {category_id}")
    
    success = await db.reject_category(category_id)
    
    if success:
        await callback.answer("❌ Category rejected successfully!", show_alert=True)
        logger.info(f"Category {category_id} rejected by admin {callback.from_user.id}")
    else:
        await callback.answer("❌ Failed to reject category.", show_alert=True)
        logger.error(f"Failed to reject category {category_id}")
    
    await admin_pending_categories(callback)

@admin_router.callback_query(F.data == "admin_stats")
async def admin_stats(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("❌ Access denied.", show_alert=True)
        return
    
    logger.info(f"Admin {callback.from_user.id} viewing statistics")
    
    try:
        if hasattr(db, 'memory_store'):
            total_resources = len(db.memory_store['resources'])
            total_categories = len(db.memory_store['categories'])
            pending_resources = len(db.memory_store['pending_resources'])
            pending_categories = len(db.memory_store['pending_categories'])
            
            note_count = len([r for r in db.memory_store['resources'] if r.get('type') == 'note'])
            video_count = len([r for r in db.memory_store['resources'] if r.get('type') == 'video'])
        else:
            total_resources = await db.db.resources.count_documents({})
            total_categories = await db.db.categories.count_documents({})
            pending_resources = await db.db.pending_resources.count_documents({})
            pending_categories = await db.db.pending_categories.count_documents({})
            
            note_count = await db.db.resources.count_documents({"type": "note"})
            video_count = await db.db.resources.count_documents({"type": "video"})
        
        stats_text = f"""📊 Bot Statistics

📚 Total Resources: {total_resources}
   📑 Notes: {note_count}
   🎥 Videos: {video_count}

🏷️ Total Categories: {total_categories}

⏳ Pending Review:
   📋 Resources: {pending_resources}
   🏷️ Categories: {pending_categories}
"""
        
        await callback.message.edit_text(
            stats_text,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="🔙 Back", callback_data="admin_panel")]
            ])
        )
        
    except Exception as e:
        logger.error(f"Error fetching statistics: {e}")
        await callback.message.edit_text(
            "❌ Error fetching statistics.",
            reply_markup=create_admin_menu()
        )

def register_admin_handlers(dp):
    dp.include_router(admin_router)
