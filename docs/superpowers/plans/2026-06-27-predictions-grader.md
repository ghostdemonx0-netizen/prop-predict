# Predictions Grader (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score every archived prediction against real box-score outcomes, writing a mutable per-date grades file next to the immutable predictions file on the `predictions-archive` branch.

**Architecture:** Mirrors the recorder (`model/archive.py`). A pure grading core (`model/grader.py`) turns `(prediction, outcome)` into a grade with no I/O; a thin box-score fetcher in `model/fetch.py` supplies outcomes + game status; a file-I/O layer + CLI reads predictions JSONL and overwrites grades JSONL; a daily workflow (cron-job.org-triggered) runs it over a 3-day trailing window against the `predictions-archive` branch only.

**Tech Stack:** Python 3.12, `statsapi` (MLB Stats API wrapper, already a dependency), `pytest`, GitHub Actions.

## Global Constraints

- Python 3.12; standard library + existing deps only (no new packages).
- Privacy: the grader reads and writes ONLY `archive/*.jsonl` on the `predictions-archive` branch. It NEVER writes `web/public/data` or any live-site path.
- Grade the OUTCOME once per `(game_id, player_id, prop)` — never one grade per weighting (current/blend/history).
- Grades file is MUTABLE: fully recomputed and overwritten each run (idempotent). Predictions file stays untouched.
- Trailing window = 3 days (today, today−1, today−2). A date's last in-window run (today−2) is its `final_retry`.
- Match key everywhere: `(game_id, player_id, prop)`.
- Prop thresholds (verbatim from the recorder): HR `1+`; Hits `1+,2+,3+`; Total Bases `2+,3+,4+`; Runs `1+,2+`; RBI `1+,2+`; HRR `2+,3+,4+`; Strikeouts `over <line>` (numeric line read from `pred["factors"]["line"]`).
- Follow existing `model/fetch.py` patterns: `statsapi.boxscore_data(game_id)` for player stats, `statsapi.schedule(game_id=...)` for status, wrapped in `_with_retries`, `try/except` returning a safe empty value on failure.

---

## File Structure

- **Create `model/grader.py`** — pure grading core + file I/O + CLI. Single responsibility: grading. No board/recorder logic.
- **Modify `model/fetch.py`** — add `_parse_boxscore(box, status)` (pure, tested) and `game_boxscore(game_id)` (thin network wrapper).
- **Create `tests/test_grader.py`** — grader unit tests (pure functions, temp-file I/O).
- **Create `.github/workflows/grade-predictions.yml`** — daily grading workflow.
- **Create `scripts/.gitkeep`-style note:** none needed; reuse `scripts/pull_archive.sh` to inspect output locally.

## Shared data shapes (used across tasks)

**Prediction record** (input, produced by the recorder — do not change):
```json
{"date":"2026-06-27","game_id":776543,"player_id":12345,"player":"Aaron Judge",
 "team":"NYY","prop":"hits","probs":{"1+":{"current":0.7,"blend":0.66,"history":0.62}},
 "factors":{"line":6.5},"captured_at":"..."}
```

**GameOutcome** (produced by `game_boxscore`, consumed by the grader):
```python
{
  "game_id": 776543,
  "status": "final",   # one of: "final" | "live" | "postponed" | "suspended" | "other"
  "players": {         # keyed by int player_id; a player ABSENT == did not appear (DNP)
     12345: {"bat": {"h":2,"tb":4,"hr":1,"r":1,"rbi":1}, "pit": None},
     67890: {"bat": None, "pit": {"k":7}},
  },
}
```

**Grade record** (output):
```json
{"date":"2026-06-27","game_id":776543,"player_id":12345,"player":"Aaron Judge","team":"NYY",
 "prop":"hits","status":"graded","actual":2,"results":{"1+":true,"2+":true,"3+":false},
 "graded_at":"<iso8601>"}
```
- `status`: `"graded"` | `"void"`. (Unsettled, not-yet-final predictions return `None` and are omitted this run.)
- `void` records add `"void_reason"` and omit `actual`/`results`.
- Strikeouts push: `"push": true` and `results` value `null` for the line label.

