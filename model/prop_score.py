"""Pure b-weight "Prop Score": a 0-100 HR-focused board headline.

score = (hitter barrel quality) x (tonight's pitcher's barrels-ALLOWED),
nudged by a platoon "Split" booster. Barrel dominates by design — pulled-barrel
and barrel-rate carry the most weight on both sides. Every anchor/weight below is
a SEED (grader-tuned later). No I/O; returns a ranking number only — it produces
no probability and changes no existing prop math.
"""

# Per-stat league anchors (lo, hi) as FRACTIONS (0-1, matching Phase-0 output).
# A stat is linearly scaled: (value-lo)/(hi-lo), clamped to [0,1].
_HITTER_ANCHORS = {
    "pulled_barrel_rate": (0.01, 0.12),
    "barrel_rate":        (0.03, 0.20),
    "hardhit_rate":       (0.25, 0.55),
    "sweetspot_rate":     (0.25, 0.45),
    "fb_rate":            (0.18, 0.45),
    "xwobacon":           (0.26, 0.46),
}
# Weights sum to 1.0. Pulled-barrel + barrel-rate = 0.60 (the "barrels lead" seed).
_HITTER_WEIGHTS = {
    "pulled_barrel_rate": 0.30,
    "barrel_rate":        0.30,
    "hardhit_rate":       0.15,
    "sweetspot_rate":     0.10,
    "fb_rate":            0.05,
    "xwobacon":           0.10,
}
_PITCHER_ANCHORS = {
    "pulled_barrel_rate_allowed": (0.03, 0.08),
    "barrel_rate_allowed":        (0.04, 0.12),
    "hardhit_rate_allowed":       (0.35, 0.52),
    "fb_rate_allowed":            (0.18, 0.45),
}
# Weights sum to 1.0. Pulled-barrel + barrel-allowed = 0.70 (barrels lead).
_PITCHER_WEIGHTS = {
    "pulled_barrel_rate_allowed": 0.35,
    "barrel_rate_allowed":        0.35,
    "hardhit_rate_allowed":       0.20,
    "fb_rate_allowed":            0.10,
}

_W_HITTER, _W_PITCHER = 0.60, 0.40      # matchup balance seed (hitter leads)
_SPLIT_LO, _SPLIT_HI = 0.94, 1.06        # Split booster clamp on the platoon mult


def _clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


def _scaled(value, lo: float, hi: float) -> float:
    """Linear-scale a stat to [0,1] against its league anchors; None -> 0."""
    if value is None:
        return 0.0
    return _clamp01((value - lo) / (hi - lo))


def _index(profile: dict, anchors: dict, weights: dict) -> float:
    """Weighted 0-1 quality index over a profile's stats (weights sum to 1)."""
    return sum(weights[k] * _scaled(profile.get(k), lo, hi)
               for k, (lo, hi) in anchors.items())


def prop_score(hitter: dict, pitcher: dict, *, platoon_mult: float = 1.0) -> float:
    """0-100 b-weight Prop Score for a hitter vs tonight's opposing starter.

    hitter: a batter profile carrying the Phase-0 barrel fields.
    pitcher: the opposing starter profile carrying the Phase-0 `*_allowed` fields.
    platoon_mult: the batter's platoon edge vs this pitcher (e.g. the model's
        hr_platoon_mult ~1.06 / 0.95); dampened+clamped into the Split booster.
    Missing fields count as 0 (degrade to a low score, never crash).
    """
    h = _index(hitter, _HITTER_ANCHORS, _HITTER_WEIGHTS)      # 0..1
    p = _index(pitcher, _PITCHER_ANCHORS, _PITCHER_WEIGHTS)   # 0..1
    matchup = _W_HITTER * h + _W_PITCHER * p                  # 0..1
    split = _SPLIT_LO if platoon_mult < _SPLIT_LO else _SPLIT_HI if platoon_mult > _SPLIT_HI else platoon_mult
    return round(_clamp01(matchup * split) * 100.0, 1)
