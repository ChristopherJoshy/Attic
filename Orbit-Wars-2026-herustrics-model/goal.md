# Orbit Wars 2026 Heuristic Agent Handoff

## Pair This File With `/goal`

Use this file as the context document for a new Codex session on another laptop. The intended `/goal` objective should be:

```text
Continue the Orbit Wars 2026 heuristic-only single-file agent work from this repository. Preserve the full top-10 objective. Start by reading goal.md, then inspect main.py and the backed-up replays/logs. Fix the current known fast-path/deadline bug, validate with saved replay diagnostics and full 500-step local matches against chadmain_v24.py, commit progress, and only submit to Kaggle after strong evidence. Do not convert this into RL/model work; keep submission as main.py.
```

The next Codex should not assume the current `main.py` is submission-ready. It is a backed-up candidate with evidence-driven edits that still need validation.

Immediate first actions for the next laptop:

```bash
git status --short --branch
python -m py_compile main.py
python -m unittest tests/test_codex_contract.py
python - <<'PY'
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("agent", "main.py")
mod = importlib.util.module_from_spec(spec)
sys.modules["agent"] = mod
spec.loader.exec_module(mod)
data = json.load(open("workspace_backup/monitor_53271842/replays/episode-78458634-replay.json"))
obs = data["steps"][50][2]["observation"]
print(mod.agent(obs))
PY
```

Expected diagnostic target: for `episode-78458634`, player 2, turn 50, `agent(obs)` should emit at least one useful runaway-response move under normal deadline behavior. If it returns `[]`, fix that before broader sweeps.

## Objective

Build a single-file, heuristic-only Orbit Wars Kaggle agent that can reach top 10.

Hard gate before a serious final submission:

- `main.py` must export `agent(obs, config=None)`.
- No model/RL/hybrid dependency. Pure heuristic logic only.
- It must beat `chadmain_v24.py` on 100 hard seeds in 2P.
- It must beat 3x `chadmain_v24.py` on 100 hard seeds in 4P.
- Full-horizon validation means `episodeSteps=500`; short checks are diagnostic only.
- Runtime must stay safely under the Kaggle 1 second act timeout. Current planner is too close to the limit on hard 4P turns.

## Repo Layout

- `main.py`: current Codex submission file. This is the file Kaggle should receive.
- `scripts/benchmark_codex.py`: local benchmark helper adjusted for this cloned repo layout.
- `tests/test_codex_contract.py`: compile/API/sun-collision contract checks adjusted for this cloned repo layout.
- `workspace_backup/baselines/chadmain_v24.py`: primary local opponent and previous strong baseline.
- `workspace_backup/baselines/chadmain_v25.py`: older baseline variant.
- `workspace_backup/replays/`: local 2P replay corpus.
- `workspace_backup/replays_4p/`: local 4P replay corpus.
- `workspace_backup/monitor_53271842/`: live-submission replays/logs downloaded during monitoring.
- `workspace_backup/monitor_53271842/research/`: public strategy code pulled from Kaggle/Hugging Face.
- `workspace_backup/artifacts/precomputed_features.json.part-*`: split copy of `precomputed_features.json`.
- `workspace_backup/leaderboard/`: leaderboard snapshot CSV.
- `workspace_backup/episodes-index/`: replay index manifest.
- `workspace_backup/validation_replays/`: validation replay from the first failed submission.

Rebuild the split feature file if needed:

```bash
cat workspace_backup/artifacts/precomputed_features.json.part-* > precomputed_features.json
```

## Setup On A New Laptop

```bash
git clone https://github.com/ChristopherJoshy/Orbit-Wars-2026-herustrics-model.git
cd Orbit-Wars-2026-herustrics-model
python -m pip install "kaggle-environments>=1.28.0" kaggle numpy
python -m py_compile main.py
python -m unittest tests/test_codex_contract.py
```

Run a targeted local match:

```bash
python scripts/benchmark_codex.py --mode 4p --seeds 1 --seed-start 885188663 --seat 2 --episode-steps 500 --workers 1 --stop-on-loss
```

Run a small hard-seed sweep:

```bash
python scripts/benchmark_codex.py --mode both --seeds 5 --episode-steps 500 --workers 2 --stop-on-loss
```

Submit only after strong evidence:

```bash
kaggle competitions submit orbit-wars -f main.py -m "codex heuristic <commit>"
```

## Current Git/Submission State

Current backup commit pushed to GitHub:

