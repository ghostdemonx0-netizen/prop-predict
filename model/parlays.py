"""Build site-data parlays — pure probability math, no AI, no buzz.

Legs come from the board's own model probabilities; a parlay's combined % is just
the product of its legs. Parlays use DIFFERENT games only (one leg per game), so the
naive multiply stays honest (no same-game correlation). Slate-adaptive: a leg count
that the slate can't fill (not enough distinct games) is skipped (returns []).
"""
from __future__ import annotations

from itertools import combinations

from model.plays import _not_started, _now_utc

# Per-board parlay recipe (chosen 2026-06-19). leg_count -> how many parlays.
HR_LONGSHOTS = (4, 5, 6)            # 3 each
MONEYLINE_LEGS = (5, 6, 8, 9, 10, 11, 12, 13, 14, 15)  # 3 each, slate-adaptive


def _leg(play: dict) -> dict | None:
    """Normalize a board play into a parlay leg: {label, prob, game_id, matchup}."""
    prop = play.get("prop")
    game = play.get("game_id")
    if prop == "HR":
        prob, label = play.get("probability"), f"{play.get('player')} HR"
    elif prop == "HITS":
        prob, label = play.get("p_ge1"), f"{play.get('player')} 1+ hit"
    elif prop == "K":
        prob, label = play.get("over_prob"), f"{play.get('player')} O{play.get('line')} K"
    else:
        return None
    if not isinstance(prob, (int, float)) or game is None:
        return None
    return {"label": label, "prob": prob, "game_id": game, "matchup": play.get("matchup")}


def _best_per_game(plays: list[dict]) -> list[dict]:
    """One leg per game (the highest-prob play), sorted by prob desc — the
    different-game candidate pool a parlay draws from."""
    by_game: dict = {}
    for pl in plays:
        leg = _leg(pl)
        if leg is None:
            continue
        g = leg["game_id"]
        if g not in by_game or leg["prob"] > by_game[g]["prob"]:
            by_game[g] = leg
    return sorted(by_game.values(), key=lambda l: l["prob"], reverse=True)


def _combined(legs: list[dict]) -> float:
    prob = 1.0
    for leg in legs:
        prob *= leg["prob"]
    return prob


def build_parlay_set(pool: list[dict], leg_count: int, num: int) -> list[dict]:
    """Top `num` distinct parlays of `leg_count` legs from `pool` (already one-per-game),
    ranked by combined probability. Returns [] if the slate can't fill `leg_count`."""
    if len(pool) < leg_count:
        return []
    cand = pool[: leg_count + num]  # best parlays live among the top legs
    scored = [{"legs": list(c), "prob": _combined(c)} for c in combinations(cand, leg_count)]
    scored.sort(key=lambda x: x["prob"], reverse=True)
    return scored[:num]


def build_all_parlays(board: dict, now_iso: str | None = None) -> dict:
    """Full per-board parlay recipe from a board dict (not-yet-started games only)."""
    now = _now_utc(now_iso)
    hr = [p for p in board.get("hr", []) if _not_started(p, now)]
    hits = [p for p in board.get("hits", []) if _not_started(p, now)]
    ks = [p for p in board.get("strikeouts", []) if _not_started(p, now)]

    hr_pool = _best_per_game(hr)
    hits_pool = _best_per_game(hits)
    k_pool = _best_per_game(ks)
    all_pool = _best_per_game(hr + hits + ks)  # mixed-prop, best leg per game

    return {
        "hr": {
            "3leg": build_parlay_set(hr_pool, 3, 5),
            "2leg": build_parlay_set(hr_pool, 2, 7),
            "longshots": {n: build_parlay_set(hr_pool, n, 3) for n in HR_LONGSHOTS},
        },
        "hits": {
            "7leg": build_parlay_set(hits_pool, 7, 5),
            "6leg": build_parlay_set(hits_pool, 6, 5),
        },
        "ks": {
            "7leg": build_parlay_set(k_pool, 7, 5),
            "6leg": build_parlay_set(k_pool, 6, 5),
        },
        "moneyline": {n: build_parlay_set(all_pool, n, 3) for n in MONEYLINE_LEGS},
    }
