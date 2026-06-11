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
