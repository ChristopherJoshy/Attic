# NeuroGolf 2026 — The Championship

Kaggle competition: <https://www.kaggle.com/competitions/neurogolf-2026>

## Read first (in order)

1. [`AGENTS.md`](AGENTS.md) — agent instructions and non-negotiable policy
2. [`GOAL.md`](GOAL.md) — current state, floor, evidence, and next steps
3. [`MIGRATION_HANDOFF.md`](MIGRATION_HANDOFF.md) — device migration context
4. [`reports/submissions/live_outcomes.md`](reports/submissions/live_outcomes.md) — submission history and risk policy

## Quick status

- **Current protected floor**: `53267360`, public score `6209.84`
- **Current floor bundle**: `candidate_bundles/current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_offline/submission`
- **No pending Kaggle runs** as of the last verified status after the `53271460` task219 failure

## Windows setup (PowerShell)

```powershell
git clone https://github.com/ChristopherJoshy/The-2026-NeuroGolf-Championship.git neurogolf
cd neurogolf

# Python venv (use uv if installed, else python -m venv)
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# or, if uv is installed:
# uv sync

# Smoke test
.venv\Scripts\python.exe -c "import onnx, onnxruntime; print('ok')"

# Confirm no pending Kaggle run
kaggle competitions submissions -c neurogolf-2026 --csv
```

## Linux / macOS setup

```bash
git clone https://github.com/ChristopherJoshy/The-2026-NeuroGolf-Championship.git neurogolf
cd neurogolf
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./.venv/bin/python -c "import onnx, onnxruntime; print('ok')"
kaggle competitions submissions -c neurogolf-2026 --csv
```

## Layout

```
AGENTS.md                         # agent policy
GOAL.md                           # handoff / state
MIGRATION_HANDOFF.md              # device migration
README.md                         # this file
.gitignore
.gitattributes                    # line-ending normalization (LF for code, CRLF for Windows scripts)

data/neurogolf-2026/              # official Kaggle data
tools/profile_bundle.py           # local scorer (full 400-task profile)
candidate_bundles/                # all built bundles (incl. protected floor)
external_bundles/                 # downloaded public artifacts
reports/submissions/              # CSV profiles, audit JSONs, live_outcomes.md
external_datasets/                # misc downloaded datasets
external_notebooks/               # misc notebooks
external_outputs/                 # kernel outputs
previoussubmission/               # older submission zips
submission.zip                    # local scratch

# Excluded via .gitignore:
# .venv/                          # local virtualenv
# artifacts/profiles/             # 79GB of temp per-task profile JSONs
# opencode.db                     # opencode session data
# *.tar.gz (handoff)              # opencode handoff tarball
```

## Policy

- Do **not** use Kaggle GPU/TPU. Local CPU/GPU is allowed for offline testing only.
- Do **not** submit raw public bundles or public artifacts just to see what happens.
- Do **not** submit while any Kaggle submission is pending.
- Only submit promoted, evidence-gated candidates after: full CPU validation, exact diff vs floor, no banned ops/dynamic shapes/oversize ONNX, fresh no-pending Kaggle status check.
- Use `.venv/bin/python` (or `.venv\Scripts\python.exe` on Windows), not system Python.
- Treat local public/arc-gen correctness as necessary but insufficient; hidden/private behavior has repeatedly disagreed with local evidence.
