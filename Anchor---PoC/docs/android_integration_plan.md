# Anchor — Android Integration Plan (30-hour build)

Companion to `sensor_pipeline_spec.md`. This is the concrete plan for porting the Python PoC's
six checks onto real Android hardware inside the hackathon window, with honest statements about
what will and will not fit.

Scope assumption: one or two engineers, one primary Android demo device, the existing Python PoC
as algorithmic reference. Every hour below is wall-clock, not idealized.

Guiding principle: the demo must survive losing any single check. Each check registers as
pass/fail/abstain and fusion treats abstain as neutral, so an unfinished or misbehaving check is
disabled rather than debugged live. This is what makes the risky ordering in section 1 safe.

## 1. Port risk ranking of the six checks

| Rank | Check | Risk | Reasoning |
|---|---|---|---|
| 1 (easiest) | Temporal/teleport | Low | Pure fix-vs-fix arithmetic; no cross-sensor alignment, no calibration. Works with GNSS alone. |
| 2 | Kinematic | Low-medium | Needs accel + fixes, but vehicle-scale accelerations dwarf gravity-separation residuals. Threshold may need one retune. |
| 3 | Altitude | Medium | Logic is simple; the risk is barometer absence on test devices and drift behavior that only shows over real time spans. Degrades gracefully to abstain. |
| 4 | Environmental | **High** | Looks for *near-zero* variance, so it sits on the worst part of the noise floor: gravity separation errors, hand tremor, sensor bias. Both false-positive and false-negative modes are plausible on hardware. Requires empirical tuning on the actual device. |
| 5 | Heading | **High** | Magnetometer hard/soft-iron calibration is device- and environment-specific; magnetic interference (EV chargers, mounts) mimics spoofing divergence exactly; GNSS course-over-ground is noisy at pedestrian speeds. Sustained-divergence windowing must be validated against real turn dynamics. |
| 6 | Solar | **Highest** (for demo reliability) | Real solar-position math is fine; the problem is device-orientation ambiguity on a handheld phone — "heading" only means something when the phone is roughly flat and steady, which is unnatural during a driving demo. Plus the clock-circularity caveat from the spec. |

Reasoning behind the ranking: temporal and kinematic are GNSS-plus-accelerometer arithmetic whose
tolerances (1000 km/h implied speed, ~1.2 g acceleration ceiling) sit far above realistic sensor
noise, which is why they go first and unblock fusion + state machine work early. Environmental
and heading are the two genuinely tricky ports against real noise: environmental hunts near-zero
variance where gravity-separation error and hand tremor live; heading fights magnetometer
calibration and environmental magnetic interference that mimics spoofing exactly. Solar is
algorithmically solved but demo-fragile because of device-orientation ambiguity on a handheld
phone, so it ships last behind an orientation gate. Altitude sits in between: trivial logic, but
its drift behavior only shows over real time spans and it degrades gracefully via abstention.

## 2. Permissions and capability gating

| Permission / API | Purpose | Notes |
|---|---|---|
| `ACCESS_FINE_LOCATION` | GNSS fixes | runtime permission; request up front |
| `ACCESS_COARSE_LOCATION` | fallback / paired request | request together with fine |
| `HIGH_SAMPLERATE_SENSORS` (API 31+) | >200 Hz sensor events | we target ~50 Hz so technically optional, but declare it to avoid rate caps on some devices |
| `FOREGROUND_SERVICE` (+ `FOREGROUND_SERVICE_LOCATION` on API 34+) | continuous sensing while screen off / app backgrounded | mandatory for our use case; persistent notification shown anyway |
| `POST_NOTIFICATIONS` (API 33+) | DENIED alert + FGS notification | runtime permission on 13+ |

Capability gating at startup:

- `LocationManager.getGnssCapabilities()` → does this chipset support GnssMeasurements at all?
  If not, raw-GNSS enrichment stays disabled permanently (it is non-load-bearing in v1).
- `SensorManager.getDefaultSensor(TYPE_PRESSURE)` → null means the altitude check registers as
  permanently abstaining.
- Sensor min-delay probing to confirm achievable ~50 Hz accelerometer/magnetometer rates.

All gating decisions surface in the UI as per-check "abstain: no barometer" style reason strings,
so judges see why a check is greyed out instead of wondering.

Permission request flow: fine+coarse location and notifications requested from the activity on
first launch; if denied, one explanatory screen and a single re-request. No retry loops — judges
get handed a working phone, not a permission dialog.

## 3. Verdict surfacing — minimal demo UI

Architecture: foreground service owns sensing + pipeline; one activity binds to it and renders.

- Persistent low-priority notification while running (FGS requirement).
- Main screen: large colored state chip — green TRUSTED, yellow DEGRADED/RECOVERING, red DENIED
  (RECOVERING gets a distinct outline or pulse rather than a fifth color).
- Below the chip: six rows, one per check, each showing current vote (pass/fail/abstain) and a
  short reason string ("teleport: 2400 km/h implied", "heading: sustained 52° divergence over 14 samples").
- A DENIED transition triggers a high-priority notification immediately.
- Optional debug plot of divergence angles / variance, time permitting — explicitly first thing cut.

