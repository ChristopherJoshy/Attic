"""
Nexus Wars engine — deterministic 1v1 interpreter.

Forked from Kaggle's `orbit_wars` (Apache-2.0) with the following deliberate
changes vs upstream:
  * CANONICAL COORDINATES: planets/fleets store [id, owner, x, y, ...] with
    x = horizontal, y = vertical everywhere. Upstream stored (y, x) in the
    raw record while the Planet namedtuple expected (x, y) — a latent swap
    that made angle 0 move "down". Fixed.
  * OFF-BY-ONE TERMINATION: terminates at step >= episodeSteps - 1 (every
    step 0..episodeSteps-1 resolves). Upstream used episodeSteps - 2.
  * COMETS REMOVED: the comet spawn/expiry race condition was a top reported
    upstream bug and is unnecessary (energy is our differentiator).
  * ENERGY SYSTEM ADDED: each planet has energy/energyCap/energyRegen;
    launching a fleet costs flat launchEnergyCost from the planet; insufficient
    energy => the launch is rejected cleanly (no fleet, recorded in step log).

The interpreter is pure Python (no kaggle_environments dependency) so it can be
run, tested, and sandboxed anywhere a Linux/Python runtime exists.
"""

import math
import os
import random
from collections import namedtuple
from types import SimpleNamespace

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------
BOARD_SIZE = 100.0
CENTER = BOARD_SIZE / 2.0
SUN_RADIUS = 10.0
ROTATION_RADIUS_LIMIT = 50.0
PLANET_CLEARANCE = 7
MIN_PLANET_GROUPS = 5
MAX_PLANET_GROUPS = 10
MIN_STATIC_GROUPS = 3

# Energy (overridable via configuration)
DEFAULT_ENERGY_CAP = 100
DEFAULT_ENERGY_REGEN = 5
DEFAULT_LAUNCH_ENERGY_COST = 20

# Planet record: [id, owner, x, y, radius, ships, production,
#                 energy, energyCap, energyRegen]
Planet = namedtuple(
    "Planet",
    ["id", "owner", "x", "y", "radius", "ships", "production",
     "energy", "energyCap", "energyRegen"],
)
# Fleet record: [id, owner, x, y, angle, from_planet_id, ships, launchedStep]
Fleet = namedtuple(
    "Fleet",
    ["id", "owner", "x", "y", "angle", "from_planet_id", "ships", "launchedStep"],
)


# --------------------------------------------------------------------------
# Geometry (continuous collision — kept from upstream, proven correct)
# --------------------------------------------------------------------------
def distance(p1, p2):
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


def point_to_segment_distance(p, v, w):
    """Minimum distance from point p to line segment v-w."""
    l2 = (v[0] - w[0]) ** 2 + (v[1] - w[1]) ** 2
    if l2 == 0.0:
        return distance(p, v)
    t = max(0, min(1, ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2))
    projection = (v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1]))
    return distance(p, projection)


def swept_pair_hit(A, B, P0, P1, r):
    """True iff a fleet moving A->B and a planet moving P0->P1 come within r
    of each other for some t in [0, 1]. Both segments are linearised over the
    tick (planet rotation is linearised to its chord)."""
    d0x, d0y = A[0] - P0[0], A[1] - P0[1]
    dvx = (B[0] - A[0]) - (P1[0] - P0[0])
    dvy = (B[1] - A[1]) - (P1[1] - P0[1])
    a = dvx * dvx + dvy * dvy
    b = 2.0 * (d0x * dvx + d0y * dvy)
    c = d0x * d0x + d0y * d0y - r * r
    if a < 1e-12:
        return c <= 0.0
    disc = b * b - 4.0 * a * c
    if disc < 0.0:
        return False
    sq = math.sqrt(disc)
    t1 = (-b - sq) / (2.0 * a)
    t2 = (-b + sq) / (2.0 * a)
    return t2 >= 0.0 and t1 <= 1.0


