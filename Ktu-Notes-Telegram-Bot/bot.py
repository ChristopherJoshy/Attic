from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand
import logging
from config import BOT_TOKEN
from db import db
from handlers import register_handlers
from admin import register_admin_handlers

logger = logging.getLogger(__name__)

async def create_bot():
    try:
        bot = Bot(token=BOT_TOKEN)
        storage = MemoryStorage()
        dp = Dispatcher(storage=storage)
        
        await db.connect()
        
        register_handlers(dp)
        register_admin_handlers(dp)
        
        commands = [
            BotCommand(command="start", description="Start the bot"),
            BotCommand(command="admin", description="Admin panel"),
            BotCommand(command="help", description="Show help"),
        ]
        await bot.set_my_commands(commands)
        
        logger.info("Bot created and configured successfully")
        return dp, bot
        
    except Exception as e:
        logger.error(f"Failed to create bot: {e}")
        raise

async def start_polling():
    dp = await create_bot()
    await dp.start_polling()
