# tests/test_export_history_fns.py
from model import export_web, fetch


def test_make_profile_fns_returns_history_pair(monkeypatch):
    # bypass on-disk caching so the test never touches the real .cache dir
    monkeypatch.setattr(export_web, "get_or_compute", lambda key, producer, *a, **k: producer())
    slate = [{"game_id": 1, "home": "AAA", "away": "BBB", "home_id": 10, "away_id": 20,
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {})  # no official -> projected
    monkeypatch.setattr(fetch, "get_recent_lineup", lambda tid, asof: [1, 2] if tid == 20 else [3, 4])
    monkeypatch.setattr(fetch, "get_player_meta", lambda pids: {p: {"name": str(p), "bats": "R", "throws": "R"} for p in pids})
    def fake_bat(pid, season):
        return [{"game_date": f"{season}-04-01", "events": "home_run", "launch_speed": 99.0}] * 5
    def fake_pit(pid, season):
        return [{"game_date": f"{season}-04-01", "events": "strikeout", "game_pk": 1}] * 10
    monkeypatch.setattr(fetch, "batter_events", fake_bat)
    monkeypatch.setattr(fetch, "pitcher_events", fake_pit)

    fns = export_web.make_profile_fns(slate, 2026, "2026-06-17")
    assert len(fns) == 4
    _, _, lineups_hist, pitcher_hist = fns
    lns = lineups_hist(slate[0])
    assert {"home", "away"} <= set(lns)
    assert lns["away"][0]["season_pa"] > 0   # blended profile built
    assert pitcher_hist(100)["k_per_bf"] > 0