# --------------------------------------------------------------------------
# Map generation (seeded, 4-fold symmetric, canonical coordinates)
# --------------------------------------------------------------------------
def generate_planets(rng=None, energy_cap=DEFAULT_ENERGY_CAP,
                     energy_regen=DEFAULT_ENERGY_REGEN):
    if rng is None:
        rng = random
    planets = []
    num_q1 = rng.randint(MIN_PLANET_GROUPS, MAX_PLANET_GROUPS)
    id_counter = 0

    def make_group(x, y, r, ships, prod):
        """Four 4-fold symmetric copies. x = horizontal, y = vertical."""
        e = energy_cap
        er = energy_regen
        return [
            [id_counter,     -1, x,               y,          r, ships, prod, e, e, er],
            [id_counter + 1, -1, BOARD_SIZE - x,  y,          r, ships, prod, e, e, er],
            [id_counter + 2, -1, x,               BOARD_SIZE - y, r, ships, prod, e, e, er],
            [id_counter + 3, -1, BOARD_SIZE - x,  BOARD_SIZE - y, r, ships, prod, e, e, er],
        ]

    # Phase 1: guaranteed static planet groups (outside the rotation band).
    static_groups = 0
    for _ in range(5000):
        if static_groups >= MIN_STATIC_GROUPS:
            break
        prod = rng.randint(1, 5)
        r = 1 + math.log(prod)
        angle = rng.uniform(0, math.pi / 2)
        min_orbital = ROTATION_RADIUS_LIMIT - r
        max_orbital = (BOARD_SIZE - CENTER - r) / max(math.cos(angle), math.sin(angle))
        if min_orbital > max_orbital:
            continue
        orbital_r = rng.uniform(min_orbital, max_orbital)
        x = CENTER + orbital_r * math.cos(angle)
        y = CENTER + orbital_r * math.sin(angle)

        if x + r > BOARD_SIZE or x - r < 0 or y + r > BOARD_SIZE or y - r < 0:
            continue
        if (BOARD_SIZE - x) - r < 0 or (BOARD_SIZE - y) - r < 0:
            continue
        if (x - CENTER) < r + 5 or (y - CENTER) < r + 5:
            continue

        ships = min(rng.randint(5, 99), rng.randint(5, 99))
        temp_planets = make_group(x, y, r, ships, prod)

        valid = True
        for tp in temp_planets:
            for p in planets:
                if distance((p[2], p[3]), (tp[2], tp[3])) < p[4] + tp[4] + PLANET_CLEARANCE:
                    valid = False
                    break
            if not valid:
                break

        if valid:
            planets.extend(temp_planets)
            id_counter += 4
            static_groups += 1

    # Phase 2: fill remaining groups (some orbiting, some static).
    attempts = 0
    max_attempts = 5000
    has_orbiting = False
    while len(planets) < num_q1 * 4 or (not has_orbiting and attempts < max_attempts):
        attempts += 1
        if attempts >= max_attempts:
            break
        prod = rng.randint(1, 5)
        r = 1 + math.log(prod)
        x = rng.uniform(CENTER + 15, BOARD_SIZE - r - 5)
        y = rng.uniform(CENTER + 15, BOARD_SIZE - r - 5)
        orbital_radius = distance((x, y), (CENTER, CENTER))

        if orbital_radius < SUN_RADIUS + r + 10:
            continue

        if orbital_radius + r >= ROTATION_RADIUS_LIMIT:
            if x + r > BOARD_SIZE or x - r < 0 or y + r > BOARD_SIZE or y - r < 0:
                continue

        valid = True
        ships = rng.randint(5, 30)
        temp_planets = make_group(x, y, r, ships, prod)

        for tp in temp_planets:
            tp_orbital = distance((tp[2], tp[3]), (CENTER, CENTER))
            tp_is_rotating = tp_orbital + tp[4] < ROTATION_RADIUS_LIMIT

            for p in planets:
                p_orbital = distance((p[2], p[3]), (CENTER, CENTER))
                p_is_rotating = p_orbital + p[4] < ROTATION_RADIUS_LIMIT

                if distance((p[2], p[3]), (tp[2], tp[3])) < p[4] + tp[4] + PLANET_CLEARANCE:
                    valid = False
                    break

                if tp_is_rotating != p_is_rotating:
                    if abs(tp_orbital - p_orbital) < tp[4] + p[4] + PLANET_CLEARANCE:
                        valid = False
                        break

            if not valid:
                break

        if valid:
            if orbital_radius + r < ROTATION_RADIUS_LIMIT:
                has_orbiting = True
            planets.extend(temp_planets)
            id_counter += 4

    return planets


