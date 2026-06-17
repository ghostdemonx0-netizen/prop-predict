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
