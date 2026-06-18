import json
from pathlib import Path

from model.plays import select_plays

FIX = Path(__file__).parent / "fixtures" / "plays_board.json"
BOARD = json.loads(FIX.read_text())
NOW = "2026-06-17T12:00:00+00:00"  # the 2999 games are future, the 2000 games started


def test_excludes_started_games():
    sel = select_plays(BOARD, now_iso=NOW)
    assert "Started Guy" not in [p["player"] for p in sel["hr"]]
    assert "Done Arm" not in [p["player"] for p in sel["strikeouts"]]
    assert "Done Bat" not in [p["player"] for p in sel["hits"]]


def test_prefers_confirmed_then_metric():
    sel = select_plays(BOARD, hr_count=2, now_iso=NOW)
    # Confirmed taken first even though a projected row has higher probability
    assert sel["hr"][0]["player"] == "Matt Olson"  # confirmed, 0.29
    assert sel["hr"][1]["player"] == "Proj Guy"  # projected fills remainder


def test_counts_respected():
    sel = select_plays(BOARD, hr_count=1, k_count=1, hits_count=1, now_iso=NOW)
    assert len(sel["hr"]) == 1 and len(sel["strikeouts"]) == 1 and len(sel["hits"]) == 1


def test_hits_ranked_by_p_ge1_confirmed_first():
    sel = select_plays(BOARD, hits_count=2, now_iso=NOW)
    assert sel["hits"][0]["player"] == "Luis Arraez"  # confirmed, 0.74
    assert sel["hits"][1]["player"] == "Proj Bat"  # projected fills remainder


def test_lock_is_highest_chance_to_cash():
    sel = select_plays(BOARD, now_iso=NOW)
    # K over_prob 0.80 beats HR 0.31 and hits p_ge1 0.78
    assert sel["lock"]["prop"] == "K"
    assert sel["lock"]["over_prob"] == 0.80


def test_lock_can_be_a_hits_play():
    board = {
        "hr": [{"prop": "HR", "player": "x", "probability": 0.30, "lineup_status": "confirmed"}],
        "strikeouts": [],
        "hits": [{"prop": "HITS", "player": "Hot Bat", "p_ge1": 0.88, "lineup_status": "confirmed"}],
    }
    sel = select_plays(board, now_iso=NOW)
    assert sel["lock"]["prop"] == "HITS" and sel["lock"]["player"] == "Hot Bat"


def test_missing_game_time_is_kept():
    board = {
        "hr": [{"prop": "HR", "player": "NoTime", "probability": 0.5, "lineup_status": "confirmed"}],
        "strikeouts": [], "hits": [],
    }
    sel = select_plays(board, now_iso=NOW)
    assert sel["hr"][0]["player"] == "NoTime"
