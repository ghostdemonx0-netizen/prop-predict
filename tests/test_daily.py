import json

from model import daily


def test_merge_day_replaces_same_date_rows(tmp_path):
    (tmp_path / "bat-events-100-2026.json").write_text(json.dumps([
        {"game_date": "2026-06-10", "events": "single", "launch_speed": 90.0},
        {"game_date": "2026-06-11", "events": "strikeout", "launch_speed": None},
    ]))
    day = [{"batter": 100, "pitcher": 200, "game_date": "2026-06-11",
            "events": "home_run", "launch_speed": 104.2, "game_pk": 9}]
    n = daily.merge_day_into_caches(day, cache_dir=tmp_path)
    assert n == 1  # pitcher 200 has no cache file -> skipped, not created
    rows = json.loads((tmp_path / "bat-events-100-2026.json").read_text())
    assert len(rows) == 2  # 06-10 kept, 06-11 replaced (not duplicated)
    assert {"game_date": "2026-06-11", "events": "home_run", "launch_speed": 104.2} in rows
    daily.merge_day_into_caches(day, cache_dir=tmp_path)  # idempotent
    assert len(json.loads((tmp_path / "bat-events-100-2026.json").read_text())) == 2


def test_merge_day_updates_pitcher_caches_with_game_pk(tmp_path):
    (tmp_path / "pit-events-200-2026.json").write_text("[]")
    day = [{"batter": 100, "pitcher": 200, "game_date": "2026-06-11",
            "events": "strikeout", "launch_speed": None, "game_pk": 9}]
    daily.merge_day_into_caches(day, cache_dir=tmp_path)
    rows = json.loads((tmp_path / "pit-events-200-2026.json").read_text())
    assert rows == [{"game_date": "2026-06-11", "events": "strikeout", "game_pk": 9}]


def test_update_events_first_run_pulls_yesterday(tmp_path):
    calls = []

    def fake_day(d):
        calls.append(d)
        return []

    out = daily.update_events("2026-06-12", fetch_day=fake_day, cache_dir=tmp_path)
    assert calls == ["2026-06-11"] and out == ["2026-06-11"]
    marker = json.loads((tmp_path / "events-updated-through.json").read_text())
    assert marker["date"] == "2026-06-11"


def test_update_events_walks_a_gap(tmp_path):
    (tmp_path / "events-updated-through.json").write_text(json.dumps({"date": "2026-06-08"}))
    calls = []
    daily.update_events("2026-06-12", fetch_day=lambda d: calls.append(d) or [], cache_dir=tmp_path)
    assert calls == ["2026-06-09", "2026-06-10", "2026-06-11"]


def test_update_events_noop_when_current(tmp_path):
    (tmp_path / "events-updated-through.json").write_text(json.dumps({"date": "2026-06-11"}))
    out = daily.update_events("2026-06-12", fetch_day=lambda d: 1 / 0, cache_dir=tmp_path)
    assert out == []


def test_update_events_big_gap_resets_caches(tmp_path):
    (tmp_path / "events-updated-through.json").write_text(json.dumps({"date": "2026-05-01"}))
    (tmp_path / "bat-events-1-2026.json").write_text("[]")
    (tmp_path / "pit-events-2-2026.json").write_text("[]")
    out = daily.update_events("2026-06-12", fetch_day=lambda d: 1 / 0, cache_dir=tmp_path)
    assert out == ["<cache-reset>"]
    assert not (tmp_path / "bat-events-1-2026.json").exists()
    assert not (tmp_path / "pit-events-2-2026.json").exists()
    marker = json.loads((tmp_path / "events-updated-through.json").read_text())
    assert marker["date"] == "2026-06-11"