No maps, no history graphs in v1. The state chip plus reason rows are the demo.

UI details that matter under demo pressure:

- State changes flash the chip border briefly so transitions are visible on video without narration.
- Reason strings are pre-written templates with values filled in, never raw dumps — they double as the judge-facing explanation of the physics.
- The service survives the activity being killed; reopening rebinds and shows current state instantly.
- A "simulate spoof" dev button (debug build only) toggles a scripted mock-location path, so the demo does not depend on a third-party spoofer app cooperating.

## 4. Hour-by-hour plan

| Hours | Work | Exit criterion |
|---|---|---|
| 0–2 | Project skeleton: FGS shell, permissions manifest, sensor registration plumbing, ring-buffer utilities, logging-to-file harness (traces are the tuning currency later); verify mock-location spoofer works on the demo device | service runs, logs raw sensors to file |
| 2–5 | Temporal + kinematic checks ported (GNSS-only parts first); walk/drive test around the venue; verify teleport detection with a scripted spoof | both checks vote correctly on a real walk and a scripted spoof jump |
| 5–8 | Environmental check: linear-acceleration variance window; measure actual variance floors sitting still / walking / driving on the demo device; set thresholds from traces | stationary = pass, walking with GNSS motion = pass, GPS-moves-phone-still = fail |
| 8–11 | Heading check: rotation-vector heading vs GNSS bearing, sustained-divergence buffer, declination constant; drive/walk turns must NOT trigger it | turns clean, sustained artificial divergence triggers |
| 11–12 | Checkpoint: fusion + state machine wired behind the four working checks; state transitions visible on device | full pipeline runs end-to-end with 4 checks |
| 12–14 | Altitude check incl. barometer-absent abstention path | votes sensibly indoors/outdoors; abstains cleanly if device lacks pressure |
| 14–17 | Solar check: solar-position algorithm port, orientation gate (require near-flat), system-time vs network-time sanity cross-check | works outdoors pointing the phone; abstains in pocket/indoors |
| 17–19 | Buffer/tuning pass using logged traces from earlier tests; widen thresholds where real noise bit; determinism check (replay trace → same verdicts) | no flapping across a 10-min mixed walk+drive trace |
| 19–22 | Demo UI within scope: state chip, reason rows, DENIED notification; GnssMeasurements attempted ONLY if everything above landed early | full scripted demo runs without restarts |
| 22–25 | Full dress rehearsal: complete scenario end-to-end (walk → mock-location teleport → DENIED → stop spoofing → RECOVERING → TRUSTED); fix what breaks; battery sanity | rehearsal passes twice consecutively |
| 25–28 | Slack — deliberately unallocated. Absorbs overrun from hours 8–11 (the risky block) or last-minute device issues | — |
| 28–30 | Freeze, second rehearsal on final build, prep fallback demo video/screenshots, judge-facing one-pager mapping reasons to physics | submission packaged |

Sequencing rationale: temporal + kinematic first because they need only GNSS plus light accel
processing and immediately exercise the whole plumbing (buffers, voting, state machine).
Environmental next because it completes the core "phone still while GPS moves" spoof scenario,
which is the money demo. Heading and altitude follow once the pipeline is stable. Solar last
because it can abstain harmlessly if it slips. GnssMeasurements work is parked until hour 22 and
only started if everything else landed — it never touches the critical path.

Testing methodology throughout: every test run writes a timestamped trace file (all sensor events
plus every check vote). Traces are replayed through the Python PoC's fusion logic to confirm the
Android port agrees with the reference implementation verdict-for-verdict. Cross-language replay
catches porting bugs faster than staring at logs.

Cuts are decided by rule, not mood: if a block overruns into the next block's time, the later
block shrinks and the cut table below applies top-down. Nothing from the cut table gets pulled
back in unless hour 25–28 slack goes untouched.

### Explicitly not fitting in 30 hours (and fallbacks)

| Cut item | Why it doesn't fit | Fallback |
|---|---|---|
| GnssMeasurements C/N0 / AGC analysis | chipset-dependent availability; needs cross-device data collection; analysis is a project by itself | register callback if capabilities allow and log C/N0 to file as future work; present as roadmap |
| Polished UI (plots, maps, theming) | zero detection value | colored chip + reason strings carry the demo |
| Multi-device threshold profiles | tuning is per-device empiricism | tune on the primary demo device; others run with loosened thresholds |
| Proper NTP clock verification | edge cases and venue network dependence | coarse system-time vs GNSS-time delta comparison only |
| Machine-learned anything | no training data in 30 h; deterministic physics checks are the pitch | deterministic state machine as designed |

## 5. Known demo risks

- Venue Wi-Fi density and indoor segments degrade GNSS — rehearse the exact outdoor route.
- Magnetic interference near parked EVs or laptop bags can trip heading — keep the demo phone away from magnets; the accuracy-gated abstention absorbs surprises.
- Device thermals: 20+ minutes of continuous sensing can throttle mid-rehearsal; rehearse on the same charge/thermal profile as the live demo.
- OEM battery managers killing foreground services must be exempted in developer settings during setup hours, not discovered at hour 25.