def resolve_episode_seed(env):
    """Return a deterministic seed, stashing it on env.info so it is hidden
    from agents but recorded in the replay."""
    seed = getattr(env.configuration, "seed", None)
    if seed is None:
        seed = int.from_bytes(os.urandom(4), "big") & 0x7FFFFFFF
    env.info["seed"] = seed
    return seed


def get(d, key, default):
    if isinstance(d, dict):
        return d.get(key, default)
    return getattr(d, key, default)


# --------------------------------------------------------------------------
# Interpreter
# --------------------------------------------------------------------------
def interpreter(state, env):
    configuration = env.configuration
    num_agents = len(state)
    obs0 = state[0].observation

    # Initialise game state during env.reset() (all agents temporarily
    # INACTIVE). Scrub the seed from configuration before any agent.act().
    if not hasattr(obs0, "planets") or not obs0.planets:
        seed = resolve_episode_seed(env)
        init_rng = random.Random(seed)

        energy_cap = getattr(configuration, "energyCap", DEFAULT_ENERGY_CAP)
        energy_regen = getattr(configuration, "energyRegen", DEFAULT_ENERGY_REGEN)

        angular_velocity = init_rng.uniform(0.025, 0.05)
        obs0.angular_velocity = angular_velocity
        obs0.planets = generate_planets(init_rng, energy_cap, energy_regen)
        obs0.initial_planets = [p.copy() for p in obs0.planets]
        obs0.fleets = []
        obs0.next_fleet_id = 0
        obs0.step = 0

        num_groups = len(obs0.planets) // 4
        if num_groups > 0:
            home_group = init_rng.randint(0, num_groups - 1)
            base = home_group * 4
            if num_agents == 2:
                obs0.planets[base][1] = 0
                obs0.planets[base][5] = 10
                obs0.planets[base + 3][1] = 1
                obs0.planets[base + 3][5] = 10
            elif num_agents == 4:
                for j in range(4):
                    obs0.planets[base + j][1] = j
                    obs0.planets[base + j][5] = 10

        for i in range(num_agents):
            state[i].observation.player = i
            if i > 0:
                state[i].observation.angular_velocity = obs0.angular_velocity
                state[i].observation.planets = obs0.planets
                state[i].observation.initial_planets = obs0.initial_planets
                state[i].observation.fleets = obs0.fleets
                state[i].observation.next_fleet_id = obs0.next_fleet_id
        return state

    if env.done:
        return state

    step = get(obs0, "step", 0)
    launch_cost = getattr(configuration, "launchEnergyCost", DEFAULT_LAUNCH_ENERGY_COST)

    # 0. Fleet launch (with energy check). Rejections are recorded in `logs`.
    logs = [[] for _ in range(num_agents)]

    def process_moves(player_id, action):
        if not action or not isinstance(action, list):
            return
        for move in action:
            if len(move) != 3:
                continue
            from_id, angle, ships = move
            ships = int(ships)
            from_planet = next((p for p in obs0.planets if p[0] == from_id), None)
            if from_planet and from_planet[1] == player_id:
                if ships <= 0:
                    continue
                if from_planet[5] < ships:
                    logs[player_id].append(
                        {"type": "reject", "from": from_id, "reason": "insufficient_ships"})
                    continue
                if from_planet[7] < launch_cost:
                    logs[player_id].append(
                        {"type": "reject", "from": from_id, "reason": "insufficient_energy"})
                    continue
                from_planet[5] -= ships
                from_planet[7] -= launch_cost
                start_x = from_planet[2] + math.cos(angle) * (from_planet[4] + 0.1)
                start_y = from_planet[3] + math.sin(angle) * (from_planet[4] + 0.1)
                obs0.fleets.append(
                    [obs0.next_fleet_id, player_id, start_x, start_y,
                     angle, from_id, ships, step])
                obs0.next_fleet_id += 1

    for i in range(num_agents):
        process_moves(i, state[i].action)

    # 1. Production + energy regen for owned planets.
    for planet in obs0.planets:
        if planet[1] != -1:
            planet[5] += planet[6]
            planet[7] = min(planet[8], planet[7] + planet[9])

    # 2. Pre-compute each planet's end-of-tick position (continuous sweep).
    angular_velocity = obs0.angular_velocity
    initial_by_id = {p[0]: p for p in obs0.initial_planets}
    planet_paths = {}
    for planet in obs0.planets:
        old_pos = (planet[2], planet[3])
        new_pos = old_pos
        initial_p = initial_by_id.get(planet[0])
        if initial_p is not None:
            dx = initial_p[2] - CENTER
            dy = initial_p[3] - CENTER
            r = math.sqrt(dx ** 2 + dy ** 2)
            if r + planet[4] < ROTATION_RADIUS_LIMIT:
                initial_angle = math.atan2(dy, dx)
                current_angle = initial_angle + angular_velocity * step
                new_pos = (
                    CENTER + r * math.cos(current_angle),
                    CENTER + r * math.sin(current_angle),
                )
        planet_paths[planet[0]] = (old_pos, new_pos)

    # 3. Fleet movement (continuous swept-pair collision).
    max_speed = configuration.shipSpeed
    fleets_to_remove = []
    combat_lists = {p[0]: [] for p in obs0.planets}

    for fleet in obs0.fleets:
        angle = fleet[4]
        ships = fleet[6]
        if ships <= 0:
            fleets_to_remove.append(fleet)
            continue
        speed = 1.0 + (max_speed - 1.0) * (math.log(ships) / math.log(1000)) ** 1.5
        speed = min(speed, max_speed)
        old_pos = (fleet[2], fleet[3])
        fleet[2] += math.cos(angle) * speed
        fleet[3] += math.sin(angle) * speed
        new_pos = (fleet[2], fleet[3])

        # Planets checked FIRST so fast fleets that overshoot bounds/sun
        # still get credit for hitting a planet along the way.
        hit_planet = False
        for planet in obs0.planets:
            path = planet_paths.get(planet[0])
            if path is None:
                continue
            p_old, p_new = path
            if swept_pair_hit(old_pos, new_pos, p_old, p_new, planet[4]):
                combat_lists[planet[0]].append(fleet)
                fleets_to_remove.append(fleet)
                hit_planet = True
                break
        if hit_planet:
            continue

        if not (0 <= fleet[2] <= BOARD_SIZE and 0 <= fleet[3] <= BOARD_SIZE):
            fleets_to_remove.append(fleet)
            continue

        if point_to_segment_distance((CENTER, CENTER), old_pos, new_pos) < SUN_RADIUS:
            fleets_to_remove.append(fleet)
            continue

    # 4. Apply planet movement.
    for planet in obs0.planets:
        path = planet_paths.get(planet[0])
        if path is not None:
            planet[2], planet[3] = path[1]

    obs0.fleets = [f for f in obs0.fleets if f not in fleets_to_remove]

    # 5. Combat resolution — SUM all attacking fleets per player.
    for pid, planet_fleets in combat_lists.items():
        planet = next((p for p in obs0.planets if p[0] == pid), None)
        if not planet or not planet_fleets:
            continue

        player_ships = {}
        for fleet in planet_fleets:
            owner = fleet[1]
            player_ships[owner] = player_ships.get(owner, 0) + fleet[6]

        if not player_ships:
            continue

        sorted_players = sorted(player_ships.items(), key=lambda it: it[1], reverse=True)
        top_player, top_ships = sorted_players[0]

        if len(sorted_players) > 1:
            survivor_ships = top_ships - sorted_players[1][1]
            if top_ships == sorted_players[1][1]:
                survivor_ships = 0
            survivor_owner = top_player if survivor_ships > 0 else -1
        else:
            survivor_owner = top_player
            survivor_ships = top_ships

        if survivor_ships > 0:
            if planet[1] == survivor_owner:
                planet[5] += survivor_ships
            else:
                planet[5] -= survivor_ships
                if planet[5] < 0:
                    planet[1] = survivor_owner
                    planet[5] = abs(planet[5])

    for i in range(1, num_agents):
        state[i].observation.planets = obs0.planets
        state[i].observation.initial_planets = obs0.initial_planets
        state[i].observation.fleets = obs0.fleets
        state[i].observation.next_fleet_id = obs0.next_fleet_id
        state[i].observation.angular_velocity = obs0.angular_velocity

    # 6. Termination — FIXED off-by-one: every step 0..episodeSteps-1 resolves.
    terminated = False
    step = get(obs0, "step", 0)
    if step >= configuration.episodeSteps - 1:
        terminated = True

    alive_players = set()
    for p in obs0.planets:
        if p[1] != -1:
            alive_players.add(p[1])
    for f in obs0.fleets:
        alive_players.add(f[1])

    if len(alive_players) <= 1:
        terminated = True

    if terminated:
        for s in state:
            s.status = "DONE"

        scores = [0] * num_agents
        for p in obs0.planets:
            if p[1] != -1:
                scores[p[1]] += p[5]
        for f in obs0.fleets:
            scores[f[1]] += f[6]

        max_score = max(scores)
        if max_score > 0 and scores.count(max_score) == 1:
            winner = scores.index(max_score)
            for i in range(num_agents):
                state[i].reward = 1 if i == winner else -1
        else:
            for i in range(num_agents):
                state[i].reward = 0  # draw / no contest

    return state


