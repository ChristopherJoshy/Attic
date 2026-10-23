#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Constants - Centralized configuration values and magic numbers.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# None

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# WORD_COUNT: Number of words per game.
# GAME_DURATION_SECONDS: Match duration.
# AUTO_START_DELAY_SECONDS: Delay before synchronized start.
# NOTIFY_MAX_RETRIES: Retry limit for WS notifications.
# ELO_DEFAULT: Starting Elo.
# ... (various other constants)

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# None


# Game Configuration
WORD_COUNT = 50  # Number of words generated per match
GAME_DURATION_SECONDS = 30  # Default match duration
AUTO_START_DELAY_SECONDS = 3.0  # Delay before auto-starting game
TIMER_BUFFER_SECONDS = 5  # Buffer for frontend countdown animation
PROGRESS_THROTTLE_CHARS = 3  # Send opponent progress every N characters

# Matchmaking
MATCHMAKING_SEARCH_INTERVAL = 0.5  # Polling interval for finding matches
TRAINING_QUEUE_TIMEOUT_SECONDS = 5  # Timeout before creating training bot match
CALLBACK_WAIT_TIMEOUT_SECONDS = 15.0  # Max wait for player callbacks
PENDING_MATCH_STALE_THRESHOLD_SECONDS = 120  # 2 minutes
PENDING_MATCH_CLEANUP_INTERVAL_SECONDS = 60  # 1 minute

# WebSocket
WS_RATE_LIMIT_WINDOW_SECONDS = 1.0
WS_MAX_MESSAGES_PER_WINDOW = 50
WS_DISPLAY_NAME_MAX_LENGTH = 100
WS_ELO_MIN = 0
WS_ELO_MAX = 50000

# Retry Logic
NOTIFY_MAX_RETRIES = 3
NOTIFY_RETRY_DELAY_SECONDS = 0.3
NOTIFY_TIMEOUT_SECONDS = 3.0
GAME_END_NOTIFY_TIMEOUT_SECONDS = 5.0

# Anti-Cheat
MIN_KEYSTROKE_LATENCY_MS = 10  # Minimum allowed latency (relaxed from 20ms)
MAX_WPM_THRESHOLD = 250  # Maximum WPM before flagging
KEYSTROKE_VARIANCE_THRESHOLD = 0.1  # Minimum coefficient of variation

# Elo System
ELO_DEFAULT = 1000
ELO_RD_DEFAULT = 200.0  # Rating deviation
ELO_VOLATILITY_DEFAULT = 0.06
ELO_MAX_CHANGE_PER_MATCH = 50
ELO_BOT_MATCH_MODIFIER = 0.7  # 30% reduction for bot matches
ELO_TIER_SCALE_THRESHOLD = 2000  # Apply tier scaling above this

# Rank Thresholds
RANK_UNRANKED_MAX = 999
RANK_BRONZE_MAX = 1999
RANK_GOLD_MAX = 2999
RANK_PLATINUM_MAX = 9999
# Above PLATINUM_MAX = Ranker

# Forfeit Penalties
FORFEIT_ELO_PENALTY = 10
FORFEIT_ELO_REWARD = 10

# MongoDB
MONGODB_MAX_POOL_SIZE = 50
MONGODB_MIN_POOL_SIZE = 10
MONGODB_SERVER_SELECTION_TIMEOUT_MS = 5000

