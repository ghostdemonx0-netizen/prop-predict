# tests/test_blended_profiles.py
import math
from model.profiles import blended_batter_profile, blended_pitcher_profile

def _bat_events(n_pa, n_hr, n_k, n_hit, date):
    rows = []
    for i in range(n_pa):
        ev = "home_run" if i < n_hr else ("strikeout" if i < n_hr + n_k else ("single" if i < n_hr + n_k + n_hit else "field_out"))
        rows.append({"game_date": date, "events": ev, "launch_speed": 90.0})
    return rows

def test_blended_batter_blends_hr_across_seasons():
    ebs = {
        2026: _bat_events(200, 10, 40, 50, "2026-04-01"),
        2025: _bat_events(600, 30, 120, 150, "2025-06-01"),
        2024: _bat_events(600, 25, 120, 150, "2024-06-01"),
    }
    p = blended_batter_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=1, name="X", bats="R")
    # season_hr/season_pa are the normalized blend (W/5): 49 HR / 1040 PA
    assert math.isclose(p["season_hr"], 49.0)
    assert math.isclose(p["season_pa"], 1040.0)
    # k_rate is regressed toward LEAGUE_K (0.225), R=200
    blended_k = (5*40 + 4*120 + 3*120) / 5      # effective K made
    assert math.isclose(p["k_rate"], (blended_k + 0.225*200) / (1040 + 200))

def test_blended_batter_rookie_only_current():
    ebs = {2026: _bat_events(100, 5, 20, 25, "2026-04-01"), 2025: [], 2024: []}
    p = blended_batter_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=2, name="R", bats="L")
    # only current contributes; normalized by top weight 5 -> same counts
    assert math.isclose(p["season_hr"], 5.0)
    assert math.isclose(p["season_pa"], 100.0)

def test_blended_pitcher_keeps_current_workload_blends_rates():
    def _pit(n_pa, n_k, date, gp):
        return [{"game_date": date, "events": ("strikeout" if i < n_k else "field_out"),
                 "game_pk": gp + (i % 2)} for i in range(n_pa)]
    ebs = {2026: _pit(120, 30, "2026-04-01", 100), 2025: _pit(600, 180, "2025-06-01", 200), 2024: _pit(600, 150, "2024-06-01", 300)}
    p = blended_pitcher_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=3, name="P", throws="R")
    blended_k = (5*30 + 4*180 + 3*150) / 5
    blended_pa = (5*120 + 4*600 + 3*600) / 5
    # k_per_bf is now barrel_blended_rate; fixture has no pitch descriptions → swstr=0 → signal
    # treated as no-data → implied = LEAGUE_K (neutral). Votes constant is _VOTES_K=175, not _K_R=200.
    assert math.isclose(p["k_per_bf"], (blended_k + 0.225 * 175) / (blended_pa + 175))
    # bf/expected_bf reflect CURRENT season only (120 PA), not the blend
    assert p["bf"] == 120
