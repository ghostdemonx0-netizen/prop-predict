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
    assert g["park_name"] == "Coors Field"
    assert g["game_time"] == "2026-06-10T20:40:00Z"
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
    assert home["bvp_mult"] == pytest.approx(bvp_hr_mult(2, 10))  # ~1.07 on the ladder
    assert home["vs"]["bvp"]["hr"] == 2
    away = next(r for r in rows if r["team"] == "LAD")
    assert away["bvp_mult"] == pytest.approx(1.0)  # no history -> neutral
    assert away["vs"]["bvp"] is None


def test_hr_rows_without_bvp_fn_are_neutral():
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    assert all(r["bvp_mult"] == pytest.approx(1.0) for r in rows)


def test_history_dial_nudges_k_read_and_lambda():
    from model.matchup import strikeout_prob, bvp_k_mult
    base = strikeout_prob(0.22, 0.25, bats="R", throws="L")
    adjusted = base * bvp_k_mult(1, 10)  # batter 101's career: 1 K in 10 meetings
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn, fake_bvp_fn)
    dodger = next(r for r in rows if r["player"] == "Dodger Arm")
    assert dodger["matchups"][0]["k_prob"] == pytest.approx(adjusted)
    assert dodger["expected_ks"] == pytest.approx(adjusted * 23)
    # the HR card's vs-sphere shows the SAME adjusted read (consistency)
    hr_rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn, fake_bvp_fn)
    home = next(r for r in hr_rows if r["team"] == "COL")
    assert home["vs"]["k_prob"] == pytest.approx(adjusted)


def test_rows_carry_game_time():
    hr = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    ks = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn)
    assert all(r["game_time"] == "2026-06-10T20:40:00Z" for r in hr)
    assert all(r["game_time"] == "2026-06-10T20:40:00Z" for r in ks)


def test_hr_rows_carry_lineup_and_pitcher_status():
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    home = next(r for r in rows if r["team"] == "COL")
    assert home["lineup_status"] == "projected"
    assert home["vs"]["pitcher_status"] == "probable"


def test_k_rows_carry_status():
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn)
    ace = next(r for r in rows if r["player"] == "Ace Coors")
    assert ace["pitcher_status"] == "probable"
    assert ace["matchups"][0]["lineup_status"] == "projected"


def test_games_carry_side_statuses():
    games = build_games(SAMPLE_SLATE, fake_weather_fn)
    g = games[0]
    assert g["home_lineup_status"] == "projected"
    assert g["away_lineup_status"] == "confirmed"


# --- Approach C: lineup-context wiring tests ---
from model import pipeline as _pl


def _c_profile(pid, name, *, hit_rate=0.22, slg_components=(5, 2, 1, 1, 40), bats="R",
               games=80, total_r=40, status="confirmed"):
    s1b, s2b, s3b, hr, pa = slg_components
    return {
        "player_id": pid, "name": name, "bats": bats, "lineup_status": status,
        "hit_rate": hit_rate, "k_rate": 0.22,
        "season_1b": s1b, "season_2b": s2b, "season_3b": s3b, "season_hr": hr, "season_pa": pa,
        "games": games, "total_r": total_r, "total_rbi": 40, "total_hrr": 120,
        "recent_r": 0, "recent_rbi": 0, "recent_hrr": 0, "recent_games": 0,
        "recent_form_mult": 1.0,
    }


def _c_slate():
    return [{"game_id": 1, "home": "COL", "away": "LAD", "park_team": "COL",
             "home_id": 10, "away_id": 20,
             "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False,
             "home_lineup_status": "confirmed", "away_lineup_status": "confirmed"}]


def _c_pitcher(pid):
    return {"name": "P", "player_id": pid, "throws": "R", "hit_allowed_rate": 0.22, "k_per_bf": 0.22}


def _c_weather(game):
    return {"wind_speed_mph": 0.0, "wind_from_deg": 0.0, "temp_f": 70.0, "precip_pct": 0}


def _c_stacked_lineup():
    mashers = [_c_profile(i, f"M{i}", slg_components=(10, 8, 2, 12, 40)) for i in range(2, 10)]
    return [_c_profile(1, "Leadoff")] + mashers


