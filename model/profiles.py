"""Pure profile math from slim Statcast event rows.

Profiles are computed *as of* a slate date: only games strictly before
``as_of`` count, and the recent-form window is anchored to ``as_of``, so
regenerating a past date cannot peek at games played after it (no
lookahead bias in backfills or future backtests).
"""

from model.blend import marcel_blend, regress
from model.projections import LEAGUE_HR_RATE
from model.matchup import LEAGUE_K, LEAGUE_HIT
from model.run_props import RECENT_GAMES_WINDOW

_HR_R, _K_R, _HIT_R = 300.0, 200.0, 200.0

_RECENT_BIP = 55          # recent-form window size in batted balls; tunable
_RECENT_SHRINK_R = 25.0   # shrinkage weight toward season hard-hit rate; tunable

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
    s1 = sum(1 for e in pa_rows if e["events"] == "single")
    s2 = sum(1 for e in pa_rows if e["events"] == "double")
    s3 = sum(1 for e in pa_rows if e["events"] == "triple")

    bip = [e for e in past if e["launch_speed"] is not None]
    # season_hard is the full-season baseline (includes the recent window). recent
    # form = last _RECENT_BIP batted balls, shrunk toward season by sample size so
    # thin samples don't over-swing. The overlap mutes the delta slightly but
    # direction is always preserved (hot -> >1, cold -> <1).
    season_hard = _hard_hit_rate(bip)
    recent = sorted(bip, key=lambda e: e["game_date"])[-_RECENT_BIP:]
    n = len(recent)
    recent_hard_raw = _hard_hit_rate(recent) if n else season_hard
    shrunk = (recent_hard_raw * n + season_hard * _RECENT_SHRINK_R) / (n + _RECENT_SHRINK_R)
    recent_form_mult = max(0.8, min(1.25, 1.0 + (shrunk - season_hard) * 1.5))

    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "bats": bats,
        "season_hr": hr,
        "season_pa": pa,
        "season_1b": s1,
        "season_2b": s2,
        "season_3b": s3,
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
    """(pa, hr, ks, hits, s1, s2, s3) strictly before as_of — same rules as batter_profile_from_events."""
    pa_rows = [e for e in events if e["game_date"] < as_of and e["events"]]
    pa = len(pa_rows)
    hr = sum(1 for e in pa_rows if e["events"] == "home_run")
    ks = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)
    s1 = sum(1 for e in pa_rows if e["events"] == "single")
    s2 = sum(1 for e in pa_rows if e["events"] == "double")
    s3 = sum(1 for e in pa_rows if e["events"] == "triple")
    return pa, hr, ks, hits, s1, s2, s3


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
    counts = [_count_batter(evs, as_of) for evs in seasons]   # [(pa,hr,ks,hits,s1,s2,s3), ...]
    hr_made, eff_pa = marcel_blend([(c[1], c[0]) for c in counts])
    ks_made, _ = marcel_blend([(c[2], c[0]) for c in counts])
    hits_made, _ = marcel_blend([(c[3], c[0]) for c in counts])
    s1_made, _ = marcel_blend([(c[4], c[0]) for c in counts])
    s2_made, _ = marcel_blend([(c[5], c[0]) for c in counts])
    s3_made, _ = marcel_blend([(c[6], c[0]) for c in counts])
    prof["season_hr"] = hr_made          # HR regression stays inside hr_probability (R=300)
    prof["season_pa"] = eff_pa
    prof["season_1b"] = s1_made
    prof["season_2b"] = s2_made
    prof["season_3b"] = s3_made
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


def _gamelog_totals(logs: list[dict]) -> tuple[int, int, int, int]:
    """(games, total_r, total_rbi, total_hrr) for one season of game logs."""
    g = len(logs)
    tr = sum(int(x.get("r", 0)) for x in logs)
    trbi = sum(int(x.get("rbi", 0)) for x in logs)
    thrr = sum(int(x.get("h", 0)) + int(x.get("r", 0)) + int(x.get("rbi", 0)) for x in logs)
    return g, tr, trbi, thrr


def with_gamelog(profile: dict, gamelogs_by_season: dict, *, current_season: int) -> dict:
    """Merge per-game R/RBI/HRR season totals (+ Marcel-blended hist twins) into a profile."""
    p = dict(profile)
    cur = gamelogs_by_season.get(current_season, [])
    g, tr, trbi, thrr = _gamelog_totals(cur)
    p["games"], p["total_r"], p["total_rbi"], p["total_hrr"] = g, tr, trbi, thrr
    seasons = [current_season, current_season - 1, current_season - 2]
    per = [_gamelog_totals(gamelogs_by_season.get(s, [])) for s in seasons]
    # marcel_blend((made, games)) -> (eff_made, eff_games) on a single-season scale
    eff_g = marcel_blend([(g_, g_) for (g_, _, _, _) in per])[0]
    eff_r = marcel_blend([(tr_, g_) for (g_, tr_, _, _) in per])[0]
    eff_rbi = marcel_blend([(trbi_, g_) for (g_, _, trbi_, _) in per])[0]
    eff_hrr = marcel_blend([(thrr_, g_) for (g_, _, _, thrr_) in per])[0]
    p["games_hist"], p["total_r_hist"], p["total_rbi_hist"], p["total_hrr_hist"] = eff_g, eff_r, eff_rbi, eff_hrr
    # Recent-window totals: last RECENT_GAMES_WINDOW games of the current season only
    recent = sorted(cur, key=lambda x: x["game_date"])[-RECENT_GAMES_WINDOW:] if cur else []
    rg, rr, rrbi, rhrr = _gamelog_totals(recent)
    p["recent_games"], p["recent_r"], p["recent_rbi"], p["recent_hrr"] = rg, rr, rrbi, rhrr
    return p
