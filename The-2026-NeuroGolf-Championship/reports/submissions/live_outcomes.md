# NeuroGolf live submission outcomes

## Current protected floor

- `53267360` — `PROMOTE_6210_ROGERMT_RULES_CLEANUP`, public score `6209.84`.
- Negative latest run: `53271460` — `PROMOTE_6214_TASK219_RULE_BUILDER`, public score `6201.20` despite local `6213.669293`; protected floor remains `53267360` / `6209.84`.
- Previous floor: `53265276` — `PROMOTE_6208_AFR_TAIL7`, public score `6207.68`.
- Earlier floor: `53264667` — `PROMOTE_6207_AFR_TOP20`, public score `6206.98`.
- Earlier floor: `53264174` — `PROMOTE_6206_AFR_TOP16`, public score `6206.32`.
- Earlier floor: `53261442` — `PROMOTE_6195_BIOHACK_REMAINING85`, public score `6194.84`.
- Earlier floor: `53260790` — `PROMOTE_6177_BIOHACK_NEXT20`, public score `6177.06`.
- Earlier floor: `53260272` — `PROMOTE_6167_BIOHACK_NEXT10`, public score `6167.38`.
- Earlier floor: `53258343` — `PROMOTE_6161_BIOHACK_RULES_111_151_258`, public score `6161.42`.
- Earlier floor: `53254701` — `PROMOTE_OCTAVIO6154_MANUAL_V205`, public score `6154.71`.
- Earlier floor: `53250268` — `PROMOTE_AFR6285_PUBLIC_CURRENT_RULES`, public score `6151.18`.
- Earlier floor: `53246909` — `PROMOTE_6129_LOCAL`, public score `6129.45`.

## Negative strategic bundle

- `53249442` — `STRATEGIC_6138_EXPECTED`, public score `6098.54`.
- Local expected score was `6138.929009` from touched-task deltas over the full-validated `6129.45` base.
- Touched tasks: Beicicc `task175`, `task285`, `task324`; AFR5689 `task018`, `task101`, `task145`.
- Policy: treat this entire unproven swap set as live-negative/untrusted. Do not reuse any of these swaps in promoted bundles unless there is stronger evidence or explicit user approval for isolation.
- `53251278` — `PROMOTE_FRANK6217_OVER_AFR6151`, public score `5868.23`.
- Local expected score was `6217.457927` from `external_bundles/afr1ste-6285-output/submission` plus 25 Frank Super Blend task swaps.
- Touched tasks: Frank `task018`, `task023`, `task044`, `task066`, `task076`, `task096`, `task118`, `task133`, `task153`, `task157`, `task158`, `task175`, `task182`, `task209`, `task219`, `task233`, `task243`, `task255`, `task277`, `task285`, `task319`, `task324`, `task363`, `task367`, `task387`.
- Policy: treat broad Frank/Jon-style local-positive swaps as live-negative/untrusted over the AFR6285 base. Do not submit another multi-swap blend from this family without isolating risk or finding stronger current-live evidence.
- `53253190` — `PROMOTE_BEICICC_INLINED6207_OVER_AFR6151`, public score `5882.16`.
- Local expected score was `6207.012911` from the live-positive AFR6285 base plus 24 CPU-ok local-positive swaps from the Beicicc 6645 public artifact after custom-function inlining.
- Touched tasks: Beicicc-inlined `task018`, `task023`, `task025`, `task044`, `task066`, `task076`, `task096`, `task101`, `task133`, `task158`, `task175`, `task191`, `task209`, `task219`, `task233`, `task243`, `task255`, `task285`, `task308`, `task324`, `task363`, `task366`, `task367`, `task370`.
- Policy: even output-equivalent inlining of the Beicicc 6645 public artifact did not generalize in a broad blend over AFR6285. Treat broad Beicicc/Frank/Jon/Khori local-positive overlap tasks as live-negative unless isolated with explicit approval or backed by new live-positive evidence.

## Risk notes

