"""
Orbit Wars v12 — Full-Spectrum Domination Agent
================================================
Built from v10/v11 base + every technique from 1200+ Elo public agents.

Major upgrades over v10/v11:
  1.  110-turn Forward Timeline Simulation — binary-search exact keep_needed
  2.  Surplus-based dispatching — send EVERYTHING above keep_needed
  3.  7-mission priority system: reinforce > rescue > recapture > capture > snipe > swarm > crash_exploit
  4.  Multi-source coordinated swarm attacks (2/3/4 sources, ±2 turn sync)
  5.  Snipe detection — arrive at neutrals right after enemy fleet battles
  6.  Crash exploit — arrive after inter-enemy fleet collisions (4P)
  7.  Hostile reinforcement prediction — estimate enemy can reinforce target
  8.  Doomed planet evacuation — save ships from unsaveable planets
  9.  Exposed planet detection — attack enemies who just launched fleets
  10. Dynamic game phases with domination tracking
  11. Weakest enemy targeting with elimination bonus (4P)
  12. Production snowball scoring: score = prod × remaining_turns / cost
  13. Proactive defense with stacked multi-enemy threat detection
  14. Sun-aware fleet routing with iterative intercept solver
  15. Indirect wealth valuation (cluster bonus from nearby planets)
  16. Endgame consolidation to highest-production planets
"""

import math
import time
from collections import defaultdict, namedtuple
from dataclasses import dataclass, field

# ═══════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════
BOARD = 100.0
CENTER = 50.0
SUN_R = 10.0
SUN_SAFETY = 1.5
MAX_SPEED = 6.0
ROT_LIMIT = 50.0
TOTAL_STEPS = 500
HORIZON = 110
INTERCEPT_TOLERANCE = 1
LAUNCH_CLEARANCE = 0.1

# Phase thresholds
EARLY_TURN_LIMIT = 40
OPENING_TURN_LIMIT = 80
LATE_REMAINING_TURNS = 70
VERY_LATE_REMAINING_TURNS = 25
TOTAL_WAR_REMAINING_TURNS = 55

# Opening filters
SAFE_OPENING_PROD_THRESHOLD = 4
SAFE_OPENING_TURN_LIMIT = 10
ROTATING_OPENING_MAX_TURNS = 13
ROTATING_OPENING_LOW_PROD = 2
FOUR_PLAYER_ROTATING_REACTION_GAP = 3
FOUR_PLAYER_ROTATING_SEND_RATIO = 0.55
FOUR_PLAYER_ROTATING_TURN_LIMIT = 10

# Comet
COMET_MAX_CHASE_TURNS = 10

# Scoring weights
ATTACK_COST_TURN_WEIGHT = 0.50
SNIPE_COST_TURN_WEIGHT = 0.42
INDIRECT_VALUE_SCALE = 0.15
INDIRECT_FRIENDLY_WEIGHT = 0.35
INDIRECT_NEUTRAL_WEIGHT = 0.9
INDIRECT_ENEMY_WEIGHT = 1.25

# Value multipliers
STATIC_NEUTRAL_VALUE_MULT = 1.4
STATIC_HOSTILE_VALUE_MULT = 1.65
ROTATING_OPENING_VALUE_MULT = 0.9
HOSTILE_TARGET_VALUE_MULT = 2.05
OPENING_HOSTILE_TARGET_VALUE_MULT = 1.55
SAFE_NEUTRAL_VALUE_MULT = 1.2
CONTESTED_NEUTRAL_VALUE_MULT = 0.7
EARLY_NEUTRAL_VALUE_MULT = 1.2
COMET_VALUE_MULT = 0.65
SNIPE_VALUE_MULT = 1.12
SWARM_VALUE_MULT = 1.05
REINFORCE_VALUE_MULT = 1.35
CRASH_EXPLOIT_VALUE_MULT = 1.18
FINISHING_HOSTILE_VALUE_MULT = 1.3
BEHIND_ROTATING_NEUTRAL_VALUE_MULT = 0.92
EXPOSED_PLANET_VALUE_MULT = 2.0
WEAKEST_ENEMY_VALUE_MULT_4P = 1.5
GANG_UP_VALUE_MULT = 1.4

# Margins
SAFE_NEUTRAL_MARGIN = 2
CONTESTED_NEUTRAL_MARGIN = 2
NEUTRAL_MARGIN_BASE = 2
NEUTRAL_MARGIN_PROD_WEIGHT = 2
NEUTRAL_MARGIN_CAP = 8
HOSTILE_MARGIN_BASE = 3
HOSTILE_MARGIN_PROD_WEIGHT = 2
HOSTILE_MARGIN_CAP = 12
HOSTILE_REINFORCE_HORIZON = 8
HOSTILE_REINFORCE_RATIO = 0.25
HOSTILE_REINFORCE_CAP = 15
STATIC_TARGET_MARGIN = 4
CONTESTED_TARGET_MARGIN = 5
FOUR_PLAYER_TARGET_MARGIN = 2
LONG_TRAVEL_MARGIN_START = 18
LONG_TRAVEL_MARGIN_DIVISOR = 3
LONG_TRAVEL_MARGIN_CAP = 8
COMET_MARGIN_RELIEF = 6
FINISHING_HOSTILE_SEND_BONUS = 5

# Score multipliers
STATIC_TARGET_SCORE_MULT = 1.18
EARLY_STATIC_NEUTRAL_SCORE_MULT = 1.25
FOUR_PLAYER_ROTATING_NEUTRAL_SCORE_MULT = 0.84
DENSE_STATIC_NEUTRAL_COUNT = 4
DENSE_ROTATING_NEUTRAL_SCORE_MULT = 0.86
SNIPE_SCORE_MULT = 1.12
SWARM_SCORE_MULT = 1.06

# Fleet minimums
PARTIAL_SOURCE_MIN_SHIPS = 6
FOLLOWUP_MIN_SHIPS = 8
MULTI_SOURCE_TOP_K = 8
MULTI_SOURCE_ETA_TOLERANCE = 2
MULTI_SOURCE_PLAN_PENALTY = 0.97
HOSTILE_SWARM_ETA_TOLERANCE = 1
THREE_SOURCE_SWARM_ENABLED = True
THREE_SOURCE_MIN_TARGET_SHIPS = 20
THREE_SOURCE_ETA_TOLERANCE = 1
THREE_SOURCE_PLAN_PENALTY = 0.93
FOUR_SOURCE_SWARM_ENABLED = True
FOUR_SOURCE_ETA_TOLERANCE = 2
FOUR_SOURCE_MIN_TARGET_SHIPS = 40
FOUR_SOURCE_PLAN_PENALTY = 0.91