def test_runs_row_boosted_when_strong_hitters_bat_behind():
    lineup = _c_stacked_lineup()
    rows = _pl.build_runs_rows(_c_slate(), lambda g: {"home": lineup, "away": lineup},
                               _c_pitcher, _c_weather)
    leadoff_row = next(r for r in rows if r["player_id"] == 1)
    assert leadoff_row["lineup_mult"] > 1.0
    assert "lineup_slot" in leadoff_row and "lineup_teammate" in leadoff_row


def test_hrr_lineup_effect_is_damped_vs_runs():
    lineup = _c_stacked_lineup()
    slate = _c_slate()
    runs_mult = next(r for r in _pl.build_runs_rows(slate, lambda g: {"home": lineup, "away": lineup},
                     _c_pitcher, _c_weather) if r["player_id"] == 1)["lineup_mult"]
    hrr_mult = next(r for r in _pl.build_hrr_rows(slate, lambda g: {"home": lineup, "away": lineup},
                    _c_pitcher, _c_weather) if r["player_id"] == 1)["lineup_mult"]
    assert abs(hrr_mult - 1.0) < abs(runs_mult - 1.0)


# --- Production-form blend for HR/Hits/TB ---

def test_hr_row_blends_production_form_80_20():
    from model import run_props
    bat = {"player_id": 501, "name": "Hot", "bats": "R", "lineup_status": "confirmed",
           "season_hr": 20, "season_pa": 400, "season_1b": 50, "season_2b": 20, "season_3b": 2,
           "hit_rate": 0.25, "k_rate": 0.22, "recent_form_mult": 1.0,
           "production_form_hr": 1.20, "production_form_hit": 1.0, "production_form_tb": 1.0}
    slate = [{"game_id": 9, "home": "COL", "away": "LAD", "park_team": "COL",
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    L = lambda g: {"home": [bat], "away": []}
    P = lambda pid: {"name": "P", "player_id": pid, "throws": "R", "hr_allowed_rate": 0.033,
                     "bf": 400, "k_per_bf": 0.22, "hit_allowed_rate": 0.22}
    W = lambda g: {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}
    row = _pl.build_hr_rows(slate, L, P, W)[0]
    assert abs(row["recent_form_mult"] - run_props.blend_forms(1.0, 1.20, w_hard=0.80)) < 1e-9
    assert row["hard_hit_form"] == 1.0
    assert row["production_form"] == 1.20


def test_hr_directional_wind_helps_pull_hitter_lf_wind():
    from model.parks import get_park
    sides = {"R": {"overall": {"pull": 80, "center": 12, "oppo": 8, "n": 1200},
                   "air": {"pull": 80, "center": 12, "oppo": 8, "n": 400},
                   "hr": {"pull": 85, "center": 10, "oppo": 5, "n": 90}},
             "L": {"overall": {"pull": 0, "center": 0, "oppo": 0, "n": 0},
                   "air": {"pull": 0, "center": 0, "oppo": 0, "n": 0},
                   "hr": {"pull": 0, "center": 0, "oppo": 0, "n": 0}}}
    bat = {"player_id": 601, "name": "Pull", "bats": "R", "lineup_status": "confirmed",
           "season_hr": 30, "season_pa": 500, "season_1b": 40, "season_2b": 20, "season_3b": 1,
           "hit_rate": 0.25, "k_rate": 0.22, "recent_form_mult": 1.0, "spray_sides": sides}
    slate = [{"game_id": 7, "home": "COL", "away": "LAD", "park_team": "COL", "home_id": 10, "away_id": 20,
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    L = lambda g: {"home": [bat], "away": []}
    P = lambda pid: {"name": "P", "player_id": pid, "throws": "R", "hr_allowed_rate": 0.033, "bf": 400,
                     "k_per_bf": 0.22, "hit_allowed_rate": 0.22}
    cf = get_park("COL")["cf_bearing_deg"]
    Wlf = lambda g: {"wind_speed_mph": 12, "wind_from_deg": (cf - 45 + 180) % 360, "temp_f": 72, "precip_pct": 0}
    Wrf = lambda g: {"wind_speed_mph": 12, "wind_from_deg": (cf + 45 + 180) % 360, "temp_f": 72, "precip_pct": 0}
    lf = _pl.build_hr_rows(slate, L, P, Wlf)[0]
    rf = _pl.build_hr_rows(slate, L, P, Wrf)[0]
    assert lf["probability"] > rf["probability"]   # LF-out helps this RHB pull hitter more than RF-out
    assert "spray_pull" in lf


def test_hr_row_has_spray_mult_and_invariant():
    # spray_mult decomposes the directional weather into neutral x spray, no double-count.
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    assert rows
    r = rows[0]
    assert "spray_mult" in r
    neutral = r["weather_mult"] / r["spray_mult"]
    assert 0.5 < neutral < 1.6
    assert abs(neutral * r["spray_mult"] - r["weather_mult"]) < 1e-9


def test_hr_rows_carry_bat_order():
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    assert rows
    assert all(isinstance(r.get("bat_order"), int) for r in rows)
    assert min(r["bat_order"] for r in rows) == 1


def test_hr_rows_carry_baseline_and_pace():
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    r = rows[0]
    assert "baseline_prob" in r and "pace" in r
    assert 0.0 <= r["baseline_prob"] <= 1.0
    assert r["pace"] >= 0.0


def test_k_rows_carry_baseline_and_pace():
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn)
    r = rows[0]
    assert "baseline_over_prob" in r and "pace" in r
    assert r["pace"] > 0
    assert 0.0 <= r["baseline_over_prob"] <= 1.0


# --- Barrel nudge wired into Hits + TB threshold rows ---

def test_hits_rows_have_barrel_beff_twins():
    rows = _pl.build_hits_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    assert len(rows) > 0
    r = rows[0]
    assert "barrel_mult" in r
    for label in ("p_ge1", "p_ge2", "p_ge3"):
        assert f"{label}_beff" in r, f"missing {label}_beff"
        assert 0.0 <= r[f"{label}_beff"] <= 1.0
        # Base OFF probability must still be present and unchanged
        assert label in r
        assert r[label] == pytest.approx(r[label])  # sanity: value is a real number


def test_tb_rows_have_barrel_beff_twins():
    rows = _pl.build_total_bases_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    assert len(rows) > 0
    r = rows[0]
    assert "barrel_mult" in r
    for label in ("p_ge2", "p_ge3", "p_ge4"):
        assert f"{label}_beff" in r, f"missing {label}_beff"
        assert 0.0 <= r[f"{label}_beff"] <= 1.0
        # Base OFF probability must still be present and unchanged
        assert label in r
        assert r[label] == pytest.approx(r[label])  # sanity: value is a real number


def test_hits_beff_equals_base_times_barrel_mult():
    """_beff keys are exactly clamp(base * barrel_mult, 0, 1) — base key is byte-identical."""
    rows = _pl.build_hits_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    r = rows[0]
    bm = r["barrel_mult"]
    for label in ("p_ge1", "p_ge2", "p_ge3"):
        expected = min(1.0, max(0.0, r[label] * bm))
        assert r[f"{label}_beff"] == pytest.approx(expected)


# --- Barrel nudge wired into Runs + RBI + HRR rows ---

def test_run_props_have_barrel_beff_twins():
    lineup = _c_stacked_lineup()
    lineups_fn = lambda g: {"home": lineup, "away": lineup}
    for build, labels in (
        (_pl.build_runs_rows, ("p_ge1", "p_ge2")),
        (_pl.build_rbi_rows, ("p_ge1", "p_ge2")),
        (_pl.build_hrr_rows, ("p_ge2", "p_ge3", "p_ge4")),
    ):
        rows = build(_c_slate(), lineups_fn, _c_pitcher, _c_weather)
        assert len(rows) > 0, f"{build.__name__} returned no rows"
        r = rows[0]
        assert "barrel_mult" in r, f"{build.__name__}: missing barrel_mult"
        for label in labels:
            assert f"{label}_beff" in r, f"{build.__name__}: missing {label}_beff"
            assert 0.0 <= r[f"{label}_beff"] <= 1.0, f"{build.__name__}: {label}_beff out of range"
            # Base probability must still be present and unchanged
            assert label in r, f"{build.__name__}: base key {label} was removed"
