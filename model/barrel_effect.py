"""Pure "b effect": one combined, capped, sample-shrunk barrel multiplier per prop.
Multiplies onto the normal prob in the existing factor chain. All constants are
grader-tunable SEEDS. ZoneFit is a hitter-side matchup factor (hitter damage-by-zone
× this pitcher's location); SwStr is inverted (low whiff = good)."""
from model.pitch_metrics import zone_fit

# league anchors reused across recipes: (lo, hi) — midpoints = 2024 league averages
_A = {
    "pulled_barrel_rate": (0.01, 0.06),          # mid ~0.035
    "barrel_rate": (0.02, 0.14),                 # mid ~0.08
    "hardhit_rate": (0.28, 0.52),                # mid ~0.40
    "sweetspot_rate": (0.26, 0.42),              # mid ~0.34
    "fb_rate": (0.18, 0.45),                     # mid ~0.315 (unchanged; low weight)
    "xwobacon": (0.28, 0.46),                    # mid ~0.37
    "zonefit": (0.25, 0.49),                     # mid ~0.37
    "swstr": (0.06, 0.16),                       # mid ~0.11 (unchanged; already centered)
    "pulled_barrel_rate_allowed": (0.01, 0.05),  # mid ~0.03
    "barrel_rate_allowed": (0.04, 0.12),         # mid ~0.08 (unchanged)
    "hardhit_rate_allowed": (0.28, 0.52),        # mid ~0.40
    "fb_rate_allowed": (0.18, 0.45),             # mid ~0.315 (unchanged)
    "hit_allowed_rate": (0.20, 0.28),            # mid ~0.24 (unchanged)
}
_INVERT = {"swstr"}       # lower is better -> flip the deviation sign
_MATCHUP = {"zonefit"}    # value computed from hitter x pitcher, not a plain field

def _h(pairs):  # build a hitter/pitcher spec dict: {key: ((lo,hi), weight)}
    return {k: (_A[k], w) for k, w in pairs}

# ---- per-prop recipes (hitter side sums 1.0, pitcher side sums 1.0) ----
_RECIPES = {
    "hr": {"cap": 0.20,
        "hitter": _h([("pulled_barrel_rate",0.25),("barrel_rate",0.25),("hardhit_rate",0.12),
                      ("sweetspot_rate",0.08),("fb_rate",0.05),("xwobacon",0.10),
                      ("zonefit",0.10),("swstr",0.05)]),
        "pitcher": _h([("pulled_barrel_rate_allowed",0.35),("barrel_rate_allowed",0.35),
                       ("hardhit_rate_allowed",0.20),("fb_rate_allowed",0.10)])},
    "tb": {"cap": 0.20,
        "hitter": _h([("barrel_rate",0.20),("pulled_barrel_rate",0.15),("hardhit_rate",0.15),
                      ("xwobacon",0.12),("sweetspot_rate",0.10),("fb_rate",0.08),
                      ("zonefit",0.12),("swstr",0.08)]),
        "pitcher": _h([("barrel_rate_allowed",0.40),("hardhit_rate_allowed",0.30),
                       ("hit_allowed_rate",0.30)])},
    "hits": {"cap": 0.15,
        "hitter": _h([("zonefit",0.22),("swstr",0.20),("hardhit_rate",0.18),
                      ("sweetspot_rate",0.15),("xwobacon",0.15),("barrel_rate",0.10)]),
        "pitcher": _h([("hit_allowed_rate",0.50),("hardhit_rate_allowed",0.30),
                       ("barrel_rate_allowed",0.20)])},
    "runs": {"cap": 0.15,
        "hitter": _h([("zonefit",0.20),("swstr",0.18),("xwobacon",0.15),("hardhit_rate",0.15),
                      ("barrel_rate",0.12),("sweetspot_rate",0.10),("fb_rate",0.10)]),
        "pitcher": _h([("hit_allowed_rate",0.50),("hardhit_rate_allowed",0.30),
                       ("barrel_rate_allowed",0.20)])},
    "rbi": {"cap": 0.20,
        "hitter": _h([("hardhit_rate",0.20),("barrel_rate",0.18),("xwobacon",0.15),
                      ("pulled_barrel_rate",0.10),("zonefit",0.15),("swstr",0.12),
                      ("sweetspot_rate",0.10)]),
        "pitcher": _h([("barrel_rate_allowed",0.40),("hardhit_rate_allowed",0.30),
                       ("hit_allowed_rate",0.30)])},
    "hrr": {"cap": 0.15,
        "hitter": _h([("barrel_rate",0.18),("hardhit_rate",0.15),("xwobacon",0.12),
                      ("pulled_barrel_rate",0.10),("zonefit",0.15),("swstr",0.12),
                      ("sweetspot_rate",0.08),("fb_rate",0.10)]),
        "pitcher": _h([("barrel_rate_allowed",0.35),("hardhit_rate_allowed",0.30),
                       ("hit_allowed_rate",0.35)])},
}
_W_HITTER, _W_PITCHER = 0.60, 0.40
_N_STABLE = 40.0


def _dev(value, lo, hi) -> float:
    """Signed deviation vs league: lo -> -1, midpoint -> 0, hi -> +1 (clamped)."""
    if value is None:
        return 0.0
    t = (value - lo) / (hi - lo)
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return 2.0 * t - 1.0


def _hitter_index(hitter: dict, pitcher: dict | None, spec: dict) -> float:
    total = 0.0
    for key, ((lo, hi), w) in spec.items():
        if key in _MATCHUP:
            zd = hitter.get("zone_dmg")
            zf = pitcher.get("zone_freq") if pitcher else None
            val = zone_fit(zd, zf) if (zd and zf) else None   # neutral when either side lacks zone data
        else:
            val = hitter.get(key)
        dev = _dev(val, lo, hi)
        if key in _INVERT:
            dev = -dev
        total += w * dev
    return total


def _pitcher_index(pitcher: dict, spec: dict) -> float:
    return sum(w * _dev(pitcher.get(k), lo, hi) for k, ((lo, hi), w) in spec.items())


def barrel_effect_mult(hitter: dict, pitcher: dict | None, *, prop: str = "hr",
                       n_stable: float = _N_STABLE) -> float:
    """Combined barrel nudge in [1-cap, 1+cap] for `prop`. Hitter recipe vs pitcher
    recipe, shrunk by the hitter's batted-ball sample (`bbe`). Neutral (1.0) with no data."""
    recipe = _RECIPES[prop]
    d_h = _hitter_index(hitter, pitcher, recipe["hitter"])
    d_p = _pitcher_index(pitcher, recipe["pitcher"]) if pitcher else 0.0
    d = _W_HITTER * d_h + _W_PITCHER * d_p
    bbe = hitter.get("bbe") or 0
    trust = min(bbe / n_stable, 1.0) if n_stable else 1.0
    d *= trust
    d = -1.0 if d < -1.0 else 1.0 if d > 1.0 else d
    return 1.0 + d * recipe["cap"]
