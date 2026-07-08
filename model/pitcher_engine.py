"""Barrel-blended pitcher rates. The blend IS regression — but toward the pitcher's
own barrel-implied rate instead of league average, sample-weighted. Barrel gets more
'votes' for luck-heavy rates (HR) than clean ones (Ks). All constants are SEEDs
(grader-tunable; league baselines join the data-driven-anchors item)."""

# league baselines for the barrel signals (SEEDs)
_LG_SWSTR = 0.11            # league swinging-strike rate  -> Ks
_LG_HARDHIT = 0.40         # league hard-hit-allowed rate -> hits
_LG_BARREL = 0.08          # league barrel-allowed rate   -> HR

# barrel "votes" per rate (bigger = barrel-generous / luck-heavier). SEEDs.
_VOTES_K, _VOTES_HIT, _VOTES_HR = 175.0, 350.0, 700.0

_RATIO_LO, _RATIO_HI = 0.5, 2.0   # clamp the barrel/league ratio


def _implied(league_rate: float, signal, league_signal: float) -> float:
    """A pitcher's barrel-implied rate: league_rate scaled by how his barrel signal
    compares to league (clamped). Missing signal -> league_rate (graceful)."""
    if not league_signal or signal is None:
        return league_rate
    ratio = signal / league_signal
    ratio = _RATIO_LO if ratio < _RATIO_LO else _RATIO_HI if ratio > _RATIO_HI else ratio
    return league_rate * ratio


def barrel_blended_rate(made: float, pa: float, *, signal, league_rate: float,
                        league_signal: float, votes: float) -> float:
    """Blend the pitcher's observed rate (made/pa) toward his barrel-implied rate,
    weighted by his sample (pa) vs `votes`. pa==votes -> 50/50 of observed & implied."""
    implied = _implied(league_rate, signal, league_signal)
    denom = pa + votes
    if denom <= 0:
        return implied
    return (made + implied * votes) / denom
