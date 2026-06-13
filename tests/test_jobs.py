import pytest


def test_clear_bvp_only_touches_bvp_files(tmp_path):
    from model import jobs
    (tmp_path / "bvp-1-2.json").write_text("{}")
    (tmp_path / "bat-events-1-2026.json").write_text("[]")
    assert jobs._clear_bvp(tmp_path) == 1
    assert (tmp_path / "bat-events-1-2026.json").exists()
    assert not (tmp_path / "bvp-1-2.json").exists()


def test_refresh_skips_when_signature_fresh(monkeypatch):
    from model import jobs, daily, fetch
    monkeypatch.setattr(fetch, "get_schedule", lambda d: [])
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {"home": [], "away": []})
    monkeypatch.setattr(daily, "update_events", lambda d: [])  # already current -> no-op
    monkeypatch.setattr(daily, "should_skip", lambda sig: True)
    recorded = {}
    monkeypatch.setattr(daily, "record_run", lambda sig, published: recorded.update(p=published))
    monkeypatch.setattr(daily, "refresh_today", lambda d: 1 / 0)  # must NOT be called
    assert jobs.refresh("2026-06-12") is False
    assert recorded["p"] is False


def test_refresh_computes_when_signature_stale(monkeypatch):
    from model import jobs, daily, fetch
    monkeypatch.setattr(fetch, "get_schedule", lambda d: [])
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {"home": [], "away": []})
    monkeypatch.setattr(daily, "update_events", lambda d: [])  # already current -> no-op
    monkeypatch.setattr(daily, "should_skip", lambda sig: False)
    recorded = {}
    monkeypatch.setattr(daily, "record_run", lambda sig, published: recorded.update(p=published))
    monkeypatch.setattr(daily, "refresh_today", lambda d: True)
    assert jobs.refresh("2026-06-12") is True
    assert recorded["p"] is True


def test_morning_runs_full_pipeline_in_order(monkeypatch):
    from model import jobs, daily
    seq = []
    monkeypatch.setattr(jobs, "_clear_bvp", lambda: seq.append("bvp") or 0)
    monkeypatch.setattr(daily, "update_events", lambda d: seq.append("events") or [])
    monkeypatch.setattr(daily, "refresh_today", lambda d: seq.append("board") or True)
    monkeypatch.setattr(jobs, "_record_current_signature", lambda d, published: seq.append("sig"))
    assert jobs.morning("2026-06-12") is True
    assert seq == ["bvp", "events", "board", "sig"]


def test_main_emits_github_output(monkeypatch, tmp_path):
    from model import jobs
    monkeypatch.setattr(jobs, "refresh", lambda: True)
    out = tmp_path / "out.txt"
    monkeypatch.setenv("GITHUB_OUTPUT", str(out))
    jobs.main(["refresh"])
    assert "changed=true" in out.read_text()


def test_today_et_is_a_date_string():
    from model import jobs
    assert len(jobs.today_et()) == 10  # YYYY-MM-DD


def test_main_rejects_unknown_mode():
    from model import jobs
    with pytest.raises(SystemExit):
        jobs.main(["lunch"])


def test_refresh_compute_advances_freshness_even_when_unchanged(monkeypatch):
    from model import jobs, daily, fetch
    monkeypatch.setattr(fetch, "get_schedule", lambda d: [])
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {"home": [], "away": []})
    monkeypatch.setattr(daily, "update_events", lambda d: [])  # already current -> no-op
    monkeypatch.setattr(daily, "should_skip", lambda sig: False)
    recorded = {}
    monkeypatch.setattr(daily, "record_run", lambda sig, published: recorded.update(p=published))
    monkeypatch.setattr(daily, "refresh_today", lambda d: False)  # computed, found no change
    assert jobs.refresh("2026-06-12") is False
    assert recorded["p"] is True  # freshness window still advances


def test_refresh_runs_stat_update_and_clears_bvp_on_new_day(monkeypatch):
    from model import jobs, daily, fetch
    monkeypatch.setattr(fetch, "get_schedule", lambda d: [])
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {"home": [], "away": []})
    monkeypatch.setattr(daily, "update_events", lambda d: ["2026-06-12"])  # a new day folded in
    cleared = {"n": 0}
    monkeypatch.setattr(jobs, "_clear_bvp", lambda: cleared.update(n=1) or 1)
    # even though the slate signature would say "skip", new stats force a rebuild
    monkeypatch.setattr(daily, "should_skip", lambda sig: True)
    monkeypatch.setattr(daily, "refresh_today", lambda d: True)
    monkeypatch.setattr(daily, "record_run", lambda sig, published: None)
    assert jobs.refresh("2026-06-13") is True
    assert cleared["n"] == 1  # bvp cleared on the new day


def test_refresh_skips_normally_when_stats_already_current(monkeypatch):
    from model import jobs, daily, fetch
    monkeypatch.setattr(fetch, "get_schedule", lambda d: [])
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {"home": [], "away": []})
    monkeypatch.setattr(daily, "update_events", lambda d: [])  # already current -> no-op
    monkeypatch.setattr(jobs, "_clear_bvp", lambda: 1 / 0)  # must NOT be called
    monkeypatch.setattr(daily, "should_skip", lambda sig: True)
    monkeypatch.setattr(daily, "refresh_today", lambda d: 1 / 0)  # must NOT rebuild
    recorded = {}
    monkeypatch.setattr(daily, "record_run", lambda sig, published: recorded.update(p=published))
    assert jobs.refresh("2026-06-13") is False
    assert recorded["p"] is False


def test_refresh_survives_stat_update_failure(monkeypatch):
    from model import jobs, daily, fetch
    monkeypatch.setattr(fetch, "get_schedule", lambda d: [])
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {"home": [], "away": []})
    def boom(d):
        raise TimeoutError("statcast down")
    monkeypatch.setattr(daily, "update_events", boom)
    monkeypatch.setattr(daily, "should_skip", lambda sig: False)
    monkeypatch.setattr(daily, "refresh_today", lambda d: True)
    monkeypatch.setattr(daily, "record_run", lambda sig, published: None)
    # board still rebuilds on existing stats; the failed fold-in doesn't crash the run
    assert jobs.refresh("2026-06-13") is True
