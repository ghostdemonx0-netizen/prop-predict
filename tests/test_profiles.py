import pytest
from model.profiles import batter_profile_from_events, pitcher_profile_from_events
from model.profiles import regress, LEAGUE_K, LEAGUE_HIT, _K_R, _HIT_R
from model.pitcher_engine import (barrel_blended_rate,
                                   _LG_SWSTR, _LG_HARDHIT, _LG_BARREL,
                                   _VOTES_K, _VOTES_HIT, _VOTES_HR)
from model.projections import LEAGUE_HR_RATE


def _ev(date, events=None, launch_speed=None):
    return {"game_date": date, "events": events, "launch_speed": launch_speed}


def test_batter_profile_counts_and_rates():
    events = [
        _ev("2026-06-01", "home_run", 105.0),
        _ev("2026-06-01", "strikeout"),
        _ev("2026-06-02", "single", 88.0),
        _ev("2026-06-02", None, 70.0),   # non-PA pitch: not a plate appearance
        _ev("2026-06-03", "field_out", 96.0),
    ]
    p = batter_profile_from_events(events, as_of="2026-06-10", player_id=1, name="Test", bats="L")
    assert p["season_pa"] == 4
    assert p["season_hr"] == 1
    assert p["k_rate"] == pytest.approx(regress(1, 4, LEAGUE_K, _K_R))   # regressed (was raw 0.25)
    assert p["hit_rate"] == pytest.approx(regress(2, 4, LEAGUE_HIT, _HIT_R))  # regressed (was raw 0.5)
    assert p["player_id"] == 1 and p["bats"] == "L"


def test_batter_profile_excludes_games_on_or_after_as_of():
    events = [_ev("2026-06-01", "home_run", 100.0), _ev("2026-06-05", "home_run", 100.0)]
    p = batter_profile_from_events(events, as_of="2026-06-05", player_id=1)
    assert p["season_hr"] == 1  # the as_of-day HR must NOT count (no lookahead)


def test_batter_recent_form_hot_when_recent_contact_harder():
    # 200 soft-season balls, then 55 hard recent balls — last 55 BIP are all hard
    season = [_ev("2026-04-01", "field_out", 85.0)] * 200
    hot = [_ev("2026-06-08", "field_out", 105.0)] * 55
    p = batter_profile_from_events(season + hot, as_of="2026-06-10", player_id=1)
    assert p["recent_form_mult"] > 1.0
    assert p["recent_form_mult"] <= 1.25


def test_pitcher_profile_from_events():
    events = [
        {"game_date": "2026-06-01", "events": "strikeout", "game_pk": 11},
        {"game_date": "2026-06-01", "events": "single", "game_pk": 11},
        {"game_date": "2026-06-06", "events": "home_run", "game_pk": 12},
        {"game_date": "2026-06-06", "events": "strikeout", "game_pk": 12},
    ]
    p = pitcher_profile_from_events(events, as_of="2026-06-10", player_id=2, throws="L")
    # no description/bb_type in these events → signal=0.0 → implied = league (neutral)
    assert p["k_per_bf"] == pytest.approx(
        barrel_blended_rate(2, 4, signal=0.0, league_rate=LEAGUE_K, league_signal=_LG_SWSTR, votes=_VOTES_K))
    assert p["hit_allowed_rate"] == pytest.approx(
        barrel_blended_rate(2, 4, signal=0.0, league_rate=LEAGUE_HIT, league_signal=_LG_HARDHIT, votes=_VOTES_HIT))
    assert p["hr_allowed_rate"] == pytest.approx(
        barrel_blended_rate(1, 4, signal=0.0, league_rate=LEAGUE_HR_RATE, league_signal=_LG_BARREL, votes=_VOTES_HR))
    assert p["expected_bf"] == pytest.approx(2.0)  # 4 PA over 2 games
    assert p["bf"] == 4
    assert p["k_line"] == 0.5 and p["throws"] == "L"  # 2 starts, 1 K each: median 1 -> 0.5


