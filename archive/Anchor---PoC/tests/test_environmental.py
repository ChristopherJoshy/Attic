import random

from anchor.checks.environmental import check_environmental
from anchor.simulate import generate_legitimate_trace, inject_stationary_phone_moving_gps


def test_phone_on_desk_while_gps_drives_flags():
    rng = random.Random(9)
    trace = generate_legitimate_trace(0.0, 120.0, "driving", rng)
    inject_stationary_phone_moving_gps(trace, 40.0, 100.0, rng)
    window_fixes = [f for f in trace.fixes if 45 <= f.timestamp_s <= 105]
    window_imu = [s for s in trace.imu_samples if 45 <= s.timestamp_s <= 105]
    result = check_environmental(window_fixes, window_imu)
    assert not result.passed
    assert "stationary" in result.reason.lower()


def test_genuine_drive_passes():
    rng = random.Random(4)
    trace = generate_legitimate_trace(0.0, 90.0, "driving", rng)
    result = check_environmental(trace.fixes[:80], trace.imu_samples[:800])
    assert result.passed, result.reason


def test_parked_car_with_gnss_jitter_passes():
    # Parked phone: IMU variance tiny AND GNSS phantom drift well under the
    # moving threshold - both sides agree nothing is happening.
    from anchor.sensors import GnssFix, ImuSample

    imu = [
        ImuSample(i * 0.1, (0.03, -0.02, 9.807 + ((-1) ** i) * 0.005))
        for i in range(400)
    ]
    # Phantom GNSS drift ~0.4 m/s: below the moving threshold on purpose.
    fixes = [
        GnssFix(
            float(i),
            51.5 + i * 0.4 * 0.9 / 6_371_000 * 0.1,
            -0.13,
            35.0,
            None,
        )
        for i in range(40)
    ]
    result = check_environmental(fixes, imu)
    assert result.passed


def test_scattered_stationary_blips_do_not_flag():
    # Isolated single-window stationary readings happen in real traffic
    # (smooth cruise segments); scattered, they must never build a run.
    from anchor.sensors import ImuSample

    rng = random.Random(21)
    trace = generate_legitimate_trace(0.0, 60.0, "driving", rng)
    blip_times = set()
    for base in range(10, 50, 9):  # sparse: one 1 s blip every 9 s
        for k in range(10):
            blip_times.add(round(base + k * 0.1, 1))
    patched = []
    for sample in trace.imu_samples:
        if round(sample.timestamp_s, 1) in blip_times:
            patched.append(ImuSample(sample.timestamp_s, (0.03, -0.02, 9.807)))
        else:
            patched.append(sample)
    result = check_environmental(trace.fixes, patched)
    assert result.passed


def test_short_contradiction_below_threshold_degrades_confidence_only():
    # 3 s of contradiction is under MIN_CONTRADICTION_WINDOWS=4: suspicious
    # but not conviction.
    from anchor.sensors import GnssFix, ImuSample

    imu = []
    fixes = []
    for i in range(600):
        t = i * 0.1
        if 20.0 <= t <= 23.0:
            imu.append(ImuSample(t, (0.03, -0.02, 9.807)))
        else:
            imu.append(ImuSample(t, (0.5, -0.3, 9.81 + 0.9 * abs(((t / 7) % 1) - 0.5))))
    for i in range(60):
        t = float(i)
        fixes.append(GnssFix(t, 51.5 + t * 10.0 / 6_371_000, -0.13, 35.0, None))
    result = check_environmental(fixes, imu)
    assert result.passed


def test_insufficient_imu_abstains():
    from anchor.sensors import GnssFix, ImuSample

    fixes = [GnssFix(float(i), 51.5, -0.13, 35.0, None) for i in range(10)]
    imu = [ImuSample(float(i), (0.03, -0.02, 9.807)) for i in range(10)]
    result = check_environmental(fixes, imu)
    assert result.passed
    assert result.confidence == 0.0
