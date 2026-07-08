"""Oracle — our own premium "standout barrel play" flag qualifier.
Gate (real barrel bat + enough sample) + stacked matchup edges (platoon + pitcher
barrel-vulnerability heavy, recent form light), premium bar. Pure; no I/O.
All constants are grader-tunable SEEDS. Barrel Lab's Barrel-Signal tier is the
reference, not a copy."""
from model.barrel_effect import _dev, _A

# --- gate: hitter's OWN barrel quality (hitter-only; NOT pitcher/platoon -> no double-count) ---
_QUALITY = {  # weights sum 1.0
    "barrel_rate": 0.35, "pulled_barrel_rate": 0.25, "hardhit_rate": 0.20,
    "xwobacon": 0.12, "sweetspot_rate": 0.08,
}
_GATE_MIN = 0.60     # quality (0..1, league-avg 0.5) to be a real barrel bat; SEED
_MIN_BBE = 40.0      # sample trust-gate; SEED

# --- edges (once gated), each normalized to 0..1 ---
_W_PLATOON, _W_MATCHUP, _W_FORM = 0.45, 0.40, 0.15   # sum 1.0
_PLATOON_LO, _PLATOON_HI = 0.97, 1.06   # hr_platoon_mult favorable range; SEED
_MATCHUP_LO, _MATCHUP_HI = 1.00, 1.20   # barrel_mult positive tilt (HR cap); SEED
_FORM_LO, _FORM_HI = 1.00, 1.20         # recent_form_mult hot range; SEED

_FLAG_BAR = 0.62     # premium: blended score to flag (rare); SEED


def _clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def _norm(value, lo, hi) -> float:
    return _clamp01(((value if value is not None else lo) - lo) / (hi - lo))


def _quality(hitter: dict) -> float:
    """Hitter's own barrel quality, 0..1 (league-average ~0.5, elite ~1.0)."""
    d = sum(w * _dev(hitter.get(k), *_A[k]) for k, w in _QUALITY.items())   # -1..1
    return (d + 1.0) / 2.0


def oracle(hitter: dict, *, barrel_mult: float, platoon_mult: float) -> dict:
    """Oracle qualifier. Returns {"oracle": bool, "oracle_score": float}."""
    q = _quality(hitter)
    bbe = hitter.get("bbe") or 0
    gate = q >= _GATE_MIN and bbe >= _MIN_BBE

    platoon_edge = _norm(platoon_mult, _PLATOON_LO, _PLATOON_HI)
    matchup_edge = _norm(barrel_mult, _MATCHUP_LO, _MATCHUP_HI)
    form_edge = _norm(hitter.get("recent_form_mult", 1.0), _FORM_LO, _FORM_HI)
    edges = _W_PLATOON * platoon_edge + _W_MATCHUP * matchup_edge + _W_FORM * form_edge

    score = 0.5 * q + 0.5 * edges
    return {"oracle": bool(gate and score >= _FLAG_BAR), "oracle_score": round(score, 3)}
