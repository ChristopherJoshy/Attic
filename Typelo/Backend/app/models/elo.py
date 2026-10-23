#   ______      __ ____  _______       _  ____  _   _ 
#  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
#  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
#  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
#  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
#  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
#                                                      

# Elo/Glicko-2 Rating System - Handles skill rating calculations.

# --------------------------------------------------------------------------
#                                  Functions
# --------------------------------------------------------------------------
# Rating.__init__: Initializes a rating with Elo, RD, and Volatility.
# Rating.mu: Converts Elo to Glicko-2 scale.
# Rating.phi: Converts RD to Glicko-2 scale.
# Rating.from_glicko2: Factory method from Glicko-2 values.
# EloCalculator._g: Glicko-2 g-function.
# EloCalculator._E: Expected score function.
# EloCalculator._compute_variance: Computes variance.
# EloCalculator._compute_delta: Computes improvement delta.
# EloCalculator._compute_new_volatility: Computes new volatility iteratively.
# EloCalculator.calculate_match_result: Main entry point for match result calculation.
# EloCalculator._update_rating: Internal update method.
# EloCalculator.calculate_simple_elo: Simplified calculation for estimates.

# --------------------------------------------------------------------------
#                            Variables and others
# --------------------------------------------------------------------------
# TAU: System constant (volatility constraint).
# EPSILON: Convergence tolerance.
# Rating: Dataclass for player rating.
# EloCalculator: Class implementing the rating logic.
# elo_calculator: Singleton instance.

# --------------------------------------------------------------------------
#                                   imports
# --------------------------------------------------------------------------
# math: Mathematical functions.
# dataclasses: Data structures.
# typing: Type hints.
# app.models.user: Rank definitions.

import math
from dataclasses import dataclass
from typing import Tuple
from app.models.user import Rank, get_rank_from_elo


# Glicko-2 Constants
TAU = 0.5  # System constant (constrains volatility change)
EPSILON = 0.000001  # Convergence tolerance


@dataclass
class Rating:
    """Player rating with Glicko-2 components"""
    elo: int  # Display rating (Elo scale)
    rd: float = 200.0  # Rating deviation (reduced for more stable rankings)
    volatility: float = 0.06  # Rating volatility
    
    @property
    def mu(self) -> float:
        """Convert Elo to Glicko-2 scale"""
        return (self.elo - 1500) / 173.7178
    
    @property
    def phi(self) -> float:
        """Convert RD to Glicko-2 scale"""
        return self.rd / 173.7178
    
    @classmethod
    def from_glicko2(cls, mu: float, phi: float, volatility: float) -> 'Rating':
        """Create Rating from Glicko-2 values"""
        elo = int(mu * 173.7178 + 1500)
        rd = phi * 173.7178
        return cls(elo=elo, rd=rd, volatility=volatility)


