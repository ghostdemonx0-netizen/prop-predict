"""Pure projection math for HR and strikeout props (v1, transparent model)."""

import math

LEAGUE_HR_RATE = 0.033  # league-average HR per plate appearance


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
    league_hr_rate: float = LEAGUE_HR_RATE,
    regression_pa: float = 300.0,
) -> float:
    """Probability a hitter hits at least one HR in the game.

    The season HR-per-PA rate is first regressed toward the league average
    (``league_hr_rate``) by adding ``regression_pa`` phantom league-average
    plate appearances. This shrinkage tempers small or hot samples so a
    partial/hot season doesn't produce wildly inflated probabilities
    (calibration). Set ``regression_pa=0`` to use the raw rate.

    The regressed rate then gets multiplicative adjustments (each centered
    at 1.0) and is converted into a "1 or more in ``expected_pa`` chances"
    probability.
    """
    if season_pa <= 0:
        return 0.0
    base = (season_hr + league_hr_rate * regression_pa) / (season_pa + regression_pa)
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


def lineup_expected_ks(k_probs: list[float], expected_bf: float) -> float | None:
    """Opponent-adjusted expected strikeouts.

    Average per-PA strikeout probability against the actual posted lineup
    (log5 + platoon, computed upstream) times expected batters faced.
    Returns None when the lineup is empty so callers can fall back to the
    pitcher-only estimate.

    Assumes the posted batters are representative of the full lineup; a
    partially posted lineup can bias the average.
    """
    if not k_probs or expected_bf <= 0:
        return None
    return (sum(k_probs) / len(k_probs)) * expected_bf


PA_BY_SLOT = (4.65, 4.54, 4.43, 4.32, 4.21, 4.10, 3.99, 3.89, 3.78)


def expected_pa_for_slot(slot: int) -> float:
    """Average plate appearances by batting-order slot (0 = leadoff).

    League-average figures; out-of-range slots get a neutral 4.0.
    """
    return PA_BY_SLOT[slot] if 0 <= slot < len(PA_BY_SLOT) else 4.0


def pitcher_hr_mult(
    hr_allowed_rate: float,
    bf: float,
    *,
    league_hr_rate: float = LEAGUE_HR_RATE,
    regression_bf: float = 200.0,
) -> float:
    """How much the opposing pitcher inflates or suppresses HRs.

    The pitcher's HR-allowed-per-batter rate is regressed toward league
    average with ``regression_bf`` phantom batters faced, then expressed as
    a multiplier vs league (1.0 = average), clamped to [0.75, 1.3].
    """
    bf = max(0.0, bf)
    reg = (hr_allowed_rate * bf + league_hr_rate * regression_bf) / (bf + regression_bf)
    return max(0.75, min(reg / league_hr_rate, 1.3))
