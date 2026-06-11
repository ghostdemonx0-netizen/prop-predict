import math
import pytest
from model.projections import hr_probability, expected_strikeouts, poisson_over_prob


def test_hr_probability_baseline_no_adjustments():
    # 40 HR / 600 PA = 0.0667 per PA; over 4 PA: 1-(1-0.0667)^4
    p = hr_probability(season_hr=40, season_pa=600, expected_pa=4.0)
    expected = 1 - (1 - 40 / 600) ** 4
    assert p == pytest.approx(expected)


def test_hr_probability_multipliers_stack():
    p = hr_probability(
        season_hr=30, season_pa=600,
        recent_form_mult=1.1, matchup_mult=1.2, park_mult=1.22,
        weather_mult=1.25, pitcher_mult=1.1, expected_pa=4.0,
    )
    base = 30 / 600
    rate = base * 1.1 * 1.2 * 1.22 * 1.25 * 1.1
    rate = min(rate, 1.0)
    assert p == pytest.approx(1 - (1 - rate) ** 4)


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
