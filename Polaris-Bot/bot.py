import discord
from discord import app_commands
from discord.ext import commands, tasks
import aiosqlite
import os
import json
import random
import asyncio
from google import genai
from dotenv import load_dotenv
from datetime import datetime, timedelta
import logging
from typing import Optional

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Polaris")

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ENV_GUILD_ID = os.getenv("GUILD_ID")

if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    logger.warning("GEMINI_API_KEY not found. Chat features will be disabled.")
    client = None

SNOWBALL_TYPES = {
    "normal": {
        "name": "Snowball",
        "damage": (5, 12),
        "effect": None,
        "level": 1,
        "emoji": "⚪",
    },
    "packed": {
        "name": "Packed Snow",
        "damage": (10, 18),
        "effect": None,
        "level": 3,
        "emoji": "⚫",
    },
    "ice_ball": {
        "name": "Ice Ball",
        "damage": (14, 24),
        "effect": None,
        "level": 6,
        "emoji": "🔵",
    },
    "ice_bomb": {
        "name": "Ice Bomb",
        "damage": (18, 30),
        "effect": "freeze",
        "level": 10,
        "emoji": "💣",
    },
    "avalanche": {
        "name": "Avalanche",
        "damage": (25, 40),
        "effect": "aoe",
        "level": 15,
        "emoji": "🏔️",
    },
    "blizzard": {
        "name": "Blizzard Ball",
        "damage": (32, 50),
        "effect": "stun",
        "level": 20,
        "emoji": "🌨️",
    },
    "permafrost": {
        "name": "Permafrost",
        "damage": (40, 60),
        "effect": "freeze",
        "level": 30,
        "emoji": "💎",
    },
    "absolute_zero": {
        "name": "Absolute Zero",
        "damage": (50, 75),
        "effect": "stun",
        "level": 50,
        "emoji": "⭐",
    },
}

SHOP_ITEMS = {
    "cocoa": {
        "name": "Hot Cocoa",
        "cost": 10,
        "emoji": "☕",
        "desc": "+25 HP",
        "type": "healing",
    },
    "healing_surge": {
        "name": "Healing Surge",
        "cost": 25,
        "emoji": "💚",
        "desc": "+50 HP",
        "type": "healing",
    },
    "full_restore": {
        "name": "Full Restore",
        "cost": 50,
        "emoji": "❤️",
        "desc": "Full HP",
        "type": "healing",
    },
    "energy_drink": {
        "name": "Energy Drink",
        "cost": 30,
        "emoji": "⚡",
        "desc": "+50% dmg",
        "type": "buff",
    },
    "double_xp": {
        "name": "XP Boost",
        "cost": 40,
        "emoji": "✨",
        "desc": "2x XP (5 hits)",
        "type": "buff",
    },
    "lucky_charm": {
        "name": "Lucky Charm",
        "cost": 35,
        "emoji": "🍀",
        "desc": "+10% crit",
        "type": "buff",
    },
    "shield": {
        "name": "Frost Shield",
        "cost": 40,
        "emoji": "🛡️",
        "desc": "Block 1 hit",
        "type": "defense",
    },
    "armor": {
        "name": "Ice Armor",
        "cost": 75,
        "emoji": "🧴",
        "desc": "-25% dmg taken",
        "type": "defense",
    },
    "fortress": {
        "name": "Ice Fortress",
        "cost": 100,
        "emoji": "🏰",
        "desc": "+15 max HP",
        "type": "permanent",
    },
    "cannon": {
        "name": "Cannon",
        "cost": 80,
        "emoji": "🔫",
        "desc": "+8 dmg (10 hits)",
        "type": "weapon",
    },
}

LEVEL_REWARDS = {
    3: {"icicles": 50, "item": None},
    5: {"icicles": 100, "item": "shield"},
    10: {"icicles": 200, "item": "energy_drink"},
    15: {"icicles": 300, "item": "cannon"},
    20: {"icicles": 500, "item": "armor"},
    25: {"icicles": 750, "item": None},
    30: {"icicles": 1000, "item": "fortress"},
    50: {"icicles": 2500, "item": None},
}

SLOT_PRIZES = [
    {"weight": 40, "type": "icicles", "amount": (5, 20), "name": "Small Win"},
    {"weight": 25, "type": "icicles", "amount": (20, 50), "name": "Medium Win"},
    {"weight": 15, "type": "icicles", "amount": (50, 100), "name": "Big Win"},
    {"weight": 8, "type": "item", "item": "energy_drink", "name": "Energy Drink"},
    {"weight": 5, "type": "item", "item": "shield", "name": "Frost Shield"},
    {"weight": 4, "type": "icicles", "amount": (100, 200), "name": "Jackpot"},
    {"weight": 2, "type": "item", "item": "cannon", "name": "Cannon"},
    {"weight": 1, "type": "icicles", "amount": (250, 500), "name": "MEGA JACKPOT"},
]

# Titles now include effects (stackable)
TITLES = [
    (0, "❄️ Snowflake", {}),
    (5, "⛄ Snow Sprite", {"hp_bonus": 5}),
    (10, "🌨️ Frost Walker", {"hp_bonus": 10, "dmg_bonus": 1}),
    (15, "🧊 Ice Warrior", {"hp_bonus": 15, "dmg_bonus": 2}),
    (20, "❄️ Blizzard Knight", {"hp_bonus": 20, "dmg_bonus": 3, "crit_bonus": 0.02}),
    (30, "🏔️ Avalanche Master", {"hp_bonus": 30, "dmg_bonus": 5, "crit_bonus": 0.03}),
    (50, "👑 Frost Titan", {"hp_bonus": 50, "dmg_bonus": 8, "crit_bonus": 0.05}),
    (
        100,
        "🌟 Legendary Ice Lord",
        {"hp_bonus": 75, "dmg_bonus": 12, "crit_bonus": 0.08},
    ),
]

# Special titles (override level titles)
SPECIAL_TITLES = {
    "gambler": {
        "name": "🎰 High Roller",
        "requirement": "100+ gambles",
        "effects": {"luck_bonus": 0.05},
    },
}

# Coin flip matchmaking queue: {bet_amount: {"user_id": int, "channel": channel, "guild_id": int}}
COIN_FLIP_QUEUE = {}


DAILY_REWARDS = {
    1: {"icicles": 15, "bonus": None},
    2: {"icicles": 30, "bonus": None},
    3: {"icicles": 50, "bonus": "random_item"},
    7: {"icicles": 150, "bonus": "mystery_box"},
    14: {"icicles": 350, "bonus": "rare_item"},
    30: {"icicles": 750, "bonus": "legendary"},
}

ACHIEVEMENTS = {
    "first_blood": {
        "name": "First Blood",
        "desc": "Get your first KO",
        "reward": 50,
        "emoji": "🩸",
    },
    "serial_snowballer": {
        "name": "Serial Snowballer",
        "desc": "100 total KOs",
        "reward": 500,
        "emoji": "💀",
    },
    "untouchable": {
        "name": "Untouchable",
        "desc": "Win 5 duels in a row",
        "reward": 300,
        "emoji": "🛡️",
    },
    "big_spender": {
        "name": "Big Spender",
        "desc": "Spend 1000 Icicles",
        "reward": 200,
        "emoji": "💰",
    },
    "daily_warrior": {
        "name": "Daily Warrior",
        "desc": "7 day login streak",
        "reward": 500,
        "emoji": "📅",
    },
    "survivor": {
        "name": "Survivor",
        "desc": "Survive with 1 HP",
        "reward": 100,
        "emoji": "💪",
    },
    "high_roller": {
        "name": "High Roller",
        "desc": "Win 500+ from slots",
        "reward": 250,
        "emoji": "🎰",
    },
    "lucky_flip": {
        "name": "Lucky Flip",
        "desc": "Win 10 coin flips",
        "reward": 200,
        "emoji": "🪙",
    },
}


