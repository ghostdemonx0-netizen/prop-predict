from model.pipeline import build_runs_rows, build_rbi_rows, build_hrr_rows

def _bat(pid, games, r, rbi, hrr):
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "games": games, "total_r": r, "total_rbi": rbi, "total_hrr": hrr,
            "k_rate": 0.22, "hit_rate": 0.25, "lineup_status": "confirmed"}

def _pit(pid):
    return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R",
            "k_per_bf": 0.22, "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}

_SLATE = [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
           "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
_L = lambda g: {"home": [_bat(1, 100, 60, 70, 200)], "away": [_bat(2, 100, 50, 50, 180)]}
_W = lambda g: {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}

def test_runs_rows_have_two_thresholds_in_range():
    rows = build_runs_rows(_SLATE, _L, lambda p: _pit(p), _W)
    r = next(x for x in rows if x["player_id"] == 1)
    assert 0.0 < r["p_ge1"] <= 1.0 and 0.0 <= r["p_ge2"] <= r["p_ge1"]
    assert r["prop"] == "RUNS" and r["vs"]["lean"] in ("K", "H", "NEU")

def test_rbi_and_hrr_rows_thresholds():
    rbi = build_rbi_rows(_SLATE, _L, lambda p: _pit(p), _W)[0]
    assert "p_ge1" in rbi and "p_ge2" in rbi and rbi["prop"] == "RBI"
    hrr = build_hrr_rows(_SLATE, _L, lambda p: _pit(p), _W)[0]
    assert all(k in hrr for k in ("p_ge2", "p_ge3", "p_ge4")) and hrr["prop"] == "HRR"
    assert hrr["p_ge2"] >= hrr["p_ge3"] >= hrr["p_ge4"]   # monotonic
