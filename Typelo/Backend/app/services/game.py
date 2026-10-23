#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Game state management service - Handles active game sessions, keystrokes, and results.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# GameService.create_session: Creates or retrieves an active game session.
# GameService.get_session: Retrieves session by match ID.
# GameService.get_active_match_id: Finds active match ID for a user.
# GameService.get_session_by_player: Finds session by player UID.
# GameService.start_game: Initiates the game start sequence (synchronized start).
# GameService._run_bot: Internal coroutine to run the bot for bot matches.
# GameService._game_timer: Internal coroutine to enforce match duration limits.
# GameService.process_keystroke: Validates and processes a player's keystroke.
# GameService.process_word_complete: Handling for word completion events.
# GameService.register_callbacks: Registers WebSocket callbacks for game events.
# GameService.end_game: Ends game, calculates results/Elo, and saves stats.
# GameService._save_match_to_db: Persists match results to MongoDB.
# GameService._cleanup_session: Removes session from memory.
# GameService._forfeit_match: Handles forfeits due to disconnects or timeouts.
# GameService.handle_player_disconnect: Public entry point for disconnect handling.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# logger: Logger instance.
# PlayerState: Dataclass tracking runtime state of a player.
# GameSession: Dataclass representing an active match.
# GameService: Singleton service class.
# game_service: Singleton instance.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# asyncio: Async I/O.
# uuid: UUID generation.
# datetime, timezone: Time handling.
# typing: Type hints.
# dataclasses: Data structures.
# logging: Logging.
# app.models.match: Match models/enums.
# app.models.user: User models/enums.
# app.models.elo: Elo calculator.
# app.services.bot: Bot service.
# app.services.anticheat: Anti-cheat service.
# app.utils.words: Word list generation.
# app.utils.retry: Retry logic.
# app.config.get_settings: App settings.
# app.constants: Game constants.

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, List, Callable, Awaitable
from dataclasses import dataclass, field
import logging

from app.models.match import Match, MatchState, PlayerResult, MatchResult, GameMode, GameStartMessage, GameEndMessage
from app.models.user import Rank, get_rank_from_elo
from app.models.elo import elo_calculator, Rating
from app.services.bot import TypingBot, create_bot_for_player
from app.services.anticheat import anti_cheat_service, Keystroke
from app.utils.words import generate_word_list
from app.utils.retry import notify_with_retry
from app.config import get_settings
from app.constants import (
    WORD_COUNT,
    NOTIFY_TIMEOUT_SECONDS,
    GAME_END_NOTIFY_TIMEOUT_SECONDS,
    WIN_COIN_REWARD,
    LOSS_COIN_REWARD
)

# Leaderboard Bonus Constants
LEADERBOARD_TOP_N = 10
LEADERBOARD_TOP_3 = 3
LEADERBOARD_COIN_BONUS = 0.20  # 20% extra coins for top 4-10
TOP_3_COIN_BONUS = 0.50  # 50% extra coins for top 3 players

logger = logging.getLogger(__name__)


async def get_leaderboard_coin_bonus(firebase_uid: str) -> float:
    """Get coin bonus rate based on leaderboard position.
    Top 3: 50%, Top 4-10: 20%, Others: 0%
    """
    from app.database import Database
    db = Database.get_db()
    
    # Get top 10 players by elo_rating
    top_players_cursor = db.users.find(
        {},
        {"firebase_uid": 1}
    ).sort("elo_rating", -1).limit(LEADERBOARD_TOP_N)
    
    top_player_uids = [p["firebase_uid"] async for p in top_players_cursor]
    
    if firebase_uid not in top_player_uids:
        return 0.0
    
    position = top_player_uids.index(firebase_uid) + 1
    if position <= LEADERBOARD_TOP_3:
        return TOP_3_COIN_BONUS  # 50% for top 3
    else:
        return LEADERBOARD_COIN_BONUS  # 20% for top 4-10


async def is_top_leaderboard_player(firebase_uid: str) -> bool:
    """Check if user is in top 10 leaderboard (legacy helper)"""
    bonus = await get_leaderboard_coin_bonus(firebase_uid)
    return bonus > 0


@dataclass
class PlayerState:
    """Runtime state for a player in a match"""
    uid: str
    display_name: str
    photo_url: Optional[str]
    elo: int
    rank: Rank
    is_bot: bool = False
    
    # Typing progress
    keystrokes: List[Keystroke] = field(default_factory=list)
    current_char_index: int = 0
    current_word_index: int = 0
    chars_typed: int = 0
    words_completed: int = 0
    errors: int = 0
    
    # Deduplication: track last processed char_index to prevent duplicates
    last_processed_char_index: int = -1
    
    # Calculated stats
    wpm: float = 0.0
    accuracy: float = 0.0
    score: float = 0.0


@dataclass
class GameSession:
    """Active game session"""
    match_id: str
    state: MatchState
    words: List[str]
    word_text: str  # Concatenated words with spaces
    duration: int
    
    player1: PlayerState
    player2: PlayerState
    
    is_training: bool = False  # Training mode - no ELO changes
    is_friends_mode: bool = False  # Friends mode - casual play, no ELO changes
    
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    
    bot: Optional[TypingBot] = None
    
    # Timer guard to prevent multiple timer tasks
    _timer_started: bool = False
    _bot_started: bool = False
    
    # Callbacks
    _on_opponent_progress: Dict[str, Callable[[int, int], Awaitable[None]]] = field(default_factory=dict)
    _on_game_end: Dict[str, Callable[[MatchResult], Awaitable[None]]] = field(default_factory=dict)
    _on_game_start: Dict[str, Callable[[int, int], Awaitable[None]]] = field(default_factory=dict)