class GameDatabase:
    """Async context manager for database connections with WAL mode for speed."""

    def __init__(self, db_name="polaris.db"):
        self.db_name = db_name

    async def __aenter__(self):
        self.db = await aiosqlite.connect(self.db_name)
        self.db.row_factory = aiosqlite.Row
        # WAL mode for better concurrent read/write performance
        await self.db.execute("PRAGMA journal_mode=WAL")
        await self.db.execute("PRAGMA synchronous=NORMAL")
        return self.db

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.db.close()

    @staticmethod
    async def initialize():
        async with aiosqlite.connect("polaris.db") as db:
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS players (
                    user_id INTEGER PRIMARY KEY,
                    hp INTEGER DEFAULT 100,
                    max_hp INTEGER DEFAULT 100,
                    icicles INTEGER DEFAULT 0,
                    xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 1,
                    kills INTEGER DEFAULT 0,
                    deaths INTEGER DEFAULT 0,
                    items TEXT DEFAULT '{}',
                    status TEXT DEFAULT 'Normal',
                    equipped_snowball TEXT DEFAULT 'normal',
                    kill_streak INTEGER DEFAULT 0,
                    hit_streak INTEGER DEFAULT 0,
                    shield_active INTEGER DEFAULT 0,
                    energized INTEGER DEFAULT 0,
                    cannon_shots INTEGER DEFAULT 0,
                    last_throw REAL DEFAULT 0,
                    last_daily TEXT DEFAULT '',
                    daily_streak INTEGER DEFAULT 0,
                    total_damage INTEGER DEFAULT 0,
                    total_spent INTEGER DEFAULT 0,
                    achievements TEXT DEFAULT '[]',
                    duel_wins INTEGER DEFAULT 0,
                    duel_losses INTEGER DEFAULT 0,
                    duel_streak INTEGER DEFAULT 0
                )
            """
            )

            new_columns = [
                ("xp", "INTEGER DEFAULT 0"),
                ("level", "INTEGER DEFAULT 1"),
                ("kills", "INTEGER DEFAULT 0"),
                ("deaths", "INTEGER DEFAULT 0"),
                ("equipped_snowball", "TEXT DEFAULT 'normal'"),
                ("kill_streak", "INTEGER DEFAULT 0"),
                ("hit_streak", "INTEGER DEFAULT 0"),
                ("shield_active", "INTEGER DEFAULT 0"),
                ("energized", "INTEGER DEFAULT 0"),
                ("cannon_shots", "INTEGER DEFAULT 0"),
                ("last_throw", "REAL DEFAULT 0"),
                ("last_daily", "TEXT DEFAULT ''"),
                ("daily_streak", "INTEGER DEFAULT 0"),
                ("total_damage", "INTEGER DEFAULT 0"),
                ("total_spent", "INTEGER DEFAULT 0"),
                ("achievements", "TEXT DEFAULT '[]'"),
                ("duel_wins", "INTEGER DEFAULT 0"),
                ("duel_losses", "INTEGER DEFAULT 0"),
                ("duel_streak", "INTEGER DEFAULT 0"),
                ("armor_active", "INTEGER DEFAULT 0"),
                ("lucky_charm", "INTEGER DEFAULT 0"),
                ("xp_boost", "INTEGER DEFAULT 0"),
                ("coin_flip_wins", "INTEGER DEFAULT 0"),
                ("slot_winnings", "INTEGER DEFAULT 0"),
                ("total_gambles", "INTEGER DEFAULT 0"),
                ("assist_log", "TEXT DEFAULT '[]'"),
            ]

            for col_name, col_type in new_columns:
                try:
                    await db.execute(
                        f"ALTER TABLE players ADD COLUMN {col_name} {col_type}"
                    )
                except Exception:
                    pass

            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS moderation (
                    user_id INTEGER PRIMARY KEY,
                    coal_count INTEGER DEFAULT 0
                )
            """
            )

            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS guild_config (
                    guild_id INTEGER PRIMARY KEY,
                    naughty_role_id INTEGER DEFAULT 0,
                    dashboard_channel_id INTEGER DEFAULT 0,
                    dashboard_message_id INTEGER DEFAULT 0
                )
            """
            )

            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS duels (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    challenger_id INTEGER,
                    opponent_id INTEGER,
                    status TEXT DEFAULT 'pending',
                    challenger_wins INTEGER DEFAULT 0,
                    opponent_wins INTEGER DEFAULT 0,
                    created_at REAL
                )
            """
            )

            await db.commit()


def get_xp_for_level(level: int) -> int:
    if level <= 5:
        return level * 100
    elif level <= 10:
        return level * 250
    elif level <= 20:
        return level * 500
    else:
        return level * 1000


def get_title(level: int, total_gambles: int = 0) -> tuple:
    """Returns (title_name, effects_dict)"""
    title_name = TITLES[0][1]
    effects = {}

    for req_level, req_title, req_effects in TITLES:
        if level >= req_level:
            title_name = req_title
            effects = req_effects.copy()

    # Check for gambler title (overrides level title display, stacks effects)
    if total_gambles >= 100:
        gambler = SPECIAL_TITLES["gambler"]
        title_name = gambler["name"]
        for k, v in gambler["effects"].items():
            effects[k] = effects.get(k, 0) + v

    return title_name, effects


def get_title_name(level: int) -> str:
    """Simple version for display only"""
    title = TITLES[0][1]
    for req_level, req_title, _ in TITLES:
        if level >= req_level:
            title = req_title
    return title


def get_hp_bar(current: int, max_hp: int) -> str:
    current = max(0, current)
    max_hp = max(1, max_hp)
    percentage = current / max_hp
    blocks = 10
    filled = int(percentage * blocks)

    if percentage < 0.3:
        bar = "🟥" * filled + "⬛" * (blocks - filled)
    elif percentage < 0.6:
        bar = "🟨" * filled + "⬛" * (blocks - filled)
    else:
        bar = "🟩" * filled + "⬛" * (blocks - filled)

    return f"[{bar}] {current}/{max_hp}"


def get_xp_bar(current_xp: int, level: int) -> str:
    needed = get_xp_for_level(level + 1)
    percentage = min(1.0, current_xp / needed) if needed > 0 else 1.0
    blocks = 10
    filled = int(percentage * blocks)
    bar = "🟦" * filled + "⬛" * (blocks - filled)
    return f"[{bar}] {current_xp}/{needed}"


