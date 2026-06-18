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


def test_low_hit_rate_batter_valid_distribution():
    """A cold batter (low hit_rate) vs a hittable pitcher must not produce p0=0
    thanks to the hit_factor cap at 2.0."""
    # pa=400, s1=10, s2=2, s3=0, hr=1 → hit_rate = 13/400 = 0.0325 (very low)
    cold_bat = _bat(99, 400, 10, 2, 0, 1)
    # pitcher with high hit_allowed_rate to maximise hit_factor before the cap
    hittable_pit = {**_pit(100), "hit_allowed_rate": 0.38}
    lf = lambda g: {"home": [cold_bat], "away": []}
    pf = lambda pid: hittable_pit
    rows = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    assert rows, "expected at least one row"
    r = next(row for row in rows if row["player_id"] == 99)
    assert 0 <= r["p_ge1"] <= 1, "p_ge1 out of [0,1]"
    assert r["p_ge1"] <= 0.95, f"p_ge1={r['p_ge1']} is pathologically high (cap not working)"
    assert r["p_ge3"] <= r["p_ge2"] <= r["p_ge1"], "monotonic check failed"


def test_slugger_vs_slap_hitter_total_bases():
    """Slugger should have higher p_ge4 (extra-base power) than a slap hitter."""
    slugger = _bat(1, 500, 90, 30, 3, 30)
    slap = _bat(2, 500, 140, 15, 2, 0)
    lf = lambda g: {"home": [slugger, slap], "away": []}
    pf = lambda pid: _pit(pid)
    rows = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    slugger_row = next(r for r in rows if r["player_id"] == 1)
    slap_row = next(r for r in rows if r["player_id"] == 2)
    assert slugger_row["p_ge4"] > slap_row["p_ge4"], (
        f"slugger p_ge4={slugger_row['p_ge4']:.4f} should exceed slap p_ge4={slap_row['p_ge4']:.4f}"
    )
