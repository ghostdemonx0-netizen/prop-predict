"""
TDD tests for model/archive.py — predictions archive record builder.
Run: uv run pytest tests/test_archive.py -q
"""

import json
import math
import subprocess
import sys
import pytest
from model.archive import THRESHOLDS, _blend, record_from_row, archive_records, dedup_new, record_day

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

NOW_ISO = "2026-06-26T20:00:00Z"
DATE = "2026-06-26"

GAME_ID_SOON    = 1001  # starts in 20 min → qualifies
GAME_ID_FAR     = 1002  # starts in 3 hours → excluded
GAME_ID_STARTED = 1003  # in started_ids → excluded even though game_time is close

GAME_TIME_SOON    = "2026-06-26T20:20:00Z"   # 20 min after NOW
GAME_TIME_FAR     = "2026-06-26T23:00:00Z"   # 3 hours after NOW
GAME_TIME_STARTED = "2026-06-26T20:10:00Z"   # 10 min after NOW (close, but started)

# --- HR row (single-threshold family) ---
HR_ROW_SOON = {
    "prop": "HR",
    "game_id": GAME_ID_SOON,
    "game_time": GAME_TIME_SOON,
    "player_id": 111,
    "player": "Alice Power",
    "team": "AAA",
    "matchup": "AAA @ BBB",
    "bats": "R",
    "lineup_status": "projected",
    "probability": 0.30,
    "probability_hist": 0.24,
    "park_mult": 1.10,
    "weather_mult": 1.05,
    "matchup_mult": 0.95,
    "pitcher_mult": 1.12,
    "bvp_mult": 1.03,
    "recent_form_mult": 1.02,
    "vs": {"name": "Bob Smith", "player_id": 222, "throws": "R"},
}

# --- Strikeouts row (pitcher prop family) ---
K_ROW_SOON = {
    "prop": "K",
    "game_id": GAME_ID_SOON,
    "game_time": GAME_TIME_SOON,
    "player_id": 333,
    "player": "Charlie Arm",
    "team": "AAA",
    "matchup": "AAA @ BBB",
    "throws": "R",
    "pitcher_status": "probable",
    "line": 4.5,
    "over_prob": 0.72,
    "over_prob_hist": 0.65,
    "expected_ks": 5.1,
    "expected_ks_hist": 4.8,
}

# --- Runs row (threshold prop with hard_hit/production/hist twins) ---
RUNS_ROW_SOON = {
    "prop": "RUNS",
    "game_id": GAME_ID_SOON,
    "game_time": GAME_TIME_SOON,
    "player_id": 444,
    "player": "Dave Runner",
    "team": "BBB",
    "matchup": "AAA @ BBB",
    "bats": "L",
    "lineup_status": "confirmed",
    "p_ge1": 0.55,
    "p_ge1_hist": 0.50,
    "p_ge2": 0.20,
    "p_ge2_hist": 0.18,
    "pitcher_factor": 1.10,
    "pitcher_factor_hist": 1.05,
    "park_weather_factor": 0.99,
    "park_weather_factor_hist": 0.99,
    "recent_form_mult": 1.07,
    "recent_form_mult_hist": 1.0,
    "hard_hit_form": 1.02,
    "hard_hit_form_hist": 1.0,
    "production_form": 1.15,
    "production_form_hist": 1.0,
    "vs": {"name": "Eve Pitcher", "player_id": 555, "throws": "L"},
}

# Far-future and started variants for filtering tests
HR_ROW_FAR     = {**HR_ROW_SOON, "game_id": GAME_ID_FAR,     "game_time": GAME_TIME_FAR,     "player_id": 666}
HR_ROW_STARTED = {**HR_ROW_SOON, "game_id": GAME_ID_STARTED, "game_time": GAME_TIME_STARTED, "player_id": 777}

FAKE_BOARD = {
    "date": DATE,
    "updated": NOW_ISO,
    # GAME_ID_SOON is the frozen (started) game — its rows are the final locked prediction.
    # GAME_ID_FAR and GAME_ID_STARTED are live/unknown — NOT in started_ids → excluded.
    "started_ids": [GAME_ID_SOON],
    "games": [
        {"game_id": GAME_ID_SOON,    "game_time": GAME_TIME_SOON,    "matchup": "AAA @ BBB"},
        {"game_id": GAME_ID_FAR,     "game_time": GAME_TIME_FAR,     "matchup": "CCC @ DDD"},
        {"game_id": GAME_ID_STARTED, "game_time": GAME_TIME_STARTED, "matchup": "EEE @ FFF"},
    ],
    "hr":          [HR_ROW_SOON, HR_ROW_FAR, HR_ROW_STARTED],
    "strikeouts":  [K_ROW_SOON],
    "hits":        [],
    "total_bases": [],
    "runs":        [RUNS_ROW_SOON],
    "rbi":         [],
    "hrr":         [],
}


# ===========================================================================
# THRESHOLDS constant
# ===========================================================================

def test_thresholds_has_threshold_props():
    for prop in ("hits", "total_bases", "runs", "rbi", "hrr"):
        assert prop in THRESHOLDS, f"THRESHOLDS missing '{prop}'"

def test_hits_thresholds_three_levels():
    assert len(THRESHOLDS["hits"]) == 3

def test_runs_thresholds_two_levels():
    assert len(THRESHOLDS["runs"]) == 2

def test_hrr_thresholds_three_levels():
    assert len(THRESHOLDS["hrr"]) == 3


# ===========================================================================
# _blend helper
# ===========================================================================

def test_blend_midpoint_of_two_values():
    assert math.isclose(_blend(0.30, 0.24), 0.27)

def test_blend_fallback_to_current_when_no_history():
    assert _blend(0.72, None) == 0.72

def test_blend_equal_values():
    assert math.isclose(_blend(0.55, 0.55), 0.55)

def test_blend_specific_midpoint():
    assert math.isclose(_blend(0.55, 0.50), 0.525)


# ===========================================================================
# record_from_row — HR (single-threshold family)
# ===========================================================================

def test_hr_identity_fields():
    rec = record_from_row(HR_ROW_SOON, "hr")
    assert rec["game_id"] == GAME_ID_SOON
    assert rec["game_time"] == GAME_TIME_SOON
    assert rec["player_id"] == 111
    assert rec["player"] == "Alice Power"
    assert rec["team"] == "AAA"
    assert rec["prop"] == "hr"
    assert rec["bats"] == "R"
    assert rec["lineup_status"] == "projected"
    assert rec["matchup"] == "AAA @ BBB"

