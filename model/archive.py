"""
model/archive.py — Pure prediction archive record builder + recorder CLI.

record_from_row / archive_records / dedup_new are pure transforms (no I/O).
record_day handles JSONL file I/O: load board, load existing archive, append
only new records, return the count appended.

Record shape per (game, player, prop):
  - identity keys   : game_id, game_time, player_id, player, team, bats?,
                      matchup?, lineup_status?, prop,
                      opp_pitcher_name/id/throws? (from `vs`)
  - date, captured_at : stamped by archive_records(), not record_from_row()
  - probs           : {label: {current, blend, history}}
  - factors         : every factor field present on the row + _hist twins
"""

from __future__ import annotations

import fcntl
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

# Sentinels for missing identity keys.  Each is a unique object so a record
# that has no 'game_id' (for example) cannot spuriously collide with a record
# whose game_id is None or any other real value.
_MISSING_GAME_ID   = object()
_MISSING_PLAYER_ID = object()
_MISSING_PROP      = object()

# ---------------------------------------------------------------------------
# Threshold definitions for the p_geN family
# (HR and strikeouts are handled separately — their prob fields differ)
# Format: prop_name -> list of (row_field, threshold_label)
# ---------------------------------------------------------------------------
THRESHOLDS: dict[str, list[tuple[str, str]]] = {
    "hits":        [("p_ge1", "1+"), ("p_ge2", "2+"), ("p_ge3", "3+")],
    "total_bases": [("p_ge2", "2+"), ("p_ge3", "3+"), ("p_ge4", "4+")],
    "runs":        [("p_ge1", "1+"), ("p_ge2", "2+")],
    "rbi":         [("p_ge1", "1+"), ("p_ge2", "2+")],
    "hrr":         [("p_ge2", "2+"), ("p_ge3", "3+"), ("p_ge4", "4+")],
}

