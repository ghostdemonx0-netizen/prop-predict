import pytest
from model.pipeline import build_hr_rows, build_strikeout_rows
from tests.fixtures import (
    SAMPLE_SLATE, SAMPLE_BATTERS, SAMPLE_PITCHERS, SAMPLE_WEATHER,
)


def fake_batters_fn(game_id):
    return SAMPLE_BATTERS[game_id]


def fake_pitcher_fn(pitcher_id):
    return SAMPLE_PITCHERS[pitcher_id]


def fake_weather_fn(game):
    return SAMPLE_WEATHER[game["game_id"]]


def test_build_hr_rows_produces_expected_fields():
    rows = build_hr_rows(SAMPLE_SLATE, fake_batters_fn, fake_weather_fn)
    assert len(rows) == 1
    row = rows[0]
    assert row["player"] == "Big Bopper"
    assert row["prop"] == "HR"
    assert row["park"] == "COL"
    base = 1 - (1 - 30 / 600) ** 4.3
    assert 0.0 < row["probability"] <= 1.0
    assert row["probability"] > base  # Coors + wind out + heat + form + matchup all boost
    assert "wind_out_mph" in row and row["wind_out_mph"] == pytest.approx(10.0)
    assert "recent_form_mult" in row and row["recent_form_mult"] == pytest.approx(1.10)
    # weather display fields: wind from south (180) toward CF (bearing 0) -> dir 0 (out to CF)
    assert row["wind_dir"] == pytest.approx(0)
    assert row["wind_mph"] == pytest.approx(10.0)
    assert row["temp_f"] == pytest.approx(80.0)
    assert row["precip_pct"] == 30


def test_build_hr_rows_sorted_descending():
    slate = SAMPLE_SLATE
    def two_batters_fn(game_id):
        strong = dict(SAMPLE_BATTERS[game_id][0])
        weak = dict(strong, player_id=102, name="Weak Hitter",
                    season_hr=8, recent_form_mult=0.9, matchup_mult=0.9)
        return [weak, strong]
    rows = build_hr_rows(slate, two_batters_fn, fake_weather_fn)
    assert rows[0]["probability"] >= rows[1]["probability"]


def test_build_strikeout_rows():
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_weather_fn)
    names = {r["player"] for r in rows}
    assert names == {"Ace Coors", "Dodger Arm"}
    for r in rows:
        assert r["prop"] == "K"
        assert 0.0 <= r["over_prob"] <= 1.0
        assert r["expected_ks"] > 0
        assert r["line"] == 5.5
        # weather display fields attached for parity with HR rows
        assert r["wind_dir"] == pytest.approx(0)
        assert r["temp_f"] == pytest.approx(80.0)
        assert r["precip_pct"] == 30


def test_build_hr_rows_skips_started_games():
    started = [dict(SAMPLE_SLATE[0], started=True)]
    rows = build_hr_rows(started, fake_batters_fn, fake_weather_fn)
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
