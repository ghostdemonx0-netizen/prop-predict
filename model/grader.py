"""model/grader.py — score archived predictions against box-score outcomes.

Pure grading (grade_prediction/grade_day) + file I/O (grade_file) + CLI.
Mirrors model/archive.py's shape. Writes ONLY the grades JSONL.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from typing import Any

# prop -> list of (threshold_int, label) for the count-prop family.
_COUNT_PROPS: dict[str, list[tuple[int, str]]] = {
    "hr":          [(1, "1+")],
    "hits":        [(1, "1+"), (2, "2+"), (3, "3+")],
    "total_bases": [(2, "2+"), (3, "3+"), (4, "4+")],
    "runs":        [(1, "1+"), (2, "2+")],
    "rbi":         [(1, "1+"), (2, "2+")],
    "hrr":         [(2, "2+"), (3, "3+"), (4, "4+")],
}


def _count_actual(prop: str, bat: dict) -> int:
    if prop == "hr":
        return int(bat.get("hr", 0))
    if prop == "hits":
        return int(bat.get("h", 0))
    if prop == "total_bases":
        return int(bat.get("tb", 0))
    if prop == "runs":
        return int(bat.get("r", 0))
    if prop == "rbi":
        return int(bat.get("rbi", 0))
    if prop == "hrr":
        return int(bat.get("h", 0)) + int(bat.get("r", 0)) + int(bat.get("rbi", 0))
    raise ValueError(f"not a count prop: {prop}")


def _base(pred: dict, now_iso: str) -> dict:
    return {
        "date":      pred.get("date"),
        "game_id":   pred.get("game_id"),
        "player_id": pred.get("player_id"),
        "player":    pred.get("player"),
        "team":      pred.get("team"),
        "prop":      pred.get("prop"),
        "graded_at": now_iso,
    }


def grade_prediction(pred: dict, outcome: dict | None, *,
                     final_retry: bool, now_iso: str) -> dict | None:
    """Grade one prediction. Returns a grade record, or None (unsettled —
    retry next run). Void cases: game not final (postponed/live/None) when
    final_retry is False → None; when final_retry is True → void/postponed.
    Final game with player absent or missing needed sub-dict → void/DNP.
    Final game with player present → graded (strikeouts or count branch)."""
    prop = pred.get("prop")
    pid = pred.get("player_id")
    rec = _base(pred, now_iso)
    status = (outcome or {}).get("status")

    # No outcome fetched, or game not final yet:
    if outcome is None or status != "final":
        if final_retry:
            rec["status"] = "void"
            rec["void_reason"] = "postponed"
            return rec
        return None  # unsettled — retry next run

    # Final game — locate the player; absence == DNP/scratch == void.
    pstats = (outcome.get("players") or {}).get(pid)
    needed = "pit" if prop == "strikeouts" else "bat"
    if pstats is None or pstats.get(needed) is None:
        rec["status"] = "void"
        rec["void_reason"] = "DNP"
        return rec

    # --- strikeouts: over/under a numeric line (pitcher) ---
    if prop == "strikeouts":
        pit = pstats["pit"]
        line = pred.get("factors", {}).get("line")
        actual_k = int(pit.get("k", 0))
        label = f"over {line:g}" if isinstance(line, float) else f"over {line}"
        rec["status"] = "graded"
        rec["actual"] = actual_k
        if float(line) == int(line) and actual_k == int(line):
            rec["push"] = True
            rec["results"] = {label: None}
        else:
            rec["results"] = {label: actual_k > line}
        return rec

    bat = pstats["bat"]
    actual = _count_actual(prop, bat)
    rec["status"] = "graded"
    rec["actual"] = actual
    rec["results"] = {label: actual >= n for n, label in _COUNT_PROPS[prop]}
    return rec
