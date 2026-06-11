import math
import pytest
from model.projections import hr_probability, expected_strikeouts, poisson_over_prob


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
        weather_mult=1.25, pitcher_mult=1.1, expected_pa=4.0,
        regression_pa=0,  # test the raw multiplier stacking, no shrinkage
    )
    base = 30 / 600
    rate = base * 1.1 * 1.2 * 1.22 * 1.25 * 1.1
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
    from model.projections import lineup_expected_ks
    # three batters at 0.30/0.20/0.25 -> mean 0.25; * 24 BF = 6.0
    assert lineup_expected_ks([0.30, 0.20, 0.25], 24) == pytest.approx(6.0)


def test_lineup_expected_ks_empty_lineup_returns_none():
    from model.projections import lineup_expected_ks
    assert lineup_expected_ks([], 24) is None
