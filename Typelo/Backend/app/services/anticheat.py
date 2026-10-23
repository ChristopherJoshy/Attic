#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Anti-cheat service - Server-side validation of player input and stats calculation.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# AntiCheatService.validate_keystroke: Validates individual keystrokes (latency, order).
# AntiCheatService.validate_keystroke_sequence: Validates a full sequence of keystrokes.
# AntiCheatService._check_variance: Internal check for superhumanly consistent typing (bot detection).
# AntiCheatService._check_wpm: Internal check for physically impossible WPM.
# AntiCheatService.calculate_score: Calculates Net WPM score.
# AntiCheatService.calculate_player_stats: Calculates full player stats (WPM, Accuracy, Score) from keystroke data.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# Keystroke: Dataclass for a single keystroke event.
# ValidationResult: Dataclass for the result of a validation check.
# AntiCheatService: Singleton service class.
# anti_cheat_service: Singleton instance.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# statistics: Math stats.
# typing: Type hints.
# dataclasses: Data structures.
# app.config.get_settings: App settings.

import statistics
from typing import List, Tuple
from dataclasses import dataclass

from app.config import get_settings


@dataclass
class Keystroke:
    """Individual keystroke event"""
    char: str
    timestamp: int  # Unix timestamp in milliseconds
    char_index: int


@dataclass
class ValidationResult:
    """Result of anti-cheat validation"""
    valid: bool
    reason: str = ""
    flagged: bool = False  # For review, not rejection


