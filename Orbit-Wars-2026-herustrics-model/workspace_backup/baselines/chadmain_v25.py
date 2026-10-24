"""
CHADMAN v24 top-10 replay-search hybrid — v23 adaptive NumPy RL engine plus
phase-conditioned replay priors and confidence-aware search.

The RL layer is intentionally compact: mined replay priors seed a contextual
bandit, then the bandit adjusts mission weights during the first 100 turns from
live production, capture, retention, and ship-loss signals.  The heavy lifting
stays in deterministic forward simulation, trajectory prediction, and mission
search so the agent remains fast inside Kaggle's per-turn budget.

Upgrades vs v19:
  ── CORE SEARCH (biggest wins) ──────────────────────────────────────────────
  1. FastForwardSim: lightweight N-turn forward simulator.
     Replaces empire_state_score proxy with actual simulated ship/planet deltas.
     Runs in ~0.3 ms per 15-turn sim; fits comfortably within deadline budget.

  2. Adversarial rollout in beam: for each beam node, sample up to
     ADVERSARIAL_SAMPLE_K likely enemy responses, simulate both sides N turns,
     pick the action sequence that wins *on average* against those responses.
     This is minimax-lite without full tree expansion.

  3. Time-split actions: beam no longer hard-locks a source after one use.
     Sources can contribute a second wave (at turn+SPLIT_WAVE_DELAY) if enough
     ships remain. This unlocks time-staggered attacks, a dominant strategy
     in Galcon-style games that v19 completely blocked.

  ── WEAKNESS DETECTION ──────────────────────────────────────────────────────
  4. Dynamic weakness detection: WEAK_ENEMY_THRESHOLD replaced by a ratio
     check (enemy_strength / my_strength < WEAK_ENEMY_RATIO). Adapts as the
     game evolves instead of using a fixed ship count.

  5. Production-ratio weakness gate: an enemy is "weak" only if BOTH their
     ship count is below the ratio AND their production is ≤ ours. Prevents
     over-focusing on a consolidating enemy that appears temporarily depleted.

  ── DEFENSE ─────────────────────────────────────────────────────────────────
  6. Exact threat-based garrison: proactive keep is now computed from the
     minimum exact fleet needed to survive against the fastest reachable enemy
     fleet, rather than a fixed PROACTIVE_DEFENSE_RATIO multiplier.
     Saves ~5–15% wasted garrison ships per defended planet on average.

  ── SEARCH BUDGET ───────────────────────────────────────────────────────────
  7. Deadline-aware beam: tracks elapsed time per depth level, dynamically
     reduces beam_width if falling behind, and always finishes cleanly.

  ── TUNING ──────────────────────────────────────────────────────────────────
  8. gamma raised 0.92→0.94 (value future actions more).
  9. Beam depth raised: 5→6 (2P), 3→4 (4P dense).
  10. WEAK_ENEMY_RATIO = 0.55 (replaces hardcoded threshold of 150).
  11. SPLIT_WAVE_DELAY = 6 turns between first and second wave from same source.
  12. ADVERSARIAL_SAMPLE_K = 3 opponent responses sampled per beam node.
  13. SIM_FORWARD_TURNS = 15 steps for fast-forward simulation scoring.
"""

import math
import time
from collections import defaultdict, namedtuple, deque
from dataclasses import dataclass, field
import numpy as np

_dd = defaultdict
_PLANET_POS_CACHE_X = None
_PLANET_POS_CACHE_Y = None
_PLANET_POS_CACHE_HORIZON = -1

_META_ARMS = (
    "expansion",
    "pressure",
    "retention",
    "comet",
    "safety",
    "weakest",
)

# ============================================================
# Shared Configuration
# ============================================================

BOARD = 100.0
CENTER_X = 50.0
CENTER_Y = 50.0
SUN_R = 10.0
MAX_SPEED = 6.0
SUN_SAFETY = 1.5
ROTATION_LIMIT = 50.0
TOTAL_STEPS = 500
SIM_HORIZON = 75
ROUTE_SEARCH_HORIZON = 45
HORIZON = SIM_HORIZON
LAUNCH_CLEARANCE = 0.1

EARLY_TURN_LIMIT = 40
OPENING_TURN_LIMIT = 80
LATE_REMAINING_TURNS = 70          # was 60 — enter late-game earlier
VERY_LATE_REMAINING_TURNS = 25
TOTAL_WAR_REMAINING_TURNS = 60

SAFE_NEUTRAL_MARGIN = 2
CONTESTED_NEUTRAL_MARGIN = 2
INTERCEPT_TOLERANCE = 1

SAFE_OPENING_PROD_THRESHOLD = 4
SAFE_OPENING_TURN_LIMIT = 10
ROTATING_OPENING_MAX_TURNS = 13
ROTATING_OPENING_LOW_PROD = 2
FOUR_PLAYER_ROTATING_REACTION_GAP = 3
FOUR_PLAYER_ROTATING_SEND_RATIO = 0.54  # was 0.62 — less overcommit in 4P
FOUR_PLAYER_ROTATING_TURN_LIMIT = 10

COMET_MAX_CHASE_TURNS = 10

ATTACK_COST_TURN_WEIGHT = 0.50
SNIPE_COST_TURN_WEIGHT = 0.42
INDIRECT_VALUE_SCALE = 0.15
INDIRECT_FRIENDLY_WEIGHT = 0.35
INDIRECT_NEUTRAL_WEIGHT = 0.9
INDIRECT_ENEMY_WEIGHT = 1.25

STATIC_NEUTRAL_VALUE_MULT = 1.4
STATIC_HOSTILE_VALUE_MULT = 1.65
ROTATING_OPENING_VALUE_MULT = 0.9
HOSTILE_TARGET_VALUE_MULT = 2.05   # was 1.95
OPENING_HOSTILE_TARGET_VALUE_MULT = 1.55
SAFE_NEUTRAL_VALUE_MULT = 1.2
CONTESTED_NEUTRAL_VALUE_MULT = 0.7
EARLY_NEUTRAL_VALUE_MULT = 1.2
COMET_VALUE_MULT = 0.65
SNIPE_VALUE_MULT = 1.12
SWARM_VALUE_MULT = 1.05
REINFORCE_VALUE_MULT = 1.35
CRASH_EXPLOIT_VALUE_MULT = 1.18
FINISHING_HOSTILE_VALUE_MULT = 1.3  # was 1.2
BEHIND_ROTATING_NEUTRAL_VALUE_MULT = 0.92
EXPOSED_PLANET_VALUE_MULT = 2.0    # was 1.75

# NEW: weakest enemy targeting multipliers
WEAKEST_ENEMY_VALUE_MULT_4P = 1.5   # bonus for targeting weakest in 4P
WEAKEST_ENEMY_VALUE_MULT_2P = 1.25  # bonus for targeting weakest in 1v1
GANG_UP_VALUE_MULT = 1.55
GANG_UP_POST_BATTLE_DELAY = 2       # turns after battle to arrive
GANG_UP_ETA_WINDOW = 4              # tolerance window for gang-up timing

NEUTRAL_MARGIN_BASE = 2
NEUTRAL_MARGIN_PROD_WEIGHT = 2
NEUTRAL_MARGIN_CAP = 8
HOSTILE_MARGIN_BASE = 3
HOSTILE_MARGIN_PROD_WEIGHT = 2
HOSTILE_MARGIN_CAP = 12
STATIC_TARGET_MARGIN = 4
CONTESTED_TARGET_MARGIN = 5
FOUR_PLAYER_TARGET_MARGIN = 2       # was 3 — more efficient in 4P
LONG_TRAVEL_MARGIN_START = 18
LONG_TRAVEL_MARGIN_DIVISOR = 3
LONG_TRAVEL_MARGIN_CAP = 8
COMET_MARGIN_RELIEF = 6
FINISHING_HOSTILE_SEND_BONUS = 3

STATIC_TARGET_SCORE_MULT = 1.18
EARLY_STATIC_NEUTRAL_SCORE_MULT = 1.25
FOUR_PLAYER_ROTATING_NEUTRAL_SCORE_MULT = 0.84
DENSE_STATIC_NEUTRAL_COUNT = 4
DENSE_ROTATING_NEUTRAL_SCORE_MULT = 0.86
SNIPE_SCORE_MULT = 1.12
SWARM_SCORE_MULT = 1.06
CRASH_EXPLOIT_SCORE_MULT = 1.05

FOLLOWUP_MIN_SHIPS = 8
LOW_VALUE_COMET_PRODUCTION = 1
LATE_CAPTURE_BUFFER = 5
VERY_LATE_CAPTURE_BUFFER = 3

DEFENSE_LOOKAHEAD_TURNS = 28
DEFENSE_COST_TURN_WEIGHT = 0.4
DEFENSE_FRONTIER_SCORE_MULT = 1.12
DEFENSE_SEND_MARGIN_BASE = 1
DEFENSE_SEND_MARGIN_PROD_WEIGHT = 1
DEFENSE_SHIP_VALUE = 0.55

REINFORCE_ENABLED = True
REINFORCE_MIN_PRODUCTION = 2
REINFORCE_MAX_TRAVEL_TURNS = 22
REINFORCE_SAFETY_MARGIN = 2
REINFORCE_MAX_SOURCE_FRACTION = 0.62
REINFORCE_MIN_FUTURE_TURNS = 40
REINFORCE_HOLD_LOOKAHEAD = 20
REINFORCE_COST_TURN_WEIGHT = 0.35

RECAPTURE_LOOKAHEAD_TURNS = 10
RECAPTURE_COST_TURN_WEIGHT = 0.52
RECAPTURE_VALUE_MULT = 0.88
RECAPTURE_FRONTIER_MULT = 1.08
RECAPTURE_PRODUCTION_WEIGHT = 0.6
RECAPTURE_IMMEDIATE_WEIGHT = 0.4

REAR_SOURCE_MIN_SHIPS = 16
REAR_DISTANCE_RATIO = 1.25
REAR_STAGE_PROGRESS = 0.78
REAR_SEND_RATIO_TWO_PLAYER = 0.62
REAR_SEND_RATIO_FOUR_PLAYER = 0.54
REAR_SEND_MIN_SHIPS = 10
REAR_MAX_TRAVEL_TURNS = 40

PARTIAL_SOURCE_MIN_SHIPS = 6
MULTI_SOURCE_TOP_K = 5
MULTI_SOURCE_ETA_TOLERANCE = 2
MULTI_SOURCE_PLAN_PENALTY = 0.97
HOSTILE_SWARM_ETA_TOLERANCE = 1
THREE_SOURCE_SWARM_ENABLED = True
THREE_SOURCE_MIN_TARGET_SHIPS = 20
THREE_SOURCE_ETA_TOLERANCE = 1
THREE_SOURCE_PLAN_PENALTY = 0.93

PROACTIVE_DEFENSE_HORIZON = 12
PROACTIVE_DEFENSE_RATIO = 0.28
MULTI_ENEMY_PROACTIVE_HORIZON = 14
MULTI_ENEMY_PROACTIVE_RATIO = 0.40
MULTI_ENEMY_STACK_WINDOW = 4        # was 3 — wider detection window
REACTION_SOURCE_TOP_K_MY = 4
REACTION_SOURCE_TOP_K_ENEMY = 4
PROACTIVE_ENEMY_TOP_K = 3

CRASH_EXPLOIT_ENABLED = True
CRASH_EXPLOIT_MIN_TOTAL_SHIPS = 7   # was 10 — exploit smaller crashes too
CRASH_EXPLOIT_ETA_WINDOW = 4        # was 2 — wider window
CRASH_EXPLOIT_POST_CRASH_DELAY = 1

LATE_IMMEDIATE_SHIP_VALUE = 0.75
WEAK_ENEMY_THRESHOLD = 150          # was 60 — detect weak enemies earlier
ELIMINATION_BONUS = 80.0            # was 28.0 — much stronger elimination drive

BEHIND_DOMINATION = -0.20
AHEAD_DOMINATION = 0.15
FINISHING_DOMINATION = 0.28
FINISHING_PROD_RATIO = 1.15
AHEAD_ATTACK_MARGIN_BONUS = 0.12
BEHIND_ATTACK_MARGIN_PENALTY = 0.05
FINISHING_ATTACK_MARGIN_BONUS = 0.12

DOOMED_EVAC_TURN_LIMIT = 24
DOOMED_MIN_SHIPS = 8

SOFT_ACT_DEADLINE = 0.78
HEAVY_PHASE_MIN_TIME = 0.14
OPTIONAL_PHASE_MIN_TIME = 0.06
HEAVY_ROUTE_PLANET_LIMIT = 24

# v18 search pruning defaults (restored to wider limits)
PROBE_CANDIDATE_LIMIT = 12
MAIN_TARGET_TOP_K_TWO_PLAYER = 12
MAIN_TARGET_TOP_K_FOUR_PLAYER = 12
DEFENSE_SOURCE_TOP_K = 6

# ── v21 NEW CONSTANTS ────────────────────────────────────────────────────────
# Forward simulation
SIM_FORWARD_TURNS = 24          # turns to simulate for rollout scoring
SIM_PROD_WEIGHT = 1.0           # weight per production unit × sim turns
SIM_SHIP_WEIGHT = 0.06          # weight per ship in simulated state

# Adversarial sampling
ADVERSARIAL_SAMPLE_K = 3        # number of enemy responses sampled per node
ADVERSARIAL_PENALTY = 0.35      # how much adversarial sim penalises a node score

# Time-split waves
SPLIT_WAVE_ENABLED = True
SPLIT_WAVE_DELAY = 6            # turns between first and second wave
SPLIT_MIN_SHIPS = 8             # minimum ships for a split-wave send
SPLIT_MAX_FRACTION = 0.45       # fraction of remaining ships used in second wave

# Dynamic weakness detection (replaces hard WEAK_ENEMY_THRESHOLD)
WEAK_ENEMY_RATIO = 0.55         # enemy_strength / my_strength < this → weak
WEAK_ENEMY_PROD_GATE = True     # also require enemy production ≤ ours

# Exact garrison: fraction of enemy fleet we must survive (replaces fixed ratio)
EXACT_GARRISON_SAFETY = 1.12    # garrison = ceil(enemy_fleet × this)

# v23 online meta-policy.  These are deliberately small because the underlying
# v22 planner is already strong; the bandit should bias choices, not overwrite
# the tactical engine.
BANDIT_LEARN_TURNS = 100
BANDIT_LR = 0.10
BANDIT_DECAY = 0.996
BANDIT_Q_CLIP = 1.5
BANDIT_VALUE_CLIP = 0.07
BANDIT_INITIAL_Q = {
    "expansion": 0.192274,
    "pressure": 0.350000,
    "retention": 0.198929,
    "comet": -0.012657,
    "safety": 0.167958,
    "weakest": 0.033399,
}
BANDIT_CONTEXT_BIAS = {
    "expansion": 0.030,
    "pressure": 0.025,
    "retention": 0.030,
    "comet": 0.020,
    "safety": 0.030,
    "weakest": 0.020,
}
LOGISTIC_PACKET_CANDIDATE_LIMIT = 10

# Beam tuning
BEAM_GAMMA = 0.94               # discount factor (was 0.92)
BEAM_DEPTH_2P = 6               # beam depth for 2P (was 5)
BEAM_DEPTH_4P_DENSE = 4         # beam depth for 4P dense (was 3)
BEAM_DEPTH_DEFAULT = 5
BEAM_WIDTH_2P = 10              # (was 8)
BEAM_WIDTH_4P = 8               # (was 6)
BEAM_WIDTH_2P_MAX = 14
BEAM_WIDTH_4P_MAX = 9
BEAM_DIVERSITY_TARGET_PENALTY = 0.42
BEAM_DIVERSITY_SOURCE_PENALTY = 0.16
BEAM_DIVERSITY_MISSION_PENALTY = 0.10
BEAM_DIVERSITY_OWNER_PENALTY = 0.10
BEAM_DIVERSITY_MIX_BONUS = 0.24
REPLAY_MIDGAME_TURN = 40
REPLAY_LATE_TURN = 80
REPLAY_MIDGAME_VOLUME_BONUS = 0.22
REPLAY_LATE_VOLUME_BONUS = 0.34
LEADER_DONATION_TAX_4P = 0.94
REPLAY_TEMPO_PRIOR = {
    False: {
        "prod80_gate": 31,
        "late_launch_target": 160,
        "late_capture_target": 16,
        "high_prod_capture_gate": 8,
    },
    True: {
        "prod80_gate": 15,
        "late_launch_target": 76,
        "late_capture_target": 15,
        "high_prod_capture_gate": 7,
    },
}
REPLAY_4P_LEADER_TARGET_TAX = 0.70
REPLAY_4P_WEAKEST_CONTEXT_BASE = 0.20
REPLAY_4P_WEAKEST_LATE_GATE_STEP = 80
REPLAY_4P_WEAKEST_STRENGTH_RATIO_GATE = 0.55
V24_PHASE_PRIORS = {
    False: {
        "opening": {"volume": 0.9641, "capture": 1.2500, "enemy": 0.7500, "neutral": 1.1500, "risk": 1.0114},
        "midgame": {"volume": 1.2313, "capture": 1.3000, "enemy": 1.0600, "neutral": 1.0600, "risk": 1.1000},
        "late": {"volume": 1.4200, "capture": 1.3000, "enemy": 1.3500, "neutral": 0.7500, "risk": 1.1000},
        "endgame": {"volume": 1.4200, "capture": 1.3000, "enemy": 1.4500, "neutral": 0.5000, "risk": 1.1000},
    },
    True: {
        "opening": {"volume": 0.9290, "capture": 1.2839, "enemy": 0.8500, "neutral": 1.1000, "risk": 1.1000},
        "midgame": {"volume": 1.4200, "capture": 1.3000, "enemy": 1.2000, "neutral": 1.0500, "risk": 1.1000},
        "late": {"volume": 1.4200, "capture": 1.3000, "enemy": 0.9500, "neutral": 0.8500, "risk": 0.8400},
        "endgame": {"volume": 1.4200, "capture": 1.3000, "enemy": 1.1000, "neutral": 0.5000, "risk": 0.8400},
    },
}
V24_PORTFOLIO_MAX_SOURCES = 7
V24_PORTFOLIO_TOP_ACTIONS = 18
V24_PORTFOLIO_MIN_ACTIONS = 8
V24_CONFIDENCE_SHIP_PENALTY = 0.18
V24_CONFIDENCE_TIME_PENALTY = 0.022
V24_LEADER_TARGET_TAX = 0.82
V24_CRITICAL_SOURCE_BONUS = 1.08

# ============================================================
# Shared Types
# ============================================================

Planet = namedtuple(
    "Planet", ["id", "owner", "x", "y", "radius", "ships", "production"]
)
Fleet = namedtuple(
    "Fleet", ["id", "owner", "x", "y", "angle", "from_planet_id", "ships"]
)


@dataclass(frozen=True)
class ShotOption:
    score: float
    src_id: int
    target_id: int
    angle: float
    turns: int
    needed: int
    send_cap: int
    mission: str = "capture"
    anchor_turn: int | None = None


@dataclass
class Mission:
    kind: str
    score: float
    target_id: int
    turns: int
    options: list[ShotOption] = field(default_factory=list)

# ============================================================
# Physics
# ============================================================

def dist(ax, ay, bx, by):
    return math.hypot(ax - bx, ay - by)


def orbital_radius(planet):
    return dist(planet.x, planet.y, CENTER_X, CENTER_Y)


def is_static_planet(planet):
    return orbital_radius(planet) + planet.radius >= ROTATION_LIMIT


def fleet_speed(ships):
    if ships <= 1:
        return 1.0
    ratio = math.log(ships) / math.log(1000.0)
    ratio = max(0.0, min(1.0, ratio))
    return 1.0 + (MAX_SPEED - 1.0) * (ratio**1.5)


