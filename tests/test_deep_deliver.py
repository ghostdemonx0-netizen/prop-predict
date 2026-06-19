from model import deep_deliver

FUTURE = "2999-01-01T00:00:00Z"


def _board(n=5):
    b = {"date": "2026-06-18", "updated": "2026-06-18T04:45:38+00:00",
         "hr": [], "strikeouts": [], "hits": []}
    for g in range(1, n + 1):
        b["hr"].append({"prop": "HR", "player": f"H{g}", "matchup": f"G{g}",
                        "probability": 0.30 + g * 0.01, "game_id": g,
                        "lineup_status": "confirmed", "game_time": FUTURE})
        b["strikeouts"].append({"prop": "K", "player": f"P{g}", "matchup": f"G{g}",
                                "over_prob": 0.70 + g * 0.01, "line": 4.5, "game_id": g,
                                "pitcher_status": "confirmed", "game_time": FUTURE})
    return b


def test_dry_run_prints_and_sends_nothing(capsys, monkeypatch):
    monkeypatch.setattr(deep_deliver, "load_board", lambda *a, **k: _board())

    def boom(*a, **k):
        raise AssertionError("network called during dry-run")

    monkeypatch.setattr(deep_deliver, "send_email", boom)
    monkeypatch.setattr(deep_deliver, "send_push", boom)
    rc = deep_deliver.main(["--dry-run"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "DEEP BOARD" in out
    assert "PARLAYS" in out


def test_empty_board_skips_sending(capsys, monkeypatch):
    monkeypatch.setattr(deep_deliver, "load_board",
                        lambda *a, **k: {"date": "x", "hr": [], "strikeouts": [], "hits": []})

    def boom(*a, **k):
        raise AssertionError("should not send for an empty board")

    monkeypatch.setattr(deep_deliver, "send_email", boom)
    monkeypatch.setattr(deep_deliver, "send_push", boom)
    monkeypatch.setenv("RESEND_API_KEY", "x")
    monkeypatch.setenv("PLAYS_TO_EMAIL", "me@example.com")
    monkeypatch.setenv("NTFY_TOKEN", "topic")
    rc = deep_deliver.main([])
    out = capsys.readouterr().out
    assert rc == 0
    assert "no upcoming plays" in out
