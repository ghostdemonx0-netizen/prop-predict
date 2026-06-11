import datetime as dt
import pytest

from model.fetch import get_schedule, get_weather

pytestmark = pytest.mark.smoke


def test_get_schedule_returns_games_for_a_known_date():
    games = get_schedule("2026-06-10")
    assert isinstance(games, list)
    assert len(games) > 0
    g = games[0]
    for field in ("game_id", "home", "away", "park_team", "game_time", "started"):
        assert field in g


def test_get_weather_returns_conditions():
    wx = get_weather(lat=39.756, lon=-104.994, when_iso="2026-06-10T20:40:00Z")
    assert "wind_speed_mph" in wx
    assert "wind_from_deg" in wx
    assert "temp_f" in wx
    assert 0 <= wx["wind_from_deg"] <= 360


def test_build_batter_profile_smoke():
    from model.fetch import build_batter_profile
    # Aaron Judge MLBAM id 592450; season 2026
    prof = build_batter_profile(player_id=592450, season=2026)
    assert prof["season_pa"] > 0
    assert prof["season_hr"] >= 0
    assert "recent_form_mult" in prof
    assert prof["recent_form_mult"] > 0


def test_build_pitcher_profile_smoke():
    from model.fetch import build_pitcher_profile
    # Tarik Skubal MLBAM id 669373; season 2026
    prof = build_pitcher_profile(player_id=669373, season=2026)
    assert prof["k_per_bf"] > 0
    assert prof["expected_bf"] > 0


def test_get_player_names_smoke():
    from model.fetch import get_player_names
    names = get_player_names([592450, 669373])  # Judge, Skubal
    assert names[592450] == "Aaron Judge"
    assert names[669373] == "Tarik Skubal"


def test_get_player_meta_smoke():
    from model.fetch import get_player_meta
    meta = get_player_meta([592450, 669373])  # Judge (R bats), Skubal (L throws)
    assert meta[592450]["name"] == "Aaron Judge"
    assert meta[592450]["bats"] in {"L", "R", "S"}
    assert meta[669373]["throws"] in {"L", "R"}
