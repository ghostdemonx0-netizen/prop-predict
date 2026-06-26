"""
TDD tests for model/archive.py — predictions archive record builder.
Run: uv run pytest tests/test_archive.py -q
"""

import math
import pytest
from model.archive import THRESHOLDS, _blend, record_from_row, archive_records

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
    "started_ids": [GAME_ID_STARTED],
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
# archive_records — filtering
# ===========================================================================

def test_archive_includes_soon_game():
    recs = archive_records(FAKE_BOARD, NOW_ISO)
    assert any(r["game_id"] == GAME_ID_SOON for r in recs)

def test_archive_excludes_far_future_game():
    recs = archive_records(FAKE_BOARD, NOW_ISO)
    assert not any(r["game_id"] == GAME_ID_FAR for r in recs)

def test_archive_excludes_started_game():
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

def test_archive_narrow_window_excludes_20min_game():
    # 20-min game is excluded when window_min=10
    recs = archive_records(FAKE_BOARD, NOW_ISO, window_min=10)
    assert not any(r["game_id"] == GAME_ID_SOON for r in recs)

def test_archive_window_exactly_at_edge_includes_game():
    # window_min=20: game starting in exactly 20 min should be included (0 <= mins <= window)
    recs = archive_records(FAKE_BOARD, NOW_ISO, window_min=20)
    assert any(r["game_id"] == GAME_ID_SOON for r in recs)

def test_archive_past_game_not_captured():
    # A game whose game_time is BEFORE now_iso should not appear
    past_board = {
        "date": DATE,
        "updated": NOW_ISO,
        "started_ids": [],
        "games": [{"game_id": 9999, "game_time": "2026-06-26T19:30:00Z", "matchup": "X @ Y"}],
        "hr": [{
            "prop": "HR", "game_id": 9999, "game_time": "2026-06-26T19:30:00Z",
            "player_id": 1, "player": "Past Guy", "team": "X",
            "probability": 0.1,
        }],
        "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    assert archive_records(past_board, NOW_ISO) == []

def test_archive_empty_board_returns_empty():
    empty = {
        "date": DATE, "updated": NOW_ISO, "started_ids": [],
        "games": [],
        "hr": [], "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    assert archive_records(empty, NOW_ISO) == []

def test_archive_record_count_matches_soon_rows():
    # FAKE_BOARD has: 1 HR, 1 K, 1 runs row for the soon game → 3 records
    recs = archive_records(FAKE_BOARD, NOW_ISO)
    assert len(recs) == 3


# ===========================================================================
# C1 — mixed-timezone crash in _parse_iso / archive_records
# ===========================================================================

def test_archive_now_without_z_game_time_with_z():
    """C1: now_iso has no Z (naive parse) but game_time has Z (aware) — must not crash."""
    board = {
        "date": DATE,
        "updated": NOW_ISO,
        "started_ids": [],
        "games": [{"game_id": 5001, "game_time": "2026-06-26T20:20:00Z"}],
        "hr": [{"game_id": 5001, "game_time": "2026-06-26T20:20:00Z",
                "player_id": 1, "player": "X", "team": "A", "probability": 0.1}],
        "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    recs = archive_records(board, "2026-06-26T20:00:00")  # no Z → naive parse
    assert any(r["game_id"] == 5001 for r in recs)


def test_archive_now_with_z_game_time_without_z():
    """C1: now_iso has Z (aware) but game_time has no Z (naive parse) — must not crash."""
    board = {
        "date": DATE,
        "updated": NOW_ISO,
        "started_ids": [],
        "games": [{"game_id": 5002, "game_time": "2026-06-26T20:20:00"}],  # no Z
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
# I1 — KeyError on game missing game_time
# ===========================================================================

def test_archive_game_missing_game_time_is_skipped():
    """I1: A game stub with no game_time must not crash — it is simply skipped."""
    board = {
        "date": DATE,
        "updated": NOW_ISO,
        "started_ids": [],
        "games": [{"game_id": 6001}],  # no game_time key
        "hr": [{"game_id": 6001, "player_id": 1, "player": "X", "team": "A",
                "probability": 0.1}],
        "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    recs = archive_records(board, NOW_ISO)
    assert not any(r["game_id"] == 6001 for r in recs)


# ===========================================================================
# I2 — None game_id mismatch
# ===========================================================================

def test_archive_game_id_none_rows_not_emitted():
    """I2: A game with game_id=None + a row with no game_id → row is NOT emitted."""
    board = {
        "date": DATE,
        "updated": NOW_ISO,
        "started_ids": [],
        "games": [{"game_id": None, "game_time": GAME_TIME_SOON}],
        "hr": [{"game_id": None, "player_id": 1, "player": "X", "team": "A",
                "probability": 0.1}],
        "strikeouts": [], "hits": [], "total_bases": [], "runs": [], "rbi": [], "hrr": [],
    }
    recs = archive_records(board, NOW_ISO)
    assert recs == []


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
        "started_ids": [],
        "games": [{"game_id": GAME_ID_SOON, "game_time": GAME_TIME_SOON, "matchup": "AAA @ BBB"}],
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
