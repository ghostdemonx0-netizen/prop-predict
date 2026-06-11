"""Pure batter-vs-pitcher matchup math (v1).

Combines a batter's and a pitcher's own rates via the log5 (odds-ratio)
method against league average, then applies a handedness platoon
adjustment. Deliberately does NOT use raw head-to-head history, which is
tiny-sample noise; this is a model-derived matchup read.
"""

LEAGUE_K = 0.225   # strikeouts per plate appearance
LEAGUE_HIT = 0.22  # hits per plate appearance


def log5(rate_a: float, rate_b: float, league: float) -> float:
    """Combine two rates relative to league average (Bill James log5)."""
    num = (rate_a * rate_b) / league
    den = num + ((1 - rate_a) * (1 - rate_b)) / (1 - league)
    return num / den if den else 0.0


def batter_advantage(bats: str, throws: str) -> bool:
    """True if the batter has the platoon edge (opposite hands, or switch)."""
    side = (bats or "R").upper()[:1]
    hand = (throws or "R").upper()[:1]
    if side == "S":
        return True  # a switch hitter bats opposite the pitcher
    return side != hand


def strikeout_prob(batter_k: float, pitcher_k: float, *, bats: str = "R", throws: str = "R") -> float:
    """Probability this batter strikes out vs this pitcher."""
    base = log5(batter_k, pitcher_k, LEAGUE_K)
    mult = 0.92 if batter_advantage(bats, throws) else 1.10
    return max(0.0, min(base * mult, 0.7))


def hit_prob(batter_hit: float, pitcher_hit_allowed: float, *, bats: str = "R", throws: str = "R") -> float:
    """Probability this batter gets a hit vs this pitcher."""
    base = log5(batter_hit, pitcher_hit_allowed, LEAGUE_HIT)
    mult = 1.08 if batter_advantage(bats, throws) else 0.93
    return max(0.0, min(base * mult, 0.6))


def classify_lean(k_prob: float, hit_prob_: float) -> dict:
    """Pick the meaningful lean: K (strikeout), H (hit), or NEU (no edge)."""
    k_edge = k_prob - LEAGUE_K
    h_edge = hit_prob_ - LEAGUE_HIT
    if k_edge > 0.03 and k_edge >= h_edge:
        return {"lean": "K", "prob": k_prob}
    if h_edge > 0.03:
        return {"lean": "H", "prob": hit_prob_}
    return {"lean": "NEU", "prob": max(k_prob, hit_prob_)}


def matchup(*, b_k: float, b_hit: float, p_k: float, p_hit: float, bats: str, throws: str) -> dict:
    """Full matchup read: {k_prob, hit_prob, lean, prob}."""
    kp = strikeout_prob(b_k, p_k, bats=bats, throws=throws)
    hp = hit_prob(b_hit, p_hit, bats=bats, throws=throws)
    return {"k_prob": kp, "hit_prob": hp, **classify_lean(kp, hp)}