class SnowballEngine(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.throw_cooldowns = {}

    async def add_xp(self, db, user_id: int, amount: int) -> tuple[int, bool]:
        cursor = await db.execute(
            "SELECT xp, level, xp_boost FROM players WHERE user_id = ?", (user_id,)
        )
        data = await cursor.fetchone()
        if not data:
            return 1, False

        # XP boost doubles XP gain
        if data["xp_boost"] and data["xp_boost"] > 0:
            amount = amount * 2
            await db.execute(
                "UPDATE players SET xp_boost = xp_boost - 1 WHERE user_id = ?",
                (user_id,),
            )

        current_xp = data["xp"] + amount
        current_level = data["level"]
        needed = get_xp_for_level(current_level + 1)
        leveled_up = False

        while current_xp >= needed:
            current_xp -= needed
            current_level += 1
            needed = get_xp_for_level(current_level + 1)
            leveled_up = True

        await db.execute(
            "UPDATE players SET xp = ?, level = ? WHERE user_id = ?",
            (current_xp, current_level, user_id),
        )
        return current_level, leveled_up

    async def check_achievement(self, db, user_id: int, achievement_id: str) -> bool:
        cursor = await db.execute(
            "SELECT achievements FROM players WHERE user_id = ?", (user_id,)
        )
        data = await cursor.fetchone()
        if not data:
            return False

        achievements = json.loads(data["achievements"])
        if achievement_id in achievements:
            return False

        achievements.append(achievement_id)
        await db.execute(
            "UPDATE players SET achievements = ?, icicles = icicles + ? WHERE user_id = ?",
            (json.dumps(achievements), ACHIEVEMENTS[achievement_id]["reward"], user_id),
        )
        return True

    @app_commands.command(name="throw", description="🎯 Throw a snowball at someone!")
    @app_commands.describe(target="The player to hit with a snowball")
    async def throw(self, interaction: discord.Interaction, target: discord.User):
        if target.id == interaction.user.id:
            await interaction.response.send_message(
                "❄️ You can't throw a snowball at yourself!"
            )
            return

        if target.bot:
            await interaction.response.send_message(
                "You can't throw snowballs at bots."
            )
            return

        now = datetime.now().timestamp()
        last_throw = self.throw_cooldowns.get(interaction.user.id, 0)
        if now - last_throw < 5:
            remaining = int(5 - (now - last_throw))
            await interaction.response.send_message(
                f"❄️ Cooldown! Wait **{remaining}s** before throwing again."
            )
            return
        self.throw_cooldowns[interaction.user.id] = now

        async with GameDatabase() as db:
            for uid in [interaction.user.id, target.id]:
                await db.execute(
                    "INSERT OR IGNORE INTO players (user_id) VALUES (?)", (uid,)
                )
            await db.commit()

            cursor = await db.execute(
                "SELECT level, equipped_snowball, hit_streak, energized, cannon_shots, hp, max_hp, lucky_charm, xp_boost FROM players WHERE user_id = ?",
                (interaction.user.id,),
            )
            attacker_data = await cursor.fetchone()

            cursor = await db.execute(
                "SELECT hp, max_hp, shield_active, armor_active, assist_log FROM players WHERE user_id = ?",
                (target.id,),
            )
            target_data = await cursor.fetchone()

            if target_data["shield_active"]:
                await db.execute(
                    "UPDATE players SET shield_active = 0 WHERE user_id = ?",
                    (target.id,),
                )
                await db.commit()

                embed = discord.Embed(
                    description=f"🛡️ **BLOCKED!** {target.mention}'s **Frost Shield** absorbed the hit from {interaction.user.mention}!",
                    color=discord.Color.blue(),
                )
                await interaction.response.send_message(embed=embed)
                return

            snowball_type = attacker_data["equipped_snowball"] or "normal"
            snowball = SNOWBALL_TYPES.get(snowball_type, SNOWBALL_TYPES["normal"])

            roll = random.random()
            base_damage = random.randint(*snowball["damage"])

            # Lucky charm increases crit chance
            crit_threshold = 0.95
            if attacker_data["lucky_charm"] and attacker_data["lucky_charm"] > 0:
                crit_threshold = 0.85  # +10% crit chance

            damage = base_damage
            hit_streak = attacker_data["hit_streak"]
            message = ""
            effect_msg = ""
            is_fumble = False

            if roll < 0.05:
                damage = 10
                victim = interaction.user
                victim_hp = attacker_data["hp"]
                victim_max_hp = attacker_data["max_hp"]
                message = f"**FUMBLE!** {interaction.user.mention} slipped and hit themselves!"
                hit_streak = 0
                is_fumble = True
            elif roll < 0.20:
                embed = discord.Embed(
                    title="MISS",
                    description=f"{interaction.user.mention} threw a {snowball['emoji']} at {target.mention}... but missed!",
                    color=discord.Color.light_gray(),
                )
                await db.execute(
                    "UPDATE players SET hit_streak = 0 WHERE user_id = ?",
                    (interaction.user.id,),
                )
                await db.commit()
                await interaction.response.send_message(embed=embed)
                return
            elif roll > crit_threshold:
                damage = int(base_damage * 2)
                victim = target
                victim_hp = target_data["hp"]
                victim_max_hp = target_data["max_hp"]
                message = f"**CRITICAL!** {interaction.user.mention} landed a perfect {snowball['emoji']} on {target.mention}!"
            else:
                victim = target
                victim_hp = target_data["hp"]
                victim_max_hp = target_data["max_hp"]
                message = f"{interaction.user.mention} hit {target.mention} with a {snowball['emoji']} **{snowball['name']}**!"

            if victim == target and not is_fumble:
                hit_streak += 1
                if hit_streak > 1:
                    streak_bonus = min(hit_streak * 2, 20)
                    damage += streak_bonus
                    effect_msg += f"\n🔥 **Streak x{hit_streak}!** (+{streak_bonus})"

            if attacker_data["energized"] and victim == target:
                damage = int(damage * 1.5)
                effect_msg += "\n⚡ **Energized!** (+50%)"
                await db.execute(
                    "UPDATE players SET energized = 0 WHERE user_id = ?",
                    (interaction.user.id,),
                )

            if (
                attacker_data["cannon_shots"]
                and attacker_data["cannon_shots"] > 0
                and victim == target
            ):
                damage += 8
                effect_msg += "\n🔫 **Cannon!** (+8)"
                await db.execute(
                    "UPDATE players SET cannon_shots = cannon_shots - 1 WHERE user_id = ?",
                    (interaction.user.id,),
                )

            # Armor reduces damage
            if (
                victim == target
                and target_data["armor_active"]
                and target_data["armor_active"] > 0
            ):
                damage = int(damage * 0.75)
                effect_msg += f"\n🧴 Armor absorbed 25%"
                await db.execute(
                    "UPDATE players SET armor_active = armor_active - 1 WHERE user_id = ?",
                    (target.id,),
                )

            # Consume lucky charm
            if attacker_data["lucky_charm"] and attacker_data["lucky_charm"] > 0:
                await db.execute(
                    "UPDATE players SET lucky_charm = lucky_charm - 1 WHERE user_id = ?",
                    (interaction.user.id,),
                )

            new_hp = max(0, victim_hp - damage)
            await db.execute(
                "UPDATE players SET hp = ? WHERE user_id = ?", (new_hp, victim.id)
            )

            icicle_reward = random.randint(2, 5)
            xp_reward = damage

            await db.execute(
                """UPDATE players SET 
                   hit_streak = ?, 
                   icicles = icicles + ?, 
                   total_damage = total_damage + ?
                   WHERE user_id = ?""",
                (hit_streak, icicle_reward, damage, interaction.user.id),
            )

            new_level, leveled_up = await self.add_xp(
                db, interaction.user.id, xp_reward
            )

            await db.commit()

            # Log assist
            if victim == target and damage > 0:
                assist_log = json.loads(target_data["assist_log"] or "[]")
                if interaction.user.id not in assist_log:
                    assist_log.append(interaction.user.id)
                    await db.execute(
                        "UPDATE players SET assist_log = ? WHERE user_id = ?",
                        (json.dumps(assist_log), target.id),
                    )

            if new_hp == 0:
                color = discord.Color.from_rgb(239, 68, 68)  # Red for kill
                title = "💀 KNOCKOUT!"
            elif is_fumble:
                color = discord.Color.from_rgb(156, 163, 175)  # Gray for fumble
                title = "😅 FUMBLE!"
            elif roll > 0.95:
                color = discord.Color.from_rgb(245, 158, 11)  # Gold for crit
                title = "⚡ CRITICAL HIT!"
            else:
                color = discord.Color.from_rgb(88, 101, 242)  # Blue for hit
                title = "❄️ HIT!"

            embed = discord.Embed(title=title, color=color)

            # Message
            embed.description = f"{message}{effect_msg}"

            # Combined stats in one clean field
            attacker_hp = f"`{attacker_data['hp']}/{attacker_data['max_hp']}`"
            defender_hp = f"`{new_hp}/{victim_max_hp}` (-{damage})"

            embed.add_field(
                name="Battle",
                value=f"{interaction.user.mention} {attacker_hp} → {victim.mention} {defender_hp}",
                inline=False,
            )

            # Rewards field
            rewards_text = []
            if icicle_reward > 0:
                rewards_text.append(f"❄️ +{icicle_reward}")
            if xp_reward > 0:
                rewards_text.append(f"✨ +{xp_reward} XP")
            if leveled_up:
                rewards_text.append(f"🆙 **Level {new_level}!**")

            if rewards_text:
                embed.add_field(
                    name="Rewards", value="  ".join(rewards_text), inline=False
                )

            if new_hp == 0:
                # Handle kill
                await db.execute(
                    "UPDATE players SET kills = kills + 1, kill_streak = kill_streak + 1 WHERE user_id = ?",
                    (interaction.user.id,),
                )
                # Reset victim
                await db.execute(
                    "UPDATE players SET deaths = deaths + 1, hp = max_hp, kill_streak = 0, hit_streak = 0, assist_log = '[]' WHERE user_id = ?",
                    (victim.id,),
                )

                # Bonus for kill
                await db.execute(
                    "UPDATE players SET icicles = icicles + 25 WHERE user_id = ?",
                    (interaction.user.id,),
                )

                kill_msg = f"💀 {interaction.user.mention} eliminated {victim.mention}!"

                # Assist logic
                assist_log = json.loads(target_data["assist_log"] or "[]")
                assists = [uid for uid in assist_log if uid != interaction.user.id]

                if assists:
                    assist_names = []
                    for uid in assists:
                        # Reward assists
                        await db.execute(
                            "UPDATE players SET icicles = icicles + 10, xp = xp + 25 WHERE user_id = ?",
                            (uid,),
                        )
                        member = interaction.guild.get_member(uid)
                        if member:
                            assist_names.append(member.display_name)

                    if assist_names:
                        kill_msg += f"\n🤝 {', '.join(assist_names)}"

                embed.add_field(name="Elimination", value=kill_msg, inline=False)

                first_kill = await self.check_achievement(
                    db, interaction.user.id, "first_blood"
                )
                if first_kill:
                    embed.add_field(
                        name="Achievement Unlocked!",
                        value="🩸 First Blood",
                        inline=False,
                    )

                await db.commit()

            await interaction.response.send_message(embed=embed)

    @app_commands.command(name="stats", description="View your profile")
    @app_commands.describe(user="The user to view stats for (defaults to you)")
    async def stats(
        self, interaction: discord.Interaction, user: Optional[discord.User] = None
    ):
        target = user or interaction.user

        async with GameDatabase() as db:
            await db.execute(
                "INSERT OR IGNORE INTO players (user_id) VALUES (?)", (target.id,)
            )
            await db.commit()

            cursor = await db.execute(
                """SELECT hp, max_hp, icicles, xp, level, kills, deaths, 
                   equipped_snowball, kill_streak, achievements,
                   shield_active, armor_active, energized, cannon_shots, xp_boost, lucky_charm,
                   total_gambles, coin_flip_wins, slot_winnings
                   FROM players WHERE user_id = ?""",
                (target.id,),
            )
            data = await cursor.fetchone()

            # Get Rank (by Kills)
            cursor = await db.execute(
                "SELECT COUNT(*) + 1 FROM players WHERE kills > (SELECT kills FROM players WHERE user_id = ?)",
                (target.id,),
            )
            rank_row = await cursor.fetchone()
            rank = rank_row[0] if rank_row else "Unranked"

        level = data["level"]
        total_gambles = data["total_gambles"] or 0
        title_name, title_effects = get_title(level, total_gambles)
        xp_needed = level * 100
        xp_progress = min(data["xp"], xp_needed)
        achievements = json.loads(data["achievements"])
        snowball = SNOWBALL_TYPES.get(
            data["equipped_snowball"], SNOWBALL_TYPES["normal"]
        )
        kd = data["kills"] / max(1, data["deaths"])

        embed = discord.Embed(color=discord.Color.from_rgb(88, 101, 242))
        embed.set_author(
            name=f"{target.display_name}  🏆 #{rank}",
            icon_url=target.avatar.url if target.avatar else None,
        )
        # Header
        embed.description = f"**{title_name}**\nLevel {level}"

        # 1. VITAL STATS BLOCK (HP/XP)
        hp_pct = data["hp"] / data["max_hp"]
        hp_filled = int(hp_pct * 10)

        if hp_pct > 0.6:
            hp_color = "🟩"
        elif hp_pct > 0.3:
            hp_color = "🟨"
        elif hp_pct > 0.15:
            hp_color = "🟧"
        else:
            hp_color = "🟥"

        hp_bar = hp_color * hp_filled + "⬛" * (10 - hp_filled)

        xp_pct = xp_progress / xp_needed
        xp_filled = int(xp_pct * 10)
        xp_bar = "🟦" * xp_filled + "⬛" * (10 - xp_filled)

        embed.add_field(
            name="Vital Stats",
            value=(
                f"**HP** {hp_bar} `{data['hp']}/{data['max_hp']}`\n"
                f"**XP** {xp_bar} `{xp_progress:,}/{xp_needed:,}`"
            ),
            inline=False,
        )

        # 2. STATISTICS BLOCK (Detailed Text Layout)
        embed.add_field(
            name="Combat Stats",
            value=(
                f"Kills: `{data['kills']:,}`\n"
                f"Deaths: `{data['deaths']:,}`\n"
                f"K/D Ratio: `{kd:.2f}`"
            ),
            inline=True,
        )

        embed.add_field(
            name="Economy",
            value=(
                f"Icicles: `{data['icicles']:,}`\n"
                f"Gambles: `{total_gambles:,}`\n"
                f"Winnings: `{data['slot_winnings'] + data['coin_flip_wins']:,}`"
            ),
            inline=True,
        )

        # 3. LOADOUT & PERKS
        loadout_lines = [
            f"**Weapon:** {snowball['emoji']} {snowball['name']} ({snowball['damage'][0]}-{snowball['damage'][1]} dmg)"
        ]

        active_effects = []
        if data["shield_active"]:
            active_effects.append("Shield")
        if data["armor_active"]:
            active_effects.append(f"Armor ({data['armor_active']})")
        if data["energized"]:
            active_effects.append("Energized")
        if data["cannon_shots"]:
            active_effects.append(f"Cannon ({data['cannon_shots']})")
        if data["lucky_charm"]:
            active_effects.append(f"Lucky Charm ({data['lucky_charm']})")
        if data["xp_boost"]:
            active_effects.append(f"XP Boost ({data['xp_boost']})")

        if active_effects:
            loadout_lines.append(f"**Buffs:** {', '.join(active_effects)}")

        if title_effects:
            perks = []
            if title_effects.get("hp_bonus"):
                perks.append(f"+{title_effects['hp_bonus']} HP")
            if title_effects.get("dmg_bonus"):
                perks.append(f"+{title_effects['dmg_bonus']} Dmg")
            if title_effects.get("crit_bonus"):
                perks.append(f"+{int(title_effects['crit_bonus']*100)}% Crit")
            if title_effects.get("luck_bonus"):
                perks.append(f"+{int(title_effects['luck_bonus']*100)}% Luck")
            if perks:
                loadout_lines.append(f"**Perks:** {', '.join(perks)}")

        embed.add_field(name="Loadout", value="\n".join(loadout_lines), inline=False)

        # 4. ACHIEVEMENTS (Clear List)
        if achievements:
            ach_lines = []
            for a in achievements:
                ach_info = ACHIEVEMENTS.get(a)
                if ach_info:
                    ach_lines.append(f"{ach_info['emoji']} **{ach_info['name']}**")

            embed.add_field(
                name=f"Achievements ({len(ach_lines)}/{len(ACHIEVEMENTS)})",
                value=" • ".join(ach_lines),  # Use bullet separator for clean wrapping
                inline=False,
            )

        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="daily", description="🎁 Claim your daily rewards!")
    async def daily(self, interaction: discord.Interaction):
        async with GameDatabase() as db:
            await db.execute(
                "INSERT OR IGNORE INTO players (user_id) VALUES (?)",
                (interaction.user.id,),
            )

            cursor = await db.execute(
                "SELECT last_daily, daily_streak, icicles FROM players WHERE user_id = ?",
                (interaction.user.id,),
            )
            data = await cursor.fetchone()

            today = datetime.now().strftime("%Y-%m-%d")
            yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

            if data["last_daily"] == today:
                await interaction.response.send_message(
                    "❌ You've already claimed your daily reward today!\nCome back tomorrow! 🌅",
                    ephemeral=True,
                )
                return

            if data["last_daily"] == yesterday:
                new_streak = data["daily_streak"] + 1
            else:
                new_streak = 1

            reward_tier = 1
            for day in sorted(DAILY_REWARDS.keys(), reverse=True):
                if new_streak >= day:
                    reward_tier = day
                    break

            reward = DAILY_REWARDS[reward_tier]
            icicle_reward = reward["icicles"]
            bonus_msg = ""

            if reward["bonus"] == "random_item":
                bonus_msg = "\n🎁 **Bonus:** Random item added to inventory!"
            elif reward["bonus"] == "mystery_box":
                extra_icicles = random.randint(50, 200)
                icicle_reward += extra_icicles
                bonus_msg = f"\n🎁 **Mystery Box:** +{extra_icicles} bonus ❄️!"
            elif reward["bonus"] == "rare_item":
                bonus_msg = "\n🎁 **Bonus:** Rare item unlocked!"
            elif reward["bonus"] == "legendary":
                extra_icicles = random.randint(200, 500)
                icicle_reward += extra_icicles
                bonus_msg = f"\n👑 **LEGENDARY BONUS:** +{extra_icicles} ❄️!"

            await db.execute(
                """UPDATE players SET 
                   last_daily = ?, 
                   daily_streak = ?, 
                   icicles = icicles + ?
                   WHERE user_id = ?""",
                (today, new_streak, icicle_reward, interaction.user.id),
            )

            achievement_unlocked = False
            if new_streak >= 7:
                achievement_unlocked = await self.check_achievement(
                    db, interaction.user.id, "daily_warrior"
                )

            await db.commit()

        embed = discord.Embed(
            title="Daily Reward", color=discord.Color.from_rgb(34, 197, 94)
        )
        embed.description = (
            f"```\nStreak: {new_streak} days  •  +{icicle_reward} Icicles\n```"
        )

        if bonus_msg:
            embed.add_field(name="Bonus", value=bonus_msg.strip(), inline=False)

        if achievement_unlocked:
            embed.add_field(
                name="Achievement", value="Daily Warrior  `+500`", inline=False
            )

        next_milestone = None
        for day in sorted(DAILY_REWARDS.keys()):
            if day > new_streak:
                next_milestone = day
                break

        if next_milestone:
            embed.set_footer(text=f"Next bonus at {next_milestone} day streak")

        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="leaderboard", description="🏆 View the top players")
    @app_commands.describe(category="What to rank by")
    @app_commands.choices(
        category=[
            app_commands.Choice(name="Icicles", value="icicles"),
            app_commands.Choice(name="Level", value="level"),
            app_commands.Choice(name="Kills", value="kills"),
        ]
    )
    async def leaderboard(
        self, interaction: discord.Interaction, category: str = "kills"
    ):
        async with GameDatabase() as db:
            cursor = await db.execute(
                f"SELECT user_id, {category}, level FROM players ORDER BY {category} DESC LIMIT 10"
            )
            rows = await cursor.fetchall()

        if not rows:
            await interaction.response.send_message(
                "No players found yet!", ephemeral=True
            )
            return

        category_display = {"icicles": "Icicles", "level": "Level", "kills": "Kills"}

        embed = discord.Embed(
            title=f"Leaderboard  •  {category_display[category]}",
            color=discord.Color.from_rgb(245, 158, 11),
        )

        lines = []
        for i, row in enumerate(rows):
            rank = ["1st", "2nd", "3rd"][i] if i < 3 else f"{i+1}th"
            try:
                user = await self.bot.fetch_user(row["user_id"])
                name = user.display_name[:15]
            except Exception:
                name = "Unknown"

            value = row[category]
            lines.append(f"`{rank}`  {name}  `{value:,}`")

        embed.description = "\n".join(lines)
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="shop", description="Buy items")
    async def shop(self, interaction: discord.Interaction):
        view = ShopView(self)

        async with GameDatabase() as db:
            cursor = await db.execute(
                "SELECT icicles FROM players WHERE user_id = ?", (interaction.user.id,)
            )
            data = await cursor.fetchone()
            balance = data["icicles"] if data else 0

        embed = discord.Embed(
            title="Winter Shop ❄️",
            description=f"Balance: `{balance:,}` ❄️\nSelect an item below to purchase.",
            color=discord.Color.from_rgb(88, 101, 242),
        )

        # Helper to format lines
        def fmt_item(key):
            item = SHOP_ITEMS[key]
            return f"{item['emoji']} **{item['name']}** • {item['desc']} • `{item['cost']}` ❄️"

        embed.add_field(
            name="Wellness & Recovery",
            value="\n".join(
                [fmt_item("cocoa"), fmt_item("healing_surge"), fmt_item("full_restore")]
            ),
            inline=False,
        )

        embed.add_field(
            name="Combat Buffs",
            value="\n".join(
                [
                    fmt_item("energy_drink"),
                    fmt_item("double_xp"),
                    fmt_item("lucky_charm"),
                ]
            ),
            inline=False,
        )

        embed.add_field(
            name="Defense & Gear",
            value="\n".join(
                [
                    fmt_item("shield"),
                    fmt_item("armor"),
                    fmt_item("cannon"),
                    fmt_item("fortress"),
                ]
            ),
            inline=False,
        )

        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

    @app_commands.command(name="gamble", description="Slot machine and coin flip")
    async def gamble(self, interaction: discord.Interaction):
        async with GameDatabase() as db:
            await db.execute(
                "INSERT OR IGNORE INTO players (user_id) VALUES (?)",
                (interaction.user.id,),
            )
            await db.commit()
            cursor = await db.execute(
                "SELECT icicles FROM players WHERE user_id = ?", (interaction.user.id,)
            )
            data = await cursor.fetchone()
            balance = data["icicles"] if data else 0

        if balance < 5:
            await interaction.response.send_message(
                "You need at least `5` Icicles to gamble.", ephemeral=True
            )
            return

        embed = discord.Embed(
            title="Gamble",
            description=f"Balance: `{balance:,}`\n\nMinimum bet: `5` Icicles",
            color=discord.Color.from_rgb(245, 158, 11),
        )
        embed.add_field(
            name="Slot Machine", value="Solo  •  Win Icicles or items", inline=False
        )
        embed.add_field(
            name="Coin Flip", value="1v1  •  Winner takes all", inline=False
        )

        view = GambleView(self, balance)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

    @app_commands.command(
        name="inventory", description="🎒 View your inventory and equip weapons"
    )
    async def inventory(self, interaction: discord.Interaction):
        async with GameDatabase() as db:
            await db.execute(
                "INSERT OR IGNORE INTO players (user_id) VALUES (?)",
                (interaction.user.id,),
            )
            await db.commit()

            cursor = await db.execute(
                """SELECT level, equipped_snowball, shield_active, energized, cannon_shots, 
                   hp, max_hp, icicles, achievements FROM players WHERE user_id = ?""",
                (interaction.user.id,),
            )
            data = await cursor.fetchone()

        level = data["level"]
        equipped = data["equipped_snowball"] or "normal"
        achievements = json.loads(data["achievements"])

        embed = discord.Embed(
            title="Inventory", color=discord.Color.from_rgb(88, 101, 242)
        )
        embed.set_author(
            name=interaction.user.display_name,
            icon_url=interaction.user.avatar.url if interaction.user.avatar else None,
        )

        stats_text = f"```\nLevel {level}  •  {data['hp']}/{data['max_hp']} HP  •  {data['icicles']:,} Icicles\n```"
        embed.description = stats_text

        arsenal_lines = []
        for key, snowball in SNOWBALL_TYPES.items():
            if level >= snowball["level"]:
                marker = "▸" if key == equipped else "◦"
                status = "equipped" if key == equipped else ""
                arsenal_lines.append(
                    f"{marker} {snowball['emoji']} {snowball['name']}  `{snowball['damage'][0]}-{snowball['damage'][1]} dmg`  {status}"
                )
            else:
                arsenal_lines.append(
                    f"◦ 🔒 {snowball['name']}  `Level {snowball['level']}`"
                )

        embed.add_field(name="Snowballs", value="\n".join(arsenal_lines), inline=False)

        buff_lines = []
        if data["shield_active"]:
            buff_lines.append("🛡️ Shield Active")
        if data["energized"]:
            buff_lines.append("⚡ Energized")
        if data["cannon_shots"] > 0:
            buff_lines.append(f"🔫 Cannon `{data['cannon_shots']} shots`")

        if buff_lines:
            embed.add_field(
                name="Active Buffs", value="  •  ".join(buff_lines), inline=False
            )

        if achievements:
            embed.add_field(
                name=f"Achievements  `{len(achievements)}/{len(ACHIEVEMENTS)}`",
                value=" ".join([ACHIEVEMENTS[a]["emoji"] for a in achievements]),
                inline=False,
            )

        embed.set_footer(text="Select below to equip")

        view = InventoryView(self, level, equipped)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)


