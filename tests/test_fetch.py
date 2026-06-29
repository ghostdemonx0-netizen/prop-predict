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


# --- batter_spray (corner-wind data layer) ---
import pandas as pd


def test_batter_spray_buckets_by_side(monkeypatch):
    df = pd.DataFrame([
        {"stand": "R", "events": "home_run", "launch_angle": 28, "hc_x": 80, "hc_y": 90, "game_date": "2026-05-01"},
        {"stand": "R", "events": "single", "launch_angle": 5, "hc_x": 125, "hc_y": 120, "game_date": "2026-05-02"},
    ])
    monkeypatch.setattr(fetch, "statcast_batter", lambda s, e, pid: df)
    monkeypatch.setattr(fetch, "_with_retries", lambda fn: fn())
    out = fetch.batter_spray(700, 2026)
    assert out["R"]["overall"]["n"] == 2
    assert out["R"]["hr"]["n"] == 1
    assert out["R"]["hr"]["pull"] == 1       # the HR was pulled (LF for RHB)
    assert out["R"]["air"]["n"] >= 1         # launch_angle>=10 ball counted as air


def test_batter_spray_empty_on_failure(monkeypatch):
    monkeypatch.setattr(fetch, "statcast_batter", lambda s, e, pid: (_ for _ in ()).throw(RuntimeError()))
    monkeypatch.setattr(fetch, "_with_retries", lambda fn: fn())
    assert fetch.batter_spray(700, 2026) == {}
