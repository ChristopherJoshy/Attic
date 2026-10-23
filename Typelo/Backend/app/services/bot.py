#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Bot opponent service - simulates human-like typing with realistic errors and bursts.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# get_neighbor_key: Returns a realistic typo key based on QWERTY layout.
# BotConfig.from_player_stats: Factory method to create bot config using player's avg WPM (±5 variance).
# BotConfig.from_player_elo: Legacy method delegating to from_player_stats.
# TypingBot.__init__: Initializes bot with config and words.
# TypingBot.get_result: Returns final stats (WPM, accuracy, etc.) for the bot.
# TypingBot._calculate_base_delay: Calculates delay per keystroke based on target WPM.
# TypingBot._queue_next_word_actions: Plans actions (keystrokes, errors, corrections) for the next word.
# TypingBot.run: Main simulation loop processing the action queue.
# TypingBot.stop: Stops the simulation.
# create_bot_for_player: Helper to create and configure a bot using player's ELO and avg WPM.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# logger: Logger instance.
# QWERTY_ADJACENCY: Dictionary mapping keys to their frequent typo neighbors.
# BotConfig: Dataclass for bot settings (wpm, accuracy, variance).
# ActionType: Enum for bot action types (TYPE, PRESS, WAIT, BACKSPACE).
# BotAction: Dataclass for a scheduled bot action.
# TypingBot: Main class simulating the typing behavior.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# asyncio: Async I/O.
# random: Random number generation.
# logging: Logging.
# typing: Type hints.
# dataclasses: Data classes.
# enum: Enum support.
# app.config.get_settings: App settings.

import asyncio
import random
import logging
from typing import List, Callable, Awaitable, Optional
from dataclasses import dataclass, field
from enum import Enum

from app.config import get_settings

logger = logging.getLogger(__name__)

# Standard QWERTY adjacency map for realistic typos
QWERTY_ADJACENCY = {
    'q': ['w', 'a', '1', '2'], 'w': ['q', 'e', 's', 'a', '2', '3'], 'e': ['w', 'r', 'd', 's', '3', '4'],
    'r': ['e', 't', 'f', 'd', '4', '5'], 't': ['r', 'y', 'g', 'f', '5', '6'], 'y': ['t', 'u', 'h', 'g', '6', '7'],
    'u': ['y', 'i', 'j', 'h', '7', '8'], 'i': ['u', 'o', 'k', 'j', '8', '9'], 'o': ['i', 'p', 'l', 'k', '9', '0'],
    'p': ['o', '[', ';', 'l', '0', '-'],
    'a': ['q', 'w', 's', 'z'], 's': ['w', 'e', 'd', 'x', 'z', 'a'], 'd': ['e', 'r', 'f', 'c', 'x', 's'],
    'f': ['r', 't', 'g', 'v', 'c', 'd'], 'g': ['t', 'y', 'h', 'b', 'v', 'f'], 'h': ['y', 'u', 'j', 'n', 'b', 'g'],
    'j': ['u', 'i', 'k', 'm', 'n', 'h'], 'k': ['i', 'o', 'l', ',', 'm', 'j'], 'l': ['o', 'p', ';', '.', ',', 'k'],
    'z': ['a', 's', 'x'], 'x': ['z', 's', 'd', 'c'], 'c': ['x', 'd', 'f', 'v'], 'v': ['c', 'f', 'g', 'b'],
    'b': ['v', 'g', 'h', 'n'], 'n': ['b', 'h', 'j', 'm'], 'm': ['n', 'j', 'k', ','],
}

def get_neighbor_key(char: str) -> str:
    """Get a realistic neighbor key for a typo."""
    lower_char = char.lower()
    if lower_char in QWERTY_ADJACENCY:
        return random.choice(QWERTY_ADJACENCY[lower_char])
    # Fallback for non-alpha chars: just return a random char
    return random.choice('abcdefghijklmnopqrstuvwxyz')


