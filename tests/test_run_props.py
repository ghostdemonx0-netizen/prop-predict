import math
import pytest
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


# --- production_form_mult ---

def test_production_form_mult_zero_guards():
    # recent_games <= 0
    assert rp.production_form_mult(0, 0, 0.5) == 1.0
    # season_rate <= 0
    assert rp.production_form_mult(5, 10, 0.0) == 1.0


def test_production_form_mult_hot():
    # raw = (10/10)/0.5 = 2.0; shrunk = (2*10 + 1*10) / (10+10) = 30/20 = 1.5; clamped hi=1.15
    result = rp.production_form_mult(10, 10, 0.5)
    assert result == 1.15


def test_production_form_mult_mild():
    # raw = (6/10)/0.5 = 1.2; shrunk = (1.2*10 + 1*10) / (10+10) = 22/20 = 1.1; no clamp
    result = rp.production_form_mult(6, 10, 0.5)
    assert math.isclose(result, 1.1)


# --- blend_forms ---

def test_blend_forms_neutral():
    assert rp.blend_forms(1.0, 1.0) == 1.0


def test_blend_forms_typical():
    # 1 + 0.60*(1.10-1) + 0.40*(1.05-1) = 1 + 0.06 + 0.02 = 1.08
    assert rp.blend_forms(1.10, 1.05) == pytest.approx(1.08)


def test_blend_forms_clamp_high():
    assert rp.blend_forms(2.0, 2.0) == 1.20


def test_blend_forms_clamp_low():
    assert rp.blend_forms(0.5, 0.5) == 0.80


# --- expected_count with form_mult ---

def test_expected_count_form_mult():
    assert rp.expected_count(0.5, form_mult=1.1) == pytest.approx(0.55)


def test_expected_count_form_mult_default_unchanged():
    # Existing behavior: default form_mult=1.0 must not change anything
    assert rp.expected_count(0.5) == 0.5
