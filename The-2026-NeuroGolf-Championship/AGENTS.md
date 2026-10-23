# NeuroGolf Agent Instructions

Read `GOAL.md` before doing anything else. This project is an active Kaggle NeuroGolf 2026 leaderboard effort; the objective is top 3/win while preserving the current live score floor.

## Non-negotiable policy

- Do **not** use Kaggle GPU/TPU. Local CPU/GPU is allowed for offline testing only.
- Do **not** submit raw public bundles or public artifacts just to see what happens.
- Do **not** submit while any Kaggle submission is pending.
- Do **not** submit single-task probes unless there is exceptional evidence and the protected floor remains safe.
- Only submit promoted, evidence-gated candidates after:
  1. full CPU validation with `tools/profile_bundle.py`,
  2. exact diff verification vs the protected floor,
  3. no disallowed ops/dynamic shapes/oversize ONNX files,
  4. a fresh Kaggle status check showing no pending run.
- Use `.venv/bin/python`, not system Python. System Python has previously missed required packages.
- Treat local public/arc-gen correctness as **necessary but insufficient**. Hidden/private behavior has repeatedly disagreed with local evidence.

## Current protected floor

The protected live floor is submission `53267360`, public score `6209.84`, from:

`candidate_bundles/current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_offline/submission`

Full local profile:

`reports/submissions/profile_current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_full.csv`

Do not replace this floor unless a new live submission completes above it.

## Known dangerous families / tasks

Never mechanically merge local-best ONNXs. The following public-swap families have strong live-negative evidence despite large local gains:

- Jon / Frank / Beicicc / Khori broad local-positive families.
- Semantic replacements for `task219`, including Rogermt source-derived builder. Submission `53271460` scored `6201.20` despite local `6213.669293` and one-file diff.
- High local-positive swaps for `task255`, `task233`, `task157`, `task319`, `task209`, `task367`, `task066`, `task096`, `task076`, and related red-flag tasks unless they are true semantic-preserving cost rewrites of the current floor.

Use public alternatives only as research/compression hints, not as direct submissions.

## Preferred next direction

Top 3 is far above the current score, so tiny public-swap tails are no longer strategic. The best current path is semantic-preserving compression of the live-proven floor:

- audit high-cost ONNXs for dtype/accounting reductions,
- keep graph semantics identical,
- avoid rule replacements for hidden-sensitive tasks,
- batch only meaningful safe gains, preferably > +1.5 local points.

A pure INT32 index cleanup candidate exists but is too small alone; see `GOAL.md`.

## Kaggle commands

Check status:

```bash
/home/chris/.local/bin/kaggle competitions submissions -c neurogolf-2026 --csv
```

Profile bundle:

```bash
./.venv/bin/python tools/profile_bundle.py --bundle-dir <submission_dir> --out <profile.csv>
```

Zip must be named exactly `submission.zip` and contain 400 root-level `task*.onnx` files.

## Handoff hygiene

- Update `reports/submissions/live_outcomes.md` after every live completion.
- Record all candidate paths, profile paths, diff lists, and submission refs in `GOAL.md` or a follow-up handoff note.
- Preserve the current protected floor even if experimental submissions underperform.
