"""
model/archive.py — Pure prediction archive record builder.

No file I/O or network calls live here.  The two public functions transform
board data into structured archive records; Task 3 (recorder CLI) handles
all disk / branch writes.

Record shape per (game, player, prop):
  - identity keys   : game_id, game_time, player_id, player, team, bats?,
                      matchup?, lineup_status?, prop,
                      opp_pitcher_name/id/throws? (from `vs`)
  - date, captured_at : stamped by archive_records(), not record_from_row()
  - probs           : {label: {current, blend, history}}
  - factors         : every factor field present on the row + _hist twins
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

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

def _blend(cur: float, hist: float | None) -> float:
    """Blend = midpoint of current and history.  Falls back to current alone."""
    if hist is None:
        return cur
    return (cur + hist) / 2


def _parse_iso(ts: str) -> datetime:
    """Parse an ISO-8601 timestamp, handling a trailing Z."""
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

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
    *,
    window_min: int = 40,
) -> list[dict[str, Any]]:
    """
    Return archive records for every row whose game is "locking soon".

    A game qualifies when:
      - its game_id is NOT in board["started_ids"], AND
      - its game_time is 0 ≤ minutes_until_start ≤ window_min from now_iso.

    Each returned record carries date (from board) and captured_at=now_iso.
    """
    now     = _parse_iso(now_iso)
    started = set(board.get("started_ids", []))
    date    = board.get("date")

    # Determine qualifying game_ids from the games list
    qualifying: set[Any] = set()
    for game in board.get("games", []):
        gid = game["game_id"]
        if gid in started:
            continue
        gt = _parse_iso(game["game_time"])
        mins_until = (gt - now).total_seconds() / 60.0
        if 0.0 <= mins_until <= window_min:
            qualifying.add(gid)

    if not qualifying:
        return []

    # Prop list keys in the board (order doesn't matter for correctness)
    prop_list_keys = ("hr", "strikeouts", "hits", "total_bases", "runs", "rbi", "hrr")

    records: list[dict[str, Any]] = []
    for prop_name in prop_list_keys:
        for row in board.get(prop_name, []):
            if row.get("game_id") in qualifying:
                rec = record_from_row(row, prop_name)
                rec["date"]         = date
                rec["captured_at"]  = now_iso
                records.append(rec)

    return records