- `854c597 backup orbit wars heuristic workspace`
- Remote: `https://github.com/ChristopherJoshy/Orbit-Wars-2026-herustrics-model`
- Branch: `main`

Windows note: the leaderboard snapshot filename was normalized for Windows checkout. Use `workspace_backup/leaderboard/orbit-wars-publicleaderboard-2026-05-31T16-56-58.csv`.

Latest committed base before this backup:

- `407a3f4 support direct planner invocation`
- `e741210 adapt prod4 opening anchors`
- `14f7def improve adaptive high-production heuristics`

Live submission state seen on June 2, 2026:

- `53271842`: `main.py`, description `codex direct planner invocation fix 407a3f4`, status `COMPLETE`.
- Its score moved during monitoring: `600.0 -> 903.0 -> 714.4 -> 738.2 -> 791.5` as games arrived.
- `53271690`: earlier submission, status `ERROR`, direct planner invocation bug.
- Previous baseline `53150911 chadmain_v24.py`: complete, around `922.6`.
- Previous `53225812 chadmain_v27.py`: complete, around `893`.

The current `main.py` contains unvalidated candidate edits made after `407a3f4`. These edits are committed in the backup for portability, but they are not proven submission-ready.

## Current Candidate Patch Intent

The current candidate patch is a replay-driven attempt to fix repeated 4P losses where the old submission stopped expanding at low production while one opponent ran away.

Changed areas in `main.py`:

- `build_opening_tempo_moves`: 4P no longer stops opening tempo merely at `my_prod >= 8`; it waits for roughly `my_prod >= 14` and not trailing the strongest rival.
- `build_neutral_sweep_moves`: 4P severe production deficit before turn 90 allows more in-flight fleet volume and up to 2 sweep moves.
- `build_two_player_local_high_production_anchor_moves`: contested high-production anchors get more surplus when enemy ETA is close.
- `build_fast_pressure_moves`: early 4P leader pressure opens under runaway conditions instead of being hard-gated until the late weakest-enemy phase.
- `four_player_consolidation_hold`: 4P consolidation now requires more production, more planets, no production deficit, and enough fleet already in transit.

These edits passed:

```bash
python -m py_compile main.py
python -m unittest tests/test_codex_contract.py
```

They did not pass a full 100-seed gate. Do not submit blindly.

Important: this is a backup commit, not a final promoted submission. Continue from it, but feel free to revise or revert parts of the candidate patch if stronger evidence contradicts it.

## Known Live Replay Failures To Study First

All files are in `workspace_backup/monitor_53271842/replays/` and logs in `workspace_backup/monitor_53271842/logs/`.

### 4P runaway opening failures

Episode `78458024`, seed `695244577`, our submitted agent was player 2, winner was `SK Arin`.

- t25: us `prod=4`, winner `prod=4`.
- t50: us `prod=9`, winner `prod=12`.
- t75: us `prod=16`, winner `prod=26`.
- Failure: too much own/logistics, not enough neutral expansion and early pressure.

Episode `78458634`, seed `885188663`, our submitted agent was player 2, winner was `gugugaga`.

- t25: us `prod=9`, winner `prod=12`.
- t50: us `prod=9`, winner `prod=26`.
- t75: us `prod=9`, winner `prod=43`.
- Failure: the strongest clear example of `prod=9` stall. This should be the first targeted diagnostic.

Episode `78458863`, seed `1282156764`, our submitted agent was player 0, winner was `chiclet`.

- t25: us `prod=7`, winner `prod=15`.
- t50: us `prod=18`, winner `prod=28`.
- t75: us `prod=22`, winner `prod=36`.
- Failure: same class, but our opening was less dead; opponent scaled faster and converted into pressure.

### 2P midgame loss

Episode `78459093`, seed `1994966576`, our submitted agent was player 0, winner was `neibyr`.

- t50: us `prod=12`, opponent `prod=21`.
- t75: us `prod=26`, opponent `prod=32`.
- t150: us `prod=16`, opponent `prod=48`.
- Failure: opponent kept neutral expansion plus pressure; old agent shifted heavily to own logistics.

## Critical Open Bug / Next Debug Target

On `78458634` at t50, direct planner inspection showed:

- `build_fast_pressure_moves(...)` returned moves.
- `build_neutral_sweep_moves(...)` returned moves.
- `build_opening_tempo_moves(...)` returned moves.
- `plan_codex_moves(world, deadline=None)` returned moves.
- But `agent(obs)` with normal deadline sometimes returned `[]` on saved replay observations.

