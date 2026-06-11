import pytest
from model.pipeline import build_hr_rows, build_strikeout_rows, build_games
from tests.fixtures import (
    SAMPLE_SLATE, SAMPLE_LINEUPS, SAMPLE_PITCHERS, SAMPLE_WEATHER,
)


def fake_lineups_fn(game):
    return SAMPLE_LINEUPS[game["game_id"]]


def fake_pitcher_fn(pitcher_id):
    return SAMPLE_PITCHERS[pitcher_id]


def fake_weather_fn(game):
    return SAMPLE_WEATHER[game["game_id"]]


def test_build_hr_rows_produces_expected_fields():
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    assert len(rows) == 2  # one home batter + one away batter
    home = next(r for r in rows if r["team"] == "COL")
    assert home["player"] == "Home Masher"
    assert home["prop"] == "HR"
    assert home["matchup"] == "LAD @ COL"
    assert 0.0 < home["probability"] <= 1.0
    # home batter faces the AWAY pitcher (Dodger Arm)
    assert home["vs"]["name"] == "Dodger Arm"
    assert home["vs"]["throws"] == "L"
    assert home["vs"]["lean"] in {"K", "H", "NEU"}
    assert 0.0 <= home["vs"]["k_prob"] <= 1.0


def test_build_hr_rows_sorted_descending():
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    probs = [r["probability"] for r in rows]
    assert probs == sorted(probs, reverse=True)


def test_build_strikeout_rows():
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn)
    names = {r["player"] for r in rows}
    assert names == {"Ace Coors", "Dodger Arm"}
    ace = next(r for r in rows if r["player"] == "Ace Coors")  # home pitcher (COL)
    assert ace["throws"] == "R"
    assert ace["matchup"] == "LAD @ COL"
    # home pitcher faces the AWAY lineup (Away Slugger)
    assert [m["name"] for m in ace["matchups"]] == ["Away Slugger"]
    assert ace["matchups"][0]["lean"] in {"K", "H", "NEU"}
    assert 0.0 <= ace["over_prob"] <= 1.0
    assert ace["temp_f"] == pytest.approx(80.0)


def test_build_games_environment():
    games = build_games(SAMPLE_SLATE, fake_weather_fn)
    assert len(games) == 1
    g = games[0]
    assert g["matchup"] == "LAD @ COL"
    assert g["park"] == "COL"
    # COL park 1.22 x weather (10mph out, 80F -> 1.25) = 1.525
    assert g["env"] == pytest.approx(1.525, abs=1e-3)
    assert g["wind_dir"] == pytest.approx(0)


def test_build_hr_rows_skips_started_games():
    started = [dict(SAMPLE_SLATE[0], started=True)]
    rows = build_hr_rows(started, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    assert rows == []


def test_format_hr_table_renders_rows():
    from model.cli import format_table
    rows = [
        {"player": "Big Bopper", "team": "LAD", "park": "COL",
         "probability": 0.21, "wind_out_mph": 10.0},
    ]
    text = format_table(rows, columns=["player", "team", "park", "probability"])
    assert "Big Bopper" in text
    assert "21.0%" in text  # probability formatted as a percentage
