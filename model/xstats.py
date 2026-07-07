"""Pure ISO + expected-wOBA (full) from slim PA-ending event rows. Display/context
stats (viewers), not barrel voters. No I/O; no lookahead."""

# PA-ending events that do NOT count as at-bats
_NON_AB = {"walk", "intent_walk", "hit_by_pitch", "sac_fly", "sac_bunt",
           "sac_fly_double_play", "sac_bunt_double_play", "catcher_interf"}
_XB = {"double": 1, "triple": 2, "home_run": 3}   # extra bases beyond a single


def iso(events: list[dict], *, as_of: str) -> dict:
    past = [e for e in events if e["game_date"] < as_of and e.get("events")]
    ab = sum(1 for e in past if e["events"] not in _NON_AB)
    xb = sum(_XB.get(e["events"], 0) for e in past)
    return {"iso": (xb / ab) if ab else 0.0}


def xwoba(events: list[dict], *, as_of: str, allowed: bool = False) -> dict:
    """Expected wOBA: estimated_woba on batted balls, actual woba_value on
    non-contact PA-enders; divided by summed woba_denom."""
    num = 0.0
    den = 0.0
    for e in events:
        if e["game_date"] >= as_of or not e.get("events"):
            continue
        wd = e.get("woba_denom") or 0
        if not wd:
            continue
        if e.get("bb_type") is not None and e.get("estimated_woba_using_speedangle") is not None:
            num += e["estimated_woba_using_speedangle"]
        else:
            num += e.get("woba_value") or 0.0
        den += wd
    val = round((num / den) if den else 0.0, 4)
    return {"xwoba_allowed": val} if allowed else {"xwoba": val}
