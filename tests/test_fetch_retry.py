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
