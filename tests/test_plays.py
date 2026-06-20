import json
from pathlib import Path

from model import plays_deliver
from model.plays import select_plays
from model.plays_email import render_email, render_push

FIX = Path(__file__).parent / "fixtures" / "plays_board.json"
BOARD = json.loads(FIX.read_text())
NOW = "2026-06-17T12:00:00+00:00"  # the 2999 games are future, the 2000 games started


def test_excludes_started_games():
    sel = select_plays(BOARD, now_iso=NOW)
    assert "Started Guy" not in [p["player"] for p in sel["hr"]]
    assert "Done Arm" not in [p["player"] for p in sel["strikeouts"]]
    assert "Done Bat" not in [p["player"] for p in sel["hits"]]


def test_ranks_by_metric_all_games():
    sel = select_plays(BOARD, hr_count=2, now_iso=NOW)
    # Pure probability ranking — projected 0.31 outranks confirmed 0.29 (all games compete)
    assert sel["hr"][0]["player"] == "Proj Guy"  # 0.31
    assert sel["hr"][1]["player"] == "Matt Olson"  # 0.29


def test_counts_respected():
    sel = select_plays(BOARD, hr_count=1, k_count=1, hits_count=1, now_iso=NOW)
    assert len(sel["hr"]) == 1 and len(sel["strikeouts"]) == 1 and len(sel["hits"]) == 1


def test_hits_ranked_by_p_ge1():
    sel = select_plays(BOARD, hits_count=2, now_iso=NOW)
    assert sel["hits"][0]["player"] == "Proj Bat"  # 0.78
    assert sel["hits"][1]["player"] == "Luis Arraez"  # 0.74


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


def test_email_has_all_three_sections():
    out = render_email(select_plays(BOARD, now_iso=NOW))
    assert "2026-06-17" in out["subject"]
    assert "ET" in out["subject"]  # send-time stamp keeps each subject unique (no Gmail collapse)
    assert "LOCK OF THE DAY" in out["text"]
    assert "HOME RUN PLAYS" in out["text"]
    assert "STRIKEOUT PLAYS" in out["text"]
    assert "HITS PLAYS" in out["text"]
    assert "Matt Olson" in out["text"]
    assert "Kyle Bradish" in out["text"]
    assert "Luis Arraez" in out["text"]
    assert "PROP-PREDICT" in out["html"]  # styled HTML email (cards, not <pre> dump)


def test_push_carries_the_full_plays():
    msg = render_push(select_plays(BOARD, now_iso=NOW))
    assert "🔒" in msg
    assert "💣 HR" in msg and "🔥 K" in msg and "🟢 HITS" in msg
    assert "Matt Olson" in msg  # a real play is in the push, not just "check email"


def test_email_tags_projected_not_confirmed():
    text = render_email(select_plays(BOARD, now_iso=NOW))["text"]
    assert "⚠️proj" in text  # projected plays (e.g. Proj Guy / Proj Bat) are tagged
    olson_line = next(l for l in text.splitlines() if "Matt Olson" in l)
    assert "⚠️proj" not in olson_line  # a confirmed play is NOT tagged


def test_dry_run_prints_and_sends_nothing(capsys, monkeypatch):
    monkeypatch.setattr(plays_deliver, "load_board", lambda *a, **k: BOARD)

    def boom(*a, **k):
        raise AssertionError("network called during dry-run")

    monkeypatch.setattr(plays_deliver, "send_email", boom)
    monkeypatch.setattr(plays_deliver, "send_push", boom)
    rc = plays_deliver.main(["--dry-run"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "Full Board" in out  # the email subject
    assert "[push]" in out
    assert "🔒" in out  # the phone push still carries the lock


def test_empty_board_skips_sending(capsys, monkeypatch):
    monkeypatch.setattr(plays_deliver, "load_board",
                        lambda *a, **k: {"date": "2026-06-17", "hr": [], "strikeouts": [], "hits": []})

    def boom(*a, **k):
        raise AssertionError("should not send for an empty board")

    monkeypatch.setattr(plays_deliver, "send_email", boom)
    monkeypatch.setattr(plays_deliver, "send_push", boom)
    monkeypatch.setenv("RESEND_API_KEY", "x")
    monkeypatch.setenv("PLAYS_TO_EMAIL", "me@example.com")
    monkeypatch.setenv("NTFY_TOKEN", "topic")
    rc = plays_deliver.main([])
    out = capsys.readouterr().out
    assert rc == 0
    assert "no upcoming plays" in out
