from model.cache import get_or_compute


def test_computes_then_caches(tmp_path):
    calls = {"n": 0}

    def producer():
        calls["n"] += 1
        return {"v": 42}

    a = get_or_compute("k1", producer, cache_dir=tmp_path)
    b = get_or_compute("k1", producer, cache_dir=tmp_path)
    assert a == {"v": 42}
    assert b == {"v": 42}
    assert calls["n"] == 1  # second call served from cache, producer not re-run


def test_distinct_keys_are_independent(tmp_path):
    get_or_compute("a", lambda: {"v": 1}, cache_dir=tmp_path)
    out = get_or_compute("b", lambda: {"v": 2}, cache_dir=tmp_path)
    assert out == {"v": 2}
