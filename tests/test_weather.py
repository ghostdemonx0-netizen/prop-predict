import pytest
from model.weather import wind_out_to_cf, weather_hr_multiplier


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
