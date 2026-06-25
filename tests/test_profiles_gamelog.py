from model import profiles

def _logs(n, r, rbi, h):
    return [{"game_date": f"2026-0{(i%9)+1}-01", "r": r, "rbi": rbi, "h": h} for i in range(n)]

def test_with_gamelog_current_season_totals():
    prof = profiles.with_gamelog({"player_id": 1}, {2026: _logs(10, 1, 1, 1)}, current_season=2026)
    assert prof["games"] == 10
    assert prof["total_r"] == 10
    assert prof["total_rbi"] == 10
    assert prof["total_hrr"] == 30          # (1+1+1) per game * 10

def test_with_gamelog_blended_history_weights_recent():
    logs = {2026: _logs(10, 2, 2, 2), 2025: _logs(10, 0, 0, 0), 2024: _logs(10, 0, 0, 0)}
    prof = profiles.with_gamelog({"player_id": 1}, logs, current_season=2026)
    # current season higher rate; blended hist twin sits between current and 0
    assert prof["total_r"] / prof["games"] == 2.0
    assert 0.0 < prof["total_r_hist"] / prof["games_hist"] < 2.0
