# Daily Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Actions refreshes the board automatically — 6 AM ET morning run (incremental stat update + first board), hourly touch-ups 10am–11pm ET with :30 extras 3–7pm, freeze-at-first-pitch, deploy-to-Vercel-only-when-changed — per the spec at `docs/superpowers/specs/2026-06-12-daily-automation-design.md`.

**Architecture:** All logic lives in two new tested Python modules — `model/daily.py` (incremental cache merge, freeze-merge `refresh_today`, early-exit signature) and `model/jobs.py` (thin `morning`/`refresh` orchestrators that emit `changed=` for CI) — plus retry hardening in `model/fetch.py`. Two dumb workflow YAMLs call the entrypoints and conditionally run `vercel deploy`. Crons ship **commented out**; they are enabled only after live `workflow_dispatch` verification (Task 9, interactive with the user).

**Tech Stack:** Python 3.12 (existing engine: pybaseball, MLB-StatsAPI, requests; stdlib zoneinfo), GitHub Actions (actions/checkout@v4, setup-python@v5, cache@v4), Vercel CLI via npx.

**Baseline:** suite currently 76 passed, 8 deselected (smoke). venv: `.venv/bin/python`. Branch: `daily-automation`. NEVER commit `web/public/data/*` (index.json is intentionally locally modified). Working dir: repo root `/Users/issiakadiawara/Projects/prop-predict`.

---

## File map

| File | Responsibility |
|---|---|
| `model/fetch.py` (modify) | + `_with_retries` backoff helper wired into weather/Statcast/BvP calls; + `statcast_day` league-wide one-day slim pull |
| `model/daily.py` (create) | `merge_day_into_caches`, `update_events` (marker + gap walk + big-gap reset), `refresh_today` (freeze-merge), `slate_signature`/`should_skip`/`record_run` |
| `model/jobs.py` (create) | `morning()`, `refresh()`, `today_et()`, `_clear_bvp()`, CLI `main` emitting `changed=` to stdout + `$GITHUB_OUTPUT` |
| `.github/workflows/morning.yml`, `refresh.yml` (create) | checkout → python+pip cache → restore `.cache/` → run job → deploy iff changed; concurrency group; crons commented |
| `tests/test_fetch_retry.py`, `tests/test_daily.py`, `tests/test_jobs.py` (create) | offline unit coverage; one new live smoke in `tests/test_fetch_smoke.py` |

---

### Task 1: Retry hardening in fetch

**Files:**
- Modify: `model/fetch.py` (add `import time`; new `_with_retries`; wrap `get_weather`, `batter_events`, `pitcher_events`, `get_bvp` internals)
- Test: `tests/test_fetch_retry.py` (create)

- [ ] **Step 1: Write the failing tests** — create `tests/test_fetch_retry.py`:

```python
import pytest


def test_with_retries_succeeds_after_transient_failures(monkeypatch):
    import model.fetch as fetch
    sleeps = []
    monkeypatch.setattr(fetch.time, "sleep", lambda s: sleeps.append(s))
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise TimeoutError("flake")
        return "ok"

    assert fetch._with_retries(flaky) == "ok"
    assert calls["n"] == 3
    assert sleeps == [2.0, 4.0]  # exponential backoff


def test_with_retries_raises_after_exhaustion(monkeypatch):
    import model.fetch as fetch
    monkeypatch.setattr(fetch.time, "sleep", lambda s: None)

    def always():
        raise ValueError("permanent")

    with pytest.raises(ValueError):
        fetch._with_retries(always)
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/python -m pytest tests/test_fetch_retry.py -q`
Expected: FAIL — `AttributeError: module 'model.fetch' has no attribute 'time'` (or `_with_retries` missing).

- [ ] **Step 3: Implement.** In `model/fetch.py`: add `import time` to the imports. Add after the `_abbr` helper:

