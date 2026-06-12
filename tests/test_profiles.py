import pytest
from model.profiles import batter_profile_from_events, pitcher_profile_from_events


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
    assert p["k_rate"] == pytest.approx(0.25)
    assert p["hit_rate"] == pytest.approx(0.5)
    assert p["player_id"] == 1 and p["bats"] == "L"


def test_batter_profile_excludes_games_on_or_after_as_of():
    events = [_ev("2026-06-01", "home_run", 100.0), _ev("2026-06-05", "home_run", 100.0)]
    p = batter_profile_from_events(events, as_of="2026-06-05", player_id=1)
    assert p["season_hr"] == 1  # the as_of-day HR must NOT count (no lookahead)


def test_batter_recent_form_hot_when_recent_contact_harder():
    cold = [_ev("2026-04-01", "field_out", 85.0)] * 10
    hot = [_ev("2026-06-08", "field_out", 105.0)] * 10
    p = batter_profile_from_events(cold + hot, as_of="2026-06-10", player_id=1)
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
    assert p["k_per_bf"] == pytest.approx(0.5)
    assert p["hit_allowed_rate"] == pytest.approx(0.5)  # single + HR are both hits
    assert p["hr_allowed_rate"] == pytest.approx(0.25)
    assert p["expected_bf"] == pytest.approx(2.0)  # 4 PA over 2 games
    assert p["bf"] == 4
    assert p["k_line"] == 5.5 and p["throws"] == "L"


def test_pitcher_profile_no_data_defaults():
    p = pitcher_profile_from_events([], as_of="2026-06-10", player_id=3)
    assert p["k_per_bf"] == 0.0
    assert p["expected_bf"] == 24.0
    assert p["bf"] == 0


def test_batter_profile_no_data_defaults():
    p = batter_profile_from_events([], as_of="2026-06-10", player_id=4)
    assert p["season_pa"] == 0
    assert p["season_hr"] == 0
    assert p["k_rate"] == 0.0
    assert p["hit_rate"] == 0.0
    assert p["recent_form_mult"] == pytest.approx(1.0)
    assert p["name"] == "4"  # falls back to the id


def test_batter_recent_form_cold_clamps_at_floor():
    hot_season = [_ev("2026-04-01", "field_out", 105.0)] * 30
    cold_recent = [_ev("2026-06-08", "field_out", 80.0)] * 10
    p = batter_profile_from_events(hot_season + cold_recent, as_of="2026-06-10", player_id=1)
    assert p["recent_form_mult"] == pytest.approx(0.8)  # clamped at the floor


def test_k_line_from_starts_median_rounded_to_half():
    from model.profiles import k_line_from_starts
    assert k_line_from_starts([4, 6, 7]) == 6.0          # odd count -> middle value
    assert k_line_from_starts([4, 5, 6, 8]) == 5.5       # even count -> mean of middle two
    assert k_line_from_starts([3, 3, 9]) == 3.0          # median resists one blowup start


def test_k_line_from_starts_small_sample_falls_back():
    from model.profiles import k_line_from_starts
    assert k_line_from_starts([7, 8]) == 5.5             # < 3 starts -> default line
    assert k_line_from_starts([], fallback=4.5) == 4.5


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
    assert p["k_line"] == 1.0  # median of [2, 1, 0]
