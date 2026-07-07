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