```python
def _with_retries(producer, attempts: int = 3, base_delay: float = 2.0):
    """Run producer(), retrying transient failures with exponential backoff.

    Statcast/Open-Meteo flake under load (observed 2026-06-11/12: read
    timeouts, garbled CSVs, rate-limit handshake failures); a couple of
    spaced retries clears virtually all of it.
    """
    last = None
    for attempt in range(attempts):
        try:
            return producer()
        except Exception as e:  # network errors come in many shapes (requests, urllib3, pandas)
            last = e
            if attempt < attempts - 1:
                time.sleep(base_delay * (2 ** attempt))
    raise last
```

Wire it in (each is a small wrap, no behavior change on success):
- `get_weather`: wrap the whole existing body after the `target`/`date` lines in a closure — `def _pull(): resp = requests.get(...); resp.raise_for_status(); ...return {...}` then `return _with_retries(_pull)`. (Keep the exact params/parsing as-is inside `_pull`.)
- `batter_events`: `return _slim_records(_with_retries(lambda: statcast_batter(start, end, player_id)), _BATTER_EVENT_COLS)`
- `pitcher_events`: same pattern with `statcast_pitcher`.
- `get_bvp`: inside the existing `try`, replace `data = statsapi.get(...)` with `data = _with_retries(lambda: statsapi.get("people", {...}))` (same args; final failure still caught by the existing `except` → `None`).

- [ ] **Step 4: Run the full suite**

Run: `.venv/bin/python -m pytest -q`
Expected: 78 passed, 8 deselected.

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py tests/test_fetch_retry.py
git commit -m "feat: retry-with-backoff on weather/Statcast/BvP calls"
```

---

### Task 2: League-wide one-day Statcast pull

**Files:**
- Modify: `model/fetch.py` (import `statcast` from pybaseball; `_DAY_EVENT_COLS`; `statcast_day`)
- Test: `tests/test_fetch_retry.py` (append unit test), `tests/test_fetch_smoke.py` (append live smoke)

- [ ] **Step 1: Write the failing unit test** — append to `tests/test_fetch_retry.py`:

```python
def test_statcast_day_slims_and_is_json_safe(monkeypatch):
    import pandas as pd
    import model.fetch as fetch
    df = pd.DataFrame({
        "batter": [660271, 592450], "pitcher": [669373, 669373],
        "game_date": ["2026-06-11", "2026-06-11"],
        "events": ["home_run", None], "launch_speed": [108.4, float("nan")],
        "game_pk": [824001, 824001], "extra_col": ["x", "y"],
    })
    monkeypatch.setattr(fetch, "statcast", lambda start_dt, end_dt: df)
    rows = fetch.statcast_day("2026-06-11")
    assert rows[0] == {"batter": 660271, "pitcher": 669373, "game_date": "2026-06-11",
                       "events": "home_run", "launch_speed": 108.4, "game_pk": 824001}
    assert rows[1]["launch_speed"] is None and rows[1]["events"] is None
    assert "extra_col" not in rows[0]
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/python -m pytest tests/test_fetch_retry.py -q`
Expected: FAIL — `statcast_day` missing.

- [ ] **Step 3: Implement.** In `model/fetch.py`: change the pybaseball import to `from pybaseball import statcast, statcast_batter, statcast_pitcher`. Add near the other `_*_EVENT_COLS`:

```python
_DAY_EVENT_COLS = ["batter", "pitcher", "game_date", "events", "launch_speed", "game_pk"]


def statcast_day(date_str: str) -> list[dict]:
    """One calendar day of league-wide Statcast rows, slim columns only.

    The morning job appends this to the per-player event caches — one pull
    instead of ~500 per-player pulls.
    """
    df = _with_retries(lambda: statcast(start_dt=date_str, end_dt=date_str))
    return _slim_records(df, _DAY_EVENT_COLS)
