#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Match models - Definitions for matches, results, and WebSocket messages.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# None

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# MatchState: Enum for match lifecycle.
# GameMode: Enum for Ranked vs Training.
# PlayerResult: Dataclass for individual player stats in a match.
# Match: Dataclass for the full match object.
# MatchResult: Dataclass for the final result sent to clients.
# ClientMessage: Base class for messages from client.
# JoinQueueMessage: Client joining queue.
# LeaveQueueMessage: Client leaving queue.
# JoinTrainingQueueMessage: Client joining training queue.
# KeystrokeMessage: Client typing event.
# WordCompleteMessage: Client word completion event.
# ServerMessage: Base class for messages from server.
# QueueUpdateMessage: Server update on queue status.
# MatchFoundMessage: Server notification of match found.
# GameStartMessage: Server signal to start game.
# OpponentProgressMessage: Server update on opponent progress.
# GameEndMessage: Server notification of game end.
# ErrorMessage: Server error message.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# pydantic: Data validation.
# datetime: Time handling.
# typing: Type hints.
# enum: Enumerations.

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal, List
from enum import Enum


class MatchState(str, Enum):
    """Match state machine"""
    PREPARING = "preparing"  # Session created, waiting for callbacks to be registered
    WAITING = "waiting"  # Both players ready, waiting for first keystroke
    ACTIVE = "active"
    FINISHED = "finished"


class GameMode(str, Enum):
    """Game mode - ranked affects ELO, training does not"""
    RANKED = "ranked"
    TRAINING = "training"


class PlayerResult(BaseModel):
    """Individual player result in a match"""
    uid: str
    is_bot: bool = False
    wpm: float = 0.0
    accuracy: float = 0.0
    score: float = 0.0  # wpm * accuracy
    elo_before: int = 0
    elo_after: int = 0
    elo_change: int = 0
    chars_typed: int = 0
    words_completed: int = 0
    errors: int = 0


class Match(BaseModel):
    """Complete match model"""
    id: str
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration: int = 30  # seconds
    state: MatchState = MatchState.PREPARING
    game_mode: GameMode = GameMode.RANKED  # Training mode doesn't affect ELO
    
    words: List[str] = []
    
    player1: PlayerResult
    player2: PlayerResult
    
    winner_uid: Optional[str] = None  # None = tie, "BOT" = bot won


class MatchResult(BaseModel):
    """Match result sent to client"""
    match_id: str
    duration: int
    game_mode: str = "ranked"  # 'ranked' or 'training'
    
    # Your stats
    your_wpm: float
    your_accuracy: float
    your_score: float
    your_elo_before: int
    your_elo_after: int
    your_elo_change: int
    
    # Opponent stats
    opponent_display_name: str
    opponent_photo_url: Optional[str] = None
    opponent_is_bot: bool
    opponent_wpm: float
    opponent_accuracy: float
    opponent_score: float
    opponent_rank: str
    opponent_elo: int
    opponent_elo_change: int = 0
    opponent_cursor: str = "default"
    
    # Result
    result: Literal["win", "loss", "tie"]
    coins_earned: int = 0
    base_coins: int = 0
    rank_bonus_coins: int = 0
    leaderboard_bonus_coins: int = 0


# WebSocket Message Types

class ClientMessage(BaseModel):
    """Base client message"""
    type: str


class JoinQueueMessage(ClientMessage):
    """Client joining matchmaking queue"""
    type: Literal["JOIN_QUEUE"] = "JOIN_QUEUE"


class LeaveQueueMessage(ClientMessage):
    """Client leaving matchmaking queue"""
    type: Literal["LEAVE_QUEUE"] = "LEAVE_QUEUE"


class JoinTrainingQueueMessage(ClientMessage):
    """Client joining training queue (no ELO changes)"""
    type: Literal["JOIN_TRAINING_QUEUE"] = "JOIN_TRAINING_QUEUE"


class KeystrokeMessage(ClientMessage):
    """Client keystroke event"""
    type: Literal["KEYSTROKE"] = "KEYSTROKE"
    char: str
    timestamp: int  # Unix timestamp in ms
    char_index: int  # Position in the word sequence


class WordCompleteMessage(ClientMessage):
    """Client word completion event"""
    type: Literal["WORD_COMPLETE"] = "WORD_COMPLETE"
    word: str
    word_index: int
    timestamp: int


class ServerMessage(BaseModel):
    """Base server message"""
    type: str


class QueueUpdateMessage(ServerMessage):
    """Queue status update"""
    type: Literal["QUEUE_UPDATE"] = "QUEUE_UPDATE"
    position: int
    elapsed: int  # seconds in queue


class MatchFoundMessage(ServerMessage):
    """Match found notification"""
    type: Literal["MATCH_FOUND"] = "MATCH_FOUND"
    match_id: str
    opponent_display_name: str
    opponent_photo_url: Optional[str] = None
    opponent_rank: str
    opponent_elo: int = 0
    opponent_is_bot: bool
    words: List[str]
    game_mode: str = "ranked"  # 'ranked' or 'training'
    opponent_is_bot: bool
    words: List[str]
    game_mode: str = "ranked"
    opponent_cursor: str = "default"
    opponent_effect: Optional[str] = None


class GameStartMessage(ServerMessage):
    """Game start signal"""
    type: Literal["GAME_START"] = "GAME_START"
    timestamp: int  # Unix timestamp when game starts
    duration: int  # Game duration in seconds


class OpponentProgressMessage(ServerMessage):
    """Opponent typing progress"""
    type: Literal["OPPONENT_PROGRESS"] = "OPPONENT_PROGRESS"
    char_index: int
    word_index: int


class GameEndMessage(ServerMessage):
    """Game end with results"""
    type: Literal["GAME_END"] = "GAME_END"
    result: MatchResult


class ErrorMessage(ServerMessage):
    """Error message"""
    type: Literal["ERROR"] = "ERROR"
    code: str
    message: str