class InventoryView(discord.ui.View):
    def __init__(self, cog, level: int, current_equipped: str):
        super().__init__(timeout=60)
        self.cog = cog
        self.level = level
        self.current_equipped = current_equipped

        options = []
        for key, snowball in SNOWBALL_TYPES.items():
            if level >= snowball["level"]:
                is_equipped = key == current_equipped
                options.append(
                    discord.SelectOption(
                        label=f"{snowball['name']} {'(Equipped)' if is_equipped else ''}",
                        description=f"Damage: {snowball['damage'][0]}-{snowball['damage'][1]}",
                        emoji=snowball["emoji"],
                        value=key,
                        default=is_equipped,
                    )
                )

        if options:
            self.add_item(EquipSelect(options))


class EquipSelect(discord.ui.Select):
    def __init__(self, options):
        super().__init__(placeholder="Select a snowball to equip...", options=options)

    async def callback(self, interaction: discord.Interaction):
        selected = self.values[0]
        snowball = SNOWBALL_TYPES[selected]

        async with GameDatabase() as db:
            await db.execute(
                "UPDATE players SET equipped_snowball = ? WHERE user_id = ?",
                (selected, interaction.user.id),
            )
            await db.commit()

        await interaction.response.send_message(
            f"✅ Equipped **{snowball['emoji']} {snowball['name']}**!\nDamage: {snowball['damage'][0]}-{snowball['damage'][1]}",
            ephemeral=True,
        )