def test_pitcher_profile_no_data_defaults():
    p = pitcher_profile_from_events([], as_of="2026-06-10", player_id=3)
    # no data → pitch_rates returns swstr=0.0; zero signal → implied = LEAGUE_K (neutral); pa=0, votes dominate → LEAGUE_K
    assert p["k_per_bf"] == pytest.approx(LEAGUE_K)
    assert p["expected_bf"] == 24.0
    assert p["bf"] == 0


def test_batter_profile_no_data_defaults():
    p = batter_profile_from_events([], as_of="2026-06-10", player_id=4)
    assert p["season_pa"] == 0
    assert p["season_hr"] == 0
    assert p["k_rate"] == LEAGUE_K     # no data -> regresses to league (was 0.0)
    assert p["hit_rate"] == LEAGUE_HIT
    assert p["recent_form_mult"] == pytest.approx(1.0)
    assert p["name"] == "4"  # falls back to the id


def test_batter_recent_form_cold_clamps_at_floor():
    # 200 hard-season balls, then 55 very soft recent — enough to push to the floor
    hot_season = [_ev("2026-04-01", "field_out", 105.0)] * 200
    cold_recent = [_ev("2026-06-08", "field_out", 65.0)] * 55
    p = batter_profile_from_events(hot_season + cold_recent, as_of="2026-06-10", player_id=1)
    assert p["recent_form_mult"] == pytest.approx(0.8)  # clamped at the floor


def test_k_line_from_starts_always_ends_in_half():
    from model.profiles import k_line_from_starts
    assert k_line_from_starts([4, 6, 7]) == 5.5          # median 6 -> whole numbers drop to x.5
    assert k_line_from_starts([4, 5, 6, 8]) == 5.5       # even count -> mean of middle two
    assert k_line_from_starts([3, 3, 9]) == 2.5          # median 3 -> 2.5; resists one blowup
    assert k_line_from_starts([0, 0, 1]) == 0.5          # floor: a line is never below 0.5


def test_k_line_from_starts_uses_own_games_from_first_start():
    from model.profiles import k_line_from_starts
    assert k_line_from_starts([7, 8]) == 7.5             # 2 starts -> midpoint of the two
    assert k_line_from_starts([3]) == 2.5                # 1 start -> that game, bumped to .5


def test_k_line_from_starts_debut_falls_back_to_rookie_line():
    from model.profiles import k_line_from_starts
    assert k_line_from_starts([]) == 4.5                 # no MLB starts -> rookie-debut line
    assert k_line_from_starts([], fallback=5.0) == 5.0


def test_pitcher_profile_computes_personal_k_line():
    def _pev(date, events, pk):
        return {"game_date": date, "events": events, "game_pk": pk}
    # 3 games: 2 Ks, 1 K, 0 Ks (a no-K game must count as zero, not vanish)
    events = (
        [_pev("2026-05-01", "strikeout", 1)] * 2 + [_pev("2026-05-01", "single", 1)]
        + [_pev("2026-05-06", "strikeout", 2)] + [_pev("2026-05-06", "field_out", 2)]
        + [_pev("2026-05-11", "field_out", 3)] * 3
    )
    p = pitcher_profile_from_events(events, as_of="2026-06-01", player_id=9)
    assert p["k_line"] == 0.5  # median of [2, 1, 0] is 1 -> 0.5


# --- recent-form: BIP-count window + shrinkage ---

def _make_bip_events(n, game_date, launch_speed):
    """Helper: n batted-ball events all on game_date with given launch_speed."""
    return [
        {"game_date": game_date, "launch_speed": launch_speed, "events": "single", "woba_value": 0.45}
        for _ in range(n)
    ]

def test_recent_form_bip_window_not_calendar():
    """Batted balls older than 15 days still count (window is BIP-count, not calendar)."""
    # 55 balls from 60 days ago — all hard-hit (launch_speed=105)
    old_hard = _make_bip_events(55, "2025-04-01", 105.0)
    # 10 balls from yesterday — soft (launch_speed=75)
    recent_soft = _make_bip_events(10, "2025-05-30", 75.0)
    profile = batter_profile_from_events(old_hard + recent_soft, as_of="2025-06-17", player_id=1)
    # Window = last 55 BIP = mix of some old hard + some recent soft
    # Either way, result must NOT be 1.0 (which 15-day window would give for all-old hard balls)
    assert profile["recent_form_mult"] != 1.0

