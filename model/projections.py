"""Pure projection math for HR and strikeout props (v1, transparent model)."""

import math


def hr_probability(
    season_hr: float,
    season_pa: float,
    *,
    recent_form_mult: float = 1.0,
    matchup_mult: float = 1.0,
    park_mult: float = 1.0,
    weather_mult: float = 1.0,
    pitcher_mult: float = 1.0,
    expected_pa: float = 4.0,
) -> float:
    """Probability a hitter hits at least one HR in the game.

    Starts from the season HR-per-PA rate, applies multiplicative
    adjustments (each centered at 1.0), then converts a per-PA rate into a
    "1 or more in `expected_pa` chances" probability.
    """
    if season_pa <= 0:
        return 0.0
    base = season_hr / season_pa
    rate = base * recent_form_mult * matchup_mult * park_mult * weather_mult * pitcher_mult
    rate = max(0.0, min(rate, 1.0))
    return 1 - (1 - rate) ** expected_pa


def expected_strikeouts(k_per_bf: float, expected_bf: float, opponent_k_mult: float = 1.0) -> float:
    """Expected strikeouts = per-batter K rate * batters faced * opponent factor."""
    return k_per_bf * expected_bf * opponent_k_mult


def poisson_over_prob(lam: float, line: float) -> float:
    """P(strikeouts > line) modeling strikeouts as Poisson(lam).

    For a .5 line (e.g., 5.5) this is P(X >= 6). For an integer line
    (e.g., 6) it is P(X >= 7), i.e., strictly greater than the line.
    """
    threshold = math.floor(line) + 1
    cdf = sum(math.exp(-lam) * lam**k / math.factorial(k) for k in range(threshold))
    return 1 - cdf