```

(`_slim_records` already handles empty frames and NaN→None; calling `statcast` through the module-level name keeps it monkeypatchable.)

- [ ] **Step 4: Append the live smoke** to `tests/test_fetch_smoke.py` (file already has `pytestmark = pytest.mark.smoke`):

```python
def test_statcast_day_smoke():
    from model.fetch import statcast_day
    rows = statcast_day("2026-06-10")  # a completed league day
    assert len(rows) > 1000
    assert {"batter", "pitcher", "game_date", "events", "launch_speed", "game_pk"} <= set(rows[0])
```

- [ ] **Step 5: Run unit suite + the one smoke**

Run: `.venv/bin/python -m pytest -q` → expected 79 passed, 9 deselected.
Run: `.venv/bin/python -m pytest tests/test_fetch_smoke.py -q -k statcast_day -m smoke --override-ini "addopts="` → 1 passed (network; ~30–60s — the league-day pull is a few MB).

- [ ] **Step 6: Commit**

```bash
git add model/fetch.py tests/test_fetch_retry.py tests/test_fetch_smoke.py
git commit -m "feat: league-wide one-day Statcast pull for incremental cache updates"
```

---

### Task 3: `model/daily.py` — merge a day into the event caches

**Files:**
- Create: `model/daily.py`
- Test: `tests/test_daily.py` (create)

- [ ] **Step 1: Write the failing tests** — create `tests/test_daily.py`:

```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/python -m pytest tests/test_daily.py -q`
Expected: FAIL — `No module named 'model.daily'`.

- [ ] **Step 3: Create `model/daily.py`:**

```python
"""Daily automation logic: incremental stat updates, freeze-merge board
refresh, and the early-exit signature. Network fetchers and directories are
injectable so everything unit-tests offline.

History integrity rule: a date file is only ever touched on its own ET day;
past days keep their final pre-game state (the honest record the future
public pick log needs). model/backfill.py stays a manual dev tool.
"""

import datetime as dt
import hashlib
import json
from pathlib import Path

from model import export_web, fetch
from model.cache import DEFAULT_DIR, _safe
from model.pipeline import build_hr_rows, build_strikeout_rows, build_games

_MARKER = "events-updated-through.json"
_SIGNATURE = "last-signature.json"
_MAX_GAP_DAYS = 10

_BAT_KEYS = ("game_date", "events", "launch_speed")
_PIT_KEYS = ("game_date", "events", "game_pk")


def merge_day_into_caches(day_rows: list[dict], cache_dir=DEFAULT_DIR) -> int:
    """Append one day of league-wide slim Statcast rows into the existing
    per-player event caches. Idempotent: rows for that date are replaced.

    Players with NO cache file are skipped, never created — a partial cache
    would masquerade as a full season; they get a full pull on first
    appearance via the normal export path. Returns files updated.
    """
    cache_dir = Path(cache_dir)
    by_key: dict[str, list[dict]] = {}
    for r in day_rows:
        season = str(r["game_date"])[:4]
        if r.get("batter"):
            by_key.setdefault(f"bat-events-{int(r['batter'])}-{season}", []).append(
                {k: r.get(k) for k in _BAT_KEYS})
        if r.get("pitcher"):
            by_key.setdefault(f"pit-events-{int(r['pitcher'])}-{season}", []).append(
                {k: r.get(k) for k in _PIT_KEYS})
    updated = 0
    for key, rows in by_key.items():
        path = cache_dir / f"{_safe(key)}.json"
        if not path.exists():
            continue
        date = rows[0]["game_date"]
        kept = [e for e in json.loads(path.read_text()) if e["game_date"] != date]
        path.write_text(json.dumps(kept + rows))
        updated += 1
    return updated
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/python -m pytest tests/test_daily.py -q` → 2 passed.

- [ ] **Step 5: Commit**

```bash
git add model/daily.py tests/test_daily.py
git commit -m "feat: incremental merge of a league day into the event caches"
```

---

### Task 4: `update_events` — marker, gap walk, big-gap reset

**Files:**
- Modify: `model/daily.py`
- Test: `tests/test_daily.py` (append)

- [ ] **Step 1: Write the failing tests** — append to `tests/test_daily.py`:

```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/python -m pytest tests/test_daily.py -q` — 4 new FAIL (`update_events` missing).

- [ ] **Step 3: Implement** — append to `model/daily.py`:

```python
def update_events(today: str, *, fetch_day=None, cache_dir=DEFAULT_DIR) -> list[str]:
    """Bring the event caches up to date through yesterday (relative to the
    ET date ``today``). Walks any missed days; a gap beyond _MAX_GAP_DAYS
    deletes the event caches instead (players re-pull fully on demand —
    slow but automatic). Returns the list of dates ingested.
    """
    fetch_day = fetch_day or fetch.statcast_day
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    marker = cache_dir / _MARKER
    target = dt.date.fromisoformat(today) - dt.timedelta(days=1)
    start = target  # no marker -> just yesterday
    if marker.exists():
        last = dt.date.fromisoformat(json.loads(marker.read_text())["date"])
        if last >= target:
            return []
        start = last + dt.timedelta(days=1)
    if (target - start).days + 1 > _MAX_GAP_DAYS:
        for f in list(cache_dir.glob("bat-events-*.json")) + list(cache_dir.glob("pit-events-*.json")):
            f.unlink()
        marker.write_text(json.dumps({"date": target.isoformat()}))
        return ["<cache-reset>"]
    ingested: list[str] = []
    d = start
    while d <= target:
        merge_day_into_caches(fetch_day(d.isoformat()), cache_dir)
        ingested.append(d.isoformat())
        d += dt.timedelta(days=1)
    marker.write_text(json.dumps({"date": target.isoformat()}))
    return ingested