This likely means deadline handling, global replay-tracker state, or expensive pre-planning is causing the deadline-aware path to miss the fast moves. Fix this before widening search.

Recommended first patch:

1. Make the runaway 4P fast-pressure/opening/sweep checks happen before any expensive policy/search work.
2. Ensure these fast branches are deadline-safe and do not depend on mutated global replay state.
3. Add a small diagnostic test or script that loads `workspace_backup/monitor_53271842/replays/episode-78458634-replay.json`, extracts player 2 t50, and asserts `agent(obs)` emits at least one move under normal deadline.

Helpful exact inspection command:

```bash
python - <<'PY'
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("agent", "main.py")
mod = importlib.util.module_from_spec(spec)
sys.modules["agent"] = mod
spec.loader.exec_module(mod)
data = json.load(open("workspace_backup/monitor_53271842/replays/episode-78458634-replay.json"))
obs = data["steps"][50][2]["observation"]
world = mod.build_world(obs, inferred_step=50)
modes = mod.build_modes(world)
fast = mod.build_fast_sweep_policy(world)
policy = mod.complete_policy_budgets(world, mod.build_policy_state(world, deadline=None))
print("quick_pressure", mod.build_fast_pressure_moves(world, fast, modes))
print("neutral_sweep", mod.build_neutral_sweep_moves(world, fast, modes))
print("opening", mod.build_opening_tempo_moves(world, policy))
print("plan_no_deadline", mod.plan_codex_moves(world, deadline=None))
mod.reset_agent_state(mod.observation_game_signature(obs))
print("agent", mod.agent(obs))
PY
```

In the previous session, the direct planner returned moves on this position, while `agent(obs)` could return `[]`. That is the highest-priority mismatch.

## Runtime Risk

Saved-observation timing after the local patch was close to Kaggle's limit:

- Around 21 sampled live-loss observations.
- Max roughly `0.88s` to `0.99s` depending on sequencing.
- Mean roughly `0.50s`.

This is not enough headroom. Avoid adding wider beam search until fast-path pruning improves.

High priority speed work:

- Return early from cheap 4P runaway pressure/neutral actions.
- Avoid building full expensive policy state if a safe fast move is already found.
- Memoize repeated `world.plan_shot` / `best_probe_aim` calls only if exact behavior is preserved.
- Re-run Kaggle-like logs/timing after each patch.

## Public Strategy Evidence Pulled

Files in `workspace_backup/monitor_53271842/research/`:

- `hf/kvatsa5_submission.py`
- `hf/subham007_v14_submission.py`
- `zachary/orbit-wars-heuristic-agent-scored-1000.py`

Observed useful ideas:

- Exact keep-needed defense.
- Proactive reinforcement.
- Contested-neutral extra margin.
- Hostile reinforcement prediction.
- Early leader pressure in 4P.
- Exploit exposed planets.
- Do not leave high-production captures with tiny surplus when enemy ETA is close.

Use these as strategy references, not as a copy-paste replacement.

## Validation Discipline

Use this order:

1. `python -m py_compile main.py`
2. `python -m unittest tests/test_codex_contract.py`
3. Saved replay diagnostics for known failure turns.
4. Targeted full 500-step seeds:

```bash
python scripts/benchmark_codex.py --mode 4p --seeds 1 --seed-start 885188663 --seat 2 --episode-steps 500 --workers 1 --stop-on-loss
python scripts/benchmark_codex.py --mode 4p --seeds 1 --seed-start 695244577 --seat 2 --episode-steps 500 --workers 1 --stop-on-loss
python scripts/benchmark_codex.py --mode 4p --seeds 1 --seed-start 1282156764 --seat 0 --episode-steps 500 --workers 1 --stop-on-loss
python scripts/benchmark_codex.py --mode 2p --seeds 1 --seed-start 1994966576 --seat 0 --episode-steps 500 --workers 1 --stop-on-loss
```

5. Small hard-seed sweeps.
6. Full gate: 100 seeds 2P and 100 seeds 4P against `chadmain_v24.py`.

Do not treat short-horizon tests as a pass. The old agent often looked good early, then collapsed.

## Notes For Next Codex

- The user wants the full top-10 objective preserved, not a scaffold or weak smoke check.
- Stay heuristic-only and single-file for submission.
- Use live Kaggle replays/logs as evidence.
- If submitting, record submission id, validation episode, public score, and replay ids in this file or a new handoff note.
- Keep Git commits frequent and meaningful.
- If the user pairs this file with `/goal`, treat this document as the source of truth and continue from the current repository state, not from memory.