def test_recent_form_hot_direction():
    """Recent balls harder than season → mult > 1.0."""
    season = _make_bip_events(100, "2025-04-01", 85.0)   # season avg ~85 mph
    recent = _make_bip_events(55, "2025-06-01", 100.0)    # last 55 all hard-hit
    profile = batter_profile_from_events(season + recent, as_of="2025-06-17", player_id=1)
    assert profile["recent_form_mult"] > 1.0

def test_recent_form_cold_direction():
    """Recent balls softer than season → mult < 1.0."""
    season = _make_bip_events(100, "2025-04-01", 95.0)   # season avg ~95 mph (hard)
    recent = _make_bip_events(55, "2025-06-01", 75.0)    # last 55 soft
    profile = batter_profile_from_events(season + recent, as_of="2025-06-17", player_id=1)
    assert profile["recent_form_mult"] < 1.0

def test_recent_form_shrinkage_thin_sample():
    """Thin sample (8 balls) shrinks mult toward 1.0 vs full 55 at same rate."""
    season_base = _make_bip_events(200, "2025-04-01", 85.0)
    # Full window: 55 balls at 100 mph
    full_recent = _make_bip_events(55, "2025-06-01", 100.0)
    profile_full = batter_profile_from_events(season_base + full_recent, as_of="2025-06-17", player_id=1)
    # Thin window: only 8 balls at 100 mph
    thin_recent = _make_bip_events(8, "2025-06-01", 100.0)
    profile_thin = batter_profile_from_events(season_base + thin_recent, as_of="2025-06-17", player_id=1)
    # Thin sample must be closer to 1.0
    assert abs(profile_thin["recent_form_mult"] - 1.0) < abs(profile_full["recent_form_mult"] - 1.0)

def test_recent_form_neutral():
    """Recent rate ≈ season rate → mult ≈ 1.0."""
    events = _make_bip_events(100, "2025-05-01", 90.0)
    profile = batter_profile_from_events(events, as_of="2025-06-17", player_id=1)
    assert abs(profile["recent_form_mult"] - 1.0) < 0.05

def test_recent_form_cap():
    """Extreme inputs clamp to [0.8, 1.25]."""
    season = _make_bip_events(200, "2025-04-01", 70.0)   # very soft season
    hot = _make_bip_events(55, "2025-06-01", 115.0)      # extreme hard recent
    profile = batter_profile_from_events(season + hot, as_of="2025-06-17", player_id=1)
    assert profile["recent_form_mult"] <= 1.25
    cold = _make_bip_events(200, "2025-04-01", 110.0)    # hard season
    soft = _make_bip_events(55, "2025-06-01", 60.0)      # extreme soft recent
    profile2 = batter_profile_from_events(cold + soft, as_of="2025-06-17", player_id=1)
    assert profile2["recent_form_mult"] >= 0.8

def test_recent_form_empty_bip():
    """No batted balls → recent_form_mult == 1.0, no crash."""
    # Events with no launch_speed (not BIP)
    events = [{"game_date": "2025-06-01", "launch_speed": None, "events": "strikeout", "woba_value": 0.0}]
    profile = batter_profile_from_events(events, as_of="2025-06-17", player_id=1)
    assert profile["recent_form_mult"] == 1.0


# ---------------------------------------------------------------------------
# with_gamelog: recent-window totals
# ---------------------------------------------------------------------------

def _gl(date, r=0, rbi=0, h=0):
    """Helper: single game-log row."""
    return {"game_date": date, "r": r, "rbi": rbi, "h": h}


