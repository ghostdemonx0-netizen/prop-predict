from model import backfill_history, fetch


def test_prime_prior_seasons_warms_two_years(monkeypatch):
    # bypass on-disk caching so the test never touches the real .cache dir
    monkeypatch.setattr(backfill_history, "get_or_compute", lambda key, producer, *a, **k: producer())
    calls = []
    monkeypatch.setattr(fetch, "batter_events", lambda pid, yr: calls.append((pid, yr)) or [])
    n = backfill_history.prime_prior_seasons([1, 2], 2026, batter=True)
    assert n == 4  # 2 players x 2 prior seasons
    assert set(calls) == {(1, 2025), (1, 2024), (2, 2025), (2, 2024)}
