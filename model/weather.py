"""Pure weather math for HR modeling.

Open-Meteo reports wind direction as the compass bearing the wind is
COMING FROM (meteorological convention). A ball hit to center field
travels along `cf_bearing_deg`. Wind helps a CF home run when it blows
toward CF (i.e., its direction-of-travel aligns with cf_bearing_deg).
"""

import math


def wind_out_to_cf(wind_speed_mph: float, wind_from_deg: float, cf_bearing_deg: float) -> float:
    """Component of wind (mph) blowing OUT toward center field.

    Positive = blowing out (helps HRs), negative = blowing in.
    """
    wind_to_deg = (wind_from_deg + 180.0) % 360.0  # direction wind blows TOWARD
    angle = math.radians(wind_to_deg - cf_bearing_deg)
    return wind_speed_mph * math.cos(angle)


def wind_dir_rel_cf(wind_from_deg: float, cf_bearing_deg: float) -> float:
    """Direction the wind is blowing TOWARD, relative to center field.

    0 = out to center field, 90 = out to right field, 180 = in from center,
    270 = out to left field. (The website rotates the wind arrow by this angle.)
    """
    wind_to_deg = (wind_from_deg + 180.0) % 360.0
    return (wind_to_deg - cf_bearing_deg) % 360.0


def weather_hr_multiplier(wind_out_mph: float, temp_f: float, dome: bool) -> float:
    """Multiplicative HR adjustment from wind and temperature.

    Domed/closed-roof parks are neutral (1.0). Otherwise each mph blowing
    out adds ~2%, and each degree above 70F adds ~0.5%. Clamped to [0.7, 1.4].
    """
    if dome:
        return 1.0
    mult = 1.0 + 0.02 * wind_out_mph + 0.005 * (temp_f - 70.0)
    return max(0.7, min(1.4, mult))


# Field travel directions relative to CF (signed deg; - = LF side, + = RF side).
_FIELD_BEARING = {
    "R": {"pull": -45.0, "center": 0.0, "oppo": 45.0},   # RHB pulls to LF
    "L": {"pull": 45.0, "center": 0.0, "oppo": -45.0},   # LHB pulls to RF
}


def wind_out_directional(wind_speed_mph: float, wind_from_deg: float, cf_bearing_deg: float,
                         spray: dict, bats: str) -> float:
    """Wind (mph) blowing OUT, weighted across the batter's pull/center/oppo fields.

    Projects the full wind vector onto each field's travel direction and weights by
    how often the batter hits there. Reduces toward wind_out_to_cf when spray is
    centered. Positive = helps HRs, negative = blows in.
    """
    wind_to = (wind_from_deg + 180.0) % 360.0
    rel = ((wind_to - cf_bearing_deg + 180.0) % 360.0) - 180.0   # signed deg rel CF
    bearings = _FIELD_BEARING["L" if bats == "L" else "R"]
    out = 0.0
    for field in ("pull", "center", "oppo"):
        share = spray.get(field, 0.0)
        if share:
            out += share * wind_speed_mph * math.cos(math.radians(rel - bearings[field]))
    return out
