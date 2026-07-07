"""Pure "b effect": one combined, capped, sample-shrunk barrel multiplier for HR,
from the HR recipe's barrel factors (barrels lead). Multiplies onto the normal HR
prob in the existing factor chain. All constants are grader-tunable SEEDS. Other
props reuse this machinery with their recipes later."""

# each stat: ((lo, hi) league anchors, weight). weights per side sum to 1.0.
_HR_HITTER = {
    "pulled_barrel_rate": ((0.01, 0.12), 0.30),
    "barrel_rate":        ((0.03, 0.20), 0.30),
    "hardhit_rate":       ((0.25, 0.55), 0.15),
    "sweetspot_rate":     ((0.25, 0.45), 0.10),
    "fb_rate":            ((0.18, 0.45), 0.05),
    "xwobacon":           ((0.26, 0.46), 0.10),
}
_HR_PITCHER = {
    "pulled_barrel_rate_allowed": ((0.03, 0.08), 0.35),
    "barrel_rate_allowed":        ((0.04, 0.12), 0.35),
    "hardhit_rate_allowed":       ((0.35, 0.52), 0.20),
    "fb_rate_allowed":            ((0.18, 0.45), 0.10),
}
_W_HITTER, _W_PITCHER = 0.60, 0.40
_CAP = 0.20
_N_STABLE = 40.0


def _dev(value, lo, hi) -> float:
    """Signed deviation vs league: lo -> -1, midpoint -> 0, hi -> +1 (clamped)."""
    if value is None:
        return 0.0
    t = (value - lo) / (hi - lo)
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return 2.0 * t - 1.0


def _index(profile: dict, spec: dict) -> float:
    return sum(w * _dev(profile.get(k), lo, hi) for k, ((lo, hi), w) in spec.items())


def barrel_effect_mult(hitter: dict, pitcher: dict | None, *, cap: float = _CAP,
                       n_stable: float = _N_STABLE) -> float:
    """Combined HR barrel nudge in [1-cap, 1+cap]. Hitter barrels vs pitcher
    barrels-allowed, shrunk by the hitter's batted-ball sample (`bbe`). Neutral
    (1.0) with no data."""
    d_h = _index(hitter, _HR_HITTER)                       # [-1, 1]
    d_p = _index(pitcher, _HR_PITCHER) if pitcher else 0.0  # [-1, 1]
    d = _W_HITTER * d_h + _W_PITCHER * d_p                 # [-1, 1]
    bbe = hitter.get("bbe") or 0
    trust = min(bbe / n_stable, 1.0) if n_stable else 1.0
    d *= trust
    d = -1.0 if d < -1.0 else 1.0 if d > 1.0 else d
    return 1.0 + d * cap