class ShopView(discord.ui.View):
    def __init__(self, cog):
        super().__init__(timeout=60)
        self.cog = cog

    @discord.ui.select(
        placeholder="Choose an item...",
        options=[
            discord.SelectOption(
                label="Hot Cocoa (10)", description="+25 HP", emoji="☕", value="cocoa"
            ),
            discord.SelectOption(
                label="Healing Surge (25)",
                description="+50 HP",
                emoji="💚",
                value="healing_surge",
            ),
            discord.SelectOption(
                label="Full Restore (50)",
                description="Full HP",
                emoji="❤️",
                value="full_restore",
            ),
            discord.SelectOption(
                label="Energy Drink (30)",
                description="+50% dmg",
                emoji="⚡",
                value="energy_drink",
            ),
            discord.SelectOption(
                label="XP Boost (40)",
                description="2x XP (5 hits)",
                emoji="✨",
                value="double_xp",
            ),
            discord.SelectOption(
                label="Lucky Charm (35)",
                description="+10% crit",
                emoji="🍀",
                value="lucky_charm",
            ),
            discord.SelectOption(
                label="Frost Shield (40)",
                description="Block 1 hit",
                emoji="🛡️",
                value="shield",
            ),
            discord.SelectOption(
                label="Ice Armor (75)",
                description="-25% dmg",
                emoji="🧴",
                value="armor",
            ),
            discord.SelectOption(
                label="Cannon (80)",
                description="+8 dmg (10 hits)",
                emoji="🔫",
                value="cannon",
            ),
            discord.SelectOption(
                label="Ice Fortress (100)",
                description="+15 max HP",
                emoji="🏰",
                value="fortress",
            ),
        ],
    )
    async def select_callback(
        self, interaction: discord.Interaction, select: discord.ui.Select
    ):
        item_id = select.values[0]
        item = SHOP_ITEMS[item_id]
        cost = item["cost"]

        async with GameDatabase() as db:
            cursor = await db.execute(
                "SELECT icicles, hp, max_hp, total_spent, shield_active, energized FROM players WHERE user_id = ?",
                (interaction.user.id,),
            )
            data = await cursor.fetchone()

            if not data or data["icicles"] < cost:
                await interaction.response.send_message(
                    f"❌ You need `{cost}` Icicles!", ephemeral=True
                )
                return

            # Usage Checks
            if (
                item_id in ["cocoa", "healing_surge", "full_restore"]
                and data["hp"] >= data["max_hp"]
            ):
                await interaction.response.send_message(
                    "❤️ Your Health is already full!", ephemeral=True
                )
                return

            if item_id == "shield" and data["shield_active"]:
                await interaction.response.send_message(
                    "🛡️ You already have a Shield active!", ephemeral=True
                )
                return

            if item_id == "energy_drink" and data["energized"]:
                await interaction.response.send_message(
                    "⚡ You are already Energized!", ephemeral=True
                )
                return

            result_msg = ""

            if item_id == "cocoa":
                new_hp = min(data["hp"] + 25, data["max_hp"])
                await db.execute(
                    "UPDATE players SET hp = ?, icicles = icicles - ?, total_spent = total_spent + ? WHERE user_id = ?",
                    (new_hp, cost, cost, interaction.user.id),
                )
                result_msg = f"☕ +25 HP  ({new_hp}/{data['max_hp']})"

            elif item_id == "healing_surge":
                new_hp = min(data["hp"] + 50, data["max_hp"])
                await db.execute(
                    "UPDATE players SET hp = ?, icicles = icicles - ?, total_spent = total_spent + ? WHERE user_id = ?",
                    (new_hp, cost, cost, interaction.user.id),
                )
                result_msg = f"💚 +50 HP  ({new_hp}/{data['max_hp']})"

            elif item_id == "full_restore":
                await db.execute(
                    "UPDATE players SET hp = max_hp, icicles = icicles - ?, total_spent = total_spent + ? WHERE user_id = ?",
                    (cost, cost, interaction.user.id),
                )
                result_msg = f"❤️ Full HP restored"

            elif item_id == "energy_drink":
                await db.execute(
                    "UPDATE players SET energized = 1, icicles = icicles - ?, total_spent = total_spent + ? WHERE user_id = ?",
                    (cost, cost, interaction.user.id),
                )
                result_msg = "⚡ Energized (+50% dmg next hit)"

            elif item_id == "double_xp":
                await db.execute(
                    "UPDATE players SET xp_boost = 5, icicles = icicles - ?, total_spent = total_spent + ? WHERE user_id = ?",
                    (cost, cost, interaction.user.id),
                )
                result_msg = "✨ XP Boost active (5 hits)"

            elif item_id == "lucky_charm":
                await db.execute(
                    "UPDATE players SET lucky_charm = 5, icicles = icicles - ?, total_spent = total_spent + ? WHERE user_id = ?",
                    (cost, cost, interaction.user.id),
                )
                result_msg = "🍀 Lucky Charm active (+10% crit, 5 hits)"

            elif item_id == "shield":
                await db.execute(
                    "UPDATE players SET shield_active = 1, icicles = icicles - ?, total_spent = total_spent + ? WHERE user_id = ?",
                    (cost, cost, interaction.user.id),
                )
                result_msg = "🛡️ Shield active"

            elif item_id == "armor":
                await db.execute(
                    "UPDATE players SET armor_active = 5, icicles = icicles - ?, total_spent = total_spent + ? WHERE user_id = ?",
                    (cost, cost, interaction.user.id),
                )
                result_msg = "🧴 Ice Armor active (-25% dmg, 5 hits)"

            elif item_id == "cannon":
                await db.execute(
                    "UPDATE players SET cannon_shots = cannon_shots + 10, icicles = icicles - ?, total_spent = total_spent + ? WHERE user_id = ?",
                    (cost, cost, interaction.user.id),
                )
                result_msg = "🔫 Cannon equipped (+8 dmg, 10 hits)"

            elif item_id == "fortress":
                new_max = data["max_hp"] + 15
                await db.execute(
                    "UPDATE players SET max_hp = ?, icicles = icicles - ?, total_spent = total_spent + ? WHERE user_id = ?",
                    (new_max, cost, cost, interaction.user.id),
                )
                result_msg = f"🏰 +15 max HP ({new_max})"

            new_spent = data["total_spent"] + cost
            if new_spent >= 1000:
                await self.cog.check_achievement(db, interaction.user.id, "big_spender")

            await db.commit()

        balance_remaining = data["icicles"] - cost
        await interaction.response.send_message(
            f"{result_msg}\n\nRemaining Balance: `{balance_remaining:,}` ❄️",
            ephemeral=True,
        )


