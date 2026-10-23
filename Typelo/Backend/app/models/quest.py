#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Quest models - Definitions for daily and weekly quest system.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# (None - this file defines only models and enums)

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# QuestType: Enum for quest types (daily, weekly).
# QuestDefinition: Template for a quest with id, name, description, reward, target.
# UserQuest: User's active quest instance with progress tracking.
# DAILY_QUEST_POOL: List of all possible daily quests.
# WEEKLY_QUEST_POOL: List of all possible weekly quests.

# --------------------------------------------------------------------------
#                                   Imports
# --------------------------------------------------------------------------
# pydantic: Data validation and models.
# enum: Enumerations for quest types.
# typing: Type hints.

from pydantic import BaseModel
from enum import Enum
from typing import Optional
from datetime import datetime


class QuestType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"


class QuestCategory(str, Enum):
    WINS = "wins"
    MATCHES = "matches"
    WPM = "wpm"
    ACCURACY = "accuracy"
    STREAK = "streak"
    TRAINING = "training"
    LOGIN = "login"
    INVITE = "invite"


class QuestDefinition(BaseModel):
    id: str
    name: str
    description: str
    reward: int
    target: int
    category: QuestCategory
    quest_type: QuestType


class UserQuest(BaseModel):
    quest_id: str
    name: str
    description: str
    reward: int
    target: int
    progress: int = 0
    category: QuestCategory
    quest_type: QuestType
    claimed: bool = False
    assigned_at: datetime


DAILY_QUEST_POOL: list[QuestDefinition] = [
    QuestDefinition(
        id="daily_win_1",
        name="First Victory",
        description="Win 1 match",
        reward=25,
        target=1,
        category=QuestCategory.WINS,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_match_2",
        name="Warm Up",
        description="Play 2 matches",
        reward=15,
        target=2,
        category=QuestCategory.MATCHES,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_match_5",
        name="Active Player",
        description="Play 5 matches",
        reward=30,
        target=5,
        category=QuestCategory.MATCHES,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_wpm_50",
        name="Speed Demon",
        description="Achieve 50+ WPM in a match",
        reward=15,
        target=50,
        category=QuestCategory.WPM,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_wpm_80",
        name="Typing Pro",
        description="Achieve 80+ WPM in a match",
        reward=25,
        target=80,
        category=QuestCategory.WPM,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_accuracy_95",
        name="Precision",
        description="Get 95%+ accuracy in a match",
        reward=20,
        target=95,
        category=QuestCategory.ACCURACY,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_accuracy_100",
        name="Perfectionist",
        description="Get 100% accuracy in a match",
        reward=40,
        target=100,
        category=QuestCategory.ACCURACY,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_win_streak_2",
        name="Hot Streak",
        description="Win 2 matches in a row",
        reward=35,
        target=2,
        category=QuestCategory.STREAK,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_practice",
        name="Training Day",
        description="Complete 1 training match",
        reward=10,
        target=1,
        category=QuestCategory.TRAINING,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_login",
        name="Daily Check-In",
        description="Log in today",
        reward=10,
        target=1,
        category=QuestCategory.LOGIN,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_wpm_90",
        name="Speed King",
        description="Achieve 90+ WPM in a match",
        reward=40,
        target=90,
        category=QuestCategory.WPM,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_matches_3",
        name="Dedicated",
        description="Play 3 matches",
        reward=20,
        target=3,
        category=QuestCategory.MATCHES,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_wins_3",
        name="Victor",
        description="Win 3 matches",
        reward=50,
        target=3,
        category=QuestCategory.WINS,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_accuracy_98",
        name="Sharp Shooter",
        description="Get 98%+ accuracy in a match",
        reward=30,
        target=98,
        category=QuestCategory.ACCURACY,
        quest_type=QuestType.DAILY
    ),
    QuestDefinition(
        id="daily_wpm_60",
        name="Fast Fingers",
        description="Achieve 60+ WPM in a match",
        reward=20,
        target=60,
        category=QuestCategory.WPM,
        quest_type=QuestType.DAILY
    ),
]

WEEKLY_QUEST_POOL: list[QuestDefinition] = [
    QuestDefinition(
        id="weekly_wins_5",
        name="Champion",
        description="Win 5 matches",
        reward=150,
        target=5,
        category=QuestCategory.WINS,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_wins_10",
        name="Dominator",
        description="Win 10 matches",
        reward=250,
        target=10,
        category=QuestCategory.WINS,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_matches_10",
        name="Dedicated Player",
        description="Play 10 matches",
        reward=120,
        target=10,
        category=QuestCategory.MATCHES,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_matches_20",
        name="Marathon Runner",
        description="Play 20 matches",
        reward=200,
        target=20,
        category=QuestCategory.MATCHES,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_wpm_70",
        name="Speed Master",
        description="Achieve 70+ WPM in 5 matches",
        reward=180,
        target=5,
        category=QuestCategory.WPM,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_accuracy_95",
        name="Steady Hands",
        description="Get 95%+ accuracy in 5 matches",
        reward=150,
        target=5,
        category=QuestCategory.ACCURACY,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_perfect_3",
        name="Triple Perfect",
        description="Get 100% accuracy in 3 matches",
        reward=300,
        target=3,
        category=QuestCategory.ACCURACY,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_invite_1",
        name="Social Butterfly",
        description="Invite 1 friend who signs up",
        reward=150,
        target=1,
        category=QuestCategory.INVITE,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_invite_3",
        name="Recruiter",
        description="Invite 3 friends who sign up",
        reward=350,
        target=3,
        category=QuestCategory.INVITE,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_win_streak_5",
        name="Unstoppable",
        description="Achieve a 5 win streak",
        reward=250,
        target=5,
        category=QuestCategory.STREAK,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_wins_25",
        name="Grand Champion",
        description="Win 25 matches",
        reward=500,
        target=25,
        category=QuestCategory.WINS,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_matches_50",
        name="Ultra Marathon",
        description="Play 50 matches",
        reward=450,
        target=50,
        category=QuestCategory.MATCHES,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_invite_5",
        name="Community Builder",
        description="Invite 5 friends who sign up",
        reward=600,
        target=5,
        category=QuestCategory.INVITE,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_win_streak_10",
        name="Legendary Streak",
        description="Achieve a 10 win streak",
        reward=800,
        target=10,
        category=QuestCategory.STREAK,
        quest_type=QuestType.WEEKLY
    ),
    QuestDefinition(
        id="weekly_perfect_10",
        name="Ten Flawless",
        description="Get 100% accuracy in 10 matches",
        reward=600,
        target=10,
        category=QuestCategory.ACCURACY,
        quest_type=QuestType.WEEKLY
    ),
]
