"""Pure spray math: classify batted-ball direction and blend a batter's
pull/center/oppo tendency from 3 scouts + a handedness prior. No I/O."""
import math

_PLATE_X, _PLATE_Y = 125.42, 198.27   # Statcast home-plate coords
_CENTER_HALF = 15.0                    # +/- degrees counted as "center"

# scout relevance and confidence half-trust (K)
REL = {"overall": 1.0, "air": 1.5, "hr": 2.0}
KCONF = {"overall": 120.0, "air": 100.0, "hr": 15.0}
DIAL_K = 150.0
CAP = 0.70
# league-average spray per side (seed; recompute from data). pull/center/oppo.
HAND_DEFAULT = {
    "R": {"pull": 0.50, "center": 0.30, "oppo": 0.20},
    "L": {"pull": 0.50, "center": 0.30, "oppo": 0.20},
}


def spray_angle(hc_x: float, hc_y: float) -> float:
    """Degrees off center field. 0 = CF, negative = toward LF, positive = toward RF."""
    return math.degrees(math.atan2(hc_x - _PLATE_X, _PLATE_Y - hc_y))


def field_of(angle: float, bats: str) -> str:
    """Classify a spray angle into pull/center/oppo for this batter's side."""
    if -_CENTER_HALF <= angle <= _CENTER_HALF:
        return "center"
    left = angle < 0   # toward LF
    if bats == "R":
        return "pull" if left else "oppo"   # RHB pulls to LF
    return "oppo" if left else "pull"        # LHB pulls to RF


def _confidence(n, k):
    return n / (n + k) if n > 0 else 0.0


def combine_scouts(scouts: dict):
    """Relevance x confidence weighted vote across the 3 scouts -> one distribution.
    Returns None if there is no data at all."""
    fields = ("pull", "center", "oppo")
    acc = {f: 0.0 for f in fields}
    wsum = 0.0
    for key in ("overall", "air", "hr"):
        s = scouts.get(key) or {}
        n = s.get("n", 0)
        if n <= 0:
            continue
        vote = REL[key] * _confidence(n, KCONF[key])
        if vote <= 0:
            continue
        wsum += vote
        for f in fields:
            acc[f] += vote * s.get(f, 0.0)
    if wsum <= 0:
        return None
    return {f: acc[f] / wsum for f in fields}


def final_distribution(scouts: dict, bats: str) -> dict:
    """Blend his combined spray with the handedness default via the sample dial (cap)."""
    side = "L" if bats == "L" else "R"
    default = HAND_DEFAULT[side]
    his = combine_scouts(scouts)
    n_total = (scouts.get("overall") or {}).get("n", 0)
    if his is None or n_total <= 0:
        return dict(default)
    w = min(CAP, n_total / (n_total + DIAL_K))
    blended = {f: (1 - w) * default[f] + w * his[f] for f in ("pull", "center", "oppo")}
    tot = sum(blended.values()) or 1.0
    return {f: blended[f] / tot for f in blended}
