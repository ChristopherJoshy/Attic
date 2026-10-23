# NeuroGolf 2026 Goal / Current Handoff

## Objective

Win or reach top 3 in Kaggle competition `neurogolf-2026` while preserving the current best live score. The current approach is evidence-gated ONNX task-level optimization under current official scoring rules.

Repository to use on the next device:

`https://github.com/ChristopherJoshy/The-2026-NeuroGolf-Championship`

## Current live state

- Current protected submission: `53267360`
- Description: `PROMOTE_6210_ROGERMT_RULES_CLEANUP`
- Public score: `6209.84`
- Current floor bundle:
  `candidate_bundles/current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_offline/submission`
- Current floor profile:
  `reports/submissions/profile_current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_full.csv`
- Current floor local score: `6209.844310` / CSV precision `6209.844301`
- Current live notes file: `reports/submissions/live_outcomes.md`
- No pending submissions as of the last verified status after the task219 failure.

## Environment

- Workdir: `/home/chris/projects/neurogolf`
- Python: `./.venv/bin/python`
- Official data: `data/neurogolf-2026`
- Official utility: `data/neurogolf-2026/neurogolf_utils/neurogolf_utils.py`
- Local scorer: `tools/profile_bundle.py`
- Kaggle CLI: `/home/chris/.local/bin/kaggle`
- Local GPU exists but only CPU ONNX Runtime scoring should be trusted for validation.

## Official scoring constraints

- 400 ARC-AGI public training v1 tasks.
- Input/output tensors are one-hot `[1,10,30,30]`.
- Exact output required.
- Score per correct task: `max(1, 25 - ln(memory + params))` with floor at cost `1`.
- ONNX file limit: 1.44 MB per task.
- Disallowed ops currently include `Loop`, `Scan`, `NonZero`, `Unique`, `Script`, `Function`, `Compress`.
- Shapes must be static.
- Scorer uses sanitized graph and `ORT_DISABLE_ALL`.
- Final graph tensor named `output` is not counted as intermediate memory; intermediate tensors are counted via value_info/profiler. Params count initializer elements and `Constant` node attrs only.

## Important live-positive progression

The following sequence is live-proven and should be preserved:

1. Octavio v205 floor: `6154.71`.
2. BioHack6115 extracted positives:
   - `53258343` → `6161.42`
   - `53260272` → `6167.38`
   - `53260790` → `6177.06`
   - `53261442` → `6194.84`
3. AFR6285 controlled positives:
   - `53264174` → `6206.32`
   - `53264667` → `6206.98`
   - `53265276` → `6207.68`
4. Rogermt v118 selected tasks + semantic cleanup:
   - `53267360` → `6209.84` current protected floor.

## Current floor composition highlights

Current floor = previous AFR/BioHack floor plus:

- semantic cleanup of unused initializers/dead nodes from the earlier cleanup bundle,
- Rogermt v118 tasks `034`, `161`, `202`, `217`.

Candidate path:

`candidate_bundles/current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_offline/submission`

Profile path:

`reports/submissions/profile_current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_full.csv`

## Critical negative evidence

### Task219 is high-risk

`53271460` (`PROMOTE_6214_TASK219_RULE_BUILDER`) scored `6201.20`, below the protected `6209.84` floor, despite:

- one diff: `task219.onnx`,
- full local CPU `400/400 ok`,
- local score `6213.669293`,
- Rogermt source solver verified `265/265` on official train/test/arc-gen.

Conclusion: task219 hidden/private behavior disagrees with public/arc-gen/local rule evidence. Do not submit task219 semantic replacements casually. Only consider true semantic-preserving compression of the current live-positive task219 solver.

### Other live-negative families

Direct local-positive swaps from Jon/Frank/Beicicc/Khori/Kojimar-style families are dangerous. Previously live-negative examples include high-local tasks such as `219`, `255`, `233`, `157`, `133`, `209`, `367`, `066`, `096`, `118`, `023`, `044`, and others. Do not make an all-local-best mega-merge.

## Existing reports and artifacts

Key reports:

- `reports/submissions/live_outcomes.md`
- `reports/submissions/profile_current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_full.csv`
- `reports/submissions/profile_mine_vs_6209_rogermt_cleanup_summary.csv`
- `reports/submissions/top_cost_semantic_compression_audit_6209.json`
- `reports/submissions/top40_tensor_memory_audit_6209.json`

Important candidate artifacts:

- Current floor:
  `candidate_bundles/current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_offline/submission`
- Failed task219 builder:
  `candidate_bundles/current_best_6209_plus_task219_rogermt_builder_diagnostic/submission`
- Too-small pure INT32 semantic cleanup:
  `candidate_bundles/current_best_6209_plus_int32_index_cleanup_367_313_396_offline/submission`

## Current non-submitted cleanup candidate

Pure semantic INT32 index cleanup candidate:

`candidate_bundles/current_best_6209_plus_int32_index_cleanup_367_313_396_offline/submission`

Profile:

`reports/submissions/profile_current_best_6209_plus_int32_index_cleanup_367_313_396_touched.csv`

Tasks changed: `313`, `367`, `396`.

Deltas:

- task313: `+0.106356`
- task367: `+0.133664`
- task396: `+0.140314`
- total: `+0.380334`
- expected full total: `6210.224635`

This appears safe but is too small to submit alone under the current gate. It can be combined with future semantic-preserving gains.

## Recent semantic compression findings

Top-cost audit over current floor found dead/duplicate cleanup basically exhausted:

- task233 duplicate/dead estimate: `+0.001147`
- task319: `+0.000979`
- task255: `+0.000538`
- task209: `+0.000428`
- others smaller.

Successful dtype/accounting prototypes:

- task367 INT64→INT32 index maps: `+0.133664`
- task313 INT64/INT32 arithmetic rewrite: `+0.106356`
- task396 INT32 index cleanup: `+0.140314`

Failed or rejected prototypes:

- task219 FP16 rewrite: local wrong on all 265 examples.
- task157 broad FP16 conversion: invalid/no useful candidate.
- task020 INT32 rewrite: possible but low value and needs careful ArgMax INT64 handling.
- task255 already uses UINT8/BOOL/FP16 in large path; no immediate safe dtype win.

## Recent public-source mining

Rogermt:

- `external_bundles/rogermt-neurogolf-solver` downloaded.
- v118 positives already mined; selected `034/161/202/217` are now in current live floor.
- Remaining rogermt v118 positives are not submission-worthy:
  `255`, `319`, `370`, `092`, `128`, `062`, `330` (red-flagged or too small).
- Rogermt `6114`/`6115` are just already-mined BioHack6115 for differing tasks.

Nadeem/Haoran latest check:

- Downloaded outputs for:
  - `external_bundles/nadeem-6151-output`
  - `external_bundles/nadeem-6130-output`
- `haoran-6100-output` directory was created but download did not complete in the interrupted chained command.
- `reports/submissions/profile_nadeem_6151_diff_vs_6209.csv` completed.
  - 135 differing tasks profiled.
  - positives: 39, sum only `+0.378194`.
  - top positives: task330 `+0.049594`, task297 `+0.043313`, task343 `+0.036828`, task187 `+0.025315`, task335 `+0.024610`.
  - negatives: 96, sum `-59.035415`.
  - Conclusion: Nadeem 6151 is basically tiny remaining AFR tail / already-known low-value deltas, not submission-worthy.
- Profiling `nadeem-6130` diff was interrupted by user before completion; no CSV conclusion yet.

## Device switch in progress (active context)

User signaled a device switch and asked GOAL.md to handle it. As of this edit:

- Current device has the protected floor intact and no pending Kaggle runs.
- A `+0.380334` INT32 dtype-lowering candidate (tasks 313, 367, 396) is built and CPU-validated but is below the `+1.5` soft threshold. Per the explicit `GOAL.md` policy below and `live_outcomes.md` warnings, it must not be submitted alone.
- Opencode session export is at `/tmp/opencode/neurogolf_device_handoff/` (Linux dev box) and mirrored into the repo at:
  - `handoff/neurogolf_device_handoff.tar.gz` (6.4 MB, SHA256 `a23a4d33ab44a633b1876dedd314e6be1032c0e9c10bc7b67ba44579ff32756a`)
  - Contents: filtered `opencode_session_ses_17dc9a4dbffetx8489o1uicmg6.json`, filtered `opencode_session_ses_17dc9a4dbffetx8489o1uicmg6.db`, and the three handoff markdown files. The DB and JSON have had `account` / `control_account` tables removed; the only sensitive-looking content that remains is the session message and tool-call history itself, which the user explicitly chose to migrate.
- Working directory `/home/chris/projects/neurogolf` is now a git repository. Remote is `https://github.com/ChristopherJoshy/The-2026-NeuroGolf-Championship` (private). Two commits pushed as of this edit: `0fb6c24` (initial migration snapshot) and `724b619` (Windows compatibility). The handoff tarball is in a third commit, see `git log` on the new device.

## Recommended next steps (after device switch)

1. On the new device, clone or pull the GitHub repo (`https://github.com/ChristopherJoshy/The-2026-NeuroGolf-Championship`) into a fresh directory.
2. Copy `AGENTS.md`, `GOAL.md`, and `MIGRATION_HANDOFF.md` from the new clone back to the local workdir.
3. Restore `.venv` and rerun `./.venv/bin/python -c "import onnx, onnxruntime"` to confirm the env works.
4. Confirm current floor: read `reports/submissions/live_outcomes.md` and the `profile_current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_full.csv` profile.
5. Verify no pending Kaggle runs before any further work:
   ```bash
   /home/chris/.local/bin/kaggle competitions submissions -c neurogolf-2026 --csv
   ```
6. Do **not** submit anything immediately.
7. Continue only one of these:
   - semantic-preserving compression audits of current-floor high-cost tasks,
   - carefully mine genuinely new public artifacts only for untainted leads,
   - finish interrupted `nadeem-6130` profiling if useful, but expect low value.
8. Only submit if a meaningful candidate (preferably > `+1.5` local) passes full CPU validation and a fresh no-pending Kaggle status check.
9. If git is preferred over SSH for file transfer, commit only `AGENTS.md`, `GOAL.md`, and `MIGRATION_HANDOFF.md` (and explicitly excluded credentials) to the GitHub repo. Transfer the opencode session tarball out-of-band (scp/rsync).

## Migration note

The user is moving devices and asked to copy opencode data plus this session only. The likely opencode data is under:

`~/.local/share/opencode/`

At minimum transfer:

- `~/.local/share/opencode/opencode.db`
- `~/.local/share/opencode/opencode.db-wal`
- `~/.local/share/opencode/opencode.db-shm`
- relevant `oh-my-opencode-slim.*.log` for this date/session if needed.

Do not copy credentials into git. Use secure transfer only after SSH details are provided.