```

- [ ] **Step 4: Run** `.venv/bin/python -m pytest tests/test_daily.py -q` → 6 passed.

- [ ] **Step 5: Commit**

```bash
git add model/daily.py tests/test_daily.py
git commit -m "feat: update_events marker with gap walking and big-gap cache reset"
```

---

### Task 5: `refresh_today` — freeze-merge compute

**Files:**
- Modify: `model/daily.py`
- Test: `tests/test_daily.py` (append)

- [ ] **Step 1: Write the failing tests** — append to `tests/test_daily.py`:

```python
from tests.fixtures import SAMPLE_SLATE, SAMPLE_LINEUPS, SAMPLE_PITCHERS, SAMPLE_WEATHER


def _kw():
    return dict(
        profile_fns=(lambda g: SAMPLE_LINEUPS[1], lambda pid: SAMPLE_PITCHERS[pid]),
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
    # the game starts; recomputation must NOT touch its rows (inputs could differ now)
    kw = _kw()
    kw["profile_fns"] = (lambda g: 1 / 0, lambda pid: 1 / 0)  # would crash if recomputed
    changed = daily.refresh_today(
        "2026-06-10", schedule_fn=lambda d: [dict(SAMPLE_SLATE[0], started=True)], **kw)
    after = json.loads((tmp_path / "2026-06-10.json").read_text())
    assert changed is False  # identical content -> no rewrite, no deploy
    assert after["hr"] == before["hr"] and after["strikeouts"] == before["strikeouts"]


def test_refresh_today_mixes_frozen_and_fresh(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    g1 = dict(SAMPLE_SLATE[0])
    g2 = dict(SAMPLE_SLATE[0], game_id=2, home="NYY", away="BOS", park_team="NYY")
    lineups = {1: SAMPLE_LINEUPS[1], 2: SAMPLE_LINEUPS[1]}
    kw = _kw()
    kw["profile_fns"] = (lambda g: lineups[g["game_id"]], lambda pid: SAMPLE_PITCHERS[pid])
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
    daily.refresh_today("2026-06-10", schedule_fn=lambda d: [dict(SAMPLE_SLATE[0])], **_kw())
    changed = daily.refresh_today("2026-06-10", schedule_fn=lambda d: [], **_kw())
    assert changed is True
    data = json.loads((tmp_path / "2026-06-10.json").read_text())
    assert data["hr"] == [] and data["strikeouts"] == [] and data["games"] == []
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/python -m pytest tests/test_daily.py -q` — 5 new FAIL (`refresh_today` missing).

- [ ] **Step 3: Implement** — append to `model/daily.py`:

```python
def refresh_today(date_str: str, *, schedule_fn=None, profile_fns=None,
                  weather_fn=None, bvp_fn=None, starters_fn=None) -> bool:
    """Freeze-merge compute of today's board into export_web.DATA_DIR.

    Started games keep their rows from the existing date file untouched
    (frozen at the last pre-game compute); not-started games are recomputed
    fresh. Vanished never-started games drop. Writes the date file +
    latest.json + the rolling index ONLY when content (ignoring the
    ``updated`` stamp) actually changed; returns that changed flag, which
    drives the deploy-skip in CI.
    """
    schedule_fn = schedule_fn or fetch.get_schedule
    data_dir = Path(export_web.DATA_DIR)
    slate = schedule_fn(date_str)
    fresh_slate = [g for g in slate if not g.get("started")]
    started_ids = {g["game_id"] for g in slate if g.get("started")}

    path = data_dir / f"{date_str}.json"
    existing = json.loads(path.read_text()) if path.exists() else {}
    frozen = {
        "hr": [r for r in existing.get("hr", []) if r.get("game_id") in started_ids],
        "strikeouts": [r for r in existing.get("strikeouts", []) if r.get("game_id") in started_ids],
        "games": [r for r in existing.get("games", []) if r.get("game_id") in started_ids],
    }

    hr, ks, games = [], [], []
    if fresh_slate:
        (starters_fn or export_web._ensure_starters)(fresh_slate)
        lineups_fn, pitcher_fn = profile_fns or export_web.make_profile_fns(
            fresh_slate, int(date_str[:4]), date_str)
        wfn = weather_fn or fetch.make_weather_fn()
        bfn = bvp_fn or export_web.make_bvp_fn()
        hr = build_hr_rows(fresh_slate, lineups_fn, pitcher_fn, wfn, bvp_fn=bfn)
        ks = build_strikeout_rows(fresh_slate, pitcher_fn, lineups_fn, wfn, bvp_fn=bfn)
        games = build_games(fresh_slate, wfn)

    payload = {
        "date": date_str,
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "hr": sorted(hr + frozen["hr"], key=lambda r: r["probability"], reverse=True),
        "strikeouts": sorted(ks + frozen["strikeouts"], key=lambda r: r["over_prob"], reverse=True),
        "games": sorted(games + frozen["games"], key=lambda g: g["env"], reverse=True),
    }

    def _body(d: dict) -> str:
        return json.dumps({k: v for k, v in d.items() if k != "updated"}, sort_keys=True)

    if existing and _body(payload) == _body(existing):
        return False
    data_dir.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2)
    path.write_text(text)
    (data_dir / "latest.json").write_text(text)
    export_web._update_index(date_str)
    return True
```

- [ ] **Step 4: Run the full suite**

Run: `.venv/bin/python -m pytest -q` → expected 90 passed, 9 deselected.

- [ ] **Step 5: Commit**

```bash
git add model/daily.py tests/test_daily.py
git commit -m "feat: freeze-merge refresh_today with change detection"
```

---

### Task 6: Early-exit signature

**Files:**
- Modify: `model/daily.py`
- Test: `tests/test_daily.py` (append)

- [ ] **Step 1: Write the failing tests** — append to `tests/test_daily.py`:

```python
import datetime as dt


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
```

- [ ] **Step 2: Run to verify failure** — `.venv/bin/python -m pytest tests/test_daily.py -q`: 2 new FAIL.

- [ ] **Step 3: Implement** — append to `model/daily.py`:

```python
def slate_signature(slate: list[dict], lineups_by_game: dict) -> str:
    """Structural fingerprint of today: pitchers, lineups, started flags.

    Weather is deliberately excluded — forecast drift alone doesn't merit a
    republish more often than should_skip's freshness window.
    """
    snap = sorted(
        [g["game_id"], g.get("home_pitcher_id"), g.get("away_pitcher_id"),
         bool(g.get("started")),
         list(lineups_by_game.get(g["game_id"], {}).get("home", [])),
         list(lineups_by_game.get(g["game_id"], {}).get("away", []))]
        for g in slate
    )
    return hashlib.md5(json.dumps(snap).encode()).hexdigest()


def should_skip(sig: str, *, cache_dir=DEFAULT_DIR, max_age_min: int = 90, now=None) -> bool:
    """True when nothing structural changed AND we published recently."""
    path = Path(cache_dir) / _SIGNATURE
    if not path.exists():
        return False
    saved = json.loads(path.read_text())
    if saved.get("sig") != sig:
        return False
    now = now or dt.datetime.now(dt.timezone.utc)
    published = dt.datetime.fromisoformat(saved["published_at"])
    return (now - published) < dt.timedelta(minutes=max_age_min)


def record_run(sig: str, published: bool, *, cache_dir=DEFAULT_DIR, now=None) -> None:
    """Save the latest signature; published_at only advances on real publishes."""
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_dir / _SIGNATURE
    now = now or dt.datetime.now(dt.timezone.utc)
    prev = json.loads(path.read_text()).get("published_at") if path.exists() else None
    published_at = now.isoformat() if (published or not prev) else prev
    path.write_text(json.dumps({"sig": sig, "published_at": published_at}))
```

- [ ] **Step 4: Run** `.venv/bin/python -m pytest -q` → expected 92 passed, 9 deselected.

- [ ] **Step 5: Commit**

```bash
git add model/daily.py tests/test_daily.py
git commit -m "feat: early-exit signature (skip when nothing structural changed recently)"
```

---

### Task 7: `model/jobs.py` — orchestrators + CLI

**Files:**
- Create: `model/jobs.py`
- Test: `tests/test_jobs.py` (create)

- [ ] **Step 1: Write the failing tests** — create `tests/test_jobs.py`:

```python
import json


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
```

- [ ] **Step 2: Run to verify failure** — `.venv/bin/python -m pytest tests/test_jobs.py -q`: FAIL (`model.jobs` missing).

- [ ] **Step 3: Create `model/jobs.py`:**

```python
"""Automation entrypoints (GitHub Actions): python -m model.jobs morning|refresh

morning  - clear BvP pairs, bring stats up to date through yesterday,
           rebuild today's board, record the slate signature.
refresh  - cheap structural change-check (early exit), else recompute today.

Both print and (under Actions) emit changed=true|false to $GITHUB_OUTPUT so
the workflow only deploys when the board actually moved. Any exception
propagates -> nonzero exit -> GitHub failure email; the site keeps its last
good board.
"""

import datetime as dt
import os
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

from model import daily, fetch
from model.cache import DEFAULT_DIR


def today_et() -> str:
    """The slate date is the EASTERN date (a 1am UTC run belongs to yesterday ET)."""
    return dt.datetime.now(ZoneInfo("America/New_York")).date().isoformat()


def _clear_bvp(cache_dir=DEFAULT_DIR) -> int:
    """Career head-to-head moves daily for pairs that faced off; re-pulls are cheap."""
    n = 0
    for f in Path(cache_dir).glob("bvp-*.json"):
        f.unlink()
        n += 1
    return n


def _current_signature(date_str: str) -> str:
    slate = fetch.get_schedule(date_str)
    lineups = {g["game_id"]: fetch.get_lineups(g["game_id"])
               for g in slate if not g.get("started")}
    return daily.slate_signature(slate, lineups)


def _record_current_signature(date_str: str, published: bool) -> None:
    daily.record_run(_current_signature(date_str), published=published)


def morning(date_str: str | None = None) -> bool:
    date_str = date_str or today_et()
    print(f"bvp pairs cleared: {_clear_bvp()}")
    print(f"stat days ingested: {daily.update_events(date_str)}")
    changed = daily.refresh_today(date_str)
    _record_current_signature(date_str, published=changed)
    return changed


def refresh(date_str: str | None = None) -> bool:
    date_str = date_str or today_et()
    sig = _current_signature(date_str)
    if daily.should_skip(sig):
        print("no lineup/pitcher changes since last publish - skipping")
        daily.record_run(sig, published=False)
        return False
    changed = daily.refresh_today(date_str)
    daily.record_run(sig, published=changed)
    return changed


def main(argv: list[str]) -> None:
    mode = argv[0] if argv else "refresh"
    changed = morning() if mode == "morning" else refresh()
    flag = "true" if changed else "false"
    print(f"changed={flag}")
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"changed={flag}\n")


