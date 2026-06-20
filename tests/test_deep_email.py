from model.deep_email import render_deep_email, render_deep_push

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
    h = out["html"]
    assert "Top 12 — Home Runs" in h
    assert "Parlays — Season" in h
    assert "History-Weighted (3-yr" in h  # new history-weighted parlay section
    assert "Blended (season + history" in h  # new blended parlay section
    assert "Diversity" in h
    assert "Factor Edge" in h
    assert "Money-line ladder" in h
    assert out["subject"].startswith("📊 Deep Board")
    assert "border-left:4px solid" in h  # styled cards
    assert "<pre" not in h  # no more monospace dump


def test_deep_email_notes_skipped_moneyline_on_light_slate():
    # 5 games -> 5-leg money-line builds, 6+ skipped (note now in the HTML)
    out = render_deep_email(_board(5), now_iso="2026-06-18T00:00:00+00:00")
    assert "Skipped" in out["html"]


def test_deep_push_is_a_summary_pointing_to_email():
    msg = render_deep_push(_board(), now_iso="2026-06-18T00:00:00+00:00")
    assert "📊 Deep Board" in msg
    assert "Top HR" in msg
    assert "email" in msg.lower()  # points to email for the full detail
