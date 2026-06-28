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

# --- Approach C: lineup-context constants (seed values; tunable from grader data) ---
SLOT_RUNS = {1: 1.15, 2: 1.10, 3: 1.05, 4: 1.00, 5: 0.97, 6: 0.94, 7: 0.91, 8: 0.88, 9: 0.90}
SLOT_RBI = {1: 0.85, 2: 0.93, 3: 1.10, 4: 1.18, 5: 1.08, 6: 1.00, 7: 0.93, 8: 0.88, 9: 0.85}
TRUST_CONFIRMED = 0.80
TRUST_PROJECTED = 0.35
LINEUP_CAP_LO = 0.85
LINEUP_CAP_HI = 1.15
HRR_LINEUP_SHARE = 0.55
TEAMMATE_SENSITIVITY = 0.50
N_NEIGHBORS = 2
LEAGUE_ONBASE = 0.220   # hit_rate (hits/PA) league proxy for on-base ability
LEAGUE_SLG = 0.360      # total-bases-per-PA league proxy for power


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


def expected_count(rate: float, *, pitcher_mult: float = 1.0, platoon_mult: float = 1.0,
                   park_mult: float = 1.0, form_mult: float = 1.0, lineup_mult: float = 1.0) -> float:
    """Poisson mean = regressed rate scaled by matchup/park/form/lineup multipliers (>= 0)."""
    return max(0.0, rate * pitcher_mult * platoon_mult * park_mult * form_mult * lineup_mult)


def ge_probs(lam: float, thresholds: list[tuple[str, int]]) -> dict[str, float]:
    """{label: P(count >= n)} for a Poisson(lam) count. Monotonic by construction."""
    return {label: poisson_over_prob(lam, n - 0.5) for (label, n) in thresholds}


def pitcher_suppression_mult(hit_allowed_rate: float, *, league_hit: float = 0.22, lo: float = 0.85, hi: float = 1.15) -> float:
    """How many baserunners this pitcher allows vs league, clamped. <1 = stingy."""
    if league_hit <= 0:
        return 1.0
    return max(lo, min(hit_allowed_rate / league_hit, hi))


# --- Approach C: lineup-context math ---

def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(x, hi))


def slot_factor(pos: int, prop: str) -> float:
    """Generic per-position multiplier. prop in {'RUNS','RBI'}."""
    p = max(1, min(int(pos), 9))
    table = SLOT_RUNS if prop == "RUNS" else SLOT_RBI
    return table[p]


def slg_per_pa(s1b: float, s2b: float, s3b: float, hr: float, pa: float) -> float:
    """Total bases per plate appearance (power proxy). 0 when pa <= 0."""
    if pa <= 0:
        return 0.0
    return (s1b + 2 * s2b + 3 * s3b + 4 * hr) / pa


def trust_weight(lineup_status: str) -> float:
    """Weight on the real-teammate read; lean cautious (slot) unless confirmed."""
    return TRUST_CONFIRMED if lineup_status == "confirmed" else TRUST_PROJECTED


def teammate_factor(neighbor_avg_val, league_avg: float, *, sensitivity: float = TEAMMATE_SENSITIVITY) -> float:
    """Multiplier (centered 1.0) from neighbor quality vs league, scaled by sensitivity."""
    if neighbor_avg_val is None or league_avg <= 0:
        return 1.0
    return 1 + sensitivity * (neighbor_avg_val / league_avg - 1)


def neighbor_avg(values_in_order: list, idx: int, *, behind: bool, n: int = N_NEIGHBORS):
    """Average of the up-to-n nearest neighbors in a circular batting order.

    behind=True  -> hitters batting AFTER idx (drive the runner in -> Runs).
    behind=False -> hitters batting BEFORE idx (on base ahead -> RBI).
    Returns None when there are no neighbors.
    """
    length = len(values_in_order)
    picks = []
    step = 1
    while len(picks) < n and step < length:
        j = (idx + step) % length if behind else (idx - step) % length
        if j != idx:
            picks.append(values_in_order[j])
        step += 1
    if not picks:
        return None
    return sum(picks) / len(picks)


def lineup_mult(slot: float, teammate: float, lineup_status: str) -> float:
    """Confidence-weighted blend of slot baseline and teammate read, capped +/-15%."""
    w = trust_weight(lineup_status)
    blended = (1 - w) * slot + w * teammate
    return _clamp(blended, LINEUP_CAP_LO, LINEUP_CAP_HI)


def hrr_lineup_mult(runs_mult: float, rbi_mult: float) -> float:
    """Dampened (0.55 share) lineup effect for HRR, since its hits portion is lineup-neutral."""
    avg = (runs_mult + rbi_mult) / 2
    damped = 1 + HRR_LINEUP_SHARE * (avg - 1)
    return _clamp(damped, LINEUP_CAP_LO, LINEUP_CAP_HI)
