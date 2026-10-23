"""
Simple Example Bot — A basic template for creating your own Nexus Wars bot.

This bot demonstrates the basic structure and API. Copy this file and modify
the `act()` function to implement your strategy.

Protocol:
- Reads JSON observation from stdin (one line per turn)
- Writes JSON action array to stdout (one line per turn)

Action format: [[from_planet_id, angle_radians, num_ships], ...]
- from_planet_id: integer planet ID you own
- angle_radians: direction (0 = right/east, pi/2 = down/south, etc.)
- num_ships: integer number of ships to launch (requires ships + energy)
"""

import json
import math
import sys

LAUNCH_COST = 20


def angle_to(fx, fy, tx, ty):
    """Calculate angle from (fx, fy) to (tx, ty) in radians."""
    return math.atan2(ty - fy, tx - fx)


def distance(ax, ay, bx, by):
    """Euclidean distance between two points."""
    return math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)


def fleet_speed(ships):
    """Calculate fleet speed based on ship count (matches engine formula)."""
    if ships <= 0:
        return 0
    return min(6.0, 1.0 + 5.0 * (math.log(max(ships, 1)) / math.log(1000)) ** 1.5)


def orbital_position(planet, step, angular_velocity):
    """Compute planet position at given step (accounts for orbital motion)."""
    CENTER = 50.0
    ROTATION_LIMIT = 50.0

    dx = planet[2] - CENTER
    dy = planet[3] - CENTER
    r = math.sqrt(dx * dx + dy * dy)

    # Check if planet is orbiting (inside rotation band)
    if r + planet[4] >= ROTATION_LIMIT:
        return planet[2], planet[3]  # static planet

    base_angle = math.atan2(dy, dx)
    new_angle = base_angle + angular_velocity * step
    return CENTER + r * math.cos(new_angle), CENTER + r * math.sin(new_angle)


def act(observation):
    """
    Main bot logic. Called once per turn with the full observation.
    Returns a list of actions: [[planet_id, angle, ships], ...]
    """
    me = observation["player"]
    step = observation["step"]
    angular_vel = observation.get("angular_velocity", 0.035)
    planets = observation["planets"]
    fleets = observation.get("fleets", [])

    # My planets
    my_planets = [p for p in planets if p[1] == me]
    # Enemy planets (including neutral)
    targets = [p for p in planets if p[1] != me]
    # Enemy fleets
    enemy_fleets = [f for f in fleets if f[1] != me]

    actions = []

    for planet in my_planets:
        pid, owner, x, y, radius, ships, prod, energy, ecap, eregen = planet

        # Skip if can't launch (need ships + energy)
        if ships < 2 or energy < LAUNCH_COST:
            continue

        # Calculate threat from incoming enemy fleets
        threat = 0
        for ef in enemy_fleets:
            dist = distance(x, y, ef[2], ef[3])
            arrival = dist / fleet_speed(ef[6]) if ef[6] > 0 else 999
            if arrival < 15:  # Threat within 15 steps
                threat += ef[6]

        # Keep ships for defense
        keep = max(5, int(threat * 0.3))
        available = ships - keep
        if available < 5:
            continue

        # Find best target
        best_target = None
        best_score = -float('inf')

        for target in targets:
            tx, ty = orbital_position(target, step + 1, angular_vel)
            tdist = distance(x, y, tx, ty)
            tships = target[5]
            tprod = target[6]
            towner = target[1]

            # Scoring: prefer high production, low ships, close distance
            score = tprod * 15
            if towner == -1:  # neutral
                score += 20
            score -= tships * 0.5
            score -= tdist * 0.3

            if score > best_score:
                best_score = score
                best_target = target

        if best_target:
            tx, ty = orbital_position(best_target, step + 1, angular_vel)
            angle = angle_to(x, y, tx, ty)
            send = min(available, max(10, ships // 2))
            actions.append([pid, angle, send])

    return actions


def main():
    """Main loop: read observation from stdin, output action to stdout."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        obs = json.loads(line)
        actions = act(obs)
        sys.stdout.write(json.dumps(actions) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()