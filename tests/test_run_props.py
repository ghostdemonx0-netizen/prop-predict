import math
import pytest
from model import run_props as rp

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


# --- Approach C: lineup-context tests ---

def test_slot_factor_runs_peaks_top_rbi_peaks_middle():
    assert rp.slot_factor(1, "RUNS") > rp.slot_factor(9, "RUNS")   # leadoff scores more
    assert rp.slot_factor(4, "RBI") > rp.slot_factor(1, "RBI")     # cleanup drives in more
    assert rp.slot_factor(1, "RUNS") == 1.15
    assert rp.slot_factor(4, "RBI") == 1.18


def test_slot_factor_clamps_out_of_range_position():
    assert rp.slot_factor(0, "RUNS") == rp.slot_factor(1, "RUNS")
    assert rp.slot_factor(12, "RBI") == rp.slot_factor(9, "RBI")


def test_slg_per_pa_total_bases_over_pa():
    # 5 singles, 2 doubles, 1 triple, 2 HR over 40 PA = (5 + 4 + 3 + 8)/40 = 0.5
    assert rp.slg_per_pa(5, 2, 1, 2, 40) == 0.5
    assert rp.slg_per_pa(1, 0, 0, 0, 0) == 0.0   # no PA -> 0


def test_trust_weight_confirmed_vs_projected():
    assert rp.trust_weight("confirmed") == 0.80
    assert rp.trust_weight("projected") == 0.35
    assert rp.trust_weight("anything_else") == 0.35   # default to cautious


def test_teammate_factor_centers_at_one():
    assert rp.teammate_factor(0.360, 0.360) == 1.0
    assert abs(rp.teammate_factor(0.432, 0.360) - 1.10) < 1e-9   # +20%, S=0.5 -> +10%
    assert rp.teammate_factor(None, 0.360) == 1.0


def test_neighbor_avg_circular_behind_and_ahead():
    vals = [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]
    assert rp.neighbor_avg(vals, 0, behind=True) == 1.5    # idx1,idx2
    assert rp.neighbor_avg(vals, 0, behind=False) == 7.5   # wraps to idx8,idx7
    assert rp.neighbor_avg(vals, 8, behind=True) == 0.5    # wraps to idx0,idx1


def test_neighbor_avg_skips_self_and_handles_short_lists():
    assert rp.neighbor_avg([5.0], 0, behind=True) is None
    assert rp.neighbor_avg([], 0, behind=True) is None


def test_lineup_mult_blend_and_cap():
    assert abs(rp.lineup_mult(1.08, 1.14, "confirmed") - 1.128) < 1e-9
    assert abs(rp.lineup_mult(1.08, 1.14, "projected") - 1.101) < 1e-9
    assert rp.lineup_mult(1.20, 2.0, "confirmed") == 1.15
    assert rp.lineup_mult(0.5, 0.2, "confirmed") == 0.85


def test_hrr_lineup_mult_damped_and_capped():
    assert abs(rp.hrr_lineup_mult(1.15, 1.05) - 1.055) < 1e-9
    assert rp.hrr_lineup_mult(1.0, 1.0) == 1.0


def test_expected_count_applies_lineup_mult():
    assert rp.expected_count(0.50) == 0.50
    assert abs(rp.expected_count(0.50, lineup_mult=1.10) - 0.55) < 1e-9
    assert rp.expected_count(0.50, pitcher_mult=1.2) == rp.expected_count(0.50, pitcher_mult=1.2, lineup_mult=1.0)


# --- HRR negative-binomial tail ---

def test_ge_probs_default_is_poisson_unchanged():
    from model.projections import poisson_over_prob
    out = rp.ge_probs(1.8, [("p_ge2", 2), ("p_ge3", 3)])
    assert out["p_ge2"] == poisson_over_prob(1.8, 1.5)
    assert out["p_ge3"] == poisson_over_prob(1.8, 2.5)


def test_ge_probs_nb_size_uses_negative_binomial():
    from model.projections import poisson_over_prob
    out = rp.ge_probs(1.8, [("p_ge3", 3)], nb_size=rp.HRR_NB_SIZE)
    assert out["p_ge3"] > poisson_over_prob(1.8, 2.5)   # fatter tail
    assert rp.HRR_NB_SIZE == 4.0
