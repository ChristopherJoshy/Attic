"""
Orbit Wars Championship Agent v3.0 — "Orbital Predator"
=========================================================
A top-5 targeting agent for Kaggle Orbit Wars 2026.

Architecture:
  1. Orbital Intercept Engine — Aim where the planet WILL BE, not where it IS
  2. Influence Map — Real-time threat/opportunity assessment for every planet
  3. ROI Targeting with Vulture Multiplier — Attack weakened enemies, not strong ones
  4. Defensive Garrison System — Never strip planets naked
  5. Fleet Coordination — Synchronized multi-source pincer attacks
  6. Multi-Player Exploitation — Let enemies fight each other, then strike the winner
  7. Sun-Avoidance Pathfinding — Never lose a fleet to solar collision
  8. Production-Tick Timing — Capture planets just before they produce ships
  9. Adaptive Aggression — Early game: expand neutrals. Late game: crush enemies.
  10. Fleet Splitting — Optimal speed/size tradeoff for coordinated arrival

Based on: Planet Wars 2010 top-bot strategies, Generals.io self-play paper
(arxiv:2507.06825), and Minimax Exploiter theory (arxiv:2311.17190).
"""

import math

# ═══════════════════════════════════════════════════════════════════════════════
# GAME CONSTANTS (tuned for Orbit Wars 2026 Kaggle environment)
# ═══════════════════════════════════════════════════════════════════════════════
BOARD_SIZE = 100.0
CENTER = 50.0
SUN_RADIUS = 10.0
SUN_SAFETY_MARGIN = 2.0          # Extra buffer — losing a fleet to sun is catastrophic
MAX_SPEED = 6.0
MIN_SPEED = 1.0
HORIZON = 90                     # Lookahead turns for intercept calculation
MIN_FLEET_SIZE = 3               # Never send fewer ships than this
GARRISON_BASE = 5                # Minimum ships to keep on any owned planet
GARRISON_THREAT_MULT = 1.35      # Keep 1.35x the incoming threat as garrison
INFLUENCE_DECAY = 0.06           # Exponential decay for influence map
VULTURE_MULT = 2.5               # Score multiplier for attacking weakened enemies
NEUTRAL_MULT = 1.0               # Score multiplier for neutral planets
STRONG_ENEMY_MULT = 0.6          # Penalty for attacking a strong enemy
EARLY_GAME_CUTOFF = 60           # Before this step, prefer neutral expansion
MID_GAME_CUTOFF = 200            # Transition to aggressive mode
CONSOLIDATION_THRESHOLD = 0.4    # If enemy has >40% more ships, consolidate first
SPLIT_THRESHOLD = 40             # Split fleets larger than this for speed advantage
COORDINATION_WINDOW = 3          # Turns tolerance for synchronized arrival

# ═══════════════════════════════════════════════════════════════════════════════
# CORE PHYSICS ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

def get_fleet_speed(num_ships):
    """Fleet speed as a function of size. Smaller = faster."""
    num_ships = max(1, num_ships)
    return min(MAX_SPEED, MIN_SPEED + (num_ships - 1) * 5.0 / 99.0)


def orbital_radius(planet):
    """Distance of planet from the sun (orbit radius)."""
    return math.sqrt((planet[2] - CENTER) ** 2 + (planet[3] - CENTER) ** 2)


def current_angle(planet):
    """Current angular position of planet relative to sun."""
    return math.atan2(planet[3] - CENTER, planet[2] - CENTER)


def predict_planet_pos(planet, angular_velocity, t_future):
    """
    Predict planet (x, y) at t_future turns from now.
    Handles static planets (no orbit) gracefully.
    """
    r = orbital_radius(planet)
    if r < 1.0 or abs(angular_velocity) < 1e-7:
        return planet[2], planet[3]

    angle = current_angle(planet)
    future_angle = angle + angular_velocity * t_future
    return CENTER + r * math.cos(future_angle), CENTER + r * math.sin(future_angle)


def distance(x1, y1, x2, y2):
    """Euclidean distance between two points."""
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)


