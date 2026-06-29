import pytest
from model.weather import wind_out_to_cf, weather_hr_multiplier, wind_dir_rel_cf


def test_wind_dir_rel_cf():
    # CF bearing 0 (north). Wind from south (180) blows toward north -> out to CF (0).
    assert wind_dir_rel_cf(180, 0) == pytest.approx(0)
    # Wind from north (0) blows toward south -> in from CF (180).
    assert wind_dir_rel_cf(0, 0) == pytest.approx(180)
    # Wind from west (270) blows toward east -> out to right field (90).
    assert wind_dir_rel_cf(270, 0) == pytest.approx(90)
    # Wind from east (90) blows toward west -> out to left field (270).
    assert wind_dir_rel_cf(90, 0) == pytest.approx(270)
    # Park rotated: cf bearing 90, wind from 180 (toward 0) -> rel (0-90)%360 = 270.
    assert wind_dir_rel_cf(180, 90) == pytest.approx(270)


def test_wind_blowing_straight_out_to_cf_is_positive():
    # CF bearing 0 (due north). Wind COMING FROM south (180) blows toward north -> out to CF.
    out = wind_out_to_cf(wind_speed_mph=10, wind_from_deg=180, cf_bearing_deg=0)
    assert out == pytest.approx(10.0, abs=1e-6)


def test_wind_blowing_straight_in_is_negative():
    # Wind COMING FROM north (0) blows toward south -> in from CF.
    out = wind_out_to_cf(wind_speed_mph=10, wind_from_deg=0, cf_bearing_deg=0)
    assert out == pytest.approx(-10.0, abs=1e-6)


def test_crosswind_is_zero_component():
    # Wind coming from west (270) blows toward east; CF due north -> perpendicular.
    out = wind_out_to_cf(wind_speed_mph=10, wind_from_deg=270, cf_bearing_deg=0)
    assert out == pytest.approx(0.0, abs=1e-6)


def test_weather_multiplier_boosts_with_wind_out_and_heat():
    # 10 mph out, 80F: 1 + 0.02*10 + 0.005*(80-70) = 1.25
    assert weather_hr_multiplier(wind_out_mph=10, temp_f=80, dome=False) == pytest.approx(1.25)


def test_weather_multiplier_is_one_in_dome():
    assert weather_hr_multiplier(wind_out_mph=15, temp_f=95, dome=True) == 1.0


def test_weather_multiplier_is_clamped():
    assert weather_hr_multiplier(wind_out_mph=100, temp_f=120, dome=False) == pytest.approx(1.4)
    assert weather_hr_multiplier(wind_out_mph=-100, temp_f=10, dome=False) == pytest.approx(0.7)


# --- directional (spray-weighted) wind ---
from model.weather import wind_out_directional


def test_dir_wind_lf_out_helps_rhb_pull_hitter():
    # cf=0; wind_from=135 -> wind_to=315 -> rel -45 (toward the LF pole) -> helps a RHB pull hitter
    spray = {"pull": 0.8, "center": 0.15, "oppo": 0.05}
    assert wind_out_directional(10, 135, 0, spray, "R") > 3.0


def test_dir_wind_lf_beats_rf_for_rhb_pull_hitter():
    spray = {"pull": 0.8, "center": 0.15, "oppo": 0.05}
    lf = wind_out_directional(10, 135, 0, spray, "R")   # rel -45 (LF, his pull)
    rf = wind_out_directional(10, 225, 0, spray, "R")   # rel +45 (RF, his oppo)
    assert lf > rf


def test_dir_wind_center_for_average_hitter():
    spray = {"pull": 0.5, "center": 0.3, "oppo": 0.2}
    assert wind_out_directional(10, 180, 0, spray, "R") > 6.5   # most of a 10mph CF wind credited
