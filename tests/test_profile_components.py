# tests/test_profile_components.py
import math
from model.profiles import batter_profile_from_events, blended_batter_profile
from model.profiles import pitcher_profile_from_events
from model.profiles import regress, LEAGUE_K, LEAGUE_HIT, _K_R, _HIT_R


def _ev(d, e): return {"game_date": d, "events": e, "launch_speed": 90.0}


def test_profile_counts_singles_doubles_triples():
    evs = [_ev("2026-04-01", "single"), _ev("2026-04-01", "double"), _ev("2026-04-01", "triple"),
           _ev("2026-04-01", "home_run"), _ev("2026-04-01", "strikeout"), _ev("2026-04-01", "field_out")]
    p = batter_profile_from_events(evs, as_of="2026-06-01", player_id=1, name="X", bats="R")
    assert p["season_pa"] == 6
    assert p["season_1b"] == 1 and p["season_2b"] == 1 and p["season_3b"] == 1
    assert p["season_hr"] == 1


def test_profile_existing_fields_unchanged():
    """Existing fields from batter_profile_from_events must be unaffected."""
    evs = [_ev("2026-04-01", "single"), _ev("2026-04-01", "strikeout"), _ev("2026-04-01", "home_run")]
    p = batter_profile_from_events(evs, as_of="2026-06-01", player_id=2, name="Y", bats="L")
    assert p["season_pa"] == 3
    assert p["season_hr"] == 1
    assert math.isclose(p["k_rate"], regress(1, 3, LEAGUE_K, _K_R))    # regressed (was raw 1/3)
    assert math.isclose(p["hit_rate"], regress(2, 3, LEAGUE_HIT, _HIT_R))  # regressed (was raw 2/3)


def _bat_events_with_xb(n_pa, n_hr, n_1b, n_2b, n_3b, n_k, date):
    rows = []
    idx = 0
    for _ in range(n_hr):
        rows.append({"game_date": date, "events": "home_run", "launch_speed": 95.0})
        idx += 1
    for _ in range(n_1b):
        rows.append({"game_date": date, "events": "single", "launch_speed": 90.0})
        idx += 1
    for _ in range(n_2b):
        rows.append({"game_date": date, "events": "double", "launch_speed": 90.0})
        idx += 1
    for _ in range(n_3b):
        rows.append({"game_date": date, "events": "triple", "launch_speed": 90.0})
        idx += 1
    for _ in range(n_k):
        rows.append({"game_date": date, "events": "strikeout", "launch_speed": 90.0})
        idx += 1
    for _ in range(n_pa - idx):
        rows.append({"game_date": date, "events": "field_out", "launch_speed": 90.0})
    return rows


def test_blended_batter_returns_1b_2b_3b():
    """blended_batter_profile must return season_1b/2b/3b blended across seasons."""
    ebs = {
        2026: _bat_events_with_xb(200, 10, 20, 5, 2, 40, "2026-04-01"),
        2025: _bat_events_with_xb(600, 30, 60, 15, 6, 120, "2025-06-01"),
        2024: _bat_events_with_xb(600, 25, 50, 12, 4, 120, "2024-06-01"),
    }
    p = blended_batter_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=3, name="Z", bats="R")
    assert "season_1b" in p
    assert "season_2b" in p
    assert "season_3b" in p
    # Blended 1b counts: (5*20 + 4*60 + 3*50) / 5 = (100+240+150)/5 = 490/5 = 98
    assert math.isclose(p["season_1b"], 98.0)
    # Blended 2b counts: (5*5 + 4*15 + 3*12) / 5 = (25+60+36)/5 = 121/5 = 24.2
    assert math.isclose(p["season_2b"], 24.2)
    # Blended 3b counts: (5*2 + 4*6 + 3*4) / 5 = (10+24+12)/5 = 46/5 = 9.2
    assert math.isclose(p["season_3b"], 9.2)
    # Existing fields still intact
    assert math.isclose(p["season_hr"], 49.0)
    assert math.isclose(p["season_pa"], 1040.0)


def _brow(d, e, ls=90.0, la=15.0, lsa=5, bb="line_drive", hx=None, hy=None, stand="R", xw=0.3, gp=1):
    return {"game_date": d, "events": e, "launch_speed": ls, "launch_angle": la,
            "launch_speed_angle": lsa, "bb_type": bb, "hc_x": hx, "hc_y": hy,
            "stand": stand, "estimated_woba_using_speedangle": xw, "game_pk": gp}


def test_batter_profile_has_barrel_fields():
    evs = [
        _brow("2026-04-01", "home_run", ls=105, la=27, lsa=6, bb="fly_ball", hx=80.0, hy=100.0),
        _brow("2026-04-02", "single",   ls=88,  la=10, lsa=4, bb="line_drive"),
    ]
    p = batter_profile_from_events(evs, as_of="2026-06-01", player_id=1)
    assert p["barrel_rate"] == 0.5
    assert p["hrfb_rate"] == 1.0          # 1 HR / 1 fly ball
    assert "pulled_barrel_rate" in p and "xwobacon" in p and "sweetspot_rate" in p
    # existing fields untouched
    assert p["season_hr"] == 1 and p["season_pa"] == 2


def test_pitcher_profile_has_allowed_barrel_fields():
    evs = [
        _brow("2026-04-01", "home_run", ls=103, la=25, lsa=6, bb="fly_ball", hx=80.0, hy=100.0),
        _brow("2026-04-01", "strikeout", ls=None, bb=None),
    ]
    p = pitcher_profile_from_events(evs, as_of="2026-06-01", player_id=9)
    assert p["barrel_rate_allowed"] == 1.0    # 1 barrel of 1 BBE allowed
    assert "pulled_barrel_rate_allowed" in p and "hardhit_rate_allowed" in p
    assert "barrel_rate" not in p             # pitcher uses the _allowed flavor
    # existing fields untouched
    assert p["k_per_bf"] >= 0.0 and p["bf"] == 2