class GambleView(discord.ui.View):
    def __init__(self, cog, balance: int):
        super().__init__(timeout=60)
        self.cog = cog
        self.balance = balance

    @discord.ui.button(
        label="Slot Machine", style=discord.ButtonStyle.primary, emoji="🎰"
    )
    async def slot_button(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        modal = SlotModal(self.cog)
        await interaction.response.send_modal(modal)

    @discord.ui.button(
        label="Coin Flip", style=discord.ButtonStyle.secondary, emoji="🪙"
    )
    async def flip_button(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ):
        modal = CoinFlipModal(self.cog)
        await interaction.response.send_modal(modal)


class SlotModal(discord.ui.Modal, title="Slot Machine"):
    bet = discord.ui.TextInput(
        label="Bet Amount", placeholder="5-1000", min_length=1, max_length=5
    )

    def __init__(self, cog):
        super().__init__()
        self.cog = cog

    async def on_submit(self, interaction: discord.Interaction):
        try:
            bet_amount = int(self.bet.value)
        except ValueError:
            await interaction.response.send_message("Invalid amount", ephemeral=True)
            return

        if bet_amount < 5:
            await interaction.response.send_message("Minimum bet: `5`", ephemeral=True)
            return

        async with GameDatabase() as db:
            cursor = await db.execute(
                "SELECT icicles, slot_winnings FROM players WHERE user_id = ?",
                (interaction.user.id,),
            )
            data = await cursor.fetchone()

            if not data or data["icicles"] < bet_amount:
                await interaction.response.send_message(
                    "Not enough Icicles", ephemeral=True
                )
                return

            # Animation
            await interaction.response.send_message("🎰 **Spinning...**")
            anim_msg = await interaction.original_response()

            slots = ["🍒", "🍋", "🍊", "🍇", "🍓", "⭐", "💎"]

            # Spin animation
            for _ in range(3):
                await asyncio.sleep(0.7)
                await anim_msg.edit(
                    content=f"🎰 {random.choice(slots)} {random.choice(slots)} {random.choice(slots)}"
                )

            result = [random.choice(slots) for _ in range(3)]

            if result[0] == result[1] == result[2]:
                if result[0] == "💎":
                    winnings = bet_amount * 10
                    msg = f"{' '.join(result)}\n\n💎 **JACKPOT** +{winnings} Icicles"
                elif result[0] == "⭐":
                    winnings = bet_amount * 5
                    msg = f"{' '.join(result)}\n\n⭐ **BIG WIN** +{winnings} Icicles"
                else:
                    winnings = bet_amount * 3
                    msg = f"{' '.join(result)}\n\n**WIN** +{winnings} Icicles"
            elif result[0] == result[1] or result[1] == result[2]:
                winnings = int(bet_amount * 1.5)
                msg = f"{' '.join(result)}\n\n+{winnings} Icicles"
            else:
                winnings = 0
                msg = f"{' '.join(result)}\n\n💸 **You lost** `{bet_amount}` Icicles"

            net = winnings - bet_amount
            new_winnings = (data["slot_winnings"] or 0) + max(0, winnings)

            await db.execute(
                "UPDATE players SET icicles = icicles + ?, slot_winnings = ?, total_gambles = total_gambles + 1 WHERE user_id = ?",
                (net, new_winnings, interaction.user.id),
            )

            if winnings >= 500:
                await self.cog.check_achievement(db, interaction.user.id, "high_roller")

            await db.commit()

        # Fetch updated balance for display
        async with GameDatabase() as db:
            cur2 = await db.execute(
                "SELECT icicles FROM players WHERE user_id = ?", (interaction.user.id,)
            )
            bal_row = await cur2.fetchone()
            balance = bal_row["icicles"] if bal_row else None

        color = (
            discord.Color.from_rgb(34, 197, 94)
            if winnings > 0
            else discord.Color.from_rgb(239, 68, 68)
        )

        result_row = " ".join(result)
        status_prefix = "You won" if winnings > 0 else "You lost"
        status_line = (
            f"✅ **{status_prefix}** `+{winnings}` Icicles"
            if winnings > 0
            else f"❌ **{status_prefix}** `{bet_amount}` Icicles"
        )

        embed = discord.Embed(title="🎰 Slot Result", color=color)
        embed.description = (
            f"{interaction.user.mention}\n\n" f"**{result_row}**\n\n" f"{status_line}"
        )
        embed.add_field(name="Bet", value=f"`{bet_amount}`", inline=True)
        embed.add_field(name="Payout", value=f"`{winnings}`", inline=True)
        embed.add_field(name="Net", value=f"`{winnings - bet_amount}`", inline=True)
        if balance is not None:
            embed.add_field(name="Balance", value=f"`{balance}`", inline=False)
        embed.set_footer(text="Good luck on the next spin ✨")

        await anim_msg.edit(content=None, embed=embed)


class CoinFlipModal(discord.ui.Modal, title="Coin Flip"):
    bet = discord.ui.TextInput(
        label="Bet Amount", placeholder="5-1000", min_length=1, max_length=5
    )

    def __init__(self, cog):
        super().__init__()
        self.cog = cog

    async def on_submit(self, interaction: discord.Interaction):
        try:
            bet_amount = int(self.bet.value)
        except ValueError:
            await interaction.response.send_message("Invalid amount", ephemeral=True)
            return

        if bet_amount < 5:
            await interaction.response.send_message("Minimum bet: `5`", ephemeral=True)
            return

        user_id = interaction.user.id

        # Check if user already in queue
        for amount, data in COIN_FLIP_QUEUE.items():
            if data["user_id"] == user_id:
                await interaction.response.send_message(
                    "You're already in queue. Wait for a match.", ephemeral=True
                )
                return

        # Check balance
        async with GameDatabase() as db:
            cursor = await db.execute(
                "SELECT icicles FROM players WHERE user_id = ?", (user_id,)
            )
            data = await cursor.fetchone()

            if not data or data["icicles"] < bet_amount:
                await interaction.response.send_message(
                    "Not enough Icicles", ephemeral=True
                )
                return

            # Check if someone is waiting with same bet amount
            if bet_amount in COIN_FLIP_QUEUE:
                opponent_data = COIN_FLIP_QUEUE.pop(bet_amount)
                opponent_id = opponent_data["user_id"]

                # Don't match with yourself
                if opponent_id == user_id:
                    COIN_FLIP_QUEUE[bet_amount] = opponent_data
                    await interaction.response.send_message(
                        "You're already in queue for this amount", ephemeral=True
                    )
                    return

                # Check opponent still has funds
                cursor = await db.execute(
                    "SELECT icicles FROM players WHERE user_id = ?", (opponent_id,)
                )
                opp_balance = await cursor.fetchone()

                if not opp_balance or opp_balance["icicles"] < bet_amount:
                    # Opponent can't afford, add current user to queue
                    COIN_FLIP_QUEUE[bet_amount] = {
                        "user_id": user_id,
                        "channel": interaction.channel,
                        "guild_id": interaction.guild.id if interaction.guild else None,
                    }
                    await interaction.response.send_message(
                        f"Queued for `{bet_amount}` Icicles. Waiting for opponent...",
                        ephemeral=True,
                    )
                    return

                # Match found! Flip the coin
                # Animation
                await interaction.response.send_message(
                    f"⚔️ **Coin Flip Match!**\n<@{user_id}> vs <@{opponent_id}>\nBet: `{bet_amount}` Icicles"
                )
                anim_msg = await interaction.original_response()

                await asyncio.sleep(1)
                await anim_msg.edit(content="🪙 **Flipping...**")
                await asyncio.sleep(1.5)

                winner_id = random.choice([user_id, opponent_id])
                loser_id = opponent_id if winner_id == user_id else user_id

                await db.execute(
                    "UPDATE players SET icicles = icicles + ?, coin_flip_wins = coin_flip_wins + 1, total_gambles = total_gambles + 1 WHERE user_id = ?",
                    (bet_amount, winner_id),
                )
                await db.execute(
                    "UPDATE players SET icicles = icicles - ?, total_gambles = total_gambles + 1 WHERE user_id = ?",
                    (bet_amount, loser_id),
                )

                cursor = await db.execute(
                    "SELECT coin_flip_wins FROM players WHERE user_id = ?", (winner_id,)
                )
                wins = (await cursor.fetchone())["coin_flip_wins"]
                if wins >= 10:
                    await self.cog.check_achievement(db, winner_id, "lucky_flip")

                await db.commit()

                result = "Heads" if random.random() > 0.5 else "Tails"
                winner = await interaction.client.fetch_user(winner_id)
                loser = await interaction.client.fetch_user(loser_id)

                embed = discord.Embed(
                    title="🪙 Coin Flip Result",
                    color=discord.Color.from_rgb(34, 197, 94),
                )
                embed.description = (
                    f"**Result:** {result}\n\n"
                    f"{winner.mention} vs {loser.mention}\n\n"
                    f"🏆 **Winner:** {winner.mention}"
                )
                embed.add_field(name="Bet", value=f"`{bet_amount}`", inline=True)
                embed.add_field(name="Payout", value=f"`+{bet_amount}`", inline=True)
                embed.add_field(name="Loser", value=f"{loser.mention}", inline=False)
                embed.set_footer(text="Thanks for playing ✨")

                await anim_msg.edit(content=None, embed=embed)

                # Notify opponent in their channel if possible
                try:
                    opp_channel = opponent_data["channel"]
                    if opp_channel:
                        result_for_opp = "won" if winner_id == opponent_id else "lost"
                        await opp_channel.send(
                            f"🪙 <@{opponent_id}> {result_for_opp} `{bet_amount}` Icicles in coin flip vs {interaction.user.display_name}!"
                        )
                except Exception:
                    pass
            else:
                # No match, add to queue
                COIN_FLIP_QUEUE[bet_amount] = {
                    "user_id": user_id,
                    "channel": interaction.channel,
                    "guild_id": interaction.guild.id if interaction.guild else None,
                }

                embed = discord.Embed(
                    title="🪙 Coin Flip Queued",
                    description=f"Bet: `{bet_amount}` Icicles\n\nWaiting for opponent with same bet...",
                    color=discord.Color.from_rgb(245, 158, 11),
                )
                embed.set_footer(text="You can leave. Match happens automatically.")
                await interaction.response.send_message(embed=embed, ephemeral=True)


class KrampusModerator(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.blacklist = ["grinch", "bah humbug", "hate", "scam"]

    @app_commands.command(
        name="set_naughty_role",
        description="Set the punishment role for the Naughty List",
    )
    @app_commands.describe(role="The role to assign to naughty users")
    @app_commands.checks.has_permissions(administrator=True)
    async def set_naughty_role(
        self, interaction: discord.Interaction, role: discord.Role
    ):
        async with GameDatabase() as db:
            await db.execute(
                "INSERT INTO guild_config (guild_id, naughty_role_id) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET naughty_role_id = ?",
                (interaction.guild.id, role.id, role.id),
            )
            await db.commit()
        await interaction.response.send_message(
            f"Naughty list role set to {role.mention}", ephemeral=True
        )

    @app_commands.command(name="kick", description="Kick a user from the server")
    @app_commands.describe(user="User to kick", reason="Reason for kick (optional)")
    @app_commands.checks.has_permissions(kick_members=True)
    async def kick(
        self,
        interaction: discord.Interaction,
        user: discord.User,
        reason: str = "No reason provided",
    ):
        try:
            member = await interaction.guild.fetch_member(user.id)
            await member.kick(reason=reason)
            embed = discord.Embed(
                title="User Kicked",
                description=f"{user.mention} has been kicked from the server.\nReason: {reason}",
                color=discord.Color.from_rgb(239, 68, 68),
            )
            await interaction.response.send_message(embed=embed)
        except discord.Forbidden:
            await interaction.response.send_message(
                "I don't have permission to kick this user.", ephemeral=True
            )
        except Exception as e:
            await interaction.response.send_message(f"Error: {str(e)}", ephemeral=True)

    @app_commands.command(name="ban", description="Ban a user from the server")
    @app_commands.describe(
        user="User to ban",
        reason="Reason for ban (optional)",
        delete_days="Days of messages to delete (0-7)",
    )
    @app_commands.checks.has_permissions(ban_members=True)
    async def ban(
        self,
        interaction: discord.Interaction,
        user: discord.User,
        reason: str = "No reason provided",
        delete_days: int = 0,
    ):
        try:
            await interaction.guild.ban(
                user, reason=reason, delete_message_days=min(7, max(0, delete_days))
            )
            embed = discord.Embed(
                title="User Banned",
                description=f"{user.mention} has been banned from the server.\nReason: {reason}",
                color=discord.Color.from_rgb(239, 68, 68),
            )
            await interaction.response.send_message(embed=embed)
        except discord.Forbidden:
            await interaction.response.send_message(
                "I don't have permission to ban this user.", ephemeral=True
            )
        except Exception as e:
            await interaction.response.send_message(f"Error: {str(e)}", ephemeral=True)

    @app_commands.command(
        name="mute", description="Mute a user for a specified duration"
    )
    @app_commands.describe(
        user="User to mute",
        minutes="Duration in minutes",
        reason="Reason for mute (optional)",
    )
    @app_commands.checks.has_permissions(moderate_members=True)
    async def mute(
        self,
        interaction: discord.Interaction,
        user: discord.User,
        minutes: int,
        reason: str = "No reason provided",
    ):
        try:
            member = await interaction.guild.fetch_member(user.id)
            duration = timedelta(minutes=minutes)
            await member.timeout(duration, reason=reason)
            embed = discord.Embed(
                title="User Muted",
                description=f"{user.mention} has been muted for {minutes} minutes.\nReason: {reason}",
                color=discord.Color.from_rgb(245, 158, 11),
            )
            await interaction.response.send_message(embed=embed)
        except discord.Forbidden:
            await interaction.response.send_message(
                "I don't have permission to mute this user.", ephemeral=True
            )
        except Exception as e:
            await interaction.response.send_message(f"Error: {str(e)}", ephemeral=True)

    @app_commands.command(name="unmute", description="Unmute a user")
    @app_commands.describe(user="User to unmute")
    @app_commands.checks.has_permissions(moderate_members=True)
    async def unmute(self, interaction: discord.Interaction, user: discord.User):
        try:
            member = await interaction.guild.fetch_member(user.id)
            await member.timeout(None, reason="Unmuted")
            embed = discord.Embed(
                title="User Unmuted",
                description=f"{user.mention} has been unmuted.",
                color=discord.Color.from_rgb(34, 197, 94),
            )
            await interaction.response.send_message(embed=embed)
        except discord.Forbidden:
            await interaction.response.send_message(
                "I don't have permission to unmute this user.", ephemeral=True
            )
        except Exception as e:
            await interaction.response.send_message(f"Error: {str(e)}", ephemeral=True)

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot or not message.guild:
            return
        if any(word in message.content.lower() for word in self.blacklist):
            await self.apply_coal(message)

    async def apply_coal(self, message):
        async with GameDatabase() as db:
            await db.execute(
                "INSERT OR IGNORE INTO moderation (user_id) VALUES (?)",
                (message.author.id,),
            )
            await db.execute(
                "UPDATE moderation SET coal_count = coal_count + 1 WHERE user_id = ?",
                (message.author.id,),
            )
            cursor = await db.execute(
                "SELECT coal_count FROM moderation WHERE user_id = ?",
                (message.author.id,),
            )
            coals = (await cursor.fetchone())["coal_count"]

            role_cursor = await db.execute(
                "SELECT naughty_role_id FROM guild_config WHERE guild_id = ?",
                (message.guild.id,),
            )
            role_data = await role_cursor.fetchone()
            naughty_role_id = role_data["naughty_role_id"] if role_data else 0
            await db.commit()

        try:
            await message.delete()
        except Exception:
            pass

        embed = discord.Embed(
            title="👹 The Krampus is Watching...", color=discord.Color.dark_red()
        )

        if coals == 1:
            embed.description = (
                f"{message.author.mention}, that's naughty! **1 Lump of Coal**."
            )
            await message.channel.send(embed=embed, delete_after=10)
        elif coals == 2:
            embed.description = (
                f"{message.author.mention}, **2 Lumps of Coal**! Enjoy a timeout."
            )
            try:
                await message.author.timeout(
                    timedelta(minutes=10), reason="Krampus: 2 Coals"
                )
            except discord.Forbidden:
                embed.description += "\n(I can't timeout you, but I'm watching.)"
            await message.channel.send(embed=embed)
        elif coals >= 3:
            embed.description = f"{message.author.mention}, **3 COALS!** You're on the **Naughty List**!"
            role = message.guild.get_role(naughty_role_id)
            if role:
                try:
                    await message.author.add_roles(role, reason="Krampus: Naughty List")
                except discord.Forbidden:
                    pass
            await message.channel.send(embed=embed)


class NorthPoleAI(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.user_history = {}

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot or not client:
            return
        if self.bot.user in message.mentions:
            async with message.channel.typing():
                response_text = await self.generate_santa_response(message)
                embed = discord.Embed(
                    description=response_text, color=discord.Color.from_rgb(255, 50, 50)
                )
                embed.set_author(
                    name="🎅 Santa Claus",
                    icon_url=self.bot.user.avatar.url if self.bot.user.avatar else None,
                )
                embed.set_footer(text="Polaris v2026.1 | Made by Chris")
                await message.reply(embed=embed)

    async def generate_santa_response(self, message):
        uid = message.author.id
        if uid not in self.user_history:
            self.user_history[uid] = []
        history = self.user_history[uid][-10:]

        prompt = (
            "You are Polaris, playing Santa Claus. "
            "Personality: Cheerful and fatherly; a touch old-fashioned. "
            "Guidelines: 1) Address the user warmly (e.g., 'my child'). "
            "2) Light winter metaphors. 3) Keep under 400 characters. 4) Max 2 emojis.\n\n"
            f"History: {history}\nUser: {message.content}\nSanta:"
        )

        try:
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model="gemini-2.5-flash-lite", contents=prompt
                ),
            )
            text = response.text
            self.user_history[uid].append(f"User: {message.content}")
            self.user_history[uid].append(f"Santa: {text}")
            return text
        except Exception as e:
            logger.error(f"AI Error: {e}")
            return "Ho ho... *bZZzt* ... my snow-circuits are jammed! 🦌"


class HelpSelect(discord.ui.Select):
    def __init__(self, bot):
        options = [
            discord.SelectOption(
                label="Combat", description="Weapons and fighting", value="combat"
            ),
            discord.SelectOption(
                label="Economy", description="Earning and spending", value="economy"
            ),
            discord.SelectOption(
                label="Gambling", description="Slots and coin flip", value="gambling"
            ),
            discord.SelectOption(
                label="Progression",
                description="Leveling and rewards",
                value="progression",
            ),
            discord.SelectOption(
                label="Moderation",
                description="Server moderation tools",
                value="moderation",
            ),
            discord.SelectOption(label="About", description="Bot info", value="about"),
        ]
        super().__init__(placeholder="Select a topic", options=options)
        self.bot = bot

    async def callback(self, interaction: discord.Interaction):
        embed = discord.Embed(color=discord.Color.from_rgb(88, 101, 242))

        if self.values[0] == "combat":
            embed.title = "Combat"
            embed.description = (
                "`/throw @user` Attack someone\n"
                "`/inventory` Equip weapons\n"
                "`/stats` View your profile\n\n"
                "**Weapons** (unlock by leveling)\n"
                "Lv1 Snowball `5-12`\n"
                "Lv3 Packed Snow `10-18`\n"
                "Lv6 Ice Ball `14-24`\n"
                "Lv10 Ice Bomb `18-30`\n"
                "Lv15 Avalanche `25-40`\n"
                "Lv20 Blizzard `32-50`\n"
                "Lv30 Permafrost `40-60`\n"
                "Lv50 Absolute Zero `50-75`"
            )
        elif self.values[0] == "economy":
            embed.title = "Economy"
            embed.description = (
                "`/shop` Buy items\n"
                "`/daily` Daily reward\n"
                "`/stats` View balance\n"
                "`/leaderboard` View rankings\n\n"
                "**Earning**\n"
                "Hits: 2-5 Icicles\n"
                "Knockouts: +25 bonus\n"
                "Daily streak: up to 750\n"
                "Gambling wins\n\n"
                "**Shop Items**\n"
                "Healing: 10-50\n"
                "Buffs: 30-40\n"
                "Gear: 40-100"
            )
        elif self.values[0] == "gambling":
            embed.title = "Gambling"
            embed.description = (
                "`/gamble` Open gambling menu\n\n"
                "**Slot Machine**\n"
                "Bet 5+ Icicles, spin for prizes\n"
                "3 matching = 3x bet\n"
                "3 diamonds = 10x (jackpot)\n\n"
                "**Coin Flip**\n"
                "1v1 against another player\n"
                "Both bet same amount\n"
                "Winner takes the pot"
            )
        elif self.values[0] == "progression":
            embed.title = "Progression"
            embed.description = (
                "**Leveling**\n"
                "XP = damage dealt\n"
                "Level up = new weapons\n\n"
                "**Daily Rewards**\n"
                "Day 1: 15 Icicles\n"
                "Day 7: 150 + mystery\n"
                "Day 30: 750 + legendary\n\n"
                "**Achievements**\n"
                "First Blood: 50\n"
                "Daily Warrior: 500\n"
                "High Roller: 250\n"
                "Lucky Flip: 200"
            )
        elif self.values[0] == "moderation":
            embed.title = "Moderation"
            embed.description = (
                "**Admin Commands**\n"
                "`/kick @user [reason]` Remove user from server\n"
                "`/ban @user [reason] [days]` Ban user (0-7 day message delete)\n"
                "`/mute @user <minutes> [reason]` Timeout user\n"
                "`/unmute @user` Remove timeout\n"
                "`/set_naughty_role <role>` Auto-role for language violations\n\n"
                "**Automatic Moderation**\n"
                "Language filter with progressive warnings\n"
                "1 Coal: Warning\n"
                "2 Coals: 10 min timeout\n"
                "3+ Coals: Naughty List role"
            )
        elif self.values[0] == "about":
            embed.title = "Polaris"
            embed.description = (
                "Snowball combat with RPG progression\n\n"
                "Built by Christopher Joshy\n"
                "Full moderation suite included\n"
                "Santa chat available"
            )

        await interaction.response.edit_message(embed=embed)


class Dashboard(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    def cog_load(self):
        self.live_dashboard.start()

    def cog_unload(self):
        self.live_dashboard.cancel()

    @tasks.loop(minutes=2)
    async def live_dashboard(self):
        now = datetime.now()
        if now.month == 1 and now.day == 1:
            target_date = datetime(now.year + 1, 1, 1)
        else:
            target_date = datetime(now.year + 1, 1, 1)

        diff_timestamp = int(target_date.timestamp())

        async with GameDatabase() as db:
            cursor = await db.execute(
                "SELECT user_id, icicles FROM players ORDER BY icicles DESC LIMIT 1"
            )
            champ_data = await cursor.fetchone()
            champion = (
                f"<@{champ_data['user_id']}> ({champ_data['icicles']:,}❄️)"
                if champ_data
                else "None yet!"
            )

            cursor = await db.execute("SELECT SUM(coal_count) as total FROM moderation")
            total_coal = (await cursor.fetchone())["total"] or 0
            toxicity = (
                "Low 🟢"
                if total_coal < 5
                else "Medium 🟡" if total_coal < 15 else "HIGH 🔴"
            )

            cursor = await db.execute("SELECT COUNT(*) as count FROM players")
            total_players = (await cursor.fetchone())["count"]

            cursor = await db.execute(
                "SELECT guild_id, dashboard_channel_id, dashboard_message_id FROM guild_config WHERE dashboard_channel_id != 0"
            )
            guilds = await cursor.fetchall()

            for g_data in guilds:
                channel = self.bot.get_channel(g_data["dashboard_channel_id"])
                if not channel:
                    continue

                embed = discord.Embed(
                    title="📊 North Pole Dashboard",
                    timestamp=now,
                    color=discord.Color.from_rgb(150, 50, 255),
                )
                embed.add_field(
                    name="🎆 Countdown to New Year",
                    value=f"<t:{diff_timestamp}:R>",
                    inline=False,
                )
                embed.add_field(
                    name="👥 Total Players", value=str(total_players), inline=True
                )
                embed.add_field(name="❄️ Snowball Champion", value=champion, inline=True)
                embed.add_field(name="👹 Server Toxicity", value=toxicity, inline=True)
                embed.set_footer(text="Updates every 2 mins • Polaris v2.0")

                msg = None
                if g_data["dashboard_message_id"]:
                    try:
                        msg = await channel.fetch_message(
                            g_data["dashboard_message_id"]
                        )
                        await msg.edit(embed=embed)
                    except discord.NotFound:
                        msg = None

                if not msg:
                    msg = await channel.send(embed=embed)
                    await db.execute(
                        "UPDATE guild_config SET dashboard_message_id = ? WHERE guild_id = ?",
                        (msg.id, g_data["guild_id"]),
                    )
                    await db.commit()

    @app_commands.command(
        name="set_dashboard",
        description="⚙️ Set the current channel for the live dashboard",
    )
    @app_commands.checks.has_permissions(administrator=True)
    async def set_dashboard(self, interaction: discord.Interaction):
        async with GameDatabase() as db:
            await db.execute(
                "INSERT INTO guild_config (guild_id, dashboard_channel_id) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET dashboard_channel_id = ?",
                (interaction.guild.id, interaction.channel.id, interaction.channel.id),
            )
            await db.commit()

        await interaction.response.send_message(
            "✅ Dashboard channel set! Generating live view...", ephemeral=True
        )
        if self.live_dashboard.is_running():
            self.live_dashboard.restart()
        else:
            self.live_dashboard.start()


class General(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="help", description="Help menu")
    async def help(self, interaction: discord.Interaction):
        view = discord.ui.View(timeout=120)
        view.add_item(HelpSelect(self.bot))

        embed = discord.Embed(
            title="Polaris",
            description=(
                "Snowball arena with RPG mechanics.\n\n"
                "`/throw`  Attack someone\n"
                "`/stats`  View profile\n"
                "`/daily`  Daily reward\n"
                "`/shop`  Buy items\n"
                "`/inventory`  Equip weapons"
            ),
            color=discord.Color.from_rgb(88, 101, 242),
        )
        embed.set_footer(text="Select below for more info")
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)


class PolarisBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True
        super().__init__(command_prefix="!", intents=intents, help_command=None)
        self.synced = False

    async def setup_hook(self):
        logger.info("Setting up Polaris...")
        await GameDatabase.initialize()
        await self.add_cog(SnowballEngine(self))
        await self.add_cog(KrampusModerator(self))
        await self.add_cog(NorthPoleAI(self))
        await self.add_cog(Dashboard(self))
        await self.add_cog(General(self))

    async def on_ready(self):
        logger.info(f"Logged in as {self.user} (ID: {self.user.id})")

        if not self.synced:
            try:
                synced = await self.tree.sync()
                logger.info(
                    f"✅ Slash commands synced globally ({len(synced)} commands)"
                )
            except Exception as e:
                logger.error(f"Global sync failed: {e}")

            if ENV_GUILD_ID:
                try:
                    guild = discord.Object(id=int(ENV_GUILD_ID))
                    self.tree.copy_global_to(guild=guild)
                    await self.tree.sync(guild=guild)
                    logger.info(f"✅ Slash commands synced to Dev Guild {ENV_GUILD_ID}")
                except Exception as e:
                    logger.error(f"Dev Guild sync failed: {e}")

            self.synced = True

        logger.info("❄️ Polaris v2.0 is online and ready!")

    async def on_command_error(self, ctx, error):
        """Global error handler for prefix commands."""
        logger.error(f"Command error: {error}")

    async def on_app_command_error(self, interaction: discord.Interaction, error):
        """Global error handler for slash commands."""
        logger.error(
            f"Slash command error in /{interaction.command.name if interaction.command else 'unknown'}: {error}"
        )
        try:
            if interaction.response.is_done():
                await interaction.followup.send(
                    "An error occurred. Please try again.", ephemeral=True
                )
            else:
                await interaction.response.send_message(
                    "An error occurred. Please try again.", ephemeral=True
                )
        except Exception:
            pass


if __name__ == "__main__":
    if not DISCORD_TOKEN:
        logger.error("Error: DISCORD_TOKEN not found in .env")
    else:
        bot = PolarisBot()
        bot.run(DISCORD_TOKEN)
