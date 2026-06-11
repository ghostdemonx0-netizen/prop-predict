import json


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
    (tmp_path / "2026-06-01.json").write_text("{}")     # date file outside new window
    (tmp_path / "schema.json").write_text("{}")          # stray non-date json
    export_web._update_index("2026-06-11")
    idx = json.loads((tmp_path / "index.json").read_text())
    assert idx["dates"] == ["2026-06-11"]
    assert not (tmp_path / "2026-06-01.json").exists()  # pruned (outside window)
    assert (tmp_path / "schema.json").exists()           # non-date json never deleted
    assert (tmp_path / "latest.json").exists()
