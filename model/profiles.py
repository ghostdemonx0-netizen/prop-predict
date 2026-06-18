"""Pure profile math from slim Statcast event rows.

Profiles are computed *as of* a slate date: only games strictly before
``as_of`` count, and the recent-form window is anchored to ``as_of``, so
regenerating a past date cannot peek at games played after it (no
lookahead bias in backfills or future backtests).
"""

import datetime as dt

from model.blend import marcel_blend, regress
from model.projections import LEAGUE_HR_RATE
from model.matchup import LEAGUE_K, LEAGUE_HIT

_HR_R, _K_R, _HIT_R = 300.0, 200.0, 200.0

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


def k_line_from_starts(ks_per_game: list[int], *, fallback: float = 4.5, min_games: int = 1) -> float:
    """Sportsbook-style strikeout line: the pitcher's median Ks per start,
    rounded to the nearest 0.5 (user-approved 2026-06-11/12, replacing the
    flat 5.5 placeholder — real prop lines are paywalled). Median, not mean,
    so one blowup or quick hook doesn't move his "typical night". His own
    games count from his very first start; only a true MLB debut (no starts
    at all) falls back, to a rookie-level 4.5.
    """
    if len(ks_per_game) < min_games:
        return fallback
    s = sorted(ks_per_game)
    n = len(s)
    med = s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
    line = round(med * 2) / 2
    if line == int(line):
        line -= 0.5  # books avoid whole-number lines (no pushes); 4 -> 3.5
    return max(0.5, line)


def pitcher_profile_from_events(events: list[dict], *, as_of: str, player_id: int,
                                name: str = "", team: str = "", throws: str = "",
                                k_line: float = 4.5) -> dict:
    """events: [{game_date, events, game_pk}, ...] for one pitcher-season."""
    past = [e for e in events if e["game_date"] < as_of]
    pa_rows = [e for e in past if e["events"]]
    pa = len(pa_rows)
    ks = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)
    hr = sum(1 for e in pa_rows if e["events"] == "home_run")
    ks_by_game: dict = {e["game_pk"]: 0 for e in past if e["game_pk"] is not None}
    for e in pa_rows:
        if e["game_pk"] is not None and e["events"] in _K_EVENTS:
            ks_by_game[e["game_pk"]] += 1
    games = len(ks_by_game)

    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "throws": throws,
        "k_per_bf": (ks / pa) if pa else 0.0,
        "expected_bf": (pa / games) if games else 24.0,
        "opponent_k_mult": 1.0,
        "k_line": k_line_from_starts(list(ks_by_game.values()), fallback=k_line),
        "hit_allowed_rate": (hits / pa) if pa else 0.0,
        "hr_allowed_rate": (hr / pa) if pa else 0.0,
        "bf": pa,
    }


# ---------------------------------------------------------------------------
# Multi-season blended profiles (history mode) — additive, do NOT modify above
# ---------------------------------------------------------------------------

def _count_batter(events: list[dict], as_of: str) -> tuple:
    """(pa, hr, ks, hits) strictly before as_of — same rules as batter_profile_from_events."""
    pa_rows = [e for e in events if e["game_date"] < as_of and e["events"]]
    pa = len(pa_rows)
    hr = sum(1 for e in pa_rows if e["events"] == "home_run")
    ks = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)
    return pa, hr, ks, hits


def _seasons_in_order(events_by_season: dict, current_season: int) -> list:
    return [events_by_season.get(current_season - i, []) for i in range(3)]


def blended_batter_profile(events_by_season: dict, *, as_of: str, current_season: int,
                           player_id: int, name: str = "", bats: str = "") -> dict:
    """Same shape as batter_profile_from_events but with season_hr/season_pa =
    normalized blended HR counts and k_rate/hit_rate = blended+regressed rates.
    recent_form_mult, name, bats come from the current season only."""
    # recent form + metadata come from the CURRENT season only (stays live)
    prof = batter_profile_from_events(events_by_season.get(current_season, []), as_of=as_of,
                                      player_id=player_id, name=name, bats=bats)
    seasons = _seasons_in_order(events_by_season, current_season)
    counts = [_count_batter(evs, as_of) for evs in seasons]   # [(pa,hr,ks,hits), ...]
    hr_made, eff_pa = marcel_blend([(c[1], c[0]) for c in counts])
    ks_made, _ = marcel_blend([(c[2], c[0]) for c in counts])
    hits_made, _ = marcel_blend([(c[3], c[0]) for c in counts])
    prof["season_hr"] = hr_made          # HR regression stays inside hr_probability (R=300)
    prof["season_pa"] = eff_pa
    prof["k_rate"] = regress(ks_made, eff_pa, LEAGUE_K, _K_R)
    prof["hit_rate"] = regress(hits_made, eff_pa, LEAGUE_HIT, _HIT_R)
    return prof


def _count_pitcher(events: list[dict], as_of: str) -> tuple:
    """(pa, ks, hits, hr) strictly before as_of."""
    pa_rows = [e for e in events if e["game_date"] < as_of and e["events"]]
    pa = len(pa_rows)
    ks = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)
    hr = sum(1 for e in pa_rows if e["events"] == "home_run")
    return pa, ks, hits, hr


def blended_pitcher_profile(events_by_season: dict, *, as_of: str, current_season: int,
                            player_id: int, name: str = "", throws: str = "") -> dict:
    """Same shape as pitcher_profile_from_events but with k_per_bf/hit_allowed_rate/
    hr_allowed_rate blended+regressed. expected_bf, k_line, bf come from the current season only."""
    # workload (expected_bf), k_line, bf come from the CURRENT season only
    prof = pitcher_profile_from_events(events_by_season.get(current_season, []), as_of=as_of,
                                       player_id=player_id, name=name, throws=throws)
    seasons = _seasons_in_order(events_by_season, current_season)
    counts = [_count_pitcher(evs, as_of) for evs in seasons]   # [(pa,ks,hits,hr), ...]
    ks_made, eff_pa = marcel_blend([(c[1], c[0]) for c in counts])
    hits_made, _ = marcel_blend([(c[2], c[0]) for c in counts])
    hr_made, _ = marcel_blend([(c[3], c[0]) for c in counts])
    prof["k_per_bf"] = regress(ks_made, eff_pa, LEAGUE_K, _K_R)
    prof["hit_allowed_rate"] = regress(hits_made, eff_pa, LEAGUE_HIT, _HIT_R)
    prof["hr_allowed_rate"] = regress(hr_made, eff_pa, LEAGUE_HR_RATE, _HR_R)
    return prof