# Reinforcement
REINFORCE_ENABLED = True
REINFORCE_MIN_PRODUCTION = 2
REINFORCE_MAX_TRAVEL_TURNS = 22
REINFORCE_SAFETY_MARGIN = 2
REINFORCE_MAX_SOURCE_FRACTION = 0.75
REINFORCE_MIN_FUTURE_TURNS = 40

# Defense
PROACTIVE_DEFENSE_HORIZON = 12
PROACTIVE_DEFENSE_RATIO = 0.28
MULTI_ENEMY_PROACTIVE_HORIZON = 14
MULTI_ENEMY_PROACTIVE_RATIO = 0.35
MULTI_ENEMY_STACK_WINDOW = 4

# Crash exploit
CRASH_EXPLOIT_ENABLED = True
CRASH_EXPLOIT_MIN_TOTAL_SHIPS = 7
CRASH_EXPLOIT_ETA_WINDOW = 3
CRASH_EXPLOIT_POST_CRASH_DELAY = 1

# Elimination
LATE_IMMEDIATE_SHIP_VALUE = 0.75
WEAK_ENEMY_THRESHOLD = 110
ELIMINATION_BONUS = 55.0

# Domination thresholds
BEHIND_DOMINATION = -0.20
AHEAD_DOMINATION = 0.15
FINISHING_DOMINATION = 0.28
FINISHING_PROD_RATIO = 1.15
AHEAD_ATTACK_MARGIN_BONUS = 0.12
BEHIND_ATTACK_MARGIN_PENALTY = 0.05
FINISHING_ATTACK_MARGIN_BONUS = 0.12

# Evacuation
DOOMED_EVAC_TURN_LIMIT = 24
DOOMED_MIN_SHIPS = 8

# Rear forwarding
REAR_SOURCE_MIN_SHIPS = 16
REAR_DISTANCE_RATIO = 1.25
REAR_SEND_RATIO_TWO_PLAYER = 0.62
REAR_SEND_RATIO_FOUR_PLAYER = 0.60
REAR_SEND_MIN_SHIPS = 10
REAR_MAX_TRAVEL_TURNS = 40

# Time budget
SOFT_ACT_DEADLINE = 0.82

# ═══════════════════════════════════════════
# TYPES
# ═══════════════════════════════════════════
try:
    from kaggle_environments.envs.orbit_wars.orbit_wars import Planet, Fleet
except ImportError:
    Planet = namedtuple("Planet", ["id", "owner", "x", "y", "radius", "ships", "production"])
    Fleet = namedtuple("Fleet", ["id", "owner", "x", "y", "angle", "from_planet_id", "ships"])


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


@dataclass
class Mission:
    kind: str
    score: float
    target_id: int
    turns: int
    options: list = field(default_factory=list)


# ═══════════════════════════════════════════
# PHYSICS
# ═══════════════════════════════════════════
def dist(ax, ay, bx, by):
    return math.hypot(ax - bx, ay - by)


def orbital_radius(planet):
    return dist(planet.x, planet.y, CENTER, CENTER)


def is_static_planet(planet):
    return orbital_radius(planet) + planet.radius >= ROT_LIMIT


def fleet_speed(ships):
    if ships <= 1:
        return 1.0
    ratio = math.log(ships) / math.log(1000.0)
    ratio = max(0.0, min(1.0, ratio))
    return 1.0 + (MAX_SPEED - 1.0) * (ratio ** 1.5)


