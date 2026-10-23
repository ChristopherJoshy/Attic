"""
Viper — Aggressive expansion bot.

Strategy:
- Rapidly expand to neutral planets using small fast fleets
- Coordinate multi-fleet strikes on enemy planets
- Prioritize high-production targets
- Dynamic threat assessment: defend if losing, attack if winning
- Uses fleet speed mechanics (larger fleets are faster)
- Energy-aware: never waste launches on low-energy planets
"""
import json
import math
import sys

BOARD = 100.0
CENTER = 50.0
SUN_RADIUS = 10.0
LAUNCH_COST = 20


def dist(a, b):
    return math.sqrt((a[2] - b[2]) ** 2 + (a[3] - b[3]) ** 2)


def angle_to(fx, fy, tx, ty):
    return math.atan2(ty - fy, tx - fx)


def fleet_speed(ships):
    if ships <= 0:
        return 0
    return min(6.0, 1.0 + 5.0 * (math.log(max(ships, 1)) / math.log(1000)) ** 1.5)


def steps_to_arrive(src, dst, ships):
    d = dist(src, dst)
    spd = fleet_speed(ships)
    return d / spd if spd > 0 else 999


def orbital_pos(planet, step, angular_vel):
    dx = planet[2] - CENTER
    dy = planet[3] - CENTER
    r = math.sqrt(dx * dx + dy * dy)
    if r + planet[4] >= 50.0:
        return planet[2], planet[3]
    base_angle = math.atan2(dy, dx)
    new_angle = base_angle + angular_vel * step
    return CENTER + r * math.cos(new_angle), CENTER + r * math.sin(new_angle)


def score_target(my_planets, target, step, angular_vel, me):
    tx, ty = orbital_pos(target, step, angular_vel)
    tships = target[5]
    tprod = target[6]
    owner = target[1]
    best_dist = min((math.sqrt((p[2] - tx) ** 2 + (p[3] - ty) ** 2) for p in my_planets), default=999)
    arrival = steps_to_arrive(
        (0, 0, my_planets[0][2], my_planets[0][3]), (0, 0, tx, ty), 20
    )
    if best_dist < 1:
        best_dist = 1
    score = tprod * 15 + tships * (-3 if owner != me and owner != -1 else 0)
    if owner == -1:
        score += 20
    score -= best_dist * 0.5
    return score


def defend_priority(my_planet, enemy_fleets, me):
    threats = []
    for f in enemy_fleets:
        d = dist(my_planet, f)
        arrival = d / fleet_speed(f[6]) if f[6] > 0 else 999
        if arrival < 30:
            threats.append((f[6], arrival))
    if not threats:
        return 0
    total_threat = sum(t[0] for t in threats)
    return total_threat


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        obs = json.loads(line)
        me = obs["player"]
        step = obs["step"]
        angular_vel = obs.get("angular_velocity", 0.035)
        planets = obs["planets"]
        fleets = obs.get("fleets", [])

        my_planets = [p for p in planets if p[1] == me]
        enemy_fleets = [f for f in fleets if f[1] != me]
        my_fleets = [f for f in fleets if f[1] == me]

        actions = []

        for mp in my_planets:
            pid, owner, x, y, radius, ships, prod, energy, ecap, eregen = mp

            if ships < 2 or energy < LAUNCH_COST:
                continue

            threat = defend_priority(mp, enemy_fleets, me)
            min_keep = max(5, int(threat * 0.3)) if threat > 0 else 3
            available = ships - min_keep
            if available < 5:
                continue

            targets = [p for p in planets if p[1] != me]
            if not targets:
                continue

            scored = []
            for t in targets:
                tx, ty = orbital_pos(t, step, angular_vel)
                d = math.sqrt((x - tx) ** 2 + (y - ty) ** 2)
                tships = t[5]
                tprod = t[6]
                towner = t[1]
                if towner == me:
                    continue
                s = tprod * 12
                if towner == -1:
                    s += 15 - tships * 0.5
                else:
                    s += 25 - tships * 1.0
                s -= d * 0.4
                scored.append((s, t, tx, ty, d))

            scored.sort(key=lambda x: -x[0])

            if not scored:
                continue

            best_score, best_target, btx, bty, bdist = scored[0]

            if len(scored) > 1 and available >= 30:
                second = scored[1]
                second_ships = min(available // 3, second[3] if len(second) > 3 else 15)
                if second_ships >= 8:
                    s_angle = angle_to(x, y, second[2], second[3])
                    actions.append([pid, s_angle, second_ships])
                    available -= second_ships

            send = min(available, max(8, ships // 2))
            if send > available:
                send = available

            angle = angle_to(x, y, btx, bty)
            actions.append([pid, angle, send])

            if available - send >= 15 and len(scored) > 2:
                third = scored[2]
                t3_ships = min(available - send, 12)
                if t3_ships >= 6:
                    t3_angle = angle_to(x, y, third[2], third[3])
                    actions.append([pid, t3_angle, t3_ships])

        sys.stdout.write(json.dumps(actions) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