def test_hr_oracle_recorded_when_passed():
    rec = record_from_row(HR_ROW_SOON, "hr", oracle=1, oracle_score=0.81)
    assert rec["oracle"] == 1 and rec["oracle_score"] == 0.81

def test_hr_no_oracle_field_when_absent():
    assert "oracle" not in record_from_row(HR_ROW_SOON, "hr")

def test_strikeouts_never_get_oracle():
    # pitcher K prop has no per-hitter Oracle flag even if one is passed
    rec = record_from_row(K_ROW_SOON, "strikeouts", oracle=1, oracle_score=0.9)
    assert "oracle" not in rec

def test_hr_no_date_or_captured_at_added_by_record_from_row():
    # record_from_row does NOT stamp date/captured_at (that's archive_records' job)
    rec = record_from_row(HR_ROW_SOON, "hr")
    assert "date" not in rec
    assert "captured_at" not in rec

def test_hr_opp_pitcher_from_vs():
    rec = record_from_row(HR_ROW_SOON, "hr")
    assert rec["opp_pitcher_name"] == "Bob Smith"
    assert rec["opp_pitcher_id"] == 222
    assert rec["opp_pitcher_throws"] == "R"

def test_hr_probs_key_is_1plus():
    rec = record_from_row(HR_ROW_SOON, "hr")
    assert "1+" in rec["probs"]

def test_hr_probs_current():
    rec = record_from_row(HR_ROW_SOON, "hr")
    assert math.isclose(rec["probs"]["1+"]["current"], 0.30)

def test_hr_probs_history():
    rec = record_from_row(HR_ROW_SOON, "hr")
    assert math.isclose(rec["probs"]["1+"]["history"], 0.24)

def test_hr_probs_blend_is_midpoint():
    rec = record_from_row(HR_ROW_SOON, "hr")
    assert math.isclose(rec["probs"]["1+"]["blend"], 0.27)

def test_hr_factors_captured():
    f = record_from_row(HR_ROW_SOON, "hr")["factors"]
    assert math.isclose(f["park_mult"], 1.10)
    assert math.isclose(f["weather_mult"], 1.05)
    assert math.isclose(f["matchup_mult"], 0.95)
    assert math.isclose(f["pitcher_mult"], 1.12)
    assert math.isclose(f["bvp_mult"], 1.03)
    assert math.isclose(f["recent_form_mult"], 1.02)


# ===========================================================================
# record_from_row — Strikeouts (pitcher prop)
# ===========================================================================

def test_k_probs_label_uses_over_line():
    rec = record_from_row(K_ROW_SOON, "strikeouts")
    assert "over 4.5" in rec["probs"]

def test_k_probs_current():
    p = record_from_row(K_ROW_SOON, "strikeouts")["probs"]["over 4.5"]
    assert math.isclose(p["current"], 0.72)

def test_k_probs_history():
    p = record_from_row(K_ROW_SOON, "strikeouts")["probs"]["over 4.5"]
    assert math.isclose(p["history"], 0.65)

def test_k_probs_blend_midpoint():
    p = record_from_row(K_ROW_SOON, "strikeouts")["probs"]["over 4.5"]
    assert math.isclose(p["blend"], 0.685)

def test_k_factors_include_expected_ks():
    f = record_from_row(K_ROW_SOON, "strikeouts")["factors"]
    assert math.isclose(f["expected_ks"], 5.1)
    assert math.isclose(f["expected_ks_hist"], 4.8)

def test_k_factors_include_line():
    f = record_from_row(K_ROW_SOON, "strikeouts")["factors"]
    assert math.isclose(f["line"], 4.5)

def test_k_no_opp_pitcher_when_no_vs():
    rec = record_from_row(K_ROW_SOON, "strikeouts")
    assert "opp_pitcher_name" not in rec
    assert "opp_pitcher_id" not in rec
    assert "opp_pitcher_throws" not in rec


# ===========================================================================
# record_from_row — Strikeouts KCN capture (Task 1 / Phase A)
# ===========================================================================

def test_record_strikeouts_captures_kcn():
    from model.archive import record_from_row
    row = {
        "game_id": 1, "player_id": 99, "player": "Ace", "team": "NYY",
        "over_prob": 0.55, "line": 6.5,
        "matchups": [
            {"player_id": 11, "name": "A", "k_prob": 0.30, "hit_prob": 0.22, "lean": "K"},
            {"player_id": 12, "name": "B", "k_prob": 0.18, "hit_prob": 0.28, "lean": "H"},
        ],
    }
    rec = record_from_row(row, "strikeouts")
    assert rec["kcn"] == [
        {"player_id": 11, "k_prob": 0.30, "c_prob": 0.22, "lean": "K"},
        {"player_id": 12, "k_prob": 0.18, "c_prob": 0.28, "lean": "H"},
    ]

def test_record_strikeouts_no_matchups_omits_kcn():
    from model.archive import record_from_row
    rec = record_from_row({"game_id": 1, "player_id": 99, "over_prob": 0.5, "line": 6.5}, "strikeouts")
    assert "kcn" not in rec


# ===========================================================================
# record_from_row — Runs (threshold prop, full hist twins)
# ===========================================================================

def test_runs_probs_has_both_thresholds():
    probs = record_from_row(RUNS_ROW_SOON, "runs")["probs"]
    assert "1+" in probs
    assert "2+" in probs

def test_runs_probs_1plus_blend():
    p = record_from_row(RUNS_ROW_SOON, "runs")["probs"]["1+"]
    assert math.isclose(p["current"], 0.55)
    assert math.isclose(p["history"], 0.50)
    assert math.isclose(p["blend"], 0.525)

def test_runs_probs_2plus_blend():
    p = record_from_row(RUNS_ROW_SOON, "runs")["probs"]["2+"]
    assert math.isclose(p["current"], 0.20)
    assert math.isclose(p["history"], 0.18)
    assert math.isclose(p["blend"], 0.19)

def test_runs_factors_pitcher_with_hist():
    f = record_from_row(RUNS_ROW_SOON, "runs")["factors"]
    assert math.isclose(f["pitcher_factor"], 1.10)
    assert math.isclose(f["pitcher_factor_hist"], 1.05)

