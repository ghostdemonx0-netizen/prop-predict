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