# Cursor System - 39 Total Cursors
CURSORS = {
    # Common (8)
    "default": {"name": "Default", "color": "#f43f5e", "glow": "#f43f5e", "rarity": "common"},
    "ocean": {"name": "Ocean Wave", "color": "#06b6d4", "glow": "#0891b2", "rarity": "common"},
    "forest": {"name": "Forest", "color": "#22c55e", "glow": "#16a34a", "rarity": "common"},
    "crimson": {"name": "Crimson Blade", "color": "#dc2626", "glow": "#b91c1c", "rarity": "common"},
    "mint": {"name": "Fresh Mint", "color": "#4ade80", "glow": "#22c55e", "rarity": "common"},
    "sky": {"name": "Sky Blue", "color": "#38bdf8", "glow": "#0ea5e9", "rarity": "common"},
    "steel": {"name": "Steel Gray", "color": "#64748b", "glow": "#475569", "rarity": "common"},
    "coral": {"name": "Coral Reef", "color": "#fb7185", "glow": "#f43f5e", "rarity": "common"},
    # Uncommon (7)
    "sunset": {"name": "Sunset", "color": "#f97316", "glow": "#ea580c", "rarity": "uncommon"},
    "lavender": {"name": "Lavender", "color": "#a78bfa", "glow": "#8b5cf6", "rarity": "uncommon"},
    "peach": {"name": "Peach Blossom", "color": "#fb923c", "glow": "#f97316", "rarity": "uncommon"},
    "sapphire": {"name": "Sapphire", "color": "#2563eb", "glow": "#1d4ed8", "rarity": "uncommon"},
    "rose": {"name": "Rose Quartz", "color": "#f472b6", "glow": "#ec4899", "rarity": "uncommon"},
    "lime": {"name": "Electric Lime", "color": "#a3e635", "glow": "#84cc16", "rarity": "uncommon"},
    "violet": {"name": "Violet Dream", "color": "#8b5cf6", "glow": "#7c3aed", "rarity": "uncommon"},
    # Rare (7)
    "galaxy": {"name": "Galaxy", "color": "#8b5cf6", "glow": "#7c3aed", "rarity": "rare"},
    "aurora": {"name": "Aurora", "color": "#34d399", "glow": "#10b981", "rarity": "rare"},
    "amber": {"name": "Amber Glow", "color": "#fbbf24", "glow": "#f59e0b", "rarity": "rare"},
    "emerald": {"name": "Emerald", "color": "#059669", "glow": "#047857", "rarity": "rare"},
    "ruby": {"name": "Ruby Flame", "color": "#e11d48", "glow": "#be123c", "rarity": "rare"},
    "cyber": {"name": "Cyber Neon", "color": "#00ff88", "glow": "#00cc66", "rarity": "rare"},
    "retro": {"name": "Retro Pixel", "color": "#ff0080", "glow": "#cc0066", "rarity": "rare"},
    # Epic (5)
    "amethyst": {"name": "Amethyst Crystal", "color": "#a855f7", "glow": "#9333ea", "rarity": "epic"},
    "diamond": {"name": "Diamond", "color": "#e2e8f0", "glow": "#cbd5e1", "rarity": "epic"},
    "obsidian": {"name": "Obsidian Dark", "color": "#1f2937", "glow": "#374151", "rarity": "epic"},
    "blood_moon": {"name": "Blood Moon", "color": "#991b1b", "glow": "#7f1d1d", "rarity": "epic"},
    "toxic": {"name": "Toxic Waste", "color": "#65a30d", "glow": "#4d7c0f", "rarity": "epic"},
    # Legendary (5)
    "golden": {"name": "Golden", "color": "#fbbf24", "glow": "#f59e0b", "rarity": "legendary"},
    "plasma": {"name": "Plasma Core", "color": "#22d3ee", "glow": "#06b6d4", "rarity": "legendary"},
    "inferno": {"name": "Inferno", "color": "#f97316", "glow": "#ea580c", "rarity": "legendary"},
    "glacier": {"name": "Glacier Ice", "color": "#67e8f9", "glow": "#22d3ee", "rarity": "legendary"},
    "hologram": {"name": "Hologram", "color": "#38bdf8", "glow": "#0ea5e9", "rarity": "legendary"},
    # Ultra (4)
    "nebula": {"name": "Nebula", "color": "#c084fc", "glow": "#a855f7", "rarity": "ultra"},
    "cosmos": {"name": "Cosmic Ray", "color": "#6366f1", "glow": "#4f46e5", "rarity": "ultra"},
    "phoenix": {"name": "Phoenix Flame", "color": "#ff6b35", "glow": "#f97316", "rarity": "ultra"},
    "quantum": {"name": "Quantum Flux", "color": "#14b8a6", "glow": "#0d9488", "rarity": "ultra"},
    # Divine (2)
    "void": {"name": "Void Walker", "color": "#18181b", "glow": "#27272a", "rarity": "divine"},
    "celestial": {"name": "Celestial", "color": "#fef08a", "glow": "#fde047", "rarity": "divine"},
    # Mythical (1)
    "rainbow": {"name": "Rainbow", "color": "rainbow", "glow": "#ec4899", "rarity": "mythical"},
}