---

### Task 1: Box-score fetcher (`_parse_boxscore` + `game_boxscore`)

**Files:**
- Modify: `model/fetch.py` (add at end)
- Test: `tests/test_grader.py` (new file — parse tests live with grader tests)

**Interfaces:**
- Produces: `fetch._parse_boxscore(box: dict, status: str) -> dict` (GameOutcome without `game_id`), and `fetch.game_boxscore(game_id: int) -> dict` (full GameOutcome). Later tasks inject a fake `fetch_fn(game_id)->GameOutcome`; only `_parse_boxscore` is unit-tested.

- [ ] **Step 1: Write the failing test** (parse a representative `boxscore_data` shape)

```python
# tests/test_grader.py
from model import fetch

_SAMPLE_BOX = {
    "home": {
        "battingOrder": [12345],
        "pitchers": [67890],
        "players": {
            "ID12345": {"personId": 12345,
                        "stats": {"batting": {"plateAppearances": 4, "hits": 2,
                                              "totalBases": 4, "homeRuns": 1,
                                              "runs": 1, "rbi": 1},
                                  "pitching": {}}},
            "ID67890": {"personId": 67890,
                        "stats": {"batting": {},
                                  "pitching": {"battersFaced": 25, "strikeOuts": 7}}},
        },
    },
    "away": {"battingOrder": [], "pitchers": [], "players": {}},
}

def test_parse_boxscore_batter_and_pitcher():
    out = fetch._parse_boxscore(_SAMPLE_BOX, "Final")
    assert out["status"] == "final"
    assert out["players"][12345]["bat"] == {"h": 2, "tb": 4, "hr": 1, "r": 1, "rbi": 1}
    assert out["players"][12345]["pit"] is None
    assert out["players"][67890]["pit"] == {"k": 7}
    assert out["players"][67890]["bat"] is None

def test_parse_boxscore_dnp_player_absent():
    # a roster player with zero plate appearances is treated as did-not-bat (no "bat")
    box = {"home": {"players": {"ID999": {"personId": 999,
            "stats": {"batting": {"plateAppearances": 0}, "pitching": {}}}}},
           "away": {"players": {}}}
    out = fetch._parse_boxscore(box, "Final")
    assert out["players"][999]["bat"] is None

def test_parse_boxscore_status_normalization():
    assert fetch._parse_boxscore({"home": {"players": {}}, "away": {"players": {}}}, "Postponed")["status"] == "postponed"
    assert fetch._parse_boxscore({"home": {"players": {}}, "away": {"players": {}}}, "In Progress")["status"] == "live"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_grader.py -k parse -v`
Expected: FAIL with `AttributeError: module 'model.fetch' has no attribute '_parse_boxscore'`

- [ ] **Step 3: Write minimal implementation** (append to `model/fetch.py`)

