# Swingman True-Starts Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project a starting pitcher's strikeout line and expected batters-faced from his **true starts only**, so swingmen making a spot start aren't dragged down by their relief outings.

**Architecture:** A new `fetch.pitcher_gamelog` pull supplies the real `gamesStarted` flag per game; `pitcher_profile_from_events` (and its blended twin) gains an optional `started_game_pks` set that restricts the K-line + expected_bf computation to started games (with a generic-starter fallback under 2 starts); `make_profile_fns` wires the started set into `pitcher_fn` and `pitcher_hist_fn`.

**Tech Stack:** Python 3.12, pytest, MLB Stats API (`statsapi`). No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-28-swingman-true-starts-design.md`. **Model-math change** — constants signed off; don't invent new ones.
- Scope: **Strikeouts prop only.** Do not touch batter/run-prop code.
- Filter applies to **`k_line` and `expected_bf` only.** `k_per_bf`, `hit_allowed_rate`, `hr_allowed_rate`, `bf` stay computed from all appearances.
- `started_game_pks=None` MUST preserve today's exact behavior (back-compat + safe degradation).
- `MIN_TRUE_STARTS = 2`; fallback `k_line = 4.5`, `expected_bf = 24.0` (existing defaults).
- Current season only (matches how `expected_bf`/`k_line` already work).
- TDD; run from repo root with `uv run pytest`.

---

### Task 1: `fetch.pitcher_gamelog` — real start flag

**Files:**
- Modify: `model/fetch.py` (add after `batter_gamelog`, ~line 301)
- Test: `tests/test_fetch.py` (create if absent)

**Interfaces:**
- Produces: `pitcher_gamelog(player_id: int, season: int) -> list[dict]`, each `{"game_pk": int|None, "started": bool}`; `[]` on failure.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_fetch.py
from model import fetch

def test_pitcher_gamelog_parses_starts(monkeypatch):
    fake = {"people": [{"stats": [{"splits": [
        {"date": "2026-06-01", "game": {"gamePk": 111}, "stat": {"gamesStarted": 1}},
        {"date": "2026-06-05", "game": {"gamePk": 222}, "stat": {"gamesStarted": 0}},
    ]}]}]}
    monkeypatch.setattr(fetch.statsapi, "get", lambda *a, **k: fake)
    out = fetch.pitcher_gamelog(700, 2026)
    assert out == [{"game_pk": 111, "started": True}, {"game_pk": 222, "started": False}]

def test_pitcher_gamelog_empty_on_failure(monkeypatch):
    # malformed payload -> parsing raises -> [] (no slow retry path)
    monkeypatch.setattr(fetch.statsapi, "get", lambda *a, **k: {})
    assert fetch.pitcher_gamelog(700, 2026) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_fetch.py -k pitcher_gamelog -v`
Expected: FAIL with `AttributeError: module 'model.fetch' has no attribute 'pitcher_gamelog'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/fetch.py  (add after batter_gamelog)
def pitcher_gamelog(player_id: int, season: int) -> list[dict]:
    """Per-game start flag for one pitcher-season: [{game_pk, started}]."""
    try:
        data = _with_retries(lambda: statsapi.get("people", {
            "personIds": str(player_id),
            "hydrate": f"stats(group=[pitching],type=[gameLog],season={season},sportId=1)",
        }))
        splits = data["people"][0].get("stats", [{}])[0].get("splits", [])
    except Exception:
        return []
    out = []
    for sp in splits:
        st = sp.get("stat", {}) or {}
        game = sp.get("game", {}) or {}
        out.append({
            "game_pk": game.get("gamePk"),
            "started": int(st.get("gamesStarted", 0) or 0) >= 1,
        })
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_fetch.py -k pitcher_gamelog -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py tests/test_fetch.py
git commit -m "feat(swingman): pitcher_gamelog fetch for the real gamesStarted flag"
```

---

### Task 2: `pitcher_profile_from_events` filters to true starts

**Files:**
- Modify: `model/profiles.py:91-119` (`pitcher_profile_from_events`) + add `_MIN_TRUE_STARTS` constant
- Test: `tests/test_profiles.py` (append; create if absent)

**Interfaces:**
- Consumes (Task 1): nothing directly (takes a pre-built set).
- Produces: `pitcher_profile_from_events(events, *, as_of, player_id, name="", team="", throws="", k_line=4.5, started_game_pks: set|None=None) -> dict`. When `started_game_pks` is a set, `expected_bf` and `k_line` use started games only (fallback under `_MIN_TRUE_STARTS`).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_profiles.py
from model import profiles