# All factor field names we attempt to capture (tolerant: use .get on the row)
_FACTOR_KEYS: tuple[str, ...] = (
    # HR family
    "park_mult",
    "weather_mult",
    "matchup_mult",
    "pitcher_mult",
    "bvp_mult",
    # cross-family (HR + threshold)
    "recent_form_mult",
    # threshold families (hits / tb / runs / rbi / hrr)
    "pitcher_factor",
    "pitcher_factor_hist",
    "park_weather_factor",
    "park_weather_factor_hist",
    "recent_form_mult_hist",
    "hard_hit_form",
    "hard_hit_form_hist",
    "production_form",
    "production_form_hist",
    # strikeouts / K family
    "expected_ks",
    "expected_ks_hist",
    "line",
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _blend(cur: float | None, hist: float | None) -> float | None:
    """Blend = midpoint of current and history.  Falls back to whatever value exists."""
    if cur is None:
        return hist
    if hist is None:
        return cur
    return (cur + hist) / 2


def _parse_iso(ts: str) -> datetime:
    """Parse an ISO-8601 timestamp, handling a trailing Z.  Always returns aware-UTC."""
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _identity_key(r: dict) -> tuple:
    """Return the (game_id, player_id, prop) identity key for a record.

    Missing keys are replaced by their module-level sentinels so that
    records with absent identity fields never cause a KeyError and never
    spuriously collide with records that carry a real value for that field.
    """
    return (
        r.get("game_id",   _MISSING_GAME_ID),
        r.get("player_id", _MISSING_PLAYER_ID),
        r.get("prop",      _MISSING_PROP),
    )


def dedup_new(existing: list[dict], candidates: list[dict]) -> list[dict]:
    """
    Return only the candidates whose identity key (game_id, player_id, prop)
    is NOT already present in `existing`.  Candidate order is preserved.

    Duplicates within `candidates` are also suppressed: the first occurrence
    wins and later duplicates are dropped.

    This is the cross-call dedup layer: a recorder reads today's already-
    archived records, passes them as `existing`, and appends only what
    dedup_new returns — so a re-run never double-records the same game.
    """
    seen: set[tuple] = {_identity_key(r) for r in existing}
    result: list[dict] = []
    for c in candidates:
        key = _identity_key(c)
        if key not in seen:
            seen.add(key)
            result.append(c)
    return result


def record_from_row(row: dict[str, Any], prop: str) -> dict[str, Any]:
    """
    Build one structured archive record from a board row.

    `prop`    — lowercase prop name, e.g. "hr", "strikeouts", "runs".
    `date` and `captured_at` are NOT added here; archive_records() stamps them.
    """
    prop_lower = prop.lower()

    # -- Identity ----------------------------------------------------------
    rec: dict[str, Any] = {
        "game_id":   row.get("game_id"),
        "game_time": row.get("game_time"),
        "player_id": row.get("player_id"),
        "player":    row.get("player"),
        "team":      row.get("team"),
        "prop":      prop_lower,
    }
    for optional in ("bats", "matchup", "lineup_status"):
        if optional in row:
            rec[optional] = row[optional]

    # Opposing pitcher identity from `vs` (present on batter props, absent on K)
    vs = row.get("vs")
    if vs:
        rec["opp_pitcher_name"]   = vs.get("name")
        rec["opp_pitcher_id"]     = vs.get("player_id")
        rec["opp_pitcher_throws"] = vs.get("throws")

    # -- Probabilities -----------------------------------------------------
    probs: dict[str, dict[str, Any]] = {}

    if prop_lower == "strikeouts":
        cur  = row.get("over_prob")
        hist = row.get("over_prob_hist")
        line = row.get("line")
        if line is not None:
            label = f"over {line}"
            probs[label] = {"current": cur, "blend": _blend(cur, hist), "history": hist}

    elif prop_lower == "hr":
        cur  = row.get("probability")
        hist = row.get("probability_hist")
        probs["1+"] = {"current": cur, "blend": _blend(cur, hist), "history": hist}

    else:
        # p_geN threshold family
        for field, label in THRESHOLDS.get(prop_lower, []):
            cur = row.get(field)
            if cur is not None:
                hist = row.get(f"{field}_hist")
                probs[label] = {
                    "current": cur,
                    "blend":   _blend(cur, hist),
                    "history": hist,
                }

    rec["probs"] = probs

    # -- Factors -----------------------------------------------------------
    # Tolerate missing keys — capture whatever is present on this row.
    factors: dict[str, Any] = {}
    for key in _FACTOR_KEYS:
        val = row.get(key)
        if val is not None:
            factors[key] = val
    rec["factors"] = factors

    return rec


def archive_records(
    board: dict[str, Any],
    now_iso: str,
) -> list[dict[str, Any]]:
    """
    Return archive records for every row whose game has frozen (is in started_ids).

    A row qualifies when its game_id is present in board["started_ids"].
    Frozen rows are stable — capturing any time after lock yields the identical final
    prediction.  The cross-call dedup in dedup_new / record_day ensures each game is
    recorded exactly once regardless of how many times the recorder runs.

    Each returned record carries date (from board) and captured_at=now_iso.
    """
    _parse_iso(now_iso)  # validate format; raises ValueError if malformed

    started = set(board.get("started_ids") or [])  # tolerate a null started_ids
    date    = board.get("date")

    # Prop list keys in the board (order doesn't matter for correctness)
    prop_list_keys = ("hr", "strikeouts", "hits", "total_bases", "runs", "rbi", "hrr")

    seen: set[tuple[Any, Any, str]] = set()          # intra-call dedup
    records: list[dict[str, Any]] = []
    for prop_name in prop_list_keys:
        for row in board.get(prop_name, []):
            gid = row.get("game_id")
            if gid is None:
                continue                             # skip rows with no game_id
            if gid not in started:
                continue                             # skip non-frozen games
            key = (gid, row.get("player_id"), prop_name)
            if key in seen:
                continue
            seen.add(key)
            rec = record_from_row(row, prop_name)
            rec["date"]        = date
            rec["captured_at"] = now_iso
            records.append(rec)

    return records


# ---------------------------------------------------------------------------
# Task 3: Recorder — file I/O lives here, not above
# ---------------------------------------------------------------------------

def record_day(
    board_path: str,
    archive_path: str,
    now_iso: str,
) -> int:
    """
    Load the board JSON from `board_path`, load any existing records from
    `archive_path` (JSONL; missing file → treated as empty), compute new
    archive records, deduplicate against existing, **append** only new records
    to `archive_path`, and return the count appended.

    Idempotent: a second call with the same board + now_iso appends 0.
    Privacy: writes ONLY to `archive_path`.

    Durability guarantees:
    - Corrupt/truncated JSONL lines are skipped with a stderr warning; they do
      not block future appends or dedup of valid lines.
    - An exclusive flock held across the read→append critical section prevents
      TOCTOU duplicates from overlapping processes.
    - Non-UTF-8 bytes in the archive are replaced (errors="replace") so that a
      single stray byte cannot crash the whole run.
    """
    # 1. Load board (caller's file, read-only)
    with open(board_path, "r", encoding="utf-8") as fh:
        board: dict[str, Any] = json.load(fh)

    # 2. Compute candidates (pure, no I/O)
    candidates = archive_records(board, now_iso)

    # 3. Create parent dirs before acquiring the lock so the open() below works
    os.makedirs(os.path.dirname(os.path.abspath(archive_path)), exist_ok=True)

    # 4. Open archive in append+read mode, hold exclusive lock across read→write.
    #    "a+" creates the file if absent; seek(0) lets us read from the start.
    with open(archive_path, "a+", encoding="utf-8", errors="replace") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)

        # Read existing records (tolerate blank lines and corrupt/truncated lines)
        fh.seek(0)
        existing: list[dict[str, Any]] = []
        for raw_line in fh:
            line = raw_line.strip()
            if not line:
                continue
            try:
                existing.append(json.loads(line))
            except json.JSONDecodeError:
                print(
                    f"[archive] skipping corrupt line: {line[:120]!r}",
                    file=sys.stderr,
                )

        # Dedup and append only new records
        new_records = dedup_new(existing, candidates)
        for rec in new_records:
            fh.write(json.dumps(rec, separators=(",", ":")) + "\n")

        # flock released automatically when `with` block exits (file closed)

    return len(new_records)


# ---------------------------------------------------------------------------
# __main__ entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    def _main() -> None:
        args = sys.argv[1:]
        if len(args) < 2:
            print(
                "Usage: python -m model.archive <board_json_path> <archive_jsonl_path> [now_iso]",
                file=sys.stderr,
            )
            sys.exit(1)
        board_path_arg   = args[0]
        archive_path_arg = args[1]
        now_iso_arg = (
            args[2]
            if len(args) >= 3
            else datetime.now(tz=timezone.utc).isoformat()
        )
        try:
            count = record_day(board_path_arg, archive_path_arg, now_iso_arg)
        except FileNotFoundError as exc:
            print(f"archive: error: {exc}", file=sys.stderr)
            sys.exit(1)
        except json.JSONDecodeError as exc:
            print(f"archive: error: board JSON is malformed — {exc}", file=sys.stderr)
            sys.exit(1)
        except ValueError as exc:
            print(f"archive: error: {exc}", file=sys.stderr)
            sys.exit(1)
        print(count)

    _main()
