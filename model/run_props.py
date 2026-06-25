"""Per-game rate math for the Runs / RBI / HRR props (Approach A).

A player's regressed per-game rate, scaled by matchup/park multipliers, becomes
a Poisson mean; over-thresholds come from the Poisson CDF. See
docs/superpowers/specs/2026-06-25-runs-rbi-hrr-design.md. League baselines and
REG_GAMES are calibration constants (require sign-off).
"""
from model.projections import poisson_over_prob

LEAGUE_R_PER_GAME = 0.50
LEAGUE_RBI_PER_GAME = 0.50
LEAGUE_HRR_PER_GAME = 1.80
REG_GAMES = 40.0


def regressed_per_game(total: float, games: float, league_per_game: float, regression_games: float) -> float:
    """Per-game rate regressed toward the league per-game average."""
    denom = games + regression_games
    if denom <= 0:
        return league_per_game
    return (total + league_per_game * regression_games) / denom


def expected_count(rate: float, *, pitcher_mult: float = 1.0, platoon_mult: float = 1.0, park_mult: float = 1.0) -> float:
    """Poisson mean = regressed rate scaled by matchup/park multipliers (>= 0)."""
    return max(0.0, rate * pitcher_mult * platoon_mult * park_mult)


def ge_probs(lam: float, thresholds: list[tuple[str, int]]) -> dict[str, float]:
    """{label: P(count >= n)} for a Poisson(lam) count. Monotonic by construction."""
    return {label: poisson_over_prob(lam, n - 0.5) for (label, n) in thresholds}