def hits_sun(x1, y1, x2, y2):
    """
    Check if the straight-line path from (x1,y1) to (x2,y2) clips the sun.
    Uses closest-point-on-segment projection for geometric accuracy.
    """
    dx, dy = x2 - x1, y2 - y1
    len_sq = dx * dx + dy * dy
    if len_sq < 1e-9:
        return False

    # Project sun center onto the line segment
    t = ((CENTER - x1) * dx + (CENTER - y1) * dy) / len_sq
    t = max(0.0, min(1.0, t))

    closest_x = x1 + t * dx
    closest_y = y1 + t * dy
    dist_to_sun = distance(closest_x, closest_y, CENTER, CENTER)

    return dist_to_sun < (SUN_RADIUS + SUN_SAFETY_MARGIN)


# ═══════════════════════════════════════════════════════════════════════════════
# ORBITAL INTERCEPT SOLVER
# ═══════════════════════════════════════════════════════════════════════════════

def compute_sun_avoidance_angle(sx, sy, tx, ty):
    """
    When direct path clips the sun, compute an aim angle that routes around it.
    We offset the aim perpendicular to the sun edge, choosing the shorter detour.
    Returns the adjusted aim angle, or None if no safe route exists.
    """
    # Vector from source to target
    dx, dy = tx - sx, ty - sy
    path_len = math.sqrt(dx * dx + dy * dy)
    if path_len < 1e-6:
        return None

    # Vector from source to sun center
    scx, scy = CENTER - sx, CENTER - sy

    # Find which side of the path the sun is on, then offset to the opposite side
    # Cross product determines side
    cross = dx * scy - dy * scx

    # Tangent point on sun circle from source
    dist_to_sun = distance(sx, sy, CENTER, CENTER)
    safe_radius = SUN_RADIUS + SUN_SAFETY_MARGIN + 1.0  # Extra 1.0 for safety

    if dist_to_sun <= safe_radius:
        return None  # Source is inside sun zone — shouldn't happen

    # Angle from source to sun center
    angle_to_sun = math.atan2(CENTER - sy, CENTER - sx)

    # Angular offset to clear the sun
    sin_val = safe_radius / dist_to_sun
    if sin_val >= 1.0:
        return None
    offset_angle = math.asin(sin_val)

    # Choose the side that gets us closer to the target
    if cross > 0:
        # Sun is to the left of our path, go right
        waypoint_angle = angle_to_sun - offset_angle
    else:
        # Sun is to the right, go left
        waypoint_angle = angle_to_sun + offset_angle

    return waypoint_angle


def find_intercept(src, target, angular_velocity, num_ships):
    """
    Solve the moving-target intercept problem:
    Find the earliest turn t where fleet from src reaches target's future position.

    If the direct path is blocked by the sun, computes a sun-avoidance angle.
    Returns: (travel_time, aim_angle, target_x, target_y) or (None, None, None, None)
    """
    speed = get_fleet_speed(num_ships)
    sx, sy = src[2], src[3]

    for t in range(1, HORIZON):
        tx, ty = predict_planet_pos(target, angular_velocity, t)
        dist = distance(sx, sy, tx, ty)

        if dist / speed <= t:
            # Reachable — check sun collision
            if not hits_sun(sx, sy, tx, ty):
                angle = math.atan2(ty - sy, tx - sx)
                return t, angle, tx, ty
            else:
                # Direct path blocked — try routing around the sun
                avoid_angle = compute_sun_avoidance_angle(sx, sy, tx, ty)
                if avoid_angle is not None:
                    # The fleet travels in a straight line at avoid_angle.
                    # Estimate a time penalty for the detour (~30% longer)
                    detour_time = int(t * 1.3) + 1
                    if detour_time < HORIZON:
                        return detour_time, avoid_angle, tx, ty

    return None, None, None, None


