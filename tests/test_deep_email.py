from model.deep_email import render_deep_email

FUTURE = "2999-01-01T00:00:00Z"


def _board(n_games=5):
    b = {"date": "2026-06-18", "updated": "2026-06-18T04:45:38+00:00",
         "hr": [], "strikeouts": [], "hits": []}
    for g in range(1, n_games + 1):
        b["hr"].append({"prop": "HR", "player": f"H{g}", "team": "AAA", "matchup": f"G{g}",
                        "probability": 0.30 + g * 0.01, "game_id": g, "lineup_status": "confirmed",
                        "game_time": FUTURE})
        b["strikeouts"].append({"prop": "K", "player": f"P{g}", "team": "BBB", "matchup": f"G{g}",
                                "over_prob": 0.70 + g * 0.01, "line": 4.5, "game_id": g,
                                "pitcher_status": "confirmed", "game_time": FUTURE})
        b["hits"].append({"prop": "HITS", "player": f"B{g}", "team": "CCC", "matchup": f"G{g}",
                          "p_ge1": 0.65 + g * 0.01, "game_id": g, "lineup_status": "projected",
                          "game_time": FUTURE})
    return b


def test_deep_email_has_boards_and_parlays():
    out = render_deep_email(_board(), now_iso="2026-06-18T00:00:00+00:00")
    t = out["text"]
    assert "TOP 25 — HOME RUNS" in t
    assert "TOP 25 — HITS" in t
    assert "TOP 25 — STRIKEOUTS" in t
    assert "PARLAYS" in t
    assert "MONEY-LINE" in t
    assert out["subject"].startswith("📊 Deep Board")
    assert "<pre" in out["html"]


def test_deep_email_notes_skipped_moneyline_on_light_slate():
    # 5 games -> 5-leg money-line builds, 6+ skipped
    out = render_deep_email(_board(5), now_iso="2026-06-18T00:00:00+00:00")
    assert "skipped" in out["text"].lower()