```python
def _norm_status(raw: str) -> str:
    s = (raw or "").lower()
    if "final" in s or "completed" in s or "game over" in s:
        return "final"
    if "postpon" in s:
        return "postponed"
    if "suspend" in s:
        return "suspended"
    if "progress" in s or "live" in s or "delayed" in s or "warmup" in s:
        return "live"
    return "other"


def _parse_boxscore(box: dict, status: str) -> dict:
    """Pure: turn statsapi.boxscore_data + a status string into a GameOutcome
    (without game_id). A batter with >0 plate appearances gets a `bat` dict; a
    pitcher who faced batters gets a `pit` dict; otherwise the sub-dict is None.
    A player absent from every side is simply not in `players` (== DNP)."""
    players: dict[int, dict] = {}
    for side in ("home", "away"):
        for pdata in (box.get(side, {}) or {}).get("players", {}).values():
            pid = pdata.get("personId")
            if pid is None:
                continue
            stats = pdata.get("stats", {}) or {}
            bat_s = stats.get("batting", {}) or {}
            pit_s = stats.get("pitching", {}) or {}
            bat = None
            if int(bat_s.get("plateAppearances", 0) or 0) > 0:
                bat = {
                    "h":   int(bat_s.get("hits", 0) or 0),
                    "tb":  int(bat_s.get("totalBases", 0) or 0),
                    "hr":  int(bat_s.get("homeRuns", 0) or 0),
                    "r":   int(bat_s.get("runs", 0) or 0),
                    "rbi": int(bat_s.get("rbi", 0) or 0),
                }
            pit = None
            if int(pit_s.get("battersFaced", 0) or 0) > 0:
                pit = {"k": int(pit_s.get("strikeOuts", 0) or 0)}
            players[int(pid)] = {"bat": bat, "pit": pit}
    return {"status": _norm_status(status), "players": players}


def game_boxscore(game_id: int) -> dict:
    """Final outcome for one game: GameOutcome dict. Status from schedule(game_id),
    player stats from boxscore_data(game_id). Network-tolerant: status 'other' +
    empty players on failure (the grader then leaves predictions unsettled)."""
    try:
        sched = _with_retries(lambda: statsapi.schedule(game_id=game_id))
        status = sched[0].get("status", "") if sched else ""
    except Exception:
        status = ""
    try:
        box = _with_retries(lambda: statsapi.boxscore_data(game_id))
    except Exception:
        return {"game_id": game_id, "status": _norm_status(status), "players": {}}
    out = _parse_boxscore(box, status)
    out["game_id"] = game_id
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_grader.py -k parse -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py tests/test_grader.py
git commit -m "feat(grader): box-score fetcher + parse (Task 1)"
```

---

### Task 2: Grade the count props (`grade_prediction` — final + graded path)

**Files:**
- Create: `model/grader.py`
- Test: `tests/test_grader.py`

**Interfaces:**
- Produces: `grader.grade_prediction(pred: dict, outcome: dict | None, *, final_retry: bool, now_iso: str) -> dict | None`. Consumes GameOutcome from Task 1. Consumed by Task 5 (`grade_day`).
- Produces: `grader._COUNT_PROPS` mapping used internally.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_grader.py (append)
from model import grader

def _pred(prop, player_id=12345, game_id=776543, line=None):
    p = {"date": "2026-06-27", "game_id": game_id, "player_id": player_id,
         "player": "Aaron Judge", "team": "NYY", "prop": prop, "probs": {}, "factors": {}}
    if line is not None:
        p["factors"]["line"] = line
    return p

def _outcome(bat=None, pit=None, player_id=12345, status="final", game_id=776543):
    return {"game_id": game_id, "status": status,
            "players": {player_id: {"bat": bat, "pit": pit}}}

def test_grade_hits_all_thresholds():
    g = grader.grade_prediction(_pred("hits"),
            _outcome(bat={"h": 2, "tb": 4, "hr": 1, "r": 1, "rbi": 1}),
            final_retry=False, now_iso="2026-06-28T13:00:00Z")
    assert g["status"] == "graded"
    assert g["actual"] == 2
    assert g["results"] == {"1+": True, "2+": True, "3+": False}

def test_grade_total_bases_and_hrr():
    tb = grader.grade_prediction(_pred("total_bases"),
            _outcome(bat={"h": 1, "tb": 4, "hr": 1, "r": 1, "rbi": 1}),
            final_retry=False, now_iso="x")
    assert tb["actual"] == 4 and tb["results"] == {"2+": True, "3+": True, "4+": True}
    hrr = grader.grade_prediction(_pred("hrr"),
            _outcome(bat={"h": 1, "tb": 1, "hr": 0, "r": 1, "rbi": 1}),  # 1+1+1 = 3
            final_retry=False, now_iso="x")
    assert hrr["actual"] == 3 and hrr["results"] == {"2+": True, "3+": True, "4+": False}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_grader.py -k "hits or total_bases" -v`
Expected: FAIL with `AttributeError: module 'model.grader' has no attribute 'grade_prediction'`

- [ ] **Step 3: Write minimal implementation** (`model/grader.py`)

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_grader.py -k "hits or total_bases" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/grader.py tests/test_grader.py
git commit -m "feat(grader): grade count props with all thresholds (Task 2)"
```

---

### Task 3: Strikeouts (over/under + push)