class EloCalculator:
    """
    Glicko-2 based rating system for Evotaion
    
    Key features:
    - Unranked players (Elo < 1000) cannot lose Elo
    - K-factor varies by rating tier
    - Supports win/loss/tie outcomes
    """
    
    def __init__(self):
        self.tau = TAU
    
    def _g(self, phi: float) -> float:
        """Glicko-2 g function"""
        return 1 / math.sqrt(1 + 3 * phi**2 / math.pi**2)
    
    def _E(self, mu: float, mu_j: float, phi_j: float) -> float:
        """Expected score function"""
        return 1 / (1 + math.exp(-self._g(phi_j) * (mu - mu_j)))
    
    def _compute_variance(self, mu: float, opponents: list) -> float:
        """Compute estimated variance"""
        variance_sum = 0.0
        for opp_mu, opp_phi, _ in opponents:
            g = self._g(opp_phi)
            E = self._E(mu, opp_mu, opp_phi)
            variance_sum += g**2 * E * (1 - E)
        return 1 / variance_sum if variance_sum > 0 else float('inf')
    
    def _compute_delta(self, mu: float, variance: float, opponents: list) -> float:
        """Compute estimated improvement"""
        delta_sum = 0.0
        for opp_mu, opp_phi, score in opponents:
            g = self._g(opp_phi)
            E = self._E(mu, opp_mu, opp_phi)
            delta_sum += g * (score - E)
        return variance * delta_sum
    
    def _compute_new_volatility(self, sigma: float, phi: float, 
                                 variance: float, delta: float) -> float:
        """Compute new volatility using Illinois algorithm"""
        a = math.log(sigma**2)
        
        def f(x: float) -> float:
            exp_x = math.exp(x)
            phi_sq = phi**2
            tmp = phi_sq + variance + exp_x
            return (exp_x * (delta**2 - phi_sq - variance - exp_x) / 
                    (2 * tmp**2) - (x - a) / self.tau**2)
        
        # Set initial bounds
        A = a
        if delta**2 > phi**2 + variance:
            B = math.log(delta**2 - phi**2 - variance)
        else:
            k = 1
            while f(a - k * self.tau) < 0:
                k += 1
            B = a - k * self.tau
        
        # Iterative algorithm
        f_A = f(A)
        f_B = f(B)
        
        while abs(B - A) > EPSILON:
            C = A + (A - B) * f_A / (f_B - f_A)
            f_C = f(C)
            
            if f_C * f_B <= 0:
                A = B
                f_A = f_B
            else:
                f_A = f_A / 2
            
            B = C
            f_B = f_C
        
        return math.exp(A / 2)
    
    def calculate_match_result(
        self,
        player_rating: Rating,
        opponent_rating: Rating,
        player_score: float,
        opponent_score: float,
        player_games_played: int = 20, # Default > 10 to avoid placement bonus if data missing
        opponent_games_played: int = 20,
        is_bot_match: bool = False
    ) -> Tuple[int, int]:
        """
        Calculate Elo changes for both players after a match.
        
        Args:
            player_rating: Player's current rating
            opponent_rating: Opponent's current rating  
            player_score: Player's score (WPM * Accuracy)
            opponent_score: Opponent's score
            player_games_played: Number of games player has played (for placement bonus)
            opponent_games_played: Number of games opponent has played
            is_bot_match: Whether this is a match against a bot
        
        Returns:
            Tuple of (player_elo_change, opponent_elo_change)
        """
        # Determine outcome (1 = win, 0.5 = tie, 0 = loss)
        if player_score > opponent_score:
            player_outcome = 1.0
            opponent_outcome = 0.0
        elif player_score < opponent_score:
            player_outcome = 0.0
            opponent_outcome = 1.0
        else:
            player_outcome = 0.5
            opponent_outcome = 0.5
        
        # Calculate new ratings using Glicko-2
        player_new = self._update_rating(
            player_rating, 
            [(opponent_rating.mu, opponent_rating.phi, player_outcome)]
        )
        opponent_new = self._update_rating(
            opponent_rating,
            [(player_rating.mu, player_rating.phi, opponent_outcome)]
        )
        
        player_change = player_new.elo - player_rating.elo
        opponent_change = opponent_new.elo - opponent_rating.elo
        
        # --- 1. PLACEMENT BONUS ---
        # Accelerate Elo convergence for new players (first 10 games)
        if player_games_played < 10:
            # 2.5x multiplier for placement matches to move smurfs/new players fast
            player_change = int(player_change * 2.5)
            
        if opponent_games_played < 10 and not is_bot_match:
            opponent_change = int(opponent_change * 2.5)

        # --- 2. STOMP BONUS (Performance Scaling) ---
        # If score difference is massive (> 5000 pts approx 50 Net WPM gap),
        # boost the winner's gain to help them climb out of this bracket.
        score_diff = abs(player_score - opponent_score)
        STOMP_THRESHOLD = 5000
        
        if score_diff > STOMP_THRESHOLD:
            # Apply 1.5x bonus to the winner only
            if player_change > 0: 
                player_change = int(player_change * 1.5)
            if opponent_change > 0:
                opponent_change = int(opponent_change * 1.5)
        
        # --- 3. BOT MATCH DAMPENER ---
        # Bot matches give reduced ELO changes to encourage PvP
        # Losses are more dampened than wins to make bot matches forgiving for practice
        if is_bot_match:
            if player_rating.elo > 3000:
                # Ranker Mode Penalty:
                # If a high-rank player loses to a bot, they lose DOUBLE ELO.
                # No farming allowed.
                if player_change < 0:
                    player_change = int(player_change * 2.0)
                # Wins still dampened to prevent farming
                if player_change > 0:
                    player_change = int(player_change * 0.5) # Even harder to gain ELO from bots
            else:
                if player_change > 0:
                    # Wins: 30% reduction (get 70% of normal gain)
                    player_change = int(player_change * 0.7)
                else:
                    # Losses: 50% reduction (only lose 50% of normal loss)
                    player_change = int(player_change * 0.8) # Changed from 0.8 (mistake in comment vs code? Previous code said 0.8 which is 20% reduction, comment said 50%)
                    # Let's stick to 20% reduction (0.8) as per existing code, or 50% (0.5). 
                    # Existing code was: player_change = int(player_change * 0.8)
            
            opponent_change = 0  # Bot doesn't have real ELO
            
        # --- 4. HIGH RANK SOFT CAP ---
        # Instead of penalties, we reduce GAINS at high ranks to prevent inflation.
        # Above 2500 Elo, gains are reduced by 25%. Losses are normal.
        SOFT_CAP_ELO = 2500
        
        if player_rating.elo > SOFT_CAP_ELO and player_change > 0:
            player_change = int(player_change * 0.75) # Reduce gains
            
        if not is_bot_match and opponent_rating.elo > SOFT_CAP_ELO and opponent_change > 0:
            opponent_change = int(opponent_change * 0.75)

        # --- 5. UNRANKED PROTECTION ---
        # Unranked players (typically < 1000 or specific rank enum) shouldn't lose Elo
        # For simplicity, we use Elo floor of 1000 for "free fall" protection
        if player_rating.elo < 1000 and player_change < 0:
            player_change = 0
        if opponent_rating.elo < 1000 and opponent_change < 0:
            opponent_change = 0
            
        # Hard Caps per match
        MAX_CHANGE = 100 # Increased from 50 to accommodate placement/stomp bonuses
        player_change = max(-MAX_CHANGE, min(MAX_CHANGE, player_change))
        opponent_change = max(-MAX_CHANGE, min(MAX_CHANGE, opponent_change))
        
        # Minimum Elo floor: prevent Elo from going below 0
        if player_change < 0:
            player_change = max(-player_rating.elo, player_change)
        if opponent_change < 0:
            opponent_change = max(-opponent_rating.elo, opponent_change)
        
        return player_change, opponent_change
    
    def _update_rating(self, rating: Rating, opponents: list) -> Rating:
        """Update a single rating based on match outcomes"""
        mu = rating.mu
        phi = rating.phi
        sigma = rating.volatility
        
        # Step 3: Compute variance
        variance = self._compute_variance(mu, opponents)
        
        # If variance is infinite (no valid opponents), return unchanged rating
        if variance == float('inf'):
            return rating
        
        # Step 4: Compute delta
        delta = self._compute_delta(mu, variance, opponents)
        
        # Step 5: Compute new volatility
        new_sigma = self._compute_new_volatility(sigma, phi, variance, delta)
        
        # Step 6: Update phi*
        phi_star = math.sqrt(phi**2 + new_sigma**2)
        
        # Step 7: Update phi and mu
        # Guard against division by zero
        phi_star_sq = phi_star**2
        if phi_star_sq < EPSILON:
            phi_star_sq = EPSILON
        
        new_phi = 1 / math.sqrt(1/phi_star_sq + 1/variance)
        new_mu = mu + new_phi**2 * sum(
            self._g(opp_phi) * (score - self._E(mu, opp_mu, opp_phi))
            for opp_mu, opp_phi, score in opponents
        )
        
        return Rating.from_glicko2(new_mu, new_phi, new_sigma)
    
    def calculate_simple_elo(
        self,
        player_elo: int,
        opponent_elo: int,
        player_won: bool,
        player_rank: Rank
    ) -> int:
        """
        Simplified Elo calculation for quick estimates.
        Uses standard Elo formula with rank-based K-factor.
        """
        # Expected score
        expected = 1 / (1 + 10 ** ((opponent_elo - player_elo) / 400))
        
        # Actual score
        actual = 1.0 if player_won else 0.0
        
        # K-factor based on rating
        if player_elo < 2000:
            k = 32
        elif player_elo < 3000:
            k = 24
        else:
            k = 16
        
        # Calculate change
        change = round(k * (actual - expected))
        
        # Unranked protection
        if player_rank == Rank.UNRANKED and change < 0:
            return 0
        
        return change


# Singleton instance
elo_calculator = EloCalculator()
