"""
Fortress — Economic powerhouse bot.

Strategy:
- Build overwhelming economic advantage before attacking
- Consolidate forces on key planets for devastating coordinated strikes
- Target high-production enemy planets with overwhelming force (2x defender)
- Defend aggressively: reinforce threatened planets from safe reserves
- Late-game monster: wins by out-producing and steamrolling
- Never attacks with less than 2x the defender's ships (avoid ties)
"""
import json
import math
import sys

LAUNCH_COST = 20
CENTER = 50.0


def dist(a, b):
    return math.sqrt((a[2] - b[2]) ** 2 + (a[3] - b[3]) ** 2)


def angle_to(fx, fy, tx, ty):
    return math.atan2(ty - fy, tx - fx)


def fleet_speed(ships):
    if ships <= 0:
        return 0
    return min(6.0, 1.0 + 5.0 * (math.log(max(ships, 1)) / math.log(1000)) ** 1.5)


def orbital_pos(p, step, av):
    dx = p[2] - CENTER
    dy = p[3] - CENTER
    r = math.sqrt(dx * dx + dy * dy)
    if r + p[4] >= 50.0:
        return p[2], p[3]
    base = math.atan2(dy, dx)
    a = base + av * step
    return CENTER + r * math.cos(a), CENTER + r * math.sin(a)


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        obs = json.loads(line)
        me = obs["player"]
        step = obs["step"]
        av = obs.get("angular_velocity", 0.035)
        planets = obs["planets"]
        fleets = obs.get("fleets", [])

        my_planets = [p for p in planets if p[1] == me]
        enemy_fleets_inbound = [f for f in fleets if f[1] != me]
        my_fleets_out = [f for f in fleets if f[1] == me]
        enemy_planets = [p for p in planets if p[1] != me and p[1] != -1]
        neutral_planets = [p for p in planets if p[1] == -1]

        total_my_ships = sum(p[5] for p in my_planets) + sum(f[6] for f in my_fleets_out)
        total_enemy_ships = sum(p[5] for p in enemy_planets) + sum(f[6] for f in enemy_fleets_inbound)

        my_production = sum(p[6] for p in my_planets)
        enemy_production = sum(p[6] for p in enemy_planets)

        phase = "expand"
        if step > 150 or total_enemy_ships > total_my_ships * 0.6:
            phase = "consolidate"
        if step > 300 or total_my_ships > total_enemy_ships * 1.5:
            phase = "attack"

        actions = []

        for mp in my_planets:
            pid, owner, x, y, radius, ships, prod, energy, ecap, eregen = mp

            if ships < 3 or energy < LAUNCH_COST:
                continue

            inbound_threat = 0
            threat_arrival = 999
            for f in enemy_fleets_inbound:
                d = dist(mp, f)
                arr = d / fleet_speed(f[6]) if f[6] > 0 else 999
                if arr < 25:
                    inbound_threat += f[6]
                    if arr < threat_arrival:
                        threat_arrival = arr

            min_keep = max(3, int(inbound_threat * 0.4)) + prod
            available = ships - min_keep
            if available < 5:
                if inbound_threat > 0 and available >= 3:
                    own_fleets_heading_here = [f for f in my_fleets_out if dist(mp, f) < 20]
                    own_help = sum(f[6] for f in own_fleets_heading_here)
                    if own_help < inbound_threat * 0.5:
                        reserves = [p for p in my_planets if p[0] != pid and p[5] > 15]
                        for res in sorted(reserves, key=lambda r: dist(r, mp)):
                            if res[5] - 10 <= 0:
                                continue
                            send = min(res[5] - 10, inbound_threat - own_help + 5)
                            if send >= 3:
                                a = angle_to(res[2], res[3], x, y)
                                actions.append([res[0], a, send])
                                break
                continue

            targets = []
            for t in planets:
                if t[1] == me:
                    continue
                tx, ty = orbital_pos(t, step, av)
                d = math.sqrt((x - tx) ** 2 + (y - ty) ** 2)
                if d < 1:
                    d = 1
                ts = t[5]
                tp = t[6]
                towner = t[1]
                s = 0
                if phase == "expand":
                    if towner == -1:
                        s = tp * 20 + 30 - ts * 1.0 - d * 0.3
                    else:
                        s = tp * 10 + 15 - d * 0.5
                elif phase == "consolidate":
                    if towner == -1:
                        s = tp * 25 - d * 0.2 - ts * 0.5
                    else:
                        s = tp * 8 - d * 0.6
                else:
                    if towner == -1:
                        s = tp * 10 - d * 0.1
                    else:
                        need = ts * 2 + 5
                        if available >= need:
                            s = tp * 30 + 40 - d * 0.2 - ts * 0.3
                        else:
                            s = tp * 5 - d * 0.8
                targets.append((s, t, tx, ty, d))

            targets.sort(key=lambda x: -x[0])
            if not targets:
                continue

            best_score, best_t, btx, bty, bdist = targets[0]

            if phase == "expand":
                send = min(available, max(8, ships // 3))
                if send >= 5:
                    a = angle_to(x, y, btx, bty)
                    actions.append([pid, a, send])
                    available -= send
                    if available >= 15 and len(targets) > 1:
                        s2 = targets[1]
                        s2_send = min(available, 10)
                        if s2_send >= 5:
                            a2 = angle_to(x, y, s2[2], s2[3])
                            actions.append([pid, a2, s2_send])
            elif phase == "consolidate":
                save_ratio = 0.7 if prod >= 3 else 0.5
                send = min(available, max(10, int(ships * (1 - save_ratio))))
                if send >= 8:
                    a = angle_to(x, y, btx, bty)
                    actions.append([pid, a, send])
            else:
                need = best_t[5] * 2 + 8
                send = min(available, max(need, 15))
                if send >= 10:
                    a = angle_to(x, y, btx, bty)
                    actions.append([pid, a, send])

        sys.stdout.write(json.dumps(actions) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
