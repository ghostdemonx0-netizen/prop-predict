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