def _ev(gp, n_bf, n_k):
    return [{"game_date": "2026-05-01",
             "events": "strikeout" if i < n_k else "field_out", "game_pk": gp}
            for i in range(n_bf)]

def _swingman_events():
    ev = []
    for gp in (1, 2, 3):       # 3 true starts: 20 BF, 6 K each
        ev += _ev(gp, 20, 6)
    for gp in (4, 5):          # 2 relief outings: 3 BF, 1 K each
        ev += _ev(gp, 3, 1)
    return ev

def test_pitcher_profile_filters_to_starts():
    prof = profiles.pitcher_profile_from_events(
        _swingman_events(), as_of="2026-06-01", player_id=1, started_game_pks={1, 2, 3})
    assert prof["expected_bf"] == 20.0   # 60 PA / 3 starts (NOT 66/5)
    assert prof["k_line"] == 5.5         # median 6 -> whole -> 5.5

def test_pitcher_profile_none_is_all_appearances():
    prof = profiles.pitcher_profile_from_events(
        _swingman_events(), as_of="2026-06-01", player_id=1)
    assert prof["expected_bf"] == 66 / 5  # all 5 games, unchanged behavior

def test_pitcher_profile_under_two_starts_falls_back():
    prof = profiles.pitcher_profile_from_events(
        _ev(1, 3, 1), as_of="2026-06-01", player_id=1, started_game_pks={1})
    assert prof["k_line"] == 4.5
    assert prof["expected_bf"] == 24.0

def test_pitcher_profile_rates_still_from_all_appearances():
    # k_per_bf is a rate, NOT workload -> computed over all PAs regardless of filter
    prof = profiles.pitcher_profile_from_events(
        _swingman_events(), as_of="2026-06-01", player_id=1, started_game_pks={1, 2, 3})
    assert abs(prof["k_per_bf"] - (20 / 66)) < 1e-9   # 18 start K + 2 relief K = 20 over 66 PA
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_profiles.py -k pitcher_profile -v`
Expected: FAIL (`TypeError: ... unexpected keyword argument 'started_game_pks'`)

- [ ] **Step 3: Write minimal implementation**

Add the constant near the top of `model/profiles.py` (with the other module constants):

```python
_MIN_TRUE_STARTS = 2
```

Replace the body of `pitcher_profile_from_events` (keep everything above the `return`, change the signature and add the workload block):

```python
def pitcher_profile_from_events(events: list[dict], *, as_of: str, player_id: int,
                                name: str = "", team: str = "", throws: str = "",
                                k_line: float = 4.5, started_game_pks: set | None = None) -> dict:
    """events: [{game_date, events, game_pk}, ...] for one pitcher-season.

    started_game_pks: when provided, k_line + expected_bf use only those games
    (true starts); fewer than _MIN_TRUE_STARTS -> generic-starter fallback.
    None -> all appearances (unchanged behavior / safe degradation).
    """
    past = [e for e in events if e["game_date"] < as_of]
    pa_rows = [e for e in past if e["events"]]
    pa = len(pa_rows)
    ks = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)
    hr = sum(1 for e in pa_rows if e["events"] == "home_run")
    ks_by_game: dict = {e["game_pk"]: 0 for e in past if e["game_pk"] is not None}
    for e in pa_rows:
        if e["game_pk"] is not None and e["events"] in _K_EVENTS:
            ks_by_game[e["game_pk"]] += 1

    # Workload (expected_bf) + k_line: true starts only when a started set is given.
    if started_game_pks is not None:
        start_ks = {gp: k for gp, k in ks_by_game.items() if gp in started_game_pks}
        start_pa = sum(1 for e in pa_rows if e["game_pk"] in started_game_pks)
        if len(start_ks) >= _MIN_TRUE_STARTS:
            expected_bf = start_pa / len(start_ks)
            line = k_line_from_starts(list(start_ks.values()), fallback=k_line)
        else:
            expected_bf = 24.0
            line = k_line     # generic-starter default (4.5)
    else:
        games = len(ks_by_game)
        expected_bf = (pa / games) if games else 24.0
        line = k_line_from_starts(list(ks_by_game.values()), fallback=k_line)

    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "throws": throws,
        "k_per_bf": (ks / pa) if pa else 0.0,
        "expected_bf": expected_bf,
        "opponent_k_mult": 1.0,
        "k_line": line,
        "hit_allowed_rate": (hits / pa) if pa else 0.0,
        "hr_allowed_rate": (hr / pa) if pa else 0.0,
        "bf": pa,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_profiles.py -k pitcher_profile -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/profiles.py tests/test_profiles.py