# Effects System - 46 Total Effects
EFFECTS = {
    # Common (5)
    "bubble": {"name": "Bubble Pop", "color": "#60a5fa", "rarity": "common"},
    "leaf": {"name": "Autumn Leaves", "color": "#84cc16", "rarity": "common"},
    "dust": {"name": "Pixie Dust", "color": "#fcd34d", "rarity": "common"},
    "sparkle_mini": {"name": "Mini Sparkles", "color": "#fbbf24", "rarity": "common"},
    "dots": {"name": "Floating Dots", "color": "#a78bfa", "rarity": "common"},
    # Uncommon (6)
    "ripple": {"name": "Water Ripple", "color": "#06b6d4", "rarity": "uncommon"},
    "snow": {"name": "Snowflake", "color": "#e0f2fe", "rarity": "uncommon"},
    "hearts": {"name": "Love Hearts", "color": "#f472b6", "rarity": "uncommon"},
    "star": {"name": "Starfall", "color": "#fbbf24", "rarity": "uncommon"},
    "music": {"name": "Music Notes", "color": "#8b5cf6", "rarity": "uncommon"},
    "feather": {"name": "Feather Float", "color": "#e0e7ff", "rarity": "uncommon"},
    # Rare (6)
    "wind": {"name": "Wind Gust", "color": "#94a3b8", "rarity": "rare"},
    "thunder": {"name": "Thunder Strike", "color": "#facc15", "rarity": "rare"},
    "neon": {"name": "Neon Glow", "color": "#e879f9", "rarity": "rare"},
    "shadow": {"name": "Shadow Trail", "color": "#374151", "rarity": "rare"},
    "pixel": {"name": "Pixel Trail", "color": "#22c55e", "rarity": "rare"},
    "glitch": {"name": "Glitch Effect", "color": "#ef4444", "rarity": "rare"},
    # Epic (6)
    "ice": {"name": "Frost Trail", "color": "#7dd3fc", "rarity": "epic"},
    "lava": {"name": "Molten Lava", "color": "#f59e0b", "rarity": "epic"},
    "poison": {"name": "Toxic Cloud", "color": "#a3e635", "rarity": "epic"},
    "crystal": {"name": "Crystal Shard", "color": "#c4b5fd", "rarity": "epic"},
    "plasma_trail": {"name": "Plasma Stream", "color": "#22d3ee", "rarity": "epic"},
    "ember": {"name": "Ember Sparks", "color": "#fb923c", "rarity": "epic"},
    # Legendary (11)
    "sparkle": {"name": "Sparkle Trail", "color": "#fbbf24", "rarity": "legendary"},
    "smoke": {"name": "Smoke Trail", "color": "#9ca3af", "rarity": "legendary"},
    "fire": {"name": "Fire Trail", "color": "#ef4444", "rarity": "legendary"},
    "electric": {"name": "Electric Trail", "color": "#3b82f6", "rarity": "legendary"},
    "confetti": {"name": "Confetti Party", "color": "#ec4899", "rarity": "legendary"},
    "matrix": {"name": "Matrix Code", "color": "#22c55e", "rarity": "legendary"},
    "aurora_trail": {"name": "Aurora Wave", "color": "#2dd4bf", "rarity": "legendary"},
    "galaxy_trail": {"name": "Galaxy Swirl", "color": "#8b5cf6", "rarity": "legendary"},
    "cherry": {"name": "Cherry Blossom", "color": "#fda4af", "rarity": "legendary"},
    "gold_trail": {"name": "Golden Path", "color": "#f59e0b", "rarity": "legendary"},
    "dragon": {"name": "Dragon Breath", "color": "#ef4444", "rarity": "legendary"},
    # Ultra (7)
    "cosmic_dust": {"name": "Cosmic Dust", "color": "#a78bfa", "rarity": "ultra"},
    "lightning": {"name": "Chain Lightning", "color": "#60a5fa", "rarity": "ultra"},
    "supernova": {"name": "Supernova", "color": "#fef08a", "rarity": "ultra"},
    "void_rift": {"name": "Void Rift", "color": "#3f3f46", "rarity": "ultra"},
    "spirit": {"name": "Spirit Flame", "color": "#22d3ee", "rarity": "ultra"},
    "cyberpunk": {"name": "Cyber Circuit", "color": "#00ff88", "rarity": "ultra"},
    "timeshift": {"name": "Time Warp", "color": "#6366f1", "rarity": "ultra"},
    # Divine (5)
    "divine_light": {"name": "Divine Light", "color": "#fffbeb", "rarity": "divine"},
    "reality_tear": {"name": "Reality Tear", "color": "#f0abfc", "rarity": "divine"},
    "infinity": {"name": "Infinity Loop", "color": "#818cf8", "rarity": "divine"},
    "godray": {"name": "God Ray", "color": "#fef3c7", "rarity": "divine"},
    "singularity": {"name": "Singularity", "color": "#18181b", "rarity": "divine"},
}

