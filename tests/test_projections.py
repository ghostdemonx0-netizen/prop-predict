import math
import pytest
from model.projections import (
    hr_probability, expected_strikeouts, poisson_over_prob,
    lineup_expected_ks, pitcher_hr_mult, expected_pa_for_slot, bvp_hr_mult,
)


def test_hr_probability_baseline_no_adjustments():
    # regression_pa=0 disables shrinkage so this tests the raw formula:
    # 40 HR / 600 PA = 0.0667 per PA; over 4 PA: 1-(1-0.0667)^4
    p = hr_probability(season_hr=40, season_pa=600, expected_pa=4.0, regression_pa=0)
    expected = 1 - (1 - 40 / 600) ** 4
    assert p == pytest.approx(expected)


def test_hr_probability_multipliers_stack():
    p = hr_probability(
        season_hr=30, season_pa=600,
        recent_form_mult=1.1, matchup_mult=1.2, park_mult=1.22,
        weather_mult=1.25, pitcher_mult=1.1, bvp_mult=1.05, expected_pa=4.0,
        regression_pa=0,  # test the raw multiplier stacking, no shrinkage
    )
    base = 30 / 600
    rate = base * 1.1 * 1.2 * 1.22 * 1.25 * 1.1 * 1.05
    rate = min(rate, 1.0)
    assert p == pytest.approx(1 - (1 - rate) ** 4)


def test_hr_probability_regresses_toward_league_mean_by_default():
    # By default the rate is regressed toward league average (0.033) by
    # adding 300 phantom league-average PAs, lowering the naive estimate.
    p = hr_probability(season_hr=40, season_pa=600, expected_pa=4.0)
    reg_rate = (40 + 0.033 * 300) / (600 + 300)
    assert p == pytest.approx(1 - (1 - reg_rate) ** 4)
    naive = 1 - (1 - 40 / 600) ** 4
    assert p < naive  # regression pulls the inflated naive estimate down


def test_hr_probability_small_hot_sample_is_regressed_hard():
    # 10 HR in 80 PA is a blistering 0.125/PA; shrinkage must temper it.
    p = hr_probability(season_hr=10, season_pa=80, expected_pa=4.0)
    reg_rate = (10 + 0.033 * 300) / (80 + 300)
    assert p == pytest.approx(1 - (1 - reg_rate) ** 4)
    naive = 1 - (1 - 10 / 80) ** 4
    assert p < naive * 0.8  # tempered well below the raw hot rate


def test_hr_probability_zero_pa_is_zero():
    assert hr_probability(season_hr=0, season_pa=0) == 0.0


def test_hr_probability_rate_clamped_to_one():
    # Absurd inputs cannot exceed certainty.
    p = hr_probability(season_hr=600, season_pa=600, park_mult=5.0, expected_pa=4.0)
    assert p == pytest.approx(1.0)


def test_expected_strikeouts():
    # 0.28 K per batter * 24 batters * 1.05 opponent factor
    assert expected_strikeouts(k_per_bf=0.28, expected_bf=24, opponent_k_mult=1.05) == pytest.approx(7.056)


def test_poisson_over_prob_matches_manual():
    # lambda=6, line=5.5 -> P(X>=6) = 1 - sum_{k=0}^{5} e^-6 6^k/k!
    lam = 6.0
    manual = 1 - sum(math.exp(-lam) * lam**k / math.factorial(k) for k in range(6))
    assert poisson_over_prob(lam, 5.5) == pytest.approx(manual)


def test_poisson_over_prob_integer_line_uses_strictly_greater():
    # line=6 (integer) -> threshold is 7 -> P(X>=7)
    lam = 6.0
    manual = 1 - sum(math.exp(-lam) * lam**k / math.factorial(k) for k in range(7))
    assert poisson_over_prob(lam, 6) == pytest.approx(manual)


def test_lineup_expected_ks_averages_lineup_probs():
    # three batters at 0.30/0.20/0.25 -> mean 0.25; * 24 BF = 6.0
    assert lineup_expected_ks([0.30, 0.20, 0.25], 24) == pytest.approx(6.0)


def test_lineup_expected_ks_empty_lineup_returns_none():
    assert lineup_expected_ks([], 24) is None


def test_lineup_expected_ks_nonpositive_bf_returns_none():
    assert lineup_expected_ks([0.25], 0) is None


def test_pitcher_hr_mult_league_average_is_neutral():
    assert pitcher_hr_mult(0.033, 500) == pytest.approx(1.0)


def test_pitcher_hr_mult_no_data_is_neutral():
    assert pitcher_hr_mult(0.0, 0) == pytest.approx(1.0)


def test_pitcher_hr_mult_gopher_ball_pitcher_clamped():
    # 0.05 HR/BF over 400 BF: (20 + 6.6)/600 = 0.04433/0.033 = 1.343 -> clamp 1.3
    assert pitcher_hr_mult(0.05, 400) == pytest.approx(1.3)


def test_pitcher_hr_mult_hr_suppressor_below_one():
    assert pitcher_hr_mult(0.015, 500) < 1.0


def test_pitcher_hr_mult_negative_bf_is_neutral():
    assert pitcher_hr_mult(0.05, -50) == pytest.approx(1.0)


def test_expected_pa_for_slot_declines_through_order():
    assert expected_pa_for_slot(0) == pytest.approx(4.65)
    assert expected_pa_for_slot(8) == pytest.approx(3.78)
    assert expected_pa_for_slot(0) > expected_pa_for_slot(4) > expected_pa_for_slot(8)
    assert expected_pa_for_slot(11) == 4.0  # out of range -> neutral
    assert expected_pa_for_slot(9) == 4.0  # first slot past the order


def test_bvp_hr_mult_zero_pa_is_neutral():
    assert bvp_hr_mult(0, 0) == pytest.approx(1.0)


def test_bvp_hr_mult_single_meeting_is_nearly_neutral():
    # 1 career PA, no HR: shrinkage keeps it ~0.995
    assert bvp_hr_mult(0, 1) == pytest.approx((0.033 * 200) / 201 / 0.033)
    assert 0.99 < bvp_hr_mult(0, 1) < 1.0


def test_bvp_hr_mult_owner_hits_the_cap():
    # 2 HR in 10 PA: (2 + 6.6)/210/0.033 = 1.24 -> capped at 1.10
    assert bvp_hr_mult(2, 10) == pytest.approx(1.10)


def test_bvp_hr_mult_never_homered_in_twenty():
    assert bvp_hr_mult(0, 20) == pytest.approx((0.033 * 200) / 220 / 0.033)
    assert bvp_hr_mult(0, 20) == pytest.approx(0.909, abs=1e-3)
