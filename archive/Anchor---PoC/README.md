# Anchor

Anchor is a small Python proof of concept that detects GPS spoofing on a phone by asking one
simple question: does the location the phone reports actually agree with what the phone's own
sensors say is happening to it? A spoofer can feed the GPS receiver any position it likes, but
it also has to fake the accelerometer sitting still on a desk while the reported position drives
down a highway, fake the barometer while the reported altitude jumps 300 meters, fake the compass
while the reported course turns 90 degrees. Anchor runs six independent physics checks over every
window of sensor data and refuses to trust a fix that the physical world contradicts. It never
relies on Android's mock-location flag — that flag is a software setting a spoofer controls;
consistency with physics is not.

## The problem

GPS spoofing apps are easy to get and easy to run: they feed the phone's location APIs a
fabricated position while everything else about the device stays real. Android does expose a
"mock location" flag, but it's advisory — apps are told to trust it, and spoofing tools have
spent years getting around exactly that check. What a spoofer cannot easily do is fabricate an
entirely consistent physical world: the phone still feels real gravity, measures real pressure,
sees the real sun, and its compass points at magnetic north whether the GPS agrees or not.
Anchor starts from that asymmetry. If the reported trajectory requires accelerations no road
vehicle can produce, or motion the accelerometers swear didn't happen, the fix is rejected —
no matter what any software flag claims.

## How it works

Every ~30 seconds of sensor data is scored by six checks. Each check votes pass/fail with a
confidence level and a human-readable reason; checks that don't have the sensor data they need
abstain rather than guess.

In plain language:

- **Kinematic** — did the reported speed change faster than any vehicle can accelerate?
- **Heading** — does the direction GNSS claims match the direction the magnetometer says?
- **Temporal** — did the position jump farther than physically possible between two fixes?
- **Altitude** — does the reported altitude agree with what air pressure says?
- **Environmental** — is the phone reporting movement while its accelerometer says it's flat on a table?
- **Solar** — is the claimed heading consistent with where the sun must be at that place and time?

Technically:

**Kinematic** (`src/anchor/checks/kinematic.py`) computes implied acceleration from consecutive
GNSS fixes only — it asks whether the *reported* trajectory could be real, deliberately ignoring
the IMU so a spoofer faking one stream can't cancel itself out. Raw fix deltas carry meter-level
noise that manufactures phantom multi-g accelerations when differentiated, so speeds are fit with
a least-squares slope over the window first. The ceiling is 11.8 m/s² (~1.2 g) for driving — above
aggressive but real braking (~0.8–1.0 g), below the smooth multi-g yanks of a naive teleport —
and 3.0 m/s² for pedestrian mode.

**Heading** (`checks/heading.py`) pairs each GNSS fix with the nearest magnetometer-derived
compass heading and flags divergence only when it is *sustained*: more than 35° across three
consecutive samples. A single-sample split during a hard turn or near steel structures is normal
and passes; a spoofed course drifting steadily away from the compass does not.

**Temporal** (`checks/temporal.py`) is the coarse backstop: if displacement divided by time
between consecutive fixes exceeds 1000 km/h, nothing on Earth moves like that, flag it. It looks
only at whether the gap could have been crossed at all; kinematic handles how speed changed along
the way.

**Altitude** (`checks/altitude.py`) converts raw barometric pressure to altitude with the
International Standard Atmosphere formula and compares against GNSS-reported altitude. Weather
systems move the pressure reference by 10–80 m of equivalent altitude, so the tolerance is a wide
150 m — enough to absorb honest drift, tight enough to catch the hundreds-of-meters errors typical
of a fabricated fix.

**Environmental** (`checks/environmental.py`) exploits the sharpest contradiction available:
a phone resting on a desk sees accelerometer variance of roughly (0.02 m/s²)² — essentially just
gravity and noise — while GNSS jitter alone produces phantom 0.2–0.5 m/s drift on parked cars.
Windows are classified stationary/moving from accelerometer variance (limit 0.05², GNSS moving
threshold 1.0 m/s), and the check requires four contradicting windows before flagging, so one
glitch can't convict a legitimate drive.

**Solar** (`checks/solar.py`) implements the NOAA solar-position equations in plain stdlib math
and compares computed solar azimuth against the device's claimed heading (15° tolerance). The sun
is a ground-truth ephemeris nobody can move: if the phone claims to face north but its position
and the timestamp put the sun dead ahead, something is fabricated. Tests pin it against a
verifiable fact — London on June 21 at solar noon has the sun due south at ~61–62° elevation.

The six votes go through **fusion** (`fusion.py`, fixed order) into a deterministic four-state
**state machine** (`state_machine.py`): TRUSTED, DEGRADED, DENIED, RECOVERING. One low-confidence
failure means DEGRADED — keep watching. Two failures, or one failure at confidence ≥ 0.7, mean
DENIED — treat the location as hostile. Recovery is deliberately grumpy: DENIED never becomes
TRUSTED directly. It takes five consecutive clean windows through RECOVERING, and a relapse
during recovery drops straight back to DENIED. The rules are a literal table in the source so any
verdict can be traced by reading.

## Architecture

```
 GNSS fixes ──────┬──► kinematic ──┐
                  ├──► heading ────┤
 accelerometer ───┤                │
 magnetometer ────┼──► temporal ───┤
                  │                ├──► fusion ──► state machine ──► verdict
 barometer ───────┴──► altitude ───┤   (votes)    TRUSTED            + reasons
                       environmental┘             DEGRADED
 sun ephemeris ─────►  solar ──────┘              DENIED / RECOVERING
```

