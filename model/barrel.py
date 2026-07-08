"""Pure barrel / batted-ball quality metrics from slim Statcast event rows.

Statcast's own quality class lives in `launch_speed_angle` (1-6); value 6 = Barrel.
Fly balls come from `bb_type`; xwOBAcon = mean `estimated_woba_using_speedangle`
over batted balls. Pull side reuses model.spray. No I/O; no lookahead.
"""
from model.spray import spray_angle

_BARREL_CODE = 6
_SWEETSPOT_LO, _SWEETSPOT_HI = 8.0, 32.0
_HARDHIT_MPH = 95.0

_KEYS = ("barrel_rate", "pulled_barrel_rate", "sweetspot_rate", "fb_rate",
         "hardhit_rate", "la_mean", "xwobacon", "hrfb_rate", "bbe")


def is_barrel(row: dict) -> bool:
    """Statcast barrel = launch_speed_angle code 6."""
    return row.get("launch_speed_angle") == _BARREL_CODE


def is_pulled_barrel(row: dict) -> bool:
    """A barrel hit to the batter's pull half of the field.

    Follows the Statcast / Barrel-Lab standard: any barrel whose spray angle
    (measured from home plate via atan2) falls strictly on the batter's pull
    side — negative angle for RHB (toward LF), positive for LHB (toward RF).
    No center exclusion zone. This aligns pulled_barrel_rate with the
    published reference values; the old ±15° center zone was systematically
    under-counting pull barrels by 30-60% vs Barrel Lab.
    Missing hc_x / hc_y → False (excluded from pull count, stays in BBE denom).
    """
    if not is_barrel(row):
        return False
    hx, hy, stand = row.get("hc_x"), row.get("hc_y"), row.get("stand")
    if hx is None or hy is None or not stand:
        return False
    angle = spray_angle(hx, hy)
    return angle < 0 if stand == "R" else angle > 0


def barrel_metrics(events: list[dict], *, as_of: str, allowed: bool = False) -> dict:
    """Season barrel/batted-ball rates from events strictly before `as_of`.

    BBE = batted balls in play = rows with a `bb_type`
    (ground_ball/fly_ball/line_drive/popup). We do NOT use `launch_speed is not
    None`, because fouls are tracked with an exit velo but have no `bb_type`, and
    counting them nearly doubles the denominator and halves every rate (verified:
    Judge 2024 hard-hit 36% via launch_speed vs 62% via bb_type — the latter
    matches Baseball Savant). Rates are count/len(BBE), 0.0 when no BBE.
    `allowed=True` suffixes every key with `_allowed` (pitcher profiles).
    """
    past = [e for e in events if e["game_date"] < as_of]
    bip = [e for e in past if e.get("bb_type") is not None]
    n = len(bip)

    def rate(cnt: int) -> float:
        return cnt / n if n else 0.0

    barrels = sum(1 for e in bip if is_barrel(e))
    pulled = sum(1 for e in bip if is_pulled_barrel(e))
    sweet = sum(1 for e in bip
                if e.get("launch_angle") is not None
                and _SWEETSPOT_LO <= e["launch_angle"] <= _SWEETSPOT_HI)
    hard = sum(1 for e in bip
               if e.get("launch_speed") is not None and e["launch_speed"] >= _HARDHIT_MPH)
    fbs = [e for e in bip if e.get("bb_type") == "fly_ball"]
    la_vals = [e["launch_angle"] for e in bip if e.get("launch_angle") is not None]
    xw_vals = [e["estimated_woba_using_speedangle"] for e in bip
               if e.get("estimated_woba_using_speedangle") is not None]
    hr_fb = sum(1 for e in fbs if e["events"] == "home_run")

    m = {
        "barrel_rate": rate(barrels),
        "pulled_barrel_rate": rate(pulled),
        "sweetspot_rate": rate(sweet),
        "fb_rate": rate(len(fbs)),
        "hardhit_rate": rate(hard),
        "la_mean": (sum(la_vals) / len(la_vals)) if la_vals else 0.0,
        "xwobacon": (sum(xw_vals) / len(xw_vals)) if xw_vals else 0.0,
        "hrfb_rate": (hr_fb / len(fbs)) if fbs else 0.0,
        "bbe": n,
    }
    if allowed:
        return {f"{k}_allowed": m[k] for k in _KEYS}
    return m
