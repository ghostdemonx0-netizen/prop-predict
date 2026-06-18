"""Pick the day's curated plays from a prop-predict board (latest.json).

Pure selection logic — no network, no file writes. `select_plays` takes a loaded
board dict and returns the chosen HR, K, and Hits plays plus the single 'lock'.

Headline metric per prop: HR -> `probability` (P>=1 HR); K -> `over_prob`
(P over the K line); Hits -> `p_ge1` (P>=1 hit).
"""
from __future__ import annotations

from datetime import datetime, timezone


def _now_utc(now_iso: str | None) -> datetime:
    if now_iso:
        return datetime.fromisoformat(now_iso.replace("Z", "+00:00"))
    return datetime.now(timezone.utc)


def _not_started(play: dict, now: datetime) -> bool:
    """True if the game hasn't started (missing/unparseable time -> keep, don't drop)."""
    gt = play.get("game_time")
    if not gt:
        return True
    try:
        return datetime.fromisoformat(gt.replace("Z", "+00:00")) > now
    except ValueError:
        return True


def _rank(candidates: list[dict], metric: str, status_field: str, count: int) -> list[dict]:
    """Top `count` by `metric`, confirmed-status plays first then best non-confirmed."""
    ranked = sorted(candidates, key=lambda p: p.get(metric, 0.0), reverse=True)
    confirmed = [p for p in ranked if p.get(status_field) == "confirmed"]
    others = [p for p in ranked if p.get(status_field) != "confirmed"]
    return (confirmed + others)[:count]


# (list-of-plays, headline-metric) pairs the lock considers — highest cashes.
def _pick_lock(*pools: tuple[list[dict], str]) -> dict | None:
    """The single play most likely to cash (highest headline probability across pools)."""
    best, best_p = None, -1.0
    for plays, metric in pools:
        for p in plays:
            if p.get(metric, 0.0) > best_p:
                best, best_p = p, p[metric]
    return best


def select_plays(board: dict, *, hr_count: int = 5, k_count: int = 5, hits_count: int = 5,
                 now_iso: str | None = None) -> dict:
    """Return {date, updated, hr, strikeouts, hits, lock} chosen from a board dict."""
    now = _now_utc(now_iso)
    hr_all = [p for p in board.get("hr", []) if _not_started(p, now)]
    k_all = [p for p in board.get("strikeouts", []) if _not_started(p, now)]
    hits_all = [p for p in board.get("hits", []) if _not_started(p, now)]

    hr_sel = _rank(hr_all, "probability", "lineup_status", hr_count)
    k_sel = _rank(k_all, "over_prob", "pitcher_status", k_count)
    hits_sel = _rank(hits_all, "p_ge1", "lineup_status", hits_count)

    lock = _pick_lock((hr_sel, "probability"), (k_sel, "over_prob"), (hits_sel, "p_ge1"))
    return {
        "date": board.get("date"),
        "updated": board.get("updated"),
        "hr": hr_sel,
        "strikeouts": k_sel,
        "hits": hits_sel,
        "lock": lock,
    }
