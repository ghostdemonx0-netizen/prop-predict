import math
import pytest
from model.projections import (
    hr_probability, hr_rate_per_pa, expected_strikeouts, poisson_over_prob,
    lineup_expected_ks, pitcher_hr_mult, expected_pa_for_slot, bvp_hr_mult,
)


def test_hr_rate_per_pa_matches_internal_rate():
    # base = (10 + 0.033*300)/(300+300) = 19.9/600
    r = hr_rate_per_pa(10, 300)
    assert abs(r - (10 + 0.033 * 300) / 600) < 1e-9


def test_hr_probability_unchanged_decomposition():
    # hr_probability == 1-(1-rate)^pa with the same per-PA rate
    r = hr_rate_per_pa(20, 400, park_mult=1.1, weather_mult=1.05)
    assert abs(hr_probability(20, 400, park_mult=1.1, weather_mult=1.05, expected_pa=4.2)
               - (1 - (1 - r) ** 4.2)) < 1e-12


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
    # 1 career PA, no HR: shrinkage keeps it ~0.998
    assert bvp_hr_mult(0, 1) == pytest.approx((0.033 * 600) / 601 / 0.033)
    assert 0.99 < bvp_hr_mult(0, 1) < 1.0


def test_bvp_hr_mult_climbs_a_ladder_not_a_cliff():
    # user-tuned ladder: 1 HR small boost, 2 HR bigger, 3+ caps at +10%
    one = bvp_hr_mult(1, 9)
    two = bvp_hr_mult(2, 15)
    three = bvp_hr_mult(3, 20)
    assert one == pytest.approx((1 + 0.033 * 600) / 609 / 0.033)  # ~1.035
    assert 1.02 < one < 1.05
    assert 1.05 < two < 1.09
    assert three == pytest.approx(1.10)  # the cap
    assert one < two < three


def test_bvp_hr_mult_one_hr_in_many_meetings_is_neutral():
    # 1 HR in 30 PAs is league-average power vs him -> no boost
    assert bvp_hr_mult(1, 30) == pytest.approx(1.0, abs=0.01)


def test_bvp_hr_mult_never_homered_in_twenty():
    assert bvp_hr_mult(0, 20) == pytest.approx((0.033 * 600) / 620 / 0.033)
    assert bvp_hr_mult(0, 20) == pytest.approx(0.968, abs=1e-3)


# --- HRR negative-binomial tail ---
from model.projections import nb_over_prob


def test_nb_fatter_tail_than_poisson_same_mean():
    assert nb_over_prob(1.8, 2.5, 4.0) > poisson_over_prob(1.8, 2.5)


def test_nb_approaches_poisson_for_large_size():
    assert abs(nb_over_prob(1.8, 2.5, 1e6) - poisson_over_prob(1.8, 2.5)) < 1e-3


def test_nb_zero_mean_is_zero():
    assert nb_over_prob(0.0, 1.5, 4.0) == 0.0


def test_nb_monotonic_in_threshold():
    p2 = nb_over_prob(1.8, 1.5, 4.0)
    p3 = nb_over_prob(1.8, 2.5, 4.0)
    p4 = nb_over_prob(1.8, 3.5, 4.0)
    assert p2 >= p3 >= p4 >= 0.0


def test_nb_size_nonpositive_falls_back_to_poisson():
    assert nb_over_prob(1.8, 2.5, 0.0) == poisson_over_prob(1.8, 2.5)


# --- BvP hit dial ---
from model.projections import bvp_hit_mult, LEAGUE_HIT


def test_bvp_hit_mult_no_history_neutral():
    assert bvp_hit_mult(0, 0) == 1.0


def test_bvp_hit_mult_zero_hits_fades_down():
    m = bvp_hit_mult(0, 30)
    assert 0.90 <= m < 1.0


def test_bvp_hit_mult_strong_sample_climbs_capped():
    m = bvp_hit_mult(40, 60)
    assert 1.0 < m <= 1.10


def test_bvp_hit_mult_small_sample_barely_moves():
    assert abs(bvp_hit_mult(6, 12) - 1.0) < 0.03   # 6-for-12 -> ~+2.5% (heavy shrinkage)