**Files:**
- Modify: `model/grader.py`
- Test: `tests/test_grader.py`

**Interfaces:**
- Consumes: `grade_prediction` from Task 2. Produces: strikeouts branch inside `grade_prediction` (line read from `pred["factors"]["line"]`).

- [ ] **Step 1: Write the failing test**

```python
def test_grade_strikeouts_over_under_push():
    over = grader.grade_prediction(_pred("strikeouts", player_id=67890, line=6.5),
             _outcome(pit={"k": 7}, player_id=67890), final_retry=False, now_iso="x")
    assert over["actual"] == 7 and over["results"] == {"over 6.5": True}

    under = grader.grade_prediction(_pred("strikeouts", player_id=67890, line=6.5),
             _outcome(pit={"k": 5}, player_id=67890), final_retry=False, now_iso="x")
    assert under["results"] == {"over 6.5": False}

    push = grader.grade_prediction(_pred("strikeouts", player_id=67890, line=6),
             _outcome(pit={"k": 6}, player_id=67890), final_retry=False, now_iso="x")
    assert push["push"] is True and push["results"] == {"over 6": None}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_grader.py -k strikeouts -v`
Expected: FAIL (KeyError on `_COUNT_PROPS['strikeouts']` or wrong result)

- [ ] **Step 3: Write minimal implementation** (edit `grade_prediction`, add strikeouts branch BEFORE the count-prop logic)

```python
    # --- strikeouts: over/under a numeric line (pitcher) ---
    if prop == "strikeouts":
        pit = (pstats or {}).get("pit")
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
```

Note: the `pstats`/`bat` lookup at the top of `grade_prediction` stays; for strikeouts we use `pit`. (Void handling for a missing `pit`/`bat` comes in Task 4 — these tests always supply the player.)

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_grader.py -k strikeouts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/grader.py tests/test_grader.py
git commit -m "feat(grader): strikeouts over/under with push (Task 3)"
```

---

### Task 4: Void + finality rules (DNP, not-final, postponed-at-expiry)

**Files:**
- Modify: `model/grader.py`
- Test: `tests/test_grader.py`

**Interfaces:**
- Consumes/extends `grade_prediction`. Produces: terminal `void` records + `None` (unsettled) returns.

- [ ] **Step 1: Write the failing test**

```python
def test_void_when_player_absent_in_final_game():
    g = grader.grade_prediction(_pred("hits"),
            {"game_id": 776543, "status": "final", "players": {}},  # player not in box
            final_retry=False, now_iso="x")
    assert g["status"] == "void" and g["void_reason"] == "DNP"
    assert "actual" not in g

def test_not_final_returns_none_unless_final_retry():
    pred = _pred("hits")
    live = {"game_id": 776543, "status": "live", "players": {}}
    assert grader.grade_prediction(pred, live, final_retry=False, now_iso="x") is None
    # on the date's last in-window run, an unfinished game settles to void
    g = grader.grade_prediction(pred, live, final_retry=True, now_iso="x")
    assert g["status"] == "void" and g["void_reason"] == "postponed"

def test_missing_outcome_returns_none():
    assert grader.grade_prediction(_pred("hits"), None, final_retry=False, now_iso="x") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_grader.py -k "void or not_final or missing_outcome" -v`
Expected: FAIL (current code assumes final + present player)

- [ ] **Step 3: Write minimal implementation** (insert at the TOP of `grade_prediction`, before the strikeouts/count logic)

```python
    rec = _base(pred, now_iso)
    status = (outcome or {}).get("status")

    # No outcome fetched, or game not final yet:
    if outcome is None or status != "final":
        if final_retry:
            rec["status"] = "void"
            rec["void_reason"] = "postponed" if status in ("postponed", "suspended", "live", "other", None) else status
            return rec
        return None  # unsettled — retry next run

    # Final game — locate the player; absence == DNP/scratch == void.
    pstats = (outcome.get("players") or {}).get(pid)
    needed = "pit" if prop == "strikeouts" else "bat"
    if pstats is None or pstats.get(needed) is None:
        rec["status"] = "void"
        rec["void_reason"] = "DNP"
        return rec
