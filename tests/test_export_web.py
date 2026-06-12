import json


def test_make_bvp_fn_caches_and_handles_missing_ids(monkeypatch):
    from model import export_web
    calls = []
    monkeypatch.setattr(export_web, "get_or_compute", lambda key, producer: producer())
    monkeypatch.setattr(export_web.fetch, "get_bvp", lambda b, p: calls.append((b, p)) or {"pa": 3, "ab": 3, "hits": 1, "hr": 0, "k": 1, "avg": ".333"})
    fn = export_web.make_bvp_fn()
    assert fn(1, 2)["pa"] == 3
    assert fn(None, 2) is None and fn(1, None) is None
    assert calls == [(1, 2)]


def test_update_index_caps_at_seven_and_prunes_old_files(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    (tmp_path / "latest.json").write_text("{}")
    for day in range(1, 10):  # nine consecutive days
        d = f"2026-06-{day:02d}"
        (tmp_path / f"{d}.json").write_text("{}")
        export_web._update_index(d)
    idx = json.loads((tmp_path / "index.json").read_text())
    # newest 7 only, newest first
    assert idx["dates"] == [f"2026-06-{day:02d}" for day in range(9, 2, -1)]
    # files that fell out of the window are deleted; the rest survive
    assert not (tmp_path / "2026-06-01.json").exists()
    assert not (tmp_path / "2026-06-02.json").exists()
    assert (tmp_path / "2026-06-03.json").exists()
    assert (tmp_path / "2026-06-09.json").exists()
    # latest.json and index.json are never pruned
    assert (tmp_path / "latest.json").exists()
    assert (tmp_path / "index.json").exists()


def test_update_index_corrupt_index_resets_and_prunes_only_date_files(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    (tmp_path / "index.json").write_text("NOT JSON{{{")
    (tmp_path / "latest.json").write_text("{}")
    # 7 recent date files fill the window; 2026-06-01 is the 8th so it's pruned
    for day in range(5, 12):  # 2026-06-05 through 2026-06-11
        (tmp_path / f"2026-06-{day:02d}.json").write_text("{}")
    (tmp_path / "2026-06-01.json").write_text("{}")     # date file outside new window
    (tmp_path / "schema.json").write_text("{}")          # stray non-date json
    export_web._update_index("2026-06-11")
    idx = json.loads((tmp_path / "index.json").read_text())
    assert idx["dates"] == [f"2026-06-{day:02d}" for day in range(11, 4, -1)]
    assert not (tmp_path / "2026-06-01.json").exists()  # pruned (outside window)
    assert (tmp_path / "schema.json").exists()           # non-date json never deleted
    assert (tmp_path / "latest.json").exists()


def test_update_index_self_heals_orphaned_date_files(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    # an orphan written by a crashed run, never indexed
    (tmp_path / "2026-06-09.json").write_text("{}")
    (tmp_path / "2026-06-10.json").write_text("{}")
    export_web._update_index("2026-06-10")
    idx = json.loads((tmp_path / "index.json").read_text())
    assert idx["dates"] == ["2026-06-10", "2026-06-09"]  # orphan re-entered
