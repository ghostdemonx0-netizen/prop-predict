from model.export_web import build_board_with_history

def _bat(pid, games, r, rbi, hrr):
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "games": games, "total_r": r, "total_rbi": rbi, "total_hrr": hrr,
            "games_hist": games, "total_r_hist": r, "total_rbi_hist": rbi, "total_hrr_hist": hrr,
            "k_rate": 0.22, "hit_rate": 0.25, "lineup_status": "confirmed",
            "season_pa": 400, "season_1b": 90, "season_2b": 25, "season_3b": 3, "season_hr": 20,
            "recent_form_mult": 1.0}
def _pit(pid):
    return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R", "k_per_bf": 0.22,
            "k_line": 5.5, "expected_bf": 24, "opponent_k_mult": 1.0,
            "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}

def test_board_includes_runs_rbi_hrr_with_hist():
    slate = [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    cur = lambda g: {"home": [_bat(1, 100, 60, 70, 200)], "away": [_bat(2, 100, 50, 50, 180)]}
    w = lambda g: {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}
    out = build_board_with_history(slate, cur, lambda p: _pit(p), cur, lambda p: _pit(p), w, None)
    assert len(out) == 7
    hr, ks, hits, tb, runs, rbi, hrr = out
    assert "p_ge1_hist" in runs[0] and "p_ge1_hist" in rbi[0]
    assert "p_ge2_hist" in hrr[0]