def test_runs_factors_hard_hit_and_production():
    f = record_from_row(RUNS_ROW_SOON, "runs")["factors"]
    assert math.isclose(f["hard_hit_form"], 1.02)
    assert math.isclose(f["hard_hit_form_hist"], 1.0)
    assert math.isclose(f["production_form"], 1.15)
    assert math.isclose(f["production_form_hist"], 1.0)

def test_runs_factors_park_weather_with_hist():
    f = record_from_row(RUNS_ROW_SOON, "runs")["factors"]
    assert math.isclose(f["park_weather_factor"], 0.99)
    assert math.isclose(f["park_weather_factor_hist"], 0.99)

def test_runs_factors_recent_form_with_hist():
    f = record_from_row(RUNS_ROW_SOON, "runs")["factors"]
    assert math.isclose(f["recent_form_mult"], 1.07)
    assert math.isclose(f["recent_form_mult_hist"], 1.0)

def test_runs_opp_pitcher():
    rec = record_from_row(RUNS_ROW_SOON, "runs")
    assert rec["opp_pitcher_name"] == "Eve Pitcher"
    assert rec["opp_pitcher_id"] == 555
    assert rec["opp_pitcher_throws"] == "L"


# ===========================================================================
# archive_records — filtering (at-lock / frozen-game rule)
# ===========================================================================

def test_archive_includes_frozen_game():
    """A game whose game_id IS in started_ids (frozen) → its rows ARE emitted."""
    recs = archive_records(FAKE_BOARD, NOW_ISO)
    assert any(r["game_id"] == GAME_ID_SOON for r in recs)

def test_archive_excludes_live_game():
    """A game whose game_id is NOT in started_ids (still live) → rows are NOT emitted."""
    recs = archive_records(FAKE_BOARD, NOW_ISO)
    assert not any(r["game_id"] == GAME_ID_FAR for r in recs)

def test_archive_excludes_non_frozen_game():
    """GAME_ID_STARTED (1003) is not in started_ids in FAKE_BOARD → rows are excluded."""
    recs = archive_records(FAKE_BOARD, NOW_ISO)
    assert not any(r["game_id"] == GAME_ID_STARTED for r in recs)

def test_archive_captures_all_matching_prop_types():
    recs = archive_records(FAKE_BOARD, NOW_ISO)
    props = {r["prop"] for r in recs}
    assert "hr" in props
    assert "strikeouts" in props
    assert "runs" in props

def test_archive_stamps_date_on_every_record():
    for rec in archive_records(FAKE_BOARD, NOW_ISO):
        assert rec["date"] == DATE

def test_archive_stamps_captured_at_on_every_record():
    for rec in archive_records(FAKE_BOARD, NOW_ISO):
        assert rec["captured_at"] == NOW_ISO