```

Then REMOVE the now-duplicated `rec = _base(...)`, `players`/`pstats`/`bat` lookups from the earlier Task 2/3 body, and have the strikeouts branch use `pstats["pit"]` and the count branch use `pstats["bat"]` (guaranteed non-None by the guard above). Final structure of `grade_prediction`:

```python
def grade_prediction(pred, outcome, *, final_retry, now_iso):
    prop = pred.get("prop")
    pid = pred.get("player_id")
    rec = _base(pred, now_iso)
    status = (outcome or {}).get("status")
    if outcome is None or status != "final":
        if final_retry:
            rec["status"] = "void"
            rec["void_reason"] = "postponed"
            return rec
        return None
    pstats = (outcome.get("players") or {}).get(pid)
    needed = "pit" if prop == "strikeouts" else "bat"
    if pstats is None or pstats.get(needed) is None:
        rec["status"] = "void"
        rec["void_reason"] = "DNP"
        return rec
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
```

- [ ] **Step 4: Run the full grader suite to verify all pass**

Run: `uv run pytest tests/test_grader.py -v`
Expected: PASS (Tasks 1-4 tests all green)

- [ ] **Step 5: Commit**

```bash
git add model/grader.py tests/test_grader.py
git commit -m "feat(grader): void/finality rules — DNP, not-final, postponed-at-expiry (Task 4)"
```

---

### Task 5: `grade_day` — iterate predictions against an outcome lookup

**Files:**
- Modify: `model/grader.py`
- Test: `tests/test_grader.py`

**Interfaces:**
- Produces: `grader.grade_day(predictions: list[dict], outcomes_by_game: dict[int, dict], *, final_retry: bool, now_iso: str) -> list[dict]`. Consumes `grade_prediction`. Consumed by Task 6.

- [ ] **Step 1: Write the failing test**

```python
def test_grade_day_grades_present_skips_unsettled():
    preds = [_pred("hits", player_id=1, game_id=100),
             _pred("rbi",  player_id=1, game_id=100),
             _pred("hits", player_id=2, game_id=200)]  # game 200 not final -> skipped
    outcomes = {100: {"game_id": 100, "status": "final",
                      "players": {1: {"bat": {"h":2,"tb":2,"hr":0,"r":0,"rbi":1}, "pit": None}}},
                200: {"game_id": 200, "status": "live", "players": {}}}
    grades = grader.grade_day(preds, outcomes, final_retry=False, now_iso="x")
    assert len(grades) == 2  # two from game 100; game 200 unsettled, omitted
    assert {g["prop"] for g in grades} == {"hits", "rbi"}

def test_grade_day_one_grade_per_prediction():
    # a prediction carries 3 weightings but produces exactly ONE grade
    preds = [_pred("hits", player_id=1, game_id=100)]
    outcomes = {100: {"game_id": 100, "status": "final",
                      "players": {1: {"bat": {"h":1,"tb":1,"hr":0,"r":0,"rbi":0}, "pit": None}}}}
    assert len(grader.grade_day(preds, outcomes, final_retry=False, now_iso="x")) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_grader.py -k grade_day -v`
Expected: FAIL (`grade_day` not defined)

- [ ] **Step 3: Write minimal implementation**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_grader.py -k grade_day -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/grader.py tests/test_grader.py
git commit -m "feat(grader): grade_day orchestration (Task 5)"
```

---

### Task 6: File I/O + window logic + CLI (`grade_file`)

**Files:**
- Modify: `model/grader.py`
- Test: `tests/test_grader.py`

**Interfaces:**
- Produces: `grader.grade_file(predictions_path, grades_path, slate_date, now_iso, *, fetch_fn=fetch.game_boxscore, window_days=3) -> int` and a `__main__` CLI. Consumes `grade_day`.

- [ ] **Step 1: Write the failing test**

