# tests/test_threshold_pipeline.py
from model.pipeline import build_hits_rows, build_total_bases_rows


def _bat(pid, pa, s1, s2, s3, hr):
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "season_pa": pa, "season_1b": s1, "season_2b": s2, "season_3b": s3,
            "season_hr": hr, "recent_form_mult": 1.0, "k_rate": 0.22, "hit_rate": (s1+s2+s3+hr)/pa}


def _pit(pid):
    return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R",
            "k_per_bf": 0.22, "expected_bf": 24, "opponent_k_mult": 1.0, "k_line": 5.5,
            "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}


def _slate():
    return [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
             "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]


def _w(g): return {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}


def test_hits_rows_thresholds_monotonic():
    lf = lambda g: {"home": [_bat(1, 400, 90, 25, 3, 20)], "away": [_bat(2, 400, 90, 25, 3, 20)]}
    pf = lambda pid: _pit(pid)
    rows = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    assert r["prop"] == "HITS"
    assert 0 <= r["p_ge3"] <= r["p_ge2"] <= r["p_ge1"] <= 1  # monotonic


def test_total_bases_rows_present_and_monotonic():
    lf = lambda g: {"home": [_bat(1, 400, 90, 25, 3, 20)], "away": [_bat(2, 400, 90, 25, 3, 20)]}
    pf = lambda pid: _pit(pid)
    rows = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    assert r["prop"] == "TB"
    assert 0 <= r["p_ge4"] <= r["p_ge3"] <= r["p_ge2"] <= 1