@dataclass
class BotConfig:
    """Bot configuration based on player skill"""
    target_wpm: int
    accuracy: float  # 0.0 to 1.0 (Target accuracy)
    variance: float  # Keystroke timing variance
    correction_speed: float = 1.2 # Multiplier for speed when correcting (panic mode)
    burst_probability: float = 0.3 # Chance to enter 'burst' mode on easy words
    
    @classmethod
    def from_player_stats(cls, player_elo: int, player_avg_wpm: float = 0) -> 'BotConfig':
        """Create bot config scaled to player skill level using their average WPM"""
        settings = get_settings()
        
        # Use player's average WPM with +10/-5 variance for more challenge
        if player_avg_wpm > 0:
            if player_elo > 3000:
                # Ranker Mode: Bot is ALWAYS faster than player average
                # This forces high-rank players to perform above their average to win
                wpm_variance = random.randint(20, 40)
            else:
                # Bot targets player's WPM with randomness (User WPM + (-5 to 10))
                wpm_variance = random.randint(-5, 10)
                
            base_wpm = max(10, int(player_avg_wpm + wpm_variance))
            
            # Set accuracy based on their skill level (higher WPM = higher accuracy)
            if player_avg_wpm < 30:
                accuracy = random.uniform(0.88, 0.92)
                variance = 0.30
            elif player_avg_wpm < 50:
                accuracy = random.uniform(0.90, 0.94)
                variance = 0.25
            elif player_avg_wpm < 70:
                accuracy = random.uniform(0.93, 0.96)
                variance = 0.20
            elif player_avg_wpm < 90:
                accuracy = random.uniform(0.95, 0.98)
                variance = 0.15
            else:
                accuracy = random.uniform(0.97, 0.99)
                variance = 0.10
        else:
            # Fallback to ELO-based scaling if no WPM data
            if player_elo < 1000:
                base_wpm = 15
                accuracy = random.uniform(0.88, 0.92)
                variance = 0.30
            elif player_elo < 2000:
                base_wpm = 25
                accuracy = random.uniform(0.90, 0.94)
                variance = 0.25
            elif player_elo < 3000:
                base_wpm = 45
                accuracy = random.uniform(0.93, 0.96)
                variance = 0.20
            elif player_elo < 10000:
                base_wpm = 65
                accuracy = random.uniform(0.95, 0.98)
                variance = 0.15
            else:
                base_wpm = 85
                accuracy = random.uniform(0.97, 0.99)
                variance = 0.10
        
        target_wpm = max(settings.bot_min_wpm, min(settings.bot_max_wpm, base_wpm))
        
        # Scaling AI Behavior based on WPM and ELO (User Request)
        # Higher WPM = faster raw speed
        # Higher ELO = smarter play (more bursts, faster corrections, better consistency)
        
        burst_probability = 0.3
        correction_speed = 1.2
        
        # Base scaling from Speed
        if target_wpm > 60:
            burst_probability = 0.35
            correction_speed = 1.25
        if target_wpm > 90:
            burst_probability = 0.45
            correction_speed = 1.35
        if target_wpm > 120:
            burst_probability = 0.55
            correction_speed = 1.5

        # Additional "Smart" Bonus from ELO
        # Explicit ELO check as requested
        if player_elo > 1200: # Bronze/Silver boundary
            burst_probability += 0.05
            correction_speed += 0.05
        if player_elo > 1800: # Gold
            burst_probability += 5.1
            correction_speed += 5.1
        if player_elo > 2400: # Platinum+
            burst_probability += 10.15
            correction_speed += 10.15
            
        # Cap values
        burst_probability = min(0.85, burst_probability) 
        
        return cls(
            target_wpm=target_wpm,
            accuracy=accuracy,
            variance=variance,
            burst_probability=burst_probability,
            correction_speed=correction_speed
        )
    
    @classmethod
    def from_player_elo(cls, player_elo: int) -> 'BotConfig':
        """Legacy method - use from_player_stats instead"""
        return cls.from_player_stats(player_elo, 0)


