"""
Nexus Wars match runner.

Drives the deterministic interpreter for a full match and produces a compact
replay payload (Kaggle-style steps[]). Supports two agent runner backends:

  * InProcessRunner  — wraps a Python callable (used by tests and the
                       built-in random/starter validation opponents).
  * SubprocessRunner — spawns the bot as an external process talking JSON
                       lines over stdin/stdout, optionally wrapped in nsjail
                       for untrusted-code sandboxing (zero network, time/mem
                       limits). This is the production path.

The interpreter logic is reused verbatim; only the agent-calling layer differs.
"""

import json
import math
import os
import random
import select
import subprocess
import sys
import threading
import time
from queue import Queue, Empty
from types import SimpleNamespace

from .nexus_wars import interpreter, Planet, Fleet, BOARD_SIZE, CENTER, SUN_RADIUS


# --------------------------------------------------------------------------
# Configuration + state helpers
# --------------------------------------------------------------------------
DEFAULT_CONFIG = {
    "episodeSteps": 500,
    "actTimeout": 1.0,
    "runTimeout": 360,
    "shipSpeed": 6.0,
    "energyCap": 100,
    "energyRegen": 5,
    "launchEnergyCost": 20,
    "seed": None,
}


def make_env(config):
    env = SimpleNamespace()
    env.configuration = SimpleNamespace(**config)
    env.done = False
    env.info = {}
    return env


def _build_state(num_agents):
    state = []
    for i in range(num_agents):
        s = SimpleNamespace()
        s.observation = SimpleNamespace()
        s.action = None
        s.status = "ACTIVE"
        s.reward = None
        state.append(s)
    return state


def serialize_observation(obs):
    """Convert the internal observation into a JSON-serialisable dict."""
    return {
        "planets": [list(p) for p in getattr(obs, "planets", [])],
        "fleets": [list(f) for f in getattr(obs, "fleets", [])],
        "player": getattr(obs, "player", 0),
        "angular_velocity": getattr(obs, "angular_velocity", 0.0),
        "initial_planets": [list(p) for p in getattr(obs, "initial_planets", [])],
        "next_fleet_id": getattr(obs, "next_fleet_id", 0),
        "step": getattr(obs, "step", 0),
    }


# --------------------------------------------------------------------------
# Agent runners
# --------------------------------------------------------------------------
class InProcessRunner:
    def __init__(self, func):
        self.func = func
        self.dead = False

    def act(self, obs_dict):
        if self.dead:
            return []
        try:
            action = self.func(obs_dict)
            return action if isinstance(action, list) else []
        except Exception:
            self.dead = True
            return []

    def close(self):
        pass