if __name__ == "__main__":
    main(sys.argv[1:])
```

- [ ] **Step 4: Run the full suite** — `.venv/bin/python -m pytest -q` → expected 98 passed, 9 deselected.

- [ ] **Step 5: Live one-shot sanity (network, ~1–3 min):**

Run: `.venv/bin/python -m model.jobs refresh`
Expected: either `no lineup/pitcher changes... skipping` + `changed=false`, or a compute ending `changed=true`. Then `git status --short web/public/data/` → only the intentionally-dirty `index.json`/`latest.json`/today's file may show modified; **do not commit them** (restore tracked samples if the live run changed them: `git checkout -- web/public/data/2026-06-10.json web/public/data/latest.json` — leave index.json as-is, it is intentionally locally modified).

- [ ] **Step 6: Commit**

```bash
git add model/jobs.py tests/test_jobs.py
git commit -m "feat: morning/refresh job entrypoints with changed-flag CI output"
```

---

### Task 8: Workflow files (crons commented out)

**Files:**
- Create: `.github/workflows/morning.yml`, `.github/workflows/refresh.yml`

- [ ] **Step 1: Create `.github/workflows/morning.yml`:**

```yaml
name: morning-board
on:
  workflow_dispatch: {}
  # Enabled in the final task after a successful manual dispatch run:
  # schedule:
  #   - cron: "0 10 * * *"   # 6:00 AM ET (EDT)