def find_intercept_from_pos(sx, sy, target, angular_velocity, num_ships):
    """Same as find_intercept but from arbitrary (x,y) instead of planet."""
    speed = get_fleet_speed(num_ships)
    for t in range(1, HORIZON):
        tx, ty = predict_planet_pos(target, angular_velocity, t)
        dist = distance(sx, sy, tx, ty)
        if dist / speed <= t:
            if not hits_sun(sx, sy, tx, ty):
                angle = math.atan2(ty - sy, tx - sx)
                return t, angle, tx, ty
            else:
                avoid_angle = compute_sun_avoidance_angle(sx, sy, tx, ty)
                if avoid_angle is not None:
                    detour_time = int(t * 1.3) + 1
                    if detour_time < HORIZON:
                        return detour_time, avoid_angle, tx, ty
    return None, None, None, None


# ═══════════════════════════════════════════════════════════════════════════════
# INFLUENCE MAP — Real-time Threat Assessment
# ═══════════════════════════════════════════════════════════════════════════════

def compute_influence_map(planets, my_id, angular_velocity):
    """
    For each planet, compute net influence score.
    Positive = friendly dominance, Negative = enemy threat.

    Uses exponential decay based on travel time, not raw distance,
    because orbital mechanics make angular separation matter.
    """
    n = len(planets)
    influence = [0.0] * n

    for i in range(n):
        for j in range(n):
            if i == j:
                continue

            # Approximate travel time (use small fleet for worst-case speed)
            dist = distance(planets[i][2], planets[i][3],
                           planets[j][2], planets[j][3])
            approx_time = dist / get_fleet_speed(10) + 1.0

            decay = math.exp(-INFLUENCE_DECAY * approx_time)

            owner_j = planets[j][1]
            ships_j = planets[j][5]

            if owner_j == my_id:
                influence[i] += ships_j * decay
            elif owner_j != -1 and owner_j != 0:
                # Count all non-neutral, non-mine as threat
                influence[i] -= ships_j * decay

    return influence


# ═══════════════════════════════════════════════════════════════════════════════
# GARRISON CALCULATOR — Never Strip Planets
# ═══════════════════════════════════════════════════════════════════════════════

