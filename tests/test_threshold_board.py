# tests/test_threshold_board.py
from model.export_web import build_board_with_history


def _bat(pid, pa, hr): return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
    "season_pa": pa, "season_1b": 90, "season_2b": 25, "season_3b": 3, "season_hr": hr,
    "recent_form_mult": 1.0, "k_rate": 0.22, "hit_rate": (90+25+3+hr)/pa}
def _pit(pid): return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R",
    "k_per_bf": 0.22, "expected_bf": 24, "opponent_k_mult": 1.0, "k_line": 5.5,
    "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}


def test_board_includes_hits_tb_with_hist():
    slate = [{"game_id":1,"home":"AAA","away":"BBB","park_team":"AAA","home_pitcher_id":100,"away_pitcher_id":200,"started":False}]
    cur_l = lambda g: {"home":[_bat(1,400,20)],"away":[_bat(2,400,20)]}
    hist_l = lambda g: {"home":[_bat(1,400,35)],"away":[_bat(2,400,35)]}  # different HR base
    w = lambda g: {"wind_speed_mph":0,"wind_from_deg":0,"temp_f":70,"precip_pct":0}
    hr, ks, hits, tb = build_board_with_history(slate, cur_l, lambda p:_pit(p), hist_l, lambda p:_pit(p), w, None)
    assert hits and "p_ge1_hist" in hits[0] and tb and "p_ge2_hist" in tb[0]
    # all hits twins present
    assert all(f"p_ge{n}_hist" in hits[0] for n in (1, 2, 3))
    # all TB twins present
    assert all(f"p_ge{n}_hist" in tb[0] for n in (2, 3, 4))
    # vs hist twins present on hits and tb
    hits_vs = hits[0].get("vs")
    tb_vs = tb[0].get("vs")
    assert hits_vs is not None, "hits row should have vs"
    assert tb_vs is not None, "tb row should have vs"
    for field in ("lean_hist", "prob_hist", "k_prob_hist", "hit_prob_hist"):
        assert field in hits_vs, f"hits vs missing {field}"
        assert field in tb_vs, f"tb vs missing {field}"


def test_threshold_missing_twin_graceful():
    # history lineup empty -> current rows build, no *_hist, no crash
    slate = [{"game_id":1,"home":"AAA","away":"BBB","park_team":"AAA","home_pitcher_id":100,"away_pitcher_id":200,"started":False}]
    cur_l = lambda g: {"home":[_bat(1,400,20)],"away":[_bat(2,400,20)]}
    hist_l = lambda g: {"home":[],"away":[]}
    w = lambda g: {"wind_speed_mph":0,"wind_from_deg":0,"temp_f":70,"precip_pct":0}
    hr, ks, hits, tb = build_board_with_history(slate, cur_l, lambda p:_pit(p), hist_l, lambda p:_pit(p), w, None)
    assert hits and "p_ge1_hist" not in hits[0]   # no twin, but no crash
