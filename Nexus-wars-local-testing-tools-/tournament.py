#!/usr/bin/env python3
"""
Nexus Wars Tournament Runner

Runs round-robin tournaments between all bots in a directory.
"""

import sys
import os
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

# Ensure we can import nexus_wars as a package
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from nexus_wars.run_match import run_match, make_runner, DEFAULT_CONFIG

def discover_bots(bots_dir):
    bots = []
    if os.path.exists(bots_dir):
        for fname in sorted(os.listdir(bots_dir)):
            if fname.endswith(".py") and not fname.startswith("__"):
                bots.append(os.path.join(bots_dir, fname))
    return bots

def run_match_pair_task(task):
    name1, spec1, name2, spec2, config, seed, rounds, verbose = task
    
    results = {"name1": name1, "name2": name2, "bot1_wins": 0, "bot2_wins": 0, "draws": 0, "bot1_scores": [], "bot2_scores": []}

    for r in range(rounds):
        seed_r = seed + r * 1000 if seed else None
        
        try:
            runners = [make_runner(spec1), make_runner(spec2)]
            replay = run_match(runners, config, seed=seed_r)
            winner = replay["info"]["winner"]
            scores = replay["info"]["scores"]

            if winner == 0:
                results["bot1_wins"] += 1
            elif winner == 1:
                results["bot2_wins"] += 1
            else:
                results["draws"] += 1
            results["bot1_scores"].append(scores[0])
            results["bot2_scores"].append(scores[1])
        finally:
            for runner in runners:
                if hasattr(runner, "close"):
                    runner.close()

        # Swap sides
        try:
            runners = [make_runner(spec2), make_runner(spec1)]
            replay = run_match(runners, config, seed=seed_r + 1 if seed_r else None)
            winner = replay["info"]["winner"]
            scores = replay["info"]["scores"]

            if winner == 1:
                results["bot1_wins"] += 1
            elif winner == 0:
                results["bot2_wins"] += 1
            else:
                results["draws"] += 1
            results["bot1_scores"].append(scores[1])
            results["bot2_scores"].append(scores[0])
        finally:
            for runner in runners:
                if hasattr(runner, "close"):
                    runner.close()

    if verbose:
        print(f"[{name1} vs {name2}] Finished {rounds} rounds (x2 sides). {name1} won {results['bot1_wins']}, {name2} won {results['bot2_wins']}.")
    
    return results

