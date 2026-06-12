import pytest


def test_with_retries_succeeds_after_transient_failures(monkeypatch):
    import model.fetch as fetch
    sleeps = []
    monkeypatch.setattr(fetch.time, "sleep", lambda s: sleeps.append(s))
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise TimeoutError("flake")
        return "ok"

    assert fetch._with_retries(flaky) == "ok"
    assert calls["n"] == 3
    assert sleeps == [2.0, 4.0]  # exponential backoff


def test_with_retries_raises_after_exhaustion(monkeypatch):
    import model.fetch as fetch
    monkeypatch.setattr(fetch.time, "sleep", lambda s: None)

    def always():
        raise ValueError("permanent")

    with pytest.raises(ValueError):
        fetch._with_retries(always)


def test_statcast_day_slims_and_is_json_safe(monkeypatch):
    import pandas as pd
    import model.fetch as fetch
    df = pd.DataFrame({
        "batter": [660271, 592450], "pitcher": [669373, 669373],
        "game_date": ["2026-06-11", "2026-06-11"],
        "events": ["home_run", None], "launch_speed": [108.4, float("nan")],
        "game_pk": [824001, 824001], "extra_col": ["x", "y"],
    })
    monkeypatch.setattr(fetch, "statcast", lambda start_dt, end_dt: df)
    rows = fetch.statcast_day("2026-06-11")
    assert rows[0] == {"batter": 660271, "pitcher": 669373, "game_date": "2026-06-11",
                       "events": "home_run", "launch_speed": 108.4, "game_pk": 824001}
    assert rows[1]["launch_speed"] is None and rows[1]["events"] is None
    assert "extra_col" not in rows[0]