# --------------------------------------------------------------------------
# Renderer / built-in agents (used as validation opponents)
# --------------------------------------------------------------------------
def renderer(state, env):
    obs = state[0].observation
    out = f"Step {get(obs, 'step', 0)}\n"
    out += "Planets:\n"
    for p in get(obs, "planets", []):
        out += (f"  ID: {p[0]}, Owner: {p[1]}, Pos: ({p[2]:.1f}, {p[3]:.1f}), "
                f"R: {p[4]:.1f}, Ships: {p[5]}, Prod: {p[6]}, "
                f"Energy: {p[7]:.0f}/{p[8]:.0f}\n")
    out += "Fleets:\n"
    for f in get(obs, "fleets", []):
        out += (f"  ID: {f[0]}, Owner: {f[1]}, Pos: ({f[2]:.1f}, {f[3]:.1f}), "
                f"Angle: {f[4]:.2f}, Ships: {f[6]}\n")
    return out


def random_agent(obs):
    moves = []
    player = obs.get("player", 0)
    planets = [Planet(*p) for p in obs.get("planets", [])]
    for p in planets:
        if p.owner == player and p.ships > 0:
            angle = random.uniform(0, 2 * math.pi)
            ships = p.ships // 2
            if ships >= 20:
                moves.append([p.id, angle, ships])
    return moves