## Quickstart

```sh
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/pytest
.venv/bin/python examples/run_demo.py
```

All 61 tests should pass in under a second. The demo runs the pipeline twice side by side: an
honest 180 s driving trace that stays TRUSTED in every window, and the same trace with a 12 km
teleport injected at t=60s and a desk-spoof (phone stationary, GPS driving) at t=110-160s.
Actual output from the spoofed scenario:

```
Scenario 2: same drive with teleport @60s + desk-spoof @110-160s
------------------------------------------------------------------
  t=     1-    30s  TRUSTED    failed=[-]  all physics checks passed
  ...
  t=    46-    75s  DENIED     failed=[temporal]  temporal: position jumped 1089 km/h between fixes at t=61 ...
  t=    61-    90s  RECOVERING failed=[-]  clean window 1 of 5 required for recovery
  t=    76-   105s  RECOVERING failed=[-]  clean window 2 of 5 required for recovery
  t=    91-   120s  DENIED     failed=[environmental]  relapse during recovery: environmental: accelerometer show...
  t=   106-   135s  DENIED     failed=[environmental]  still denied - environmental: accelerometer shows device s...
  ...
  -> DENIED windows: 6/11; clean run stayed TRUSTED: True
     (recovery would need 5 consecutive clean windows after the last attack)
```

The spoofed run goes DENIED around the teleport, starts RECOVERING while the attack pauses,
then relapses to DENIED when the desk-spoof begins — exactly the state machine's
no-direct-recovery rule doing its job. The clean trace stays TRUSTED across all 11 windows.

## Current status

This is a laptop-only Python PoC validated entirely on synthetic data. Nothing here runs on
Android hardware yet. Two documents cover the path from here to a phone:

- [docs/sensor_pipeline_spec.md](docs/sensor_pipeline_spec.md) — how raw sensor data flows on a
  real Android device, realistic sampling rates, ring-buffer windowing per check, and the honest
  synthetic-to-real noise problems (gravity separation, magnetometer calibration, barometric drift).
- [docs/android_integration_plan.md](docs/android_integration_plan.md) — port risk ranking,
  permissions, minimal demo UI, and an hour-by-hour plan for the 30-hour build window.

## Test results

From `docs/test_report.md` (Python 3.13, pytest-cov):

- **61 tests collected / 61 passed / 0 failed**, ~0.7 s.
- **Total statement coverage: 96%** (497 statements, 20 missed). Per-file: simulate 99%,
  altitude/fusion/sensors 100%, solar 83% (the lowest).

Required scenarios covered:

- Negation pairs — decelerating-but-still-rolling passes while an instant stop from speed flags;
  single-sample heading divergence during a turn passes while sustained divergence flags;
  a brief pressure blip passes while a sustained GNSS/barometer split flags.
- Exactly one weak failing check produces DEGRADED, not DENIED; two weak failures produce DENIED.
- Recovery sequence — never DENIED→TRUSTED directly; five consecutive clean windows through
  RECOVERING; relapse restarts; end-to-end teleport-caught-then-recovers integration test.
- Solar math checked against a real-world almanac fact (London, June 21, solar noon).
- End-to-end verdict-sequence test over mixed clean/spoofed traces asserting a full
  TRUSTED → DENIED → RECOVERING → DENIED progression.

## Project structure

```
poc/
├── pyproject.toml              # src/ layout package; zero runtime deps
├── LICENSE                     # MIT
├── docs/
│   ├── sensor_pipeline_spec.md       # Android sensor pipeline design
│   ├── android_integration_plan.md   # 30-hour port plan
│   └── test_report.md                # coverage and scenario report
├── examples/
│   └── run_demo.py             # clean vs spoofed trace, side by side
├── src/anchor/
│   ├── sensors.py              # GnssFix, ImuSample, BarometerSample, MagnetometerSample
│   ├── fusion.py               # runs all six checks over one window
│   ├── state_machine.py        # TRUSTED/DEGRADED/DENIED/RECOVERING verdict table
│   ├── simulate.py             # deterministic seeded synthetic traces
│   └── checks/
│       ├── kinematic.py        # ~1.2 g vehicle acceleration ceiling
│       ├── heading.py          # sustained >30-40° GNSS-vs-magnetometer divergence
│       ├── temporal.py         # >1000 km/h teleport backstop
│       ├── altitude.py         # barometric vs GNSS altitude, weather tolerance
│       ├── environmental.py    # stationary accelerometer vs moving GNSS
│       └── solar.py            # NOAA solar azimuth vs claimed heading
└── tests/                      # 61 tests, incl. negation pairs and integration sequences
```

## What's next

What the remaining hackathon window would realistically add:

- Port the pipeline to Android (Kotlin) per the integration plan — foreground service,
  ring buffers, SensorManager wiring.
- Retune thresholds on real sensor noise: measured accelerometer variance floors on actual demo
  devices, magnetometer residuals after rotation-vector calibration, barometric re-zeroing.
- Enrich with `GnssMeasurements` (C/N0 spread, AGC) as a seventh signal — chipset-dependent,
  so enrichment only, never load-bearing.
- Handle abstention properly in the UI: indoors or without a barometer, several checks can't vote,
  and "insufficient evidence" is a better answer than a confident wrong one.

MIT licensed — see [LICENSE](LICENSE).
