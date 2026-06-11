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