def main():
    parser = argparse.ArgumentParser(description="Run Nexus Wars round-robin tournament")
    parser.add_argument("bots_dir", nargs="?", default="bots", help="Directory containing bot .py files")
    parser.add_argument("--rounds", type=int, default=3, help="Rounds per pair (each side)")
    parser.add_argument("--seed", type=int, default=None, help="Base random seed")
    parser.add_argument("--threads", type=int, default=4, help="Number of parallel matches to run")
    parser.add_argument("--episodeSteps", type=int, default=500)
    parser.add_argument("--actTimeout", type=float, default=0.15)
    parser.add_argument("--shipSpeed", type=float, default=6.0)
    parser.add_argument("--energyCap", type=int, default=100)
    parser.add_argument("--energyRegen", type=int, default=5)
    parser.add_argument("--launchEnergyCost", type=int, default=20)
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    config = {
        "episodeSteps": args.episodeSteps,
        "actTimeout": args.actTimeout,
        "shipSpeed": args.shipSpeed,
        "energyCap": args.energyCap,
        "energyRegen": args.energyRegen,
        "launchEnergyCost": args.launchEnergyCost,
        "runTimeout": 360,
    }

    bots = discover_bots(args.bots_dir)
    all_bots = [("random", "random"), ("starter", "starter")]
    for bf in bots:
        name = os.path.splitext(os.path.basename(bf))[0]
        all_bots.append((name, bf))

    if len(all_bots) < 2:
        print("Need at least 2 bots to run a tournament!")
        sys.exit(1)

    print(f"Found {len(all_bots)} bots: {[b[0] for b in all_bots]}")
    print(f"Running {args.rounds} round(s) per pair with {args.threads} threads...\n")

    tasks = []
    for i, (name1, spec1) in enumerate(all_bots):
        for j, (name2, spec2) in enumerate(all_bots):
            if i >= j:
                continue

            runner1_spec = spec1 if spec1 in ("random", "starter") else {"command": [sys.executable, spec1], "actTimeout": args.actTimeout}
            runner2_spec = spec2 if spec2 in ("random", "starter") else {"command": [sys.executable, spec2], "actTimeout": args.actTimeout}
            
            tasks.append((name1, runner1_spec, name2, runner2_spec, config, args.seed, args.rounds, args.verbose))

    standings = defaultdict(lambda: {"wins": 0, "losses": 0, "draws": 0, "points": 0, "gf": 0, "ga": 0})
    
    total_tasks = len(tasks)
    completed_tasks = 0

    print(f"Starting {total_tasks} matchmaking pairs...")
    
    with ThreadPoolExecutor(max_workers=args.threads) as executor:
        future_to_pair = {executor.submit(run_match_pair_task, t): t for t in tasks}
        for future in as_completed(future_to_pair):
            completed_tasks += 1
            print(f"Progress: {completed_tasks}/{total_tasks} pairs completed.")
            
            try:
                result = future.result()
                name1, name2 = result["name1"], result["name2"]
                
                standings[name1]["wins"] += result["bot1_wins"]
                standings[name1]["losses"] += result["bot2_wins"]
                standings[name1]["draws"] += result["draws"]
                standings[name1]["gf"] += sum(result["bot1_scores"])
                standings[name1]["ga"] += sum(result["bot2_scores"])
                standings[name1]["points"] += result["bot1_wins"] * 3 + result["draws"]

                standings[name2]["wins"] += result["bot2_wins"]
                standings[name2]["losses"] += result["bot1_wins"]
                standings[name2]["draws"] += result["draws"]
                standings[name2]["gf"] += sum(result["bot2_scores"])
                standings[name2]["ga"] += sum(result["bot1_scores"])
                standings[name2]["points"] += result["bot2_wins"] * 3 + result["draws"]
            except Exception as e:
                print(f"Matchpair failed: {e}")

    # Print standings
    print("\n" + "=" * 80)
    print("TOURNAMENT STANDINGS")
    print("=" * 80)
    print(f"{'Rank':<5} {'Bot':<20} {'Pts':<4} {'W':<3} {'D':<3} {'L':<3} {'GF':<6} {'GA':<6} {'GD':<5}")
    print("-" * 80)

    sorted_bots = sorted(standings.items(), key=lambda x: (-x[1]["points"], -(x[1]["gf"] - x[1]["ga"])))
    
    # Also write to Markdown
    md_lines = []
    md_lines.append("# Tournament Results\n")
    md_lines.append("| Rank | Bot | Pts | W | D | L | GF | GA | GD |")
    md_lines.append("|---|---|---|---|---|---|---|---|---|")

    for rank, (name, stats) in enumerate(sorted_bots, 1):
        gd = stats["gf"] - stats["ga"]
        print(f"{rank:<5} {name:<20} {stats['points']:<4} {stats['wins']:<3} {stats['draws']:<3} {stats['losses']:<3} {stats['gf']:<6} {stats['ga']:<6} {gd:<+5}")
        md_lines.append(f"| {rank} | **{name}** | {stats['points']} | {stats['wins']} | {stats['draws']} | {stats['losses']} | {stats['gf']} | {stats['ga']} | {gd:+d} |")

    with open("tournament_results.md", "w") as f:
        f.write("\n".join(md_lines))
    print("\nResults saved to tournament_results.md")

if __name__ == "__main__":
    main()