def test_with_gamelog_recent_window_20_games():
    """20 current-season games → recent_games==15, recent_r == sum of last 15 by date."""
    from model.profiles import with_gamelog

    # Build 20 game-log rows with distinct dates and predictable r values
    # (dates are not in sorted order intentionally, to test the sort)
    logs = []
    for i in range(20):
        date = f"2026-0{(i // 10) + 4}-{(i % 10) + 10}"  # e.g. 2026-04-10 .. 2026-05-19
        logs.append(_gl(date, r=i + 1, rbi=i, h=i))

    # Sort by date so we know which are the "last 15"
    sorted_logs = sorted(logs, key=lambda x: x["game_date"])
    last_15 = sorted_logs[-15:]
    expected_recent_r = sum(x["r"] for x in last_15)
    expected_recent_rbi = sum(x["rbi"] for x in last_15)
    expected_recent_hrr = sum(x["h"] + x["r"] + x["rbi"] for x in last_15)

    gamelogs_by_season = {2026: logs}
    base_profile = {"player_id": 1}
    result = with_gamelog(base_profile, gamelogs_by_season, current_season=2026)

    assert result["recent_games"] == 15
    assert result["recent_r"] == expected_recent_r
    assert result["recent_rbi"] == expected_recent_rbi
    assert result["recent_hrr"] == expected_recent_hrr

    # Existing keys must be unchanged (additive-only guarantee)
    assert result["games"] == 20
    assert result["total_r"] == sum(x["r"] for x in logs)


def test_with_gamelog_recent_window_8_games():
    """Fewer than 15 games → recent_games == actual count (8)."""
    from model.profiles import with_gamelog

    logs = [_gl(f"2026-04-{10 + i}", r=i + 1, rbi=i, h=i) for i in range(8)]
    gamelogs_by_season = {2026: logs}
    base_profile = {"player_id": 2}
    result = with_gamelog(base_profile, gamelogs_by_season, current_season=2026)

    assert result["recent_games"] == 8
    assert result["recent_r"] == sum(x["r"] for x in logs)
    assert result["recent_rbi"] == sum(x["rbi"] for x in logs)
    assert result["recent_hrr"] == sum(x["h"] + x["r"] + x["rbi"] for x in logs)


def test_with_gamelog_recent_window_no_current_season():
    """No current-season logs → all four recent keys are 0."""
    from model.profiles import with_gamelog

    gamelogs_by_season = {}
    base_profile = {"player_id": 3}
    result = with_gamelog(base_profile, gamelogs_by_season, current_season=2026)

    assert result["recent_games"] == 0
    assert result["recent_r"] == 0
    assert result["recent_rbi"] == 0
    assert result["recent_hrr"] == 0


# --- Swingman true-starts fix ---
from model import profiles as _profiles


def _pit_ev(gp, n_bf, n_k):
    return [{"game_date": "2026-05-01",
             "events": "strikeout" if i < n_k else "field_out", "game_pk": gp}
            for i in range(n_bf)]


def _swingman_events():
    ev = []
    for gp in (1, 2, 3):       # 3 true starts: 20 BF, 6 K each
        ev += _pit_ev(gp, 20, 6)
    for gp in (4, 5):          # 2 relief outings: 3 BF, 1 K each
        ev += _pit_ev(gp, 3, 1)
    return ev


def test_pitcher_profile_filters_to_starts():
    prof = _profiles.pitcher_profile_from_events(
        _swingman_events(), as_of="2026-06-01", player_id=1, started_game_pks={1, 2, 3})
    assert prof["expected_bf"] == 20.0   # 60 PA / 3 starts (NOT 66/5)
    assert prof["k_line"] == 5.5         # median 6 -> whole -> 5.5


def test_pitcher_profile_none_is_all_appearances():
    prof = _profiles.pitcher_profile_from_events(
        _swingman_events(), as_of="2026-06-01", player_id=1)
    assert prof["expected_bf"] == 66 / 5  # all 5 games, unchanged behavior


def test_pitcher_profile_under_two_starts_falls_back():
    prof = _profiles.pitcher_profile_from_events(
        _pit_ev(1, 3, 1), as_of="2026-06-01", player_id=1, started_game_pks={1})
    assert prof["k_line"] == 4.5
    assert prof["expected_bf"] == 24.0


def test_pitcher_profile_rates_still_from_all_appearances():
    prof = _profiles.pitcher_profile_from_events(
        _swingman_events(), as_of="2026-06-01", player_id=1, started_game_pks={1, 2, 3})
    # rates use all 66 PA / 20 Ks; no description data → signal=0.0 → barrel-blend (not plain regress)
    assert abs(prof["k_per_bf"] - barrel_blended_rate(
        20, 66, signal=0.0, league_rate=LEAGUE_K, league_signal=_LG_SWSTR, votes=_VOTES_K)) < 1e-9


