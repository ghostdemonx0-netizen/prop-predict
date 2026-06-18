"""Pure Marcel-style multi-season blend math (history-weighted mode).

Combines a player's real per-season totals with recency weights, normalized
to a single-season-equivalent so the model's existing regression constants
apply unchanged. See docs/superpowers/specs/2026-06-17-history-weighted-projections-design.md.
"""

WEIGHTS = (5, 4, 3)  # (current season, last year, two years ago), positional


def marcel_blend(per_season: list[tuple[float, float]], weights: tuple = WEIGHTS) -> tuple[float, float]:
    """Weighted blend of (made, pa) across seasons, normalized by the top weight.

    per_season is positional and aligned to ``weights`` (index 0 = current
    season). Missing seasons pass (0, 0). Returns (effective_made,
    effective_pa) on a single-season-equivalent scale; (0.0, 0.0) if no PAs.
    """
    w_made = sum(w * made for w, (made, _) in zip(weights, per_season))
    w_pa = sum(w * pa for w, (_, pa) in zip(weights, per_season))
    if w_pa <= 0:
        return (0.0, 0.0)
    top = weights[0]
    return (w_made / top, w_pa / top)


def regress(made: float, pa: float, league_rate: float, r: float) -> float:
    """Rate regressed toward league average with ``r`` phantom league PAs."""
    denom = pa + r
    if denom <= 0:
        return league_rate
    return (made + league_rate * r) / denom
