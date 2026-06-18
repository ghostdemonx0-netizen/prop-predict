# tests/test_history_merge.py
from model.export_web import build_board_with_history


def _bat(pid, hr_rate):  # profile stub
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "season_hr": hr_rate, "season_pa": 100, "recent_form_mult": 1.0,
            "k_rate": 0.22, "hit_rate": 0.22}


def _pit(pid):
    return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R",
            "k_per_bf": 0.22, "expected_bf": 24, "opponent_k_mult": 1.0, "k_line": 5.5,
            "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}


def test_history_twins_attached():
    slate = [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    cur_l = lambda g: {"home": [_bat(1, 5)], "away": [_bat(2, 5)]}
    hist_l = lambda g: {"home": [_bat(1, 9)], "away": [_bat(2, 9)]}  # higher HR base in history
    cur_p = lambda pid: _pit(pid)
    hist_p = lambda pid: {**_pit(pid), "k_per_bf": 0.30}
    w = lambda g: {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}
    hr, ks = build_board_with_history(slate, cur_l, cur_p, hist_l, hist_p, w, None)
    assert all("probability_hist" in r for r in hr)
    assert hr[0]["probability_hist"] != hr[0]["probability"]  # history base differs
    assert all("over_prob_hist" in r and "expected_ks_hist" in r for r in ks)