class AntiCheatService:
    """
    Server-side validation of player input to detect cheating.
    
    Validation checks:
    1. Minimum keystroke latency (< 20ms is impossible)
    2. Maximum WPM threshold (> 250 WPM is suspicious)
    3. Variance check (< 10% variance = bot-like)
    4. Sequence validation (keystrokes out of order)
    """
    
    def __init__(self):
        self.settings = get_settings()
    
    def validate_keystroke(
        self, 
        keystroke: Keystroke, 
        previous: Keystroke | None
    ) -> ValidationResult:
        """Validate a single keystroke against the previous one"""
        if previous is None:
            return ValidationResult(valid=True)
        
        # Check latency
        latency = keystroke.timestamp - previous.timestamp
        
        # Allow negative latency (backspace creates lower char_index)
        # Only check if moving forward in time
        if latency > 0 and latency < 15:  # 15ms threshold
            # FLAG ONLY - Do not reject input
            # High-skill typists can burst < 15ms. Blocking this bricks the game.
            return ValidationResult(
                valid=True,
                flagged=True,
                reason=f"Suspiciously low latency: {latency}ms"
            )
        
        # Allow out-of-sequence keystrokes (backspace/correction is valid)
        # Just track for analysis but don't block
        if keystroke.char_index != previous.char_index + 1:
            return ValidationResult(
                valid=True,  # Allow the keystroke
                flagged=False,  # Don't even flag it - backspace is normal
                reason=""
            )
        
        return ValidationResult(valid=True)
    
    def validate_keystroke_sequence(
        self, 
        keystrokes: List[Keystroke]
    ) -> ValidationResult:
        """Validate a complete sequence of keystrokes"""
        if len(keystrokes) < 2:
            return ValidationResult(valid=True)
        
        latencies = []
        
        for i in range(1, len(keystrokes)):
            prev = keystrokes[i - 1]
            curr = keystrokes[i]
            
            # Check individual keystroke
            result = self.validate_keystroke(curr, prev)
            if not result.valid:
                return result
            
            latency = curr.timestamp - prev.timestamp
            if latency > 0:  # Ignore invalid latencies
                latencies.append(latency)
        
        # Check variance (bot detection)
        if len(latencies) >= 10:
            variance_result = self._check_variance(latencies)
            if not variance_result.valid:
                return variance_result
        
        # Check WPM
        wpm_result = self._check_wpm(keystrokes)
        if not wpm_result.valid:
            return wpm_result
        
        return ValidationResult(valid=True)
    
    def _check_variance(self, latencies: List[int]) -> ValidationResult:
        """Check if keystroke variance is suspiciously low (bot-like)"""
        if len(latencies) < 10:
            return ValidationResult(valid=True)
        
        try:
            variance = statistics.variance(latencies)
            mean = statistics.mean(latencies)
            
            if mean == 0:
                return ValidationResult(valid=True)
            
            # Coefficient of variation
            cv = (variance ** 0.5) / mean
            
            if cv < self.settings.keystroke_variance_threshold:
                return ValidationResult(
                    valid=False,
                    reason=f"Keystroke variance too consistent: CV={cv:.3f}"
                )
        except statistics.StatisticsError:
            pass
        
        return ValidationResult(valid=True)
    
    def _check_wpm(self, keystrokes: List[Keystroke]) -> ValidationResult:
        """Check if WPM is physically possible"""
        if len(keystrokes) < 2:
            return ValidationResult(valid=True)
        
        # Calculate WPM from keystrokes
        first = keystrokes[0]
        last = keystrokes[-1]
        
        duration_ms = last.timestamp - first.timestamp
        if duration_ms <= 0:
            return ValidationResult(valid=True)
        
        chars_typed = len(keystrokes)
        duration_minutes = duration_ms / 60000
        
        # WPM = (chars / 5) / minutes
        wpm = (chars_typed / 5) / duration_minutes if duration_minutes > 0 else 0
        
        if wpm > self.settings.max_wpm_threshold:
            return ValidationResult(
                valid=False,
                reason=f"WPM exceeds maximum threshold: {wpm:.0f} WPM"
            )
        
        return ValidationResult(valid=True)
    
    def calculate_score(
        self,
        chars_typed: int,
        errors: int,
        duration_seconds: float
    ) -> float:
        """
        Calculate standardized score (Net WPM).
        Net WPM = ((Chars - Errors) / 5) / Minutes
        
        This is the industry standard competitive typing metric (MonkeyType, etc).
        """
        if duration_seconds <= 0:
            return 0.0
            
        minutes = duration_seconds / 60
        
        # Net Words = (Chars - Errors) / 5
        # We subtract errors to penalize mistakes
        net_words = max(0, (chars_typed - errors) / 5)
        
        net_wpm = net_words / minutes
        
        return round(net_wpm, 1)

    def calculate_player_stats(
        self, 
        keystrokes: List[Keystroke],
        expected_text: str,
        duration_seconds: int,
        words_completed: int = 0,
        chars_typed: int = 0,
        errors: int = 0
    ) -> Tuple[float, float, float]:
        """
        Calculate player's Net WPM, accuracy, and score.
        Score prioritizes words completed, then speed.
        
        If keystrokes list is empty but chars_typed > 0, use fallback calculation.
        """
        time_seconds = max(duration_seconds, 0.1)
        minutes = time_seconds / 60
        
        if not keystrokes:
            # Fallback: Use chars_typed and errors if provided (for cases where keystroke tracking failed)
            if chars_typed > 0:
                accuracy_percent = ((chars_typed - errors) / max(1, chars_typed)) * 100
                gross_wpm = (chars_typed / 5) / minutes
                net_wpm = self.calculate_score(chars_typed, errors, time_seconds)
                wpm_score = net_wpm * 10
                progress_bonus = words_completed * 5
                accuracy_multiplier = accuracy_percent / 100
                score = (wpm_score + progress_bonus) * accuracy_multiplier
                return round(gross_wpm, 1), round(accuracy_percent, 1), round(score, 1)
            # No keystrokes and no chars_typed - return 0
            return 0.0, 0.0, 0.0
        
        total_chars = len(expected_text)
        total_keystrokes = len(keystrokes)
        
        # Count correct characters
        # Reset errors and correct_chars for keystroke-based calculation
        errors = 0 
        correct_chars = 0
        
        for ks in keystrokes:
            if ks.char_index < total_chars:
                if ks.char == expected_text[ks.char_index]:
                    correct_chars += 1
                else:
                    errors += 1
        
        # Calculate typing duration - use actual game duration to prevent burst typing exploitation
        # Previously used keystroke timestamps which allowed winning by typing 1 word fast and stopping
        time_seconds = max(duration_seconds, 0.1)
            
        minutes = time_seconds / 60
        
        # Accuracy - based on typed attempts (correct + errors), not total keystrokes
        # This ensures backspace corrections don't unfairly lower accuracy
        typed_attempts = correct_chars + errors
        accuracy_percent = (correct_chars / max(1, typed_attempts)) * 100
        
        # Gross WPM - uses CORRECT characters only to prevent inflation from key spamming
        gross_wpm = (correct_chars / 5) / minutes
        
        # Net WPM - uses correct_chars to properly reward accuracy + speed
        # Previously used len(keystrokes) which penalized corrections unfairly
        net_wpm = self.calculate_score(correct_chars, errors, time_seconds)
        
        # SCORE: Improved Competitive Formula
        # Source: design_scoring_elo.md
        # 1. Net WPM is the primary driver (Speed - Errors)
        # 2. Accuracy is additive, not multiplicative (preserves speed advantage)
        # 3. Progress bonus breaks ties for identical speed/accuracy
        
        # Formula: (NetWPM * 100) + (Accuracy_Percent * 10) + (WordsCompleted * 5)
        wpm_score = net_wpm * 100
        accuracy_score = accuracy_percent * 10
        progress_score = words_completed * 5
        
        score = wpm_score + accuracy_score + progress_score
        
        return round(gross_wpm, 1), accuracy_percent, round(score, 1)


# Singleton instance
anti_cheat_service = AntiCheatService()