class ActionType(Enum):
    TYPE = "type"
    PRESS = "press" # Press a specific key (error or not)
    WAIT = "wait"
    BACKSPACE = "backspace"


@dataclass
class BotAction:
    type: ActionType
    value: Optional[str] = None # Char for TYPE/PRESS
    duration: float = 0.0 # Duration for WAIT


class TypingBot:
    """
    Simulates human-like typing behavior with realistic errors and bursts.
    """
    
    def __init__(self, config: BotConfig, words: List[str]):
        self.config = config
        self.words = words
        self.current_word_index = 0
        self.current_char_index = 0
        
        self.chars_typed = 0
        self.errors = 0
        self.words_completed = 0
        
        self._running = False
        self._action_queue: List[BotAction] = []
        
        # Internal state
        self._current_speed_mult = 1.0 # Multiplier for current typing speed
    
    @property
    def progress(self) -> int:
        return self.chars_typed
        
    def get_result(self) -> dict:
        """Get bot's final stats"""
        # Calculate naive WPM for display based on config target, 
        # actual effective WPM comes from the simulation duration.
        return {
            "wpm": self.config.target_wpm, 
            "accuracy": self.config.accuracy * 100, # Show target accuracy as stat
            "chars_typed": self.chars_typed,
            "words_completed": self.words_completed,
            "errors": self.errors
        }
        
    def _calculate_base_delay(self) -> float:
        """Calculate delay per keystroke in seconds based on target WPM"""
        # WPM = (chars / 5) / minutes
        # chars/sec = (WPM * 5) / 60 = WPM / 12
        # delay = 1 / (chars/sec) = 12 / WPM
        return 12.0 / (self.config.target_wpm * self._current_speed_mult)

    def _queue_next_word_actions(self):
        """Analyze next word and queue actions to type it"""
        if self.current_word_index >= len(self.words):
            return

        target_word = self.words[self.current_word_index]
        
        # 1. Determine Speed for this word
        difficulty = len(target_word)
        if difficulty < 4 and random.random() < self.config.burst_probability:
            # Burst on short words
            self._current_speed_mult = random.uniform(1.1, 1.3)
        elif difficulty > 7:
             # Slow down on long words (scaled by bot skill)
             # Higher WPM bots handle long words better
             skill_factor = min(1.0, self.config.target_wpm / 150.0)
             min_slow = 0.75 + (0.2 * skill_factor) # 0.75 -> 0.95
             max_slow = 0.90 + (0.1 * skill_factor) # 0.90 -> 1.0
             
             self._current_speed_mult = random.uniform(min_slow, max_slow)
        else:
            self._current_speed_mult = 1.0
            
        base_delay = self._calculate_base_delay()
        
        # 2. Queue actions for each character
        for char in target_word:
            # Check for error
            if random.random() > self.config.accuracy:
                # Make a Mistake!
                self.errors += 1
                wrong_char = get_neighbor_key(char)
                
                # Action: Type wrong char
                self._action_queue.append(BotAction(ActionType.PRESS, wrong_char))
                
                # Reaction time (realization delay)
                # Humans take ~150-300ms to realize they made a typo
                reaction_delay = random.uniform(0.15, 0.3)
                self._action_queue.append(BotAction(ActionType.WAIT, duration=reaction_delay))
                
                # Action: Backspace
                self._action_queue.append(BotAction(ActionType.BACKSPACE))
                
                # Action: Type correct char (often faster as they know it now)
                self._current_speed_mult *= self.config.correction_speed 
                self._action_queue.append(BotAction(ActionType.TYPE, char))
                
            else:
                # Type correctly
                self._action_queue.append(BotAction(ActionType.TYPE, char))
                
        # 3. Space at the end actions
        self._action_queue.append(BotAction(ActionType.TYPE, " "))
        
        # Small pause between words?
        # Small pause between words to simulate thinking/reading next word
        base_word_delay = 60 / self.config.target_wpm 
        # Human pause is roughly 150-300ms depending on speed
        word_pause = random.uniform(0.05, 0.15) + (base_word_delay * 0.1)
        self._action_queue.append(BotAction(ActionType.WAIT, duration=word_pause))

    async def run(
        self,
        duration: int,
        on_progress: Callable[[int, int], Awaitable[None]]
    ) -> None:
        """Run the bot simulation"""
        self._running = True
        self._action_queue = []
        start_time = asyncio.get_event_loop().time()
        
        # Initial wait (simulate reaction/reading time)
        await asyncio.sleep(random.uniform(0.2, 0.5))
        
        while self._running:
            # Check time
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed >= duration:
                break
                
            # If queue empty, plan next word
            if not self._action_queue:
                if self.current_word_index >= len(self.words):
                    break
                self._queue_next_word_actions()
                
            # Pop next action
            if not self._action_queue:
                break
                
            action = self._action_queue.pop(0)
            
            # Execute Action
            if action.type == ActionType.WAIT:
                await asyncio.sleep(action.duration)
                
            elif action.type == ActionType.TYPE or action.type == ActionType.PRESS:
                # Calculate delay with variance
                base_delay = self._calculate_base_delay()
                variance = random.gauss(0, base_delay * self.config.variance)
                actual_delay = max(0.02, base_delay + variance)
                
                await asyncio.sleep(actual_delay)
                
                if not self._running: break
                
                # Update State
                if action.type == ActionType.TYPE:
                    char = action.value
                    if char == " ":
                        # Word complete
                        self.words_completed += 1 # Internal tracker
                        self.current_word_index += 1
                        self.current_char_index = 0
                        self.chars_typed += 1
                        # Wait slightly longer on space usually
                        await asyncio.sleep(random.uniform(0.01, 0.05))
                    else:
                        self.current_char_index += 1
                        self.chars_typed += 1
                        
                elif action.type == ActionType.PRESS:
                    # Just typing a wrong character physically, 
                    # For the progress tracker, we might assume the client tolerates extra chars 
                    # but our internal progress tracker (on_progress) expects clean state 
                    # usually. However, to simulate "real" progress we should probably NOT 
                    # advance the char index if it's an error that gets backspaced... 
                    # BUT, Evotaion's Game engine tracks strictly index-based matching usually.
                    # To keep it simple for the backend "progress" endpoint:
                    # We will only report 'clean' progress to the user to avoid jittery opponent cursors
                    # causing confusion, OR we just simulate the time loss without sending the 
                    # wrong char index update.
                    
                    # DECISION: We simulate the TIME taken to error, but we do not send 
                    # the "wrong" index to the opponent. The opponent just sees the bot 
                    # pause (making the error) and then continue.
                    pass 
                
            elif action.type == ActionType.BACKSPACE:
                # Simulating backspace time
                await asyncio.sleep(random.uniform(0.08, 0.15))
                # No state update needed effectively as we didn't advance state on PRESS
                pass

            # Report Progress (Only if state changed and is valid)
            # We only report when we successfully TYPE a character or SPACE
            if action.type == ActionType.TYPE:
                try:
                    await on_progress(self.current_char_index, self.current_word_index)
                except Exception:
                    pass

    def stop(self) -> None:
        self._running = False


def create_bot_for_player(player_elo: int, words: List[str], player_avg_wpm: float = 0) -> TypingBot:
    """Create a bot configured to match the player's skill level.
    
    Args:
        player_elo: Player's ELO rating
        words: List of words for the match
        player_avg_wpm: Player's average WPM (used for more accurate bot difficulty)
    """
    config = BotConfig.from_player_stats(player_elo, player_avg_wpm)
    return TypingBot(config, words)