def point_to_segment_distance(px, py, x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq <= 1e-9:
        return dist(px, py, x1, y1)
    t = ((px - x1) * dx + (py - y1) * dy) / seg_len_sq
    t = max(0.0, min(1.0, t))
    return dist(px, py, x1 + t * dx, y1 + t * dy)


def segment_hits_sun(x1, y1, x2, y2, safety=SUN_SAFETY):
    return point_to_segment_distance(CENTER, CENTER, x1, y1, x2, y2) < SUN_R + safety


def launch_point(sx, sy, sr, angle):
    clearance = sr + LAUNCH_CLEARANCE
    return sx + math.cos(angle) * clearance, sy + math.sin(angle) * clearance


def safe_angle_and_distance(sx, sy, sr, tx, ty, tr):
    angle = math.atan2(ty - sy, tx - sx)
    start_x, start_y = launch_point(sx, sy, sr, angle)
    hit_distance = max(0.0, dist(sx, sy, tx, ty) - (sr + LAUNCH_CLEARANCE) - tr)
    end_x = start_x + math.cos(angle) * hit_distance
    end_y = start_y + math.sin(angle) * hit_distance
    if segment_hits_sun(start_x, start_y, end_x, end_y):
        return None
    return angle, hit_distance


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
        return 10 ** 9
    return est[1]


# ═══════════════════════════════════════════
# POSITION PREDICTION
# ═══════════════════════════════════════════
def predict_planet_position(planet, initial_by_id, angular_velocity, turns):
    init = initial_by_id.get(planet.id)
    if init is None:
        return planet.x, planet.y
    r = dist(init.x, init.y, CENTER, CENTER)
    if r + init.radius >= ROT_LIMIT:
        return planet.x, planet.y
    cur_ang = math.atan2(planet.y - CENTER, planet.x - CENTER)
    new_ang = cur_ang + angular_velocity * turns
    return CENTER + r * math.cos(new_ang), CENTER + r * math.sin(new_ang)


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
    r = dist(init.x, init.y, CENTER, CENTER)
    return r + init.radius < ROT_LIMIT


# ═══════════════════════════════════════════
# INTERCEPT SOLVER (from 1200+ agents)
# ═══════════════════════════════════════════
def search_safe_intercept(src, target, ships, initial_by_id, ang_vel, comets, comet_ids):
    best = None
    best_score = None
    max_turns = min(HORIZON, 60)
    if target.id in comet_ids:
        max_turns = min(max_turns, max(0, comet_remaining_life(target.id, comets) - 1))
    for candidate_turns in range(1, max_turns + 1):
        pos = predict_target_position(target, candidate_turns, initial_by_id, ang_vel, comets, comet_ids)
        if pos is None:
            continue
        est = estimate_arrival(src.x, src.y, src.radius, pos[0], pos[1], target.radius, ships)
        if est is None:
            continue
        _, turns = est
        if abs(turns - candidate_turns) > INTERCEPT_TOLERANCE:
            continue
        actual_turns = max(turns, candidate_turns)
        actual_pos = predict_target_position(target, actual_turns, initial_by_id, ang_vel, comets, comet_ids)
        if actual_pos is None:
            continue
        confirm = estimate_arrival(src.x, src.y, src.radius, actual_pos[0], actual_pos[1], target.radius, ships)
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
    """Iterative intercept solver: 5 Newton-Raphson-like iterations + fallback search."""
    est = estimate_arrival(src.x, src.y, src.radius, target.x, target.y, target.radius, ships)
    if est is None:
        if not target_can_move(target, initial_by_id, comet_ids):
            return None
        return search_safe_intercept(src, target, ships, initial_by_id, ang_vel, comets, comet_ids)
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
            return search_safe_intercept(src, target, ships, initial_by_id, ang_vel, comets, comet_ids)
        if abs(ntx - tx) < 0.3 and abs(nty - ty) < 0.3 and abs(next_est[1] - turns) <= INTERCEPT_TOLERANCE:
            return next_est[0], next_est[1], ntx, nty
        tx, ty = ntx, nty
        est = next_est
    final_est = estimate_arrival(src.x, src.y, src.radius, tx, ty, target.radius, ships)
    if final_est is None:
        return search_safe_intercept(src, target, ships, initial_by_id, ang_vel, comets, comet_ids)
    return final_est[0], final_est[1], tx, ty


# ═══════════════════════════════════════════
# FLEET TRACKING (from v10/v11)
# ═══════════════════════════════════════════
def fleet_target_planet(fleet, planets):
    """Determine which planet a fleet is heading toward."""
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
        if turns <= HORIZON and turns < best_time:
            best_time = turns
            best_planet = planet
    if best_planet is None:
        return None, None
    return best_planet, int(math.ceil(best_time))


def build_arrival_ledger(fleets, planets):
    """Build dict: planet_id -> [(eta, owner, ships)] for all fleets."""
    arrivals = {p.id: [] for p in planets}
    for fleet in fleets:
        target, eta = fleet_target_planet(fleet, planets)
        if target is None:
            continue
        arrivals[target.id].append((eta, fleet.owner, int(fleet.ships)))
    return arrivals


# ═══════════════════════════════════════════
# FORWARD BATTLE SIMULATION (from 1200+ agents)
# ═══════════════════════════════════════════
def resolve_arrival_event(owner, garrison, arrivals):
    """Engine-accurate combat resolution: group by owner, top-2 duel."""
    by_owner = {}
    for _, attacker_owner, ships in arrivals:
        by_owner[attacker_owner] = by_owner.get(attacker_owner, 0) + ships
    if not by_owner:
        return owner, max(0.0, garrison)
    sorted_players = sorted(by_owner.items(), key=lambda x: x[1], reverse=True)
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


def simulate_planet_timeline(planet, arrivals, player, horizon):
    """
    Simulate a planet's ownership/garrison over `horizon` turns.
    Binary-search exact keep_needed — minimum garrison to hold the planet.
    This is THE fundamental upgrade from v10/v11.
    """
    horizon = max(0, int(math.ceil(horizon)))
    events = []
    for turns, owner, ships in arrivals:
        if ships <= 0:
            continue
        eta = max(1, int(math.ceil(turns)))
        if eta > horizon:
            continue
        events.append((eta, owner, int(ships)))
    events.sort()
    by_turn = defaultdict(list)
    for item in events:
        by_turn[item[0]].append(item)

    owner = planet.owner
    garrison = float(planet.ships)
    owner_at = {0: owner}
    ships_at = {0: max(0.0, garrison)}
    first_enemy = None
    fall_turn = None

    for turn in range(1, horizon + 1):
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

    keep_needed = 0
    holds_full = True

    if planet.owner == player:
        def survives_with_keep(keep):
            sim_owner = planet.owner
            sim_garrison = float(keep)
            for turn in range(1, horizon + 1):
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


# ═══════════════════════════════════════════
# WORLD MODEL
# ═══════════════════════════════════════════
def count_players(planets, fleets):
    owners = set()
    for p in planets:
        if p.owner != -1:
            owners.add(p.owner)
    for f in fleets:
        owners.add(f.owner)
    return max(2, len(owners))


def indirect_wealth(planet, planets, player):
    wealth = 0.0
    for other in planets:
        if other.id == planet.id:
            continue
        d = dist(planet.x, planet.y, other.x, other.y)
        if d < 1:
            continue
        factor = other.production / (d + 12.0)
        if other.owner == player:
            wealth += factor * INDIRECT_FRIENDLY_WEIGHT
        elif other.owner == -1:
            wealth += factor * INDIRECT_NEUTRAL_WEIGHT
        else:
            wealth += factor * INDIRECT_ENEMY_WEIGHT
    return wealth


def detect_exposed_planets(fleets, enemy_planets):
    """Detect enemy planets that just launched most of their ships."""
    exposed = set()
    for planet in enemy_planets:
        outbound = sum(
            int(f.ships) for f in fleets
            if f.owner == planet.owner and f.from_planet_id == planet.id and f.ships >= 5
        )
        if outbound >= 12 and outbound >= planet.ships * 0.8:
            exposed.add(planet.id)
    return exposed


def detect_enemy_crashes(arrivals_by_planet, player, eta_window):
    """Detect where two enemy fleets will crash into the same planet."""
    crashes = []
    for target_id, arrivals in arrivals_by_planet.items():
        enemy_events = [
            (int(math.ceil(eta)), owner, int(ships))
            for eta, owner, ships in arrivals
            if owner not in (-1, player) and ships > 0
        ]
        if len(enemy_events) < 2:
            continue
        by_owner = defaultdict(list)
        for eta, owner, ships in enemy_events:
            by_owner[owner].append((eta, ships))
        if len(by_owner) < 2:
            continue
        enemy_events.sort()
        for i in range(len(enemy_events)):
            for j in range(i + 1, len(enemy_events)):
                eta_a, owner_a, ships_a = enemy_events[i]
                eta_b, owner_b, ships_b = enemy_events[j]
                if owner_a == owner_b:
                    continue
                if abs(eta_a - eta_b) > eta_window:
                    break
                if ships_a + ships_b < CRASH_EXPLOIT_MIN_TOTAL_SHIPS:
                    continue
                crashes.append({
                    "target_id": target_id,
                    "crash_turn": max(eta_a, eta_b),
                    "total_ships": ships_a + ships_b,
                })
                break
            else:
                continue
            break
    return crashes


class WorldModel:
    """Central game state with precomputed timelines, budgets, and caches."""

    def __init__(self, player, step, planets, fleets, initial_by_id, ang_vel, comets, comet_ids):
        self.player = player
        self.step = step
        self.planets = planets
        self.fleets = fleets
        self.initial_by_id = initial_by_id
        self.ang_vel = ang_vel
        self.comets = comets
        self.comet_ids = set(comet_ids)

        self.planet_by_id = {p.id: p for p in planets}
        self.my_planets = [p for p in planets if p.owner == player]
        self.enemy_planets = [p for p in planets if p.owner not in (-1, player)]
        self.neutral_planets = [p for p in planets if p.owner == -1]
        self.static_neutral_planets = [p for p in self.neutral_planets if is_static_planet(p)]

        self.num_players = count_players(planets, fleets)
        self.remaining_steps = max(1, TOTAL_STEPS - step)
        self.is_early = step < EARLY_TURN_LIMIT
        self.is_opening = step < OPENING_TURN_LIMIT
        self.is_late = self.remaining_steps < LATE_REMAINING_TURNS
        self.is_very_late = self.remaining_steps < VERY_LATE_REMAINING_TURNS
        self.is_total_war = self.remaining_steps < TOTAL_WAR_REMAINING_TURNS
        self.is_four_player = self.num_players >= 4

        # Per-owner strength
        self.owner_strength = defaultdict(int)
        self.owner_production = defaultdict(int)
        for p in planets:
            if p.owner != -1:
                self.owner_strength[p.owner] += int(p.ships)
                self.owner_production[p.owner] += int(p.production)
        for f in fleets:
            self.owner_strength[f.owner] += int(f.ships)

        self.my_total = self.owner_strength.get(player, 0)
        self.enemy_total = sum(s for o, s in self.owner_strength.items() if o != player)
        self.max_enemy_strength = max(
            (s for o, s in self.owner_strength.items() if o != player), default=0
        )
        self.my_prod = self.owner_production.get(player, 0)
        self.enemy_prod = sum(p for o, p in self.owner_production.items() if o != player)

        # Weakest enemy
        enemy_owners = set(p.owner for p in self.enemy_planets)
        if enemy_owners:
            self._weakest_enemy = min(
                enemy_owners,
                key=lambda o: self.owner_strength.get(o, 0) + self.owner_production.get(o, 0) * 15,
            )
        else:
            self._weakest_enemy = None

        # Build arrival ledger and timelines
        self.arrivals_by_planet = build_arrival_ledger(fleets, planets)
        self.base_timeline = {}
        for p in planets:
            self.base_timeline[p.id] = simulate_planet_timeline(
                p, self.arrivals_by_planet[p.id], player, HORIZON
            )

        # Indirect wealth
        self.indirect_wealth_map = {p.id: indirect_wealth(p, planets, player) for p in planets}

        # Exposed and crash detection
        self.exposed_planet_ids = detect_exposed_planets(fleets, self.enemy_planets)
        if CRASH_EXPLOIT_ENABLED and self.is_four_player:
            self.enemy_crashes = detect_enemy_crashes(
                self.arrivals_by_planet, player, CRASH_EXPLOIT_ETA_WINDOW
            )
        else:
            self.enemy_crashes = []

        # Shot cache
        self.shot_cache = {}

        # Compute defense budgets
        self.reserve, self.available, self.doomed, self.threatened = self._compute_defense()

    def _compute_defense(self):
        """Compute exact keep_needed + proactive defense for each planet."""
        reserve = {}
        available = {}
        doomed = set()
        threatened = {}

        for planet in self.my_planets:
            tl = self.base_timeline[planet.id]
            exact_keep = tl["keep_needed"]

            # Proactive: anticipate nearby enemies
            proactive = 0
            for enemy in self.enemy_planets:
                eta = travel_time(enemy.x, enemy.y, enemy.radius, planet.x, planet.y, planet.radius, max(1, enemy.ships))
                if eta <= PROACTIVE_DEFENSE_HORIZON:
                    proactive = max(proactive, int(enemy.ships * PROACTIVE_DEFENSE_RATIO))

            # Stacked multi-enemy threat
            threats = []
            for enemy in self.enemy_planets:
                eta = travel_time(enemy.x, enemy.y, enemy.radius, planet.x, planet.y, planet.radius, max(1, enemy.ships))
                if eta <= MULTI_ENEMY_PROACTIVE_HORIZON:
                    threats.append((eta, int(enemy.ships)))
            if threats:
                threats.sort()
                best_stacked = 0
                left = running = 0
                for right in range(len(threats)):
                    running += threats[right][1]
                    while threats[right][0] - threats[left][0] > MULTI_ENEMY_STACK_WINDOW:
                        running -= threats[left][1]
                        left += 1
                    best_stacked = max(best_stacked, running)
                proactive = max(proactive, int(best_stacked * MULTI_ENEMY_PROACTIVE_RATIO))

            # Total war: halve reserves
            if self.is_total_war:
                exact_keep = max(1, exact_keep // 2)
                proactive = max(1, proactive // 2)

            reserve[planet.id] = min(int(planet.ships), max(exact_keep, proactive))
            available[planet.id] = max(0, int(planet.ships) - reserve[planet.id])

            # Doomed detection
            if not tl["holds_full"] and tl["fall_turn"] is not None:
                if tl["fall_turn"] <= DOOMED_EVAC_TURN_LIMIT and planet.ships >= DOOMED_MIN_SHIPS:
                    doomed.add(planet.id)
                # Threatened — might be saveable with reinforcement
                if (REINFORCE_ENABLED and planet.production >= REINFORCE_MIN_PRODUCTION
                        and self.remaining_steps >= REINFORCE_MIN_FUTURE_TURNS):
                    threatened[planet.id] = {
                        "fall_turn": tl["fall_turn"],
                    }

        return reserve, available, doomed, threatened

    def is_static(self, planet_id):
        return is_static_planet(self.planet_by_id[planet_id])

    def comet_life(self, planet_id):
        return comet_remaining_life(planet_id, self.comets)

    def plan_shot(self, src_id, target_id, ships):
        ships = int(ships)
        key = (src_id, target_id, ships)
        if key in self.shot_cache:
            return self.shot_cache[key]
        src = self.planet_by_id[src_id]
        target = self.planet_by_id[target_id]
        result = aim_with_prediction(
            src, target, ships, self.initial_by_id, self.ang_vel, self.comets, self.comet_ids
        )
        self.shot_cache[key] = result
        return result

    def ships_needed_to_capture(self, target_id, arrival_turn, planned_commitments=None):
        """How many ships needed to own target at arrival_turn."""
        planned_commitments = planned_commitments or {}
        cutoff = max(1, int(math.ceil(arrival_turn)))
        arrivals = [x for x in self.arrivals_by_planet.get(target_id, []) if x[0] <= cutoff]
        for x in planned_commitments.get(target_id, []):
            if x[0] <= cutoff:
                arrivals.append(x)
        target = self.planet_by_id[target_id]
        tl = simulate_planet_timeline(target, arrivals, self.player, cutoff)
        owner, ships = state_at_timeline(tl, cutoff)
        if owner == self.player:
            return 0
        return int(math.ceil(ships)) + 1

    def reaction_times(self, target_id):
        """(my_min_time, enemy_min_time) to reach target."""
        target = self.planet_by_id[target_id]
        my_t = min(
            (travel_time(p.x, p.y, p.radius, target.x, target.y, target.radius, max(1, p.ships))
             for p in self.my_planets),
            default=10**9,
        )
        enemy_t = min(
            (travel_time(p.x, p.y, p.radius, target.x, target.y, target.radius, max(1, p.ships))
             for p in self.enemy_planets),
            default=10**9,
        )
        return my_t, enemy_t


# ═══════════════════════════════════════════
# STRATEGY
# ═══════════════════════════════════════════
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


def is_safe_neutral(target, world):
    if target.owner != -1:
        return False
    my_t, enemy_t = world.reaction_times(target.id)
    return my_t <= enemy_t - SAFE_NEUTRAL_MARGIN


def is_contested_neutral(target, world):
    if target.owner != -1:
        return False
    my_t, enemy_t = world.reaction_times(target.id)
    return abs(my_t - enemy_t) <= CONTESTED_NEUTRAL_MARGIN


def opening_filter(target, arrival_turns, needed, src_available, world):
    """Skip low-value rotating neutrals during opening."""
    if not world.is_opening or target.owner != -1:
        return False
    if target.id in world.comet_ids:
        return False
    if world.is_static(target.id):
        return False
    my_t, enemy_t = world.reaction_times(target.id)
    reaction_gap = enemy_t - my_t
    if (target.production >= SAFE_OPENING_PROD_THRESHOLD
            and arrival_turns <= SAFE_OPENING_TURN_LIMIT
            and reaction_gap >= SAFE_NEUTRAL_MARGIN):
        return False
    if world.is_four_player:
        affordable = needed <= max(PARTIAL_SOURCE_MIN_SHIPS, int(src_available * FOUR_PLAYER_ROTATING_SEND_RATIO))
        if affordable and arrival_turns <= FOUR_PLAYER_ROTATING_TURN_LIMIT and reaction_gap >= FOUR_PLAYER_ROTATING_REACTION_GAP:
            return False
        return True
    return arrival_turns > ROTATING_OPENING_MAX_TURNS or target.production <= ROTATING_OPENING_LOW_PROD


def target_value(target, arrival_turns, mission, world, modes):
    """Production snowball scoring: prod × remaining_turns / cost."""
    turns_profit = max(1, world.remaining_steps - arrival_turns)
    if target.id in world.comet_ids:
        life = world.comet_life(target.id)
        turns_profit = max(0, min(turns_profit, life - arrival_turns))
        if turns_profit <= 0:
            return -1.0

    value = target.production * turns_profit
    value += world.indirect_wealth_map[target.id] * turns_profit * INDIRECT_VALUE_SCALE

    # Static planet bonus
    if world.is_static(target.id):
        value *= STATIC_NEUTRAL_VALUE_MULT if target.owner == -1 else STATIC_HOSTILE_VALUE_MULT
    else:
        value *= ROTATING_OPENING_VALUE_MULT if world.is_opening else 1.0

    # Enemy planet bonus (gain + deny)
    if target.owner not in (-1, world.player):
        value *= OPENING_HOSTILE_TARGET_VALUE_MULT if world.is_opening else HOSTILE_TARGET_VALUE_MULT

    # Neutral safety
    if target.owner == -1:
        if is_safe_neutral(target, world):
            value *= SAFE_NEUTRAL_VALUE_MULT
        elif is_contested_neutral(target, world):
            value *= CONTESTED_NEUTRAL_VALUE_MULT
        if world.is_early:
            value *= EARLY_NEUTRAL_VALUE_MULT

    # Comet discount
    if target.id in world.comet_ids:
        value *= COMET_VALUE_MULT

    # Mission-specific multipliers
    if mission == "snipe":
        value *= SNIPE_VALUE_MULT
    elif mission == "swarm":
        value *= SWARM_VALUE_MULT
    elif mission == "reinforce":
        value *= REINFORCE_VALUE_MULT
    elif mission == "crash_exploit":
        value *= CRASH_EXPLOIT_VALUE_MULT

    # Exposed planet bonus
    if target.id in world.exposed_planet_ids:
        value *= EXPOSED_PLANET_VALUE_MULT

    # Weakest enemy targeting (4P)
    if world.is_four_player and world._weakest_enemy is not None:
        if target.owner == world._weakest_enemy:
            value *= WEAKEST_ENEMY_VALUE_MULT_4P

    # Late game bonuses
    if world.is_late:
        value += max(0, target.ships) * LATE_IMMEDIATE_SHIP_VALUE
        if target.owner not in (-1, world.player):
            enemy_strength = world.owner_strength.get(target.owner, 0)
            if enemy_strength <= WEAK_ENEMY_THRESHOLD:
                value += ELIMINATION_BONUS

    # Finishing mode
    if modes["is_finishing"] and target.owner not in (-1, world.player):
        value *= FINISHING_HOSTILE_VALUE_MULT
    if modes["is_behind"] and target.owner == -1 and not world.is_static(target.id):
        value *= BEHIND_ROTATING_NEUTRAL_VALUE_MULT
    if modes["is_behind"] and target.owner == -1 and is_safe_neutral(target, world):
        value *= 1.08

    return value


def preferred_send(target, base_needed, arrival_turns, src_available, world, modes):
    """How many ships to send (needed + margin)."""
    send = max(base_needed, int(math.ceil(base_needed * modes["attack_margin_mult"])))
    margin = 0
    if target.owner == -1:
        margin += min(NEUTRAL_MARGIN_CAP, NEUTRAL_MARGIN_BASE + target.production * NEUTRAL_MARGIN_PROD_WEIGHT)
    else:
        margin += min(HOSTILE_MARGIN_CAP, HOSTILE_MARGIN_BASE + target.production * HOSTILE_MARGIN_PROD_WEIGHT)
        # Hostile reinforcement prediction
        if world.enemy_planets:
            reinforce_est = 0
            for ep in world.enemy_planets:
                if ep.owner != target.owner:
                    continue
                eta = travel_time(ep.x, ep.y, ep.radius, target.x, target.y, target.radius, max(1, ep.ships))
                if eta <= arrival_turns + HOSTILE_REINFORCE_HORIZON:
                    reinforce_est += int(ep.ships * HOSTILE_REINFORCE_RATIO)
            margin += min(HOSTILE_REINFORCE_CAP, reinforce_est)
    if world.is_static(target.id):
        margin += STATIC_TARGET_MARGIN
    if is_contested_neutral(target, world):
        margin += CONTESTED_TARGET_MARGIN
    if world.is_four_player:
        margin += FOUR_PLAYER_TARGET_MARGIN
    if arrival_turns > LONG_TRAVEL_MARGIN_START:
        margin += min(LONG_TRAVEL_MARGIN_CAP, arrival_turns // LONG_TRAVEL_MARGIN_DIVISOR)
    if target.id in world.comet_ids:
        margin = max(0, margin - COMET_MARGIN_RELIEF)
    if modes["is_finishing"] and target.owner not in (-1, world.player):
        margin += FINISHING_HOSTILE_SEND_BONUS
    return min(src_available, send + margin)


def apply_score_modifiers(base_score, target, mission, world):
    score = base_score
    if world.is_static(target.id):
        score *= STATIC_TARGET_SCORE_MULT
    if world.is_early and target.owner == -1 and world.is_static(target.id):
        score *= EARLY_STATIC_NEUTRAL_SCORE_MULT
    if world.is_four_player and target.owner == -1 and not world.is_static(target.id):
        score *= FOUR_PLAYER_ROTATING_NEUTRAL_SCORE_MULT
    if len(world.static_neutral_planets) >= DENSE_STATIC_NEUTRAL_COUNT and target.owner == -1 and not world.is_static(target.id):
        score *= DENSE_ROTATING_NEUTRAL_SCORE_MULT
    if mission == "snipe":
        score *= SNIPE_SCORE_MULT
    elif mission == "swarm":
        score *= SWARM_SCORE_MULT
    return score


# ═══════════════════════════════════════════
# MISSION BUILDERS
# ═══════════════════════════════════════════
def build_snipe_missions(src, target, src_available, world, planned, modes):
    """Detect snipe opportunities: arrive at neutral right after enemy fleet battles."""
    if target.owner != -1:
        return None
    enemy_etas = sorted({
        int(math.ceil(eta))
        for eta, owner, ships in world.arrivals_by_planet.get(target.id, [])
        if owner not in (-1, world.player) and ships > 0
    })
    if not enemy_etas:
        return None
    probe = min(src_available, max(PARTIAL_SOURCE_MIN_SHIPS, int(target.ships) + 8))
    rough = world.plan_shot(src.id, target.id, probe)
    if rough is None:
        return None
    for enemy_eta in enemy_etas[:3]:
        if abs(rough[1] - enemy_eta) > 1:
            continue
        sync_turn = max(rough[1], enemy_eta)
        need = world.ships_needed_to_capture(target.id, sync_turn, planned)
        if need <= 0 or need > src_available:
            continue
        final = world.plan_shot(src.id, target.id, need)
        if final is None:
            continue
        angle, turns, _, _ = final
        if abs(turns - enemy_eta) > 1:
            continue
        value = target_value(target, turns, "snipe", world, modes)
        if value <= 0:
            continue
        score = apply_score_modifiers(value / (need + turns * SNIPE_COST_TURN_WEIGHT + 1.0), target, "snipe", world)
        option = ShotOption(score=score, src_id=src.id, target_id=target.id, angle=angle, turns=turns, needed=need, send_cap=need, mission="snipe")
        return Mission(kind="snipe", score=score, target_id=target.id, turns=turns, options=[option])
    return None


def build_reinforcement_missions(world, planned, modes):
    """Build missions to save threatened planets."""
    if not REINFORCE_ENABLED or not world.threatened:
        return []
    missions = []
    for target_id, info in world.threatened.items():
        target = world.planet_by_id[target_id]
        fall_turn = info["fall_turn"]
        if fall_turn is None or fall_turn > REINFORCE_MAX_TRAVEL_TURNS + 5:
            continue
        best = None
        for src in world.my_planets:
            if src.id == target_id:
                continue
            budget = world.available.get(src.id, 0)
            if budget <= 0:
                continue
            source_cap = min(budget, int(src.ships * REINFORCE_MAX_SOURCE_FRACTION))
            if source_cap <= 0:
                continue
            aim = world.plan_shot(src.id, target.id, max(PARTIAL_SOURCE_MIN_SHIPS, source_cap))
            if aim is None:
                continue
            angle, turns, _, _ = aim
            if turns > REINFORCE_MAX_TRAVEL_TURNS or turns > fall_turn:
                continue
            # Estimate needed reinforcement
            need = world.ships_needed_to_capture(target_id, turns, planned)
            if need <= 0:
                need = REINFORCE_SAFETY_MARGIN + 1
            send = min(source_cap, need + REINFORCE_SAFETY_MARGIN)
            if send < need:
                continue
            value = target_value(target, turns, "reinforce", world, modes)
            if value <= 0:
                continue
            score = value / (send + turns * 0.35 + 1.0)
            option = ShotOption(score=score, src_id=src.id, target_id=target_id, angle=angle, turns=turns, needed=need, send_cap=send, mission="reinforce")
            mission = Mission(kind="reinforce", score=score, target_id=target_id, turns=turns, options=[option])
            if best is None or mission.score > best.score:
                best = mission
        if best is not None:
            missions.append(best)
    return missions


def build_crash_exploit_missions(world, planned, modes):
    """In 4P, arrive after two enemies crash into each other."""
    if not world.enemy_crashes:
        return []
    missions = []
    for crash in world.enemy_crashes:
        target_id = crash["target_id"]
        target = world.planet_by_id[target_id]
        if target.owner == world.player:
            continue
        desired_arrival = crash["crash_turn"] + CRASH_EXPLOIT_POST_CRASH_DELAY
        best = None
        for src in world.my_planets:
            probe = min(max(PARTIAL_SOURCE_MIN_SHIPS, 12), int(src.ships))
            if probe <= 0:
                continue
            aim = world.plan_shot(src.id, target_id, probe)
            if aim is None:
                continue
            _, turns, _, _ = aim
            if abs(turns - desired_arrival) > 2:
                continue
            need = world.ships_needed_to_capture(target_id, turns, planned)
            if need <= 0 or need > int(src.ships):
                continue
            final = world.plan_shot(src.id, target_id, need)
            if final is None:
                continue
            angle, turns, _, _ = final
            value = target_value(target, turns, "crash_exploit", world, modes)
            if value <= 0:
                continue
            score = value / (need + turns * SNIPE_COST_TURN_WEIGHT + 1.0)
            option = ShotOption(score=score, src_id=src.id, target_id=target_id, angle=angle, turns=turns, needed=need, send_cap=need, mission="crash_exploit")
            mission = Mission(kind="crash_exploit", score=score, target_id=target_id, turns=turns, options=[option])
            if best is None or mission.score > best.score:
                best = mission
        if best is not None:
            missions.append(best)
    return missions


# ═══════════════════════════════════════════
# PLAN MOVES (main orchestrator)
# ═══════════════════════════════════════════
def plan_moves(world, deadline=None):
    modes = build_modes(world)
    planned_commitments = defaultdict(list)
    source_options_by_target = defaultdict(list)
    missions = []
    moves = []
    spent_total = defaultdict(int)

    def source_attack_left(source_id):
        return max(0, world.available.get(source_id, 0) - spent_total[source_id])

    def source_inventory_left(source_id):
        return max(0, int(world.planet_by_id[source_id].ships) - spent_total[source_id])

    def append_move(src_id, angle, ships):
        send = min(int(ships), source_inventory_left(src_id))
        if send < 1:
            return 0
        moves.append([src_id, float(angle), int(send)])
        spent_total[src_id] += send
        return send

    def time_ok():
        return deadline is None or time.perf_counter() < deadline

    # ── Phase 1: Reinforcement missions ──
    reinforce_missions = build_reinforcement_missions(world, planned_commitments, modes)
    missions.extend(reinforce_missions)

    # ── Phase 2: Crash exploit missions (4P) ──
    crash_missions = build_crash_exploit_missions(world, planned_commitments, modes)
    missions.extend(crash_missions)

    # ── Phase 3: Build capture/snipe options for all (src, target) pairs ──
    for src in world.my_planets:
        if not time_ok():
            break
        src_avail = source_attack_left(src.id)
        if src_avail <= 0:
            continue

        for target in world.planets:
            if target.id == src.id or target.owner == world.player:
                continue

            # Quick feasibility check
            rough_ships = max(1, min(src_avail, max(PARTIAL_SOURCE_MIN_SHIPS, int(target.ships) + 1)))
            rough = world.plan_shot(src.id, target.id, rough_ships)
            if rough is None:
                continue
            rough_turns = rough[1]

            # Time validity
            if world.is_very_late and rough_turns > world.remaining_steps - 3:
                continue
            if target.id in world.comet_ids:
                life = world.comet_life(target.id)
                if rough_turns >= life or rough_turns > COMET_MAX_CHASE_TURNS:
                    continue

            rough_needed = world.ships_needed_to_capture(target.id, rough_turns, planned_commitments)
            if rough_needed <= 0:
                continue
            if opening_filter(target, rough_turns, rough_needed, src_avail, world):
                continue

            # Precise aiming with preferred send
            send_guess = preferred_send(target, rough_needed, rough_turns, src_avail, world, modes)
            aim = world.plan_shot(src.id, target.id, max(1, send_guess))
            if aim is None:
                continue
            angle, turns, _, _ = aim

            if world.is_very_late and turns > world.remaining_steps - 3:
                continue
            if target.id in world.comet_ids:
                life = world.comet_life(target.id)
                if turns >= life or turns > COMET_MAX_CHASE_TURNS:
                    continue

            needed = world.ships_needed_to_capture(target.id, turns, planned_commitments)
            if needed <= 0:
                continue
            if opening_filter(target, turns, needed, src_avail, world):
                continue

            send_cap = min(src_avail, preferred_send(target, needed, turns, src_avail, world, modes))
            if send_cap < 1:
                continue
            if send_cap < needed and send_cap < PARTIAL_SOURCE_MIN_SHIPS:
                continue

            value = target_value(target, turns, "capture", world, modes)
            if value <= 0:
                continue

            expected_send = max(needed, min(send_cap, preferred_send(target, needed, turns, send_cap, world, modes)))
            score = apply_score_modifiers(
                value / (expected_send + turns * ATTACK_COST_TURN_WEIGHT + 1.0),
                target, "capture", world
            )

            option = ShotOption(
                score=score, src_id=src.id, target_id=target.id,
                angle=angle, turns=turns, needed=needed, send_cap=send_cap, mission="capture"
            )
            source_options_by_target[target.id].append(option)

            if send_cap >= needed:
                missions.append(Mission(kind="single", score=score, target_id=target.id, turns=turns, options=[option]))

            # Snipe check
            snipe = build_snipe_missions(src, target, src_avail, world, planned_commitments, modes)
            if snipe is not None:
                missions.append(snipe)

    # ── Phase 4: Multi-source swarm assembly ──
    for target_id, options in source_options_by_target.items():
        if len(options) < 2:
            continue
        target = world.planet_by_id[target_id]
        top_opts = sorted(options, key=lambda x: -x.score)[:MULTI_SOURCE_TOP_K]

        hostile = target.owner not in (-1, world.player)
        eta_tol = HOSTILE_SWARM_ETA_TOLERANCE if hostile else MULTI_SOURCE_ETA_TOLERANCE

        # 2-source swarms
        for i in range(len(top_opts)):
            for j in range(i + 1, len(top_opts)):
                a, b = top_opts[i], top_opts[j]
                if a.src_id == b.src_id:
                    continue
                if abs(a.turns - b.turns) > eta_tol:
                    continue
                joint_turn = max(a.turns, b.turns)
                need = world.ships_needed_to_capture(target_id, joint_turn, planned_commitments)
                if need <= 0:
                    continue
                if a.send_cap >= need or b.send_cap >= need:
                    continue  # Single source can handle it
                if a.send_cap + b.send_cap < need:
                    continue
                value = target_value(target, joint_turn, "swarm", world, modes)
                if value <= 0:
                    continue
                score = apply_score_modifiers(
                    value / (need + joint_turn * ATTACK_COST_TURN_WEIGHT + 1.0),
                    target, "swarm", world
                ) * MULTI_SOURCE_PLAN_PENALTY
                missions.append(Mission(kind="swarm", score=score, target_id=target_id, turns=joint_turn, options=[a, b]))

        # 3-source swarms
        if THREE_SOURCE_SWARM_ENABLED and len(top_opts) >= 3 and target.ships >= THREE_SOURCE_MIN_TARGET_SHIPS:
            for i in range(len(top_opts)):
                for j in range(i + 1, len(top_opts)):
                    for k in range(j + 1, len(top_opts)):
                        a, b, c = top_opts[i], top_opts[j], top_opts[k]
                        if len({a.src_id, b.src_id, c.src_id}) < 3:
                            continue
                        max_t = max(a.turns, b.turns, c.turns)
                        min_t = min(a.turns, b.turns, c.turns)
                        if max_t - min_t > THREE_SOURCE_ETA_TOLERANCE + 1:
                            continue
                        total_cap = a.send_cap + b.send_cap + c.send_cap
                        need = world.ships_needed_to_capture(target_id, max_t, planned_commitments)
                        if need <= 0 or total_cap < need:
                            continue
                        value = target_value(target, max_t, "swarm", world, modes)
                        if value <= 0:
                            continue
                        score = apply_score_modifiers(
                            value / (need + max_t * ATTACK_COST_TURN_WEIGHT + 1.0),
                            target, "swarm", world
                        ) * THREE_SOURCE_PLAN_PENALTY
                        missions.append(Mission(kind="swarm", score=score, target_id=target_id, turns=max_t, options=[a, b, c]))

    # ── Phase 5: Dispatch missions by score ──
    missions.sort(key=lambda m: m.score, reverse=True)
    targeted = set()

    for mission in missions:
        if not time_ok():
            break
        tid = mission.target_id

        # For single-source missions: skip if target already taken
        if mission.kind in ("single", "snipe", "crash_exploit") and tid in targeted:
            continue

        # Check all sources still have budget
        can_execute = True
        for opt in mission.options:
            avail = source_attack_left(opt.src_id)
            if mission.kind == "reinforce":
                avail = source_inventory_left(opt.src_id)
            if avail < opt.needed:
                can_execute = False
                break
        if not can_execute:
            continue

        # Execute
        for opt in mission.options:
            avail = source_attack_left(opt.src_id)
            if mission.kind == "reinforce":
                avail = source_inventory_left(opt.src_id)
            send = min(avail, opt.send_cap)
            send = max(send, opt.needed)
            send = min(send, avail)
            if send < 1:
                continue
            # Re-aim with exact send count
            aim = world.plan_shot(opt.src_id, opt.target_id, send)
            if aim is None:
                append_move(opt.src_id, opt.angle, send)
            else:
                append_move(opt.src_id, aim[0], send)
            # Track commitment
            planned_commitments[opt.target_id].append((opt.turns, world.player, send))

        targeted.add(tid)

    # ── Phase 6: Doomed planet evacuation ──
    for planet_id in world.doomed:
        planet = world.planet_by_id[planet_id]
        evac_ships = source_inventory_left(planet_id)
        if evac_ships < DOOMED_MIN_SHIPS:
            continue
        # Find best nearby ally to evacuate to
        best_dest = None
        best_score = -1
        for ally in world.my_planets:
            if ally.id == planet_id:
                continue
            if ally.id in world.doomed:
                continue
            aim = world.plan_shot(planet_id, ally.id, evac_ships)
            if aim is None:
                continue
            _, turns, _, _ = aim
            if turns > DOOMED_EVAC_TURN_LIMIT:
                continue
            score = ally.production * 10 + ally.ships - turns * 2
            if score > best_score:
                best_score = score
                best_dest = (ally.id, aim[0], turns)
        if best_dest is not None:
            dest_id, angle, turns = best_dest
            send = max(1, evac_ships - 1)  # Leave 1 to slow enemy capture
            append_move(planet_id, angle, send)

    # ── Phase 7: Rear forwarding — move surplus from back-line to front ──
    if not world.is_opening and world.enemy_planets:
        front_center_x = sum(p.x for p in world.enemy_planets) / len(world.enemy_planets)
        front_center_y = sum(p.y for p in world.enemy_planets) / len(world.enemy_planets)
        my_center_x = sum(p.x for p in world.my_planets) / len(world.my_planets)
        my_center_y = sum(p.y for p in world.my_planets) / len(world.my_planets)

        for src in world.my_planets:
            surplus = source_attack_left(src.id)
            if surplus < REAR_SOURCE_MIN_SHIPS:
                continue
            # Is this a rear planet? (farther from enemy than our center)
            src_to_enemy = dist(src.x, src.y, front_center_x, front_center_y)
            center_to_enemy = dist(my_center_x, my_center_y, front_center_x, front_center_y)
            if src_to_enemy < center_to_enemy * REAR_DISTANCE_RATIO:
                continue
            # Find best frontline destination
            best_front = None
            best_front_score = -1
            for front in world.my_planets:
                if front.id == src.id:
                    continue
                front_to_enemy = dist(front.x, front.y, front_center_x, front_center_y)
                if front_to_enemy >= src_to_enemy:
                    continue
                aim = world.plan_shot(src.id, front.id, surplus)
                if aim is None:
                    continue
                _, turns, _, _ = aim
                if turns > REAR_MAX_TRAVEL_TURNS:
                    continue
                score = front.production * 5 - turns * 2 - front_to_enemy
                if score > best_front_score:
                    best_front_score = score
                    best_front = (front.id, aim[0], turns)
            if best_front is not None:
                ratio = REAR_SEND_RATIO_FOUR_PLAYER if world.is_four_player else REAR_SEND_RATIO_TWO_PLAYER
                send = max(REAR_SEND_MIN_SHIPS, int(surplus * ratio))
                send = min(send, surplus)
                append_move(src.id, best_front[1], send)

    # ── Phase 8: Endgame consolidation ──
    if world.remaining_steps < 40 and len(world.my_planets) >= 3:
        best_prod = max(world.my_planets, key=lambda p: p.production)
        for src in world.my_planets:
            if src.id == best_prod.id:
                continue
            surplus = source_inventory_left(src.id)
            if surplus < 15:
                continue
            aim = world.plan_shot(src.id, best_prod.id, surplus)
            if aim is None:
                continue
            _, turns, _, _ = aim
            turns_left = world.remaining_steps - turns
            if turns_left < 5:
                continue
            prod_diff = best_prod.production - src.production
            if prod_diff <= 0:
                continue
            send = min(surplus // 2, surplus)
            if send < 10:
                continue
            append_move(src.id, aim[0], send)

    # Safety net: ensure no planet sends more ships than it has
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


# ═══════════════════════════════════════════
# AGENT ENTRY POINT
# ═══════════════════════════════════════════
_agent_step = 0


def agent(obs, config=None):
    global _agent_step
    _agent_step += 1
    start_time = time.perf_counter()

    g = lambda k, d: obs.get(k, d) if isinstance(obs, dict) else getattr(obs, k, d)

    player = g("player", 0)
    step = g("step", 0)
    ang_vel = g("angular_velocity", 0.035)
    comet_ids = set(g("comet_planet_ids", []))
    comets = g("comets", [])

    raw_planets = g("planets", [])
    raw_fleets = g("fleets", [])
    raw_init = g("initial_planets", [])

    planets = [Planet(*p) for p in raw_planets]
    fleets = [Fleet(*f) for f in raw_fleets]
    initial_by_id = {Planet(*p).id: Planet(*p) for p in raw_init}

    if not any(p.owner == player for p in planets):
        return []

    act_timeout = 1.0
    if config is not None:
        act_timeout = config.get("actTimeout", 1.0) if isinstance(config, dict) else getattr(config, "actTimeout", 1.0)
    deadline = start_time + min(SOFT_ACT_DEADLINE, max(0.55, act_timeout * 0.82))

    world = WorldModel(player, step, planets, fleets, initial_by_id, ang_vel, comets, comet_ids)
    return plan_moves(world, deadline=deadline)
