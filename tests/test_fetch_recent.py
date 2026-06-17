def test_get_recent_lineup_returns_newest_nonempty_order():
    from model.fetch import get_recent_lineup
    sched = [
        {"game_id": 1, "game_date": "2026-06-09", "home_id": 147, "away_id": 110},
        {"game_id": 2, "game_date": "2026-06-11", "home_id": 121, "away_id": 147},
    ]
    lineups = {1: {"home": [10, 11], "away": [20]}, 2: {"home": [30], "away": [40, 41, 42]}}
    out = get_recent_lineup(147, "2026-06-12",
                            schedule_fn=lambda s, e: sched,
                            get_lineups_fn=lambda gid: lineups[gid])
    assert out == [40, 41, 42]  # team 147 was AWAY on 06-11


def test_get_recent_lineup_skips_games_without_a_posted_lineup():
    from model.fetch import get_recent_lineup
    sched = [
        {"game_id": 1, "game_date": "2026-06-09", "home_id": 147, "away_id": 110},
        {"game_id": 2, "game_date": "2026-06-11", "home_id": 147, "away_id": 121},
    ]
    lineups = {1: {"home": [10, 11, 12], "away": []}, 2: {"home": [], "away": []}}  # newest empty
    out = get_recent_lineup(147, "2026-06-12",
                            schedule_fn=lambda s, e: sched,
                            get_lineups_fn=lambda gid: lineups[gid])
    assert out == [10, 11, 12]


def test_get_recent_lineup_empty_when_nothing_found():
    from model.fetch import get_recent_lineup
    out = get_recent_lineup(147, "2026-06-12",
                            schedule_fn=lambda s, e: [],
                            get_lineups_fn=lambda gid: {"home": [], "away": []})
    assert out == []


def test_get_schedule_parses_hydrated_probables(monkeypatch):
    import model.fetch as fetch
    payload = {"dates": [{"games": [
        {"gamePk": 777, "gameDate": "2026-06-17T23:40:00Z",
         "status": {"abstractGameState": "Preview", "detailedState": "Scheduled"},
         "teams": {"home": {"team": {"id": 109}, "probablePitcher": {"id": 501}},
                   "away": {"team": {"id": 147}, "probablePitcher": {"id": 502}}}},
        {"gamePk": 888, "gameDate": "2026-06-17T20:10:00Z",
         "status": {"abstractGameState": "Final", "detailedState": "Final"},
         "teams": {"home": {"team": {"id": 121}},  # no probablePitcher key
                   "away": {"team": {"id": 110}, "probablePitcher": {"id": 503}}}},
    ]}]}
    monkeypatch.setattr(fetch.statsapi, "get", lambda ep, params: payload)
    out = fetch.get_schedule("2026-06-17")
    assert len(out) == 2
    g = out[0]
    assert g["game_id"] == 777 and g["home_id"] == 109 and g["away_id"] == 147
    assert g["home_pitcher_id"] == 501 and g["away_pitcher_id"] == 502
    assert g["started"] is False  # Preview
    assert g["game_time"] == "2026-06-17T23:40:00Z"
    assert g["home"] == fetch._abbr(109) and g["park_team"] == fetch._abbr(109)
    g2 = out[1]
    assert g2["started"] is True  # Final
    assert g2["home_pitcher_id"] is None  # no probablePitcher key -> None
    assert g2["away_pitcher_id"] == 503
