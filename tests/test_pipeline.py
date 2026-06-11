import math
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
    assert ace["matchups"][0]["player_id"] == 111
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


def test_strikeout_rows_adjust_lambda_for_opposing_lineup():
    from model.matchup import strikeout_prob
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn)
    ace = next(r for r in rows if r["player"] == "Ace Coors")
    # Ace (k_per_bf 0.27, 24 BF) faces only Away Slugger (k_rate 0.25, bats L vs R)
    expected = strikeout_prob(0.25, 0.27, bats="L", throws="R") * 24
    assert ace["expected_ks"] == pytest.approx(expected)


def test_strikeout_rows_fall_back_when_no_lineup_posted():
    def empty_lineups_fn(game):
        return {"home": [], "away": []}
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, empty_lineups_fn, fake_weather_fn)
    ace = next(r for r in rows if r["player"] == "Ace Coors")
    # pitcher-only estimate: k_per_bf 0.27 * 24 BF * opponent_k_mult 1.04
    assert ace["expected_ks"] == pytest.approx(0.27 * 24 * 1.04)
    assert ace["matchups"] == []


def test_hr_rows_wire_pitcher_platoon_slot_and_park():
    from model.projections import pitcher_hr_mult
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    home = next(r for r in rows if r["team"] == "COL")
    # COL R batter vs LAD L starter -> platoon advantage
    assert home["matchup_mult"] == pytest.approx(1.06)
    # pitcher quality from Dodger Arm's HR-allowed profile
    assert home["pitcher_mult"] == pytest.approx(pitcher_hr_mult(0.040, 460))
    # game park (COL 1.22) divided by sqrt of the batter's home park (COL)
    assert home["park_mult"] == pytest.approx(1.22 / math.sqrt(1.22))
    assert home["player_id"] == 101
    assert home["vs"]["player_id"] == 202
    away = next(r for r in rows if r["team"] == "LAD")
    # away batter's own park (LAD 1.06) divided out of the game park (COL)
    assert away["park_mult"] == pytest.approx(1.22 / math.sqrt(1.06))
    assert away["pitcher_mult"] == pytest.approx(pitcher_hr_mult(0.030, 430))
    assert away["player_id"] == 111


def test_k_rows_carry_player_id():
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn)
    assert {r["player_id"] for r in rows} == {201, 202}


def fake_bvp_fn(batter_id, pitcher_id):
    if batter_id == 101 and pitcher_id == 202:
        return {"pa": 10, "ab": 10, "hits": 4, "hr": 2, "k": 1, "avg": ".400"}
    return None


def test_hr_rows_apply_capped_bvp_dial():
    from model.projections import bvp_hr_mult
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn, fake_bvp_fn)
    home = next(r for r in rows if r["team"] == "COL")
    assert home["bvp_mult"] == pytest.approx(bvp_hr_mult(2, 10))  # capped 1.10
    assert home["vs"]["bvp"]["hr"] == 2
    away = next(r for r in rows if r["team"] == "LAD")
    assert away["bvp_mult"] == pytest.approx(1.0)  # no history -> neutral
    assert away["vs"]["bvp"] is None


def test_hr_rows_without_bvp_fn_are_neutral():
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    assert all(r["bvp_mult"] == pytest.approx(1.0) for r in rows)


def test_k_matchups_carry_bvp_display_only():
    from model.projections import lineup_expected_ks
    from model.matchup import strikeout_prob
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn, fake_bvp_fn)
    dodger = next(r for r in rows if r["player"] == "Dodger Arm")  # pid 202 faces home lineup (101)
    assert dodger["matchups"][0]["bvp"]["pa"] == 10
    # K math unchanged by bvp: lambda still the pure lineup-adjusted value
    expected = strikeout_prob(0.22, 0.25, bats="R", throws="L") * 23
    assert dodger["expected_ks"] == pytest.approx(expected)
