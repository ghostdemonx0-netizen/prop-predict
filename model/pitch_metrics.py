"""Pure pitch-level metrics from slim per-pitch rows. SwStr% / CSW% / Ball% over
all pitches strictly before as_of. (For a batter: pitches thrown to him -> his
whiff rate. For a pitcher: pitches he threw -> his induced rate.) No I/O."""

_SWSTR = {"swinging_strike", "swinging_strike_blocked"}
_CSW = _SWSTR | {"called_strike"}
_BALL = {"ball", "blocked_ball"}


def pitch_rates(pitches: list[dict], *, as_of: str) -> dict:
    past = [p for p in pitches if p["game_date"] < as_of and p.get("description")]
    n = len(past)

    def rate(kinds: set) -> float:
        return (sum(1 for p in past if p.get("description") in kinds) / n) if n else 0.0

    return {"swstr": rate(_SWSTR), "csw": rate(_CSW), "ball": rate(_BALL), "pitches": n}


_ZONES = tuple(range(1, 10)) + (11, 12, 13, 14)
_ZONE_PRIOR = 10.0        # regress thin zones toward the hitter's overall xwOBAcon; SEED
_LEAGUE_XWOBACON = 0.37   # fallback when a hitter has no batted balls; SEED


def zone_damage(pitches: list[dict], *, as_of: str) -> dict:
    """Hitter's per-zone damage: mean estimated_woba on his batted balls per zone,
    regressed toward his overall xwOBAcon for thin zones."""
    bbe = [p for p in pitches if p["game_date"] < as_of and p.get("bb_type") is not None
           and p.get("estimated_woba_using_speedangle") is not None and p.get("zone") is not None]
    overall = (sum(p["estimated_woba_using_speedangle"] for p in bbe) / len(bbe)) if bbe else _LEAGUE_XWOBACON
    dmg = {}
    for z in _ZONES:
        vals = [p["estimated_woba_using_speedangle"] for p in bbe if int(p["zone"]) == z]
        dmg[z] = (sum(vals) + overall * _ZONE_PRIOR) / (len(vals) + _ZONE_PRIOR)
    return dmg


def zone_freq(pitches: list[dict], *, as_of: str) -> dict:
    """Pitcher's per-zone pitch frequency (sums to 1 when any pitches)."""
    past = [p for p in pitches if p["game_date"] < as_of and p.get("zone") is not None]
    n = len(past)
    return {z: (sum(1 for p in past if int(p["zone"]) == z) / n) if n else 0.0 for z in _ZONES}


def zone_fit(dmg: dict, freq: dict) -> float:
    """Hitter's damage weighted by where THIS pitcher lives. 0.0 with no data."""
    return round(sum(dmg.get(z, 0.0) * freq.get(z, 0.0) for z in _ZONES), 4)