def test_archive_non_frozen_game_not_captured():
    """A game NOT in started_ids is never captured, regardless of its game_time."""
    board = {
        "date": DATE,
        "updated": NOW_ISO,
        "started_ids": [],
        "hr": [{
            "prop": "HR", "game_id": 9999, "game_time": "2026-06-26T19:30:00Z",
            "player_id": 1, "player": "Past Guy", "team": "X",
            "probability": 0.1,
        }],
        "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    assert archive_records(board, NOW_ISO) == []

def test_archive_empty_board_returns_empty():
    empty = {
        "date": DATE, "updated": NOW_ISO, "started_ids": [],
        "hr": [], "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    assert archive_records(empty, NOW_ISO) == []

def test_archive_record_count_matches_frozen_rows():
    """FAKE_BOARD has: 1 HR, 1 K, 1 runs row for the frozen game → 3 records."""
    recs = archive_records(FAKE_BOARD, NOW_ISO)
    assert len(recs) == 3


# ===========================================================================
# C1 — now_iso format validation (_parse_iso still called for the timestamp)
# ===========================================================================

def test_archive_now_without_z_is_valid():
    """C1: now_iso with no Z suffix is accepted; frozen game rows are returned."""
    board = {
        "date": DATE,
        "updated": NOW_ISO,
        "started_ids": [5001],   # game is frozen → rows qualify
        "hr": [{"game_id": 5001, "game_time": "2026-06-26T20:20:00Z",
                "player_id": 1, "player": "X", "team": "A", "probability": 0.1}],
        "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    recs = archive_records(board, "2026-06-26T20:00:00")  # no Z
    assert any(r["game_id"] == 5001 for r in recs)


def test_archive_now_with_z_is_valid():
    """C1: now_iso with Z suffix is accepted; frozen game rows are returned."""
    board = {
        "date": DATE,
        "updated": NOW_ISO,
        "started_ids": [5002],   # game is frozen → rows qualify
        "hr": [{"game_id": 5002, "game_time": "2026-06-26T20:20:00",
                "player_id": 2, "player": "Y", "team": "B", "probability": 0.2}],
        "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    recs = archive_records(board, NOW_ISO)  # NOW_ISO has Z
    assert any(r["game_id"] == 5002 for r in recs)


# ===========================================================================
# C2 — _blend(None, float) crash
# ===========================================================================

def test_blend_returns_hist_when_cur_is_none():
    """C2: _blend(None, hist) must return hist, not raise TypeError."""
    assert math.isclose(_blend(None, 0.24), 0.24)


def test_blend_returns_none_when_both_none():
    """C2: _blend(None, None) must return None gracefully."""
    assert _blend(None, None) is None


def test_hr_row_missing_probability_but_has_hist_does_not_crash():
    """C2: HR row with probability absent but probability_hist present — must not crash."""
    row = {k: v for k, v in HR_ROW_SOON.items() if k != "probability"}
    rec = record_from_row(row, "hr")
    assert rec["probs"]["1+"]["current"] is None
    assert math.isclose(rec["probs"]["1+"]["history"], 0.24)
    assert math.isclose(rec["probs"]["1+"]["blend"], 0.24)  # fallback to hist


def test_k_row_missing_over_prob_but_has_hist_does_not_crash():
    """C2: Strikeouts row with over_prob absent but over_prob_hist present — must not crash."""
    row = {k: v for k, v in K_ROW_SOON.items() if k != "over_prob"}
    rec = record_from_row(row, "strikeouts")
    p = rec["probs"]["over 4.5"]
    assert p["current"] is None
    assert math.isclose(p["history"], 0.65)
    assert math.isclose(p["blend"], 0.65)  # fallback to hist


# ===========================================================================
# I1 — game not in started_ids is not captured (no crash)
# ===========================================================================

def test_archive_game_not_in_started_ids_is_skipped():
    """I1: A game whose game_id is not in started_ids is simply not captured."""
    board = {
        "date": DATE,
        "updated": NOW_ISO,
        "started_ids": [],          # game 6001 is not frozen
        "hr": [{"game_id": 6001, "player_id": 1, "player": "X", "team": "A",
                "probability": 0.1}],
        "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    recs = archive_records(board, NOW_ISO)
    assert not any(r["game_id"] == 6001 for r in recs)


# ===========================================================================
# I2 — None game_id rows skipped (guard against malformed rows)
# ===========================================================================

def test_archive_game_id_none_rows_not_emitted():
    """I2: A row with game_id=None is always skipped, even if None is in started_ids."""
    board = {
        "date": DATE,
        "updated": NOW_ISO,
        "started_ids": [None],      # even with None present, the game_id=None guard must fire first
        "hr": [{"game_id": None, "player_id": 1, "player": "X", "team": "A",
                "probability": 0.1}],
        "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    recs = archive_records(board, NOW_ISO)
    assert recs == []


def test_archive_started_ids_null_does_not_crash():
    """A board with started_ids explicitly null must not crash (set(None) guard)."""
    board = {"date": DATE, "updated": NOW_ISO, "started_ids": None,
             "hr": [], "strikeouts": [], "hits": [], "total_bases": [],
             "runs": [], "rbi": [], "hrr": []}
    assert archive_records(board, NOW_ISO) == []


# ===========================================================================
# M1 — strikeouts "over None" label when line is absent
# ===========================================================================

def test_k_no_line_produces_no_probs_entry():
    """M1: Strikeouts row with no line — probs must be empty (not keyed 'over None')."""
    row = {k: v for k, v in K_ROW_SOON.items() if k != "line"}
    rec = record_from_row(row, "strikeouts")
    assert "over None" not in rec["probs"]
    assert rec["probs"] == {}


# ===========================================================================
# M3 — dedup within a single archive_records call
# ===========================================================================

def test_archive_dedup_duplicate_rows_same_game_player_prop():
    """M3: Two identical rows for one (game,player,prop) must yield exactly ONE record."""
    dup_board = {
        "date": DATE,
        "updated": NOW_ISO,
        "started_ids": [GAME_ID_SOON],  # game is frozen → rows qualify
        "hr": [HR_ROW_SOON, HR_ROW_SOON],  # duplicate
        "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    recs = archive_records(dup_board, NOW_ISO)
    hr_recs = [r for r in recs if r["prop"] == "hr"]
    assert len(hr_recs) == 1


# ===========================================================================
# Coverage — hits row (threshold family, no hard_hit / production fields)
# ===========================================================================

HITS_ROW_SOON = {
    "prop": "HITS",
    "game_id": GAME_ID_SOON,
    "game_time": GAME_TIME_SOON,
    "player_id": 888,
    "player": "Hitter Sam",
    "team": "AAA",
    "matchup": "AAA @ BBB",
    "bats": "R",
    "lineup_status": "confirmed",
    "p_ge1": 0.70,
    "p_ge1_hist": 0.65,
    "p_ge2": 0.40,
    "p_ge2_hist": 0.38,
    "p_ge3": 0.15,
    "p_ge3_hist": 0.14,
    "pitcher_factor": 0.95,
    "pitcher_factor_hist": 0.97,
    "park_weather_factor": 1.02,
    "park_weather_factor_hist": 1.01,
    "recent_form_mult": 1.05,
    "recent_form_mult_hist": 1.0,
    "vs": {"name": "Pitcher Pat", "player_id": 999, "throws": "R"},
}


def test_hits_probs_all_three_thresholds():
    """Hits fixture covers all three threshold levels (1+, 2+, 3+)."""
    probs = record_from_row(HITS_ROW_SOON, "hits")["probs"]
    assert "1+" in probs
    assert "2+" in probs
    assert "3+" in probs


def test_hits_probs_blend_1plus():
    p = record_from_row(HITS_ROW_SOON, "hits")["probs"]["1+"]
    assert math.isclose(p["current"], 0.70)
    assert math.isclose(p["history"], 0.65)
    assert math.isclose(p["blend"], 0.675)


def test_hits_factors_no_hard_hit_or_production():
    """Hits rows do NOT carry hard_hit/production fields; factors dict should lack them."""
    f = record_from_row(HITS_ROW_SOON, "hits")["factors"]
    assert "hard_hit_form" not in f
    assert "production_form" not in f


def test_hits_factors_pitcher_and_park():
    f = record_from_row(HITS_ROW_SOON, "hits")["factors"]
    assert math.isclose(f["pitcher_factor"], 0.95)
    assert math.isclose(f["park_weather_factor"], 1.02)


def test_hits_opp_pitcher():
    rec = record_from_row(HITS_ROW_SOON, "hits")
    assert rec["opp_pitcher_name"] == "Pitcher Pat"
    assert rec["opp_pitcher_id"] == 999


# ===========================================================================
# dedup_new — cross-call idempotent dedup
# ===========================================================================

# Shared records for dedup tests
_EXISTING_RUNS_REC = {"game_id": 1, "player_id": 100, "prop": "runs", "probs": {}}
_NEW_HR_REC        = {"game_id": 1, "player_id": 100, "prop": "hr",   "probs": {}}
_SAME_RUNS_REC     = {"game_id": 1, "player_id": 100, "prop": "runs", "probs": {"1+": {}}}


def test_dedup_new_filters_already_present_key():
    """Candidate with same (game_id, player_id, prop) as existing is excluded."""
    result = dedup_new([_EXISTING_RUNS_REC], [_SAME_RUNS_REC, _NEW_HR_REC])
    assert len(result) == 1
    assert result[0]["prop"] == "hr"


def test_dedup_new_returns_all_when_existing_empty():
    """When existing is empty every candidate is returned."""
    result = dedup_new([], [_EXISTING_RUNS_REC, _NEW_HR_REC])
    assert len(result) == 2


def test_dedup_new_preserves_candidate_order():
    """Returned list keeps the original candidate order."""
    c1 = {"game_id": 1, "player_id": 1, "prop": "hits"}
    c2 = {"game_id": 1, "player_id": 2, "prop": "hits"}
    c3 = {"game_id": 1, "player_id": 3, "prop": "hits"}
    result = dedup_new([], [c3, c1, c2])
    assert [r["player_id"] for r in result] == [3, 1, 2]


def test_dedup_new_no_mutation_of_inputs():
    """Inputs must not be modified by dedup_new."""
    existing   = [dict(_EXISTING_RUNS_REC)]
    candidates = [dict(_SAME_RUNS_REC), dict(_NEW_HR_REC)]
    existing_len   = len(existing)
    candidates_len = len(candidates)
    dedup_new(existing, candidates)
    assert len(existing) == existing_len
    assert len(candidates) == candidates_len


def test_dedup_new_empty_candidates_returns_empty():
    """When candidates is empty result is always empty."""
    result = dedup_new([_EXISTING_RUNS_REC], [])
    assert result == []


# ===========================================================================
# D1 — candidates deduped against each other (self-dedup)
# ===========================================================================

def test_dedup_new_duplicate_candidates_returns_one():
    """D1: Two candidates with the same identity key → only the first is returned."""
    c = {"game_id": 1, "player_id": 100, "prop": "runs"}
    result = dedup_new([], [c, c])
    assert len(result) == 1


def test_dedup_new_duplicate_candidates_first_wins():
    """D1: When two candidates share a key the first one is emitted, second dropped."""
    c1 = {"game_id": 1, "player_id": 100, "prop": "runs", "marker": "first"}
    c2 = {"game_id": 1, "player_id": 100, "prop": "runs", "marker": "second"}
    result = dedup_new([], [c1, c2])
    assert result[0]["marker"] == "first"


def test_dedup_new_self_dedup_preserves_order_of_unique():
    """D1: With mixed dups and unique candidates the unique ones come out in original order."""
    c_a = {"game_id": 1, "player_id": 1, "prop": "hr"}
    c_b = {"game_id": 1, "player_id": 2, "prop": "hr"}
    c_a_dup = {"game_id": 1, "player_id": 1, "prop": "hr"}
    result = dedup_new([], [c_a, c_b, c_a_dup])
    assert len(result) == 2
    assert result[0]["player_id"] == 1
    assert result[1]["player_id"] == 2


# ===========================================================================
# D2 — missing identity keys don't KeyError
# ===========================================================================

def test_dedup_new_existing_missing_prop_does_not_crash():
    """D2: Existing record with no 'prop' key must not raise KeyError."""
    existing = [{"game_id": 1, "player_id": 100}]  # missing 'prop'
    c = {"game_id": 1, "player_id": 100, "prop": "runs"}
    # Missing 'prop' uses a sentinel → doesn't block the real candidate
    result = dedup_new(existing, [c])
    assert len(result) == 1


def test_dedup_new_existing_missing_game_id_does_not_crash():
    """D2: Existing record with no 'game_id' key must not raise KeyError."""
    existing = [{"player_id": 100, "prop": "runs"}]  # missing 'game_id'
    c = {"game_id": 1, "player_id": 100, "prop": "runs"}
    result = dedup_new(existing, [c])
    assert len(result) == 1  # sentinel key ≠ real key → candidate passes through


def test_dedup_new_candidate_missing_key_does_not_crash():
    """D2: A candidate with a missing identity key must not raise KeyError."""
    c_bad = {"game_id": 1, "player_id": 100}  # missing 'prop'
    c_good = {"game_id": 2, "player_id": 200, "prop": "hr"}
    result = dedup_new([], [c_bad, c_good])
    assert len(result) == 2  # both pass through (neither collides)


# ===========================================================================
# Task 3 — record_day (file-append recorder)
# ===========================================================================

def _write_board(path, board):
    """Helper: write a board dict as JSON to a file path."""
    path.write_text(json.dumps(board))


def test_record_day_returns_count_and_writes_lines(tmp_path):
    """R1: record_day returns N written and the archive has N valid JSON lines."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    # FAKE_BOARD has 3 rows qualifying: HR_ROW_SOON, K_ROW_SOON, RUNS_ROW_SOON
    n = record_day(str(board_path), str(archive_path), NOW_ISO)
    assert n == 3

    lines = [l for l in archive_path.read_text().splitlines() if l.strip()]
    assert len(lines) == 3
    for line in lines:
        obj = json.loads(line)
        assert isinstance(obj, dict)
        assert "game_id" in obj
        assert "prop" in obj


def test_record_day_idempotent(tmp_path):
    """R2: Running record_day twice with identical inputs appends 0 on second run."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    first  = record_day(str(board_path), str(archive_path), NOW_ISO)
    second = record_day(str(board_path), str(archive_path), NOW_ISO)

    assert second == 0
    lines = [l for l in archive_path.read_text().splitlines() if l.strip()]
    assert len(lines) == first  # file unchanged after second run


def test_record_day_appends_to_existing_unrelated_records(tmp_path):
    """R3: Pre-existing records with different keys are kept; only new keys appended."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    # Pre-populate archive with an unrelated record
    unrelated = {"game_id": 9999, "player_id": 9999, "prop": "hr",
                 "date": "2026-06-25", "captured_at": "2026-06-25T19:00:00Z",
                 "probs": {}, "factors": {}}
    archive_path.write_text(json.dumps(unrelated) + "\n")

    n = record_day(str(board_path), str(archive_path), NOW_ISO)
    assert n == 3  # three new records added

    lines = [l for l in archive_path.read_text().splitlines() if l.strip()]
    assert len(lines) == 4  # 1 pre-existing + 3 new


def test_record_day_creates_archive_file_when_absent(tmp_path):
    """R4: When archive_path does not exist it is created (no FileNotFoundError)."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "sub" / "dir" / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    n = record_day(str(board_path), str(archive_path), NOW_ISO)
    assert n == 3
    assert archive_path.exists()


def test_record_day_tolerates_blank_lines_in_archive(tmp_path):
    """R5: Blank lines in the existing JSONL file are tolerated (not parsed as JSON)."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    # Write archive with a blank line between records
    existing = {"game_id": 9999, "player_id": 9999, "prop": "hr",
                "date": "2026-06-25", "captured_at": "2026-06-25T00:00:00Z",
                "probs": {}, "factors": {}}
    archive_path.write_text(json.dumps(existing) + "\n\n")  # trailing blank line

    # Should not crash
    n = record_day(str(board_path), str(archive_path), NOW_ISO)
    assert n == 3


def test_record_day_empty_board_appends_zero(tmp_path):
    """R6: A board with no qualifying games results in 0 records appended."""
    empty_board = {
        "date": "2026-06-26",
        "updated": NOW_ISO,
        "started_ids": [],
        "games": [],
        "hr": [], "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, empty_board)

    n = record_day(str(board_path), str(archive_path), NOW_ISO)
    assert n == 0
    # Archive file is created but empty (or does not exist — either is acceptable)
    if archive_path.exists():
        assert archive_path.read_text().strip() == ""


def test_record_day_records_have_date_and_captured_at(tmp_path):
    """R7: Every written record carries date and captured_at."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    record_day(str(board_path), str(archive_path), NOW_ISO)

    lines = [l for l in archive_path.read_text().splitlines() if l.strip()]
    for line in lines:
        obj = json.loads(line)
        assert obj.get("date") == DATE
        assert obj.get("captured_at") == NOW_ISO


# ===========================================================================
# Task 3 — __main__ CLI
# ===========================================================================

def test_main_cli_prints_count(tmp_path):
    """CLI: python -m model.archive <board> <archive> <now_iso> prints the count."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    result = subprocess.run(
        [sys.executable, "-m", "model.archive",
         str(board_path), str(archive_path), NOW_ISO],
        capture_output=True, text=True, check=True,
    )
    # Output should be the integer count (3) on a line
    assert result.stdout.strip() == "3"


def test_main_cli_idempotent(tmp_path):
    """CLI idempotent: second run prints 0."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    subprocess.run(
        [sys.executable, "-m", "model.archive",
         str(board_path), str(archive_path), NOW_ISO],
        capture_output=True, text=True, check=True,
    )
    result = subprocess.run(
        [sys.executable, "-m", "model.archive",
         str(board_path), str(archive_path), NOW_ISO],
        capture_output=True, text=True, check=True,
    )
    assert result.stdout.strip() == "0"


# ===========================================================================
# Fix 1 — corrupt/partial JSONL line must not brick the archive
# ===========================================================================

def test_record_day_corrupt_last_line_does_not_crash(tmp_path):
    """F1a: A truncated last line in the JSONL does not crash record_day."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    # Write a valid line for a different (game, player, prop) then a truncated line
    good_rec = {"game_id": 9999, "player_id": 9999, "prop": "hr",
                "date": "2026-06-25", "captured_at": "2026-06-25T19:00:00Z",
                "probs": {}, "factors": {}}
    archive_path.write_bytes(
        (json.dumps(good_rec) + "\n" + '{"game_id":1,"player').encode("utf-8")
    )

    # Must not raise; should append the 3 qualifying rows
    n = record_day(str(board_path), str(archive_path), NOW_ISO)
    assert n == 3


def test_record_day_corrupt_line_good_lines_honored_for_dedup(tmp_path):
    """F1b: Good lines before a corrupt line are still used for dedup."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    # Pre-archive: the HR_ROW_SOON record (valid) then a corrupt line
    hr_rec = {
        "game_id": GAME_ID_SOON,
        "player_id": 111,
        "prop": "hr",
        "date": DATE,
        "captured_at": NOW_ISO,
        "probs": {},
        "factors": {},
    }
    archive_path.write_bytes(
        (json.dumps(hr_rec) + "\n" + '{"truncated":true').encode("utf-8")
    )

    # HR is already archived → only K and runs should be new (2 records)
    n = record_day(str(board_path), str(archive_path), NOW_ISO)
    assert n == 2


def test_record_day_corrupt_line_prints_warning_to_stderr(tmp_path):
    """F1c: A corrupt line triggers a warning on stderr (not a traceback)."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    archive_path.write_bytes(b'{"bad json\n')

    result = subprocess.run(
        [sys.executable, "-m", "model.archive",
         str(board_path), str(archive_path), NOW_ISO],
        capture_output=True, text=True,
    )
    assert result.returncode == 0
    assert "[archive]" in result.stderr or "skipping" in result.stderr.lower()


# ===========================================================================
# Fix 2 — flock-based TOCTOU duplicate guard
# ===========================================================================

def test_record_day_flock_idempotent(tmp_path):
    """F2a: Normal single-run still works correctly with flock in place."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    n = record_day(str(board_path), str(archive_path), NOW_ISO)
    assert n == 3

    n2 = record_day(str(board_path), str(archive_path), NOW_ISO)
    assert n2 == 0

    lines = [l for l in archive_path.read_text().splitlines() if l.strip()]
    assert len(lines) == 3


def test_record_day_concurrent_no_duplicates(tmp_path):
    """F2b: Two simultaneous subprocess calls must not produce duplicate lines."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    cmd = [sys.executable, "-m", "model.archive",
           str(board_path), str(archive_path), NOW_ISO]

    p1 = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    p2 = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out1, _ = p1.communicate(timeout=15)
    out2, _ = p2.communicate(timeout=15)

    assert p1.returncode == 0
    assert p2.returncode == 0

    total_reported = int(out1.strip()) + int(out2.strip())

    lines = [l for l in archive_path.read_text().splitlines() if l.strip()]
    # No duplicates: exactly 3 unique records regardless of race outcome
    assert len(lines) == 3
    assert total_reported == 3  # one process wrote 3, the other wrote 0


# ===========================================================================
# Fix 3 — non-UTF8 bytes in archive file must not crash
# ===========================================================================

def test_record_day_non_utf8_bytes_in_archive(tmp_path):
    """F3: Stray non-UTF8 bytes in archive are replaced; bad line skipped; no crash."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    # Write a valid record followed by a line with invalid UTF-8 bytes
    good_rec = {"game_id": 9999, "player_id": 9999, "prop": "hr",
                "date": "2026-06-25", "captured_at": "2026-06-25T00:00:00Z",
                "probs": {}, "factors": {}}
    archive_path.write_bytes(
        json.dumps(good_rec).encode("utf-8") + b"\n" + b"\xff\xfe bad bytes\n"
    )

    # Must not raise UnicodeDecodeError; should append 3 new records
    n = record_day(str(board_path), str(archive_path), NOW_ISO)
    assert n == 3


# ===========================================================================
# Fix 4 — CLI error messages: clean exit-1 instead of traceback
# ===========================================================================

def test_main_cli_missing_board_exits_1(tmp_path):
    """F4a: Missing board path → exit code 1 and clean error message (no traceback)."""
    missing_board = str(tmp_path / "nonexistent_board.json")
    archive_path  = str(tmp_path / "archive.jsonl")

    result = subprocess.run(
        [sys.executable, "-m", "model.archive", missing_board, archive_path, NOW_ISO],
        capture_output=True, text=True,
    )
    assert result.returncode == 1
    assert "Traceback" not in result.stderr
    assert "archive: error:" in result.stderr


def test_main_cli_bad_now_iso_exits_1(tmp_path):
    """F4b: Bad now_iso (unparseable datetime) → exit code 1 and clean error message."""
    board_path   = tmp_path / "board.json"
    archive_path = tmp_path / "archive.jsonl"
    _write_board(board_path, FAKE_BOARD)

    result = subprocess.run(
        [sys.executable, "-m", "model.archive",
         str(board_path), str(archive_path), "not-a-date"],
        capture_output=True, text=True,
    )
    assert result.returncode == 1
    assert "Traceback" not in result.stderr
    assert "archive: error:" in result.stderr


# ===========================================================================
# Task 6 — Privacy guard: record_day writes only to archive_path
# ===========================================================================

def test_record_day_writes_only_to_archive_path(tmp_path):
    """P1: record_day must write ONLY to archive_path — no stray files created elsewhere.

    Approach: snapshot tmp_path before and after the call; diff the two sets.
    The only new paths allowed are archive_path itself and its parent directory
    (which record_day creates via os.makedirs when the subdir doesn't yet exist).
    This pins the guarantee that the recorder never touches export_web.DATA_DIR
    or any other location outside the explicitly supplied archive_path.
    """
    board_path   = tmp_path / "board.json"
    # Put archive in a subdirectory so record_day must create the parent dir —
    # that makes the allowed set explicit and the diff meaningful.
    archive_path = tmp_path / "archive" / "archive.jsonl"

    _write_board(board_path, FAKE_BOARD)

    # Snapshot the tmp tree AFTER writing the board but BEFORE the call.
    before = set(tmp_path.rglob("*"))

    n = record_day(str(board_path), str(archive_path), NOW_ISO)

    # Sanity: the recorder actually wrote records (FAKE_BOARD has 3 qualifying rows).
    assert n > 0

    # Diff: what paths appeared after the call?
    after = set(tmp_path.rglob("*"))
    new_paths = after - before

    # Only archive_path and its immediate parent (created by os.makedirs) are allowed.
    allowed = {archive_path, archive_path.parent}
    unexpected = new_paths - allowed

    assert unexpected == set(), (
        f"record_day created unexpected paths outside archive_path: {unexpected}"
    )


# --- Approach C: recorder captures the lineup factor ---

def test_record_from_row_captures_lineup_factors():
    row = {
        "game_id": 1, "player_id": 7, "player": "X", "team": "AAA",
        "p_ge1": 0.42, "p_ge2": 0.15,
        "lineup_mult": 1.08, "lineup_slot": 1.05, "lineup_teammate": 1.12,
        "lineup_mult_hist": 1.06,
    }
    rec = record_from_row(row, "runs")
    assert rec["factors"]["lineup_mult"] == 1.08
    assert rec["factors"]["lineup_slot"] == 1.05
    assert rec["factors"]["lineup_teammate"] == 1.12
    assert rec["factors"]["lineup_mult_hist"] == 1.06


def test_record_captures_spray_pull():
    rec = record_from_row({"game_id": 1, "player_id": 7, "player": "X", "team": "AAA",
                           "probability": 0.12, "spray_pull": 0.66}, "hr")
    assert rec["factors"]["spray_pull"] == 0.66


def test_record_captures_bvp_hit_mult():
    rec = record_from_row({"game_id": 1, "player_id": 7, "player": "X", "team": "AAA",
                           "p_ge1": 0.4, "bvp_hit_mult": 1.06}, "hits")
    assert rec["factors"]["bvp_hit_mult"] == 1.06


def test_spray_mult_and_bat_order_captured():
    # spray_mult (HR/TB power props) + bat_order context now recorded for tuning
    row = dict(HR_ROW_SOON, spray_mult=1.034, bat_order=3)
    f = record_from_row(row, "hr")["factors"]
    assert math.isclose(f["spray_mult"], 1.034)
    assert f["bat_order"] == 3


def test_spray_mult_absent_when_not_on_row():
    # rows without the field (e.g. hits) simply omit it — tolerant .get
    f = record_from_row(HR_ROW_SOON, "hr")["factors"]
    assert "spray_mult" not in f


# ===========================================================================
# Task 4 — HR history-beff twin + recorder archives barreled HR + barrel_mult
# ===========================================================================

def test_archive_captures_barreled_hr():
    row = {  # minimal HR row with beff twins (reuse the file's existing HR row helper if present)
        "prop": "HR", "game_id": 1, "player_id": 5, "player": "X", "team": "BOS",
        "probability": 0.15, "probability_hist": 0.18,
        "probability_beff": 0.18, "probability_hist_beff": 0.216,
        "barrel_mult": 1.20, "barrel_mult_hist": 1.20,
    }
    rec = record_from_row(row, "hr")
    assert rec["factors"].get("barrel_mult") == 1.20
    # a barreled prob triple is recorded
    assert any("barrel" in k.lower() for k in rec["probs"])


# ===========================================================================
# Task 4 — barreled archive triples for Hits/TB/Runs/RBI/HRR
# ===========================================================================

HITS_BEFF_ROW = {
    "prop": "HITS",
    "game_id": GAME_ID_SOON,
    "game_time": GAME_TIME_SOON,
    "player_id": 101,
    "player": "Barrel Hitter",
    "team": "AAA",
    "matchup": "AAA @ BBB",
    "bats": "R",
    "lineup_status": "confirmed",
    "p_ge1": 0.70, "p_ge1_hist": 0.65,
    "p_ge2": 0.40, "p_ge2_hist": 0.38,
    "p_ge3": 0.15, "p_ge3_hist": 0.14,
    "p_ge1_beff": 0.72, "p_ge1_beff_hist": 0.68,
    "p_ge2_beff": 0.42, "p_ge2_beff_hist": 0.39,
    "vs": {"name": "Pitcher Pat", "player_id": 999, "throws": "R"},
}


def test_hits_barreled_triple_recorded():
    """Hits row with p_ge1_beff records a '1+ barreled' triple in probs."""
    rec = record_from_row(HITS_BEFF_ROW, "hits")
    assert "1+ barreled" in rec["probs"]


def test_hits_barreled_triple_current_value():
    rec = record_from_row(HITS_BEFF_ROW, "hits")
    assert math.isclose(rec["probs"]["1+ barreled"]["current"], 0.72)


def test_hits_barreled_triple_history_value():
    rec = record_from_row(HITS_BEFF_ROW, "hits")
    assert math.isclose(rec["probs"]["1+ barreled"]["history"], 0.68)


def test_hits_barreled_triple_blend_is_midpoint():
    rec = record_from_row(HITS_BEFF_ROW, "hits")
    # blend of 0.72 and 0.68 = 0.70
    assert math.isclose(rec["probs"]["1+ barreled"]["blend"], 0.70)


def test_hits_all_barreled_thresholds_recorded():
    """All threshold levels that have beff data produce barreled triples."""
    rec = record_from_row(HITS_BEFF_ROW, "hits")
    assert "1+ barreled" in rec["probs"]
    assert "2+ barreled" in rec["probs"]


def test_hits_barreled_hist_none_when_absent():
    """When beff_hist is absent the history in the triple is None."""
    row = {k: v for k, v in HITS_BEFF_ROW.items() if k != "p_ge1_beff_hist"}
    rec = record_from_row(row, "hits")
    assert rec["probs"]["1+ barreled"]["history"] is None


def test_threshold_without_beff_produces_no_barreled_triple():
    """A hits row without any beff fields produces no barreled keys in probs."""
    row = {k: v for k, v in HITS_BEFF_ROW.items() if "_beff" not in k}
    rec = record_from_row(row, "hits")
    assert not any("barreled" in k for k in rec["probs"])


# ===========================================================================
# Task 4 — barrel-weight archive triples (HR + threshold props)
# ===========================================================================

def test_hr_barrel_weight_triple_recorded():
    """HR row with probability_bweight records a '1+ barrel-weight' triple in probs."""
    row = {
        "prop": "HR", "game_id": 1, "player_id": 5, "player": "X", "team": "BOS",
        "probability": 0.15, "probability_hist": 0.18,
        "probability_bweight": 0.17, "probability_bweight_hist": 0.19,
    }
    rec = record_from_row(row, "hr")
    assert "1+ barrel-weight" in rec["probs"]


def test_hr_barrel_weight_triple_current_value():
    row = {
        "game_id": 1, "player_id": 5, "player": "X", "team": "BOS",
        "probability": 0.15, "probability_bweight": 0.17, "probability_bweight_hist": 0.19,
    }
    rec = record_from_row(row, "hr")
    assert math.isclose(rec["probs"]["1+ barrel-weight"]["current"], 0.17)


def test_hr_barrel_weight_triple_history_value():
    row = {
        "game_id": 1, "player_id": 5, "player": "X", "team": "BOS",
        "probability": 0.15, "probability_bweight": 0.17, "probability_bweight_hist": 0.19,
    }
    rec = record_from_row(row, "hr")
    assert math.isclose(rec["probs"]["1+ barrel-weight"]["history"], 0.19)


def test_hr_barrel_weight_triple_blend():
    row = {
        "game_id": 1, "player_id": 5, "player": "X", "team": "BOS",
        "probability": 0.15, "probability_bweight": 0.17, "probability_bweight_hist": 0.19,
    }
    rec = record_from_row(row, "hr")
    assert math.isclose(rec["probs"]["1+ barrel-weight"]["blend"], 0.18)


def test_hr_no_barrel_weight_when_absent():
    """HR row without bweight fields produces no '1+ barrel-weight' in probs."""
    rec = record_from_row(HR_ROW_SOON, "hr")
    assert "1+ barrel-weight" not in rec["probs"]


HITS_BWEIGHT_ROW = {
    "prop": "HITS",
    "game_id": GAME_ID_SOON,
    "game_time": GAME_TIME_SOON,
    "player_id": 102,
    "player": "Barrel Weight Hitter",
    "team": "AAA",
    "p_ge1": 0.70, "p_ge1_hist": 0.65,
    "p_ge2": 0.40, "p_ge2_hist": 0.38,
    "p_ge1_bweight": 0.68, "p_ge1_bweight_hist": 0.63,
    "p_ge2_bweight": 0.38, "p_ge2_bweight_hist": 0.36,
}


def test_hits_barrel_weight_triple_recorded():
    """Hits row with p_ge1_bweight records a '1+ barrel-weight' triple in probs."""
    rec = record_from_row(HITS_BWEIGHT_ROW, "hits")
    assert "1+ barrel-weight" in rec["probs"]


def test_hits_barrel_weight_triple_current_value():
    rec = record_from_row(HITS_BWEIGHT_ROW, "hits")
    assert math.isclose(rec["probs"]["1+ barrel-weight"]["current"], 0.68)


def test_hits_barrel_weight_triple_history_value():
    rec = record_from_row(HITS_BWEIGHT_ROW, "hits")
    assert math.isclose(rec["probs"]["1+ barrel-weight"]["history"], 0.63)


def test_hits_barrel_weight_triple_blend():
    rec = record_from_row(HITS_BWEIGHT_ROW, "hits")
    # blend of 0.68 and 0.63 = 0.655
    assert math.isclose(rec["probs"]["1+ barrel-weight"]["blend"], 0.655)


def test_hits_all_bweight_thresholds_recorded():
    """All threshold levels with bweight data produce barrel-weight triples."""
    rec = record_from_row(HITS_BWEIGHT_ROW, "hits")
    assert "1+ barrel-weight" in rec["probs"]
    assert "2+ barrel-weight" in rec["probs"]


def test_hits_bweight_hist_none_when_absent():
    """When bweight_hist is absent the history in the triple is None."""
    row = {k: v for k, v in HITS_BWEIGHT_ROW.items() if k != "p_ge1_bweight_hist"}
    rec = record_from_row(row, "hits")
    assert rec["probs"]["1+ barrel-weight"]["history"] is None


def test_threshold_without_bweight_produces_no_barrel_weight_triple():
    """A hits row without any bweight fields produces no barrel-weight keys in probs."""
    row = {k: v for k, v in HITS_BWEIGHT_ROW.items() if "_bweight" not in k}
    rec = record_from_row(row, "hits")
    assert not any("barrel-weight" in k for k in rec["probs"])
