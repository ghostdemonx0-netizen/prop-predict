import math
from model import run_props as rp
from model import parks

def test_regressed_per_game_pulls_toward_league():
    # 0 made in 0 games -> league; hot player regresses down toward league
    assert rp.regressed_per_game(0, 0, 0.5, 40) == 0.5
    r = rp.regressed_per_game(40, 40, 0.5, 40)   # 1.0/game raw, reg toward 0.5
    assert 0.5 < r < 1.0
    assert math.isclose(r, (40 + 0.5 * 40) / (40 + 40))

def test_expected_count_multiplies_and_floors_at_zero():
    assert rp.expected_count(0.6, pitcher_mult=0.9, platoon_mult=1.06, park_mult=1.05) == \
        0.6 * 0.9 * 1.06 * 1.05
    assert rp.expected_count(-1.0) == 0.0

def test_ge_probs_poisson_thresholds():
    probs = rp.ge_probs(0.7, [("p_ge1", 1), ("p_ge2", 2)])
    assert math.isclose(probs["p_ge1"], 1 - math.exp(-0.7))
    assert math.isclose(probs["p_ge2"], 1 - math.exp(-0.7) * (1 + 0.7))
    # monotonic: P(>=2) <= P(>=1)
    assert probs["p_ge2"] <= probs["p_ge1"]

def test_ge_probs_zero_lambda():
    probs = rp.ge_probs(0.0, [("p_ge1", 1)])
    assert math.isclose(probs["p_ge1"], 0.0)

def test_pitcher_suppression_below_one_for_stingy_pitcher():
    assert rp.pitcher_suppression_mult(0.18) < 1.0     # allows fewer hits than league
    assert rp.pitcher_suppression_mult(0.26) > 1.0     # allows more
    assert rp.pitcher_suppression_mult(0.0) == 0.85    # clamped low
    assert rp.pitcher_suppression_mult(1.0) == 1.15    # clamped high

def test_run_park_factor_dampens_hr_factor():
    hr = parks.hr_park_factor("COL")        # Coors > 1
    rpf = parks.run_park_factor("COL")
    assert 1.0 < rpf < hr                    # dampened, still > 1
    assert math.isclose(rpf, 1 + (hr - 1) * 0.6)