```python
import json
from pathlib import Path

def test_grade_file_reads_predictions_writes_grades(tmp_path):
    preds_path = tmp_path / "2026-06-27.jsonl"
    grades_path = tmp_path / "2026-06-27.grades.jsonl"
    preds_path.write_text(
        json.dumps({"date":"2026-06-27","game_id":100,"player_id":1,"player":"X",
                    "team":"NYY","prop":"hits","probs":{},"factors":{}}) + "\n")
    fake = {100: {"game_id":100,"status":"final",
                  "players":{1:{"bat":{"h":3,"tb":5,"hr":1,"r":1,"rbi":2},"pit":None}}}}
    n = grader.grade_file(str(preds_path), str(grades_path), "2026-06-27",
                          "2026-06-28T13:00:00Z",
                          fetch_fn=lambda gid: fake.get(gid), window_days=3)
    assert n == 1
    rows = [json.loads(l) for l in grades_path.read_text().splitlines() if l.strip()]
    assert rows[0]["results"] == {"1+": True, "2+": True, "3+": True}

def test_grade_file_idempotent_overwrite(tmp_path):
    preds_path = tmp_path / "2026-06-27.jsonl"
    grades_path = tmp_path / "2026-06-27.grades.jsonl"
    preds_path.write_text(
        json.dumps({"date":"2026-06-27","game_id":100,"player_id":1,"player":"X",
                    "team":"NYY","prop":"hits","probs":{},"factors":{}}) + "\n")
    fake = {100: {"game_id":100,"status":"final",
                  "players":{1:{"bat":{"h":1,"tb":1,"hr":0,"r":0,"rbi":0},"pit":None}}}}
    f = lambda gid: fake.get(gid)
    grader.grade_file(str(preds_path), str(grades_path), "2026-06-27", "x", fetch_fn=f)
    grader.grade_file(str(preds_path), str(grades_path), "2026-06-27", "x", fetch_fn=f)
    rows = [l for l in grades_path.read_text().splitlines() if l.strip()]
    assert len(rows) == 1  # overwritten, not appended

def test_grade_file_final_retry_at_window_edge(tmp_path):
    # slate 3 days before now -> final_retry True -> unfinished game voids
    preds_path = tmp_path / "2026-06-24.jsonl"
    grades_path = tmp_path / "2026-06-24.grades.jsonl"
    preds_path.write_text(
        json.dumps({"date":"2026-06-24","game_id":100,"player_id":1,"player":"X",
                    "team":"NYY","prop":"hits","probs":{},"factors":{}}) + "\n")
    f = lambda gid: {"game_id":100,"status":"postponed","players":{}}
    grader.grade_file(str(preds_path), str(grades_path), "2026-06-24",
                      "2026-06-26T13:00:00Z", fetch_fn=f, window_days=3)
    rows = [json.loads(l) for l in grades_path.read_text().splitlines() if l.strip()]
    assert rows[0]["status"] == "void" and rows[0]["void_reason"] == "postponed"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_grader.py -k grade_file -v`
Expected: FAIL (`grade_file` not defined)

- [ ] **Step 3: Write minimal implementation**

```python
from datetime import date as _date
from model import fetch as _fetch


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
    now_d = datetime.fromisoformat(now_iso.replace("Z", "+00:00")).date()
    slate_d = _date.fromisoformat(slate_date)
    final_retry = (now_d - slate_d).days >= (window_days - 1)

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
```

- [ ] **Step 4: Run the full suite to verify all pass**

Run: `uv run pytest tests/test_grader.py -v`
Expected: PASS (all grader tests)

- [ ] **Step 5: Commit**

```bash
git add model/grader.py tests/test_grader.py
git commit -m "feat(grader): grade_file I/O + window + CLI (Task 6)"
```

---

### Task 7: Daily grading workflow

**Files:**
- Create: `.github/workflows/grade-predictions.yml`

**Interfaces:**
- Consumes: `model.grader` CLI + the `predictions-archive` branch (read predictions, write grades).

- [ ] **Step 1: Write the workflow**

