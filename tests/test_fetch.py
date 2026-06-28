from model import fetch


def test_pitcher_gamelog_parses_starts(monkeypatch):
    fake = {"people": [{"stats": [{"splits": [
        {"date": "2026-06-01", "game": {"gamePk": 111}, "stat": {"gamesStarted": 1}},
        {"date": "2026-06-05", "game": {"gamePk": 222}, "stat": {"gamesStarted": 0}},
    ]}]}]}
    monkeypatch.setattr(fetch.statsapi, "get", lambda *a, **k: fake)
    out = fetch.pitcher_gamelog(700, 2026)
    assert out == [{"game_pk": 111, "started": True}, {"game_pk": 222, "started": False}]


def test_pitcher_gamelog_empty_on_failure(monkeypatch):
    # malformed payload -> parsing raises -> [] (no slow retry path)
    monkeypatch.setattr(fetch.statsapi, "get", lambda *a, **k: {})
    assert fetch.pitcher_gamelog(700, 2026) == []