# Gacha Weights - CHALLENGING Drop Rates (harder grind)
# 40% chance to get something, makes rare items truly rare
GACHA_WEIGHTS = {
    "better_luck_next_time": 60,   # 60% - No reward (challenging!)
    "common": 20,                    # 20% - Common cursor
    "common_effect": 8,              # 8% - Common effect
    "uncommon": 5,                   # 5% - Uncommon cursor
    "rare": 3,                       # 3% - Rare cursor
    "epic": 2,                       # 2% - Epic cursor
    "legendary": 1,                  # 1% - Legendary cursor
    "ultra": 0.5,                    # 0.5% - Ultra cursor
    "divine": 0.15,                  # 0.15% - Divine cursor
    "uncommon_effect": 2,            # 2% - Uncommon effect
    "rare_effect": 0.8,              # 0.8% - Rare effect
    "epic_effect": 0.3,              # 0.3% - Epic effect
    "legendary_effect": 0.1,         # 0.1% - Legendary effect
    "ultra_effect": 0.03,            # 0.03% - Ultra effect
    "divine_effect": 0.01,           # 0.01% - Divine effect
    "mythical": 0.001                # 0.001% - Rainbow cursor (1 in 100,000)
}

LUCK_BOOST_WEIGHTS = {
    "better_luck_next_time": 35,   # 35% - Still challenging even with boost
    "common": 28,                   # 28%
    "common_effect": 12,            # 12%
    "uncommon": 8,                  # 8%
    "rare": 5,                      # 5%
    "epic": 3,                      # 3%
    "legendary": 2,                 # 2%
    "ultra": 1,                     # 1%
    "divine": 0.3,                  # 0.3%
    "uncommon_effect": 3,           # 3%
    "rare_effect": 1.5,             # 1.5%
    "epic_effect": 0.8,             # 0.8%
    "legendary_effect": 0.3,        # 0.3%
    "ultra_effect": 0.1,            # 0.1%
    "divine_effect": 0.03,          # 0.03%
    "mythical": 0.005               # 0.005% - Rainbow cursor (1 in 20,000)
}

PITY_STREAK_THRESHOLD = 5  # Need 5 bad rolls to trigger luck boost (was 1)

# Coin Economy - CHALLENGING (harder grind)
SPIN_COST = 1000  # Both crates cost 1000
WIN_COIN_REWARD = 300  # Reduced from 500
LOSS_COIN_REWARD = 50  # Reduced from 100
MAX_COIN_CONSOLATION = 10  # Reduced from 20

# Daily Login Rewards (7-day cycle)
DAILY_REWARDS = {
    1: {"type": "coins", "coins": 100},
    2: {"type": "coins", "coins": 200},
    3: {"type": "effect", "effect": "dust", "coins": 50},  # Common effect + coins
    4: {"type": "coins", "coins": 300},
    5: {"type": "cursor", "cursor": "steel", "coins": 100},  # Common cursor + coins
    6: {"type": "coins", "coins": 400},
    7: {"type": "special", "luck_boost": 5, "coins": 1000},  # Luck boost for 5 spins + coins
}
DAILY_STREAK_RESET_HOURS = 48  # Reset streak if no login for 48 hours

# Bot Cursor Selection - Common cursors bot can use (excluding mythical/legendary)
BOT_CURSOR_OPTIONS = ["default", "ocean", "forest"]

def get_bot_cursor(player_cursor: str = "default") -> str:
    """Get a cursor for the bot that's different from player's cursor.
    Always picks from common cursors to avoid confusion with rare cursors.
    """
    for cursor in BOT_CURSOR_OPTIONS:
        if cursor != player_cursor:
            return cursor
    return "ocean"  # Fallback if somehow all match


# ============================================================================
# PROFILE CRATE SYSTEM
# ============================================================================

PROFILE_SPIN_COST = 1000  # Original value (streamlined)

# Profile Backgrounds - 9 Total (from Profile-bg folder)
PROFILE_BACKGROUNDS = {
    # Common (3)
    "space": {"name": "Space", "path": "/Profile-bg/Space.webp", "rarity": "common", "text_color": "light"},
    "sky": {"name": "Sky", "path": "/Profile-bg/Sky.webp", "rarity": "common", "text_color": "light"},
    "mountain": {"name": "Mountain", "path": "/Profile-bg/Mountain.webp", "rarity": "common", "text_color": "light"},
    # Uncommon (2)
    "landscape_dawn": {"name": "Landscape Dawn", "path": "/Profile-bg/Lanscape_dawn.webp", "rarity": "mythical", "text_color": "light"},
    "scary_night": {"name": "Scary Night", "path": "/Profile-bg/Scary-night.webp", "rarity": "mythical", "text_color": "light"},
    # Rare (2)
    "empty_roads": {"name": "Empty Roads", "path": "/Profile-bg/Empty_Roads.webp", "rarity": "mythical", "text_color": "light"},
    "anime_waterfall": {"name": "Anime Waterfall", "path": "/Profile-bg/anime-waterfall-scene.webp", "rarity": "mythical", "text_color": "light"},
    # Epic (1)
    "fantasy_galaxy": {"name": "Fantasy Galaxy", "path": "/Profile-bg/fantasy-style-galaxy-background.webp", "rarity": "mythical", "text_color": "light"},
    # Legendary (1)
    "mythical_dragon": {"name": "Mythical Dragon", "path": "/Profile-bg/mythical-dragon-beast-anime-style.webp", "rarity": "mythical", "text_color": "light"},
    # Rank Rewards
    "rank_bronze": {"name": "Bronze Rank", "path": "/Profile-bg/rank_bronze.png", "rarity": "common", "text_color": "light"},
    "rank_gold": {"name": "Gold Rank", "path": "/Profile-bg/rank_gold.png", "rarity": "rare", "text_color": "light"},
    "rank_platinum": {"name": "Platinum Rank", "path": "/Profile-bg/rank_platinum.png", "rarity": "epic", "text_color": "light"},
    "rank_ranker": {"name": "Ranker", "path": "/Profile-bg/rank_ranker.png", "rarity": "legendary", "text_color": "light"},
}