def starter_agent(obs):
    moves = []
    player = obs.get("player", 0)
    planets = [Planet(*p) for p in obs.get("planets", [])]

    static_targets = []
    for p in planets:
        orbital_r = math.sqrt((p.x - CENTER) ** 2 + (p.y - CENTER) ** 2)
        if orbital_r + p.radius >= ROTATION_RADIUS_LIMIT and p.owner != player:
            static_targets.append(p)

    my_planets = [p for p in planets if p.owner == player]
    for mp in my_planets:
        if mp.ships <= 0:
            continue
        closest = None
        min_dist = float("inf")
        for t in static_targets:
            dist = math.sqrt((mp.x - t.x) ** 2 + (mp.y - t.y) ** 2)
            if dist < min_dist:
                min_dist = dist
                closest = t
        if closest:
            angle = math.atan2(closest.y - mp.y, closest.x - mp.x)
            ships = mp.ships // 2
            if ships >= 20:
                moves.append([mp.id, angle, ships])
    return moves


agents = {"random": random_agent, "starter": starter_agent}

__all__ = [
    "BOARD_SIZE", "CENTER", "SUN_RADIUS", "ROTATION_RADIUS_LIMIT",
    "DEFAULT_ENERGY_CAP", "DEFAULT_ENERGY_REGEN", "DEFAULT_LAUNCH_ENERGY_COST",
    "Planet", "Fleet", "distance", "point_to_segment_distance", "swept_pair_hit",
    "generate_planets", "interpreter", "renderer", "random_agent", "starter_agent",
    "agents",
]