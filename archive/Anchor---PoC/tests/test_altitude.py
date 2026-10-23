from anchor.checks.altitude import check_altitude, pressure_to_altitude_m
from anchor.sensors import BarometerSample, GnssFix
from anchor.simulate import _altitude_to_pressure_hpa

LAT = 51.5
LON = -0.13


def _pair(t_s, altitude_m, weather_offset_hpa=0.0):
    """A fix plus the barometer reading the same moment."""
    pressure = _altitude_to_pressure_hpa(altitude_m) + weather_offset_hpa
    return GnssFix(t_s, LAT, LON, altitude_m, None), BarometerSample(t_s, pressure)


def test_standard_atmosphere_roundtrip():
    # 1013.25 hPa must be exactly 0 m; known ISA checkpoints to ~meter level.
    assert pressure_to_altitude_m(1013.25) == 0.0
    assert abs(pressure_to_altitude_m(1000.0) - 111.0) < 2.0
    assert abs(pressure_to_altitude_m(900.0) - 988.0) < 5.0


def test_matching_altitudes_pass():
    pairs = [_pair(float(i), 35.0) for i in range(10)]
    result = check_altitude([f for f, _ in pairs], [b for _, b in pairs])
    assert result.passed


def test_weather_pressure_drift_passes():
    # A slow 2.5 hPa weather offset is ~60 m of phantom altitude; the wide
    # tolerance exists precisely so this does NOT flag.
    pairs = [_pair(float(i), 35.0, weather_offset_hpa=2.5) for i in range(10)]
    result = check_altitude([f for f, _ in pairs], [b for _, b in pairs])
    assert result.passed, result.reason


def test_brief_pressure_blip_vs_sustained_divergence():
    """Negation pair: a one-sample blip passes, sustained offset flags."""
    blip_fixes, blip_samples = [], []
    for i in range(12):
        # 3 hPa blip (~80 m): real devices see this from a door opening.
        offset_hpa = 3.0 if i == 6 else 0.0
        fix, baro = _pair(float(i), 35.0, weather_offset_hpa=offset_hpa)
        blip_fixes.append(fix)
        blip_samples.append(baro)
    blip_result = check_altitude(blip_fixes, blip_samples)
    assert blip_result.passed, f"brief blip flagged: {blip_result.reason}"

    sustained_fixes, sustained_samples = [], []
    for i in range(12):
        # GNSS claims 435 m while the barometer keeps reading true 35 m
        # pressure: no weather explains a constant 400 m split.
        fix = GnssFix(float(i), LAT, LON, 35.0 + 400.0, None)
        baro = BarometerSample(float(i), _altitude_to_pressure_hpa(35.0))
        sustained_fixes.append(fix)
        sustained_samples.append(baro)
    sustained_result = check_altitude(sustained_fixes, sustained_samples)
    assert not sustained_result.passed
    assert sustained_result.confidence > 0.7


def test_missing_barometer_abstains():
    fixes = [GnssFix(float(i), LAT, LON, 35.0, None) for i in range(10)]
    result = check_altitude(fixes, [])
    assert result.passed
    assert result.confidence == 0.0


def test_gnss_altitude_lie_with_honest_barometer_flags():
    """Spoofer moves position but forgets the pressure sensor disagrees."""
    rng_fixes, rng_baros = [], []
    for i in range(10):
        t = float(i)
        rng_fixes.append(GnssFix(t, LAT, LON, 800.0, None))  # claims mountain
        rng_baros.append(
            BarometerSample(t, _altitude_to_pressure_hpa(35.0))  # says 35 m truth
        )
    result = check_altitude(rng_fixes, rng_baros)
    assert not result.passed
