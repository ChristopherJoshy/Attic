# Anchor test report

Generated with `.venv/bin/pytest tests/ --cov=anchor --cov-report=term` on the
final state of the PoC (Python 3.13, pytest-cov).

## Summary

- **61 tests collected / 61 passed / 0 failed** in ~0.7 s.
- **Total statement coverage: 96%** (497 statements, 20 missed).

```
Name                                 Stmts   Miss  Cover
--------------------------------------------------------
src/anchor/__init__.py                   6      0   100%
src/anchor/checks/__init__.py            9      0   100%
src/anchor/checks/altitude.py           38      0   100%
src/anchor/checks/environmental.py      60      2    97%
src/anchor/checks/heading.py            48      1    98%
src/anchor/checks/kinematic.py          36      2    94%
src/anchor/checks/solar.py              66     11    83%
src/anchor/checks/temporal.py           25      1    96%
src/anchor/fusion.py                    18      0   100%
src/anchor/sensors.py                   24      0   100%
src/anchor/simulate.py                 123      1    99%
src/anchor/state_machine.py             44      2    95%
--------------------------------------------------------
TOTAL                                  497     20    96%

61 passed in 0.73s
```

## Coverage of required scenarios

- **Negation pairs**
  - decelerating-but-still-rolling vs instant stop
    (`test_kinematic.py::test_decelerating_but_never_stopping_passes`,
    `::test_instant_stop_from_speed_flags`)
  - single-sample heading divergence during a turn must not flag vs sustained
    divergence must flag (`test_heading.py::test_single_sample_divergence_during_turn_does_not_flag`,
    `::test_sustained_divergence_flags`)
  - pressure blip vs sustained GNSS/barometer altitude split
    (`test_altitude.py::test_brief_pressure_blip_vs_sustained_divergence`)
- **Exactly one check failing -> DEGRADED not DENIED**
  (`test_state_machine.py::test_single_low_confidence_failure_degrades_not_denies`,
  `::test_high_confidence_threshold_boundary` pins the 0.7 confidence cut)
- **Multiple failing -> DENIED** (`test_state_machine.py::test_two_failures_deny_even_if_weak`,
  `::test_all_six_failing_denied_with_full_reason_chain`)
- **Recovery sequence**: never DENIED->TRUSTED directly; passes through
  RECOVERING after 5 consecutive clean windows; relapse restarts the cycle
  (`test_state_machine.py::test_recovery_goes_through_recovering_not_straight_to_trusted`,
  `::test_relapse_during_recovery_returns_to_denied`, `::test_new_attack_while_recovering_restarts_cycle`;
  end-to-end: `test_integration.py::test_teleport_caught_then_recovers_via_recovering`)
- **Solar math against a verifiable real-world fact**: London (51.5 N) on
  June 21 at ~12:00 UTC is local solar noon -> sun due south at ~61-62 deg
  elevation; source-of-truth cited in the comment block at the top of
  `tests/test_solar.py` (cross-checkable against timeanddate.com or the NOAA
  solar calculator).
- **End-to-end verdict-sequence integration test over mixed clean/spoofed
  traces**: `test_integration.py` runs the full pipeline over sliding windows;
  `test_mixed_clean_and_spoofed_segments_full_sequence` asserts a full
  TRUSTED -> DENIED -> RECOVERING -> DENIED sequence across teleport +
  stationary-phone segments.