# Profile Effects - 50 Total (animated visual effects on profile)
PROFILE_EFFECTS = {
    # Common (12)
    "glow_soft": {"name": "Soft Glow", "color": "#ffffff", "animation": "glow", "rarity": "common"},
    "pulse_slow": {"name": "Slow Pulse", "color": "#60a5fa", "animation": "pulse", "rarity": "common"},
    "shimmer_light": {"name": "Light Shimmer", "color": "#e0e7ff", "animation": "shimmer", "rarity": "common"},
    "fade_cycle": {"name": "Fade Cycle", "color": "#a78bfa", "animation": "fade", "rarity": "common"},
    "sparkle_mini": {"name": "Mini Sparkles", "color": "#fbbf24", "animation": "sparkle", "rarity": "common"},
    "wave_gentle": {"name": "Gentle Wave", "color": "#06b6d4", "animation": "wave", "rarity": "common"},
    "float_dots": {"name": "Floating Dots", "color": "#f472b6", "animation": "float", "rarity": "common"},
    "blink_soft": {"name": "Soft Blink", "color": "#22c55e", "animation": "blink", "rarity": "common"},
    "rotate_slow": {"name": "Slow Rotate", "color": "#8b5cf6", "animation": "rotate", "rarity": "common"},
    "scale_breath": {"name": "Breathing Scale", "color": "#f97316", "animation": "scale", "rarity": "common"},
    "bounce_light": {"name": "Light Bounce", "color": "#ec4899", "animation": "bounce", "rarity": "common"},
    "sway_gentle": {"name": "Gentle Sway", "color": "#14b8a6", "animation": "sway", "rarity": "common"},
    # Uncommon (10)
    "sparkle_gold": {"name": "Golden Sparkles", "color": "#fbbf24", "animation": "sparkle", "rarity": "uncommon"},
    "pulse_neon": {"name": "Neon Pulse", "color": "#00ff88", "animation": "pulse", "rarity": "uncommon"},
    "glow_rainbow": {"name": "Rainbow Glow", "color": "rainbow", "animation": "glow", "rarity": "uncommon"},
    "shimmer_ocean": {"name": "Ocean Shimmer", "color": "#06b6d4", "animation": "shimmer", "rarity": "uncommon"},
    "wave_electric": {"name": "Electric Wave", "color": "#3b82f6", "animation": "wave", "rarity": "uncommon"},
    "float_stars": {"name": "Floating Stars", "color": "#fef08a", "animation": "float", "rarity": "uncommon"},
    "pulse_fire": {"name": "Fire Pulse", "color": "#ef4444", "animation": "pulse", "rarity": "uncommon"},
    "sparkle_cosmic": {"name": "Cosmic Sparkles", "color": "#c084fc", "animation": "sparkle", "rarity": "uncommon"},
    "glow_sunset": {"name": "Sunset Glow", "color": "#f97316", "animation": "glow", "rarity": "uncommon"},
    "shimmer_aurora": {"name": "Aurora Shimmer", "color": "#2dd4bf", "animation": "shimmer", "rarity": "uncommon"},
    # Rare (10)
    "particle_storm": {"name": "Particle Storm", "color": "#8b5cf6", "animation": "particles", "rarity": "rare"},
    "ring_expand": {"name": "Expanding Rings", "color": "#22d3ee", "animation": "rings", "rarity": "rare"},
    "lightning_flash": {"name": "Lightning Flash", "color": "#facc15", "animation": "lightning", "rarity": "rare"},
    "fire_outline": {"name": "Fire Outline", "color": "#ef4444", "animation": "fire", "rarity": "rare"},
    "ice_crystals": {"name": "Ice Crystals", "color": "#7dd3fc", "animation": "crystals", "rarity": "rare"},
    "smoke_trail": {"name": "Smoke Trail", "color": "#9ca3af", "animation": "smoke", "rarity": "rare"},
    "glitch_effect": {"name": "Glitch Effect", "color": "#10b981", "animation": "glitch", "rarity": "rare"},
    "matrix_rain": {"name": "Matrix Rain", "color": "#22c55e", "animation": "matrix", "rarity": "rare"},
    "neon_outline": {"name": "Neon Outline", "color": "#e879f9", "animation": "neon", "rarity": "rare"},
    "pixel_burst": {"name": "Pixel Burst", "color": "#fb7185", "animation": "pixels", "rarity": "rare"},
    # Epic (8)
    "plasma_field": {"name": "Plasma Field", "color": "#22d3ee", "animation": "plasma", "rarity": "epic"},
    "gravity_warp": {"name": "Gravity Warp", "color": "#6366f1", "animation": "warp", "rarity": "epic"},
    "energy_sphere": {"name": "Energy Sphere", "color": "#a855f7", "animation": "sphere", "rarity": "epic"},
    "aurora_dance": {"name": "Aurora Dance", "color": "#2dd4bf", "animation": "aurora", "rarity": "epic"},
    "fire_storm": {"name": "Fire Storm", "color": "#f97316", "animation": "firestorm", "rarity": "epic"},
    "ice_shatter": {"name": "Ice Shatter", "color": "#67e8f9", "animation": "shatter", "rarity": "epic"},
    "thunder_strike": {"name": "Thunder Strike", "color": "#fbbf24", "animation": "thunder", "rarity": "epic"},
    "shadow_shift": {"name": "Shadow Shift", "color": "#374151", "animation": "shadow", "rarity": "epic"},
    # Legendary (6)
    "supernova": {"name": "Supernova", "color": "#fef08a", "animation": "supernova", "rarity": "legendary"},
    "void_rift": {"name": "Void Rift", "color": "#18181b", "animation": "void", "rarity": "legendary"},
    "galaxy_swirl": {"name": "Galaxy Swirl", "color": "#8b5cf6", "animation": "galaxy", "rarity": "legendary"},
    "phoenix_rise": {"name": "Phoenix Rise", "color": "#ff6b35", "animation": "phoenix", "rarity": "legendary"},
    "divine_radiance": {"name": "Divine Radiance", "color": "#fffbeb", "animation": "divine", "rarity": "legendary"},
    "cosmic_explosion": {"name": "Cosmic Explosion", "color": "#c084fc", "animation": "cosmic", "rarity": "legendary"},
    # Ultra (3)
    "reality_tear": {"name": "Reality Tear", "color": "#f0abfc", "animation": "reality", "rarity": "ultra"},
    "time_warp": {"name": "Time Warp", "color": "#6366f1", "animation": "timewarp", "rarity": "ultra"},
    "singularity": {"name": "Singularity", "color": "#000000", "animation": "singularity", "rarity": "ultra"},
    # Divine (1)
    "transcendence": {"name": "Transcendence", "color": "#fef08a", "animation": "transcendence", "rarity": "divine"},
}