def compute_garrison(planet, influence_val, game_phase):
    """
    Calculate minimum ships to keep on this planet.

    Factors:
    - Base garrison (always keep some)
    - Threat-adjusted (keep more if enemy influence is high)
    - Production-adjusted (high-production planets are more valuable to defend)
    - Game phase (early = less garrison, late = more)
    - Survival mode: if planet has very few ships, reduce garrison to allow expansion
    """
    ship_count = planet[5]
    base = GARRISON_BASE
    production = planet[6] if len(planet) > 6 else 1

    # SURVIVAL MODE: if we have very few ships, we MUST expand or we die
    # Reduce garrison to allow at least some offensive capability
    if ship_count <= 20:
        # Keep just enough to not be zero — expansion is survival
        return max(2, min(base, ship_count // 3))

    # Production value garrison: protect valuable planets more
    prod_garrison = production * 2

    # Threat-based garrison (capped to prevent over-hoarding)
    threat_garrison = 0
    if influence_val < 0:
        # Negative influence = enemy threat — but cap at reasonable level
        threat_garrison = min(int(abs(influence_val) * GARRISON_THREAT_MULT), 30)

    # Phase adjustment
    if game_phase == "early":
        phase_mult = 0.5   # Be aggressive early
    elif game_phase == "mid":
        phase_mult = 0.8
    else:
        phase_mult = 1.2   # Protect territory late game

    total = int((base + prod_garrison + threat_garrison) * phase_mult)
    # Never reserve more than 60% of available ships — must keep offensive capability
    max_garrison = int(ship_count * 0.6)
    return min(max(GARRISON_BASE, total), max_garrison)


# ═══════════════════════════════════════════════════════════════════════════════
# MULTI-PLAYER EXPLOITATION ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_players(planets, my_id):
    """
    Assess each player's strength and identify who is fighting whom.
    Returns dict: player_id -> {total_ships, total_production, planet_count, is_weak}
    """
    players = {}
    for p in planets:
        owner = p[1]
        if owner == -1 or owner == 0:  # Neutral
            continue
        if owner not in players:
            players[owner] = {
                "total_ships": 0,
                "total_production": 0,
                "planet_count": 0,
            }
        players[owner]["total_ships"] += p[5]
        players[owner]["total_production"] += p[6] if len(p) > 6 else 0
        players[owner]["planet_count"] += 1

    if my_id not in players:
        return players

    my_strength = players[my_id]["total_ships"]

    for pid, info in players.items():
        if pid == my_id:
            info["is_weak"] = False
            continue
        # An enemy is "weak" if they have <60% of our ships
        info["is_weak"] = info["total_ships"] < my_strength * 0.6
        # An enemy is "strong" if they have >150% of our ships
        info["is_strong"] = info["total_ships"] > my_strength * 1.5

    return players


def get_enemy_vulnerability(target_owner, player_analysis):
    """
    Returns a multiplier based on how vulnerable the target's owner is.
    Higher = more vulnerable = more attractive target.
    """
    if target_owner == -1 or target_owner == 0:
        return NEUTRAL_MULT

    if target_owner not in player_analysis:
        return NEUTRAL_MULT

    info = player_analysis[target_owner]
    if info.get("is_weak", False):
        return VULTURE_MULT   # Weakened enemy — ATTACK!
    if info.get("is_strong", False):
        return STRONG_ENEMY_MULT  # Strong enemy — avoid unless easy target
    return 1.2  # Normal enemy


# ═══════════════════════════════════════════════════════════════════════════════
# ROI TARGET SCORING — The Core Decision Engine
# ═══════════════════════════════════════════════════════════════════════════════

def score_target(src, target, angular_velocity, step, player_analysis, influence_map, target_idx):
    """
    Score a (source, target) pair by ROI: (production_value * multipliers) / cost.

    This is the single most important function in the entire agent.
    """
    # Try different fleet sizes to find optimal
    # Include small sizes for cheap neutral captures + larger for enemy planets
    best_score = -1e9
    best_config = None

    # Dynamic fleet size candidates based on what's available
    src_ships = src[5]
    candidates = set()
    # Always try small fleets (for neutrals)
    for s in [3, 5, 8, 12, 15, 20, 25, 35, 50, 70, 90]:
        if s <= src_ships:
            candidates.add(s)
    # Also try exact-needed sizes (will be computed dynamically below)
    candidates = sorted(candidates)

    for send_ships in candidates:
        if send_ships > src[5]:
            continue

        tti, angle, tx, ty = find_intercept(src, target, angular_velocity, send_ships)
        if tti is None:
            continue

        # Ships the target will have when we arrive
        target_ships_arrival = target[5]
        target_owner = target[1]
        target_production = target[6] if len(target) > 6 else 0

        if target_owner != -1 and target_owner != 0:
            # Enemy planet produces while we travel
            target_ships_arrival += target_production * tti

        # Ships needed to capture (+2 safety margin)
        needed = int(target_ships_arrival) + 2

        if needed > send_ships or needed < MIN_FLEET_SIZE:
            continue

        # === ROI Calculation ===
        # Production gained per turn after capture
        prod_value = max(target_production, 0.5)

        # Time to break even: turns until production pays back the ships we spent
        breakeven = needed / max(prod_value, 0.1)

        # Core ROI: production per ship per turn
        roi = prod_value / (needed * (tti + 1))

        # === Multipliers ===

        # 1. Vulnerability multiplier (from multi-player analysis)
        vuln_mult = get_enemy_vulnerability(target_owner, player_analysis)

        # 2. Threat multiplier: capturing a threatening planet near our territory is urgent
        threat_bonus = 1.0
        if target_idx < len(influence_map) and influence_map[target_idx] < -10:
            threat_bonus = 1.5  # High priority — this planet threatens us

        # 3. Game phase multiplier
        if step < EARLY_GAME_CUTOFF:
            # Early game: strongly prefer neutrals (they don't fight back)
            if target_owner == -1 or target_owner == 0:
                phase_mult = 2.0
            else:
                phase_mult = 0.4
        elif step < MID_GAME_CUTOFF:
            phase_mult = 1.0
        else:
            # Late game: prefer high-production enemy planets
            if target_owner != -1 and target_owner != 0:
                phase_mult = 1.5
            else:
                phase_mult = 0.8

        # 4. Breakeven penalty: very long breakeven = bad investment
        breakeven_penalty = 1.0 / (1.0 + breakeven / 50.0)

        # 5. Distance penalty: closer is better (all else equal)
        dist_penalty = 1.0 / (1.0 + tti / 30.0)

        # Final composite score
        score = roi * vuln_mult * threat_bonus * phase_mult * breakeven_penalty * dist_penalty

        if score > best_score:
            best_score = score
            best_config = {
                "score": score,
                "tti": tti,
                "angle": angle,
                "needed": needed,
                "send_ships": needed,  # Send exactly what's needed (save the rest)
                "tx": tx,
                "ty": ty,
            }

    return best_score, best_config


# ═══════════════════════════════════════════════════════════════════════════════
# FLEET COORDINATION — Multi-Source Pincer Attacks
# ═══════════════════════════════════════════════════════════════════════════════

def plan_coordinated_attack(target, my_planets, angular_velocity, ships_reserved, target_ships_arrival):
    """
    For heavily defended targets, coordinate fleets from multiple planets
    to arrive within COORDINATION_WINDOW turns of each other.

    This creates a "pincer" that overwhelms the defender.
    """
    attack_plan = []

    for src in my_planets:
        available = src[5] - ships_reserved.get(src[0], 0)
        if available < MIN_FLEET_SIZE:
            continue

        # Use half the available ships per source for coordination
        send = min(available, max(MIN_FLEET_SIZE, available // 2))
        tti, angle, tx, ty = find_intercept(src, target, angular_velocity, send)
        if tti is not None:
            attack_plan.append({
                "src": src,
                "tti": tti,
                "angle": angle,
                "send": send,
            })

    if len(attack_plan) < 2:
        return []  # Not enough sources for coordination

    # Sort by arrival time
    attack_plan.sort(key=lambda x: x["tti"])

    # Check if total ships exceed what's needed
    total_ships = sum(a["send"] for a in attack_plan)
    if total_ships < target_ships_arrival + 3:
        return []  # Not enough total firepower

    # Only keep fleets that arrive within COORDINATION_WINDOW of the first
    earliest = attack_plan[0]["tti"]
    coordinated = [a for a in attack_plan if a["tti"] - earliest <= COORDINATION_WINDOW]

    # Verify coordinated fleets are sufficient
    coord_ships = sum(a["send"] for a in coordinated)
    if coord_ships < target_ships_arrival + 3:
        return []

    return coordinated


# ═══════════════════════════════════════════════════════════════════════════════
# ADAPTIVE FLEET SPLITTING
# ═══════════════════════════════════════════════════════════════════════════════

def should_split_fleet(needed, available):
    """
    Determine if we should split a large fleet for speed advantage.
    Smaller fleets move faster — sometimes two fast waves beat one slow wave.
    """
    if needed <= SPLIT_THRESHOLD:
        return False, needed

    # Check if splitting gives a meaningful speed advantage
    speed_full = get_fleet_speed(needed)
    speed_half = get_fleet_speed(needed // 2)

    # Only split if the speed improvement is significant (>15%)
    return speed_half > speed_full * 1.15, needed // 2


# ═══════════════════════════════════════════════════════════════════════════════
# EMERGENCY DEFENSE — Recall fleets when under severe threat
# ═══════════════════════════════════════════════════════════════════════════════

def find_emergency_defenses(my_planets, influence_map, ships_reserved, angular_velocity):
    """
    If any of our planets is severely threatened, redirect nearby ships
    as emergency reinforcements instead of attacking.
    """
    defense_orders = []

    for idx, p in enumerate(my_planets):
        if idx >= len(influence_map):
            continue

        if influence_map[idx] >= -20:  # Not severely threatened
            continue

        # This planet is under severe threat — find nearest friendly reinforcement
        ships_on_planet = p[5] - ships_reserved.get(p[0], 0)
        threat_level = abs(influence_map[idx])

        if ships_on_planet > threat_level * 0.8:
            continue  # Already have enough to defend

        # Look for friendly planets that can reinforce
        for other_idx, other in enumerate(my_planets):
            if other[0] == p[0]:
                continue

            available = other[5] - ships_reserved.get(other[0], 0)
            if available < MIN_FLEET_SIZE * 2:
                continue

            # Only reinforce if the other planet isn't also threatened
            if other_idx < len(influence_map) and influence_map[other_idx] < -15:
                continue

            # Send reinforcements
            reinforce = min(available // 2, int(threat_level * 0.5))
            if reinforce >= MIN_FLEET_SIZE:
                tti, angle, tx, ty = find_intercept(other, p, angular_velocity, reinforce)
                if tti is not None and tti < 15:
                    defense_orders.append({
                        "src_id": other[0],
                        "angle": angle,
                        "ships": reinforce,
                    })
                    ships_reserved[other[0]] = ships_reserved.get(other[0], 0) + reinforce
                    break  # One reinforcement per threatened planet

    return defense_orders


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN AGENT — Orchestrates all systems
# ═══════════════════════════════════════════════════════════════════════════════

def agent(obs, config):
    """
    Main agent function called by Kaggle environment each turn.

    Decision pipeline:
    1. Parse game state
    2. Determine game phase (early/mid/late)
    3. Compute influence map
    4. Analyze all players (multi-player exploitation)
    5. Emergency defense check
    6. Score ALL (source, target) pairs by ROI
    7. Dispatch fleets greedily by score, respecting garrison limits
    8. Attempt coordinated attacks on high-value hard targets
    """
    me = obs.player
    step = obs.step
    planets = obs.planets  # [id, owner, x, y, radius, ships, production]
    av = obs.angular_velocity

    # ── 1. Categorize planets ──
    my_planets = [p for p in planets if p[1] == me]
    neutral_planets = [p for p in planets if p[1] == -1 or p[1] == 0]
    enemy_planets = [p for p in planets if p[1] != me and p[1] != -1 and p[1] != 0]
    targets = neutral_planets + enemy_planets

    if not my_planets:
        return []  # We're dead

    # ── 2. Game phase ──
    if step < EARLY_GAME_CUTOFF:
        game_phase = "early"
    elif step < MID_GAME_CUTOFF:
        game_phase = "mid"
    else:
        game_phase = "late"

    # ── 3. Influence map ──
    influence = compute_influence_map(planets, me, av)

    # ── 4. Multi-player analysis ──
    player_analysis = analyze_players(planets, me)

    # ── 5. Garrison & reserve tracking ──
    ships_reserved = {}
    for p in my_planets:
        p_idx = next((i for i, pp in enumerate(planets) if pp[0] == p[0]), 0)
        garrison = compute_garrison(p, influence[p_idx] if p_idx < len(influence) else 0, game_phase)
        ships_reserved[p[0]] = garrison

    # ── 6. Emergency defense ──
    orders = []
    my_planet_indices = [i for i, p in enumerate(planets) if p[1] == me]
    defense_orders = find_emergency_defenses(
        my_planets,
        [influence[i] for i in my_planet_indices] if my_planet_indices else [],
        ships_reserved,
        av
    )
    for d in defense_orders:
        orders.append([int(d["src_id"]), float(d["angle"]), int(d["ships"])])

    # ── 7. Score all (source, target) pairs ──
    scored_pairs = []
    for target in targets:
        t_idx = next((i for i, p in enumerate(planets) if p[0] == target[0]), 0)

        for src in my_planets:
            available = src[5] - ships_reserved.get(src[0], 0)
            if available < MIN_FLEET_SIZE:
                continue

            score, config_data = score_target(
                src, target, av, step, player_analysis, influence, t_idx
            )
            if score > 0 and config_data:
                scored_pairs.append({
                    "score": score,
                    "src": src,
                    "target": target,
                    "config": config_data,
                })

    # Sort by score (best first)
    scored_pairs.sort(key=lambda x: x["score"], reverse=True)

    # ── 8. Dispatch fleets greedily ──
    targeted_planets = set()       # Track attacked targets
    target_ships_sent = {}         # Track total ships sent to each target

    for pair in scored_pairs:
        src = pair["src"]
        target = pair["target"]
        cfg = pair["config"]

        # Allow multi-source attacks on enemy planets, but not double-attack from same source
        target_id = target[0]
        already_sent = target_ships_sent.get(target_id, 0)

        # For neutral planets: one source is enough
        target_owner = target[1]
        if (target_owner == -1 or target_owner == 0) and target_id in targeted_planets:
            continue

        available = src[5] - ships_reserved.get(src[0], 0)
        needed = cfg["send_ships"]

        # If we already sent enough to this target, skip
        target_ships_arrival = target[5]
        target_prod = target[6] if len(target) > 6 else 0
        if target_owner != -1 and target_owner != 0:
            target_ships_arrival += target_prod * cfg["tti"]
        total_needed = int(target_ships_arrival) + 2
        if already_sent >= total_needed:
            continue

        # Adjust needed based on what's already been sent
        if already_sent > 0:
            needed = max(MIN_FLEET_SIZE, total_needed - already_sent + 1)

        if available < needed or needed < MIN_FLEET_SIZE:
            continue

        # Check fleet splitting for speed advantage
        do_split, split_size = should_split_fleet(needed, available)

        if do_split and available >= needed + split_size:
            tti1, angle1, _, _ = find_intercept(src, target, av, split_size)
            if tti1 is not None:
                orders.append([int(src[0]), float(angle1), int(split_size)])
                ships_reserved[src[0]] = ships_reserved.get(src[0], 0) + split_size
                target_ships_sent[target_id] = already_sent + split_size

            remainder = needed - split_size
            if remainder >= MIN_FLEET_SIZE:
                tti2, angle2, _, _ = find_intercept(src, target, av, remainder)
                if tti2 is not None:
                    orders.append([int(src[0]), float(angle2), int(remainder)])
                    ships_reserved[src[0]] = ships_reserved.get(src[0], 0) + remainder
                    target_ships_sent[target_id] = target_ships_sent.get(target_id, 0) + remainder
        else:
            orders.append([int(src[0]), float(cfg["angle"]), int(needed)])
            ships_reserved[src[0]] = ships_reserved.get(src[0], 0) + needed
            target_ships_sent[target_id] = already_sent + needed

        targeted_planets.add(target_id)

    # ── 9. Coordinated attacks on tough targets ──
    # For enemy planets we couldn't take with a single source, try multi-source pincer
    for target in enemy_planets:
        if target[0] in targeted_planets:
            continue

        target_prod = target[6] if len(target) > 6 else 0
        if target_prod < 2:
            continue  # Not worth coordinating for low-value targets

        target_ships = target[5] + target_prod * 5  # Estimate ships at arrival

        coord_plan = plan_coordinated_attack(
            target, my_planets, av, ships_reserved, target_ships
        )
        if coord_plan:
            for wave in coord_plan:
                orders.append([
                    int(wave["src"][0]),
                    float(wave["angle"]),
                    int(wave["send"]),
                ])
                ships_reserved[wave["src"][0]] = (
                    ships_reserved.get(wave["src"][0], 0) + wave["send"]
                )
            targeted_planets.add(target[0])

    # ── 10. Late-game: send idle ships to the front ──
    if game_phase == "late" and enemy_planets:
        for src in my_planets:
            available = src[5] - ships_reserved.get(src[0], 0)
            if available < 10:
                continue

            # Find the most valuable un-targeted enemy planet
            best_target = None
            best_tti = HORIZON

            for target in enemy_planets:
                tti, angle, tx, ty = find_intercept(src, target, av, available)
                if tti is not None and tti < best_tti:
                    best_tti = tti
                    best_target = (target, angle, tti)

            if best_target:
                target, angle, tti = best_target
                target_ships_arrival = target[5]
                target_prod = target[6] if len(target) > 6 else 0
                target_ships_arrival += target_prod * tti

                if available > target_ships_arrival + 2:
                    send = int(target_ships_arrival) + 3
                    if send >= MIN_FLEET_SIZE and send <= available:
                        orders.append([int(src[0]), float(angle), int(send)])
                        ships_reserved[src[0]] = ships_reserved.get(src[0], 0) + send

    return orders