git commit -m "feat(swingman): pitcher_profile_from_events filters k_line/expected_bf to true starts"
```

---

### Task 3: Thread the started set through `blended_pitcher_profile`

**Files:**
- Modify: `model/profiles.py:179-194` (`blended_pitcher_profile`)
- Test: `tests/test_profiles.py`

**Interfaces:**
- Consumes (Task 2): `pitcher_profile_from_events(..., started_game_pks=...)`
- Produces: `blended_pitcher_profile(events_by_season, *, as_of, current_season, player_id, name="", throws="", started_game_pks: set|None=None) -> dict`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_profiles.py  (append)
def test_blended_pitcher_profile_passes_started_set():
    by_season = {2026: _swingman_events(), 2025: [], 2024: []}
    prof = profiles.blended_pitcher_profile(
        by_season, as_of="2026-06-01", current_season=2026, player_id=1,
        started_game_pks={1, 2, 3})
    # workload comes from current season's true starts (60 PA / 3 starts)
    assert prof["expected_bf"] == 20.0
    assert prof["k_line"] == 5.5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_profiles.py -k blended_pitcher_profile_passes_started -v`
Expected: FAIL (`TypeError: ... unexpected keyword argument 'started_game_pks'`)

- [ ] **Step 3: Write minimal implementation**

```python
# model/profiles.py  — update signature + the internal call
def blended_pitcher_profile(events_by_season: dict, *, as_of: str, current_season: int,
                            player_id: int, name: str = "", throws: str = "",
                            started_game_pks: set | None = None) -> dict:
    """Same shape as pitcher_profile_from_events but with k_per_bf/hit_allowed_rate/
    hr_allowed_rate blended+regressed. expected_bf, k_line, bf come from the current season only."""
    # workload (expected_bf), k_line, bf come from the CURRENT season only
    prof = pitcher_profile_from_events(events_by_season.get(current_season, []), as_of=as_of,
                                       player_id=player_id, name=name, throws=throws,
                                       started_game_pks=started_game_pks)
```