# Profile Borders - 50 Total (avatar border styles)
PROFILE_BORDERS = {
    # Common (12)
    "solid_white": {"name": "Classic White", "style": "solid", "color": "#ffffff", "width": 3, "rarity": "common"},
    "solid_gray": {"name": "Steel Gray", "style": "solid", "color": "#64748b", "width": 3, "rarity": "common"},
    "solid_blue": {"name": "Ocean Blue", "style": "solid", "color": "#3b82f6", "width": 3, "rarity": "common"},
    "solid_green": {"name": "Forest Green", "style": "solid", "color": "#22c55e", "width": 3, "rarity": "common"},
    "solid_red": {"name": "Crimson Red", "style": "solid", "color": "#ef4444", "width": 3, "rarity": "common"},
    "solid_purple": {"name": "Royal Purple", "style": "solid", "color": "#8b5cf6", "width": 3, "rarity": "common"},
    "solid_pink": {"name": "Rose Pink", "style": "solid", "color": "#ec4899", "width": 3, "rarity": "common"},
    "solid_orange": {"name": "Sunset Orange", "style": "solid", "color": "#f97316", "width": 3, "rarity": "common"},
    "solid_cyan": {"name": "Cyber Cyan", "style": "solid", "color": "#06b6d4", "width": 3, "rarity": "common"},
    "solid_yellow": {"name": "Golden Yellow", "style": "solid", "color": "#fbbf24", "width": 3, "rarity": "common"},
    "dashed_white": {"name": "Dashed White", "style": "dashed", "color": "#ffffff", "width": 3, "rarity": "common"},
    "dotted_white": {"name": "Dotted White", "style": "dotted", "color": "#ffffff", "width": 3, "rarity": "common"},
    # Uncommon (10)
    "double_gold": {"name": "Double Gold", "style": "double", "color": "#fbbf24", "width": 4, "rarity": "uncommon"},
    "double_silver": {"name": "Double Silver", "style": "double", "color": "#e2e8f0", "width": 4, "rarity": "uncommon"},
    "gradient_sunset": {"name": "Sunset Gradient", "style": "gradient", "colors": ["#f97316", "#ec4899"], "width": 3, "rarity": "uncommon"},
    "gradient_ocean": {"name": "Ocean Gradient", "style": "gradient", "colors": ["#06b6d4", "#3b82f6"], "width": 3, "rarity": "uncommon"},
    "gradient_forest": {"name": "Forest Gradient", "style": "gradient", "colors": ["#22c55e", "#14b8a6"], "width": 3, "rarity": "uncommon"},
    "gradient_royal": {"name": "Royal Gradient", "style": "gradient", "colors": ["#8b5cf6", "#ec4899"], "width": 3, "rarity": "uncommon"},
    "thick_neon": {"name": "Thick Neon", "style": "solid", "color": "#00ff88", "width": 5, "rarity": "uncommon"},
    "thick_violet": {"name": "Thick Violet", "style": "solid", "color": "#a855f7", "width": 5, "rarity": "uncommon"},
    "ridge_gold": {"name": "Ridge Gold", "style": "ridge", "color": "#fbbf24", "width": 4, "rarity": "uncommon"},
    "groove_blue": {"name": "Groove Blue", "style": "groove", "color": "#3b82f6", "width": 4, "rarity": "uncommon"},
    # Rare (10)
    "glow_cyan": {"name": "Glowing Cyan", "style": "glow", "color": "#22d3ee", "width": 3, "rarity": "rare"},
    "glow_pink": {"name": "Glowing Pink", "style": "glow", "color": "#ec4899", "width": 3, "rarity": "rare"},
    "glow_green": {"name": "Glowing Green", "style": "glow", "color": "#22c55e", "width": 3, "rarity": "rare"},
    "glow_gold": {"name": "Glowing Gold", "style": "glow", "color": "#fbbf24", "width": 3, "rarity": "rare"},
    "gradient_fire": {"name": "Fire Gradient", "style": "gradient", "colors": ["#ef4444", "#f97316", "#fbbf24"], "width": 4, "rarity": "rare"},
    "gradient_ice": {"name": "Ice Gradient", "style": "gradient", "colors": ["#67e8f9", "#06b6d4", "#3b82f6"], "width": 4, "rarity": "rare"},
    "gradient_cosmic": {"name": "Cosmic Gradient", "style": "gradient", "colors": ["#8b5cf6", "#c084fc", "#f0abfc"], "width": 4, "rarity": "rare"},
    "animated_pulse": {"name": "Pulsing Border", "style": "animated", "animation": "pulse", "color": "#a855f7", "width": 3, "rarity": "rare"},
    "animated_glow": {"name": "Breathing Glow", "style": "animated", "animation": "glow", "color": "#22d3ee", "width": 3, "rarity": "rare"},
    "pixelated": {"name": "Pixelated", "style": "pixelated", "color": "#22c55e", "width": 4, "rarity": "rare"},
    # Epic (8)
    "rainbow_solid": {"name": "Rainbow Border", "style": "rainbow", "width": 4, "rarity": "epic"},
    "rainbow_animated": {"name": "Animated Rainbow", "style": "rainbow_animated", "width": 4, "rarity": "epic"},
    "plasma_border": {"name": "Plasma Border", "style": "animated", "animation": "plasma", "color": "#22d3ee", "width": 4, "rarity": "epic"},
    "fire_border": {"name": "Burning Border", "style": "animated", "animation": "fire", "color": "#ef4444", "width": 4, "rarity": "epic"},
    "ice_border": {"name": "Frozen Border", "style": "animated", "animation": "ice", "color": "#67e8f9", "width": 4, "rarity": "epic"},
    "electric_border": {"name": "Electric Border", "style": "animated", "animation": "electric", "color": "#3b82f6", "width": 4, "rarity": "epic"},
    "neon_animated": {"name": "Neon Flicker", "style": "animated", "animation": "neon", "color": "#00ff88", "width": 4, "rarity": "epic"},
    "shadow_border": {"name": "Shadow Border", "style": "shadow", "color": "#18181b", "width": 5, "rarity": "epic"},
    # Legendary (6)
    "galaxy_border": {"name": "Galaxy Border", "style": "animated", "animation": "galaxy", "color": "#8b5cf6", "width": 5, "rarity": "legendary"},
    "aurora_border": {"name": "Aurora Border", "style": "animated", "animation": "aurora", "colors": ["#22c55e", "#06b6d4", "#8b5cf6"], "width": 5, "rarity": "legendary"},
    "supernova_border": {"name": "Supernova Border", "style": "animated", "animation": "supernova", "color": "#fef08a", "width": 5, "rarity": "legendary"},
    "phoenix_border": {"name": "Phoenix Border", "style": "animated", "animation": "phoenix", "color": "#ff6b35", "width": 5, "rarity": "legendary"},
    "dragon_border": {"name": "Dragon Border", "style": "animated", "animation": "dragon", "color": "#ef4444", "width": 5, "rarity": "legendary"},
    "crystal_border": {"name": "Crystal Border", "style": "animated", "animation": "crystal", "color": "#c4b5fd", "width": 5, "rarity": "legendary"},
    # Ultra (3)
    "void_border": {"name": "Void Border", "style": "animated", "animation": "void", "color": "#18181b", "width": 6, "rarity": "ultra"},
    "cosmic_rift": {"name": "Cosmic Rift", "style": "animated", "animation": "rift", "color": "#f0abfc", "width": 6, "rarity": "ultra"},
    "quantum_border": {"name": "Quantum Border", "style": "animated", "animation": "quantum", "color": "#6366f1", "width": 6, "rarity": "ultra"},
    # Divine (1)
    "divine_halo": {"name": "Divine Halo", "style": "animated", "animation": "halo", "color": "#fef08a", "width": 6, "rarity": "divine"},
}

