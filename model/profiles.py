"""Pure profile math from slim Statcast event rows.

Profiles are computed *as of* a slate date: only games strictly before
``as_of`` count, and the recent-form window is anchored to ``as_of``, so
regenerating a past date cannot peek at games played after it (no
lookahead bias in backfills or future backtests).
"""

import datetime as dt

_K_EVENTS = ("strikeout", "strikeout_double_play")
_HIT_EVENTS = ("single", "double", "triple", "home_run")


def _hard_hit_rate(rows: list[dict]) -> float:
    if not rows:
        return 0.0
    return sum(1 for e in rows if e["launch_speed"] >= 95) / len(rows)


def batter_profile_from_events(events: list[dict], *, as_of: str, player_id: int,
                               name: str = "", team: str = "", bats: str = "") -> dict:
    """events: [{game_date, events, launch_speed}, ...] for one batter-season."""
    # Strictly-before: excludes all events on as_of itself, including same-day
    # doubleheader game 1. Acceptable v1 simplification.
    past = [e for e in events if e["game_date"] < as_of]
    pa_rows = [e for e in past if e["events"]]
    pa = len(pa_rows)
    hr = sum(1 for e in pa_rows if e["events"] == "home_run")
    ks = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)

    bip = [e for e in past if e["launch_speed"] is not None]
    season_hard = _hard_hit_rate(bip)
    cutoff = (dt.date.fromisoformat(as_of) - dt.timedelta(days=15)).isoformat()
    recent = [e for e in bip if e["game_date"] >= cutoff]
    recent_hard = _hard_hit_rate(recent) if recent else season_hard
    recent_form_mult = max(0.8, min(1.25, 1.0 + (recent_hard - season_hard) * 1.5))

    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "bats": bats,
        "season_hr": hr,
        "season_pa": pa,
        "recent_form_mult": recent_form_mult,
        "k_rate": (ks / pa) if pa else 0.0,
        "hit_rate": (hits / pa) if pa else 0.0,
    }


def pitcher_profile_from_events(events: list[dict], *, as_of: str, player_id: int,
                                name: str = "", team: str = "", throws: str = "",
                                k_line: float = 5.5) -> dict:
    """events: [{game_date, events, game_pk}, ...] for one pitcher-season."""
    past = [e for e in events if e["game_date"] < as_of]
    pa_rows = [e for e in past if e["events"]]
    pa = len(pa_rows)
    ks = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)
    hr = sum(1 for e in pa_rows if e["events"] == "home_run")
    games = len({e["game_pk"] for e in past if e["game_pk"] is not None})

    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "throws": throws,
        "k_per_bf": (ks / pa) if pa else 0.0,
        "expected_bf": (pa / games) if games else 24.0,
        "opponent_k_mult": 1.0,
        "k_line": k_line,
        "hit_allowed_rate": (hits / pa) if pa else 0.0,
        "hr_allowed_rate": (hr / pa) if pa else 0.0,
        "bf": pa,
    }
