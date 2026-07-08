import math
from model.pitcher_engine import barrel_blended_rate, _implied, _VOTES_HR

def test_implied_scales_league_by_signal_ratio():
    # signal 1.5x league -> implied 1.5x league_rate
    assert math.isclose(_implied(0.033, 0.12, 0.08), 0.033 * 1.5, rel_tol=1e-9)

def test_implied_clamps_and_handles_missing():
    assert _implied(0.033, 0.40, 0.08) == 0.033 * 2.0   # 5x ratio clamps to 2.0
    assert _implied(0.033, 0.0, 0.08) == 0.033 * 0.5    # 0 ratio clamps to 0.5
    assert _implied(0.033, None, 0.08) == 0.033          # missing signal -> league

def test_blend_thin_sample_leans_implied():
    # 10 batters faced, votes=700 (HR) -> implied dominates
    r = barrel_blended_rate(1, 10, signal=0.12, league_rate=0.033, league_signal=0.08, votes=_VOTES_HR)
    implied = 0.033 * 1.5
    assert abs(r - implied) < 0.01           # basically the implied rate

def test_blend_pa_equals_votes_is_5050():
    # observed_rate = 0.05 (35 HR / 700 BF), implied = 0.033, votes=700, pa=700 -> avg
    r = barrel_blended_rate(35, 700, signal=0.08, league_rate=0.033, league_signal=0.08, votes=700)
    # signal==league_signal -> implied == league (0.033); observed = 0.05; 50/50 -> 0.0415
    assert math.isclose(r, (0.05 + 0.033) / 2, rel_tol=1e-6)

def test_blend_deep_sample_leans_observed():
    r = barrel_blended_rate(70, 1400, signal=0.08, league_rate=0.033, league_signal=0.08, votes=700)
    # observed 0.05, implied 0.033, pa=1400 vs votes 700 -> 2/3 observed
    assert abs(r - (0.05 * (1400/2100) + 0.033 * (700/2100))) < 1e-9

def test_blend_zero_denom_returns_implied():
    assert barrel_blended_rate(0, 0, signal=0.16, league_rate=0.033, league_signal=0.08, votes=0) == _implied(0.033, 0.16, 0.08)
