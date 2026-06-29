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
# league-average spray per side, MEASURED via compute_league_default over a league-wide
# Statcast pull (2026-05-28..06-25, 484 batters). Refresh yearly. pull/center/oppo.
HAND_DEFAULT = {
    "R": {"pull": 0.456, "center": 0.289, "oppo": 0.255},
    "L": {"pull": 0.482, "center": 0.264, "oppo": 0.254},
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
        share_total = s.get("pull", 0) + s.get("center", 0) + s.get("oppo", 0)
        if n <= 0 or share_total <= 0:
            continue
        vote = REL[key] * _confidence(n, KCONF[key])
        if vote <= 0:
            continue
        wsum += vote
        for f in fields:
            acc[f] += vote * (s.get(f, 0.0) / share_total)   # normalize counts -> shares
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


def pool_spray(sides_list) -> dict:
    """Merge a list of per-season {"R":scoutset,"L":scoutset} by SUMMING counts.

    Spray is a stable trait, so pooling 3 seasons gives established hitters a big
    sample (overall.n ~ 1,200+) -> they reach the dial cap from day one.
    """
    out = {side: {k: {"pull": 0, "center": 0, "oppo": 0, "n": 0} for k in ("overall", "air", "hr")}
           for side in ("R", "L")}
    for sides in sides_list:
        if not sides:
            continue
        for side in ("R", "L"):
            sc = sides.get(side)
            if not sc:
                continue
            for bucket in ("overall", "air", "hr"):
                src = sc.get(bucket) or {}
                for f in ("pull", "center", "oppo", "n"):
                    out[side][bucket][f] += src.get(f, 0)
    return out


def compute_league_default(spray_results, min_n: int = 200) -> dict:
    """League-average handedness default per side, from many batters' batter_spray() outputs.

    Averages each qualified hitter's *combined-scout* distribution (same measure
    `final_distribution` blends toward), so the result is on the right scale to paste
    into HAND_DEFAULT. `spray_results` = iterable of {"R": scoutset, "L": scoutset}.
    Sides with no qualifying hitters fall back to the current HAND_DEFAULT.
    """
    acc = {"R": {"pull": 0.0, "center": 0.0, "oppo": 0.0, "count": 0},
           "L": {"pull": 0.0, "center": 0.0, "oppo": 0.0, "count": 0}}
    for res in spray_results:
        if not res:
            continue
        for side in ("R", "L"):
            sc = res.get(side)
            if not sc or (sc.get("overall") or {}).get("n", 0) < min_n:
                continue
            dist = combine_scouts(sc)
            if dist is None:
                continue
            for f in ("pull", "center", "oppo"):
                acc[side][f] += dist[f]
            acc[side]["count"] += 1
    out = {}
    for side in ("R", "L"):
        c = acc[side]["count"]
        out[side] = ({f: acc[side][f] / c for f in ("pull", "center", "oppo")}
                     if c else dict(HAND_DEFAULT[side]))
    return out