def test_blended_pitcher_profile_passes_started_set():
    by_season = {2026: _swingman_events(), 2025: [], 2024: []}
    prof = _profiles.blended_pitcher_profile(
        by_season, as_of="2026-06-01", current_season=2026, player_id=1,
        started_game_pks={1, 2, 3})
    assert prof["expected_bf"] == 20.0
    assert prof["k_line"] == 5.5


# --- Production-form for HR/Hits/TB ---

def _pf_pa(date, ev):
    return {"game_date": date, "events": ev, "launch_speed": 95.0}


def _pf_season(old_ev, recent_ev, *, old_n=40, recent_n=60):
    ev = [_pf_pa(f"2026-04-{i % 28 + 1:02d}", old_ev) for i in range(old_n)]
    ev += [_pf_pa(f"2026-06-{i % 28 + 1:02d}", recent_ev) for i in range(recent_n)]
    return ev


def test_production_form_hot_hits_above_one():
    p = batter_profile_from_events(_pf_season("field_out", "single"), as_of="2026-07-01", player_id=1)
    assert p["production_form_hit"] > 1.0


def test_production_form_cold_hits_below_one():
    p = batter_profile_from_events(_pf_season("single", "field_out"), as_of="2026-07-01", player_id=1)
    assert p["production_form_hit"] < 1.0


def test_production_form_uniform_is_neutral():
    p = batter_profile_from_events(_pf_season("single", "single"), as_of="2026-07-01", player_id=1)
    assert abs(p["production_form_hit"] - 1.0) < 1e-9


def test_production_form_hr_is_heavily_shrunk():
    ev = [_pf_pa(f"2026-04-{i % 28 + 1:02d}", "field_out") for i in range(40)]
    ev += [_pf_pa("2026-06-01", "home_run"), _pf_pa("2026-06-02", "home_run")]
    ev += [_pf_pa(f"2026-06-{i % 20 + 3:02d}", "field_out") for i in range(58)]
    p = batter_profile_from_events(ev, as_of="2026-07-01", player_id=1)
    assert 1.0 < p["production_form_hr"] <= 1.20
    assert "production_form_tb" in p


# --- Current-mode k/hit pull-to-average ---

def test_batter_current_rates_regressed_toward_league():
    from model import profiles as P
    ev = [{"game_date": "2026-05-01", "events": e, "launch_speed": 95.0}
          for e in (["single"] * 5 + ["field_out"] * 5)]   # 10 PA, 5 hits -> raw 0.50
    prof = P.batter_profile_from_events(ev, as_of="2026-07-01", player_id=1)
    assert prof["hit_rate"] < 0.40
    assert abs(prof["hit_rate"] - P.regress(5, 10, P.LEAGUE_HIT, P._HIT_R)) < 1e-9
    empty = P.batter_profile_from_events([], as_of="2026-07-01", player_id=1)
    assert empty["hit_rate"] == P.LEAGUE_HIT
    assert empty["k_rate"] == P.LEAGUE_K


def test_pitcher_current_rates_regressed_toward_league():
    from model import profiles as P
    ev = [{"game_date": "2026-05-01", "events": e, "game_pk": 1}
          for e in (["strikeout"] * 3 + ["single"] * 3 + ["field_out"] * 4)]   # 10 PA
    prof = P.pitcher_profile_from_events(ev, as_of="2026-07-01", player_id=1)
    # no description/bb_type in fixture → signal=0.0 → barrel-blended toward implied = league (neutral)
    assert abs(prof["k_per_bf"] - barrel_blended_rate(
        3, 10, signal=0.0, league_rate=LEAGUE_K, league_signal=_LG_SWSTR, votes=_VOTES_K)) < 1e-9
    assert abs(prof["hit_allowed_rate"] - barrel_blended_rate(
        3, 10, signal=0.0, league_rate=LEAGUE_HIT, league_signal=_LG_HARDHIT, votes=_VOTES_HIT)) < 1e-9
    empty = P.pitcher_profile_from_events([], as_of="2026-07-01", player_id=1)
    # no data → signal=0.0 → implied = LEAGUE_K (neutral); pa=0 → votes dominate → LEAGUE_K
    assert empty["k_per_bf"] == pytest.approx(P.LEAGUE_K)
