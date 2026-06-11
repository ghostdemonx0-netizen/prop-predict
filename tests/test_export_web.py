import json


def test_attach_bvp_annotates_rows_and_handles_missing_ids(monkeypatch):
    from model import export_web, fetch

    fake_bvp = {"pa": 17, "ab": 17, "hits": 7, "hr": 2, "k": 5, "avg": ".412"}

    # make get_or_compute just call the producer directly (no disk cache)
    monkeypatch.setattr(export_web, "get_or_compute", lambda key, fn: fn())
    # make fetch.get_bvp return our known dict for known ids
    monkeypatch.setattr(fetch, "get_bvp", lambda b, p: fake_bvp if (b and p) else None)

    hr_rows = [
        {"player_id": 592450, "vs": {"player_id": 669373, "name": "Test Pitcher"}},
        {"player_id": None, "vs": {"player_id": 669373, "name": "Test Pitcher"}},  # missing batter id
        {"player_id": 592450, "vs": None},  # no vs
    ]
    k_rows = [
        {
            "player_id": 669373,
            "matchups": [
                {"player_id": 592450, "name": "Test Batter"},
                {"player_id": None, "name": "Unknown"},
            ],
        },
        {"player_id": 669373, "matchups": []},  # empty lineup
    ]

    export_web._attach_bvp(hr_rows, k_rows)

    # HR row with both ids → bvp attached
    assert hr_rows[0]["vs"]["bvp"] == fake_bvp
    # HR row with missing batter id → None
    assert hr_rows[1]["vs"]["bvp"] is None
    # HR row with no vs → unchanged (no bvp key on None)
    assert hr_rows[2]["vs"] is None

    # K matchup with both ids → bvp attached
    assert k_rows[0]["matchups"][0]["bvp"] == fake_bvp
    # K matchup with missing batter id → None
    assert k_rows[0]["matchups"][1]["bvp"] is None


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