class SubprocessRunner:
    """Runs an external bot over a newline-delimited JSON line protocol.

    Protocol per turn:
      harness -> bot:  one JSON object (the observation) + "\n"
      bot     -> harness: one JSON array (the action) + "\n"

    If the bot exceeds `act_timeout` (seconds) for a turn, it is killed and
    subsequent turns return an empty (invalid) action. With `sandbox_cmd` set,
    the bot is launched under nsjail (zero network, time/mem limits).
    """

    def __init__(self, command, act_timeout=0.15, sandbox_cmd=None):
        self.act_timeout = act_timeout
        self.dead = False
        launch = list(sandbox_cmd) if sandbox_cmd else []
        launch += list(command)
        self.proc = subprocess.Popen(
            launch,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self._stdout_queue = Queue()
        self._stderr_queue = Queue()
        self._reader_thread = threading.Thread(target=self._read_stdout, daemon=True)
        self._reader_thread.start()
        self._stderr_thread = threading.Thread(target=self._read_stderr, daemon=True)
        self._stderr_thread.start()

    def _read_stdout(self):
        try:
            for line in iter(self.proc.stdout.readline, ''):
                if line:
                    self._stdout_queue.put(line)
        except Exception:
            pass

    def _read_stderr(self):
        try:
            for line in iter(self.proc.stderr.readline, ''):
                if line:
                    self._stderr_queue.put(line)
        except Exception:
            pass

    def act(self, obs_dict):
        if self.dead:
            return []
        try:
            self.proc.stdin.write(json.dumps(obs_dict) + "\n")
            self.proc.stdin.flush()
        except (BrokenPipeError, ValueError, OSError):
            self.dead = True
            return []

        # Wait up to act_timeout for one line of stdout.
        try:
            line = self._stdout_queue.get(timeout=self.act_timeout)
        except Empty:
            self._kill()
            return []
        if not line:
            self._kill()
            return []
        try:
            action = json.loads(line)
            if isinstance(action, dict):
                action = action.get("action", [])
            return action if isinstance(action, list) else []
        except json.JSONDecodeError:
            self._kill()
            return []

    def _kill(self):
        self.dead = True
        try:
            self.proc.kill()
        except Exception:
            pass

    def close(self):
        try:
            self.proc.stdin.close()
        except Exception:
            pass
        try:
            self.proc.kill()
        except Exception:
            pass
        try:
            self.proc.wait(timeout=2)
        except Exception:
            pass


def make_runner(spec):
    """Build a runner from a spec.

    spec may be:
      * a callable                       -> InProcessRunner
      * "random" / "starter"            -> built-in InProcessRunner
      * {"command": [...], "sandbox": [nsjail args]} -> SubprocessRunner
    """
    if callable(spec):
        return InProcessRunner(spec)
    if isinstance(spec, str):
        from .nexus_wars import agents as builtin
        return InProcessRunner(builtin[spec])
    if isinstance(spec, dict) and "command" in spec:
        return SubprocessRunner(
            spec["command"],
            act_timeout=spec.get("actTimeout", 0.15),
            sandbox_cmd=spec.get("sandbox"),
        )
    raise ValueError(f"Unsupported agent spec: {spec!r}")


# --------------------------------------------------------------------------
# Match execution
# --------------------------------------------------------------------------
def run_match(runners, config=None, seed=None):
    config = {**DEFAULT_CONFIG, **(config or {})}
    if seed is not None:
        config["seed"] = seed
    num_agents = len(runners)
    env = make_env(config)
    state = _build_state(num_agents)

    # Initialise (env.reset equivalent).
    interpreter(state, env)
    seed_used = env.info.get("seed")

    steps = []
    step = 0
    max_steps = config["episodeSteps"]
    match_start = time.time()

    while not env.done and step < max_steps:
        obs0 = state[0].observation
        obs0.step = step

        actions = []
        for i in range(num_agents):
            obs_dict = serialize_observation(state[i].observation)
            obs_dict["player"] = i
            actions.append(runners[i].act(obs_dict))
            state[i].action = actions[-1]

        interpreter(state, env)

        steps.append({
            "observation": serialize_observation(state[0].observation),
            "action": [list(a) if isinstance(a, list) else a for a in actions],
            "reward": [s.reward for s in state],
            "status": [s.status for s in state],
            "log": [],
        })

        step += 1
        if time.time() - match_start > config["runTimeout"]:
            env.done = True
            for s in state:
                if s.status == "ACTIVE":
                    s.status = "DONE"

    for r in runners:
        r.close()

    # Final result.
    scores = [0] * num_agents
    obs0 = state[0].observation
    for p in getattr(obs0, "planets", []):
        if p[1] != -1:
            scores[p[1]] += p[5]
    for f in getattr(obs0, "fleets", []):
        scores[f[1]] += f[6]

    winner = None
    reason = "steps"
    alive = set()
    for p in getattr(obs0, "planets", []):
        if p[1] != -1:
            alive.add(p[1])
    for f in getattr(obs0, "fleets", []):
        alive.add(f[1])
    if len(alive) <= 1:
        reason = "elimination"
        if alive:
            winner = next(iter(alive))
    else:
        max_score = max(scores)
        if max_score > 0 and scores.count(max_score) == 1:
            winner = scores.index(max_score)

    replay = {
        "version": "1.0",
        "engine": "nexus_wars",
        "engineVersion": "2026.1.0",
        "seed": seed_used,
        "configuration": config,
        "players": [{"playerId": i} for i in range(num_agents)],
        "steps": steps,
        "info": {
            "winner": winner,
            "reason": reason,
            "scores": scores,
            "durationMs": int((time.time() - match_start) * 1000),
            "steps": len(steps),
        },
    }
    return replay


# --------------------------------------------------------------------------
# CLI for local testing
# --------------------------------------------------------------------------
def _main(argv):
    import argparse
    ap = argparse.ArgumentParser(
        prog="nexuswars-local-testing",
        description="Run local Nexus Wars matches between bots",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run random vs starter bot
  python -m nexus_wars.run_match --agents random starter

  # Run custom bot vs starter
  python -m nexus_wars.run_match --agents "python bots/my_bot.py" starter

  # Run with custom seed and steps
  python -m nexus_wars.run_match --agents "python bots/my_bot.py" "python bots/opponent.py" --seed 42 --episodeSteps 1000

  # Run tournament (round-robin)
  python -m nexus_wars.run_match --tournament bots/ --rounds 10

  # Replay a saved match
  python -m nexus_wars.run_match --replay replay.json --render
        """)
    ap.add_argument("--agents", nargs=2, default=["random", "starter"],
                    help="Two agent specs: 'random', 'starter', 'python bot.py', or JSON spec")
    ap.add_argument("--seed", type=int, default=None, help="Random seed (default: random)")
    ap.add_argument("--out", default="replay.json", help="Output replay file")
    ap.add_argument("--episodeSteps", type=int, default=500, help="Max steps per match")
    ap.add_argument("--shipSpeed", type=float, default=6.0, help="Max fleet speed")
    ap.add_argument("--energyCap", type=int, default=100, help="Planet energy capacity")
    ap.add_argument("--energyRegen", type=int, default=5, help="Energy regen per turn")
    ap.add_argument("--launchEnergyCost", type=int, default=20, help="Energy cost per launch")
    ap.add_argument("--actTimeout", type=float, default=0.15, help="Per-turn timeout (seconds)")
    ap.add_argument("--runTimeout", type=int, default=360, help="Match timeout (seconds)")
    ap.add_argument("--tournament", metavar="DIR", help="Run round-robin tournament on bots in directory")
    ap.add_argument("--rounds", type=int, default=5, help="Rounds per pair in tournament")
    ap.add_argument("--replay", metavar="FILE", help="Replay a saved match file")
    ap.add_argument("--render", action="store_true", help="Render match steps to console")
    ap.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = ap.parse_args(argv)

    config = dict(DEFAULT_CONFIG)
    config["episodeSteps"] = args.episodeSteps
    config["shipSpeed"] = args.shipSpeed
    config["energyCap"] = args.energyCap
    config["energyRegen"] = args.energyRegen
    config["launchEnergyCost"] = args.launchEnergyCost
    config["actTimeout"] = args.actTimeout
    config["runTimeout"] = args.runTimeout

    if args.replay:
        with open(args.replay) as f:
            replay = json.load(f)
        if args.render:
            from nexus_wars import renderer
            for step_data in replay["steps"]:
                # Build a minimal state for rendering
                class MockObs:
                    def __init__(self, data):
                        self.__dict__.update(data)
                class MockState:
                    def __init__(self, data):
                        self.observation = MockObs(data)
                state = [MockState(step_data["observation"])]
                class MockEnv:
                    configuration = SimpleNamespace(**replay["configuration"])
                    done = True
                    info = {}
                env = MockEnv()
                print(renderer(state, env))
        return

    def parse_spec(s):
        s = s.strip()
        if s in ("random", "starter"):
            return s
        if s.startswith("{"):
            return json.loads(s)
        if s.startswith("python "):
            return {"command": s.split()}
        return s

    runners = [make_runner(parse_spec(a)) for a in args.agents]
    replay = run_match(runners, config, seed=args.seed)

    with open(args.out, "w") as f:
        json.dump(replay, f)

    if args.verbose or True:
        print(f"seed={replay['seed']} steps={replay['info']['steps']} "
              f"winner={replay['info']['winner']} reason={replay['info']['reason']} "
              f"scores={replay['info']['scores']} durationMs={replay['info']['durationMs']}")

    if args.render:
        from nexus_wars import renderer
        for step_data in replay["steps"]:
            class MockObs:
                def __init__(self, data):
                    self.__dict__.update(data)
            class MockState:
                def __init__(self, data):
                    self.observation = MockObs(data)
            state = [MockState(step_data["observation"])]
            class MockEnv:
                configuration = SimpleNamespace(**replay["configuration"])
                done = True
                info = {}
            env = MockEnv()
            print(renderer(state, env))


if __name__ == "__main__":
    _main(sys.argv[1:])