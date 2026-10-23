# Device Migration Handoff

Use this repository on the new device:

```bash
git clone https://github.com/ChristopherJoshy/The-2026-NeuroGolf-Championship neurogolf
cd neurogolf
```

Then ensure the new agent reads:

1. `AGENTS.md`
2. `GOAL.md`
3. `reports/submissions/live_outcomes.md`

## Current protected floor

- Submission: `53267360`
- Public score: `6209.84`
- Bundle: `candidate_bundles/current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_offline/submission`
- Profile: `reports/submissions/profile_current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_full.csv`

## Opencode session export

The current opencode session ID is:

`ses_17dc9a4dbffetx8489o1uicmg6`

Prepared local handoff files live outside the repo at:

`/tmp/opencode/neurogolf_device_handoff/`

Files:

- `opencode_session_ses_17dc9a4dbffetx8489o1uicmg6.json` — readable filtered export of this session only.
- `opencode_session_ses_17dc9a4dbffetx8489o1uicmg6.db` — filtered SQLite DB with this session/project/message/part/todo rows only. It deliberately excludes opencode account/token tables.
- `neurogolf_device_handoff.tar.gz` — package containing this handoff plus `AGENTS.md`, `GOAL.md`, and this file.

Do not put opencode DBs or credentials in git. Transfer these files over SSH/SCP/rsync only.

## Continue-work warning

Do not submit anything immediately after migration. First check:

```bash
/home/chris/.local/bin/kaggle competitions submissions -c neurogolf-2026 --csv
```

There should be no pending run. If a pending run appears, wait for it to finish and update `reports/submissions/live_outcomes.md` before doing anything else.

## Pre-built but not submitted candidate

A `+0.380334` INT32 dtype-lowering candidate exists at:

`candidate_bundles/current_best_6209_plus_int32_index_cleanup_367_313_396_offline/submission`

Profile:

`reports/submissions/profile_current_best_6209_plus_int32_index_cleanup_367_313_396_touched.csv`

Per `GOAL.md` policy, this is below the `+1.5` soft threshold and must NOT be submitted alone. It can only be promoted when combined with other safe gains that together exceed the threshold and pass all four hard gates again.

## Last known device state

- `kaggle competitions submissions -c neurogolf-2026 --csv`: no pending run after the task219 failure (`53271460` completed at `6201.20`).
- Working directory `/home/chris/projects/neurogolf` was not a git repository on the prior device; the GitHub push side is the user's responsibility.
- Local GPU exists but is not used for validation; CPU ONNX Runtime path is authoritative.