class GameService:
    """
    Manages active game sessions.
    
    Responsibilities:
    - Create and track game sessions
    - Process player input
    - Calculate results
    - Coordinate with bot service
    """
    
    def __init__(self):
        self.settings = get_settings()
        self._sessions: Dict[str, GameSession] = {}
        self._player_sessions: Dict[str, str] = {}  # uid -> match_id
        # Prevent simultaneous start_game calls for same match
        self._starting_matches: set[str] = set()
        # Lock for thread-safe session creation
        self._session_lock = asyncio.Lock()
    
    async def create_session(
        self,
        match_id: str,
        player1_uid: str,
        player1_name: str,
        player1_photo: Optional[str],
        player1_elo: int,
        player2_uid: Optional[str] = None,
        player2_name: Optional[str] = None,
        player2_photo: Optional[str] = None,
        player2_elo: int = 0,
        is_bot_match: bool = False,
        is_training: bool = False,
        is_friends_mode: bool = False,
        player1_avg_wpm: float = 0
    ) -> GameSession:
        """Create a new game session (thread-safe with asyncio lock)"""
        async with self._session_lock:
            # Return existing session if it already exists (avoid duplicate creation)
            if match_id in self._sessions:
                logger.debug(f"Session {match_id} already exists, returning existing session")
                return self._sessions[match_id]
            
            words = generate_word_list(WORD_COUNT)
            word_text = " ".join(words)
            
            player1 = PlayerState(
                uid=player1_uid,
                display_name=player1_name,
                photo_url=player1_photo,
                elo=player1_elo,
                rank=get_rank_from_elo(player1_elo)
            )
            
            if is_bot_match:
                # Fetch player's avg WPM from database if not provided
                avg_wpm = player1_avg_wpm
                if avg_wpm == 0:
                    try:
                        from app.database import Database
                        db = Database.get_db()
                        user = await db.users.find_one({"firebase_uid": player1_uid})
                        if user:
                            avg_wpm = user.get("avg_wpm", 0)
                    except Exception as e:
                        logger.warning(f"Failed to fetch player avg WPM: {e}")
                
                bot_name = "Bot"
                player2 = PlayerState(
                    uid="BOT",
                    display_name=bot_name,
                    photo_url=None,
                    elo=player1_elo,  # Match player's Elo
                    rank=get_rank_from_elo(player1_elo),
                    is_bot=True
                )
                bot = create_bot_for_player(player1_elo, words, avg_wpm)
            else:
                player2 = PlayerState(
                    uid=player2_uid or "",
                    display_name=player2_name or "Unknown",
                    photo_url=player2_photo,
                    elo=player2_elo,
                    rank=get_rank_from_elo(player2_elo)
                )
                bot = None
            
            session = GameSession(
                match_id=match_id,
                state=MatchState.PREPARING,  # Start in PREPARING, transition to WAITING after callbacks registered
                words=words,
                word_text=word_text,
                duration=self.settings.match_duration_seconds,
                player1=player1,
                player2=player2,
                is_training=is_training,
                is_friends_mode=is_friends_mode,
                bot=bot
            )
            
            self._sessions[match_id] = session
            self._player_sessions[player1_uid] = match_id
            if player2_uid:
                self._player_sessions[player2_uid] = match_id
            
            return session
    
    def get_session(self, match_id: str) -> Optional[GameSession]:
        """Get a game session by ID"""
        return self._sessions.get(match_id)

    def get_active_match_id(self, user_uid: str) -> Optional[str]:
        """Get active match ID for a user"""
        return self._player_sessions.get(user_uid)
    
    def get_session_by_player(self, uid: str) -> Optional[GameSession]:
        """Get a game session by player ID"""
        match_id = self._player_sessions.get(uid)
        if match_id:
            return self._sessions.get(match_id)
        return None
    
    async def start_game(self, match_id: str) -> None:
        """Prepare game session (game starts on first keystroke)"""
        if match_id in self._starting_matches:
            logger.debug(f"Game session {match_id} already starting via another task")
            return

        session = self._sessions.get(match_id)
        if not session:
            return
        
        # Only prepare the session once (avoid duplicate calls)
        if session.started_at is not None:
            logger.debug(f"Game session {match_id} already prepared, skipping")
            return
        
        # Lock this match ID
        self._starting_matches.add(match_id)
        
        try:
            # For PvP matches, wait for both players to register callbacks
            if not session.player2.is_bot:
                max_wait = 15.0  # 15 seconds for callback registration
                wait_interval = 0.2  # Check more frequently
                waited = 0.0
                
                logger.info(f"Waiting for both players to register callbacks for match {match_id}")
                logger.info(f"  Player 1: {session.player1.uid}, Player 2: {session.player2.uid}")
                
                while waited < max_wait:
                    # Check if both players have registered their callbacks
                    p1_ready = session.player1.uid in session._on_game_start
                    p2_ready = session.player2.uid in session._on_game_start
                    
                    if p1_ready and p2_ready:
                        logger.info(f"Both players ready for match {match_id} (waited {waited:.1f}s)")
                        break
                    
                    # Log progress every 2 seconds
                    if waited > 0 and waited % 2.0 < wait_interval:
                        logger.info(f"Still waiting for callbacks in {match_id}: p1_ready={p1_ready}, p2_ready={p2_ready}, waited={waited:.1f}s")
                    
                    await asyncio.sleep(wait_interval)
                    waited += wait_interval
                
                if waited >= max_wait:
                    # Log which player(s) didn't register
                    p1_ready = session.player1.uid in session._on_game_start
                    p2_ready = session.player2.uid in session._on_game_start
                    logger.warning(f"Timeout waiting for players in match {match_id}. p1_ready={p1_ready}, p2_ready={p2_ready}")
                    
                    # If one or both players didn't connect, forfeit the match
                    if not p1_ready and not p2_ready:
                        logger.error(f"Both players failed to register for match {match_id}")
                        await self._forfeit_match(match_id, None)  # Both forfeit
                        return
                    elif not p1_ready:
                        logger.warning(f"Player 1 not ready, forfeiting for {match_id}")
                        await self._forfeit_match(match_id, session.player1.uid)
                        return
                    elif not p2_ready:
                        logger.warning(f"Player 2 not ready, forfeiting for {match_id}")
                        await self._forfeit_match(match_id, session.player2.uid)
                        return
            
            # Mark as started AFTER callbacks are confirmed registered
            # Synchronized Start: Schedule game start for the future (5 seconds from now)
            # This ensures both players have time to receive the message and start their local countdowns.
            current_time = datetime.now(timezone.utc)
            start_delay_seconds = 5
            scheduled_start_time = datetime.fromtimestamp(current_time.timestamp() + start_delay_seconds, timezone.utc)
            
            session.started_at = current_time # This tracks when the session was created/ready
            session.state = MatchState.WAITING
            
            logger.info(f"Game session ready: {match_id}. Scheduling start at {scheduled_start_time} (in {start_delay_seconds}s)")
            
            # Timestamp in milliseconds for the frontend
            start_timestamp_ms = int(scheduled_start_time.timestamp() * 1000)
            
            # 1. Notify players immediately with the FUTURE start timestamp
            async def notify_start(uid: str) -> bool:
                if uid not in session._on_game_start or uid == "BOT":
                    return True
                return await notify_with_retry(
                    session._on_game_start[uid],
                    start_timestamp_ms, 
                    session.duration,
                    label=f"GAME_START for {uid} (scheduled)"
                )
            
            results = await asyncio.gather(
                notify_start(session.player1.uid),
                notify_start(session.player2.uid),
                return_exceptions=True
            )
            successful = sum(1 for r in results if r is True)
            logger.info(f"GAME_START scheduled delivered to {successful}/2 players for {match_id}")

            # 2. Schedule the actual state transition and timer start on the backend
            async def scheduled_start():
                await asyncio.sleep(start_delay_seconds)
                
                if session.state != MatchState.WAITING:
                    logger.warning(f"Aborting scheduled start for {match_id} - state is {session.state}")
                    return

                logger.info(f"Executing scheduled start for game {match_id}")
                session.state = MatchState.ACTIVE
                
                # Start Bot (if applicable)
                if session.bot and not session._bot_started:
                    session._bot_started = True
                    asyncio.create_task(self._run_bot(session))
                
                # Start Timer
                if not session._timer_started:
                    session._timer_started = True
                    asyncio.create_task(self._game_timer(session))
                
                # Broadcast public start
                try:
                    from app.routers.match import manager
                    await manager.broadcast_match_started(
                        match_id=match_id,
                        player1_name=session.player1.display_name,
                        player1_photo=session.player1.photo_url,
                        player2_name=session.player2.display_name,
                        player2_photo=session.player2.photo_url,
                        is_bot_match=session.player2.is_bot,
                        game_mode="training" if session.is_training else ("friends" if session.is_friends_mode else "ranked")
                    )
                except Exception as e:
                    logger.warning(f"Failed to broadcast match started: {e}")

            # Launch the scheduler
            asyncio.create_task(scheduled_start())
            
        finally:
            self._starting_matches.discard(match_id)
            
    async def _run_bot(self, session: GameSession) -> None:
        """Run the bot for a bot match"""
        if not session.bot:
            return
        
        async def on_bot_progress(char_index: int, word_index: int):
            # Update bot's position
            session.player2.current_char_index = char_index
            session.player2.current_word_index = word_index
            session.player2.words_completed = word_index
            
            # Calculate total chars typed for tracking
            total_chars = sum(len(w) + 1 for w in session.words[:word_index]) + char_index
            session.player2.chars_typed = total_chars
            
            # Notify human player of bot progress
            if session.player1.uid in session._on_opponent_progress:
                try:
                    await session._on_opponent_progress[session.player1.uid](
                        char_index, word_index
                    )
                except Exception as e:
                    # Log but don't crash if notification fails
                    logger.warning(f"Failed to send bot progress to player: {e}")
        
        try:
            await session.bot.run(session.duration, on_bot_progress)
        except Exception as e:
            logger.error(f"Bot encountered error during game: {e}")
            # Bot will be stopped on game end anyway
    
    async def _game_timer(self, session: GameSession) -> None:
        """Timer for game duration - ensures game ends when time expires"""
        # Frontend countdown handling is now synchronized by timestamp.
        # We don't need a specific buffer here if we trust the start_game scheduling,
        # but a small buffer helps ensure we don't kill the game exactly when it starts if there's lag.
        # The session.duration sleep is the main thing.
        # The scheduled_start task handles the initial 5s wait.
        pass
        
        await asyncio.sleep(session.duration)  # Main game timer (30s)
        
        # End game if still active or waiting (auto-started but no typing)
        if session.state in (MatchState.ACTIVE, MatchState.WAITING):
            try:
                logger.info(f"Game timer expired for match {session.match_id}, ending game")
                await self.end_game(session.match_id)
            except Exception as e:
                logger.error(f"Error ending game on timer expiry: {e}")
                # Force cleanup to prevent stuck state
                self._cleanup_session(session.match_id)
    
    def process_keystroke(
        self, 
        match_id: str, 
        player_uid: str,
        char: str,
        timestamp: int,
        char_index: int
    ) -> bool:
        """
        Process a keystroke from a player.
        
        Returns True if valid, False if rejected.
        """
        session = self._sessions.get(match_id)
        if not session:
            logger.warning(f"Keystroke rejected: No session found for match {match_id}, player {player_uid}")
            return False
        
        logger.debug(f"Keystroke from {player_uid} in match {match_id}: char='{char}', idx={char_index}, state={session.state}")
        
        # If still preparing (waiting for callbacks), but player is ready, force start
        if session.state == MatchState.PREPARING:
            # Check if this player has registered callbacks
            if player_uid in session._on_game_start:
                logger.info(f"Session {match_id} stuck in PREPARING, auto-transitioning to WAITING on keystroke from {player_uid}")
                session.state = MatchState.WAITING
                if not session.started_at:
                    session.started_at = datetime.now(timezone.utc)
            else:
                logger.debug(f"Keystroke ignored - game {match_id} still preparing and player {player_uid} not ready")
                return True  # Return True to avoid error message to client
        
        # Start game on first keystroke from any player
        # Only start if in WAITING state (not PREPARING - callbacks may not be registered yet)
        if session.state == MatchState.WAITING:
            # Synchronized Start Enforcer
            # If the backend is still WAITING, it means the scheduled start time hasn't arrived yet.
            # Reject the keystroke to prevent "false starts" due to local clock differences.
            logger.debug(f"Keystroke rejected - Game {match_id} is waiting for synchronized start")
            return False
        
        if session.state != MatchState.ACTIVE:
            return False
        
        # Lazy start removed - bot starts with synchronized timer loop
        # But we keep a safety check just in case
        if session.bot and not session._bot_started and session.state == MatchState.ACTIVE:
            session._bot_started = True
            logger.info(f"Safety start for bot in match {match_id}")
            asyncio.create_task(self._run_bot(session))
        
        # Get player state
        if session.player1.uid == player_uid:
            player = session.player1
            opponent = session.player2
        elif session.player2.uid == player_uid:
            player = session.player2
            opponent = session.player1
        else:
            return False
        
        # Handle backspace - just update position, don't record keystroke
        if char == '\b':
            player.current_char_index = char_index
            # Update dedup tracker for backspace (allow going backwards)
            player.last_processed_char_index = char_index - 1
            return True
        
        # ===== KEYSTROKE DEDUPLICATION =====
        # Reject duplicate or out-of-order keystrokes (network latency protection)
        # This prevents the same character from being counted twice when connection is slow
        if char_index <= player.last_processed_char_index:
            logger.debug(f"Duplicate/out-of-order keystroke rejected: player={player_uid}, "
                        f"char_index={char_index}, last_processed={player.last_processed_char_index}")
            return True  # Return True to avoid error message (it's not really an error, just a duplicate)
        
        # Create keystroke
        keystroke = Keystroke(char=char, timestamp=timestamp, char_index=char_index)
        
        # Validate against previous keystroke
        prev_keystroke = player.keystrokes[-1] if player.keystrokes else None
        validation = anti_cheat_service.validate_keystroke(keystroke, prev_keystroke)
        
        if not validation.valid:
            return False
        
        # Record keystroke and update dedup tracker
        player.keystrokes.append(keystroke)
        player.current_char_index = char_index
        player.last_processed_char_index = char_index  # Track for deduplication
        
        # Update total chars typed (approximate for WPM)
        # We can't easily calculate exact total without iterating words, 
        # so we'll just increment for now or rely on word completion
        player.chars_typed += 1
        
        # Check if character is correct
        if char_index < len(session.word_text):
            expected = session.word_text[char_index]
            if char != expected:
                player.errors += 1
        
        return True
    
    async def process_word_complete(
        self,
        match_id: str,
        player_uid: str,
        word_index: int
    ) -> bool:
        """Process word completion and check for game end.
        
        Increments words_completed when player moves to the next word.
        Word accuracy is already reflected in the overall score calculation
        through Net WPM (errors subtracted) and accuracy multiplier.
        """
        session = self._sessions.get(match_id)
        if not session or session.state != MatchState.ACTIVE:
            return False
        
        if session.player1.uid == player_uid:
            player = session.player1
        elif session.player2.uid == player_uid:
            player = session.player2
        else:
            return False
        
        # Validate word_index is sequential (no skipping words)
        if word_index > player.current_word_index + 1:
            logger.warning(f"Player {player_uid} tried to skip from word {player.current_word_index} to {word_index}")
            return False
        
        # Validate word_index is within bounds
        if word_index < 0 or word_index >= len(session.words):
            return False
        
        # Update player state
        player.current_word_index = word_index
        # word_index is 0-indexed, so words_completed = word_index + 1
        # After completing word 0, you have completed 1 word
        player.words_completed = word_index + 1
        
        # Check if player completed all words - trigger early game end
        if word_index >= len(session.words) - 1:
            logger.info(f"Player {player_uid} completed all words! Ending game early.")
            asyncio.create_task(self.end_game(match_id))
        
        return True
    
    def register_callbacks(
        self,
        match_id: str,
        player_uid: str,
        on_game_start: Callable[[int, int], Awaitable[None]],
        on_opponent_progress: Callable[[int, int], Awaitable[None]],
        on_game_end: Callable[[MatchResult], Awaitable[None]]
    ) -> None:
        """Register callbacks for a player"""
        session = self._sessions.get(match_id)
        if session:
            session._on_game_start[player_uid] = on_game_start
            session._on_opponent_progress[player_uid] = on_opponent_progress
            session._on_game_end[player_uid] = on_game_end
    
    async def end_game(self, match_id: str) -> None:
        """End the game and calculate results"""
        session = self._sessions.get(match_id)
        if not session:
            return
            
        # Idempotency Check: Prevent multiple calls (race condition fix)
        # This prevents double coin awards if triggered by timer + word completion simultaneously
        if session.state == MatchState.FINISHED:
            logger.debug(f"end_game called for {match_id} but already FINISHED. Skipping.")
            return
        
        session.state = MatchState.FINISHED
        session.ended_at = datetime.now(timezone.utc)
        
        # Stop bot if running
        if session.bot:
            session.bot.stop()
            bot_result = session.bot.get_result()
            session.player2.wpm = bot_result["wpm"]
            session.player2.accuracy = bot_result["accuracy"]
            
            # Calculate Bot Score using same WPM-weighted formula as player
            # We must use the actual elapsed time of the match
            elapsed_seconds = (session.ended_at - session.started_at).total_seconds() if session.started_at else session.duration
            if elapsed_seconds < 0.1: elapsed_seconds = 0.1
            
            net_wpm = anti_cheat_service.calculate_score(
                chars_typed=bot_result["chars_typed"],
                errors=bot_result["errors"],
                duration_seconds=elapsed_seconds
            )
            # Use new additive formula: (NetWPM * 100) + (Accuracy * 10) + (Words * 5)
            # This matches the player calculation in anticheat.py
            bot_accuracy = session.player2.accuracy
            
            wpm_score = net_wpm * 100
            accuracy_score = bot_accuracy * 10
            progress_score = session.player2.words_completed * 5
            
            session.player2.score = round(wpm_score + accuracy_score + progress_score, 1)
        
        # Calculate player stats
        for player in [session.player1, session.player2]:
            if not player.is_bot:
                logger.info(f"Calculating stats for {player.uid}: keystrokes={len(player.keystrokes)}, words={player.words_completed}, chars={player.chars_typed}")
                wpm, accuracy, score = anti_cheat_service.calculate_player_stats(
                    player.keystrokes,
                    session.word_text,
                    session.duration,
                    words_completed=player.words_completed,
                    chars_typed=player.chars_typed,
                    errors=player.errors
                )
                player.wpm = wpm
                player.accuracy = accuracy
                player.score = score
                logger.info(f"Player {player.uid} final stats: wpm={wpm}, accuracy={accuracy}, score={score}")
        
        # Calculate Elo changes (bot matches give reduced ELO)
        # Training mode: no ELO changes
        # Friends mode: no ELO changes (casual play)
        is_bot = session.player2.is_bot
        if session.is_training or session.is_friends_mode:
            player1_change = 0
            player2_change = 0
        else:
            # Fetch current user stats for Elo calculation (need games played for placement bonus)
            p1_games = 100 # Default to high number (no bonus) if fetch fails
            p2_games = 100
            
            try:
                from app.database import Database
                db = Database.get_db()
                
                # Fetch only necessary fields
                if not session.player1.is_bot:
                    p1_doc = await db.users.find_one({"firebase_uid": session.player1.uid}, {"total_matches": 1})
                    if p1_doc:
                        p1_games = p1_doc.get("total_matches", 0)
                
                if not session.player2.is_bot:
                    p2_doc = await db.users.find_one({"firebase_uid": session.player2.uid}, {"total_matches": 1})
                    if p2_doc:
                        p2_games = p2_doc.get("total_matches", 0)
            except Exception as e:
                logger.warning(f"Failed to fetch user stats for Elo calculation: {e}")

            player1_change, player2_change = elo_calculator.calculate_match_result(
                Rating(elo=session.player1.elo),
                Rating(elo=session.player2.elo),
                session.player1.score,
                session.player2.score,
                player_games_played=p1_games,
                opponent_games_played=p2_games,
                is_bot_match=is_bot
            )

        # Calculate Coin Rewards with Bonuses
        # Calculate Coin Rewards with Bonuses (Try-Except block to prevent game end failure)
        try:
            logger.info(f"Calculating coins for match {match_id}. P1({session.player1.score}) vs P2({session.player2.score})")
            
            p1_result_str = "win" if session.player1.score > session.player2.score else ("loss" if session.player1.score < session.player2.score else "tie")
            p2_result_str = "win" if session.player2.score > session.player1.score else ("loss" if session.player2.score < session.player1.score else "tie")
            
            # Helper to get rank bonus multiplier (handles Enum or String)
            def get_rank_bonus(rank) -> float:
                # Handle Rank Enum or string value
                rank_str = rank.value if hasattr(rank, 'value') else str(rank)
                if rank_str == Rank.BRONZE.value: return 0.20
                if rank_str == Rank.GOLD.value: return 0.40
                if rank_str == Rank.PLATINUM.value: return 0.80
                if rank_str == Rank.RANKER.value: return 1.60
                return 0.0

            # Calculate P1
            rank_bonus_rate_p1 = get_rank_bonus(session.player1.rank)
            
            lb_bonus_rate_p1 = 0.0
            if not session.player1.is_bot:
                try:
                    lb_bonus_rate_p1 = await get_leaderboard_coin_bonus(session.player1.uid)
                except Exception as e:
                    logger.warning(f"Failed to get leaderboard bonus for P1: {e}")
                
            base_p1 = WIN_COIN_REWARD if p1_result_str == "win" else LOSS_COIN_REWARD
            rank_coins_p1 = int(base_p1 * rank_bonus_rate_p1)
            lb_coins_p1 = int(base_p1 * lb_bonus_rate_p1)
            total_p1 = base_p1 + rank_coins_p1 + lb_coins_p1
            
            # Calculate P2
            rank_bonus_rate_p2 = get_rank_bonus(session.player2.rank)
            
            lb_bonus_rate_p2 = 0.0
            if not session.player2.is_bot:
                try:
                    lb_bonus_rate_p2 = await get_leaderboard_coin_bonus(session.player2.uid)
                except Exception as e:
                    logger.warning(f"Failed to get leaderboard bonus for P2: {e}")
                
            base_p2 = WIN_COIN_REWARD if p2_result_str == "win" else LOSS_COIN_REWARD
            rank_coins_p2 = int(base_p2 * rank_bonus_rate_p2)
            lb_coins_p2 = int(base_p2 * lb_bonus_rate_p2)
            total_p2 = base_p2 + rank_coins_p2 + lb_coins_p2

            logger.info(f"Coin result P1: Base={base_p1} Rank={rank_coins_p1} LB={lb_coins_p1} Total={total_p1}")
            logger.info(f"Coin result P2: Base={base_p2} Rank={rank_coins_p2} LB={lb_coins_p2} Total={total_p2}")
            
        except Exception as e:
            logger.error(f"Evaluating coin rewards failed: {e}")
            # Fallback to basic calculation to ensure variables are defined
            p1_result_str = "win" if session.player1.score > session.player2.score else ("loss" if session.player1.score < session.player2.score else "tie")
            p2_result_str = "win" if session.player2.score > session.player1.score else ("loss" if session.player2.score < session.player1.score else "tie")
            
            base_p1 = WIN_COIN_REWARD if p1_result_str == "win" else LOSS_COIN_REWARD
            base_p2 = WIN_COIN_REWARD if p2_result_str == "win" else LOSS_COIN_REWARD
            
            rank_coins_p1 = 0
            lb_coins_p1 = 0
            total_p1 = base_p1
            
            rank_coins_p2 = 0
            lb_coins_p2 = 0
            total_p2 = base_p2

        # Save Coins to DB (all users get full rewards - guest restrictions removed)
        try:
            from app.database import Database
            db = Database.get_db()
            
            if not session.player1.is_bot:
                await db.users.update_one(
                    {"firebase_uid": session.player1.uid},
                    {"$inc": {"coins": total_p1}}
                )
            
            if not session.player2.is_bot:
                await db.users.update_one(
                    {"firebase_uid": session.player2.uid},
                    {"$inc": {"coins": total_p2}}
                )
        except Exception as e:
            logger.error(f"Failed to award coins: {e}")
            
        # Determine winner results for callback
        if session.player1.score > session.player2.score:
            p1_result = "win"
            p2_result = "loss"
        elif session.player1.score < session.player2.score:
            p1_result = "loss"
            p2_result = "win"
        else:
            p1_result = "tie"
            p2_result = "tie"
        
        # Determine game mode string
        game_mode_str = "friends" if session.is_friends_mode else ("training" if session.is_training else "ranked")
        
        try:
            # Prepare MatchResult objects
            result_for_p1 = MatchResult(
                match_id=match_id,
                duration=session.duration,
                game_mode=game_mode_str,
                your_wpm=session.player1.wpm,
                your_accuracy=session.player1.accuracy,
                your_score=session.player1.score,
                your_elo_before=session.player1.elo,
                your_elo_after=session.player1.elo + player1_change,
                your_elo_change=player1_change,
                
                opponent_display_name=session.player2.display_name,
                opponent_photo_url=session.player2.photo_url,
                opponent_is_bot=session.player2.is_bot,
                opponent_wpm=session.player2.wpm,
                opponent_accuracy=session.player2.accuracy,
                opponent_score=session.player2.score,
                opponent_rank=session.player2.rank.value if hasattr(session.player2.rank, 'value') else str(session.player2.rank),
                opponent_elo=session.player2.elo,
                opponent_elo_change=player2_change,
                opponent_cursor="default", 
                
                result=p1_result,
                coins_earned=total_p1,
                base_coins=base_p1,
                rank_bonus_coins=rank_coins_p1,
                leaderboard_bonus_coins=lb_coins_p1
            )

            result_for_p2 = MatchResult(
                match_id=match_id,
                duration=session.duration,
                game_mode=game_mode_str,
                your_wpm=session.player2.wpm,
                your_accuracy=session.player2.accuracy,
                your_score=session.player2.score,
                your_elo_before=session.player2.elo,
                your_elo_after=session.player2.elo + player2_change,
                your_elo_change=player2_change,
                
                opponent_display_name=session.player1.display_name,
                opponent_photo_url=session.player1.photo_url,
                opponent_is_bot=False,
                opponent_wpm=session.player1.wpm,
                opponent_accuracy=session.player1.accuracy,
                opponent_score=session.player1.score,
                opponent_rank=session.player1.rank.value if hasattr(session.player1.rank, 'value') else str(session.player1.rank),
                opponent_elo=session.player1.elo,
                opponent_elo_change=player1_change,
                opponent_cursor="default", 
                
                result=p2_result,
                coins_earned=total_p2,
                base_coins=base_p2,
                rank_bonus_coins=rank_coins_p2,
                leaderboard_bonus_coins=lb_coins_p2
            )

            async def notify_player_end(player_uid: str, result: MatchResult, label: str) -> None:
                if player_uid not in session._on_game_end:
                     return
                try:
                    await notify_with_retry(
                        session._on_game_end[player_uid],
                        result,
                        label=f"GAME_END for {label} ({player_uid})",
                        timeout=GAME_END_NOTIFY_TIMEOUT_SECONDS
                    )
                except Exception as e:
                    logger.warning(f"Failed to notify {player_uid}: {e}")
            
            await asyncio.gather(
                notify_player_end(session.player1.uid, result_for_p1, "player1"),
                notify_player_end(session.player2.uid, result_for_p2, "player2") if not session.player2.is_bot else asyncio.sleep(0),
                return_exceptions=True
            )
        except Exception as e:
            logger.error(f"Failed to construct/send MatchResult for {match_id}: {e}")

        
        # Update online users list with new Elo and broadcast the update
        try:
            from app.routers.match import manager
            # Update player Elo in the online users list
            manager.update_user_elo(session.player1.uid, session.player1.elo + player1_change)
            if not session.player2.is_bot:
                manager.update_user_elo(session.player2.uid, session.player2.elo + player2_change)
            # Broadcast updated online users list so everyone sees new Elo
            await manager.broadcast_online_users()
        except Exception as e:
            logger.warning(f"Failed to update online users Elo: {e}")
        
        # Broadcast match ended to all online users
        try:
            from app.routers.match import manager
            is_tie = (p1_result == "tie")
            winner = session.player1 if p1_result == "win" else session.player2
            loser = session.player2 if p1_result == "win" else session.player1
            await manager.broadcast_match_ended(
                match_id=match_id,
                winner_name=winner.display_name,
                winner_photo=winner.photo_url,
                loser_name=loser.display_name,
                loser_photo=loser.photo_url,
                winner_wpm=winner.wpm,
                loser_wpm=loser.wpm,
                is_tie=is_tie,
                game_mode="training" if session.is_training else ("friends" if session.is_friends_mode else "ranked")
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast match ended: {e}")
        
        # Save match and update user stats in MongoDB
        await self._save_match_to_db(session, player1_change, player2_change, p1_result, p2_result)
        
        # Clean up matchmaking state (allow players to queue again)
        try:
            from app.services.matchmaking import matchmaking_service
            await matchmaking_service.cleanup_after_match(
                session.player1.uid, 
                session.player2.uid,
                is_training=session.is_training
            )
        except Exception as e:
            logger.warning(f"Failed to cleanup matchmaking state: {e}")
        
        # Cleanup
        self._cleanup_session(match_id)
    
    async def _save_match_to_db(
        self,
        session: GameSession,
        player1_elo_change: int,
        player2_elo_change: int,
        p1_result: str,
        p2_result: str
    ) -> None:
        """Save match results to MongoDB and update user stats"""
        try:
            from app.database import Database
            db = Database.get_db()
            
            # Determine winner
            if p1_result == "win":
                winner_id = session.player1.uid
            elif p2_result == "win":
                winner_id = session.player2.uid
            else:
                winner_id = None
            
            # Save match document
            match_doc = {
                "match_id": session.match_id,
                "player1_id": session.player1.uid,
                "player2_id": session.player2.uid if not session.player2.is_bot else "BOT",
                "player1_wpm": session.player1.wpm,
                "player2_wpm": session.player2.wpm,
                "player1_accuracy": session.player1.accuracy,
                "player2_accuracy": session.player2.accuracy,
                "player1_score": session.player1.score,
                "player2_score": session.player2.score,
                "player1_elo_before": session.player1.elo,
                "player2_elo_before": session.player2.elo,
                "player1_elo_change": player1_elo_change,
                "player2_elo_change": player2_elo_change,
                "winner_id": winner_id,
                "duration": session.duration,
                "is_bot_match": session.player2.is_bot,
                "is_training": session.is_training,
                "is_friends_mode": session.is_friends_mode,
                "created_at": session.created_at,
                "ended_at": session.ended_at
            }
            
            await db.matches.insert_one(match_doc)
            logger.info(f"Match saved: {session.match_id} (training={session.is_training}, friends={session.is_friends_mode})")
            
            # Award coins for all completed matches (including training and friends)
            from app.constants import WIN_COIN_REWARD, LOSS_COIN_REWARD
            
            # Check leaderboard position for coin bonuses (50% top 3, 20% top 4-10)
            p1_bonus_rate = await get_leaderboard_coin_bonus(session.player1.uid)
            p2_bonus_rate = await get_leaderboard_coin_bonus(session.player2.uid) if not session.player2.is_bot else 0.0
            
            # Match Rank Bonus Helper
            from app.models.user import Rank, get_rank_from_elo
            def get_rank_bonus_rate(rank: Rank) -> float:
                if rank == Rank.BRONZE: return 0.20
                if rank == Rank.GOLD: return 0.40
                if rank == Rank.PLATINUM: return 0.80
                if rank == Rank.RANKER: return 1.60
                return 0.0

            p1_rank_bonus = get_rank_bonus_rate(session.player1.rank)
            
            # Award player 1 coins
            p1_base_coins = WIN_COIN_REWARD if p1_result == "win" else LOSS_COIN_REWARD
            p1_coins = int(p1_base_coins * (1 + p1_bonus_rate + p1_rank_bonus))
            await db.users.update_one(
                {"firebase_uid": session.player1.uid},
                {"$inc": {"coins": p1_coins}}
            )
            p1_bonus_log = f' (LB: {int(p1_bonus_rate*100)}% Rank: {int(p1_rank_bonus*100)}%)' if (p1_bonus_rate > 0 or p1_rank_bonus > 0) else ''
            logger.info(f"Player 1 ({session.player1.uid}) awarded {p1_coins} coins{p1_bonus_log}")
            
            # Award player 2 coins if not a bot (with position-based bonus)
            if not session.player2.is_bot:
                p2_rank_bonus = get_rank_bonus_rate(session.player2.rank)
                p2_base_coins = WIN_COIN_REWARD if p2_result == "win" else LOSS_COIN_REWARD
                p2_coins = int(p2_base_coins * (1 + p2_bonus_rate + p2_rank_bonus))
                await db.users.update_one(
                    {"firebase_uid": session.player2.uid},
                    {"$inc": {"coins": p2_coins}}
                )
                p2_bonus_log = f' (LB: {int(p2_bonus_rate*100)}% Rank: {int(p2_rank_bonus*100)}%)' if (p2_bonus_rate > 0 or p2_rank_bonus > 0) else ''
                logger.info(f"Player 2 ({session.player2.uid}) awarded {p2_coins} coins{p2_bonus_log}")
            
            # Skip user stats update for training and friends mode matches
            if session.is_training or session.is_friends_mode:
                logger.info(f"Training/Friends match - skipping user stats/ELO update")
                return
            
            p1_doc = await db.users.find_one({"firebase_uid": session.player1.uid})
            if p1_doc:
                old_matches = p1_doc.get("total_matches", 0) or 0
                old_avg_wpm = p1_doc.get("avg_wpm", 0.0) or 0.0
                old_avg_acc = p1_doc.get("avg_accuracy", 0.0) or 0.0
                current_db_elo = p1_doc.get("elo_rating", 1000) or 1000
                
                new_matches = old_matches + 1
                new_avg_wpm = ((old_avg_wpm * old_matches) + session.player1.wpm) / new_matches if new_matches > 0 else session.player1.wpm
                new_avg_acc = ((old_avg_acc * old_matches) + session.player1.accuracy) / new_matches if new_matches > 0 else session.player1.accuracy

                # Safety floor: ensure Elo never goes below 0
                effective_elo_change = player1_elo_change
                if player1_elo_change < 0:
                    effective_elo_change = max(-current_db_elo, player1_elo_change)
                new_elo_p1 = max(0, current_db_elo + effective_elo_change)
                result = await db.users.update_one(
                    {"firebase_uid": session.player1.uid},
                    {
                        "$inc": {
                            "total_matches": 1,
                            "wins": 1 if p1_result == "win" else 0,
                            "losses": 1 if p1_result == "loss" else 0,
                            "elo_rating": effective_elo_change
                        },
                        "$set": {
                            "avg_wpm": new_avg_wpm,
                            "avg_accuracy": new_avg_acc
                        },
                        "$max": {
                            "peak_elo": new_elo_p1,
                            "best_wpm": int(session.player1.wpm)
                        }
                    }
                )
                if result.modified_count > 0:
                    logger.info(f"Player 1 ({session.player1.uid}) stats updated: ELO {current_db_elo} → {new_elo_p1} (change: {effective_elo_change:+d})")
                else:
                    logger.warning(f"Player 1 ({session.player1.uid}) stats update matched but not modified")
                
                # Check for Rank Change (Dynamic BG Reward) - Player 1
                try:
                    old_rank_enum = get_rank_from_elo(current_db_elo)
                    new_rank_enum = get_rank_from_elo(new_elo_p1)
                    
                    if old_rank_enum != new_rank_enum:
                        logger.info(f"Player 1 Rank Change: {old_rank_enum} -> {new_rank_enum}")
                        
                        rank_bg_map = {
                            Rank.BRONZE: "rank_bronze",
                            Rank.GOLD: "rank_gold",
                            Rank.PLATINUM: "rank_platinum",
                            Rank.RANKER: "rank_ranker"
                        }
                        
                        old_bg = rank_bg_map.get(old_rank_enum)
                        new_bg = rank_bg_map.get(new_rank_enum)
                        
                        updates_p1 = {}
                        if old_bg:
                             await db.users.update_one(
                                {"firebase_uid": session.player1.uid},
                                {"$pull": {"unlocked_backgrounds": old_bg}}
                             )
                             # If equipped, remove it
                             if p1_doc.get("equipped_background") == old_bg:
                                 updates_p1["equipped_background"] = None

                        if new_bg:
                            await db.users.update_one(
                                {"firebase_uid": session.player1.uid},
                                {"$addToSet": {"unlocked_backgrounds": new_bg}}
                            )
                            # Auto-equip new rank BG? "get the wallpaper"
                            updates_p1["equipped_background"] = new_bg
                        
                        if updates_p1:
                             await db.users.update_one(
                                {"firebase_uid": session.player1.uid},
                                {"$set": updates_p1}
                             )
                except Exception as e_rank:
                     logger.error(f"Failed to update P1 Rank Rewards: {e_rank}")
            else:
                logger.error(f"Player 1 user document not found for UID: {session.player1.uid} - ELO change {player1_elo_change} not applied!")
            
            # Update player 2 stats if not a bot
            if not session.player2.is_bot:
                p2_doc = await db.users.find_one({"firebase_uid": session.player2.uid})
                if p2_doc:
                    old_matches_p2 = p2_doc.get("total_matches", 0) or 0
                    old_avg_wpm_p2 = p2_doc.get("avg_wpm", 0.0) or 0.0
                    old_avg_acc_p2 = p2_doc.get("avg_accuracy", 0.0) or 0.0
                    current_db_elo_p2 = p2_doc.get("elo_rating", 1000) or 1000
                    
                    new_matches_p2 = old_matches_p2 + 1
                    new_avg_wpm_p2 = ((old_avg_wpm_p2 * old_matches_p2) + session.player2.wpm) / new_matches_p2 if new_matches_p2 > 0 else session.player2.wpm
                    new_avg_acc_p2 = ((old_avg_acc_p2 * old_matches_p2) + session.player2.accuracy) / new_matches_p2 if new_matches_p2 > 0 else session.player2.accuracy

                    # Safety floor: ensure Elo never goes below 0
                    effective_elo_change_p2 = player2_elo_change
                    if player2_elo_change < 0:
                        effective_elo_change_p2 = max(-current_db_elo_p2, player2_elo_change)
                    new_elo_p2 = max(0, current_db_elo_p2 + effective_elo_change_p2)
                    result = await db.users.update_one(
                        {"firebase_uid": session.player2.uid},
                        {
                            "$inc": {
                                "total_matches": 1,
                                "wins": 1 if p2_result == "win" else 0,
                                "losses": 1 if p2_result == "loss" else 0,
                                "elo_rating": effective_elo_change_p2
                            },
                            "$set": {
                                "avg_wpm": new_avg_wpm_p2,
                                "avg_accuracy": new_avg_acc_p2
                            },
                            "$max": {
                                "peak_elo": new_elo_p2,
                                "best_wpm": int(session.player2.wpm)
                            }
                        }
                    )
                    if result.modified_count > 0:
                        logger.info(f"Player 2 ({session.player2.uid}) stats updated: ELO {current_db_elo_p2} → {new_elo_p2} (change: {effective_elo_change_p2:+d})")
                    else:
                        logger.warning(f"Player 2 ({session.player2.uid}) stats update matched but not modified")
                    
                    # Check for Rank Change (Dynamic BG Reward) - Player 2
                    try:
                        old_rank_enum_p2 = get_rank_from_elo(current_db_elo_p2)
                        new_rank_enum_p2 = get_rank_from_elo(new_elo_p2)
                        
                        if old_rank_enum_p2 != new_rank_enum_p2:
                            logger.info(f"Player 2 Rank Change: {old_rank_enum_p2} -> {new_rank_enum_p2}")
                            
                            rank_bg_map = {
                                Rank.BRONZE: "rank_bronze",
                                Rank.GOLD: "rank_gold",
                                Rank.PLATINUM: "rank_platinum",
                                Rank.RANKER: "rank_ranker"
                            }
                            
                            old_bg_p2 = rank_bg_map.get(old_rank_enum_p2)
                            new_bg_p2 = rank_bg_map.get(new_rank_enum_p2)
                            
                            updates_p2 = {}
                            if old_bg_p2:
                                 await db.users.update_one(
                                    {"firebase_uid": session.player2.uid},
                                    {"$pull": {"unlocked_backgrounds": old_bg_p2}}
                                 )
                                 if p2_doc.get("equipped_background") == old_bg_p2:
                                     updates_p2["equipped_background"] = None

                            if new_bg_p2:
                                await db.users.update_one(
                                    {"firebase_uid": session.player2.uid},
                                    {"$addToSet": {"unlocked_backgrounds": new_bg_p2}}
                                )
                                updates_p2["equipped_background"] = new_bg_p2
                            
                            if updates_p2:
                                 await db.users.update_one(
                                    {"firebase_uid": session.player2.uid},
                                    {"$set": updates_p2}
                                 )
                    except Exception as e_rank:
                         logger.error(f"Failed to update P2 Rank Rewards: {e_rank}")
                else:
                    logger.error(f"Player 2 user document not found for UID: {session.player2.uid} - ELO change {player2_elo_change} not applied!")
            
            logger.info(f"User stats updated for match: {session.match_id}")
            
            # Update quest progress for both players
            try:
                from app.routers.earn import update_match_quest_progress
                
                # Get current win streaks from user docs
                p1_streak = p1_doc.get("current_win_streak", 0) if p1_doc else 0
                p2_streak = p2_doc.get("current_win_streak", 0) if p2_doc and not session.player2.is_bot else 0
                
                # Update player 1 quests
                await update_match_quest_progress(
                    user_uid=session.player1.uid,
                    won=(p1_result == "win"),
                    wpm=session.player1.wpm,
                    accuracy=session.player1.accuracy,
                    is_training=session.is_training,
                    current_streak=p1_streak + 1 if p1_result == "win" else 0
                )
                
                # Update player 2 quests (if not a bot)
                if not session.player2.is_bot:
                    await update_match_quest_progress(
                        user_uid=session.player2.uid,
                        won=(p2_result == "win"),
                        wpm=session.player2.wpm,
                        accuracy=session.player2.accuracy,
                        is_training=session.is_training,
                        current_streak=p2_streak + 1 if p2_result == "win" else 0
                    )
                
                logger.info(f"Quest progress updated for match: {session.match_id}")
            except Exception as quest_error:
                logger.warning(f"Failed to update quest progress: {quest_error}")
            
        except Exception as e:
            logger.error(f"Failed to save match to database: {e}")
    
    def _cleanup_session(self, match_id: str) -> None:
        """Clean up a completed session"""
        session = self._sessions.get(match_id)
        if session:
            # Clear callbacks to prevent memory leaks
            session._on_game_start.clear()
            session._on_opponent_progress.clear()
            session._on_game_end.clear()
            if session.player1.uid in self._player_sessions:
                del self._player_sessions[session.player1.uid]
            if session.player2.uid in self._player_sessions:
                del self._player_sessions[session.player2.uid]
            del self._sessions[match_id]
    
    async def _forfeit_match(self, match_id: str, disconnected_uid: Optional[str]) -> None:
        """Handle forfeit when a player fails to connect properly.
        
        Args:
            match_id: The match ID
            disconnected_uid: UID of player who failed to connect, or None if both failed
        """
        session = self._sessions.get(match_id)
        if not session:
            return
        
        session.state = MatchState.FINISHED
        session.ended_at = datetime.now(timezone.utc)
        
        logger.info(f"Forfeiting match {match_id}, disconnected player: {disconnected_uid}")
        
        # Determine results based on who disconnected
        if disconnected_uid is None:
            # Both disconnected - no winner, no ELO changes
            p1_result = "tie"
            p2_result = "tie"
            p1_elo_change = 0
            p2_elo_change = 0
        elif disconnected_uid == session.player1.uid:
            # Player 1 forfeit - Player 2 wins
            p1_result = "loss"
            p2_result = "win"
            # Small ELO penalty for disconnect, small gain for winner
            # Skip penalty for bot matches - no reason to penalize for bot disconnects
            if session.player2.is_bot:
                p1_elo_change = 0
                p2_elo_change = 0
            else:
                p1_elo_change = -10
                p2_elo_change = 10
        else:
            # Player 2 forfeit - Player 1 wins
            p1_result = "win"
            p2_result = "loss"
            # Skip penalty for bot matches
            if session.player2.is_bot:
                p1_elo_change = 0
                p2_elo_change = 0
            else:
                p1_elo_change = 10
                p2_elo_change = -10
        
        # Determine game mode string for forfeit
        game_mode_str = "training" if session.is_training else ("friends" if session.is_friends_mode else "ranked")
        
        # Create forfeit results
        result_for_p1 = MatchResult(
            match_id=match_id,
            duration=0,  # Match never started
            game_mode=game_mode_str,
            your_wpm=0,
            your_accuracy=0,
            your_score=0,
            your_elo_before=session.player1.elo,
            your_elo_after=session.player1.elo + p1_elo_change,
            your_elo_change=p1_elo_change,
            opponent_display_name=session.player2.display_name,
            opponent_photo_url=session.player2.photo_url,
            opponent_is_bot=session.player2.is_bot,
            opponent_wpm=0,
            opponent_accuracy=0,
            opponent_score=0,
            opponent_rank=session.player2.rank.value,
            result=p1_result
        )
        
        result_for_p2 = MatchResult(
            match_id=match_id,
            duration=0,
            game_mode=game_mode_str,
            your_wpm=0,
            your_accuracy=0,
            your_score=0,
            your_elo_before=session.player2.elo,
            your_elo_after=session.player2.elo + p2_elo_change,
            your_elo_change=p2_elo_change,
            opponent_display_name=session.player1.display_name,
            opponent_photo_url=session.player1.photo_url,
            opponent_is_bot=False,
            opponent_wpm=0,
            opponent_accuracy=0,
            opponent_score=0,
            opponent_rank=session.player1.rank.value,
            result=p2_result
        )
        
        # Notify connected players only
        if session.player1.uid in session._on_game_end:
            try:
                await session._on_game_end[session.player1.uid](result_for_p1)
            except Exception as e:
                logger.error(f"Failed to notify p1 of forfeit: {e}")
        
        if not session.player2.is_bot and session.player2.uid in session._on_game_end:
            try:
                await session._on_game_end[session.player2.uid](result_for_p2)
            except Exception as e:
                logger.error(f"Failed to notify p2 of forfeit: {e}")
        
        # Save forfeit match to DB (if needed for records)
        try:
            await self._save_match_to_db(session, p1_elo_change, p2_elo_change, p1_result, p2_result)
        except Exception as e:
            logger.error(f"Failed to save forfeit match: {e}")
        
        # Clean up matchmaking state (allow players to queue again)
        try:
            from app.services.matchmaking import matchmaking_service
            await matchmaking_service.cleanup_after_match(
                session.player1.uid, 
                session.player2.uid,
                is_training=session.is_training
            )
        except Exception as e:
            logger.warning(f"Failed to cleanup matchmaking state after forfeit: {e}")
        
        # Cleanup
        self._cleanup_session(match_id)
    
    async def handle_player_disconnect(self, match_id: str, player_uid: str) -> None:
        """Handle a player disconnecting mid-game - they forfeit and opponent wins"""
        session = self._sessions.get(match_id)
        if not session:
            return
        
        # Check if session is already finished
        if session.state == MatchState.FINISHED:
            logger.info(f"Player {player_uid} disconnected from already finished match {match_id}")
            return
        
        logger.info(f"Player {player_uid} disconnected from match {match_id}, forfeiting...")
        
        # If game is active or preparing, the disconnecting player forfeits
        if session.state in (MatchState.ACTIVE, MatchState.WAITING, MatchState.PREPARING):
            # Use forfeit logic - disconnecting player loses, opponent wins
            await self._forfeit_match(match_id, player_uid)
        else:
            # Just cleanup if already finished
            self._cleanup_session(match_id)


# Singleton instance
game_service = GameService()
