#!/usr/bin/env python3
"""Local Orbit Wars gate for the Codex heuristic submission."""

from __future__ import annotations

import argparse
import importlib.util
import pathlib
import sys
from typing import NamedTuple

from kaggle_environments import make


ROOT = pathlib.Path(__file__).resolve().parents[1]
CODEX_AGENT = ROOT / "codex" / "main.py"
V24_AGENT = ROOT / "chadmain_v24.py"


class MatchResult(NamedTuple):
    mode: str
    seed: int
    codex_seat: int
    rewards: tuple[int | float | None, ...]
    statuses: tuple[str, ...]
    steps: int

    @property
    def codex_won(self) -> bool:
        mine = self.rewards[self.codex_seat]
        if mine is None:
            return False
        return all(other is None or mine > other for idx, other in enumerate(self.rewards) if idx != self.codex_seat)


def load_agent(path: pathlib.Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot import {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules.pop(module_name, None)
    spec.loader.exec_module(module)
    agent = getattr(module, "agent", None)
    if not callable(agent):
        raise RuntimeError(f"{path} does not export callable agent")
    return agent


def hard_seeds(count: int = 100) -> list[int]:
    """Fixed spread of seeds chosen to cover map/comet/opening variety."""
    seeds = []
    value = 0xC0D3
    while len(seeds) < count:
        value = (value * 1103515245 + 12345) & 0x7FFFFFFF
        seed = 1 + (value % 1_000_000_000)
        if seed not in seeds:
            seeds.append(seed)
    return seeds


def run_match(seed: int, mode: str, codex_seat: int = 0, episode_steps: int = 500) -> MatchResult:
    if mode not in {"2p", "4p"}:
        raise ValueError("mode must be 2p or 4p")
    agent_count = 2 if mode == "2p" else 4
    if codex_seat < 0 or codex_seat >= agent_count:
        raise ValueError(f"seat {codex_seat} invalid for {mode}")

    agents = []
    for seat in range(agent_count):
        if seat == codex_seat:
            agents.append(load_agent(CODEX_AGENT, f"codex_agent_{mode}_{seed}_{seat}"))
        else:
            agents.append(load_agent(V24_AGENT, f"v24_agent_{mode}_{seed}_{seat}"))

    env = make("orbit_wars", configuration={"seed": int(seed), "episodeSteps": int(episode_steps)}, debug=True)
    env.run(agents)
    final = env.steps[-1]
    rewards = tuple(state.reward for state in final)
    statuses = tuple(state.status for state in final)
    return MatchResult(mode=mode, seed=int(seed), codex_seat=int(codex_seat), rewards=rewards, statuses=statuses, steps=len(env.steps))


def iter_gate_matches(seeds: list[int], seats: list[int], mode: str, episode_steps: int = 500):
    for seed in seeds:
        for seat in seats:
            yield run_match(seed, mode, seat, episode_steps=episode_steps)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=["2p", "4p", "both"], default="both")
    parser.add_argument("--seeds", type=int, default=100)
    parser.add_argument("--seed-start", type=int, default=None)
    parser.add_argument("--seat", type=int, default=None)
    parser.add_argument("--episode-steps", type=int, default=500)
    parser.add_argument("--stop-on-loss", action="store_true")
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args(argv)

    seeds = hard_seeds(args.seeds)
    if args.seed_start is not None:
        seeds = [int(args.seed_start + offset) for offset in range(args.seeds)]

    modes = ["2p", "4p"] if args.mode == "both" else [args.mode]
    
    # Gather all tasks to execute
    tasks = []
    for mode in modes:
        agent_count = 2 if mode == "2p" else 4
        seats = [args.seat] if args.seat is not None else list(range(agent_count))
        for seed in seeds:
            for seat in seats:
                tasks.append((seed, mode, seat))

    total = 0
    losses = []

    if args.workers > 1:
        import concurrent.futures
        with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as executor:
            future_to_task = {
                executor.submit(run_match, seed, mode, seat, episode_steps=args.episode_steps): (seed, mode, seat)
                for seed, mode, seat in tasks
            }
            try:
                for future in concurrent.futures.as_completed(future_to_task):
                    total += 1
                    result = future.result()
                    status = "WIN" if result.codex_won else "LOSS"
                    print(
                        f"{status} mode={result.mode} seed={result.seed} seat={result.codex_seat} "
                        f"rewards={list(result.rewards)} statuses={list(result.statuses)} steps={result.steps}",
                        flush=True,
                    )
                    if not result.codex_won:
                        losses.append(result)
                        if args.stop_on_loss:
                            print(f"stopped after first loss out of {total} matches", flush=True)
                            # Attempt to cancel any remaining futures
                            for f in future_to_task:
                                f.cancel()
                            executor.shutdown(wait=False)
                            return 1
            except KeyboardInterrupt:
                print("Interrupted! Shutting down workers...", flush=True)
                for f in future_to_task:
                    f.cancel()
                executor.shutdown(wait=False)
                raise
    else:
        for seed, mode, seat in tasks:
            result = run_match(seed, mode, seat, episode_steps=args.episode_steps)
            total += 1
            status = "WIN" if result.codex_won else "LOSS"
            print(
                f"{status} mode={result.mode} seed={result.seed} seat={result.codex_seat} "
                f"rewards={list(result.rewards)} statuses={list(result.statuses)} steps={result.steps}",
                flush=True,
            )
            if not result.codex_won:
                losses.append(result)
                if args.stop_on_loss:
                    print(f"stopped after first loss out of {total} matches", flush=True)
                    return 1

    print(f"matches={total} losses={len(losses)}", flush=True)
    return 0 if not losses else 1


if __name__ == "__main__":
    raise SystemExit(main())