concurrency:
  group: refresh-board
  cancel-in-progress: false
permissions:
  contents: read
jobs:
  morning:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r requirements.txt
      - name: Restore engine cache
        uses: actions/cache@v4
        with:
          path: .cache
          key: engine-cache-${{ github.run_id }}
          restore-keys: engine-cache-
      - name: Compute board
        id: job
        run: python -m model.jobs morning
      - name: Publish to Vercel
        if: steps.job.outputs.changed == 'true'
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: npx vercel deploy --prod --cwd web --token ${{ secrets.VERCEL_TOKEN }} --yes
```

- [ ] **Step 2: Create `.github/workflows/refresh.yml`** (same body, different name/crons/timeout/entrypoint):

```yaml
name: refresh-board
on:
  workflow_dispatch: {}
  # Enabled in the final task after a successful manual dispatch run:
  # schedule:
  #   - cron: "0 14-23 * * *"   # hourly 10am-7pm ET (EDT)
  #   - cron: "0 0-3 * * *"     # hourly 8pm-11pm ET (EDT)
  #   - cron: "30 19-22 * * *"  # :30 extras 3:30-6:30pm ET (lineup rush)
concurrency:
  group: refresh-board
  cancel-in-progress: false
permissions:
  contents: read
jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r requirements.txt
      - name: Restore engine cache
        uses: actions/cache@v4
        with:
          path: .cache
          key: engine-cache-${{ github.run_id }}
          restore-keys: engine-cache-
      - name: Compute board
        id: job
        run: python -m model.jobs refresh
      - name: Publish to Vercel
        if: steps.job.outputs.changed == 'true'
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: npx vercel deploy --prod --cwd web --token ${{ secrets.VERCEL_TOKEN }} --yes
```

- [ ] **Step 3: Validate YAML parses**

Run: `.venv/bin/pip install -q pyyaml && .venv/bin/python -c "import yaml, glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]; print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 4: Run full suite once more** — `.venv/bin/python -m pytest -q` → same counts as Task 7.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/morning.yml .github/workflows/refresh.yml
git commit -m "feat: morning + refresh GitHub Actions workflows (dispatch-only; crons commented)"
```

---

### Task 9: INTERACTIVE — secrets, live verification, enable crons (controller + user, not a subagent)

This task talks to the user and touches live systems; the session controller executes it directly.

- [ ] **Step 1: Merge + push** (workflows must exist on the default branch for dispatch):

```bash
git checkout main && git merge daily-automation --no-edit && git push origin main
```

- [ ] **Step 2: Set the two ID secrets** from the existing link file:

```bash
python3 -c "import json; d = json.load(open('web/.vercel/project.json')); print(d['orgId']); print(d['projectId'])"
gh secret set VERCEL_ORG_ID --body "<orgId from above>"
gh secret set VERCEL_PROJECT_ID --body "<projectId from above>"
```

- [ ] **Step 3: User creates the deploy token.** Walk the user through: vercel.com → avatar → Account Settings → Tokens → Create ("prop-predict-robot", scope: the team `issiaka-diawara-s-projects`, no expiration or 1 year). Then have THEM run (so the token never passes through chat): `! gh secret set VERCEL_TOKEN` and paste the token at the hidden prompt.

- [ ] **Step 4: Dispatch a refresh run and watch it:**

```bash
gh workflow run refresh-board && sleep 10 && gh run list --workflow=refresh-board --limit 1
gh run watch $(gh run list --workflow=refresh-board --limit 1 --json databaseId -q '.[0].databaseId')
```

Expected: green. First run has a cold cache → it may take several minutes or legitimately compute. Verify the live site's "updated" stamp moved (user checks prop-predict.vercel.app while logged in) IF changed=true; a changed=false skip is also a pass.

- [ ] **Step 5: Dispatch a morning run** the same way (`gh workflow run morning-board`, watch). Expected green; output shows `bvp pairs cleared`, `stat days ingested`, `changed=...`.

- [ ] **Step 6: Enable the crons** — uncomment the `schedule:` blocks in both workflow files (exact lines shown in Task 8), commit on main, push:

```bash
git add .github/workflows/morning.yml .github/workflows/refresh.yml
git commit -m "feat: enable automation schedules (6am ET morning; hourly + rush-window refresh)"
git push origin main
```

- [ ] **Step 7: Observation period.** Tell the user: the robot is live; for the next 2–3 days spot-check the board and the updated stamp; GitHub emails on any failure; the unlock decision remains theirs. Update project memory (status + that crons are enabled + observation start date).

---

## Self-review notes

- **Spec coverage:** schedule (T8/T9), incremental stats (T2-T4), freeze-merge + history rule (T5), early-exit (T6, jobs wiring T7), deploy-iff-changed (T7 `changed=` + T8 `if:`), retries (T1), concurrency/no-overlap (T8 `concurrency`), failure emails (default behavior, noted T7 docstring), secrets (T9), budget (spec; enforced by early-exit + skip-deploy), rollout gating (crons commented T8 → enabled T9). No gaps.
- **Type consistency:** `merge_day_into_caches(day_rows, cache_dir)` / `update_events(today, *, fetch_day, cache_dir)` / `refresh_today(date_str, *, schedule_fn, profile_fns, weather_fn, bvp_fn, starters_fn)` / `slate_signature(slate, lineups_by_game)` / `should_skip(sig, *, cache_dir, max_age_min, now)` / `record_run(sig, published, *, cache_dir, now)` — used identically in jobs.py and all tests. `_clear_bvp(cache_dir=DEFAULT_DIR)` called bare in morning (default) and with tmp_path in tests.
- **Known acceptances:** postponed games read as "started" via `get_schedule` status logic → their last pre-game rows stay frozen on the board (harmless; noted in spec). Expected test counts are estimates — implementers report actuals; do not force counts.
