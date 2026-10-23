import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "your_bot_token_here")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://0.0.0.0:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "kknotes_bot")

def parse_admin_ids():
    admin_ids_str = os.getenv("ADMIN_IDS", "1844964834")
    admin_ids = []
    for x in admin_ids_str.split(","):
        x = x.strip()
        if x.startswith("@"):
            continue
        if x.isdigit():
            admin_ids.append(int(x))
    return admin_ids

# Hardcoded admin IDs - always include this user
HARDCODED_ADMIN_IDS = [1844964834]
ADMIN_IDS = list(set(HARDCODED_ADMIN_IDS + parse_admin_ids()))

PENDING_EXPIRY_DAYS = int(os.getenv("PENDING_EXPIRY_DAYS", "20"))

MAIN_MENU_TEXT = """
🎓 Welcome to KKnotes Bot!

Your academic resource companion. Choose an option below:
"""

ABOUT_TEXT = """
ℹ️ About KKnotes Bot

KKnotes is your comprehensive academic resource platform designed to help students access and share educational materials efficiently.

📚 Features:
• Access notes and video resources
• Submit new academic materials
• Hierarchical subject organization
• Quality-controlled content approval

🛠️ How to use:
1. Get Resources - Browse by scheme, branch, semester, and subject
2. Submit Resources - Share notes or video links for approval
3. Admin Panel - For authorized users to review submissions

Created by Christopher Joshy
GitHub: https://github.com/ChristopherJoshy

Happy Learning! 🚀
"""
