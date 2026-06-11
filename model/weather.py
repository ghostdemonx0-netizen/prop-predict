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


def weather_hr_multiplier(wind_out_mph: float, temp_f: float, dome: bool) -> float:
    """Multiplicative HR adjustment from wind and temperature.

    Domed/closed-roof parks are neutral (1.0). Otherwise each mph blowing
    out adds ~2%, and each degree above 70F adds ~0.5%. Clamped to [0.7, 1.4].
    """
    if dome:
        return 1.0
    mult = 1.0 + 0.02 * wind_out_mph + 0.005 * (temp_f - 70.0)
    return max(0.7, min(1.4, mult))