(Leave the rest of the function — the marcel_blend rate overrides — unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_profiles.py -k blended_pitcher_profile_passes_started -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/profiles.py tests/test_profiles.py
git commit -m "feat(swingman): thread started set through blended_pitcher_profile"
```

---

### Task 4: Wire the started set into `pitcher_fn` + `pitcher_hist_fn`

**Files:**
- Modify: `model/export_web.py` (`make_profile_fns`: add `_started_set` helper; pass it in `pitcher_fn` and `pitcher_hist_fn`)
- Test: `tests/test_export_web.py`

**Interfaces:**
- Consumes (Tasks 1–3): `fetch.pitcher_gamelog`, `pitcher_profile_from_events(started_game_pks=)`, `blended_pitcher_profile(started_game_pks=)`
- Produces: `pitcher_fn(pid)` / `pitcher_hist_fn(pid)` now project workload from true starts.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_export_web.py  (append)
def test_pitcher_fn_uses_true_starts(monkeypatch):
    from model import export_web, fetch
    slate = [{"game_id": 1, "home": "AAA", "away": "BBB", "home_id": 10, "away_id": 20,
              "started": False, "home_pitcher_id": 700, "away_pitcher_id": 701}]
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {"home": [], "away": []})
    monkeypatch.setattr(fetch, "get_recent_lineup", lambda tid, d, **k: [])
    monkeypatch.setattr(fetch, "get_player_meta", lambda ids: {700: {"name": "Swing", "throws": "R"}})

    ev = []
    for gp in (1, 2, 3):       # 3 starts: 20 BF, 6 K
        ev += [{"game_date": "2026-05-01", "events": "strikeout" if i < 6 else "field_out", "game_pk": gp} for i in range(20)]
    for gp in (4, 5):          # 2 relief: 3 BF, 1 K
        ev += [{"game_date": "2026-05-01", "events": "strikeout" if i < 1 else "field_out", "game_pk": gp} for i in range(3)]
    gl = [{"game_pk": gp, "started": True} for gp in (1, 2, 3)] + [{"game_pk": gp, "started": False} for gp in (4, 5)]

    def goc(key, prod):
        if key.startswith("pit-events"):
            return ev
        if key.startswith("pit-gamelog"):
            return gl
        return prod()
    monkeypatch.setattr(export_web, "get_or_compute", goc)

    _, pitcher_fn, _, _ = export_web.make_profile_fns(slate, 2026, "2026-06-01")
    prof = pitcher_fn(700)
    assert prof["expected_bf"] == 20.0   # starts-only (NOT 66/5 = 13.2)
    assert prof["k_line"] == 5.5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_export_web.py -k pitcher_fn_uses_true_starts -v`
Expected: FAIL (`expected_bf` == 13.2, the all-appearances value)

- [ ] **Step 3: Write minimal implementation**

In `model/export_web.py` `make_profile_fns`, add the helper near `_events_by_season` (so both fns can use it):

```python
    def _started_set(pid: int):
        gl = get_or_compute(f"pit-gamelog-{pid}-{season}", lambda: fetch.pitcher_gamelog(pid, season))
        if not gl or not isinstance(gl, list) or "started" not in (gl[0] or {}):
            return None   # unavailable / wrong shape -> all-appearances (safe)
        return {g["game_pk"] for g in gl if g.get("started") and g.get("game_pk") is not None}
```

Update `pitcher_fn` (add the `started_game_pks` argument to its `pitcher_profile_from_events` call):

```python
    def pitcher_fn(pid: int) -> dict:
        m = meta.get(pid, {})
        events = get_or_compute(f"pit-events-{pid}-{season}", lambda: fetch.pitcher_events(pid, season))
        prof = profiles.pitcher_profile_from_events(
            events, as_of=as_of, player_id=pid, name=m.get("name", str(pid)),
            throws=m.get("throws", "R"), started_game_pks=_started_set(pid))
        prof["pitcher_status"] = pitcher_status.get(pid, "confirmed")
        return prof
```

Update `pitcher_hist_fn` similarly:

```python
    def pitcher_hist_fn(pid: int) -> dict:
        m = meta.get(pid, {})
        prof = profiles.blended_pitcher_profile(_events_by_season(pid, "pit"), as_of=as_of,
                                                current_season=season, player_id=pid,
                                                name=m.get("name", str(pid)), throws=m.get("throws", "R"),
                                                started_game_pks=_started_set(pid))
        prof["pitcher_status"] = pitcher_status.get(pid, "confirmed")
        return prof
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_export_web.py -k pitcher_fn_uses_true_starts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/export_web.py tests/test_export_web.py
git commit -m "feat(swingman): wire true-starts set into pitcher_fn and pitcher_hist_fn"
```

---

### Task 5: Full-suite regression

**Files:** whole suite

- [ ] **Step 1: Run the full suite**

Run: `uv run pytest -q`
Expected: PASS. Existing strikeout/pipeline tests use pre-built `SAMPLE_PITCHERS` profiles (bypassing `pitcher_profile_from_events`) and direct `pitcher_profile_from_events` calls pass no `started_game_pks` (→ unchanged). If any test that drives the real `pitcher_fn` via a monkeypatched `get_or_compute` now hits the `pit-gamelog` key, confirm the `_started_set` guard returns `None` for its fixture (so behavior is unchanged) — adjust that test's fake `get_or_compute` only if needed.

- [ ] **Step 2: Commit any test adjustments**

```bash
git add -A
git commit -m "test(swingman): adjust fixtures for pitcher gamelog wiring"
```

---

## Self-Review

- **Spec coverage:** §3a gamelog fetch (Task 1) · §3b started-set filter + min-2 fallback (Task 2) · §3c wiring into pitcher_fn + pitcher_hist_fn (Task 4) · blended twin pass-through (Task 3) · §4 edge cases (Tasks 2 & 4 tests: starts-only, <2 fallback, None safe-degradation, rates-from-all) · §5 constants (Task 2) · §6 no recorder change (nothing added) · §7 testing (all tasks). Covered.
- **Placeholders:** none — full code in every step.
- **Type consistency:** `started_game_pks: set|None`, `pitcher_gamelog -> list[{game_pk,started}]`, `_started_set -> set|None`, `_MIN_TRUE_STARTS=2` used identically across Tasks 1–4.

## Notes for the implementer
- If `tests/test_fetch.py` / `tests/test_profiles.py` don't exist, create them; otherwise append.
- Only `k_line` and `expected_bf` change with the filter — `k_per_bf`, `hit_allowed_rate`, `hr_allowed_rate`, `bf` stay over all appearances (Task 2 has a test pinning this).
- The `_started_set` guard (`"started" not in gl[0]`) is what keeps existing board-building tests green when their fake `get_or_compute` doesn't supply a pitcher gamelog.