- `candidate_bundles/current_best_6207_plus_cleanup_and_rogermt_v118_217_034_161_202_offline/submission` is live-positive and the current protected floor (`400/400` local CPU ok, local `6209.844310`, live `6209.84`). It is the previous 6207.68 floor plus semantic cleanup of unused initializers/dead nodes and Rogermt v118 tasks `034`, `161`, `202`, and `217`.
- `candidate_bundles/current_best_6209_plus_task219_rogermt_builder_diagnostic/submission` was live-negative (`53271460`, public `6201.20`) despite strong local/source evidence (`400/400` local CPU ok, local `6213.669293`, one diff `task219.onnx`, Rogermt 265/265 source-derived builder). Treat task219 semantic replacements/builders as high-risk unless new evidence is substantially stronger; do not submit task219 variants casually.
- `candidate_bundles/current_best_6206_plus_afr6285_tail7_offline/submission` is live-positive and the previous protected floor (`400/400` local CPU ok, local `6207.682403`, live `6207.68`). It is the previous 6206.98 floor plus AFR6285 tail tasks `030`, `145`, `175`, `248`, `249`, `345`, and `357`.
- `candidate_bundles/current_best_6206_plus_afr6285_top20_offline/submission` is live-positive and the previous protected floor (`400/400` local CPU ok, local `6206.989769`, live `6206.98`). It is the previous 6206.32 floor plus AFR6285 tasks `041`, `077`, `184`, and `284`.
- `candidate_bundles/current_best_6194_plus_afr6285_top16_offline/submission` is live-positive and the previous protected floor (`400/400` local CPU ok, local `6206.329344`, live `6206.32`). It is the previous 6194.84 floor plus reduced, meaningful-delta AFR6285 tasks `014`, `035`, `051`, `134`, `153`, `168`, `191`, `219`, `224`, `288`, `290`, `310`, `316`, `354`, `355`, and `388`. A broader 68-task AFR6285-positive candidate was built/profiled locally (`6208.068761`) but should not be treated as promoted: oracle recommended against submitting the full long tail because the last ~50 swaps add little gain with large hidden-risk surface.
- `external_bundles/afr1ste-6285-output/submission.zip` was live-positive earlier as a source/base but is no longer the floor.
- `candidate_bundles/current_best_6177_plus_biohack6115_remaining85_offline/submission` is live-positive and the previous protected floor (`400/400` local CPU ok, local `6194.848956`, live `6194.84`). It is the previous 6177.06 floor plus all remaining BioHack6115 local-positive swaps: `001`, `003`, `006`, `007`, `027`, `035`, `050`, `052`, `055`, `058`, `059`, `062`, `065`, `068`, `078`, `086`, `103`, `123`, `124`, `129`, `131`, `132`, `143`, `163`, `166`, `167`, `176`, `178`, `180`, `186`, `188`, `191`, `196`, `197`, `207`, `215`, `227`, `229`, `231`, `232`, `235`, `237`, `240`, `249`, `250`, `252`, `254`, `256`, `257`, `260`, `263`, `267`, `268`, `278`, `289`, `292`, `297`, `298`, `299`, `308`, `314`, `321`, `322`, `329`, `330`, `334`, `335`, `338`, `339`, `340`, `341`, `342`, `345`, `347`, `354`, `360`, `362`, `371`, `372`, `376`, `386`, `390`, `394`, `395`, and `397`.
- `candidate_bundles/current_best_6167_plus_biohack6115_next20_offline/submission` is live-positive and the previous protected floor (`400/400` local CPU ok, local `6177.060183`, live `6177.06`). It is the previous 6167.38 floor plus BioHack6115 tasks `010`, `026`, `046`, `048`, `072`, `104`, `144`, `148`, `212`, `225`, `226`, `228`, `236`, `270`, `318`, `368`, `373`, `378`, `388`, and `392`.
- `candidate_bundles/current_best_6161_plus_biohack6115_next10_offline/submission` is live-positive and the previous protected floor (`400/400` local CPU ok, local `6167.384375`, live `6167.38`). It is the previous 6161.42 floor plus BioHack6115 tasks `028`, `060`, `075`, `082`, `189`, `269`, `279`, `295`, `327`, and `369`.
- `candidate_bundles/octavio6154_plus_biohack6115_tasks111_151_258_offline/submission` is live-positive and the previous protected floor (`400/400` local CPU ok, local `6161.426226`, live `6161.42`). It is Octavio v205 plus BioHack6115 tasks `111`, `151`, and `258` only.
- `external_bundles/octaviograu-6154-output/submission.zip` / `external_bundles/octaviograu-6154-v205/submission` is live-positive, manual-only, public artifact (`400/400` local CPU ok, local `6154.714656`, live `6154.71`) and is the previous protected floor.
- `consensus_public_ok_6148_expected_over_6129` remains unsubmitted despite full local CPU validation because it contains tasks with earlier poor live evidence in related single-swap/public probes (`task219`, `task255`, and possibly `task319`/`task066`).
- Preserve floor by avoiding single-task probes and public-artifact probes without explicit approval.