def point_to_segment_distance(px, py, x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq <= 1e-9:
        return dist(px, py, x1, y1)
    t = ((px - x1) * dx + (py - y1) * dy) / seg_len_sq
    t = max(0.0, min(1.0, t))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return dist(px, py, proj_x, proj_y)


def segment_hits_sun(x1, y1, x2, y2, safety=SUN_SAFETY):
    return point_to_segment_distance(CENTER_X, CENTER_Y, x1, y1, x2, y2) < SUN_R + safety


def launch_point(sx, sy, sr, angle):
    clearance = sr + LAUNCH_CLEARANCE
    return sx + math.cos(angle) * clearance, sy + math.sin(angle) * clearance


def actual_path_geometry(sx, sy, sr, tx, ty, tr):
    angle = math.atan2(ty - sy, tx - sx)
    start_x, start_y = launch_point(sx, sy, sr, angle)
    hit_distance = max(0.0, dist(sx, sy, tx, ty) - (sr + LAUNCH_CLEARANCE) - tr)
    end_x = start_x + math.cos(angle) * hit_distance
    end_y = start_y + math.sin(angle) * hit_distance
    return angle, start_x, start_y, end_x, end_y, hit_distance


def safe_angle_and_distance(sx, sy, sr, tx, ty, tr):
    angle, start_x, start_y, end_x, end_y, hit_distance = actual_path_geometry(
        sx, sy, sr, tx, ty, tr,
    )
    if segment_hits_sun(start_x, start_y, end_x, end_y):
        return None
    return angle, hit_distance


def predict_planet_position(planet, initial_by_id, angular_velocity, turns):
    turns = max(0, int(turns))
    if (
        _PLANET_POS_CACHE_X is not None
        and planet.id < _PLANET_POS_CACHE_X.shape[0]
        and turns <= _PLANET_POS_CACHE_HORIZON
    ):
        return float(_PLANET_POS_CACHE_X[planet.id, turns]), float(_PLANET_POS_CACHE_Y[planet.id, turns])
    
    init = initial_by_id.get(planet.id)
    if init is None:
        return planet.x, planet.y
    r = dist(init.x, init.y, CENTER_X, CENTER_Y)
    if r + init.radius >= ROTATION_LIMIT:
        return planet.x, planet.y
    cur_ang = math.atan2(planet.y - CENTER_Y, planet.x - CENTER_X)
    new_ang = cur_ang + angular_velocity * turns
    return (
        CENTER_X + r * math.cos(new_ang),
        CENTER_Y + r * math.sin(new_ang),
    )


def predict_comet_position(planet_id, comets, turns):
    for group in comets:
        pids = group.get("planet_ids", [])
        if planet_id not in pids:
            continue
        idx = pids.index(planet_id)
        paths = group.get("paths", [])
        path_index = group.get("path_index", 0)
        if idx >= len(paths):
            return None
        path = paths[idx]
        future_idx = path_index + int(turns)
        if 0 <= future_idx < len(path):
            return path[future_idx][0], path[future_idx][1]
        return None
    return None


def comet_remaining_life(planet_id, comets):
    for group in comets:
        pids = group.get("planet_ids", [])
        if planet_id not in pids:
            continue
        idx = pids.index(planet_id)
        paths = group.get("paths", [])
        path_index = group.get("path_index", 0)
        if idx < len(paths):
            return max(0, len(paths[idx]) - path_index)
    return 0


def estimate_arrival(sx, sy, sr, tx, ty, tr, ships):
    safe = safe_angle_and_distance(sx, sy, sr, tx, ty, tr)
    if safe is None:
        return None
    angle, total_d = safe
    turns = max(1, int(math.ceil(total_d / fleet_speed(max(1, ships)))))
    return angle, turns


def travel_time(sx, sy, sr, tx, ty, tr, ships):
    est = estimate_arrival(sx, sy, sr, tx, ty, tr, ships)
    if est is None:
        return 10**9
    return est[1]


def predict_target_position(target, turns, initial_by_id, ang_vel, comets, comet_ids):
    if target.id in comet_ids:
        return predict_comet_position(target.id, comets, turns)
    return predict_planet_position(target, initial_by_id, ang_vel, turns)


def target_can_move(target, initial_by_id, comet_ids):
    if target.id in comet_ids:
        return True
    init = initial_by_id.get(target.id)
    if init is None:
        return False
    r = dist(init.x, init.y, CENTER_X, CENTER_Y)
    return r + init.radius < ROTATION_LIMIT


def search_safe_intercept(src, target, ships, initial_by_id, ang_vel, comets, comet_ids):
    best = None
    best_score = None
    max_turns = min(HORIZON, ROUTE_SEARCH_HORIZON)
    if target.id in comet_ids:
        max_turns = min(max_turns, max(0, comet_remaining_life(target.id, comets) - 1))

    for candidate_turns in range(1, max_turns + 1):
        pos = predict_target_position(
            target, candidate_turns, initial_by_id, ang_vel, comets, comet_ids,
        )
        if pos is None:
            continue
        est = estimate_arrival(src.x, src.y, src.radius, pos[0], pos[1], target.radius, ships)
        if est is None:
            continue
        _, turns = est
        if abs(turns - candidate_turns) > INTERCEPT_TOLERANCE:
            continue

        actual_turns = max(turns, candidate_turns)
        actual_pos = predict_target_position(
            target, actual_turns, initial_by_id, ang_vel, comets, comet_ids,
        )
        if actual_pos is None:
            continue

        confirm = estimate_arrival(
            src.x, src.y, src.radius, actual_pos[0], actual_pos[1], target.radius, ships,
        )
        if confirm is None:
            continue

        delta = abs(confirm[1] - actual_turns)
        if delta > INTERCEPT_TOLERANCE:
            continue

        score = (delta, confirm[1], candidate_turns)
        if best is None or score < best_score:
            best_score = score
            best = (confirm[0], confirm[1], actual_pos[0], actual_pos[1])

    return best


def aim_with_prediction(src, target, ships, initial_by_id, ang_vel, comets, comet_ids):
    est = estimate_arrival(src.x, src.y, src.radius, target.x, target.y, target.radius, ships)
    if est is None:
        if not target_can_move(target, initial_by_id, comet_ids):
            return None
        return search_safe_intercept(
            src, target, ships, initial_by_id, ang_vel, comets, comet_ids,
        )

    tx, ty = target.x, target.y
    for _ in range(5):
        _, turns = est
        pos = predict_target_position(target, turns, initial_by_id, ang_vel, comets, comet_ids)
        if pos is None:
            return None
        ntx, nty = pos
        next_est = estimate_arrival(src.x, src.y, src.radius, ntx, nty, target.radius, ships)
        if next_est is None:
            if not target_can_move(target, initial_by_id, comet_ids):
                return None
            return search_safe_intercept(
                src, target, ships, initial_by_id, ang_vel, comets, comet_ids,
            )
        if (
            abs(ntx - tx) < 0.3
            and abs(nty - ty) < 0.3
            and abs(next_est[1] - turns) <= INTERCEPT_TOLERANCE
        ):
            return next_est[0], next_est[1], ntx, nty
        tx, ty = ntx, nty
        est = next_est

    final_est = estimate_arrival(src.x, src.y, src.radius, tx, ty, target.radius, ships)
    if final_est is None:
        return search_safe_intercept(
            src, target, ships, initial_by_id, ang_vel, comets, comet_ids,
        )
    confirm_pos = predict_target_position(target, final_est[1], initial_by_id, ang_vel, comets, comet_ids)
    if confirm_pos is None:
        return search_safe_intercept(
            src, target, ships, initial_by_id, ang_vel, comets, comet_ids,
        )
    confirm_est = estimate_arrival(src.x, src.y, src.radius, confirm_pos[0], confirm_pos[1], target.radius, ships)
    if confirm_est is None or abs(confirm_est[1] - final_est[1]) > INTERCEPT_TOLERANCE:
        return search_safe_intercept(
            src, target, ships, initial_by_id, ang_vel, comets, comet_ids,
        )
    return confirm_est[0], confirm_est[1], confirm_pos[0], confirm_pos[1]

# ============================================================
# World Model
# ============================================================

def fleet_target_planet(fleet, planets, horizon=HORIZON):
    best_planet = None
    best_time = 1e9
    dir_x = math.cos(fleet.angle)
    dir_y = math.sin(fleet.angle)
    speed = fleet_speed(fleet.ships)

    for planet in planets:
        dx = planet.x - fleet.x
        dy = planet.y - fleet.y
        proj = dx * dir_x + dy * dir_y
        if proj < 0:
            continue
        perp_sq = dx * dx + dy * dy - proj * proj
        radius_sq = planet.radius * planet.radius
        if perp_sq >= radius_sq:
            continue
        hit_d = max(0.0, proj - math.sqrt(max(0.0, radius_sq - perp_sq)))
        turns = hit_d / speed
        if turns <= horizon and turns < best_time:
            best_time = turns
            best_planet = planet

    if best_planet is None:
        return None, None
    return best_planet, int(math.ceil(best_time))


def build_arrival_ledger(fleets, planets, horizon=HORIZON):
    arrivals_by_planet = {planet.id: [] for planet in planets}
    for fleet in fleets:
        target, eta = fleet_target_planet(fleet, planets, horizon)
        if target is None:
            continue
        arrivals_by_planet[target.id].append((eta, fleet.owner, int(fleet.ships)))
    return arrivals_by_planet


def dynamic_fleet_target_planet(fleet, planets, initial_by_id, ang_vel, comets, comet_ids, horizon=HORIZON):
    best_planet = None
    best_turn = 10**9
    dir_x = math.cos(fleet.angle)
    dir_y = math.sin(fleet.angle)
    speed = fleet_speed(fleet.ships)
    x1 = float(fleet.x)
    y1 = float(fleet.y)

    for turn in range(1, int(horizon) + 1):
        x2 = float(fleet.x) + dir_x * speed * turn
        y2 = float(fleet.y) + dir_y * speed * turn
        if x2 < -2.0 or x2 > BOARD + 2.0 or y2 < -2.0 or y2 > BOARD + 2.0:
            break

        for planet in planets:
            if planet.id == fleet.from_planet_id:
                continue
            pos = predict_target_position(planet, turn, initial_by_id, ang_vel, comets, comet_ids)
            if pos is None:
                continue
            if point_to_segment_distance(pos[0], pos[1], x1, y1, x2, y2) <= planet.radius:
                return planet, turn

        x1, y1 = x2, y2

    return best_planet, best_turn if best_planet is not None else None


def build_dynamic_arrival_ledger(fleets, planets, initial_by_id, ang_vel, comets, comet_ids, horizon=HORIZON):
    arrivals_by_planet = {planet.id: [] for planet in planets}
    has_movers = bool(comet_ids) or abs(float(ang_vel or 0.0)) > 1e-9
    for fleet in fleets:
        if has_movers:
            target, eta = dynamic_fleet_target_planet(
                fleet, planets, initial_by_id, ang_vel, comets, comet_ids, horizon
            )
        else:
            target, eta = fleet_target_planet(fleet, planets, horizon)
        if target is None:
            continue
        arrivals_by_planet[target.id].append((eta, fleet.owner, int(fleet.ships)))
    return arrivals_by_planet


def resolve_arrival_event(owner, garrison, arrivals):
    by_owner = {}
    for _, attacker_owner, ships in arrivals:
        by_owner[attacker_owner] = by_owner.get(attacker_owner, 0) + ships

    if not by_owner:
        return owner, max(0.0, garrison)

    sorted_players = sorted(by_owner.items(), key=lambda item: item[1], reverse=True)
    top_owner, top_ships = sorted_players[0]

    if len(sorted_players) > 1:
        second_ships = sorted_players[1][1]
        if top_ships == second_ships:
            survivor_owner = -1
            survivor_ships = 0
        else:
            survivor_owner = top_owner
            survivor_ships = top_ships - second_ships
    else:
        survivor_owner = top_owner
        survivor_ships = top_ships

    if survivor_ships <= 0:
        return owner, max(0.0, garrison)

    if owner == survivor_owner:
        return owner, garrison + survivor_ships

    garrison -= survivor_ships
    if garrison < 0:
        return survivor_owner, -garrison
    return owner, garrison


def normalize_arrivals(arrivals, horizon):
    events = []
    for turns, owner, ships in arrivals:
        if ships <= 0:
            continue
        eta = max(1, int(math.ceil(turns)))
        if eta > horizon:
            continue
        events.append((eta, owner, int(ships)))
    events.sort(key=lambda item: item[0])
    return events


def simulate_planet_timeline(planet, arrivals, player, horizon, comet_life=None):
    horizon = max(0, int(math.ceil(horizon)))
    events = normalize_arrivals(arrivals, horizon)
    by_turn = defaultdict(list)
    for item in events:
        by_turn[item[0]].append(item)

    owner = planet.owner
    garrison = float(planet.ships)
    owner_at = {0: owner}
    ships_at = {0: max(0.0, garrison)}
    min_owned = garrison if owner == player else 0.0
    first_enemy = None
    fall_turn = None

    for turn in range(1, horizon + 1):
        if comet_life is not None and turn >= comet_life:
            owner = -1
            garrison = 0.0
            owner_at[turn] = owner
            ships_at[turn] = garrison
            continue

        if owner != -1:
            garrison += planet.production

        group = by_turn.get(turn, [])
        prev_owner = owner
        if group:
            if prev_owner == player and first_enemy is None:
                if any(item[1] not in (-1, player) for item in group):
                    first_enemy = turn
            owner, garrison = resolve_arrival_event(owner, garrison, group)
            if prev_owner == player and owner != player and fall_turn is None:
                fall_turn = turn

        owner_at[turn] = owner
        ships_at[turn] = max(0.0, garrison)
        if owner == player:
            min_owned = min(min_owned, garrison)

    keep_needed = 0
    holds_full = True

    if planet.owner == player:
        def survives_with_keep(keep):
            sim_owner = planet.owner
            sim_garrison = float(keep)
            for turn in range(1, horizon + 1):
                if comet_life is not None and turn >= comet_life:
                    break
                if sim_owner != -1:
                    sim_garrison += planet.production
                group = by_turn.get(turn, [])
                if group:
                    sim_owner, sim_garrison = resolve_arrival_event(sim_owner, sim_garrison, group)
                    if sim_owner != player:
                        return False
            return sim_owner == player

        if survives_with_keep(int(planet.ships)):
            lo, hi = 0, int(planet.ships)
            while lo < hi:
                mid = (lo + hi) // 2
                if survives_with_keep(mid):
                    hi = mid
                else:
                    lo = mid + 1
            keep_needed = lo
        else:
            holds_full = False
            keep_needed = int(planet.ships)

    return {
        "owner_at": owner_at,
        "ships_at": ships_at,
        "keep_needed": keep_needed,
        "min_owned": max(0, int(math.floor(min_owned))) if planet.owner == player else 0,
        "first_enemy": first_enemy,
        "fall_turn": fall_turn,
        "holds_full": holds_full,
        "horizon": horizon,
    }


def state_at_timeline(timeline, arrival_turn):
    turn = max(0, int(math.ceil(arrival_turn)))
    turn = min(turn, timeline["horizon"])
    owner = timeline["owner_at"].get(turn, timeline["owner_at"][timeline["horizon"]])
    ships = timeline["ships_at"].get(turn, timeline["ships_at"][timeline["horizon"]])
    return owner, max(0.0, ships)


def count_players(planets, fleets):
    owners = set()
    for planet in planets:
        if planet.owner != -1:
            owners.add(planet.owner)
    for fleet in fleets:
        owners.add(fleet.owner)
    return max(2, len(owners))


def nearest_distance_to_set(px, py, planets):
    if not planets:
        return 10**9
    return min(dist(px, py, planet.x, planet.y) for planet in planets)


def indirect_features(planet, planets, player):
    friendly = 0.0
    neutral = 0.0
    enemy = 0.0
    for other in planets:
        if other.id == planet.id:
            continue
        d = dist(planet.x, planet.y, other.x, other.y)
        if d < 1:
            continue
        factor = other.production / (d + 12.0)
        if other.owner == player:
            friendly += factor
        elif other.owner == -1:
            neutral += factor
        else:
            enemy += factor
    return friendly, neutral, enemy


def detect_exposed_enemy_planets(fleets, enemy_planets):
    exposed = set()
    for planet in enemy_planets:
        outbound = sum(
            int(f.ships)
            for f in fleets
            if f.owner == planet.owner and f.from_planet_id == planet.id and f.ships >= 5
        )
        if outbound >= 12 and outbound >= planet.ships * 0.8:  # lowered threshold
            exposed.add(planet.id)
    return exposed


def _compute_weakest_enemy(enemy_planets, owner_strength, owner_production):
    """Return the player ID of the weakest enemy (lowest ships + future production)."""
    enemy_owners = set(p.owner for p in enemy_planets)
    if not enemy_owners:
        return None
    return min(
        enemy_owners,
        key=lambda owner: owner_strength.get(owner, 0) + owner_production.get(owner, 0) * 15,
    )


class WorldModel:
    def __init__(self, player, step, planets, fleets, initial_by_id, ang_vel, comets, comet_ids):
        self.player = player
        self.step = step
        self.planets = planets
        self.fleets = fleets
        self.initial_by_id = initial_by_id
        self.ang_vel = ang_vel
        self.comets = comets
        self.comet_ids = set(comet_ids)
        self.has_moving_targets = bool(self.comet_ids) or abs(float(self.ang_vel or 0.0)) > 1e-9

        self.planet_by_id = {planet.id: planet for planet in planets}
        self.my_planets = [planet for planet in planets if planet.owner == player]
        self.enemy_planets = [planet for planet in planets if planet.owner not in (-1, player)]
        self.neutral_planets = [planet for planet in planets if planet.owner == -1]
        self.static_neutral_planets = [
            planet for planet in self.neutral_planets if is_static_planet(planet)
        ]

        self.num_players = count_players(planets, fleets)
        self.remaining_steps = max(1, TOTAL_STEPS - step)
        self.is_early = step < EARLY_TURN_LIMIT
        self.is_opening = step < OPENING_TURN_LIMIT
        self.is_late = self.remaining_steps < LATE_REMAINING_TURNS
        self.is_very_late = self.remaining_steps < VERY_LATE_REMAINING_TURNS
        self.is_total_war = self.remaining_steps < TOTAL_WAR_REMAINING_TURNS
        self.is_four_player = self.num_players >= 4

        self.owner_strength = defaultdict(int)
        self.owner_production = defaultdict(int)
        for planet in planets:
            if planet.owner != -1:
                self.owner_strength[planet.owner] += int(planet.ships)
                self.owner_production[planet.owner] += int(planet.production)
        for fleet in fleets:
            self.owner_strength[fleet.owner] += int(fleet.ships)

        self.my_total = self.owner_strength.get(player, 0)
        self.enemy_total = sum(
            strength for owner, strength in self.owner_strength.items() if owner != player
        )
        self.max_enemy_strength = max(
            (strength for owner, strength in self.owner_strength.items() if owner != player),
            default=0,
        )
        self.my_prod = self.owner_production.get(player, 0)
        self.enemy_prod = sum(
            production
            for owner, production in self.owner_production.items()
            if owner != player
        )

        # Weakest enemy tracking (key for 4P elimination strategy)
        self._weakest_enemy = _compute_weakest_enemy(
            self.enemy_planets, self.owner_strength, self.owner_production
        )
        self._weakest_enemy_strength = (
            self.owner_strength.get(self._weakest_enemy, 0)
            if self._weakest_enemy is not None else 0
        )

        # Vectorized planet position precomputation
        global _PLANET_POS_CACHE_X, _PLANET_POS_CACHE_Y, _PLANET_POS_CACHE_HORIZON
        _PLANET_POS_CACHE_X = None
        _PLANET_POS_CACHE_Y = None
        _PLANET_POS_CACHE_HORIZON = -1
        if planets:
            max_id = max(p.id for p in planets)
            px = np.zeros(max_id + 1)
            py = np.zeros(max_id + 1)
            pr = np.zeros(max_id + 1)
            for p in planets:
                px[p.id] = p.x
                py[p.id] = p.y
                pr[p.id] = p.radius

            dx = px - CENTER_X
            dy = py - CENTER_Y
            r = np.hypot(dx, dy)
            static_mask = (r + pr) >= ROTATION_LIMIT
            cur_ang = np.arctan2(py - CENTER_Y, px - CENTER_X)
            cache_horizon = min(110, max(60, TOTAL_STEPS - step))
            turns_arr = np.arange(cache_horizon + 1)
            new_ang = cur_ang[:, np.newaxis] + self.ang_vel * turns_arr[np.newaxis, :]
            pred_x = CENTER_X + r[:, np.newaxis] * np.cos(new_ang)
            pred_y = CENTER_Y + r[:, np.newaxis] * np.sin(new_ang)
            pred_x[static_mask, :] = px[static_mask, np.newaxis]
            pred_y[static_mask, :] = py[static_mask, np.newaxis]
            _PLANET_POS_CACHE_X = pred_x
            _PLANET_POS_CACHE_Y = pred_y
            _PLANET_POS_CACHE_HORIZON = cache_horizon

        self.horizon = adaptive_horizon(self)
        self.arrivals_by_planet = build_dynamic_arrival_ledger(
            fleets, planets, initial_by_id, ang_vel, comets, comet_ids, self.horizon
        )
        self.base_timeline = {
            planet.id: simulate_planet_timeline(
                planet,
                self.arrivals_by_planet[planet.id],
                player,
                self.horizon,
                comet_life=self.comet_life(planet.id) if planet.id in self.comet_ids else None
            )
            for planet in planets
        }
        self.keep_needed_map = {
            planet.id: self.base_timeline[planet.id]["keep_needed"] for planet in planets
        }
        self.min_owned_map = {
            planet.id: self.base_timeline[planet.id]["min_owned"] for planet in planets
        }
        self.first_enemy_map = {
            planet.id: self.base_timeline[planet.id]["first_enemy"] for planet in planets
        }
        self.fall_turn_map = {
            planet.id: self.base_timeline[planet.id]["fall_turn"] for planet in planets
        }
        self.holds_full_map = {
            planet.id: self.base_timeline[planet.id]["holds_full"] for planet in planets
        }
        self.indirect_feature_map = {
            planet.id: indirect_features(planet, planets, player) for planet in planets
        }
        self.exposed_planet_ids = detect_exposed_enemy_planets(fleets, self.enemy_planets)
        self.shot_cache = {}
        self.probe_candidate_cache = {}
        self.best_probe_cache = {}
        self.reaction_cache = {}
        self.exact_need_cache = {}
        self.projected_state_cache = {}
        self.projected_timeline_cache = {}
        self.hold_status_cache = {}
        self.nearest_my_sources_cache = {}

        self.total_visible_ships = sum(int(planet.ships) for planet in planets) + sum(
            int(fleet.ships) for fleet in fleets
        )
        self.total_production = sum(int(planet.production) for planet in planets)

    def is_static(self, planet_id):
        return is_static_planet(self.planet_by_id[planet_id])

    def comet_life(self, planet_id):
        return comet_remaining_life(planet_id, self.comets)

    def fleet_target(self, fleet, horizon=None):
        horizon = self.horizon if horizon is None else horizon
        if not self.has_moving_targets:
            return fleet_target_planet(fleet, self.planets, horizon)
        return dynamic_fleet_target_planet(
            fleet,
            self.planets,
            self.initial_by_id,
            self.ang_vel,
            self.comets,
            self.comet_ids,
            horizon,
        )

    def source_inventory_left(self, source_id, spent_total):
        return max(0, int(self.planet_by_id[source_id].ships) - spent_total[source_id])

    def nearest_my_sources(self, target_id, top_k):
        top_k = max(0, int(top_k))
        cache_key = (target_id, top_k)
        cached = self.nearest_my_sources_cache.get(cache_key)
        if cached is not None:
            return cached
        target = self.planet_by_id[target_id]
        if top_k <= 0 or len(self.my_planets) <= top_k:
            result = self.my_planets
        else:
            result = sorted(
                self.my_planets,
                key=lambda src: (planet_distance(src, target), -int(src.ships), src.id),
            )[:top_k]
        self.nearest_my_sources_cache[cache_key] = result
        return result

    def _commitment_cache_key(self, planned_commitments, extra_arrivals, cutoff):
        norm_commitments = ()
        if planned_commitments:
            norm_commitments = tuple(sorted(
                (
                    int(pid),
                    tuple(
                        sorted(
                            (max(1, int(math.ceil(turns))), int(owner), int(ships))
                            for turns, owner, ships in arrivals
                            if ships > 0 and max(1, int(math.ceil(turns))) <= cutoff
                        )
                    ),
                )
                for pid, arrivals in planned_commitments.items()
                if arrivals
            ))
        norm_extra = tuple(sorted(
            (max(1, int(math.ceil(turns))), int(owner), int(ships))
            for turns, owner, ships in extra_arrivals
            if ships > 0 and max(1, int(math.ceil(turns))) <= cutoff
        ))
        return norm_commitments, norm_extra

    def plan_shot(self, src_id, target_id, ships):
        ships = int(ships)
        key = (src_id, target_id, ships)
        if key in self.shot_cache:
            return self.shot_cache[key]
        src = self.planet_by_id[src_id]
        target = self.planet_by_id[target_id]
        result = aim_with_prediction(
            src, target, ships, self.initial_by_id, self.ang_vel, self.comets, self.comet_ids,
        )
        self.shot_cache[key] = result
        return result

    def probe_ship_candidates(self, src_id, target_id, source_cap, hints=()):
        source_cap = max(1, int(source_cap))
        normalized_hints = tuple(
            int(math.ceil(hint)) for hint in hints if hint is not None
        )
        cache_key = (src_id, target_id, source_cap, normalized_hints)
        cached = self.probe_candidate_cache.get(cache_key)
        if cached is not None:
            return cached
        target = self.planet_by_id[target_id]
        target_ships = max(1, int(math.ceil(target.ships)))

        values = set(range(1, min(6, source_cap) + 1))
        values.update({
            source_cap,
            max(1, source_cap // 2),
            max(1, source_cap // 3),
            min(source_cap, PARTIAL_SOURCE_MIN_SHIPS),
            min(source_cap, target_ships + 1),
            min(source_cap, target_ships + 2),
            min(source_cap, target_ships + 4),
            min(source_cap, target_ships + 8),
        })

        for hint in normalized_hints:
            base = max(1, min(source_cap, hint))
            for delta in (-2, -1, 0, 1, 2):
                candidate = base + delta
                if 1 <= candidate <= source_cap:
                    values.add(candidate)

        result = sorted(values)
        if len(result) > PROBE_CANDIDATE_LIMIT:
            result = sorted(
                result,
                key=lambda ships: (
                    abs(ships - target_ships),
                    abs(ships - source_cap),
                    ships,
                ),
            )[:PROBE_CANDIDATE_LIMIT]
            result = sorted(result)
        self.probe_candidate_cache[cache_key] = result
        return result

    def best_probe_aim(
        self,
        src_id,
        target_id,
        source_cap,
        hints=(),
        min_turn=None,
        max_turn=None,
        anchor_turn=None,
        max_anchor_diff=None,
    ):
        cache_key = (
            src_id,
            target_id,
            max(1, int(source_cap)),
            tuple(hints),
            min_turn,
            max_turn,
            anchor_turn,
            max_anchor_diff,
        )
        if cache_key in self.best_probe_cache:
            return self.best_probe_cache[cache_key]

        best = None
        best_key = None

        for ships in self.probe_ship_candidates(src_id, target_id, source_cap, hints=hints):
            aim = self.plan_shot(src_id, target_id, ships)
            if aim is None:
                continue

            angle, turns, dist_to_target, path_target = aim
            if min_turn is not None and turns < min_turn:
                continue
            if max_turn is not None and turns > max_turn:
                continue
            if (
                anchor_turn is not None
                and max_anchor_diff is not None
                and abs(turns - anchor_turn) > max_anchor_diff
            ):
                continue

            if anchor_turn is None:
                key = (turns, ships)
            else:
                key = (abs(turns - anchor_turn), turns, ships)

            if best_key is None or key < best_key:
                best_key = key
                best = (ships, (angle, turns, dist_to_target, path_target))

        self.best_probe_cache[cache_key] = best
        return best

    def reaction_times(self, target_id):
        cached = self.reaction_cache.get(target_id)
        if cached is not None:
            return cached

        target = self.planet_by_id[target_id]
        my_t = 10**9
        for planet in self.my_planets:
            seeded = self.best_probe_aim(planet.id, target.id, max(1, int(planet.ships)))
            if seeded is None:
                continue
            _, aim = seeded
            my_t = min(my_t, aim[1])

        enemy_t = 10**9
        for planet in self.enemy_planets:
            seeded = self.best_probe_aim(planet.id, target.id, max(1, int(planet.ships)))
            if seeded is None:
                continue
            _, aim = seeded
            enemy_t = min(enemy_t, aim[1])

        cached = (my_t, enemy_t)
        self.reaction_cache[target_id] = cached
        return cached

    def projected_state(self, target_id, arrival_turn, planned_commitments=None, extra_arrivals=()):
        planned_commitments = planned_commitments or {}
        cutoff = max(1, int(math.ceil(arrival_turn)))
        if not planned_commitments.get(target_id) and not extra_arrivals:
            return state_at_timeline(self.base_timeline[target_id], cutoff)

        commit_key = self._commitment_cache_key(planned_commitments, extra_arrivals, cutoff)
        cache_key = (target_id, cutoff, commit_key)
        cached = self.projected_state_cache.get(cache_key)
        if cached is not None:
            return cached

        arrivals = [
            item
            for item in self.arrivals_by_planet.get(target_id, [])
            if item[0] <= cutoff
        ]
        arrivals.extend(
            item
            for item in planned_commitments.get(target_id, [])
            if item[0] <= cutoff
        )
        arrivals.extend(item for item in extra_arrivals if item[0] <= cutoff)

        target = self.planet_by_id[target_id]
        dyn = simulate_planet_timeline(
            target, arrivals, self.player, cutoff,
            comet_life=self.comet_life(target.id) if target.id in self.comet_ids else None
        )
        result = state_at_timeline(dyn, cutoff)
        self.projected_state_cache[cache_key] = result
        return result

    def projected_timeline(self, target_id, horizon, planned_commitments=None, extra_arrivals=()):
        planned_commitments = planned_commitments or {}
        horizon = max(1, int(math.ceil(horizon)))
        commit_key = self._commitment_cache_key(planned_commitments, extra_arrivals, horizon)
        cache_key = (target_id, horizon, commit_key)
        cached = self.projected_timeline_cache.get(cache_key)
        if cached is not None:
            return cached
        arrivals = [
            item for item in self.arrivals_by_planet.get(target_id, []) if item[0] <= horizon
        ]
        arrivals.extend(
            item for item in planned_commitments.get(target_id, []) if item[0] <= horizon
        )
        arrivals.extend(item for item in extra_arrivals if item[0] <= horizon)
        target = self.planet_by_id[target_id]
        result = simulate_planet_timeline(
            target, arrivals, self.player, horizon,
            comet_life=self.comet_life(target.id) if target.id in self.comet_ids else None
        )
        self.projected_timeline_cache[cache_key] = result
        return result

    def hold_status(self, target_id, planned_commitments=None, horizon=None):
        planned_commitments = planned_commitments or {}
        if horizon is None:
            horizon = self.horizon
        commit_key = self._commitment_cache_key(planned_commitments, (), horizon)
        cache_key = (target_id, horizon, commit_key)
        cached = self.hold_status_cache.get(cache_key)
        if cached is not None:
            return cached
        if planned_commitments.get(target_id):
            tl = self.projected_timeline(
                target_id, horizon, planned_commitments=planned_commitments,
            )
        else:
            if horizon == self.horizon:
                tl = self.base_timeline[target_id]
            else:
                tl = self.projected_timeline(
                    target_id, horizon, planned_commitments=planned_commitments,
                )
        result = {
            "keep_needed": tl["keep_needed"],
            "min_owned": tl["min_owned"],
            "first_enemy": tl["first_enemy"],
            "fall_turn": tl["fall_turn"],
            "holds_full": tl["holds_full"],
        }
        self.hold_status_cache[cache_key] = result
        return result

    def _ownership_search_cap(self, eval_turn):
        productive_cap = self.total_production * max(2, eval_turn + 2)
        return max(32, int(self.total_visible_ships + productive_cap + 32))

    def min_ships_to_own_by(
        self,
        target_id,
        eval_turn,
        attacker_owner,
        arrival_turn=None,
        planned_commitments=None,
        extra_arrivals=(),
        upper_bound=None,
    ):
        planned_commitments = planned_commitments or {}
        eval_turn = max(1, int(math.ceil(eval_turn)))
        arrival_turn = eval_turn if arrival_turn is None else max(1, int(math.ceil(arrival_turn)))
        if arrival_turn > eval_turn:
            if upper_bound is not None:
                return max(1, int(upper_bound)) + 1
            return self._ownership_search_cap(eval_turn) + 1

        normalized_extra = tuple(
            (max(1, int(math.ceil(turns))), owner, int(ships))
            for turns, owner, ships in extra_arrivals
            if ships > 0 and max(1, int(math.ceil(turns))) <= eval_turn
        )

        cache_key = None
        if (
            arrival_turn == eval_turn
            and not planned_commitments.get(target_id)
            and not normalized_extra
        ):
            cache_key = (target_id, eval_turn, attacker_owner)
            cached = self.exact_need_cache.get(cache_key)
            if cached is not None:
                return cached

        owner_before, ships_before = self.projected_state(
            target_id,
            eval_turn,
            planned_commitments=planned_commitments,
            extra_arrivals=normalized_extra,
        )
        if owner_before == attacker_owner:
            if cache_key is not None:
                self.exact_need_cache[cache_key] = 0
            return 0

        def owns_at(ships):
            owner_after, _ = self.projected_state(
                target_id,
                eval_turn,
                planned_commitments=planned_commitments,
                extra_arrivals=normalized_extra + ((arrival_turn, attacker_owner, int(ships)),),
            )
            return owner_after == attacker_owner

        if upper_bound is not None:
            hi = max(1, int(upper_bound))
            if not owns_at(hi):
                return hi + 1
        else:
            hi = max(1, int(math.ceil(ships_before)) + 1)
            search_cap = self._ownership_search_cap(eval_turn)
            while hi <= search_cap and not owns_at(hi):
                hi *= 2
            if hi > search_cap:
                hi = search_cap
                if not owns_at(hi):
                    return hi + 1

        lo = 1
        while lo < hi:
            mid = (lo + hi) // 2
            if owns_at(mid):
                hi = mid
            else:
                lo = mid + 1

        if cache_key is not None:
            self.exact_need_cache[cache_key] = lo
        return lo

    def min_ships_to_own_at(
        self,
        target_id,
        arrival_turn,
        attacker_owner,
        planned_commitments=None,
        extra_arrivals=(),
        upper_bound=None,
    ):
        return self.min_ships_to_own_by(
            target_id,
            arrival_turn,
            attacker_owner,
            arrival_turn=arrival_turn,
            planned_commitments=planned_commitments,
            extra_arrivals=extra_arrivals,
            upper_bound=upper_bound,
        )

    def reinforcement_needed_to_hold_until(
        self,
        planet_id,
        arrival_turn,
        hold_until,
        planned_commitments=None,
        upper_bound=None,
    ):
        planned_commitments = planned_commitments or {}
        target = self.planet_by_id[planet_id]
        arrival_turn = max(1, int(math.ceil(arrival_turn)))
        hold_until = max(arrival_turn, int(math.ceil(hold_until)))

        if target.owner != self.player:
            return self.min_ships_to_own_by(
                planet_id,
                hold_until,
                self.player,
                arrival_turn=arrival_turn,
                planned_commitments=planned_commitments,
                upper_bound=upper_bound,
            )

        def holds_with_reinforcement(ships):
            timeline = self.projected_timeline(
                planet_id,
                hold_until,
                planned_commitments=planned_commitments,
                extra_arrivals=((arrival_turn, self.player, int(ships)),),
            )
            for turn in range(arrival_turn, hold_until + 1):
                if timeline["owner_at"].get(turn) != self.player:
                    return False
            return True

        if upper_bound is not None:
            hi = max(1, int(upper_bound))
            if not holds_with_reinforcement(hi):
                return hi + 1
        else:
            hi = 1
            search_cap = self._ownership_search_cap(hold_until)
            while hi <= search_cap and not holds_with_reinforcement(hi):
                hi *= 2
            if hi > search_cap:
                hi = search_cap
                if not holds_with_reinforcement(hi):
                    return hi + 1

        lo = 1
        while lo < hi:
            mid = (lo + hi) // 2
            if holds_with_reinforcement(mid):
                hi = mid
            else:
                lo = mid + 1
        return lo

    def ships_needed_to_capture(
        self,
        target_id,
        arrival_turn,
        planned_commitments=None,
        extra_arrivals=(),
    ):
        return self.min_ships_to_own_at(
            target_id,
            arrival_turn,
            self.player,
            planned_commitments=planned_commitments,
            extra_arrivals=extra_arrivals,
        )

# ============================================================
# Strategy
# ============================================================

def planet_distance(first, second):
    return math.hypot(first.x - second.x, first.y - second.y)


def nearest_sources_to_target(target, sources, top_k):
    if top_k <= 0 or len(sources) <= top_k:
        return sources
    return sorted(
        sources,
        key=lambda src: (planet_distance(src, target), -int(src.ships), src.id),
    )[:top_k]




def candidate_targets_for_source(src, world, policy, modes, top_k=None):
    """
    Cheap prefilter for expensive planning. Keeps only a small number of
    promising targets per source, based on distance, production, ownership,
    and known tactical signals.
    """
    if top_k is None:
        top_k = MAIN_TARGET_TOP_K_FOUR_PLAYER if world.is_four_player else MAIN_TARGET_TOP_K_TWO_PLAYER

    # Tuned parameters from top players' replays
    if world.is_four_player:
        neutral_mult = 0.100000
        enemy_mult = 0.107685
        static_mult = 0.812191
        exposed_mult = 1.038745
        weakest_mult = 0.732832
        comet_mult = 2.417322
        dist_coeff = 0.026670
        sun_penalty = 0.872786
        finishing_mult = 1.498366
    else:
        neutral_mult = 0.105795
        enemy_mult = 0.102273
        static_mult = 0.785646
        exposed_mult = 1.029361
        weakest_mult = 0.613867
        comet_mult = 0.277256
        dist_coeff = 0.018531
        sun_penalty = 1.320081
        finishing_mult = 0.100000

    scored = []
    src_speed = fleet_speed(max(1, int(src.ships)))
    for target in world.planets:
        if target.id == src.id or target.owner == world.player:
            continue

        d = planet_distance(src, target)
        eta_proxy = d / max(1.0, src_speed)
        turns_left = max(1, world.remaining_steps - int(math.ceil(eta_proxy)))
        score = target.production * turns_left

        if target.owner == -1:
            score *= neutral_mult
        else:
            score *= enemy_mult

        if world.is_static(target.id):
            score *= static_mult

        if target.id in world.exposed_planet_ids:
            score *= exposed_mult

        if world._weakest_enemy is not None and target.owner == world._weakest_enemy:
            score *= weakest_mult

        if target.id in world.comet_ids:
            score *= comet_mult

        score -= d * dist_coeff

        # Penalise targets whose straight-line path passes near the sun
        if segment_hits_sun(src.x, src.y, target.x, target.y, safety=SUN_SAFETY + 4.0):
            score *= sun_penalty

        if modes["is_finishing"] and target.owner not in (-1, world.player):
            score *= finishing_mult

        scored.append((score, target.production, -int(target.ships), -target.id, target))

    scored.sort(reverse=True)
    return [item[-1] for item in scored[:top_k]]

def min_legal_reaction_time(target, sources, world):
    best = 10**9
    for src in sources:
        seeded = world.best_probe_aim(src.id, target.id, max(1, int(src.ships)))
        if seeded is None:
            continue
        _, aim = seeded
        best = min(best, aim[1])
    return best


def policy_reaction_times(target_id, policy):
    return policy["reaction_time_map"].get(target_id, (10**9, 10**9))


def candidate_time_valid(target, turns, world, remaining_buffer):
    if turns > world.remaining_steps - remaining_buffer:
        return False
    if target.id in world.comet_ids:
        life = world.comet_life(target.id)
        if turns >= life or turns > COMET_MAX_CHASE_TURNS:
            return False
    return True


def stacked_enemy_proactive_keep(planet, world):
    threats = []
    for enemy in world.enemy_planets:
        seeded = world.best_probe_aim(enemy.id, planet.id, max(1, int(enemy.ships)))
        if seeded is None:
            continue
        _, aim = seeded
        eta = aim[1]
        if eta > MULTI_ENEMY_PROACTIVE_HORIZON:
            continue
        threats.append((eta, int(enemy.ships)))

    if not threats:
        return 0

    threats.sort()
    best_stacked = 0
    left = 0
    running = 0
    for right in range(len(threats)):
        running += threats[right][1]
        while threats[right][0] - threats[left][0] > MULTI_ENEMY_STACK_WINDOW:
            running -= threats[left][1]
            left += 1
        best_stacked = max(best_stacked, running)

    return int(best_stacked * MULTI_ENEMY_PROACTIVE_RATIO)


def swarm_eta_tolerance(options, target, world):
    if len(options) >= 3:
        return THREE_SOURCE_ETA_TOLERANCE
    if target.owner not in (-1, world.player):
        return HOSTILE_SWARM_ETA_TOLERANCE
    return MULTI_SOURCE_ETA_TOLERANCE


def detect_enemy_crashes(world):
    crashes = []
    for target_id, arrivals in world.arrivals_by_planet.items():
        enemy_events = [
            (int(math.ceil(eta)), owner, int(ships))
            for eta, owner, ships in arrivals
            if owner not in (-1, world.player) and ships > 0
        ]
        enemy_events.sort()
        for i in range(len(enemy_events)):
            eta_a, owner_a, ships_a = enemy_events[i]
            for j in range(i + 1, len(enemy_events)):
                eta_b, owner_b, ships_b = enemy_events[j]
                if owner_a == owner_b:
                    continue
                if abs(eta_a - eta_b) > CRASH_EXPLOIT_ETA_WINDOW:
                    break
                if ships_a + ships_b < CRASH_EXPLOIT_MIN_TOTAL_SHIPS:
                    continue
                crashes.append({
                    "target_id": target_id,
                    "crash_turn": max(eta_a, eta_b),
                    "owners": (owner_a, owner_b),
                    "ships": (ships_a, ships_b),
                })
    return crashes


def detect_enemy_planet_battles(world):
    """
    Detect where an enemy fleet is attacking another enemy's owned planet.
    These create attack windows — the winning side will be weakened.
    Returns list of dicts with target_id, battle_turn, estimated post_battle_ships.
    """
    battles = []
    for target in world.enemy_planets:
        attacking_fleets = [
            (int(math.ceil(eta)), owner, int(ships))
            for eta, owner, ships in world.arrivals_by_planet.get(target.id, [])
            if owner not in (-1, world.player) and owner != target.owner and ships > 0
        ]
        if not attacking_fleets:
            continue

        for eta, attacker_owner, attacker_ships in attacking_fleets:
            # Rough post-battle estimate (production growth + garrison vs attacker)
            garrison_at_eta = target.ships + (target.production * eta if target.owner != -1 else 0)
            surviving_attacker = max(0, attacker_ships - garrison_at_eta)
            surviving_defender = max(0, garrison_at_eta - attacker_ships)

            if attacker_ships > garrison_at_eta:
                post_owner = attacker_owner
                post_ships = surviving_attacker
            else:
                post_owner = target.owner
                post_ships = surviving_defender

            # Only interesting if planet will be weak after battle
            if post_ships < 25:
                battles.append({
                    "target_id": target.id,
                    "battle_turn": eta,
                    "post_owner": post_owner,
                    "post_ships": post_ships,
                    "original_owner": target.owner,
                })

    return battles


def build_policy_state(world, deadline=None):
    def expired():
        return deadline is not None and time.perf_counter() > deadline

    meta = _META_BANDIT.policy(world)
    phase_prior = replay_phase_prior(world)
    indirect_wealth_map = {}
    for target_id, features in world.indirect_feature_map.items():
        friendly, neutral, enemy = features
        indirect_wealth_map[target_id] = (
            friendly * INDIRECT_FRIENDLY_WEIGHT
            + neutral * INDIRECT_NEUTRAL_WEIGHT
            + enemy * INDIRECT_ENEMY_WEIGHT
        )

    reserve = {}
    attack_budget = {}
    reaction_time_map = {}

    for target in world.planets:
        if expired():
            break
        if target.owner == world.player:
            continue
        my_sources = nearest_sources_to_target(target, world.my_planets, REACTION_SOURCE_TOP_K_MY)
        enemy_sources = nearest_sources_to_target(target, world.enemy_planets, REACTION_SOURCE_TOP_K_ENEMY)
        my_t = min_legal_reaction_time(target, my_sources, world)
        enemy_t = min_legal_reaction_time(target, enemy_sources, world)
        reaction_time_map[target.id] = (my_t, enemy_t)

    # Compute doomed planets
    doomed_planets = set()
    for planet in world.my_planets:
        is_expiring_comet = False
        if planet.id in world.comet_ids:
            life = comet_remaining_life(planet.id, world.comets)
            if life <= DOOMED_EVAC_TURN_LIMIT:
                is_expiring_comet = True
        if is_expiring_comet:
            doomed_planets.add(planet.id)
            continue
        status = world.hold_status(planet.id, planned_commitments=None, horizon=DOOMED_EVAC_TURN_LIMIT)
        if (
            not status["holds_full"]
            and status["fall_turn"] is not None
            and status["fall_turn"] <= DOOMED_EVAC_TURN_LIMIT
        ):
            doomed_planets.add(planet.id)

    for planet in world.my_planets:
        if expired():
            break
        if planet.id in doomed_planets:
            reserve[planet.id] = 0
            attack_budget[planet.id] = int(planet.ships)
            continue

        exact_keep = world.keep_needed_map.get(planet.id, 0)

        # v20: exact threat-based garrison — compute the minimum ships needed
        # to survive the fastest enemy fleet that could reach this planet,
        # rather than using a fixed ratio multiplier.
        proactive_keep = 0
        for enemy in nearest_sources_to_target(planet, world.enemy_planets, PROACTIVE_ENEMY_TOP_K):
            enemy_aim = world.plan_shot(enemy.id, planet.id, max(1, int(enemy.ships)))
            if enemy_aim is None:
                continue
            enemy_eta = enemy_aim[1]
            if enemy_eta > PROACTIVE_DEFENSE_HORIZON:
                continue
            # Exact garrison: ships planet will have at enemy_eta must exceed
            # the incoming fleet × safety factor.
            projected_garrison = int(planet.ships) + planet.production * enemy_eta
            needed_to_hold = int(math.ceil(int(enemy.ships) * EXACT_GARRISON_SAFETY))
            if projected_garrison < needed_to_hold:
                # We need to keep enough now that + production > enemy fleet
                keep_now = max(0, needed_to_hold - planet.production * enemy_eta)
                proactive_keep = max(proactive_keep, keep_now)
        proactive_keep = max(proactive_keep, stacked_enemy_proactive_keep(planet, world))

        if world.is_total_war:
            exact_keep = min(exact_keep, max(1, exact_keep // 2))
            proactive_keep = min(proactive_keep, max(1, proactive_keep // 2))

        reserve_base = max(exact_keep, proactive_keep)
        reserve_bias = max(meta["retention_value"], meta["safety_value"])
        if reserve_base > 0:
            reserve_base = int(math.ceil(reserve_base * _clip(reserve_bias, 0.94, 1.12)))
        reserve[planet.id] = min(int(planet.ships), reserve_base)
        attack_budget[planet.id] = max(0, int(planet.ships) - reserve[planet.id])

    return {
        "indirect_wealth_map": indirect_wealth_map,
        "reserve": reserve,
        "attack_budget": attack_budget,
        "reaction_time_map": reaction_time_map,
        "meta": meta,
        "phase_prior": phase_prior,
        "doomed_planets": doomed_planets,
    }


def build_modes(world):
    domination = (world.my_total - world.enemy_total) / max(1, world.my_total + world.enemy_total)
    is_behind = domination < BEHIND_DOMINATION
    is_ahead = domination > AHEAD_DOMINATION
    is_dominating = is_ahead or (
        world.max_enemy_strength > 0 and world.my_total > world.max_enemy_strength * 1.25
    )
    is_finishing = (
        domination > FINISHING_DOMINATION
        and world.my_prod > world.enemy_prod * FINISHING_PROD_RATIO
        and world.step > 80
    )

    attack_margin_mult = 1.0
    if is_ahead:
        attack_margin_mult += AHEAD_ATTACK_MARGIN_BONUS
    if is_behind:
        attack_margin_mult -= BEHIND_ATTACK_MARGIN_PENALTY
    if is_finishing:
        attack_margin_mult += FINISHING_ATTACK_MARGIN_BONUS

    return {
        "domination": domination,
        "is_behind": is_behind,
        "is_ahead": is_ahead,
        "is_dominating": is_dominating,
        "is_finishing": is_finishing,
        "attack_margin_mult": attack_margin_mult,
    }


def is_safe_neutral(target, policy):
    if target.owner != -1:
        return False
    my_t, enemy_t = policy_reaction_times(target.id, policy)
    return my_t <= enemy_t - SAFE_NEUTRAL_MARGIN


def is_contested_neutral(target, policy):
    if target.owner != -1:
        return False
    my_t, enemy_t = policy_reaction_times(target.id, policy)
    return abs(my_t - enemy_t) <= CONTESTED_NEUTRAL_MARGIN


def opening_filter(target, arrival_turns, needed, src_available, world, policy):
    if not world.is_opening or target.owner != -1:
        return False
    if target.id in world.comet_ids:
        return False
    if world.is_static(target.id):
        return False

    my_t, enemy_t = policy_reaction_times(target.id, policy)
    reaction_gap = enemy_t - my_t
    if (
        target.production >= SAFE_OPENING_PROD_THRESHOLD
        and arrival_turns <= SAFE_OPENING_TURN_LIMIT
        and reaction_gap >= SAFE_NEUTRAL_MARGIN
    ):
        return False

    if world.is_four_player:
        affordable = needed <= max(
            PARTIAL_SOURCE_MIN_SHIPS,
            int(src_available * FOUR_PLAYER_ROTATING_SEND_RATIO),
        )
        if (
            affordable
            and arrival_turns <= FOUR_PLAYER_ROTATING_TURN_LIMIT
            and reaction_gap >= FOUR_PLAYER_ROTATING_REACTION_GAP
        ):
            return False
        return True

    return arrival_turns > ROTATING_OPENING_MAX_TURNS or target.production <= ROTATING_OPENING_LOW_PROD


def target_value(target, arrival_turns, mission, world, modes, policy):
    meta = policy.get("meta", {})
    phase_prior = policy.get("phase_prior", {"enemy": 1.0, "neutral": 1.0, "capture": 1.0})
    turns_profit = max(1, world.remaining_steps - arrival_turns)
    if target.id in world.comet_ids:
        life = world.comet_life(target.id)
        turns_profit = max(0, min(turns_profit, life - arrival_turns))
        if turns_profit <= 0:
            return -1.0

    value = target.production * turns_profit
    value += policy["indirect_wealth_map"][target.id] * turns_profit * INDIRECT_VALUE_SCALE

    if world.is_static(target.id):
        value *= STATIC_NEUTRAL_VALUE_MULT if target.owner == -1 else STATIC_HOSTILE_VALUE_MULT
    else:
        value *= ROTATING_OPENING_VALUE_MULT if world.is_opening else 1.0

    if target.owner not in (-1, world.player):
        value *= OPENING_HOSTILE_TARGET_VALUE_MULT if world.is_opening else HOSTILE_TARGET_VALUE_MULT
        value *= meta.get("pressure_value", 1.0)
        value *= phase_prior.get("enemy", 1.0)
        leader_owner = meta.get("leader_owner")
        if (
            world.is_four_player
            and leader_owner is not None
            and target.owner == leader_owner
            and target.owner != world._weakest_enemy
        ):
            value *= meta.get("leader_tax", 1.0)

    if target.owner == -1:
        value *= meta.get("expansion_value", 1.0)
        value *= phase_prior.get("neutral", 1.0)
        if is_safe_neutral(target, policy):
            value *= SAFE_NEUTRAL_VALUE_MULT
        elif is_contested_neutral(target, policy):
            value *= CONTESTED_NEUTRAL_VALUE_MULT
        if world.is_early:
            value *= EARLY_NEUTRAL_VALUE_MULT

    if target.id in world.comet_ids:
        value *= COMET_VALUE_MULT
        value *= meta.get("comet_value", 1.0)

    if mission == "snipe":
        value *= SNIPE_VALUE_MULT
    elif mission == "swarm":
        value *= SWARM_VALUE_MULT
    elif mission == "reinforce":
        value *= REINFORCE_VALUE_MULT
        value *= meta.get("retention_value", 1.0)
    elif mission == "crash_exploit":
        value *= CRASH_EXPLOIT_VALUE_MULT
    elif mission == "capture":
        value *= phase_prior.get("capture", 1.0)

    if target.id in world.exposed_planet_ids:
        value *= EXPOSED_PLANET_VALUE_MULT

    if world.is_late:
        value += max(0, target.ships) * LATE_IMMEDIATE_SHIP_VALUE

    # Elimination bonus — dynamic ratio-based weakness detection (v20)
    if target.owner not in (-1, world.player):
        enemy_strength = world.owner_strength.get(target.owner, 0)
        enemy_prod = world.owner_production.get(target.owner, 0)
        my_strength = max(1, world.my_total)
        is_weak = (enemy_strength / my_strength) < WEAK_ENEMY_RATIO
        if WEAK_ENEMY_PROD_GATE:
            is_weak = is_weak and (enemy_prod <= world.my_prod)
        if is_weak:
            value += ELIMINATION_BONUS

    # Weakest enemy targeting bonus (key for 4P strategy)
    if target.owner not in (-1, world.player) and world._weakest_enemy is not None:
        if target.owner == world._weakest_enemy:
            mult = WEAKEST_ENEMY_VALUE_MULT_4P if world.is_four_player else WEAKEST_ENEMY_VALUE_MULT_2P
            value *= mult * meta.get("weakest_value", 1.0)

    if modes["is_finishing"] and target.owner not in (-1, world.player):
        value *= FINISHING_HOSTILE_VALUE_MULT
    if modes["is_behind"] and target.owner == -1 and not world.is_static(target.id):
        value *= BEHIND_ROTATING_NEUTRAL_VALUE_MULT
    if modes["is_behind"] and target.owner == -1 and is_safe_neutral(target, policy):
        value *= 1.08
    if modes["is_dominating"] and target.owner == -1 and is_contested_neutral(target, policy):
        value *= 0.92

    return value


def reinforce_value(target, hold_until, world, policy):
    meta = policy.get("meta", {})
    saved_turns = max(1, world.remaining_steps - hold_until)
    value = target.production * saved_turns + max(0, target.ships) * DEFENSE_SHIP_VALUE
    if world.enemy_planets and nearest_distance_to_set(target.x, target.y, world.enemy_planets) < 22:
        value *= DEFENSE_FRONTIER_SCORE_MULT
    value += policy["indirect_wealth_map"][target.id] * saved_turns * INDIRECT_VALUE_SCALE * 0.35
    return value * REINFORCE_VALUE_MULT * meta.get("retention_value", 1.0)


def _logistic_packet_send(target, needed, seeded_send, arrival_turns, src_available, world, policy):
    if src_available <= needed:
        return max(0, min(src_available, seeded_send))
    if (
        world.is_four_player
        and not world.is_total_war
        and target.owner == -1
    ):
        return max(needed, min(int(src_available), int(seeded_send)))

    meta = policy.get("meta", {})
    needed = max(1, int(needed))
    seeded_send = max(needed, min(int(src_available), int(seeded_send)))
    base_speed = fleet_speed(max(1, needed))
    speed_bias = meta.get("packet_speed_bias", 0.0)
    turn_weight = SNIPE_COST_TURN_WEIGHT if target.owner == -1 else ATTACK_COST_TURN_WEIGHT
    if world.is_four_player:
        turn_weight *= 0.92

    candidates = {
        needed,
        seeded_send,
        int(math.ceil(needed * 1.15)),
        int(math.ceil(needed * 1.35)),
        int(math.ceil(needed * 1.65)),
        int(math.ceil(src_available * 0.25)),
        int(math.ceil(src_available * 0.40)),
        int(math.ceil(src_available * 0.58)),
    }
    if world.is_four_player and (not world.is_opening or target.owner != -1 or target.production >= 4):
        candidates.add(int(math.ceil(needed * 2.05)))
        candidates.add(int(math.ceil(src_available * 0.70)))
    if world.is_total_war:
        candidates.add(int(src_available))

    best_send = seeded_send
    best_score = -10**18
    checked = 0
    for send in sorted(candidates):
        if checked >= LOGISTIC_PACKET_CANDIDATE_LIMIT:
            break
        send = max(needed, min(int(src_available), int(send)))
        if send < needed:
            continue
        checked += 1
        speed_ratio = max(0.25, fleet_speed(send) / max(0.25, base_speed))
        est_turns = max(1.0, float(arrival_turns) / speed_ratio)
        turns_profit = max(1.0, world.remaining_steps - est_turns)
        gain = target.production * turns_profit
        if target.owner not in (-1, world.player):
            gain *= 1.35
        if target.id in world.comet_ids:
            gain *= meta.get("comet_value", 1.0)
        speed_bonus = (float(arrival_turns) - est_turns) * (1.0 + speed_bias)
        score = (gain + speed_bonus * max(1, target.production)) / (send + est_turns * turn_weight + 1.0)
        if send > seeded_send:
            score -= (send - seeded_send) * 0.012 * meta.get("safety_value", 1.0)
        if score > best_score:
            best_score = score
            best_send = send

    return max(needed, min(int(src_available), int(best_send)))


def preferred_send(target, base_needed, arrival_turns, src_available, world, modes, policy):
    meta = policy.get("meta", {})
    phase_prior = policy.get("phase_prior", {"risk": 1.0})
    send = max(base_needed, int(math.ceil(base_needed * modes["attack_margin_mult"])))
    margin = 0
    if target.owner == -1:
        margin += min(
            NEUTRAL_MARGIN_CAP,
            NEUTRAL_MARGIN_BASE + target.production * NEUTRAL_MARGIN_PROD_WEIGHT,
        )
        margin += int(round((meta.get("expansion_value", 1.0) - 1.0) * 4.0))
    else:
        margin += min(
            HOSTILE_MARGIN_CAP,
            HOSTILE_MARGIN_BASE + target.production * HOSTILE_MARGIN_PROD_WEIGHT,
        )
        margin += int(round((meta.get("pressure_value", 1.0) - 1.0) * 5.0))
    if world.is_static(target.id):
        margin += STATIC_TARGET_MARGIN
    if is_contested_neutral(target, policy):
        margin += CONTESTED_TARGET_MARGIN
    if world.is_four_player:
        margin += FOUR_PLAYER_TARGET_MARGIN
    if arrival_turns > LONG_TRAVEL_MARGIN_START:
        margin += min(LONG_TRAVEL_MARGIN_CAP, arrival_turns // LONG_TRAVEL_MARGIN_DIVISOR)
    if target.id in world.comet_ids:
        margin = max(0, margin - COMET_MARGIN_RELIEF)
    if modes["is_finishing"] and target.owner not in (-1, world.player):
        margin += FINISHING_HOSTILE_SEND_BONUS
    if target.id in world.exposed_planet_ids:
        margin = max(0, margin - 2)
    risk_bias = phase_prior.get("risk", 1.0)
    if risk_bias < 0.98:
        margin += 1 + int(round((1.0 - risk_bias) * 5.0))
    elif risk_bias > 1.06 and target.owner != -1:
        margin = max(0, margin - 1)
    # In 4P, be more efficient when targeting weakest enemy (finishing blow)
    if world.is_four_player and world._weakest_enemy is not None and target.owner == world._weakest_enemy:
        margin = max(0, margin - 2)
    margin += int(round(meta.get("send_margin_bias", 0.0) * 3.0))
    seeded_send = min(src_available, max(base_needed, send + margin))
    return _logistic_packet_send(
        target, base_needed, seeded_send, arrival_turns, src_available, world, policy,
    )


def apply_score_modifiers(base_score, target, mission, world):
    score = base_score
    if world.is_static(target.id):
        score *= STATIC_TARGET_SCORE_MULT
    if world.is_early and target.owner == -1 and world.is_static(target.id):
        score *= EARLY_STATIC_NEUTRAL_SCORE_MULT
    if world.is_four_player and target.owner == -1 and not world.is_static(target.id):
        score *= FOUR_PLAYER_ROTATING_NEUTRAL_SCORE_MULT
    if (
        len(world.static_neutral_planets) >= DENSE_STATIC_NEUTRAL_COUNT
        and target.owner == -1
        and not world.is_static(target.id)
    ):
        score *= DENSE_ROTATING_NEUTRAL_SCORE_MULT
    if mission == "snipe":
        score *= SNIPE_SCORE_MULT
    elif mission == "swarm":
        score *= SWARM_SCORE_MULT
    elif mission == "crash_exploit":
        score *= CRASH_EXPLOIT_SCORE_MULT
    if target.id in world.exposed_planet_ids:
        score *= 1.25
    # Bonus score for targeting weakest enemy planet
    if target.owner not in (-1, world.player) and world._weakest_enemy == target.owner:
        score *= 1.2
    return score


def settle_plan(
    src,
    target,
    src_cap,
    send_guess,
    world,
    planned_commitments,
    modes,
    policy,
    mission="capture",
    eval_turn_fn=None,
    anchor_turn=None,
    anchor_tolerance=None,
    max_iter=4,
):
    if src_cap < 1:
        return None

    seed_hint = max(1, min(src_cap, int(send_guess)))
    eval_turn_fn = eval_turn_fn or (lambda turns: turns)
    anchor_tolerance = (
        anchor_tolerance
        if anchor_tolerance is not None
        else (1 if mission == "snipe" else None)
    )
    tested = {}
    tested_order = []

    def evaluate(send):
        send = max(1, min(src_cap, int(send)))
        cached = tested.get(send)
        if cached is not None or send in tested:
            return cached

        aim = world.plan_shot(src.id, target.id, send)
        if aim is None:
            tested[send] = None
            return None

        angle, turns, _, _ = aim
        if mission == "crash_exploit" and anchor_turn is not None and turns < anchor_turn:
            tested[send] = None
            return None
        raw_eval_turn = int(math.ceil(eval_turn_fn(turns)))
        if raw_eval_turn < turns:
            tested[send] = None
            return None
        eval_turn = raw_eval_turn
        need = world.min_ships_to_own_by(
            target.id,
            eval_turn,
            world.player,
            arrival_turn=turns,
            planned_commitments=planned_commitments,
            upper_bound=src_cap,
        )
        if need <= 0 or need > src_cap:
            tested[send] = None
            return None

        if mission in ("snipe", "crash_exploit"):
            desired = need
        elif mission == "rescue":
            desired = min(
                src_cap,
                max(
                    need,
                    need + DEFENSE_SEND_MARGIN_BASE + target.production * DEFENSE_SEND_MARGIN_PROD_WEIGHT,
                ),
            )
        else:
            desired = min(
                src_cap,
                max(need, preferred_send(target, need, turns, src_cap, world, modes, policy)),
            )

        result = (angle, turns, eval_turn, need, send, desired)
        tested[send] = result
        tested_order.append(send)
        return result

    initial_candidates = sorted(
        world.probe_ship_candidates(src.id, target.id, src_cap, hints=(seed_hint,)),
        key=lambda send: (abs(send - seed_hint), send),
    )

    current_send = None
    for seed in initial_candidates:
        result = evaluate(seed)
        if result is None:
            continue
        if (
            anchor_turn is not None
            and anchor_tolerance is not None
            and abs(result[1] - anchor_turn) > anchor_tolerance
        ):
            continue
        current_send = seed
        break

    if current_send is None:
        return None

    for _ in range(max_iter):
        result = evaluate(current_send)
        if result is None:
            break

        angle, turns, eval_turn, need, actual_send, desired = result
        if desired == actual_send:
            if (
                anchor_turn is not None
                and anchor_tolerance is not None
                and abs(turns - anchor_turn) > anchor_tolerance
            ):
                return None
            if mission == "rescue" and turns > eval_turn:
                return None
            return angle, turns, eval_turn, need, actual_send

        next_send = max(1, min(src_cap, int(desired)))
        if next_send in tested:
            current_send = next_send
            break
        current_send = next_send

    candidate_sends = sorted(
        [send for send in tested_order if tested.get(send) is not None],
        key=lambda send: (
            0 if mission != "snipe" or anchor_turn is None else abs(tested[send][1] - anchor_turn),
            abs(send - seed_hint),
            tested[send][1],
            send,
        ),
    )

    seen = set()
    for send in candidate_sends:
        if send in seen:
            continue
        seen.add(send)
        result = tested.get(send)
        if result is None:
            continue
        angle, turns, eval_turn, need, actual_send, _ = result
        if actual_send < need:
            continue
        if (
            anchor_turn is not None
            and anchor_tolerance is not None
            and abs(turns - anchor_turn) > anchor_tolerance
        ):
            continue
        if mission == "rescue" and turns > eval_turn:
            continue
        return angle, turns, eval_turn, need, actual_send

    return None


def settle_reinforce_plan(
    src,
    target,
    src_cap,
    send_guess,
    world,
    planned_commitments,
    hold_until,
    max_arrival_turn,
    max_iter=4,
):
    if src_cap < 1:
        return None

    seed_hint = max(1, min(src_cap, int(send_guess)))
    tested = {}
    tested_order = []

    def evaluate(send):
        send = max(1, min(src_cap, int(send)))
        cached = tested.get(send)
        if cached is not None or send in tested:
            return cached

        aim = world.plan_shot(src.id, target.id, send)
        if aim is None:
            tested[send] = None
            return None

        angle, turns, _, _ = aim
        if turns > max_arrival_turn:
            tested[send] = None
            return None

        need = world.reinforcement_needed_to_hold_until(
            target.id,
            turns,
            hold_until,
            planned_commitments=planned_commitments,
            upper_bound=src_cap,
        )
        if need <= 0 or need > src_cap:
            tested[send] = None
            return None

        desired = min(src_cap, need + REINFORCE_SAFETY_MARGIN)
        result = (angle, turns, hold_until, need, send, desired)
        tested[send] = result
        tested_order.append(send)
        return result

    initial_candidates = sorted(
        world.probe_ship_candidates(src.id, target.id, src_cap, hints=(seed_hint,)),
        key=lambda send: (abs(send - seed_hint), send),
    )

    current_send = None
    for seed in initial_candidates:
        result = evaluate(seed)
        if result is None:
            continue
        current_send = seed
        break

    if current_send is None:
        return None

    for _ in range(max_iter):
        result = evaluate(current_send)
        if result is None:
            break

        angle, turns, eval_turn, need, actual_send, desired = result
        if desired == actual_send:
            return angle, turns, eval_turn, need, actual_send

        next_send = max(1, min(src_cap, int(desired)))
        if next_send in tested:
            current_send = next_send
            break
        current_send = next_send

    candidate_sends = sorted(
        [send for send in tested_order if tested.get(send) is not None],
        key=lambda send: (abs(send - seed_hint), tested[send][1], send),
    )
    for send in candidate_sends:
        result = tested.get(send)
        if result is None:
            continue
        angle, turns, eval_turn, need, actual_send, _ = result
        if actual_send < need or turns > max_arrival_turn:
            continue
        return angle, turns, eval_turn, need, actual_send

    return None


def build_snipe_mission(src, target, src_available, world, planned_commitments, modes, policy):
    if target.owner != -1:
        return None

    enemy_etas = sorted({
        int(math.ceil(eta))
        for eta, owner, ships in world.arrivals_by_planet.get(target.id, [])
        if owner not in (-1, world.player) and ships > 0
    })
    if not enemy_etas:
        return None

    best = None
    for enemy_eta in enemy_etas[:3]:
        seeded = world.best_probe_aim(
            src.id,
            target.id,
            src_available,
            hints=(int(target.ships) + 1, int(target.ships) + 8),
            anchor_turn=enemy_eta,
            max_anchor_diff=1,
        )
        if seeded is None:
            continue

        probe, rough = seeded
        sync_turn = max(rough[1], enemy_eta)
        if target.id in world.comet_ids:
            life = world.comet_life(target.id)
            if sync_turn >= life or sync_turn > COMET_MAX_CHASE_TURNS:
                continue

        plan = settle_plan(
            src,
            target,
            src_available,
            probe,
            world,
            planned_commitments,
            modes,
            policy,
            mission="snipe",
            eval_turn_fn=lambda turns, enemy_eta=enemy_eta: max(turns, enemy_eta),
            anchor_turn=enemy_eta,
        )
        if plan is None:
            continue

        angle, turns, sync_turn, need, send_pref = plan
        if target.id in world.comet_ids:
            life = world.comet_life(target.id)
            if sync_turn >= life or sync_turn > COMET_MAX_CHASE_TURNS:
                continue

        value = target_value(target, sync_turn, "snipe", world, modes, policy)
        if value <= 0:
            continue

        score = apply_score_modifiers(
            value / (send_pref + sync_turn * SNIPE_COST_TURN_WEIGHT + 1.0),
            target,
            "snipe",
            world,
        )
        option = ShotOption(
            score=score,
            src_id=src.id,
            target_id=target.id,
            angle=angle,
            turns=turns,
            needed=need,
            send_cap=send_pref,
            mission="snipe",
            anchor_turn=enemy_eta,
        )
        mission_obj = Mission(
            kind="snipe",
            score=score,
            target_id=target.id,
            turns=sync_turn,
            options=[option],
        )
        if best is None or mission_obj.score > best.score:
            best = mission_obj

    return best


def build_rescue_missions(world, policy, planned_commitments, modes):
    missions = []

    for target in world.my_planets:
        if target.id in policy.get("doomed_planets", set()):
            continue
        fall_turn = world.fall_turn_map.get(target.id)
        if fall_turn is None or fall_turn > DEFENSE_LOOKAHEAD_TURNS:
            continue

        for src in world.nearest_my_sources(target.id, min(DEFENSE_SOURCE_TOP_K, len(world.my_planets))):
            if src.id == target.id:
                continue

            src_available = policy["attack_budget"].get(src.id, 0)
            if src_available < PARTIAL_SOURCE_MIN_SHIPS:
                continue

            seeded = world.best_probe_aim(
                src.id,
                target.id,
                src_available,
                hints=(target.production + DEFENSE_SEND_MARGIN_BASE + 2,),
                max_turn=fall_turn,
            )
            if seeded is None:
                continue
            probe, probe_aim = seeded
            plan = settle_plan(
                src,
                target,
                src_available,
                probe,
                world,
                planned_commitments,
                modes,
                policy,
                mission="rescue",
                eval_turn_fn=lambda _turns, fall_turn=fall_turn: fall_turn,
                anchor_turn=fall_turn,
            )
            if plan is None:
                continue

            angle, turns, _, need, send_pref = plan
            saved_turns = max(1, world.remaining_steps - fall_turn)
            value = target.production * saved_turns + max(0, target.ships) * DEFENSE_SHIP_VALUE
            if world.enemy_planets and nearest_distance_to_set(target.x, target.y, world.enemy_planets) < 22:
                value *= DEFENSE_FRONTIER_SCORE_MULT
            score = value / (send_pref + turns * DEFENSE_COST_TURN_WEIGHT + 1.0)

            option = ShotOption(
                score=score,
                src_id=src.id,
                target_id=target.id,
                angle=angle,
                turns=turns,
                needed=need,
                send_cap=send_pref,
                mission="rescue",
                anchor_turn=fall_turn,
            )
            missions.append(Mission(
                kind="rescue",
                score=score,
                target_id=target.id,
                turns=fall_turn,
                options=[option],
            ))

    return missions


def build_recapture_missions(world, policy, planned_commitments, modes):
    missions = []

    for target in world.my_planets:
        fall_turn = world.fall_turn_map.get(target.id)
        if fall_turn is None or fall_turn > DEFENSE_LOOKAHEAD_TURNS:
            continue

        for src in world.nearest_my_sources(target.id, min(DEFENSE_SOURCE_TOP_K, len(world.my_planets))):
            if src.id == target.id:
                continue

            src_available = policy["attack_budget"].get(src.id, 0)
            if src_available < PARTIAL_SOURCE_MIN_SHIPS:
                continue

            seeded = world.best_probe_aim(
                src.id,
                target.id,
                src_available,
                hints=(target.production + DEFENSE_SEND_MARGIN_BASE + 2,),
                min_turn=fall_turn + 1,
                max_turn=fall_turn + RECAPTURE_LOOKAHEAD_TURNS,
            )
            if seeded is None:
                continue
            probe, probe_aim = seeded
            probe_turns = probe_aim[1]

            plan = settle_plan(
                src,
                target,
                src_available,
                probe,
                world,
                planned_commitments,
                modes,
                policy,
                mission="capture",
            )
            if plan is None:
                continue

            angle, turns, _, need, send_pref = plan
            if turns <= fall_turn or turns - fall_turn > RECAPTURE_LOOKAHEAD_TURNS:
                continue

            saved_turns = max(1, world.remaining_steps - turns)
            value = (
                RECAPTURE_PRODUCTION_WEIGHT * target.production * saved_turns
                + RECAPTURE_IMMEDIATE_WEIGHT * max(0, target.ships)
            )
            if world.enemy_planets and nearest_distance_to_set(target.x, target.y, world.enemy_planets) < 22:
                value *= RECAPTURE_FRONTIER_MULT
            value *= RECAPTURE_VALUE_MULT
            score = value / (send_pref + turns * RECAPTURE_COST_TURN_WEIGHT + 1.0)

            option = ShotOption(
                score=score,
                src_id=src.id,
                target_id=target.id,
                angle=angle,
                turns=turns,
                needed=need,
                send_cap=send_pref,
                mission="recapture",
                anchor_turn=fall_turn,
            )
            missions.append(Mission(
                kind="recapture",
                score=score,
                target_id=target.id,
                turns=turns,
                options=[option],
            ))

    return missions


def build_reinforce_missions(world, policy, planned_commitments, modes, inventory_left_fn):
    if not REINFORCE_ENABLED:
        return []

    missions = []
    if world.remaining_steps < REINFORCE_MIN_FUTURE_TURNS:
        return missions

    for target in world.my_planets:
        if target.id in policy.get("doomed_planets", set()):
            continue
        fall_turn = world.fall_turn_map.get(target.id)
        if fall_turn is None:
            continue
        if target.production < REINFORCE_MIN_PRODUCTION:
            continue

        hold_until = min(world.horizon, fall_turn + REINFORCE_HOLD_LOOKAHEAD)
        max_arrival_turn = min(fall_turn, REINFORCE_MAX_TRAVEL_TURNS)

        for src in world.nearest_my_sources(target.id, min(DEFENSE_SOURCE_TOP_K, len(world.my_planets))):
            if src.id == target.id:
                continue

            budget = inventory_left_fn(src.id)
            source_cap = min(budget, int(src.ships * REINFORCE_MAX_SOURCE_FRACTION))
            if source_cap < PARTIAL_SOURCE_MIN_SHIPS:
                continue

            seeded = world.best_probe_aim(
                src.id,
                target.id,
                source_cap,
                hints=(target.production + REINFORCE_SAFETY_MARGIN + 2,),
                max_turn=max_arrival_turn,
            )
            if seeded is None:
                continue
            probe, _ = seeded

            plan = settle_reinforce_plan(
                src,
                target,
                source_cap,
                probe,
                world,
                planned_commitments,
                hold_until,
                max_arrival_turn,
            )
            if plan is None:
                continue

            angle, turns, _, need, send_pref = plan
            value = reinforce_value(target, hold_until, world, policy)
            score = value / (send_pref + turns * REINFORCE_COST_TURN_WEIGHT + 1.0)

            option = ShotOption(
                score=score,
                src_id=src.id,
                target_id=target.id,
                angle=angle,
                turns=turns,
                needed=need,
                send_cap=send_pref,
                mission="reinforce",
                anchor_turn=hold_until,
            )
            missions.append(Mission(
                kind="reinforce",
                score=score,
                target_id=target.id,
                turns=fall_turn,
                options=[option],
            ))

    return missions


def build_stabilize_missions(world, policy, planned_commitments, modes, inventory_left_fn):
    missions = []
    if world.remaining_steps < REINFORCE_MIN_FUTURE_TURNS or not world.is_four_player:
        return missions

    for target in world.my_planets:
        if target.id in policy.get("doomed_planets", set()):
            continue
        if world.fall_turn_map.get(target.id) is not None:
            continue
        first_enemy = world.first_enemy_map.get(target.id)
        if first_enemy is None or first_enemy > DEFENSE_LOOKAHEAD_TURNS:
            continue
        if target.production < REINFORCE_MIN_PRODUCTION:
            continue

        min_owned = world.min_owned_map.get(target.id, int(target.ships))
        pressure_floor = max(4, target.production * 2)
        frontier_pressure = world.enemy_planets and nearest_distance_to_set(target.x, target.y, world.enemy_planets) < 20
        if min_owned > pressure_floor and not frontier_pressure:
            continue

        hold_until = min(world.horizon, first_enemy + max(8, REINFORCE_HOLD_LOOKAHEAD // 2))
        max_arrival_turn = min(hold_until, REINFORCE_MAX_TRAVEL_TURNS)

        for src in world.nearest_my_sources(target.id, min(DEFENSE_SOURCE_TOP_K, len(world.my_planets))):
            if src.id == target.id:
                continue

            budget = inventory_left_fn(src.id)
            source_cap = min(budget, int(src.ships * REINFORCE_MAX_SOURCE_FRACTION))
            if source_cap < PARTIAL_SOURCE_MIN_SHIPS:
                continue

            seeded = world.best_probe_aim(
                src.id,
                target.id,
                source_cap,
                hints=(pressure_floor, target.production + REINFORCE_SAFETY_MARGIN + 2),
                max_turn=max_arrival_turn,
            )
            if seeded is None:
                continue
            probe, _ = seeded

            plan = settle_reinforce_plan(
                src,
                target,
                source_cap,
                probe,
                world,
                planned_commitments,
                hold_until,
                max_arrival_turn,
            )
            if plan is None:
                continue

            angle, turns, _, need, send_pref = plan
            if turns > hold_until:
                continue

            value = reinforce_value(target, hold_until, world, policy)
            if frontier_pressure:
                value *= DEFENSE_FRONTIER_SCORE_MULT
            score = value / (send_pref + turns * REINFORCE_COST_TURN_WEIGHT + 1.0)

            option = ShotOption(
                score=score,
                src_id=src.id,
                target_id=target.id,
                angle=angle,
                turns=turns,
                needed=need,
                send_cap=send_pref,
                mission="reinforce",
                anchor_turn=hold_until,
            )
            missions.append(Mission(
                kind="reinforce",
                score=score,
                target_id=target.id,
                turns=first_enemy,
                options=[option],
            ))

    return missions


def build_crash_exploit_missions(world, policy, planned_commitments, modes):
    if not CRASH_EXPLOIT_ENABLED:
        return []

    missions = []
    for crash in detect_enemy_crashes(world):
        target = world.planet_by_id[crash["target_id"]]
        if target.owner == world.player:
            continue
        desired_arrival = crash["crash_turn"] + CRASH_EXPLOIT_POST_CRASH_DELAY

        for src in world.nearest_my_sources(target.id, min(DEFENSE_SOURCE_TOP_K, len(world.my_planets))):
            src_available = policy["attack_budget"].get(src.id, 0)
            if src_available < PARTIAL_SOURCE_MIN_SHIPS:
                continue

            seeded = world.best_probe_aim(
                src.id,
                target.id,
                src_available,
                hints=(12, int(target.ships) + 1),
                anchor_turn=desired_arrival,
                max_anchor_diff=CRASH_EXPLOIT_ETA_WINDOW,
            )
            if seeded is None:
                continue
            probe, _ = seeded

            plan = settle_plan(
                src,
                target,
                src_available,
                probe,
                world,
                planned_commitments,
                modes,
                policy,
                mission="crash_exploit",
                eval_turn_fn=lambda turns, desired_arrival=desired_arrival: max(turns, desired_arrival),
                anchor_turn=desired_arrival,
                anchor_tolerance=CRASH_EXPLOIT_ETA_WINDOW,
            )
            if plan is None:
                continue

            angle, turns, _, need, send_pref = plan
            if not candidate_time_valid(target, turns, world, LATE_CAPTURE_BUFFER):
                continue
            value = target_value(target, turns, "crash_exploit", world, modes, policy)
            if value <= 0:
                continue

            score = apply_score_modifiers(
                value / (send_pref + turns * SNIPE_COST_TURN_WEIGHT + 1.0),
                target,
                "crash_exploit",
                world,
            )
            option = ShotOption(
                score=score,
                src_id=src.id,
                target_id=target.id,
                angle=angle,
                turns=turns,
                needed=need,
                send_cap=send_pref,
                mission="crash_exploit",
                anchor_turn=desired_arrival,
            )
            missions.append(Mission(
                kind="crash_exploit",
                score=score,
                target_id=target.id,
                turns=turns,
                options=[option],
            ))

    return missions


def build_gang_up_missions(world, policy, planned_commitments, modes):
    """
    Attack enemy planets that will be weakened by inter-enemy combat.
    Schedule our fleet to arrive shortly after the battle resolves.
    This is the key 4P tactic: use enemies fighting each other to our advantage.
    """
    missions = []

    for battle in detect_enemy_planet_battles(world):
        target = world.planet_by_id[battle["target_id"]]
        if target.owner == world.player:
            continue

        # Arrive a couple turns after the battle to clean up
        desired_arrival = battle["battle_turn"] + GANG_UP_POST_BATTLE_DELAY

        for src in world.nearest_my_sources(target.id, min(DEFENSE_SOURCE_TOP_K, len(world.my_planets))):
            src_available = policy["attack_budget"].get(src.id, 0)
            if src_available < PARTIAL_SOURCE_MIN_SHIPS:
                continue

            # Hint: need just slightly more than estimated post-battle ships
            post_hint = max(3, int(battle["post_ships"]) + 3)
            seeded = world.best_probe_aim(
                src.id,
                target.id,
                src_available,
                hints=(post_hint, int(target.ships) + 1),
                anchor_turn=desired_arrival,
                max_anchor_diff=GANG_UP_ETA_WINDOW,
            )
            if seeded is None:
                continue
            probe, _ = seeded

            plan = settle_plan(
                src,
                target,
                src_available,
                probe,
                world,
                planned_commitments,
                modes,
                policy,
                mission="capture",
                eval_turn_fn=lambda turns, da=desired_arrival: max(turns, da),
                anchor_turn=desired_arrival,
                anchor_tolerance=GANG_UP_ETA_WINDOW,
            )
            if plan is None:
                continue

            angle, turns, _, need, send_pref = plan
            if not candidate_time_valid(target, turns, world, LATE_CAPTURE_BUFFER):
                continue

            value = target_value(target, turns, "capture", world, modes, policy)
            value *= GANG_UP_VALUE_MULT  # extra bonus for exploiting enemy fight
            if value <= 0:
                continue

            score = apply_score_modifiers(
                value / (send_pref + turns * ATTACK_COST_TURN_WEIGHT + 1.0),
                target,
                "capture",
                world,
            )

            option = ShotOption(
                score=score,
                src_id=src.id,
                target_id=target.id,
                angle=angle,
                turns=turns,
                needed=need,
                send_cap=send_pref,
                mission="capture",
                anchor_turn=desired_arrival,
            )
            missions.append(Mission(
                kind="single",
                score=score,
                target_id=target.id,
                turns=turns,
                options=[option],
            ))

    return missions


def build_elimination_missions(world, policy, planned_commitments, modes):
    """
    Dedicated missions to eliminate the weakest enemy entirely.
    High priority in 4P — removing a player is a massive advantage.
    Only activates when we have a clear strength advantage over the target.
    """
    if world._weakest_enemy is None:
        return []

    weakest = world._weakest_enemy
    weakest_total = world._weakest_enemy_strength

    # Only pursue if we're meaningfully stronger than the target
    if weakest_total > world.my_total * 0.9:
        return []

    # Must be clearly the weakest (not just slightly weaker than someone else)
    other_enemies = [
        s for owner, s in world.owner_strength.items()
        if owner not in (world.player, weakest)
    ]
    if other_enemies and weakest_total > min(other_enemies) * 0.95:
        return []

    weakest_planets = [p for p in world.enemy_planets if p.owner == weakest]
    if not weakest_planets:
        return []

    missions = []
    elimination_bonus_mult = 1.5 if world.is_four_player else 1.25

    for target in weakest_planets:
        for src in world.nearest_my_sources(target.id, min(DEFENSE_SOURCE_TOP_K, len(world.my_planets))):
            src_available = policy["attack_budget"].get(src.id, 0)
            if src_available < PARTIAL_SOURCE_MIN_SHIPS:
                continue

            seeded = world.best_probe_aim(
                src.id,
                target.id,
                src_available,
                hints=(int(target.ships) + 1, int(target.ships) + 5),
            )
            if seeded is None:
                continue
            probe, rough_aim = seeded
            rough_turns = rough_aim[1]

            if not candidate_time_valid(target, rough_turns, world, LATE_CAPTURE_BUFFER):
                continue

            global_needed = world.min_ships_to_own_at(
                target.id, rough_turns, world.player,
                planned_commitments=planned_commitments,
            )
            if global_needed <= 0 or global_needed > src_available:
                continue

            send_guess = preferred_send(target, global_needed, rough_turns, src_available, world, modes, policy)
            plan = settle_plan(
                src, target, src_available, send_guess,
                world, planned_commitments, modes, policy,
                mission="capture",
            )
            if plan is None:
                continue

            angle, turns, _, need, send_pref = plan
            if not candidate_time_valid(target, turns, world, LATE_CAPTURE_BUFFER):
                continue
            if send_pref < need:
                continue

            value = target_value(target, turns, "capture", world, modes, policy)
            if value <= 0:
                continue

            score = apply_score_modifiers(
                value * elimination_bonus_mult / (send_pref + turns * ATTACK_COST_TURN_WEIGHT + 1.0),
                target, "capture", world,
            )

            option = ShotOption(
                score=score, src_id=src.id, target_id=target.id,
                angle=angle, turns=turns, needed=need, send_cap=send_pref,
                mission="capture",
            )
            missions.append(Mission(
                kind="single", score=score, target_id=target.id,
                turns=turns, options=[option],
            ))

    return missions


def plan_moves(world, deadline=None, modes=None, policy=None):
    def expired():
        return deadline is not None and time.perf_counter() > deadline

    def time_left():
        if deadline is None:
            return 10**9
        return deadline - time.perf_counter()

    def allow_heavy_phase():
        return time_left() > HEAVY_PHASE_MIN_TIME and len(world.planets) <= HEAVY_ROUTE_PLANET_LIMIT

    def allow_optional_phase():
        return time_left() > OPTIONAL_PHASE_MIN_TIME

    modes = modes or build_modes(world)
    policy = policy or build_policy_state(world, deadline=deadline)
    planned_commitments = defaultdict(list)
    source_options_by_target = defaultdict(list)
    missions = []
    moves = []
    spent_total = defaultdict(int)

    def source_inventory_left(source_id):
        return world.source_inventory_left(source_id, spent_total)

    def source_attack_left(source_id):
        budget = policy["attack_budget"].get(source_id, 0)
        return max(0, budget - spent_total[source_id])

    def append_move(src_id, angle, ships):
        send = min(int(ships), source_inventory_left(src_id))
        if send < 1:
            return 0
        moves.append([src_id, float(angle), int(send)])
        spent_total[src_id] += send
        return send

    def finalize_moves():
        final_moves = []
        used_final = defaultdict(int)
        for src_id, angle, ships in moves:
            source = world.planet_by_id[src_id]
            max_allowed = int(source.ships) - used_final[src_id]
            send = min(int(ships), max_allowed)
            if send >= 1:
                final_moves.append([src_id, float(angle), int(send)])
                used_final[src_id] += send
        return final_moves

    def compute_live_doomed():
        if policy is not None and "doomed_planets" in policy:
            return policy["doomed_planets"]
        doomed = set()
        for planet in world.my_planets:
            is_expiring_comet = False
            if planet.id in world.comet_ids:
                life = comet_remaining_life(planet.id, world.comets)
                if life <= DOOMED_EVAC_TURN_LIMIT:
                    is_expiring_comet = True
            if is_expiring_comet:
                doomed.add(planet.id)
                continue
            status = world.hold_status(
                planet.id,
                planned_commitments=planned_commitments,
                horizon=DOOMED_EVAC_TURN_LIMIT,
            )
            if (
                not status["holds_full"]
                and status["fall_turn"] is not None
                and status["fall_turn"] <= DOOMED_EVAC_TURN_LIMIT
                and source_inventory_left(planet.id) >= DOOMED_MIN_SHIPS
            ):
                doomed.add(planet.id)
        return doomed

    def time_filters_pass(target, turns, needed, src_cap):
        if not candidate_time_valid(target, turns, world, VERY_LATE_CAPTURE_BUFFER if world.is_very_late else LATE_CAPTURE_BUFFER):
            return False
        if opening_filter(target, turns, needed, src_cap, world, policy):
            return False
        return True

    # === MISSION BUILDING PHASE ===

    if allow_heavy_phase():
        missions.extend(
            build_reinforce_missions(world, policy, planned_commitments, modes, source_inventory_left)
        )
        missions.extend(
            build_stabilize_missions(world, policy, planned_commitments, modes, source_inventory_left)
        )

    missions.extend(build_rescue_missions(world, policy, planned_commitments, modes))
    missions.extend(build_recapture_missions(world, policy, planned_commitments, modes))

    # Elimination missions — high priority in 4P
    if allow_heavy_phase():
        missions.extend(build_elimination_missions(world, policy, planned_commitments, modes))

    # Gang-up missions — exploit inter-enemy fights (very useful in 4P)
    if allow_heavy_phase():
        missions.extend(build_gang_up_missions(world, policy, planned_commitments, modes))

    for src in world.my_planets:
        if expired():
            return finalize_moves()
        src_available = source_attack_left(src.id)
        if src_available <= 0:
            continue

        for target in candidate_targets_for_source(src, world, policy, modes):
            if expired():
                return finalize_moves()

            seeded = world.best_probe_aim(
                src.id,
                target.id,
                src_available,
                hints=(int(target.ships) + 1,),
            )
            if seeded is None:
                continue
            _, rough_aim = seeded

            rough_turns = rough_aim[1]
            if not candidate_time_valid(
                target,
                rough_turns,
                world,
                VERY_LATE_CAPTURE_BUFFER if world.is_very_late else LATE_CAPTURE_BUFFER,
            ):
                continue

            global_needed = world.min_ships_to_own_at(
                target.id,
                rough_turns,
                world.player,
                planned_commitments=planned_commitments,
            )
            if global_needed <= 0:
                continue
            if opening_filter(target, rough_turns, global_needed, src_available, world, policy):
                continue

            partial_send_cap = min(
                src_available,
                preferred_send(target, global_needed, rough_turns, src_available, world, modes, policy),
            )
            if partial_send_cap >= PARTIAL_SOURCE_MIN_SHIPS:
                partial_seed = world.best_probe_aim(
                    src.id,
                    target.id,
                    partial_send_cap,
                    hints=(partial_send_cap, global_needed, int(target.ships) + 1),
                )
                if partial_seed is not None:
                    _, partial_aim = partial_seed
                    p_angle, p_turns, _, _ = partial_aim
                    if time_filters_pass(target, p_turns, global_needed, src_available):
                        partial_value = target_value(target, p_turns, "swarm", world, modes, policy)
                        if partial_value > 0:
                            partial_score = apply_score_modifiers(
                                partial_value / (partial_send_cap + p_turns * ATTACK_COST_TURN_WEIGHT + 1.0),
                                target,
                                "swarm",
                                world,
                            )
                            source_options_by_target[target.id].append(
                                ShotOption(
                                    score=partial_score,
                                    src_id=src.id,
                                    target_id=target.id,
                                    angle=p_angle,
                                    turns=p_turns,
                                    needed=global_needed,
                                    send_cap=partial_send_cap,
                                    mission="swarm",
                                )
                            )

            if global_needed <= src_available:
                send_guess = preferred_send(
                    target, global_needed, rough_turns, src_available, world, modes, policy,
                )
                plan = settle_plan(
                    src,
                    target,
                    src_available,
                    send_guess,
                    world,
                    planned_commitments,
                    modes,
                    policy,
                    mission="capture",
                )
                if plan is None:
                    continue

                angle, turns, _, needed, send_cap = plan
                if not time_filters_pass(target, turns, needed, src_available):
                    continue
                if send_cap < 1:
                    continue

                value = target_value(target, turns, "capture", world, modes, policy)
                if value <= 0:
                    continue

                score = apply_score_modifiers(
                    value / (send_cap + turns * ATTACK_COST_TURN_WEIGHT + 1.0),
                    target,
                    "capture",
                    world,
                )

                option = ShotOption(
                    score=score,
                    src_id=src.id,
                    target_id=target.id,
                    angle=angle,
                    turns=turns,
                    needed=needed,
                    send_cap=send_cap,
                    mission="capture",
                )

                if send_cap >= needed:
                    missions.append(Mission(
                        kind="single",
                        score=score,
                        target_id=target.id,
                        turns=turns,
                        options=[option],
                    ))

        # snipe pass — runs over ALL planets (not just top-K) so low-prod
        # contested neutrals with incoming enemy fleets are never missed
        for target in world.planets:
            if expired():
                return finalize_moves()
            if target.id == src.id or target.owner == world.player:
                continue
            snipe = build_snipe_mission(src, target, src_available, world, planned_commitments, modes, policy)
            if snipe is not None:
                missions.append(snipe)

    for target_id, options in source_options_by_target.items():
        if expired():
            return finalize_moves()
        if len(options) < 2:
            continue

        target = world.planet_by_id[target_id]
        top_options = sorted(options, key=lambda item: -item.score)[:MULTI_SOURCE_TOP_K]
        for i in range(len(top_options)):
            for j in range(i + 1, len(top_options)):
                first = top_options[i]
                second = top_options[j]
                if first.src_id == second.src_id:
                    continue
                pair_tol = swarm_eta_tolerance((first, second), target, world)
                if abs(first.turns - second.turns) > pair_tol:
                    continue

                joint_turn = max(first.turns, second.turns)
                total_cap = first.send_cap + second.send_cap
                need = world.min_ships_to_own_at(
                    target_id,
                    joint_turn,
                    world.player,
                    planned_commitments=planned_commitments,
                    upper_bound=total_cap,
                )
                if need <= 0:
                    continue
                if first.send_cap >= need or second.send_cap >= need:
                    continue
                if total_cap < need:
                    continue

                value = target_value(target, joint_turn, "swarm", world, modes, policy)
                if value <= 0:
                    continue

                pair_score = apply_score_modifiers(
                    value / (need + joint_turn * ATTACK_COST_TURN_WEIGHT + 1.0),
                    target,
                    "swarm",
                    world,
                )
                pair_score *= MULTI_SOURCE_PLAN_PENALTY
                missions.append(Mission(
                    kind="swarm",
                    score=pair_score,
                    target_id=target_id,
                    turns=joint_turn,
                    options=[first, second],
                ))

        if (
            THREE_SOURCE_SWARM_ENABLED
            and allow_heavy_phase()
            and target.owner not in (-1, world.player)
            and int(target.ships) >= THREE_SOURCE_MIN_TARGET_SHIPS
            and len(top_options) >= 3
        ):
            for i in range(len(top_options)):
                for j in range(i + 1, len(top_options)):
                    for k in range(j + 1, len(top_options)):
                        if expired():
                            return finalize_moves()
                        trio = [top_options[i], top_options[j], top_options[k]]
                        if len({option.src_id for option in trio}) < 3:
                            continue
                        trio_tol = swarm_eta_tolerance(tuple(trio), target, world)
                        turns = [option.turns for option in trio]
                        if max(turns) - min(turns) > trio_tol:
                            continue

                        joint_turn = max(turns)
                        total_cap = sum(option.send_cap for option in trio)
                        need = world.min_ships_to_own_at(
                            target_id,
                            joint_turn,
                            world.player,
                            planned_commitments=planned_commitments,
                            upper_bound=total_cap,
                        )
                        if need <= 0 or total_cap < need:
                            continue
                        if any(
                            trio[a].send_cap + trio[b].send_cap >= need
                            for a in range(3)
                            for b in range(a + 1, 3)
                        ):
                            continue

                        value = target_value(target, joint_turn, "swarm", world, modes, policy)
                        if value <= 0:
                            continue

                        trio_score = apply_score_modifiers(
                            value / (need + joint_turn * ATTACK_COST_TURN_WEIGHT + 1.0),
                            target,
                            "swarm",
                            world,
                        )
                        trio_score *= THREE_SOURCE_PLAN_PENALTY
                        missions.append(Mission(
                            kind="swarm",
                            score=trio_score,
                            target_id=target_id,
                            turns=joint_turn,
                            options=trio,
                        ))

    if allow_heavy_phase():
        missions.extend(build_crash_exploit_missions(world, policy, planned_commitments, modes))

    missions.sort(key=lambda item: -item.score)

    # === MISSION EXECUTION PHASE ===

    for mission in missions:
        if expired():
            return finalize_moves()
        target = world.planet_by_id[mission.target_id]

        if mission.kind in ("single", "snipe", "rescue", "recapture", "reinforce", "crash_exploit"):
            option = mission.options[0]
            src = world.planet_by_id[option.src_id]
            if mission.kind == "reinforce":
                left = min(
                    source_inventory_left(option.src_id),
                    int(src.ships * REINFORCE_MAX_SOURCE_FRACTION),
                )
            else:
                left = source_attack_left(option.src_id)
            if left <= 0:
                continue

            if mission.kind == "reinforce":
                plan = settle_reinforce_plan(
                    src,
                    target,
                    left,
                    min(left, option.send_cap),
                    world,
                    planned_commitments,
                    option.anchor_turn,
                    mission.turns,
                )
            elif mission.kind == "rescue":
                plan = settle_plan(
                    src,
                    target,
                    left,
                    min(left, option.send_cap),
                    world,
                    planned_commitments,
                    modes,
                    policy,
                    mission="rescue",
                    eval_turn_fn=lambda _turns, hold_turn=mission.turns: hold_turn,
                    anchor_turn=option.anchor_turn,
                )
            elif mission.kind == "snipe":
                plan = settle_plan(
                    src,
                    target,
                    left,
                    min(left, option.send_cap),
                    world,
                    planned_commitments,
                    modes,
                    policy,
                    mission="snipe",
                    eval_turn_fn=lambda turns, enemy_eta=option.anchor_turn: max(turns, enemy_eta),
                    anchor_turn=option.anchor_turn,
                )
            elif mission.kind == "crash_exploit":
                plan = settle_plan(
                    src,
                    target,
                    left,
                    min(left, option.send_cap),
                    world,
                    planned_commitments,
                    modes,
                    policy,
                    mission="crash_exploit",
                    eval_turn_fn=lambda turns, desired_arrival=option.anchor_turn: max(turns, desired_arrival),
                    anchor_turn=option.anchor_turn,
                    anchor_tolerance=CRASH_EXPLOIT_ETA_WINDOW,
                )
            else:
                plan = settle_plan(
                    src,
                    target,
                    left,
                    min(left, option.send_cap),
                    world,
                    planned_commitments,
                    modes,
                    policy,
                    mission="capture",
                )
            if plan is None:
                continue

            angle, turns, _, need, send = plan
            if send < need or need > left:
                continue

            sent = append_move(option.src_id, angle, send)
            if sent < need:
                continue
            planned_commitments[target.id].append((turns, world.player, int(sent)))
            continue

        limits = []
        for option in mission.options:
            left = source_attack_left(option.src_id)
            limits.append(min(left, option.send_cap))
        if min(limits) <= 0:
            continue

        missing = world.min_ships_to_own_at(
            target.id,
            mission.turns,
            world.player,
            planned_commitments=planned_commitments,
            upper_bound=sum(limits),
        )
        if missing <= 0 or sum(limits) < missing:
            continue

        ordered = sorted(
            zip(mission.options, limits),
            key=lambda item: (item[0].turns, -item[1], item[0].src_id),
        )
        remaining = missing
        sends = {}
        for idx, (option, limit) in enumerate(ordered):
            remaining_other = sum(other_limit for _, other_limit in ordered[idx + 1:])
            send = min(limit, max(0, remaining - remaining_other))
            sends[option.src_id] = send
            remaining -= send
        if remaining > 0:
            continue

        reaimed = []
        for option, _ in ordered:
            send = sends.get(option.src_id, 0)
            if send <= 0:
                continue
            src = world.planet_by_id[option.src_id]
            fixed_aim = world.plan_shot(src.id, target.id, send)
            if fixed_aim is None:
                reaimed = []
                break
            angle, turns, _, _ = fixed_aim
            reaimed.append((option.src_id, angle, turns, send))
        if not reaimed:
            continue

        turns_only = [item[2] for item in reaimed]
        eta_tol = swarm_eta_tolerance(mission.options, target, world)
        if max(turns_only) - min(turns_only) > eta_tol:
            continue

        actual_joint_turn = max(turns_only)
        owner_after, _ = world.projected_state(
            target.id,
            actual_joint_turn,
            planned_commitments=planned_commitments,
            extra_arrivals=[(turns, world.player, send) for _, _, turns, send in reaimed],
        )
        if owner_after != world.player:
            continue

        committed = []
        for src_id, angle, turns, send in reaimed:
            actual = append_move(src_id, angle, send)
            if actual <= 0:
                continue
            committed.append((turns, world.player, int(actual)))
        if sum(item[2] for item in committed) < missing:
            continue
        planned_commitments[target.id].extend(committed)

    # === FOLLOWUP PHASE ===

    if not world.is_very_late and allow_optional_phase():
        for src in world.my_planets:
            if expired():
                return finalize_moves()
            src_left = source_attack_left(src.id)
            if src_left < FOLLOWUP_MIN_SHIPS:
                continue

            best = None
            for target in candidate_targets_for_source(src, world, policy, modes):
                if expired():
                    return finalize_moves()
                if target.id in world.comet_ids and target.production <= LOW_VALUE_COMET_PRODUCTION:
                    continue

                seeded = world.best_probe_aim(
                    src.id,
                    target.id,
                    src_left,
                    hints=(int(target.ships) + 1,),
                )
                if seeded is None:
                    continue
                rough_ships, rough_aim = seeded

                est_turns = rough_aim[1]
                if world.is_late and est_turns > world.remaining_steps - LATE_CAPTURE_BUFFER:
                    continue

                rough_needed = world.min_ships_to_own_at(
                    target.id,
                    est_turns,
                    world.player,
                    planned_commitments=planned_commitments,
                    upper_bound=src_left,
                )
                if rough_needed <= 0 or rough_needed > src_left:
                    continue
                if opening_filter(target, est_turns, rough_needed, src_left, world, policy):
                    continue

                send = preferred_send(target, rough_needed, est_turns, src_left, world, modes, policy)
                if send < rough_needed:
                    continue

                plan = settle_plan(
                    src,
                    target,
                    src_left,
                    send,
                    world,
                    planned_commitments,
                    modes,
                    policy,
                    mission="capture",
                )
                if plan is None:
                    continue

                _, turns, _, need, final_send = plan
                if world.is_late and turns > world.remaining_steps - LATE_CAPTURE_BUFFER:
                    continue
                if final_send < need:
                    continue

                value = target_value(target, turns, "capture", world, modes, policy)
                if value <= 0:
                    continue

                score = apply_score_modifiers(
                    value / (final_send + turns * ATTACK_COST_TURN_WEIGHT + 1.0),
                    target,
                    "capture",
                    world,
                )
                if best is None or score > best[0]:
                    best = (score, target, plan)

            if best is None:
                continue

            _, target, plan = best
            angle, turns, _, need, send = plan
            src_left = source_attack_left(src.id)
            if need > src_left:
                continue

            plan = settle_plan(
                src,
                target,
                src_left,
                min(src_left, send),
                world,
                planned_commitments,
                modes,
                policy,
                mission="capture",
            )
            if plan is None:
                continue

            angle, turns, _, need, send = plan
            if send < need:
                continue

            actual = append_move(src.id, angle, send)
            if actual < need:
                continue
            planned_commitments[target.id].append((turns, world.player, int(actual)))

    # === DOOMED PLANET EVACUATION ===

    if expired():
        return finalize_moves()
    live_doomed = compute_live_doomed()
    if live_doomed:
        frontier_targets = (
            world.enemy_planets
            if world.enemy_planets
            else (world.static_neutral_planets or world.neutral_planets)
        )
        if frontier_targets:
            frontier_distance = {
                planet.id: nearest_distance_to_set(planet.x, planet.y, frontier_targets)
                for planet in world.my_planets
            }
        else:
            frontier_distance = {planet.id: 10**9 for planet in world.my_planets}

        for planet in world.my_planets:
            if expired():
                return finalize_moves()
            if planet.id not in live_doomed:
                continue

            available_now = source_inventory_left(planet.id)
            if available_now < policy["reserve"].get(planet.id, 0):
                continue

            best_capture = None
            for target in candidate_targets_for_source(planet, world, policy, modes):
                if expired():
                    return finalize_moves()
                seeded = world.best_probe_aim(
                    planet.id,
                    target.id,
                    available_now,
                    hints=(available_now, int(target.ships) + 1),
                )
                if seeded is None:
                    continue
                _, probe_aim = seeded
                probe_turns = probe_aim[1]
                if probe_turns > world.remaining_steps - 2:
                    continue

                need = world.min_ships_to_own_at(
                    target.id,
                    probe_turns,
                    world.player,
                    planned_commitments=planned_commitments,
                    upper_bound=available_now,
                )
                if need <= 0 or need > available_now:
                    continue

                plan = settle_plan(
                    planet,
                    target,
                    available_now,
                    min(available_now, max(need, int(target.ships) + 1)),
                    world,
                    planned_commitments,
                    modes,
                    policy,
                    mission="capture",
                )
                if plan is None:
                    continue
                angle, turns, _, plan_need, send = plan
                if send < plan_need:
                    continue
                score = target_value(target, turns, "capture", world, modes, policy) / (send + turns + 1.0)
                if target.owner not in (-1, world.player):
                    score *= 1.05
                if best_capture is None or score > best_capture[0]:
                    best_capture = (score, target.id, angle, turns, send)

            if best_capture is not None:
                _, target_id, angle, turns, need = best_capture
                actual = append_move(planet.id, angle, need)
                if actual >= 1:
                    planned_commitments[target_id].append((turns, world.player, int(actual)))
                continue

            safe_allies = [
                ally
                for ally in world.my_planets
                if ally.id != planet.id and ally.id not in live_doomed
            ]
            if not safe_allies:
                continue

            retreat_target = min(
                safe_allies,
                key=lambda ally: (
                    frontier_distance.get(ally.id, 10**9),
                    planet_distance(planet, ally),
                ),
            )
            aim = world.plan_shot(planet.id, retreat_target.id, available_now)
            if aim is None:
                continue
            angle, _, _, _ = aim
            append_move(planet.id, angle, available_now)

    # === REAR FORWARDING ===

    if (
        (world.enemy_planets or world.neutral_planets)
        and len(world.my_planets) > 1
        and not world.is_late
        and allow_optional_phase()
    ):
        live_doomed = compute_live_doomed()
        frontier_targets = (
            world.enemy_planets
            if world.enemy_planets
            else (world.static_neutral_planets or world.neutral_planets)
        )
        frontier_distance = {
            planet.id: nearest_distance_to_set(planet.x, planet.y, frontier_targets)
            for planet in world.my_planets
        }
        safe_fronts = [planet for planet in world.my_planets if planet.id not in live_doomed]
        if safe_fronts:
            front_anchor = min(safe_fronts, key=lambda planet: frontier_distance[planet.id])
            send_ratio = REAR_SEND_RATIO_FOUR_PLAYER if world.is_four_player else REAR_SEND_RATIO_TWO_PLAYER
            if modes["is_finishing"]:
                send_ratio = max(send_ratio, REAR_SEND_RATIO_FOUR_PLAYER)

            for rear in sorted(world.my_planets, key=lambda planet: -frontier_distance[planet.id]):
                if expired():
                    return finalize_moves()
                if rear.id == front_anchor.id or rear.id in live_doomed:
                    continue
                if source_attack_left(rear.id) < REAR_SOURCE_MIN_SHIPS:
                    continue
                if frontier_distance[rear.id] < frontier_distance[front_anchor.id] * REAR_DISTANCE_RATIO:
                    continue

                stage_candidates = [
                    planet
                    for planet in safe_fronts
                    if planet.id != rear.id
                    and frontier_distance[planet.id] < frontier_distance[rear.id] * REAR_STAGE_PROGRESS
                ]
                if stage_candidates:
                    front = min(stage_candidates, key=lambda planet: planet_distance(rear, planet))
                else:
                    objective = min(frontier_targets, key=lambda target: planet_distance(rear, target))
                    remaining_fronts = [planet for planet in safe_fronts if planet.id != rear.id]
                    if not remaining_fronts:
                        continue
                    front = min(remaining_fronts, key=lambda planet: planet_distance(planet, objective))

                if front.id == rear.id:
                    continue

                send = int(source_attack_left(rear.id) * send_ratio)
                if send < REAR_SEND_MIN_SHIPS:
                    continue

                aim = world.plan_shot(rear.id, front.id, send)
                if aim is None:
                    continue

                angle, turns, _, _ = aim
                if turns > REAR_MAX_TRAVEL_TURNS:
                    continue
                append_move(rear.id, angle, send)

    # === TOTAL WAR ENDGAME ===

    if world.is_total_war and world.enemy_planets and allow_optional_phase():
        # Prioritize weakest enemy in total war
        if world._weakest_enemy is not None:
            weakest_planets = [p for p in world.enemy_planets if p.owner == world._weakest_enemy]
            if weakest_planets:
                primary_targets = weakest_planets
            else:
                primary_targets = world.enemy_planets
        else:
            primary_targets = world.enemy_planets

        target_sets = [primary_targets]
        if world.enemy_planets != primary_targets:
            target_sets.append(world.enemy_planets)

        # Attack weakest enemy first, then others
        for target_set in target_sets:
            for src in world.my_planets:
                if expired():
                    return finalize_moves()
                atk_left = source_attack_left(src.id)
                if atk_left < 5:
                    continue

                # Find best target from current set
                best_target = None
                best_dist = float('inf')
                for ep in target_set:
                    d = planet_distance(src, ep)
                    if d < best_dist:
                        aim_test = world.plan_shot(src.id, ep.id, atk_left)
                        if aim_test is not None:
                            best_dist = d
                            best_target = ep

                if best_target is None:
                    continue
                aim = world.plan_shot(src.id, best_target.id, atk_left)
                if aim is None:
                    continue
                angle, turns, _, _ = aim
                if turns >= world.remaining_steps:
                    continue
                append_move(src.id, angle, atk_left)

    return finalize_moves()


# ============================================================
# V21 Search Layer
# ============================================================

def adaptive_horizon(world):
    """
    Adaptive forward horizon:
    - dense 4P boards: shorter horizon to control branching
    - opening: shorter horizon to preserve tempo
    - late/endgame: longer horizon when branching is lower and future matters more
    """
    remaining_cap = min(110, world.remaining_steps)
    density = len(world.planets)

    if world.is_very_late or world.is_total_war:
        return min(remaining_cap, 100)

    if not world.is_four_player:
        if world.is_opening:
            return min(remaining_cap, 45)
        return min(remaining_cap, 75)

    if world.is_four_player:
        if density >= 32:
            base = 54
        elif density >= 28:
            base = 60
        else:
            base = 68
    else:
        base = 80 if density <= 26 else 72

    if world.is_opening:
        base -= 10 if world.is_four_player else 8
    if world.my_total < max(1, world.max_enemy_strength) * 0.85:
        base += 6
    if world.my_prod >= max(1, world.enemy_prod):
        base += 4

    return max(42, min(remaining_cap, base))


def adaptive_target_top_k(world):
    if world.is_four_player:
        return 7 if len(world.planets) >= 32 else 8
    return 8


def adaptive_depth(world):
    if world.is_very_late or world.is_total_war:
        return BEAM_DEPTH_DEFAULT if world.is_four_player else BEAM_DEPTH_2P
    if not world.is_four_player:
        return BEAM_DEPTH_2P
    if world.is_four_player and len(world.planets) >= 30:
        return BEAM_DEPTH_4P_DENSE
    if world.is_four_player:
        return max(BEAM_DEPTH_DEFAULT, 4)
    if len(world.planets) <= 24:
        return BEAM_DEPTH_2P + 1
    return BEAM_DEPTH_2P



def _new_enemy_profile():
    return {
        "strength": deque(maxlen=8),
        "production": deque(maxlen=8),
        "planet_count": deque(maxlen=8),
        "outgoing": deque(maxlen=8),
        "hostile": deque(maxlen=8),
        "fleet_count": deque(maxlen=8),
    }


_ENEMY_MEMORY = defaultdict(_new_enemy_profile)


def update_enemy_memory(world):
    owners = {planet.owner for planet in world.enemy_planets}
    for owner in owners:
        profile = _ENEMY_MEMORY[owner]
        profile["strength"].append(int(world.owner_strength.get(owner, 0)))
        profile["production"].append(int(world.owner_production.get(owner, 0)))
        profile["planet_count"].append(sum(1 for planet in world.enemy_planets if planet.owner == owner))

        outgoing = 0
        hostile = 0
        fleet_count = 0
        for fleet in world.fleets:
            if fleet.owner != owner:
                continue
            fleet_count += 1
            target, _ = world.fleet_target(fleet, world.horizon)
            if target is None:
                continue
            outgoing += int(fleet.ships)
            if target.owner == world.player:
                hostile += int(fleet.ships)

        profile["outgoing"].append(int(outgoing))
        profile["hostile"].append(int(hostile))
        profile["fleet_count"].append(int(fleet_count))


def enemy_aggression_bias(owner):
    profile = _ENEMY_MEMORY.get(owner)
    if not profile or not profile["strength"]:
        return 1.0

    avg_strength = sum(profile["strength"]) / max(1, len(profile["strength"]))
    avg_prod = sum(profile["production"]) / max(1, len(profile["production"]))
    avg_outgoing = sum(profile["outgoing"]) / max(1, len(profile["outgoing"]))
    avg_hostile = sum(profile["hostile"]) / max(1, len(profile["hostile"]))
    hostile_ratio = avg_hostile / max(1.0, avg_outgoing)

    pressure = 1.0
    pressure += min(0.25, avg_outgoing / max(15.0, avg_strength + 1.0) * 0.15)
    pressure += min(0.25, hostile_ratio * 0.20)
    pressure += min(0.10, avg_prod / max(40.0, avg_strength + 10.0) * 0.05)
    return max(0.85, min(1.45, pressure))


def enemy_model_confidence(owner):
    profile = _ENEMY_MEMORY.get(owner)
    if not profile or not profile["strength"]:
        return 0.85
    turns = len(profile["strength"])
    if turns < 3:
        return 0.9
    stability = 1.0
    deltas = [abs(profile["strength"][i] - profile["strength"][i - 1]) for i in range(1, len(profile["strength"]))]
    if deltas:
        avg_delta = sum(deltas) / len(deltas)
        stability -= min(0.20, avg_delta / max(25.0, sum(profile["strength"]) / len(profile["strength"]) + 1.0) * 0.20)
    return max(0.7, min(1.15, stability))


def enemy_archetype(owner):
    profile = _ENEMY_MEMORY.get(owner)
    if not profile or not profile["strength"]:
        return "unknown"

    avg_strength = sum(profile["strength"]) / max(1, len(profile["strength"]))
    avg_prod = sum(profile["production"]) / max(1, len(profile["production"]))
    avg_outgoing = sum(profile["outgoing"]) / max(1, len(profile["outgoing"]))
    avg_hostile = sum(profile["hostile"]) / max(1, len(profile["hostile"]))
    avg_fleets = sum(profile["fleet_count"]) / max(1, len(profile["fleet_count"]))
    avg_planets = sum(profile["planet_count"]) / max(1, len(profile["planet_count"]))
    hostile_ratio = avg_hostile / max(1.0, avg_outgoing)
    launch_ratio = avg_outgoing / max(15.0, avg_strength + 1.0)

    prod_growth = 0.0
    if len(profile["production"]) >= 3:
        prod_growth = profile["production"][-1] - profile["production"][0]

    if launch_ratio >= 0.22 and hostile_ratio >= 0.55:
        return "rusher"
    if launch_ratio >= 0.18 and (avg_fleets >= 3.0 or hostile_ratio >= 0.35):
        return "pressure"
    if prod_growth >= 4.0 or (avg_planets >= 5.0 and hostile_ratio <= 0.28):
        return "expander"
    if launch_ratio <= 0.08 and avg_prod >= 8.0:
        return "turtle"
    return "balanced"


def hostile_pressure_ratio(world):
    hostile = 0
    horizon = min(world.horizon, 30)
    for fleet in world.fleets:
        if fleet.owner == world.player:
            continue
        target, _ = world.fleet_target(fleet, horizon)
        if target is not None and target.owner == world.player:
            hostile += int(fleet.ships)
    return hostile / max(1.0, float(world.my_total))


def adaptive_beam_width(world):
    width = BEAM_WIDTH_4P if world.is_four_player else BEAM_WIDTH_2P

    if world.step >= REPLAY_MIDGAME_TURN and not world.is_four_player:
        width += 1
    if world.step >= REPLAY_LATE_TURN:
        width += 1
    if hostile_pressure_ratio(world) >= 0.10:
        width += 1
    if world.my_total < max(1, world.max_enemy_strength) * 0.88:
        width += 1
    if (
        world.is_four_player
        and world.step >= REPLAY_LATE_TURN
        and world.enemy_planets
        and world.my_prod >= max(1, world.enemy_prod) * 0.35
    ):
        width += 1

    cap = BEAM_WIDTH_4P_MAX if world.is_four_player else BEAM_WIDTH_2P_MAX
    return max(4, min(cap, int(width)))


def replay_phase(world):
    if world.step <= 40:
        return "opening"
    if world.step <= 80:
        return "midgame"
    if world.step <= 180:
        return "late"
    return "endgame"


def replay_phase_prior(world):
    phase = replay_phase(world)
    is_4p = bool(world.is_four_player)
    return V24_PHASE_PRIORS[is_4p].get(phase, {"volume": 1.0, "capture": 1.0, "enemy": 1.0, "neutral": 1.0, "risk": 1.0})


def _new_replay_tracker():
    return {
        "last_step": -1,
        "prod80": None,
        "late_launches": 0,
        "late_captures": 0,
        "high_prod_captures": 0,
        "owned_prev": set(),
    }


_REPLAY_TRACKER = _new_replay_tracker()


def reset_replay_tracker():
    global _REPLAY_TRACKER
    _REPLAY_TRACKER = _new_replay_tracker()


def update_replay_tracker(world, emitted_moves=None):
    emitted_moves = emitted_moves or []
    if _REPLAY_TRACKER["last_step"] == world.step:
        if emitted_moves and world.step >= REPLAY_LATE_TURN:
            _REPLAY_TRACKER["late_launches"] += len(emitted_moves)
        return
    previous_owned = _REPLAY_TRACKER["owned_prev"]
    current_owned = {planet.id for planet in world.my_planets}
    newly_owned = current_owned - previous_owned
    for pid in newly_owned:
        planet = world.planet_by_id.get(pid)
        if planet is None:
            continue
        if world.step >= REPLAY_LATE_TURN:
            _REPLAY_TRACKER["late_captures"] += 1
        if int(planet.production) >= 4:
            _REPLAY_TRACKER["high_prod_captures"] += 1

    if world.step >= REPLAY_LATE_TURN:
        _REPLAY_TRACKER["late_launches"] += len(emitted_moves)
    if _REPLAY_TRACKER["prod80"] is None and world.step >= REPLAY_LATE_TURN:
        _REPLAY_TRACKER["prod80"] = int(world.my_prod)
    _REPLAY_TRACKER["owned_prev"] = current_owned
    _REPLAY_TRACKER["last_step"] = int(world.step)


def replay_tempo_state(world):
    gate = REPLAY_TEMPO_PRIOR[bool(world.is_four_player)]
    prod80 = _REPLAY_TRACKER["prod80"]
    if prod80 is None:
        prod80 = int(world.my_prod) if world.step >= REPLAY_LATE_TURN else None
    late_turns = max(1, world.step - REPLAY_LATE_TURN + 1) if world.step >= REPLAY_LATE_TURN else 1
    launch_target = gate["late_launch_target"] * min(1.0, late_turns / 100.0)
    capture_target = gate["late_capture_target"] * min(1.0, late_turns / 100.0)
    prod_ready = prod80 is not None and prod80 >= gate["prod80_gate"]
    launch_deficit = max(0.0, launch_target - float(_REPLAY_TRACKER["late_launches"]))
    capture_deficit = max(0.0, capture_target - float(_REPLAY_TRACKER["late_captures"]))
    pressure_boost = 1.0
    retention_boost = 1.0
    return {
        "prod80": prod80,
        "prod_ready": prod_ready,
        "late_launches": _REPLAY_TRACKER["late_launches"],
        "late_captures": _REPLAY_TRACKER["late_captures"],
        "high_prod_captures": _REPLAY_TRACKER["high_prod_captures"],
        "pressure_boost": pressure_boost,
        "retention_boost": retention_boost,
    }


def _clip(value, lo, hi):
    return max(lo, min(hi, value))


class OnlineMetaBandit:
    def __init__(self):
        self.reset()

    def reset(self):
        self.q = {arm: float(BANDIT_INITIAL_Q.get(arm, 0.0)) for arm in _META_ARMS}
        self.last = None

    def _context(self, world):
        neutral_ratio = len(world.neutral_planets) / max(1, len(world.planets))
        enemy_owners = [owner for owner in world.owner_strength if owner != world.player]
        prod_gap = (world.my_prod - world.enemy_prod) / max(1.0, world.my_prod + world.enemy_prod)
        strength_gap = (world.my_total - world.max_enemy_strength) / max(
            1.0, world.my_total + world.max_enemy_strength
        )
        hostile_fleet_ships = 0
        for fleet in world.fleets:
            if fleet.owner == world.player:
                continue
            target, _ = world.fleet_target(fleet, min(world.horizon, 30))
            if target is not None and target.owner == world.player:
                hostile_fleet_ships += int(fleet.ships)

        front_pressure = _clip(hostile_fleet_ships / max(1.0, world.my_total), 0.0, 1.0)
        live_comets = any(pid in world.planet_by_id for pid in world.comet_ids)
        exposed_count = len(world.exposed_planet_ids)
        weakest_strength = world.owner_strength.get(world._weakest_enemy, 0)
        weakest_ratio = weakest_strength / max(1.0, world.my_total)

        weakest_base = (
            REPLAY_4P_WEAKEST_CONTEXT_BASE
            if world.is_four_player and world.step < REPLAY_4P_WEAKEST_LATE_GATE_STEP
            else 0.65
        )
        return {
            "expansion": _clip(0.35 + neutral_ratio * 0.45 + max(0.0, -prod_gap) * 0.35, 0.0, 1.0),
            "pressure": _clip(0.35 + max(0.0, strength_gap) * 0.35 + min(0.25, exposed_count * 0.06), 0.0, 1.0),
            "retention": _clip(0.25 + front_pressure * 0.55 + max(0.0, -strength_gap) * 0.30, 0.0, 1.0),
            "comet": 0.80 if live_comets and not world.is_late else 0.15,
            "safety": _clip(0.25 + front_pressure * 0.45 + max(0.0, -strength_gap) * 0.35, 0.0, 1.0),
            "weakest": _clip(
                (weakest_base if world.is_four_player and world._weakest_enemy is not None else 0.20)
                + max(0.0, 0.85 - weakest_ratio) * 0.30
                + min(0.20, max(0, len(enemy_owners) - 1) * 0.06),
                0.0,
                1.0,
            ),
        }

    def _snapshot(self, world, context):
        return {
            "step": int(world.step),
            "prod": int(world.my_prod),
            "enemy_prod": int(world.enemy_prod),
            "total": int(world.my_total),
            "max_enemy": int(world.max_enemy_strength),
            "planets": len(world.my_planets),
            "context": dict(context),
        }

    def observe(self, world):
        context = self._context(world)
        if self.last is not None and world.step > self.last["step"]:
            elapsed = max(1, int(world.step) - int(self.last["step"]))
            if self.last["step"] < BANDIT_LEARN_TURNS:
                expected_total = self.last["total"] + self.last["prod"] * elapsed
                total_delta = world.my_total - expected_total
                prod_delta = world.my_prod - self.last["prod"]
                planet_delta = len(world.my_planets) - self.last["planets"]
                enemy_prod_delta = world.enemy_prod - self.last["enemy_prod"]
                max_enemy_delta = world.max_enemy_strength - self.last["max_enemy"]
                visible_loss = max(0.0, -float(total_delta))
                reward = (
                    prod_delta * 0.55
                    + planet_delta * 0.35
                    + total_delta * 0.012
                    - visible_loss * 0.025
                    - max(0, enemy_prod_delta - prod_delta) * 0.16
                    - max(0, max_enemy_delta) * 0.003
                )
                reward = _clip(reward, -2.0, 2.0)
                for arm in _META_ARMS:
                    exposure = float(self.last["context"].get(arm, 0.0))
                    decayed = self.q[arm] * BANDIT_DECAY
                    self.q[arm] = _clip(
                        decayed + BANDIT_LR * exposure * (reward - decayed),
                        -BANDIT_Q_CLIP,
                        BANDIT_Q_CLIP,
                    )

        self.last = self._snapshot(world, context)

    def policy(self, world):
        context = self._context(world)

        def mult(arm):
            signal = self.q[arm] * 0.030 + (context[arm] - 0.5) * BANDIT_CONTEXT_BIAS[arm]
            return 1.0 + _clip(signal, -BANDIT_VALUE_CLIP, BANDIT_VALUE_CLIP)

        leader_owner = None
        leader_score = -1
        for owner, strength in world.owner_strength.items():
            if owner == world.player:
                continue
            score = strength + world.owner_production.get(owner, 0) * 18
            if score > leader_score:
                leader_owner = owner
                leader_score = score

        safety_mult = mult("safety")
        pressure_mult = mult("pressure")
        tempo = replay_tempo_state(world)
        pressure_mult *= tempo["pressure_boost"]
        retention_mult = mult("retention") * tempo["retention_boost"]
        return {
            "expansion_value": mult("expansion"),
            "pressure_value": pressure_mult,
            "retention_value": retention_mult,
            "comet_value": mult("comet"),
            "safety_value": safety_mult,
            "weakest_value": mult("weakest"),
            "leader_owner": leader_owner,
            "leader_tax": LEADER_DONATION_TAX_4P if world.is_four_player and leader_owner is not None else 1.0,
            "send_margin_bias": _clip((safety_mult - pressure_mult) * 1.0, -0.18, 0.18),
            "packet_speed_bias": _clip((pressure_mult - 1.0) * 0.35, -0.08, 0.08),
            "q": dict(self.q),
            "tempo": tempo,
        }


_META_BANDIT = OnlineMetaBandit()


def fast_forward_sim(world, my_actions, n_turns, enemy_actions=None):
    """
    Lightweight N-turn forward simulation.

    Models:
      - current board state
      - known incoming fleets
      - our planned actions
      - sampled enemy responses

    Ships are deducted from source planets immediately when actions are launched.
    Arrivals are resolved at their ETA.
    """
    n_turns = max(1, int(n_turns))
    player = world.player
    my_actions = my_actions or []
    enemy_actions = enemy_actions or []

    p_owner = {p.id: p.owner for p in world.planets}
    p_ships = {p.id: float(p.ships) for p in world.planets}
    p_prod = {p.id: int(p.production) for p in world.planets}

    comet_lifetimes = {cid: world.comet_life(cid) for cid in world.comet_ids}

    sched = defaultdict(list)  # turn -> [(planet_id, owner, ships)]
    launch_deductions = defaultdict(float)

    for planet_id, arrivals in world.arrivals_by_planet.items():
        for eta, owner, ships in arrivals:
            t = max(1, int(math.ceil(eta)))
            if t <= n_turns:
                sched[t].append((planet_id, owner, int(ships)))

    def _action_fields(act):
        if isinstance(act, dict):
            src_id = act.get("src_id", act.get("source_id"))
            tgt_id = act.get("target_id", act.get("dst_id"))
            owner = act.get("owner", player)
            send = act.get("effective_send", act.get("send_cap", act.get("ships", 0)))
            turns = act.get("turns", act.get("eta", 1))
            launch_turn = act.get("launch_turn", 0)
            return src_id, tgt_id, owner, send, turns, launch_turn
        if isinstance(act, (tuple, list)):
            if len(act) >= 5:
                return act[0], act[1], act[2], act[3], act[4], 0
            if len(act) == 4:
                return None, act[0], act[1], act[2], act[3], 0
        return None, None, None, 0, 0, 0

    def _schedule_action(act, default_owner):
        src_id, tgt_id, owner, send, turns, launch_turn = _action_fields(act)
        if tgt_id is None:
            return
        send = int(send or 0)
        if send <= 0:
            return
        owner = player if owner is None else owner
        if src_id is not None and src_id in p_ships:
            launch_deductions[src_id] += min(send, max(0.0, p_ships[src_id] - launch_deductions[src_id]))
        eta = max(1, int(math.ceil(turns or 1)))
        if eta <= n_turns:
            sched[eta].append((tgt_id, owner if owner is not None else default_owner, int(send)))

    for act in my_actions:
        _schedule_action(act, player)
    for act in enemy_actions:
        _schedule_action(act, None)

    for src_id, deducted in launch_deductions.items():
        if src_id in p_ships:
            p_ships[src_id] = max(0.0, p_ships[src_id] - deducted)

    for turn in range(1, n_turns + 1):
        # Remove expired comets
        for cid in list(p_owner.keys()):
            if cid in comet_lifetimes and turn >= comet_lifetimes[cid]:
                p_owner.pop(cid, None)
                p_ships.pop(cid, None)
                p_prod.pop(cid, None)

        for pid in list(p_owner.keys()):
            if p_owner[pid] != -1:
                p_ships[pid] += p_prod[pid]

        if turn in sched:
            arrivals_by_planet = defaultdict(list)
            for pid, own, ships in sched[turn]:
                arrivals_by_planet[pid].append((turn, own, ships))
            for pid, arrivals in arrivals_by_planet.items():
                if pid in p_owner:
                    new_owner, new_ships = resolve_arrival_event(p_owner[pid], p_ships[pid], arrivals)
                    p_owner[pid] = new_owner
                    p_ships[pid] = float(new_ships)

    enemy_prods = defaultdict(int)
    enemy_ships = defaultdict(float)
    for pid in p_owner:
        owner = p_owner[pid]
        if owner != -1 and owner != player:
            enemy_prods[owner] += p_prod[pid]
            enemy_ships[owner] += max(0.0, p_ships[pid])

    my_prod = sum(p_prod[pid] for pid in p_owner if p_owner[pid] == player)
    my_ships = sum(max(0.0, p_ships[pid]) for pid in p_owner if p_owner[pid] == player)

    return my_prod, enemy_prods, my_ships, enemy_ships


def sim_score(my_prod, enemy_prods, my_ships, enemy_ships, world, sim_turns=None):
    """Convert simulated state to a comparable scalar."""
    sim_turns = SIM_FORWARD_TURNS if sim_turns is None else max(1, int(sim_turns))
    remaining = max(1, world.remaining_steps - sim_turns)

    # Calculate SIM_SHIP_WEIGHT dynamically based on remaining steps
    # Early game: 0.15, scaling up to 1.0 at the end of the game
    ship_weight = 1.0 - 0.85 * (remaining / TOTAL_STEPS)
    ship_weight = max(0.10, min(1.0, ship_weight))

    my_val = my_prod * remaining * SIM_PROD_WEIGHT + my_ships * ship_weight

    if not enemy_prods:
        return my_val

    if not world.is_four_player:
        # In 2-player game, there is only one enemy
        enemy_val = sum(enemy_prods.values()) * remaining * SIM_PROD_WEIGHT + sum(enemy_ships.values()) * ship_weight
        return my_val - enemy_val

    # In 4-player game, compute value for each enemy
    enemy_vals = []
    for owner in enemy_prods:
        val = enemy_prods[owner] * remaining * SIM_PROD_WEIGHT + enemy_ships[owner] * ship_weight
        enemy_vals.append(val)

    enemy_vals.sort(reverse=True)
    # The leader is enemy_vals[0]
    leader_val = enemy_vals[0]
    # Other enemies
    others_val = sum(enemy_vals[1:])

    effective_enemy_val = leader_val + 0.25 * others_val
    return my_val - effective_enemy_val



def sample_enemy_responses(world, policy, horizon=None):
    """
    Generate plausible enemy response plans for *all* known enemy owners.

    Returns a list of dicts:
      {"weight": float, "moves": [action_dict, ...]}
    """
    horizon = world.horizon if horizon is None else max(1, int(horizon))
    enemy_owners = sorted({p.owner for p in world.enemy_planets if p.owner not in (-1, world.player)})
    if not enemy_owners:
        return [{"weight": 1.0, "moves": []} for _ in range(max(1, ADVERSARIAL_SAMPLE_K))]

    overall_leader = None
    if world.is_four_player:
        max_score = -1
        for p_id in range(4):
            p_score = world.owner_strength.get(p_id, 0) + world.owner_production.get(p_id, 0) * 18
            if p_score > max_score:
                max_score = p_score
                overall_leader = p_id

    weighted_candidates = []

    for owner in enemy_owners:
        owner_planets = [p for p in world.enemy_planets if p.owner == owner]
        if not owner_planets:
            continue

        confidence = enemy_model_confidence(owner)
        aggression = enemy_aggression_bias(owner)
        archetype = enemy_archetype(owner)
        source_quota = 1
        if confidence >= 0.95:
            source_quota += 1
        if confidence >= 1.05:
            source_quota += 1
        if archetype in ("rusher", "pressure"):
            source_quota += 1
        elif archetype == "turtle":
            source_quota = max(1, source_quota - 1)

        src_order = sorted(owner_planets, key=lambda p: (-int(p.ships), -int(p.production), p.id))[:source_quota]

        for src in src_order:
            src_ships = max(1, int(src.ships))
            for target in world.planets:
                if target.id == src.id or target.owner == owner:
                    continue

                send = min(src_ships, max(1, int(target.ships) + 1))
                if send < 1:
                    continue

                aim = world.plan_shot(src.id, target.id, send)
                if aim is None:
                    continue
                angle, eta, tx, ty = aim
                if eta > horizon:
                    continue

                if target.owner == -1:
                    ownership_bias = 18.0 if archetype == "expander" else 10.0
                else:
                    is_player = (target.owner == world.player)
                    is_leader = (target.owner == overall_leader) if world.is_four_player else is_player
                    
                    if is_leader:
                        ownership_bias = 30.0 if archetype in ("rusher", "pressure") else 22.0
                    else:
                        ownership_bias = 22.0 if archetype in ("rusher", "pressure") else 15.0
                    
                    if is_player:
                        ownership_bias += 3.0

                prod_term = target.production * max(1, horizon - eta)
                threat_term = max(0, int(target.ships)) * 1.2
                if target.owner == world.player:
                    prod_term *= 1.18 if world.is_four_player else 1.10
                    if target.production >= 4:
                        ownership_bias += 5.0
                    if world.keep_needed_map.get(target.id, 0) > 0:
                        ownership_bias += 4.0
                    fall_turn = world.fall_turn_map.get(target.id)
                    if fall_turn is not None and fall_turn <= horizon:
                        ownership_bias += 8.0
                
                actual_d = dist(src.x, src.y, tx, ty)
                distance_penalty = actual_d * (0.95 if world.is_four_player else 0.85)

                history_pressure = 1.0 + 0.15 * (confidence - 0.85)

                score = (prod_term + ownership_bias * 4.0 - threat_term - distance_penalty)
                score *= aggression * history_pressure
                if archetype == "rusher" and target.owner == world.player:
                    score *= 1.12
                elif archetype == "expander" and target.owner == -1:
                    score *= 1.10
                elif archetype == "turtle" and target.owner == world.player:
                    score *= 0.82

                if world.is_static(target.id):
                    score += 3.0
                if target.id in world.exposed_planet_ids:
                    score += 5.0
                if world._weakest_enemy is not None and owner == world._weakest_enemy:
                    score += 6.0
                if target.owner == overall_leader and world.is_four_player:
                    score += 4.0

                if score <= 0:
                    continue

                weighted_candidates.append({
                    "weight": max(
                        0.25,
                        min(
                            1.75,
                            0.8
                            + 0.25 * aggression
                            + 0.15 * confidence
                            + (0.12 if archetype in ("rusher", "pressure") else 0.0)
                            - (0.08 if archetype == "turtle" else 0.0),
                        ),
                    ),
                    "score": float(score),
                    "owner": owner,
                    "src_id": src.id,
                    "target_id": target.id,
                    "send_cap": int(send),
                    "turns": int(eta),
                    "angle": float(angle),
                })

    if not weighted_candidates:
        return [{"weight": 1.0, "moves": []} for _ in range(max(1, ADVERSARIAL_SAMPLE_K))]

    weighted_candidates.sort(key=lambda item: item["score"], reverse=True)
    top = weighted_candidates[:max(ADVERSARIAL_SAMPLE_K * 3, 12)]

    responses = []
    max_responses = min(ADVERSARIAL_SAMPLE_K, max(1, len(top)))

    for offset in range(max_responses):
        used_srcs = set()
        plan = []
        plan_weight = 0.0

        for item in top[offset:] + top[:offset]:
            if item["src_id"] in used_srcs:
                continue
            used_srcs.add(item["src_id"])
            plan.append({
                "src_id": item["src_id"],
                "target_id": item["target_id"],
                "owner": item["owner"],
                "send_cap": item["send_cap"],
                "turns": item["turns"],
                "angle": item["angle"],
            })
            plan_weight += item["weight"]
            if len(plan) >= (4 if world.is_four_player else 3):
                break

        if not plan:
            continue

        avg_weight = plan_weight / max(1, len(plan))
        responses.append({
            "weight": max(0.25, min(1.75, avg_weight)),
            "moves": plan,
        })

    if len(responses) < ADVERSARIAL_SAMPLE_K:
        responses.append({"weight": 0.5, "moves": []})

    while len(responses) < ADVERSARIAL_SAMPLE_K:
        responses.append({"weight": 0.5, "moves": []})

    return responses[:ADVERSARIAL_SAMPLE_K]


def _rollout_sim_horizon(world, actions):
    if not actions:
        return SIM_FORWARD_TURNS

    max_turn = 0
    for act in actions:
        if isinstance(act, dict):
            max_turn = max(max_turn, int(act.get("turns", act.get("eta", 1)) or 1))
        elif isinstance(act, (tuple, list)) and len(act) >= 4:
            max_turn = max(max_turn, int(act[3] if len(act) == 4 else act[4] or 1))

    horizon = max(SIM_FORWARD_TURNS, max_turn + SPLIT_WAVE_DELAY + 2)
    if world.is_very_late or world.is_total_war:
        horizon = max(horizon, 30)
    elif world.is_four_player:
        horizon = max(horizon, 24)
    else:
        horizon = max(horizon, 20)
    return max(1, min(int(world.horizon), int(horizon)))


def empire_state_score(world, modes, policy, planned_commitments, actions=None):
    """
    Board evaluator for rollout ranking.

    Uses actual forward simulation with sampled enemy responses.
    """
    actions = actions or []
    sim_turns = _rollout_sim_horizon(world, actions)

    responses = sample_enemy_responses(world, policy, horizon=sim_turns)
    if not responses:
        my_prod, en_prod, my_ships, en_ships = fast_forward_sim(world, actions, sim_turns, enemy_actions=[])
        base_score = sim_score(my_prod, en_prod, my_ships, en_ships, world, sim_turns=sim_turns)
    else:
        weighted_scores = []
        total_weight = 0.0
        for response in responses:
            enemy_moves = response.get("moves", []) if isinstance(response, dict) else response
            weight = float(response.get("weight", 1.0)) if isinstance(response, dict) else 1.0
            my_prod, en_prod, my_ships, en_ships = fast_forward_sim(
                world, actions, sim_turns, enemy_actions=enemy_moves
            )
            score = sim_score(my_prod, en_prod, my_ships, en_ships, world, sim_turns=sim_turns)
            weighted_scores.append((score, weight))
            total_weight += weight

        if total_weight <= 0:
            base_score = 0.0
        else:
            mean = sum(score * weight for score, weight in weighted_scores) / total_weight
            spread = max(score for score, _ in weighted_scores) - min(score for score, _ in weighted_scores) if len(weighted_scores) > 1 else 0.0
            base_score = mean - spread * 0.12

    if actions:
        for idx, act in enumerate(actions):
            mission = act.get("mission", "capture")
            decay = BEAM_GAMMA ** idx
            if mission in ("reinforce", "rescue"):
                base_score += 6.0 * decay
            elif mission in ("snipe", "crash_exploit"):
                base_score += 3.5 * decay
            elif mission == "swarm":
                base_score += 1.5 * decay
            if world._weakest_enemy is not None and act.get("target_owner") == world._weakest_enemy:
                base_score += 3.0 * decay
            if act.get("split_wave"):
                base_score += 0.25 * decay

    if modes["is_finishing"]:
        base_score += 18.0
    elif modes["is_ahead"]:
        base_score += 10.0
    elif modes["is_behind"]:
        base_score += 5.0

    return base_score


def stratified_sources(world, policy, source_inventory_left, limit=V24_PORTFOLIO_MAX_SOURCES):
    scored = []
    doomed = policy.get("doomed_planets", set()) if policy else set()
    for src in world.my_planets:
        available = source_inventory_left(src.id)
        if available < PARTIAL_SOURCE_MIN_SHIPS:
            continue
        score = int(src.production) * 6.0 + int(src.ships) * 0.08
        if src.id in doomed:
            score += 45.0
        fall_turn = world.fall_turn_map.get(src.id)
        if fall_turn is not None and fall_turn <= DEFENSE_LOOKAHEAD_TURNS:
            score += 24.0
        if world.keep_needed_map.get(src.id, 0) > 0:
            score += 16.0
        if world.enemy_planets:
            frontier = nearest_distance_to_set(src.x, src.y, world.enemy_planets)
            score += max(0.0, 28.0 - frontier) * 0.45
        if src.production >= 4:
            score += 8.0
        if world.step >= REPLAY_MIDGAME_TURN:
            score += min(8.0, available * 0.04)
        tempo = policy.get("meta", {}).get("tempo", {})
        if world.step >= REPLAY_LATE_TURN and tempo.get("prod_ready", False):
            score += min(10.0, available * 0.05)
        scored.append((score, -src.id, src))

    scored.sort(reverse=True)
    return [item[-1] for item in scored[: max(1, int(limit))]]


def action_confidence(act, world, policy):
    target = world.planet_by_id.get(act.get("target_id"))
    if target is None:
        return 1.0
    send = max(1, int(act.get("send_cap", act.get("needed", 1))))
    need = max(1, int(act.get("needed", 1)))
    turns = max(1, int(act.get("turns", 1)))
    confidence = 1.0
    confidence += min(0.22, (send - need) / max(12.0, need) * 0.35)
    confidence -= min(0.20, max(0, turns - 18) * V24_CONFIDENCE_TIME_PENALTY)
    if target.owner == -1 and is_contested_neutral(target, policy):
        confidence -= 0.08
    if target.id in world.comet_ids:
        confidence -= 0.10
    if act.get("mission") in ("reinforce", "rescue", "recapture"):
        confidence += 0.08
    if world.is_four_player and target.owner not in (-1, world.player):
        leader = policy.get("meta", {}).get("leader_owner")
        if leader is not None and target.owner == leader and target.owner != world._weakest_enemy:
            confidence -= 0.12
    return _clip(confidence, 0.62, 1.24)


def apply_v24_action_priors(actions, world, policy):
    for act in actions:
        target = world.planet_by_id.get(act.get("target_id"))
        if target is None:
            continue
        confidence = action_confidence(act, world, policy)
        act["confidence"] = confidence
        score = float(act.get("score", 0.0))
        score *= confidence
        if target.production >= 4 and target.owner != world.player:
            score *= V24_CRITICAL_SOURCE_BONUS
        act["score"] = score
    return actions


def build_general_attack_actions(world, policy, modes, source_inventory_left, planned_commitments, deadline=None):

    """
    Lightweight candidate generator for the beam rollout.
    Uses existing probe/settle logic, but only on a tight frontier.
    """
    actions = []
    top_k = adaptive_target_top_k(world)
    doomed = policy.get("doomed_planets", set()) if policy else set()

    if world.is_four_player:
        src_order = stratified_sources(world, policy, source_inventory_left, limit=V24_PORTFOLIO_MAX_SOURCES)
    else:
        src_order = sorted(
            world.my_planets,
            key=lambda p: (0 if p.id in doomed else 1, -int(p.production), -int(p.ships), p.id)
        )
        src_order = src_order[: max(4, min(8, len(src_order)))]

    for src in src_order:
        if deadline is not None and time.perf_counter() > deadline:
            break
        src_cap = source_inventory_left(src.id)
        if src_cap < PARTIAL_SOURCE_MIN_SHIPS:
            continue

        targets = candidate_targets_for_source(src, world, policy, modes, top_k=top_k)
        if world._weakest_enemy is not None:
            weakest_targets = [p for p in world.enemy_planets if p.owner == world._weakest_enemy]
            for p in weakest_targets[:2]:
                if p not in targets:
                    targets = [p] + targets
        for target in targets[:top_k]:
            if deadline is not None and time.perf_counter() > deadline:
                break
            if target.owner == world.player:
                continue

            if target.id in world.comet_ids and world.comet_life(target.id) <= 1:
                continue

            seed_cap = min(src_cap, max(1, int(src.ships)))
            seeded = world.best_probe_aim(
                src.id,
                target.id,
                seed_cap,
                hints=(int(target.ships) + 1, int(target.ships) + 4),
                max_turn=world.remaining_steps,
            )
            if seeded is None:
                continue
            probe, rough = seeded
            if probe is None:
                continue

            plan = settle_plan(
                src,
                target,
                seed_cap,
                probe,
                world,
                planned_commitments,
                modes,
                policy,
                mission="capture",
            )
            if plan is None:
                continue

            angle, turns, _, need, send_pref = plan
            if not candidate_time_valid(target, turns, world, LATE_CAPTURE_BUFFER):
                continue

            value = target_value(target, turns, "capture", world, modes, policy)
            if value <= 0:
                continue

            score = apply_score_modifiers(
                value / (send_pref + turns * ATTACK_COST_TURN_WEIGHT + 1.0),
                target,
                "capture",
                world,
            )
            if src.id in doomed:
                score *= 1.5

            actions.append({
                "kind": "capture",
                "src_id": src.id,
                "target_id": target.id,
                "angle": angle,
                "turns": turns,
                "needed": need,
                "send_cap": send_pref,
                "score": score,
                "target_production": int(target.production),
                "target_owner": int(target.owner),
                "mission": "capture",
            })

    actions = apply_v24_action_priors(actions, world, policy)
    actions.sort(key=lambda a: (a["score"], -a["turns"], a["target_production"]), reverse=True)
    return actions[: max(12, top_k * 2)]


def mission_to_action(mission):
    if not mission or not getattr(mission, "options", None):
        return None
    option = mission.options[0]
    return {
        "kind": mission.kind,
        "src_id": option.src_id,
        "target_id": option.target_id,
        "angle": option.angle,
        "turns": option.turns,
        "needed": option.needed,
        "send_cap": option.send_cap,
        "score": option.score,
        "target_production": 0,
        "target_owner": None,
        "mission": option.mission,
    }


def build_special_actions(world, policy, planned_commitments, modes, source_inventory_left, deadline=None):
    """
    Pull in high-value tactical missions from the existing specialist builders.
    This gives the beam search strong seeds without exploding branching.
    """
    actions = []

    builders = []
    if world.remaining_steps >= REINFORCE_MIN_FUTURE_TURNS:
        builders.append(lambda: build_reinforce_missions(world, policy, planned_commitments, modes, source_inventory_left))
        builders.append(lambda: build_stabilize_missions(world, policy, planned_commitments, modes, source_inventory_left))
    builders.extend([
        lambda: build_rescue_missions(world, policy, planned_commitments, modes),
        lambda: build_recapture_missions(world, policy, planned_commitments, modes),
        lambda: build_elimination_missions(world, policy, planned_commitments, modes),
        lambda: build_gang_up_missions(world, policy, planned_commitments, modes),
        lambda: build_crash_exploit_missions(world, policy, planned_commitments, modes),
    ])

    for builder in builders:
        if deadline is not None and time.perf_counter() > deadline:
            break
        try:
            missions = builder() or []
        except Exception:
            continue
        for m in missions:
            act = mission_to_action(m)
            if act is not None:
                target = world.planet_by_id.get(act["target_id"])
                if target is not None:
                    act["target_production"] = int(target.production)
                    act["target_owner"] = int(target.owner)
                actions.append(act)

    return apply_v24_action_priors(actions, world, policy)


def build_portfolio_actions(world, policy, modes, planned_commitments, source_inventory_left, seed_actions, deadline=None):
    """Root portfolio sampler over script labels for critical sources."""
    if deadline is not None and time.perf_counter() > deadline:
        return []

    by_source = {}
    for act in seed_actions:
        by_source.setdefault(act.get("src_id"), []).append(act)
    for acts in by_source.values():
        acts.sort(key=lambda item: item.get("score", 0.0), reverse=True)

    critical_sources = stratified_sources(world, policy, source_inventory_left, limit=V24_PORTFOLIO_MAX_SOURCES)
    portfolios = [
        ("balanced", {"capture": 1.00, "reinforce": 1.08, "rescue": 1.10, "recapture": 1.12, "snipe": 0.96, "crash_exploit": 0.96}),
        ("expand", {"capture": 1.10, "swarm": 1.05, "reinforce": 0.96, "rescue": 0.98}),
        ("defend", {"reinforce": 1.28, "rescue": 1.30, "recapture": 1.22, "capture": 0.92}),
        ("pressure", {"capture": 1.12, "snipe": 1.08, "crash_exploit": 1.08, "reinforce": 0.94}),
        ("finish", {"capture": 1.18, "snipe": 1.14, "crash_exploit": 1.12, "reinforce": 0.90}),
    ]
    if world.step < REPLAY_MIDGAME_TURN:
        portfolios = portfolios[:3]

    bundles = []
    for name, weights in portfolios:
        if deadline is not None and time.perf_counter() > deadline:
            break
        acts = []
        used_targets = set()
        score = 0.0
        for src in critical_sources:
            candidates = by_source.get(src.id, [])
            best = None
            best_score = -10**18
            for cand in candidates[:6]:
                target_id = cand.get("target_id")
                if target_id in used_targets and cand.get("mission") == "capture":
                    continue
                mission = cand.get("mission", "capture")
                weighted = cand.get("score", 0.0) * weights.get(mission, 1.0)
                target = world.planet_by_id.get(target_id)
                if target is not None:
                    if name == "expand" and target.owner == -1:
                        weighted *= 1.08
                    if name in ("pressure", "finish") and target.owner not in (-1, world.player):
                        weighted *= 1.08
                    if name == "defend" and mission not in ("reinforce", "rescue", "recapture"):
                        weighted *= 0.92
                if weighted > best_score:
                    best_score = weighted
                    best = cand
            if best is None:
                continue
            used_targets.add(best.get("target_id"))
            acts.append(dict(best))
            score += best_score
            if len(acts) >= (5 if world.is_four_player else 6):
                break
        if acts:
            bundles.append((score, name, acts))

    if not bundles:
        return []
    bundles.sort(key=lambda item: item[0], reverse=True)
    selected = []
    seen = set()
    for _, _, acts in bundles[:3]:
        for act in acts:
            key = (act.get("src_id"), act.get("target_id"), act.get("mission"))
            if key in seen:
                continue
            seen.add(key)
            selected.append(act)
            if len(selected) >= V24_PORTFOLIO_TOP_ACTIONS:
                return selected
    return selected


def _select_diverse_beam(nodes, limit):
    if len(nodes) <= limit:
        return nodes

    pool = list(nodes[: max(limit * 4, limit)])
    selected = []
    target_counts = _dd(int)
    source_counts = _dd(int)
    mission_counts = _dd(int)
    owner_counts = _dd(int)

    while pool and len(selected) < limit:
        best_index = 0
        best_adjusted = -10**18

        for idx, node in enumerate(pool):
            score, acts, _, _, _, _ = node
            adjusted = float(score)
            if acts:
                last = acts[-1]
                target_id = last.get("target_id")
                src_id = last.get("src_id")
                mission = last.get("mission", "capture")
                owner = last.get("target_owner")

                adjusted -= target_counts[target_id] * BEAM_DIVERSITY_TARGET_PENALTY
                adjusted -= source_counts[src_id] * BEAM_DIVERSITY_SOURCE_PENALTY
                adjusted -= mission_counts[mission] * BEAM_DIVERSITY_MISSION_PENALTY
                if owner is not None:
                    adjusted -= owner_counts[owner] * BEAM_DIVERSITY_OWNER_PENALTY
                if len({act.get("mission", "capture") for act in acts}) > 1:
                    adjusted += BEAM_DIVERSITY_MIX_BONUS

            if adjusted > best_adjusted:
                best_adjusted = adjusted
                best_index = idx

        chosen = pool.pop(best_index)
        selected.append(chosen)
        acts = chosen[1]
        if acts:
            last = acts[-1]
            target_counts[last.get("target_id")] += 1
            source_counts[last.get("src_id")] += 1
            mission_counts[last.get("mission", "capture")] += 1
            owner = last.get("target_owner")
            if owner is not None:
                owner_counts[owner] += 1

    return selected



def rollout_beam_select(world, policy, modes, planned_commitments, source_inventory_left, deadline=None):
    """
    Beam search over action sequences with cheap node scoring and full
    adversarial forward simulation only at the leaf stage.
    """
    beam_width = adaptive_beam_width(world)
    depth = adaptive_depth(world)
    horizon = adaptive_horizon(world)

    seed_actions = build_special_actions(world, policy, planned_commitments, modes, source_inventory_left, deadline=deadline)
    if deadline is not None and time.perf_counter() > deadline:
        return []

    if len(seed_actions) < 6:
        seed_actions.extend(
            build_general_attack_actions(world, policy, modes, source_inventory_left, planned_commitments, deadline=deadline)
        )
    elif world.step >= REPLAY_MIDGAME_TURN:
        general_actions = build_general_attack_actions(
            world, policy, modes, source_inventory_left, planned_commitments, deadline=deadline
        )
        seed_actions.extend(general_actions[: max(4, adaptive_target_top_k(world))])

    seed_actions.sort(key=lambda a: (a["score"], -a["turns"]), reverse=True)
    seed_actions = seed_actions[: max(20, beam_width * 3)]

    beam = [(0.0, [], set(), set(), _dd(int), _dd(lambda: -1))]

    def local_node_bonus(actions):
        if not actions:
            return 0.0
        bonus = 0.0
        recent = actions[-4:]
        for idx, act in enumerate(recent):
            decay = BEAM_GAMMA ** idx
            mission = act.get("mission", "capture")
            if mission in ("reinforce", "rescue"):
                bonus += 0.9 * decay
            elif mission in ("snipe", "crash_exploit"):
                bonus += 0.55 * decay
            elif mission == "swarm":
                bonus += 0.35 * decay
            target_prod = max(0, int(act.get("target_production", 0)))
            bonus += min(1.5, target_prod * 0.08) * decay
            if world._weakest_enemy is not None and act.get("target_owner") == world._weakest_enemy:
                bonus += 0.5 * decay
            if act.get("split_wave"):
                bonus += 0.25 * decay
        action_penalty = 0.05
        if world.step >= REPLAY_LATE_TURN:
            action_penalty = 0.025
        elif world.step >= REPLAY_MIDGAME_TURN:
            action_penalty = 0.035
        bonus -= action_penalty * len(actions)
        return bonus

    for d in range(depth):
        if deadline is not None and time.perf_counter() > deadline:
            break
        level_start = time.perf_counter()
        next_beam = []

        for total_score, acts, used_sources, used_targets, spend_map, split_map in beam:
            next_beam.append((
                total_score + local_node_bonus(acts),
                acts, used_sources, used_targets, spend_map, split_map
            ))

            for cand in seed_actions:
                src_id = cand["src_id"]
                target_id = cand["target_id"]
                cand_turns = max(1, int(cand["turns"]))
                source_locked = src_id in used_sources

                split_ok = False
                if source_locked and SPLIT_WAVE_ENABLED:
                    earliest_split = split_map[src_id]
                    if earliest_split >= 0 and cand_turns >= earliest_split:
                        split_ok = True

                if source_locked and not split_ok:
                    continue
                if target_id in used_targets and cand.get("mission") == "capture":
                    continue

                initial_budget = source_inventory_left(src_id)
                if spend_map[src_id] >= initial_budget:
                    continue

                if split_ok:
                    remaining = max(0, initial_budget - spend_map[src_id])
                    split_send = int(min(remaining * SPLIT_MAX_FRACTION, cand["send_cap"]))
                    if split_send < SPLIT_MIN_SHIPS:
                        continue
                    effective_send = split_send
                else:
                    effective_send = min(int(cand["send_cap"]), initial_budget - spend_map[src_id])
                    if effective_send < 1:
                        continue
                if (
                    cand.get("mission") in ("capture", "snipe", "crash_exploit")
                    and effective_send < int(cand.get("needed", 1))
                ):
                    needed = int(cand.get("needed", 1))
                    remaining = max(0, initial_budget - spend_map[src_id])
                    if remaining >= needed:
                        effective_send = min(remaining, max(needed, int(cand["send_cap"])))
                    else:
                        continue

                if cand_turns > horizon:
                    continue

                cand_use = dict(cand)
                cand_use["effective_send"] = int(effective_send)
                cand_use["send_cap"] = int(effective_send)
                if split_ok:
                    cand_use["split_wave"] = True

                new_acts = acts + [cand_use]
                new_used_sources = set(used_sources)
                new_used_targets = set(used_targets)
                new_spend = _dd(int, spend_map)
                new_split = _dd(lambda: -1, split_map)

                new_used_sources.add(src_id)
                if not split_ok:
                    new_split[src_id] = cand_turns + SPLIT_WAVE_DELAY
                else:
                    new_split[src_id] = -1

                if cand.get("mission") in ("capture", "snipe", "crash_exploit"):
                    new_used_targets.add(target_id)

                new_spend[src_id] += effective_send

                seq_score = total_score + cand["score"] * (BEAM_GAMMA ** d)
                prod_turns = max(1, world.remaining_steps - cand_turns)
                seq_score += max(0, int(cand.get("target_production", 0))) * prod_turns * 0.03

                if world._weakest_enemy is not None and cand.get("target_owner") == world._weakest_enemy:
                    seq_score += 2.5
                if cand.get("mission") in ("reinforce", "rescue"):
                    seq_score += 1.2
                if split_ok:
                    seq_score += 0.9
                if world.step >= REPLAY_MIDGAME_TURN and (not world.is_four_player or world.step >= REPLAY_LATE_TURN):
                    volume_bonus = REPLAY_MIDGAME_VOLUME_BONUS
                    if world.step >= REPLAY_LATE_TURN:
                        volume_bonus += REPLAY_LATE_VOLUME_BONUS
                    if cand.get("mission") in ("reinforce", "rescue"):
                        volume_bonus *= 1.15
                    elif cand.get("mission") in ("snipe", "crash_exploit"):
                        volume_bonus *= 0.85
                    seq_score += volume_bonus

                next_beam.append((seq_score, new_acts, new_used_sources, new_used_targets, new_spend, new_split))

        if not next_beam:
            break

        level_elapsed = time.perf_counter() - level_start
        if deadline is not None:
            remaining_budget = deadline - time.perf_counter()
            if remaining_budget < level_elapsed * 1.5 and beam_width > 3:
                beam_width = max(3, beam_width // 2)

        next_beam.sort(key=lambda node: node[0], reverse=True)
        if world.is_four_player and world.step < REPLAY_LATE_TURN:
            beam = next_beam[:beam_width]
        else:
            beam = _select_diverse_beam(next_beam, beam_width)

    if not beam:
        return []

    finalists = sorted(beam, key=lambda node: node[0], reverse=True)[: min(len(beam), max(4, beam_width // 2))]
    best_actions = []
    best_score = -10**18

    for _, acts, _, _, _, _ in finalists:
        score = empire_state_score(world, modes, policy, planned_commitments, actions=acts)
        if score > best_score:
            best_score = score
            best_actions = acts

    return best_actions


def execute_actions(world, actions, policy=None):
    """
    Convert selected actions into concrete moves with source inventory guards.
    """
    moves = []
    spent = defaultdict(int)

    for act in actions:
        src = world.planet_by_id[act["src_id"]]
        send_cap = int(act.get("effective_send", act.get("send_cap", 0)))
        
        budget = int(src.ships)
        if policy is not None and "attack_budget" in policy:
            budget = min(budget, int(policy["attack_budget"].get(src.id, budget)))
            
        available_final = budget - spent[src.id]
        send = min(send_cap, available_final)
        if send < PARTIAL_SOURCE_MIN_SHIPS and act.get("mission") == "capture":
            continue
        if send < 1:
            continue

        angle = act["angle"]
        target_id = act.get("target_id")
        planned_turns = int(act.get("turns", 1) or 1)
        if target_id in world.planet_by_id:
            fresh_aim = world.plan_shot(src.id, target_id, send)
            if fresh_aim is None:
                continue
            angle, planned_turns = fresh_aim[0], fresh_aim[1]
            if act.get("mission") in ("capture", "snipe", "crash_exploit"):
                needed = world.min_ships_to_own_by(
                    target_id,
                    planned_turns,
                    world.player,
                    arrival_turn=planned_turns,
                    planned_commitments={},
                    upper_bound=available_final,
                )
                if needed > 0 and send < needed:
                    if available_final >= needed:
                        repaired_aim = world.plan_shot(src.id, target_id, needed)
                        if repaired_aim is None:
                            continue
                        send = needed
                        angle, planned_turns = repaired_aim[0], repaired_aim[1]
                    else:
                        continue

        moves.append([src.id, float(angle), int(send)])
        spent[src.id] += send

    return moves


def plan_moves_v21(world, deadline=None):
    def expired():
        return deadline is not None and time.perf_counter() > deadline

    world.horizon = adaptive_horizon(world)

    modes = build_modes(world)
    policy = build_policy_state(world, deadline=deadline)
    planned_commitments = defaultdict(list)

    chosen = rollout_beam_select(
        world=world,
        policy=policy,
        modes=modes,
        planned_commitments=planned_commitments,
        source_inventory_left=lambda sid: policy["attack_budget"].get(sid, 0),
        deadline=deadline,
    )

    moves = execute_actions(world, chosen, policy=policy)

    if not moves and not expired():
        try:
            moves = plan_moves(world, deadline=deadline, modes=modes, policy=policy)
        except Exception:
            moves = []

    final_moves = []
    used = defaultdict(int)
    for src_id, angle, ships in moves:
        src = world.planet_by_id[src_id]
        if used[src_id] >= int(src.ships):
            continue
        send = min(int(ships), int(src.ships) - used[src_id])
        if send >= 1:
            final_moves.append([src_id, float(angle), int(send)])
            used[src_id] += send
    return final_moves
# ============================================================
# Agent Entry Point
# ============================================================

_agent_step = 0


def _read(obs, key, default=None):
    if isinstance(obs, dict):
        return obs.get(key, default)
    return getattr(obs, key, default)


def build_world(obs, inferred_step=None):
    player = _read(obs, "player", 0)
    obs_step = _read(obs, "step", 0) or 0
    step = max(obs_step, inferred_step or 0)
    raw_planets = _read(obs, "planets", []) or []
    raw_fleets = _read(obs, "fleets", []) or []
    ang_vel = _read(obs, "angular_velocity", 0.0) or 0.0
    raw_init = _read(obs, "initial_planets", []) or []
    comets = _read(obs, "comets", []) or []
    comet_ids = set(_read(obs, "comet_planet_ids", []) or [])

    planets = [Planet(*planet) for planet in raw_planets]
    fleets = [Fleet(*fleet) for fleet in raw_fleets]
    initial_planets = [Planet(*planet) for planet in raw_init]
    initial_by_id = {planet.id: planet for planet in initial_planets}

    return WorldModel(
        player=player,
        step=step,
        planets=planets,
        fleets=fleets,
        initial_by_id=initial_by_id,
        ang_vel=ang_vel,
        comets=comets,
        comet_ids=comet_ids,
    )


def agent(obs, config=None):
    global _agent_step
    obs_step = _read(obs, "step", 0) or 0
    if obs_step == 0:
        _agent_step = 0
        _ENEMY_MEMORY.clear()
        _META_BANDIT.reset()
        reset_replay_tracker()
    _agent_step += 1
    start_time = time.perf_counter()
    world = build_world(obs, inferred_step=_agent_step - 1)
    update_enemy_memory(world)
    update_replay_tracker(world)
    _META_BANDIT.observe(world)
    if not world.my_planets:
        return []
    act_timeout = _read(config, "actTimeout", 1.0) if config is not None else 1.0
    soft_budget = min(SOFT_ACT_DEADLINE + 0.05, max(0.60, act_timeout * 0.88))
    deadline = start_time + soft_budget
    moves = plan_moves_v21(world, deadline=deadline)
    update_replay_tracker(world, emitted_moves=moves)
    return moves


__all__ = ["agent", "build_world", "plan_moves_v21"]
