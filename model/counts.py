"""Pure per-at-bat -> whole-game count math for threshold props (Hits, Total Bases).

Convolve a per-PA outcome distribution over the batter's expected plate
appearances (fractional supported) to get P(game total >= N). See
docs/superpowers/specs/2026-06-18-tier1-threshold-props-design.md.
"""


def _convolve(a: list[float], b: list[float]) -> list[float]:
    out = [0.0] * (len(a) + len(b) - 1)
    for i, ai in enumerate(a):
        if ai == 0.0:
            continue
        for j, bj in enumerate(b):
            out[i + j] += ai * bj
    return out


def count_distribution(outcome_probs: list[float], expected_pa: float) -> list[float]:
    """Distribution over the game total (index = total units) from `expected_pa`
    independent PAs, each drawn from `outcome_probs` (index = units that PA).

    Fractional PAs: floor(expected_pa) guaranteed PAs plus one PA that occurs
    with probability frac (else contributes 0 units).
    """
    if expected_pa <= 0:
        return [1.0]
    full = int(expected_pa)
    frac = expected_pa - full
    dist = [1.0]  # start: total 0 with certainty
    for _ in range(full):
        dist = _convolve(dist, outcome_probs)
    if frac > 0:
        # a PA that happens w.p. frac: blend "no PA" ([1.0]) with the outcome vector
        partial = [(1 - frac) + frac * outcome_probs[0]] + [frac * p for p in outcome_probs[1:]]
        dist = _convolve(dist, partial)
    return dist


def count_ge_prob(outcome_probs: list[float], expected_pa: float, n: int) -> float:
    """P(game total >= n)."""
    if n <= 0:
        return 1.0
    dist = count_distribution(outcome_probs, expected_pa)
    return sum(dist[n:]) if n < len(dist) else 0.0
