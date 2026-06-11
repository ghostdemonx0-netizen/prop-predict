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


def test_get_player_meta_smoke():
    from model.fetch import get_player_meta
    meta = get_player_meta([592450, 669373])  # Judge (R bats), Skubal (L throws)
    assert meta[592450]["name"] == "Aaron Judge"
    assert meta[592450]["bats"] in {"L", "R", "S"}
    assert meta[669373]["throws"] in {"L", "R"}


def test_get_lineups_smoke():
    from model.fetch import get_schedule, get_lineups
    games = get_schedule("2026-06-10")
    started = [g for g in games if g["started"]]
    assert started, "need a finished game to guarantee posted lineups"
    lns = get_lineups(started[0]["game_id"])
    assert set(lns) == {"home", "away"}
    assert isinstance(lns["home"], list) and isinstance(lns["away"], list)
    assert len(lns["home"]) >= 1 and len(lns["away"]) >= 1
    assert all(isinstance(pid, int) for pid in lns["home"] + lns["away"])


def test_get_starters_smoke():
    from model.fetch import get_schedule, get_starters
    games = get_schedule("2026-06-10")
    finished = [g for g in games if g["started"]]
    assert finished, "need a finished game (its starters live in the boxscore)"
    s = get_starters(finished[0]["game_id"])
    assert set(s) == {"home", "away"}
    assert isinstance(s["home"], int) and isinstance(s["away"], int)


def test_batter_events_smoke():
    from model.fetch import batter_events
    ev = batter_events(592450, 2026)  # Aaron Judge
    assert len(ev) > 0
    assert {"game_date", "events", "launch_speed"} <= set(ev[0])
    assert ev[0]["game_date"][:4] == "2026"


def test_pitcher_events_smoke():
    from model.fetch import pitcher_events
    ev = pitcher_events(669373, 2026)  # Tarik Skubal
    assert len(ev) > 0
    assert {"game_date", "events", "game_pk"} <= set(ev[0])
