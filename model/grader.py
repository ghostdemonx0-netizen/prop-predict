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
    """Grade one prediction. Returns a grade record, or None to mean
    'unsettled — retry next run'. (Void/strikeouts added in Tasks 3-4.)"""
    prop = pred.get("prop")
    pid = pred.get("player_id")
    players = (outcome or {}).get("players", {})
    pstats = players.get(pid)
    bat = (pstats or {}).get("bat")
    rec = _base(pred, now_iso)
    actual = _count_actual(prop, bat)
    rec["status"] = "graded"
    rec["actual"] = actual
    rec["results"] = {label: actual >= n for n, label in _COUNT_PROPS[prop]}
    return rec
