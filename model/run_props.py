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

RECENT_GAMES_WINDOW = 15
PROD_SHRINK_GAMES = 10


def regressed_per_game(total: float, games: float, league_per_game: float, regression_games: float) -> float:
    """Per-game rate regressed toward the league per-game average."""
    denom = games + regression_games
    if denom <= 0:
        return league_per_game
    return (total + league_per_game * regression_games) / denom


def production_form_mult(
    recent_total: float,
    recent_games: float,
    season_rate: float,
    *,
    shrink_games: float = PROD_SHRINK_GAMES,
    lo: float = 0.85,
    hi: float = 1.15,
) -> float:
    """Recent-form multiplier based on production rate vs season rate, shrunk toward 1.0."""
    if recent_games <= 0 or season_rate <= 0:
        return 1.0
    recent_rate = recent_total / recent_games
    raw = recent_rate / season_rate
    shrunk = (raw * recent_games + 1.0 * shrink_games) / (recent_games + shrink_games)
    return max(lo, min(shrunk, hi))


def blend_forms(hard_hit: float, production: float, *, w_hard: float = 0.60, lo: float = 0.80, hi: float = 1.20) -> float:
    """Weighted blend of hard-hit and production form multipliers, clamped."""
    blended = 1 + w_hard * (hard_hit - 1) + (1 - w_hard) * (production - 1)
    return max(lo, min(blended, hi))


def expected_count(rate: float, *, pitcher_mult: float = 1.0, platoon_mult: float = 1.0, park_mult: float = 1.0, form_mult: float = 1.0) -> float:
    """Poisson mean = regressed rate scaled by matchup/park/form multipliers (>= 0)."""
    return max(0.0, rate * pitcher_mult * platoon_mult * park_mult * form_mult)


def ge_probs(lam: float, thresholds: list[tuple[str, int]]) -> dict[str, float]:
    """{label: P(count >= n)} for a Poisson(lam) count. Monotonic by construction."""
    return {label: poisson_over_prob(lam, n - 0.5) for (label, n) in thresholds}


def pitcher_suppression_mult(hit_allowed_rate: float, *, league_hit: float = 0.22, lo: float = 0.85, hi: float = 1.15) -> float:
    """How many baserunners this pitcher allows vs league, clamped. <1 = stingy."""
    if league_hit <= 0:
        return 1.0
    return max(lo, min(hit_allowed_rate / league_hit, hi))