```yaml
name: grade-predictions

# ──────────────────────────────────────────────────────────────────────────────
# Scores archived predictions against real box scores. DAILY, over a trailing
# 3-day window. Triggered by cron-job.org (reliable); GitHub schedule is a loose
# backup only (idempotent, so a double fire is harmless).
#
# ENABLE: merge to main, then add a once-daily cron-job.org entry that POSTs the
# workflow_dispatch for grade-predictions.yml.
#
# PRIVACY: reads + writes ONLY archive/*.jsonl on the predictions-archive branch.
# Never touches web/public/data or any live-site path.
# ──────────────────────────────────────────────────────────────────────────────

on:
  workflow_dispatch: {}
  schedule:
    - cron: "30 11 * * *"   # ~backup; cron-job.org is the real trigger

concurrency:
  group: grade-predictions
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  grade:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-python@v6
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r requirements.txt

      - name: Grade the trailing 3-day window
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          git fetch origin predictions-archive --depth=1
          base_sha=$(git rev-parse origin/predictions-archive)
          now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
          today=$(date -u +%F)
          workdir=$(mktemp -d)

          changed=0
          for back in 0 1 2; do
            d=$(date -u -d "$today -$back day" +%F 2>/dev/null || date -u -v-"${back}"d +%F)
            if ! git show "origin/predictions-archive:archive/${d}.jsonl" > "$workdir/${d}.jsonl" 2>/dev/null; then
              continue   # no predictions for that date
            fi
            python -m model.grader "$workdir/${d}.jsonl" "$workdir/${d}.grades.jsonl" "$d" "$now"
            [ -s "$workdir/${d}.grades.jsonl" ] && changed=1 || true
          done

          if [ "$changed" = "0" ]; then
            echo "No grades produced this run."; exit 0
          fi

          # Commit the grades files onto predictions-archive (normal push, never force).
          git checkout -b grade-push "$base_sha"
          mkdir -p archive
          cp "$workdir"/*.grades.jsonl archive/ 2>/dev/null || true
          git config user.email "archive-bot@users.noreply.github.com"
          git config user.name "archive-bot"
          git add archive/*.grades.jsonl
          git commit -m "grades @ ${now}"
          git push "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" grade-push:predictions-archive
```

- [ ] **Step 2: Validate the YAML parses**

Run: `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/grade-predictions.yml')); print('jobs:', list(d['jobs']))"`
Expected: `jobs: ['grade']`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/grade-predictions.yml
git commit -m "ci(grader): daily grade-predictions workflow (Task 7)"
```

---

## Self-Review

**1. Spec coverage:**
- §2 all 7 props → Task 2 (6 count props) + Task 3 (strikeouts). ✅
- §5 box score + status → Task 1. ✅
- §6 grade-once → Task 5 test `test_grade_day_one_grade_per_prediction`. ✅
- §6 thresholds incl. HRR sum / Total Bases → Task 2. ✅
- §6 strikeouts push → Task 3. ✅
- §6 void/finality (DNP, not-final omit, postponed-at-expiry) → Task 4. ✅
- §3 grades file naming + mutable overwrite → Task 6 (`grade_file`, `*.grades.jsonl`). ✅
- §4 trailing 3-day window → Task 6 (window_days) + Task 7 (bash loop). ✅
- §7 workflow, cron-job.org + backup schedule, branch-only, privacy → Task 7. ✅
- §8 error handling (missing box score → unsettled; corrupt lines skipped) → Task 1 (`game_boxscore` try/except) + Task 6 (`_read_jsonl`). ✅
- §9 tests → every task is TDD. ✅

**2. Placeholder scan:** none — every step has concrete code/commands.

**3. Type consistency:** GameOutcome shape (`status`, `players[pid] = {"bat","pit"}`) is identical in Tasks 1/2/4/5/6. `grade_prediction(pred, outcome, *, final_retry, now_iso)` signature identical in Tasks 2-5. `grade_file(...)` signature matches its CLI + Task 7 invocation (`<preds> <grades> <date> <now>`). ✅

**Note for the implementer:** verify `_SAMPLE_BOX` against one real `statsapi.boxscore_data(<a finished gamePk>)` early (Task 1) — the batting/pitching stat keys (`plateAppearances`, `totalBases`, `battersFaced`, `strikeOuts`) are the MLB Stats API names but confirm once before relying on the parse.
