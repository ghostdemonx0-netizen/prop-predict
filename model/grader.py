"""model/grader.py — score archived predictions against box-score outcomes.

Pure grading (grade_prediction/grade_day) + file I/O (grade_file) + CLI.
Mirrors model/archive.py's shape. Writes ONLY the grades JSONL.
"""
from __future__ import annotations

import json
import sys
from datetime import date as _date
from datetime import datetime, timezone
from typing import Any

from model import fetch as _fetch

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


def grade_day(predictions, outcomes_by_game, *, final_retry, now_iso):
    """Grade every prediction for a date. `outcomes_by_game` maps game_id ->
    GameOutcome (missing game_id -> None outcome -> unsettled). Returns the list
    of grade records; unsettled predictions (None) are dropped."""
    out: list[dict] = []
    for pred in predictions:
        outcome = outcomes_by_game.get(pred.get("game_id"))
        g = grade_prediction(pred, outcome, final_retry=final_retry, now_iso=now_iso)
        if g is not None:
            out.append(g)
    return out


def _read_jsonl(path: str) -> list[dict]:
    out: list[dict] = []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for raw in fh:
                line = raw.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    print(f"[grader] skipping corrupt line: {line[:120]!r}", file=sys.stderr)
    except FileNotFoundError:
        return []
    return out


def grade_file(predictions_path, grades_path, slate_date, now_iso, *,
               fetch_fn=None, window_days: int = 3) -> int:
    """Grade one date: read predictions JSONL, fetch each distinct game's outcome,
    grade, OVERWRITE grades JSONL. Returns count written. final_retry is computed
    from (now - slate_date) >= window_days-1."""
    fetch_fn = fetch_fn or _fetch.game_boxscore
    preds = _read_jsonl(predictions_path)
    if not preds:
        return 0
    try:
        now_d = datetime.fromisoformat(now_iso.replace("Z", "+00:00")).date()
        slate_d = _date.fromisoformat(slate_date)
        final_retry = (now_d - slate_d).days >= (window_days - 1)
    except (ValueError, AttributeError):
        final_retry = False

    game_ids = {p.get("game_id") for p in preds if p.get("game_id") is not None}
    outcomes = {gid: fetch_fn(gid) for gid in game_ids}

    grades = grade_day(preds, outcomes, final_retry=final_retry, now_iso=now_iso)
    with open(grades_path, "w", encoding="utf-8") as fh:
        for g in grades:
            fh.write(json.dumps(g, separators=(",", ":")) + "\n")
    return len(grades)


if __name__ == "__main__":
    def _main() -> None:
        args = sys.argv[1:]
        if len(args) < 3:
            print("Usage: python -m model.grader <predictions_jsonl> <grades_jsonl> "
                  "<slate_date YYYY-MM-DD> [now_iso]", file=sys.stderr)
            sys.exit(1)
        now = args[3] if len(args) >= 4 else datetime.now(tz=timezone.utc).isoformat()
        print(grade_file(args[0], args[1], args[2], now))
    _main()
