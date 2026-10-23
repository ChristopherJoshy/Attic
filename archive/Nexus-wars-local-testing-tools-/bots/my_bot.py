"""
Example Custom Bot Template for Nexus Wars

Copy this file to create your own bot. The bot reads JSON observations from stdin
and writes JSON action arrays to stdout.

Protocol:
  - Input: one JSON object per line (observation)
  - Output: one JSON array per line (actions)

Observation schema:
{
  "planets": [[id, owner, x, y, radius, ships, production, energy, energyCap, energyRegen], ...],
  "fleets": [[id, owner, x, y, angle, from_planet_id, ships, launchedStep], ...],
  "player": 0 or 1,
  "angular_velocity": 0.035,
  "initial_planets": [...],
  "next_fleet_id": 42,
  "step": 10
}

Action schema:
[[from_planet_id, angle_radians, num_ships], ...]
"""

import json
import math
import sys

# Constants (matching engine)
CENTER = 50.0
LAUNCH_COST = 20
ROTATION_RADIUS_LIMIT = 50.0


def distance(a, b):
    """Euclidean distance between two planets/fleets."""
    return math.sqrt((a[2] - b[2]) ** 2 + (a[3] - b[3]) ** 2)


def angle_to(fx, fy, tx, ty):
    """Angle from (fx, fy) to (tx, ty) in radians."""
    return math.atan2(ty - fy, tx - fx)


def fleet_speed(ships):
    """Fleet speed based on ship count (matches engine)."""
    if ships <= 0:
        return 0
    return min(6.0, 1.0 + 5.0 * (math.log(max(ships, 1)) / math.log(1000)) ** 1.5)


def orbital_pos(planet, step, angular_vel):
    """Calculate planet position at given step (for orbiting planets)."""
    dx = planet[2] - CENTER
    dy = planet[3] - CENTER
    r = math.sqrt(dx * dx + dy * dy)
    if r + planet[4] >= ROTATION_RADIUS_LIMIT:
        return planet[2], planet[3]  # static planet
    base_angle = math.atan2(dy, dx)
    new_angle = base_angle + angular_vel * step
    return CENTER + r * math.cos(new_angle), CENTER + r * math.sin(new_angle)


def evaluate_target(my_planets, target, step, angular_vel):
    """Score a target planet (higher = better)."""
    tx, ty = orbital_pos(target, step, angular_vel)
    t_ships = target[5]
    t_prod = target[6]
    t_owner = target[1]

    # Distance from closest my planet
    best_dist = min(
        (math.sqrt((p[2] - tx) ** 2 + (p[3] - ty) ** 2) for p in my_planets),
        default=999
    )

    score = t_prod * 15  # Production value
    if t_owner == -1:
        score += 20 - t_ships * 0.5  # Neutral bonus, less ships better
    elif t_owner != 0:  # Enemy (assuming we're player 0)
        score += 25 - t_ships * 1.0
    else:
        score = -999  # Don't attack own planets

    score -= best_dist * 0.4  # Distance penalty
    return score


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            obs = json.loads(line)
        except json.JSONDecodeError:
            continue

        me = obs["player"]
        step = obs["step"]
        angular_vel = obs.get("angular_velocity", 0.035)
        planets = obs["planets"]
        fleets = obs.get("fleets", [])

        my_planets = [p for p in planets if p[1] == me]
        enemy_fleets = [f for f in fleets if f[1] != me]

        actions = []

        for mp in my_planets:
            pid, owner, x, y, radius, ships, prod, energy, ecap, eregen = mp

            # Need ships and energy to launch
            if ships < 2 or energy < LAUNCH_COST:
                continue

            # Calculate defensive needs
            threat = 0
            for f in enemy_fleets:
                d = distance(mp, f)
                arrival = d / fleet_speed(f[6]) if f[6] > 0 else 999
                if arrival < 30:
                    threat += f[6]

            min_keep = max(5, int(threat * 0.3)) if threat > 0 else 3
            available = ships - min_keep
            if available < 5:
                continue

            # Find targets
            targets = []
            for t in planets:
                if t[1] == me:
                    continue
                score = evaluate_target(my_planets, t, step, angular_vel)
                if score > 0:
                    tx, ty = orbital_pos(t, step, angular_vel)
                    dist = math.sqrt((x - tx) ** 2 + (y - ty) ** 2)
                    targets.append((score, t, tx, ty, dist))

            if not targets:
                continue

            # Sort by score
            targets.sort(key=lambda x: -x[0])

            # Attack best target
            best_score, best_target, btx, bty, bdist = targets[0]
            send = min(available, max(8, ships // 2))

            if send >= 5:
                angle = angle_to(x, y, btx, bty)
                actions.append([pid, angle, send])
                available -= send

            # Optional: second target if plenty of ships
            if available >= 15 and len(targets) > 1:
                second = targets[1]
                send2 = min(available, 10)
                if send2 >= 5:
                    angle2 = angle_to(x, y, second[2], second[3])
                    actions.append([pid, angle2, send2])

        # Output actions
        sys.stdout.write(json.dumps(actions) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()