# Profile Gacha Weights - CHALLENGING (harder grind)
# 35% chance to get something, makes profile items truly rare
PROFILE_GACHA_WEIGHTS = {
    "better_luck_next_time": 65,   # 65% - No reward (challenging!)
    "common_bg": 10,               # 10% - Common background
    "common_effect": 12,           # 12% - Common profile effect
    "common_border": 8,            # 8% - Common border
    "uncommon_bg": 2,              # 2% - Uncommon background
    "rare_bg": 0.8,                # 0.8% - Rare background
    "epic_bg": 0.3,                # 0.3% - Epic background
    "legendary_bg": 0.1,           # 0.1% - Legendary background
    "mythical_bg": 0.01,           # 0.01% - Mythical background
    "uncommon_effect": 3,          # 3% - Uncommon profile effect
    "rare_effect": 1.2,            # 1.2% - Rare profile effect
    "epic_effect": 0.5,            # 0.5% - Epic profile effect
    "legendary_effect": 0.2,       # 0.2% - Legendary profile effect
    "ultra_effect": 0.06,          # 0.06% - Ultra profile effect
    "divine_effect": 0.015,        # 0.015% - Divine profile effect
    "uncommon_border": 2,          # 2% - Uncommon border
    "rare_border": 0.8,            # 0.8% - Rare border
    "epic_border": 0.3,            # 0.3% - Epic border
    "legendary_border": 0.15,      # 0.15% - Legendary border
    "ultra_border": 0.05,          # 0.05% - Ultra border
    "divine_border": 0.015,        # 0.015% - Divine border
}

PROFILE_PITY_STREAK_THRESHOLD = 7  # Need 7 bad rolls to trigger luck boost (was 3)

PROFILE_LUCK_BOOST_WEIGHTS = {
    "better_luck_next_time": 40,  # 40% - Still challenging even with boost
    "common_bg": 15,              # 15%
    "common_effect": 18,          # 18%
    "common_border": 12,          # 12%
    "uncommon_bg": 4,             # 4%
    "rare_bg": 2,                 # 2%
    "epic_bg": 0.8,               # 0.8%
    "legendary_bg": 0.3,          # 0.3%
    "mythical_bg": 0.03,          # 0.03% - Mythical background with luck
    "uncommon_effect": 5,         # 5%
    "rare_effect": 2.5,           # 2.5%
    "epic_effect": 1.2,           # 1.2%
    "legendary_effect": 0.5,      # 0.5%
    "ultra_effect": 0.15,         # 0.15%
    "divine_effect": 0.05,        # 0.05%
    "uncommon_border": 4,         # 4%
    "rare_border": 2,             # 2%
    "epic_border": 0.8,           # 0.8%
    "legendary_border": 0.35,     # 0.35%
    "ultra_border": 0.12,         # 0.12%
    "divine_border": 0.05,        # 0.05%
}
