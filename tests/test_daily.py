import datetime as dt
import json

from model import daily
from tests.fixtures import SAMPLE_SLATE, SAMPLE_LINEUPS, SAMPLE_PITCHERS, SAMPLE_WEATHER


def _kw():
    return dict(
        profile_fns=(lambda g: SAMPLE_LINEUPS[1], lambda pid: SAMPLE_PITCHERS[pid],
                     lambda g: SAMPLE_LINEUPS[1], lambda pid: SAMPLE_PITCHERS[pid]),
        weather_fn=lambda g: SAMPLE_WEATHER[1],
        bvp_fn=lambda b, p: None,
        starters_fn=lambda slate: None,
    )


def test_refresh_today_first_run_writes_board(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    changed = daily.refresh_today("2026-06-10", schedule_fn=lambda d: [dict(SAMPLE_SLATE[0])], **_kw())
    assert changed is True
    data = json.loads((tmp_path / "2026-06-10.json").read_text())
    assert len(data["hr"]) == 2 and len(data["strikeouts"]) == 2 and len(data["games"]) == 1
    assert (tmp_path / "latest.json").exists()
    assert json.loads((tmp_path / "index.json").read_text())["dates"] == ["2026-06-10"]


def test_refresh_today_unchanged_inputs_return_false_and_do_not_rewrite(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    sched = lambda d: [dict(SAMPLE_SLATE[0])]
    daily.refresh_today("2026-06-10", schedule_fn=sched, **_kw())
    stamp_before = json.loads((tmp_path / "2026-06-10.json").read_text())["updated"]
    changed = daily.refresh_today("2026-06-10", schedule_fn=sched, **_kw())
    assert changed is False
    assert json.loads((tmp_path / "2026-06-10.json").read_text())["updated"] == stamp_before


def test_refresh_today_freezes_started_games(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    daily.refresh_today("2026-06-10", schedule_fn=lambda d: [dict(SAMPLE_SLATE[0])], **_kw())
    before = json.loads((tmp_path / "2026-06-10.json").read_text())
    # the game starts; its rows must be carried untouched (crash if recomputed)
    kw = _kw()
    kw["profile_fns"] = (lambda g: 1 / 0, lambda pid: 1 / 0,
                         lambda g: 1 / 0, lambda pid: 1 / 0)
    sched = lambda d: [dict(SAMPLE_SLATE[0], started=True)]
    changed = daily.refresh_today("2026-06-10", schedule_fn=sched, **kw)
    after = json.loads((tmp_path / "2026-06-10.json").read_text())
    assert changed is True  # one write to persist started_ids
    assert after["started_ids"] == [1]
    assert after["hr"] == before["hr"] and after["strikeouts"] == before["strikeouts"]
    # the 3 run props (Runs/RBI/HRR) must freeze too — regression guard for the
    # freeze-list bug where they were dropped from started games' rows
    assert before["runs"] and before["rbi"] and before["hrr"], "sample build should produce run-prop rows"
    assert after["runs"] == before["runs"]
    assert after["rbi"] == before["rbi"]
    assert after["hrr"] == before["hrr"]
    # subsequent identical run: no churn
    assert daily.refresh_today("2026-06-10", schedule_fn=sched, **kw) is False


def test_refresh_today_mixes_frozen_and_fresh(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    g1 = dict(SAMPLE_SLATE[0])
    g2 = dict(SAMPLE_SLATE[0], game_id=2, home="NYY", away="BOS", park_team="NYY")
    lineups = {1: SAMPLE_LINEUPS[1], 2: SAMPLE_LINEUPS[1]}
    kw = _kw()
    kw["profile_fns"] = (lambda g: lineups[g["game_id"]], lambda pid: SAMPLE_PITCHERS[pid],
                         lambda g: lineups[g["game_id"]], lambda pid: SAMPLE_PITCHERS[pid])
    daily.refresh_today("2026-06-10", schedule_fn=lambda d: [g1], **kw)
    snap = [r for r in json.loads((tmp_path / "2026-06-10.json").read_text())["hr"] if r["game_id"] == 1]
    changed = daily.refresh_today(
        "2026-06-10", schedule_fn=lambda d: [dict(g1, started=True), g2], **kw)
    assert changed is True
    data = json.loads((tmp_path / "2026-06-10.json").read_text())
    assert {r["game_id"] for r in data["hr"]} == {1, 2}
    assert [r for r in data["hr"] if r["game_id"] == 1] == snap  # frozen, byte-identical


def test_refresh_today_drops_vanished_never_started_games(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    g1 = dict(SAMPLE_SLATE[0])
    g2 = dict(SAMPLE_SLATE[0], game_id=2, home="NYY", away="BOS", park_team="NYY")
    lineups = {1: SAMPLE_LINEUPS[1], 2: SAMPLE_LINEUPS[1]}
    kw = _kw()
    kw["profile_fns"] = (lambda g: lineups[g["game_id"]], lambda pid: SAMPLE_PITCHERS[pid],
                         lambda g: lineups[g["game_id"]], lambda pid: SAMPLE_PITCHERS[pid])
    daily.refresh_today("2026-06-10", schedule_fn=lambda d: [g1, g2], **kw)
    # g1 (never started) vanishes from a NON-empty schedule -> its rows drop
    changed = daily.refresh_today("2026-06-10", schedule_fn=lambda d: [g2], **kw)
    assert changed is True
    data = json.loads((tmp_path / "2026-06-10.json").read_text())
    assert {r["game_id"] for r in data["hr"]} == {2}


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
    # No marker -> no gap_start, so start = window_start = target - 2 days (trailing 3).
    # today=2026-06-12 -> target=06-11 -> window pulls 06-09, 06-10, 06-11.
    calls = []

    def fake_day(d):
        calls.append(d)
        return []

    out = daily.update_events("2026-06-12", fetch_day=fake_day, cache_dir=tmp_path)
    assert calls == ["2026-06-09", "2026-06-10", "2026-06-11"]
    assert out == ["2026-06-09", "2026-06-10", "2026-06-11"]
    marker = json.loads((tmp_path / "events-updated-through.json").read_text())
    assert marker["date"] == "2026-06-11"


def test_update_events_walks_a_gap(tmp_path):
    # marker=06-08, today=06-12 -> gap_start=06-09, window_start=06-09 -> same result.
    (tmp_path / "events-updated-through.json").write_text(json.dumps({"date": "2026-06-08"}))
    calls = []
    daily.update_events("2026-06-12", fetch_day=lambda d: calls.append(d) or [], cache_dir=tmp_path)
    assert calls == ["2026-06-09", "2026-06-10", "2026-06-11"]


def test_update_events_normal_daily_advance_repulls_window(tmp_path):
    # marker=06-10, today=06-12 -> target=06-11, gap_start=06-11,
    # window_start=06-09 -> min(06-11, 06-09)=06-09 -> pulls 06-09,06-10,06-11.
    (tmp_path / "events-updated-through.json").write_text(json.dumps({"date": "2026-06-10"}))
    calls = []
    out = daily.update_events("2026-06-12", fetch_day=lambda d: calls.append(d) or [], cache_dir=tmp_path)
    assert calls == ["2026-06-09", "2026-06-10", "2026-06-11"]
    assert out == ["2026-06-09", "2026-06-10", "2026-06-11"]
    marker = json.loads((tmp_path / "events-updated-through.json").read_text())
    assert marker["date"] == "2026-06-11"


def test_update_events_noop_when_current(tmp_path):
    # marker >= target -> once-per-day throttle, fetch_day must NOT be called.
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


def test_update_events_self_heal_repulls_previous_day(tmp_path):
    # marker=06-10, today=06-12 -> the window starts at 06-09, so 06-10
    # (already ingested) gets re-pulled alongside 06-11 (new day).
    # This self-heals a day that was grabbed before Baseball Savant settled.
    (tmp_path / "events-updated-through.json").write_text(json.dumps({"date": "2026-06-10"}))
    calls = []
    out = daily.update_events("2026-06-12", fetch_day=lambda d: calls.append(d) or [], cache_dir=tmp_path)
    # 06-10 re-pulled even though marker said it was done; 06-09 also in window.
    assert "2026-06-10" in out
    assert "2026-06-11" in out
    # After this run the throttle prevents a second fold-in for today.
    out2 = daily.update_events("2026-06-12", fetch_day=lambda d: 1 / 0, cache_dir=tmp_path)
    assert out2 == []


def test_signature_reacts_to_lineups_and_skip_window(tmp_path):
    slate = [{"game_id": 1, "home_pitcher_id": 10, "away_pitcher_id": 11, "started": False}]
    s1 = daily.slate_signature(slate, {1: {"home": [1, 2], "away": [3]}})
    s2 = daily.slate_signature(slate, {1: {"home": [1, 2, 4], "away": [3]}})
    s3 = daily.slate_signature([dict(slate[0], started=True)], {1: {"home": [1, 2], "away": [3]}})
    assert s1 != s2 and s1 != s3
    now = dt.datetime(2026, 6, 12, 18, 0, tzinfo=dt.timezone.utc)
    daily.record_run(s1, published=True, cache_dir=tmp_path, now=now)
    assert daily.should_skip(s1, cache_dir=tmp_path, now=now + dt.timedelta(minutes=30)) is True
    assert daily.should_skip(s2, cache_dir=tmp_path, now=now + dt.timedelta(minutes=30)) is False
    assert daily.should_skip(s1, cache_dir=tmp_path, now=now + dt.timedelta(minutes=120)) is False
    assert daily.should_skip(s1, cache_dir=tmp_path / "empty", now=now) is False


def test_record_run_unpublished_keeps_published_at(tmp_path):
    t0 = dt.datetime(2026, 6, 12, 18, 0, tzinfo=dt.timezone.utc)
    daily.record_run("a", published=True, cache_dir=tmp_path, now=t0)
    daily.record_run("a", published=False, cache_dir=tmp_path, now=t0 + dt.timedelta(minutes=60))
    saved = json.loads((tmp_path / "last-signature.json").read_text())
    assert saved["published_at"] == t0.isoformat()


def test_refresh_today_empty_schedule_never_wipes_existing_record(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    daily.refresh_today("2026-06-10", schedule_fn=lambda d: [dict(SAMPLE_SLATE[0])], **_kw())
    before = (tmp_path / "2026-06-10.json").read_text()
    assert daily.refresh_today("2026-06-10", schedule_fn=lambda d: [], **_kw()) is False
    assert (tmp_path / "2026-06-10.json").read_text() == before


def test_refresh_today_remembers_started_through_partial_schedule(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    g1 = dict(SAMPLE_SLATE[0])
    g2 = dict(SAMPLE_SLATE[0], game_id=2, home="NYY", away="BOS", park_team="NYY")
    lineups = {1: SAMPLE_LINEUPS[1], 2: SAMPLE_LINEUPS[1]}
    kw = _kw()
    kw["profile_fns"] = (lambda g: lineups[g["game_id"]], lambda pid: SAMPLE_PITCHERS[pid],
                         lambda g: lineups[g["game_id"]], lambda pid: SAMPLE_PITCHERS[pid])
    daily.refresh_today("2026-06-10", schedule_fn=lambda d: [g1, g2], **kw)
    daily.refresh_today("2026-06-10", schedule_fn=lambda d: [dict(g1, started=True), g2], **kw)
    g1_rows = [r for r in json.loads((tmp_path / "2026-06-10.json").read_text())["hr"] if r["game_id"] == 1]
    # flaky hour: g1 (started, frozen) missing from an otherwise-valid schedule
    daily.refresh_today("2026-06-10", schedule_fn=lambda d: [g2], **kw)
    data = json.loads((tmp_path / "2026-06-10.json").read_text())
    assert [r for r in data["hr"] if r["game_id"] == 1] == g1_rows  # survived
    assert data["started_ids"] == [1]


def test_should_skip_and_record_run_survive_corrupt_signature_file(tmp_path):
    (tmp_path / "last-signature.json").write_text("NOT JSON{{{")
    assert daily.should_skip("abc", cache_dir=tmp_path) is False  # never crash
    daily.record_run("abc", published=True, cache_dir=tmp_path)   # overwrites garbage
    saved = json.loads((tmp_path / "last-signature.json").read_text())
    assert saved["sig"] == "abc"
