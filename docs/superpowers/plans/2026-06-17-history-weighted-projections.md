# History-Weighted Projections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Current season only / History-weighted (3-yr)" toggle that swaps each player's baseline skill rates for a Marcel-style 5/4/3 blend of the last 3 seasons, while leaving every situational factor and current-season-only behavior unchanged.

**Architecture:** A new pure blend module produces normalized blended counts and regressed rates. A blended profile builder reuses the existing per-season event counting plus prior-season event caches. The export computes BOTH modes and merges history twins (`*_hist` fields) into the same board JSON; the frontend toggle just chooses which field to read. Current-season-only mode stays byte-for-byte unchanged.

**Tech Stack:** Python 3.12 (pure functions + pytest), Next.js 16 / React / TypeScript frontend, on-disk JSON event caches under `.cache/`.

## Global Constraints

- **Current-season-only mode must stay byte-for-byte unchanged** — no edits to `hr_probability`, `matchup`, `expected_strikeouts`, `batter_profile_from_events`, `pitcher_profile_from_events`, or the current-mode export output. History mode is purely additive.
- **Season weights:** `(5, 4, 3)` for (current, last year, two years ago), positional.
- **Regression constants (history mode only):** HR & HR-allowed `R=300` toward `0.033`; K & K-allowed `R=200` toward `0.225`; hit & hit-allowed `R=200` toward `0.22`.
- **League rates (existing constants):** `LEAGUE_HR_RATE=0.033` (`model/projections.py`), `LEAGUE_K=0.225`, `LEAGUE_HIT=0.22` (`model/matchup.py`).
- **No lookahead:** current-season counts respect the `as_of` strictly-before filter already in `profiles.py`.
- **Frontend default:** toggle defaults to **Current**. Reading a missing `*_hist` field falls back to the current value.
- **Per task:** TDD (failing test first), then spec-review + quality-review subagents before moving on, matching prior builds.

---

## Review gate (MANDATORY after every task)

No task is "done" — and the next task does NOT start — until **both** reviewer subagents pass. This is non-negotiable and applies to all 10 tasks:

1. **Implementer subagent** builds the task (TDD steps), commits.
2. **Spec-review subagent** (fresh, independent): verifies the task meets THIS plan + the design spec — correct files, exact field names (`probability_hist`, `over_prob_hist`, `expected_ks_hist`, `k_prob_hist`, `hit_prob_hist`, `lean_hist`, `prob_hist`), weights `(5,4,3)`, regression constants (HR/HR-allowed 300; K/hit/K-allowed/hit-allowed 200), and — critically — that **current-season-only mode output is byte-for-byte unchanged**. Verdict: ✅/❌ with file:line issues.
3. **Quality-review subagent** (fresh, independent): adversarially checks correctness, edge cases (zero-PA seasons, rookies, missing prior year, frozen rows lacking `*_hist`), test quality (tests actually exercise the behavior, not tautologies), no regressions in the full suite. Verdict: ✅/❌ with severity-tagged issues.
4. If either reviewer returns ❌ or any Critical/Important issue → fix, then **re-run both reviewers** on the fix. Only when both are ✅ does the next task begin.

The two reviewers must be **separate dispatches from the implementer** (independent context), so they genuinely double-check rather than rubber-stamp.

---

### Task 1: Pure blend module (`model/blend.py`)

**Files:**
- Create: `model/blend.py`
- Test: `tests/test_blend.py`

**Interfaces:**
- Produces: `WEIGHTS: tuple[int,int,int] = (5,4,3)`; `marcel_blend(per_season: list[tuple[float,float]], weights=WEIGHTS) -> tuple[float,float]` (per_season positional [current, y-1, y-2], each `(made, pa)`; returns normalized `(effective_made, effective_pa)`); `regress(made: float, pa: float, league_rate: float, r: float) -> float` (regressed rate).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_blend.py
import math
from model.blend import marcel_blend, regress, WEIGHTS

def test_weights_are_543():
    assert WEIGHTS == (5, 4, 3)

def test_blend_normalizes_by_top_weight():
    # 3 full seasons: 30/600 each. W_made=12*30=360, W_pa=12*600=7200; /5 -> 72, 1440
    made, pa = marcel_blend([(30, 600), (30, 600), (30, 600)])
    assert math.isclose(made, 72.0)
    assert math.isclose(pa, 1440.0)

def test_blend_recency_weighting():
    # current 10/200, last 30/600, twoAgo 25/600
    made, pa = marcel_blend([(10, 200), (30, 600), (25, 600)])
    # W_made=5*10+4*30+3*25=245; W_pa=5*200+4*600+3*600=5200; /5
    assert math.isclose(made, 49.0)
    assert math.isclose(pa, 1040.0)
    assert math.isclose(made / pa, 245 / 5200)

def test_blend_missing_season_contributes_zero():
    # only current + two-years-ago (last year missing -> (0,0))
    made, pa = marcel_blend([(10, 200), (0, 0), (25, 600)])
    # W_made=5*10+3*25=125; W_pa=5*200+3*600=2800; /5
    assert math.isclose(made, 25.0)
    assert math.isclose(pa, 560.0)

def test_blend_no_data_returns_zeros():
    assert marcel_blend([(0, 0), (0, 0), (0, 0)]) == (0.0, 0.0)

def test_regress_pulls_thin_sample_toward_league():
    # 0 made in 0 pa -> exactly league
    assert math.isclose(regress(0, 0, 0.033, 300), 0.033)

def test_regress_big_sample_barely_moves():
    # 72 HR in 1440 PA (5.0%), R=300 toward 3.3%
    r = regress(72, 1440, 0.033, 300)
    assert math.isclose(r, (72 + 0.033 * 300) / (1440 + 300))
    assert 0.044 < r < 0.047  # close to observed 5%, lightly pulled down
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_blend.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'model.blend'`

- [ ] **Step 3: Write the implementation**

```python
# model/blend.py
"""Pure Marcel-style multi-season blend math (history-weighted mode).

Combines a player's real per-season totals with recency weights, normalized
to a single-season-equivalent so the model's existing regression constants
apply unchanged. See docs/superpowers/specs/2026-06-17-history-weighted-projections-design.md.
"""

WEIGHTS = (5, 4, 3)  # (current season, last year, two years ago), positional


def marcel_blend(per_season: list[tuple[float, float]], weights: tuple = WEIGHTS) -> tuple[float, float]:
    """Weighted blend of (made, pa) across seasons, normalized by the top weight.

    per_season is positional and aligned to ``weights`` (index 0 = current
    season). Missing seasons pass (0, 0). Returns (effective_made,
    effective_pa) on a single-season-equivalent scale; (0.0, 0.0) if no PAs.
    """
    w_made = sum(w * made for w, (made, _) in zip(weights, per_season))
    w_pa = sum(w * pa for w, (_, pa) in zip(weights, per_season))
    if w_pa <= 0:
        return (0.0, 0.0)
    top = weights[0]
    return (w_made / top, w_pa / top)


def regress(made: float, pa: float, league_rate: float, r: float) -> float:
    """Rate regressed toward league average with ``r`` phantom league PAs."""
    denom = pa + r
    if denom <= 0:
        return league_rate
    return (made + league_rate * r) / denom
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_blend.py -v`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
git add model/blend.py tests/test_blend.py
git commit -m "feat: pure Marcel blend module (marcel_blend + regress)"
```

---

### Task 2: Blended profiles (`model/profiles.py`)

**Files:**
- Modify: `model/profiles.py` (add two functions + a small shared counter; do NOT change existing functions)
- Test: `tests/test_blended_profiles.py`

**Interfaces:**
- Consumes: `model.blend.marcel_blend`, `regress`; existing `batter_profile_from_events`, `pitcher_profile_from_events`.
- Produces:
  - `blended_batter_profile(events_by_season: dict[int, list[dict]], *, as_of: str, current_season: int, player_id: int, name: str = "", bats: str = "") -> dict` — same shape as `batter_profile_from_events` but with `season_hr`/`season_pa` = normalized blended HR counts and `k_rate`/`hit_rate` = blended+regressed rates; `recent_form_mult`, `name`, `bats` come from the current season only.
  - `blended_pitcher_profile(events_by_season: dict[int, list[dict]], *, as_of: str, current_season: int, player_id: int, name: str = "", throws: str = "") -> dict` — same shape as `pitcher_profile_from_events` but with `k_per_bf`/`hit_allowed_rate`/`hr_allowed_rate` blended+regressed; `expected_bf`, `k_line`, `bf` come from the current season only.

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_blended_profiles.py
import math
from model.profiles import blended_batter_profile, blended_pitcher_profile

def _bat_events(n_pa, n_hr, n_k, n_hit, date):
    rows = []
    for i in range(n_pa):
        ev = "home_run" if i < n_hr else ("strikeout" if i < n_hr + n_k else ("single" if i < n_hr + n_k + n_hit else "field_out"))
        rows.append({"game_date": date, "events": ev, "launch_speed": 90.0})
    return rows

def test_blended_batter_blends_hr_across_seasons():
    ebs = {
        2026: _bat_events(200, 10, 40, 50, "2026-04-01"),
        2025: _bat_events(600, 30, 120, 150, "2025-06-01"),
        2024: _bat_events(600, 25, 120, 150, "2024-06-01"),
    }
    p = blended_batter_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=1, name="X", bats="R")
    # season_hr/season_pa are the normalized blend (W/5): 49 HR / 1040 PA
    assert math.isclose(p["season_hr"], 49.0)
    assert math.isclose(p["season_pa"], 1040.0)
    # k_rate is regressed toward LEAGUE_K (0.225), R=200
    blended_k = (5*40 + 4*120 + 3*120) / 5      # effective K made
    assert math.isclose(p["k_rate"], (blended_k + 0.225*200) / (1040 + 200))

def test_blended_batter_rookie_only_current():
    ebs = {2026: _bat_events(100, 5, 20, 25, "2026-04-01"), 2025: [], 2024: []}
    p = blended_batter_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=2, name="R", bats="L")
    # only current contributes; normalized by top weight 5 -> same counts
    assert math.isclose(p["season_hr"], 5.0)
    assert math.isclose(p["season_pa"], 100.0)

def test_blended_pitcher_keeps_current_workload_blends_rates():
    def _pit(n_pa, n_k, date, gp):
        return [{"game_date": date, "events": ("strikeout" if i < n_k else "field_out"),
                 "game_pk": gp + (i % 2)} for i in range(n_pa)]
    ebs = {2026: _pit(120, 30, "2026-04-01", 100), 2025: _pit(600, 180, "2025-06-01", 200), 2024: _pit(600, 150, "2024-06-01", 300)}
    p = blended_pitcher_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=3, name="P", throws="R")
    blended_k = (5*30 + 4*180 + 3*150) / 5
    blended_pa = (5*120 + 4*600 + 3*600) / 5
    assert math.isclose(p["k_per_bf"], (blended_k + 0.225*200) / (blended_pa + 200))
    # bf/expected_bf reflect CURRENT season only (120 PA), not the blend
    assert p["bf"] == 120
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_blended_profiles.py -v`
Expected: FAIL with `ImportError: cannot import name 'blended_batter_profile'`

- [ ] **Step 3: Write the implementation**

Add to `model/profiles.py` (top: extend imports):

```python
from model.blend import marcel_blend, regress
from model.projections import LEAGUE_HR_RATE
from model.matchup import LEAGUE_K, LEAGUE_HIT

_HR_R, _K_R, _HIT_R = 300.0, 200.0, 200.0


def _count_batter(events: list[dict], as_of: str) -> tuple[int, int, int, int]:
    """(pa, hr, ks, hits) strictly before as_of — same rules as batter_profile_from_events."""
    pa_rows = [e for e in events if e["game_date"] < as_of and e["events"]]
    pa = len(pa_rows)
    hr = sum(1 for e in pa_rows if e["events"] == "home_run")
    ks = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)
    return pa, hr, ks, hits


def _seasons_in_order(events_by_season: dict, current_season: int) -> list:
    return [events_by_season.get(current_season - i, []) for i in range(3)]


def blended_batter_profile(events_by_season: dict, *, as_of: str, current_season: int,
                           player_id: int, name: str = "", bats: str = "") -> dict:
    # recent form + metadata come from the CURRENT season only (stays live)
    prof = batter_profile_from_events(events_by_season.get(current_season, []), as_of=as_of,
                                      player_id=player_id, name=name, bats=bats)
    seasons = _seasons_in_order(events_by_season, current_season)
    counts = [_count_batter(evs, as_of) for evs in seasons]   # [(pa,hr,ks,hits), ...]
    hr_made, eff_pa = marcel_blend([(c[1], c[0]) for c in counts])
    ks_made, _ = marcel_blend([(c[2], c[0]) for c in counts])
    hits_made, _ = marcel_blend([(c[3], c[0]) for c in counts])
    prof["season_hr"] = hr_made          # HR regression stays inside hr_probability (R=300)
    prof["season_pa"] = eff_pa
    prof["k_rate"] = regress(ks_made, eff_pa, LEAGUE_K, _K_R)
    prof["hit_rate"] = regress(hits_made, eff_pa, LEAGUE_HIT, _HIT_R)
    return prof


def _count_pitcher(events: list[dict], as_of: str) -> tuple[int, int, int, int]:
    """(pa, ks, hits, hr) strictly before as_of."""
    pa_rows = [e for e in events if e["game_date"] < as_of and e["events"]]
    pa = len(pa_rows)
    ks = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)
    hr = sum(1 for e in pa_rows if e["events"] == "home_run")
    return pa, ks, hits, hr


def blended_pitcher_profile(events_by_season: dict, *, as_of: str, current_season: int,
                            player_id: int, name: str = "", throws: str = "") -> dict:
    # workload (expected_bf), k_line, bf come from the CURRENT season only
    prof = pitcher_profile_from_events(events_by_season.get(current_season, []), as_of=as_of,
                                       player_id=player_id, name=name, throws=throws)
    seasons = _seasons_in_order(events_by_season, current_season)
    counts = [_count_pitcher(evs, as_of) for evs in seasons]   # [(pa,ks,hits,hr), ...]
    ks_made, eff_pa = marcel_blend([(c[1], c[0]) for c in counts])
    hits_made, _ = marcel_blend([(c[2], c[0]) for c in counts])
    hr_made, _ = marcel_blend([(c[3], c[0]) for c in counts])
    prof["k_per_bf"] = regress(ks_made, eff_pa, LEAGUE_K, _K_R)
    prof["hit_allowed_rate"] = regress(hits_made, eff_pa, LEAGUE_HIT, _HIT_R)
    prof["hr_allowed_rate"] = regress(hr_made, eff_pa, LEAGUE_HR_RATE, _HR_R)
    return prof
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_blended_profiles.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add model/profiles.py tests/test_blended_profiles.py
git commit -m "feat: blended multi-season batter/pitcher profiles (history mode)"
```

---

### Task 3: History profile fns in the export (`model/export_web.py`)

**Files:**
- Modify: `model/export_web.py` (`make_profile_fns` — add history fns; share lineup resolution)
- Test: `tests/test_export_history_fns.py`

**Interfaces:**
- Consumes: `model.profiles.blended_batter_profile`, `blended_pitcher_profile`; `fetch.batter_events`, `fetch.pitcher_events`; `model.cache.get_or_compute`.
- Produces: `make_profile_fns(...)` now returns a 4-tuple `(lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn)`. The two `_hist` fns return blended profiles; lineup membership + statuses are identical to the current fns.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_export_history_fns.py
from model import export_web, fetch

def test_make_profile_fns_returns_history_pair(monkeypatch):
    # bypass on-disk caching so the test never touches the real .cache dir
    monkeypatch.setattr(export_web, "get_or_compute", lambda key, producer, *a, **k: producer())
    slate = [{"game_id": 1, "home": "AAA", "away": "BBB", "home_id": 10, "away_id": 20,
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {})  # no official -> projected
    monkeypatch.setattr(fetch, "get_recent_lineup", lambda tid, asof: [1, 2] if tid == 20 else [3, 4])
    monkeypatch.setattr(fetch, "get_player_meta", lambda pids: {p: {"name": str(p), "bats": "R", "throws": "R"} for p in pids})
    def fake_bat(pid, season):
        return [{"game_date": f"{season}-04-01", "events": "home_run", "launch_speed": 99.0}] * 5
    def fake_pit(pid, season):
        return [{"game_date": f"{season}-04-01", "events": "strikeout", "game_pk": 1}] * 10
    monkeypatch.setattr(fetch, "batter_events", fake_bat)
    monkeypatch.setattr(fetch, "pitcher_events", fake_pit)

    fns = export_web.make_profile_fns(slate, 2026, "2026-06-17")
    assert len(fns) == 4
    _, _, lineups_hist, pitcher_hist = fns
    lns = lineups_hist(slate[0])
    assert {"home", "away"} <= set(lns)
    assert lns["away"][0]["season_pa"] > 0   # blended profile built
    assert pitcher_hist(100)["k_per_bf"] > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_export_history_fns.py -v`
Expected: FAIL (`make_profile_fns` returns 2-tuple → unpack/len error)

- [ ] **Step 3: Implement** — in `model/export_web.py`, inside `make_profile_fns`, after the existing `batter_fn`/`pitcher_fn`/`lineups_fn`, add history variants and widen the return. Replace the `return lineups_fn, pitcher_fn` line:

```python
    def _events_by_season(pid: int, kind: str) -> dict:
        fetcher = fetch.batter_events if kind == "bat" else fetch.pitcher_events
        prefix = "bat-events" if kind == "bat" else "pit-events"
        return {yr: get_or_compute(f"{prefix}-{pid}-{yr}", lambda yr=yr: fetcher(pid, yr))
                for yr in (season, season - 1, season - 2)}

    def batter_hist_fn(pid: int, status: str) -> dict:
        m = meta.get(pid, {})
        prof = profiles.blended_batter_profile(_events_by_season(pid, "bat"), as_of=as_of,
                                               current_season=season, player_id=pid,
                                               name=m.get("name", str(pid)), bats=m.get("bats", "R"))
        prof["lineup_status"] = status
        return prof

    def pitcher_hist_fn(pid: int) -> dict:
        m = meta.get(pid, {})
        prof = profiles.blended_pitcher_profile(_events_by_season(pid, "pit"), as_of=as_of,
                                                current_season=season, player_id=pid,
                                                name=m.get("name", str(pid)), throws=m.get("throws", "R"))
        prof["pitcher_status"] = pitcher_status.get(pid, "confirmed")
        return prof

    def lineups_hist_fn(game: dict) -> dict:
        lns = lineup_cache[game["game_id"]]
        return {
            "home": [batter_hist_fn(pid, game.get("home_lineup_status", "confirmed")) for pid in lns["home"]],
            "away": [batter_hist_fn(pid, game.get("away_lineup_status", "confirmed")) for pid in lns["away"]],
        }

    return lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m pytest tests/test_export_history_fns.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/export_web.py tests/test_export_history_fns.py
git commit -m "feat: history (blended) profile fns alongside current in make_profile_fns"
```

---

### Task 4: Merge history twins into the board (`model/export_web.py`)

**Files:**
- Modify: `model/export_web.py` (new `build_board_with_history(...)`; use it in `main`)
- Modify: `model/daily.py` (`refresh_today` uses the new helper + 4-tuple)
- Test: `tests/test_history_merge.py`

**Interfaces:**
- Consumes: `pipeline.build_hr_rows`, `build_strikeout_rows`; the 4-tuple from `make_profile_fns`.
- Produces: `build_board_with_history(slate, lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn) -> tuple[list, list]` returning `(hr_rows, k_rows)` where each current row carries history twins: HR rows get `probability_hist` and (when `vs`) `vs.k_prob_hist/hit_prob_hist/lean_hist/prob_hist`; K rows get `over_prob_hist`, `expected_ks_hist`, and per-entry `matchups[i].k_prob_hist/hit_prob_hist/lean_hist/prob_hist`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_history_merge.py
from model.export_web import build_board_with_history

def _bat(pid, hr_rate):  # profile stub
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "season_hr": hr_rate, "season_pa": 100, "recent_form_mult": 1.0,
            "k_rate": 0.22, "hit_rate": 0.22}

def _pit(pid):
    return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R",
            "k_per_bf": 0.22, "expected_bf": 24, "opponent_k_mult": 1.0, "k_line": 5.5,
            "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}

def test_history_twins_attached():
    slate = [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    cur_l = lambda g: {"home": [_bat(1, 5)], "away": [_bat(2, 5)]}
    hist_l = lambda g: {"home": [_bat(1, 9)], "away": [_bat(2, 9)]}  # higher HR base in history
    cur_p = lambda pid: _pit(pid)
    hist_p = lambda pid: {**_pit(pid), "k_per_bf": 0.30}
    w = lambda g: {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}
    hr, ks = build_board_with_history(slate, cur_l, cur_p, hist_l, hist_p, w, None)
    assert all("probability_hist" in r for r in hr)
    assert hr[0]["probability_hist"] != hr[0]["probability"]  # history base differs
    assert all("over_prob_hist" in r and "expected_ks_hist" in r for r in ks)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_history_merge.py -v`
Expected: FAIL (`cannot import name 'build_board_with_history'`)

- [ ] **Step 3: Implement** — add to `model/export_web.py`:

```python
def _key(r: dict) -> tuple:
    return (r.get("player_id"), r.get("game_id"))


def build_board_with_history(slate, lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn,
                             weather_fn, bvp_fn):
    """Build current-mode rows, then attach history-mode twins (*_hist)."""
    hr = build_hr_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=bvp_fn)
    ks = build_strikeout_rows(slate, pitcher_fn, lineups_fn, weather_fn, bvp_fn=bvp_fn)
    hr_h = {_key(r): r for r in build_hr_rows(slate, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn=bvp_fn)}
    ks_h = {_key(r): r for r in build_strikeout_rows(slate, pitcher_hist_fn, lineups_hist_fn, weather_fn, bvp_fn=bvp_fn)}

    def _copy_vs(dst_vs, src_vs):
        for f in ("k_prob", "hit_prob", "lean", "prob"):
            dst_vs[f"{f}_hist"] = src_vs.get(f)

    for r in hr:
        h = hr_h.get(_key(r))
        if not h:
            continue
        r["probability_hist"] = h["probability"]
        if r.get("vs") and h.get("vs"):
            _copy_vs(r["vs"], h["vs"])
    for r in ks:
        h = ks_h.get(_key(r))
        if not h:
            continue
        r["over_prob_hist"] = h["over_prob"]
        r["expected_ks_hist"] = h["expected_ks"]
        for i, m in enumerate(r.get("matchups", [])):
            if i < len(h.get("matchups", [])):
                _copy_vs(m, h["matchups"][i])
    return hr, ks
```

Then in `export_web.main`, replace the `make_profile_fns` unpack + the two `build_*` calls:

```python
    lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn = make_profile_fns(slate, season, date_str)
    weather_fn = fetch.make_weather_fn()
    bvp_fn = make_bvp_fn()
    hr_rows, k_rows = build_board_with_history(
        slate, lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn)
```

And in `model/daily.refresh_today`, update the unpack + build calls inside the `if fresh_slate:` block:

```python
        fns = profile_fns or export_web.make_profile_fns(fresh_slate, int(date_str[:4]), date_str)
        lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn = fns
        wfn = weather_fn or fetch.make_weather_fn()
        bfn = bvp_fn or export_web.make_bvp_fn()
        hr, ks = export_web.build_board_with_history(
            fresh_slate, lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn, wfn, bfn)
        games = build_games(fresh_slate, wfn)
```

- [ ] **Step 4: Run the full suite to verify nothing broke + new test passes**

Run: `.venv/bin/python -m pytest tests/test_history_merge.py tests/test_export_web.py tests/test_daily*.py -v`
Expected: PASS (new test passes; existing export/daily tests still pass — any test asserting `make_profile_fns` returns 2 values must be updated to unpack 4).

- [ ] **Step 5: Commit**

```bash
git add model/export_web.py model/daily.py tests/test_history_merge.py
git commit -m "feat: compute both modes and attach *_hist twins to the board"
```

---

### Task 5: Season-rollover cache auto-sweep (`model/daily.py`)

**Files:**
- Modify: `model/daily.py` (add `sweep_stale_season_caches`; call from `update_events`)
- Test: `tests/test_cache_sweep.py`

**Interfaces:**
- Produces: `sweep_stale_season_caches(current_season: int, *, keep: int = 3, cache_dir=DEFAULT_DIR) -> list[str]` — deletes `bat-events-{pid}-{year}.json` / `pit-events-{pid}-{year}.json` whose `year <= current_season - keep`; returns deleted filenames. Never touches in-window years or `bvp-*`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_cache_sweep.py
from pathlib import Path
from model.daily import sweep_stale_season_caches

def test_sweeps_only_out_of_window(tmp_path):
    for nm in ["bat-events-1-2026.json", "bat-events-1-2024.json", "bat-events-1-2023.json",
               "pit-events-9-2022.json", "bvp-1-2.json"]:
        (tmp_path / nm).write_text("[]")
    deleted = sweep_stale_season_caches(2026, keep=3, cache_dir=tmp_path)
    names = {Path(d).name for d in deleted}
    assert names == {"bat-events-1-2023.json", "pit-events-9-2022.json"}  # < 2024
    assert (tmp_path / "bat-events-1-2026.json").exists()
    assert (tmp_path / "bat-events-1-2024.json").exists()
    assert (tmp_path / "bvp-1-2.json").exists()  # untouched
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_cache_sweep.py -v`
Expected: FAIL (`cannot import name 'sweep_stale_season_caches'`)

- [ ] **Step 3: Implement** — add to `model/daily.py`:

```python
import re as _re

def sweep_stale_season_caches(current_season: int, *, keep: int = 3, cache_dir=DEFAULT_DIR) -> list[str]:
    """Delete season-event caches older than the keep-year window (re-downloadable)."""
    cache_dir = Path(cache_dir)
    cutoff = current_season - keep  # delete years <= cutoff
    deleted = []
    pat = _re.compile(r"-(\d{4})\.json$")
    for f in list(cache_dir.glob("bat-events-*.json")) + list(cache_dir.glob("pit-events-*.json")):
        m = pat.search(f.name)
        if m and int(m.group(1)) <= cutoff:
            f.unlink()
            deleted.append(str(f))
    return deleted
```

Then call it once per day inside `update_events`, right after the marker is advanced (so it runs with the daily fold, not every run). Add near the end of `update_events`, before `return`:

```python
    sweep_stale_season_caches(int(today[:4]), cache_dir=cache_dir)
```

- [ ] **Step 4: Run tests**

Run: `.venv/bin/python -m pytest tests/test_cache_sweep.py tests/test_daily*.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/daily.py tests/test_cache_sweep.py
git commit -m "feat: auto-sweep season-event caches older than the 3-yr window"
```

---

### Task 6: One-time prior-season backfill (`model/backfill_history.py`)

**Files:**
- Create: `model/backfill_history.py`
- Test: `tests/test_backfill_history.py`

**Interfaces:**
- Produces: `prime_prior_seasons(player_ids: list[int], current_season: int, *, batter=True) -> int` — calls `get_or_compute` for years `current_season-1` and `current_season-2` for each player so caches are warmed; returns count of cache entries ensured. A `__main__` block warms the prior two seasons for the players on the next N days' slates.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_backfill_history.py
from model import backfill_history, fetch

def test_prime_prior_seasons_warms_two_years(monkeypatch):
    # bypass on-disk caching so the test never touches the real .cache dir
    monkeypatch.setattr(backfill_history, "get_or_compute", lambda key, producer, *a, **k: producer())
    calls = []
    monkeypatch.setattr(fetch, "batter_events", lambda pid, yr: calls.append((pid, yr)) or [])
    n = backfill_history.prime_prior_seasons([1, 2], 2026, batter=True)
    assert n == 4  # 2 players x 2 prior seasons
    assert set(calls) == {(1, 2025), (1, 2024), (2, 2025), (2, 2024)}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_backfill_history.py -v`
Expected: FAIL (`No module named 'model.backfill_history'`)

- [ ] **Step 3: Implement**

```python
# model/backfill_history.py
"""One-time warmer for prior-season event caches (run off-budget, not in a 30-min job)."""
import sys
from model import fetch
from model.cache import get_or_compute


def prime_prior_seasons(player_ids: list[int], current_season: int, *, batter: bool = True) -> int:
    fetcher = fetch.batter_events if batter else fetch.pitcher_events
    prefix = "bat-events" if batter else "pit-events"
    n = 0
    for pid in player_ids:
        for yr in (current_season - 1, current_season - 2):
            get_or_compute(f"{prefix}-{pid}-{yr}", lambda pid=pid, yr=yr: fetcher(pid, yr))
            n += 1
    return n


if __name__ == "__main__":
    season = int(sys.argv[1]) if len(sys.argv) > 1 else int(fetch.get_schedule.__defaults__ or [0])
    # warm prior seasons for everyone on today's slate (extend to more days as needed)
    from model import export_web
    import datetime as dt
    today = dt.date.today().isoformat()
    slate = fetch.get_schedule(today)
    pids: set[int] = set()
    for g in slate:
        official = fetch.get_lineups(g["game_id"])
        for side, tk in (("home", "home_id"), ("away", "away_id")):
            pids.update(official.get(side) or (fetch.get_recent_lineup(g.get(tk), today) if g.get(tk) else []))
        for pk in ("home_pitcher_id", "away_pitcher_id"):
            if g.get(pk):
                pids.add(g[pk])
    season = season or int(today[:4])
    b = prime_prior_seasons(sorted(pids), season, batter=True)
    p = prime_prior_seasons(sorted(pids), season, batter=False)
    print(f"warmed {b} batter + {p} pitcher prior-season caches for {len(pids)} players")
```

- [ ] **Step 4: Run test**

Run: `.venv/bin/python -m pytest tests/test_backfill_history.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/backfill_history.py tests/test_backfill_history.py
git commit -m "feat: one-time prior-season cache backfill helper (off-budget)"
```

---

### Task 7: Frontend types (`web/lib/types.ts`)

**Files:**
- Modify: `web/lib/types.ts`

**Interfaces:**
- Produces: optional `*_hist` fields on `Matchup`, `HrRow`, `KRow`.

- [ ] **Step 1: Add the optional fields**

In `Matchup` add:
```ts
  k_prob_hist?: number;
  hit_prob_hist?: number;
  lean_hist?: "K" | "H" | "NEU";
  prob_hist?: number;
```
In `HrRow` add: `  probability_hist?: number;`
In `KRow` add: `  over_prob_hist?: number;` and `  expected_ks_hist?: number;`

- [ ] **Step 2: Typecheck**

Run: `cd web && node_modules/.bin/tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add web/lib/types.ts
git commit -m "feat: add optional *_hist fields to board types"
```

---

### Task 8: Frontend toggle + source-aware mapping (`web/app/page.tsx`)

**Files:**
- Modify: `web/app/page.tsx`

**Interfaces:**
- Consumes: the `*_hist` fields. Produces: a `source` state (`"current" | "hist"`, default `"current"`), a toggle in the selector area, and source-aware `hrRows`/`kRows` so every downstream view is unchanged.

- [ ] **Step 1: Add state** — near the other `useState`s:
```tsx
  const [source, setSource] = useState<"current" | "hist">("current");
```

- [ ] **Step 2: Add the toggle UI** — inside the centered selector column (after the `SECTIONS` pillbar), so it shows on every section that has projections:
```tsx
        <div className="pillbar" title="History blends the last 3 seasons (5/4/3) for a steadier baseline — situational factors stay live">
          {([["current", "Current"], ["hist", "History (3-yr)"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setSource(v)} data-active={source === v} className="pill">{label}</button>
          ))}
        </div>
```

- [ ] **Step 3: Make the row mappings source-aware** — in `hrRows`, change `prob`, `lean`, `hitProb`, `kProb`:
```tsx
    prob: source === "hist" ? (r.probability_hist ?? r.probability) : r.probability,
    lean: r.vs
      ? (source === "hist"
          ? { lean: r.vs.lean_hist ?? r.vs.lean, prob: r.vs.prob_hist ?? r.vs.prob }
          : { lean: r.vs.lean, prob: r.vs.prob })
      : null,
    hitProb: source === "hist" ? (r.vs?.hit_prob_hist ?? r.vs?.hit_prob) : r.vs?.hit_prob,
    kProb: source === "hist" ? (r.vs?.k_prob_hist ?? r.vs?.k_prob) : r.vs?.k_prob,
```
In `kRows`, change `prob` and `projection`:
```tsx
    prob: source === "hist" ? (r.over_prob_hist ?? r.over_prob) : r.over_prob,
    projection: (source === "hist" ? (r.expected_ks_hist ?? r.expected_ks) : r.expected_ks).toFixed(1),
```

- [ ] **Step 4: Typecheck**

Run: `cd web && node_modules/.bin/tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add web/app/page.tsx
git commit -m "feat: Current/History source toggle, source-aware board mapping"
```

---

### Task 9: Player-page source plumbing (`web/app/player/[prop]/[id]/page.tsx`)

**Files:**
- Modify: `web/app/page.tsx` (append `&source=hist` to row `href`s when `source === "hist"`)
- Modify: `web/app/player/[prop]/[id]/page.tsx` (read `?source=hist`, use `*_hist` fields)

**Interfaces:**
- Consumes: `source` URL param. Produces: player detail values respect the chosen source.

- [ ] **Step 1: Pass source in board links** — in `web/app/page.tsx`, where `dateQ` is built, extend it:
```tsx
  const dateQ = `${selectedDate ? `?date=${selectedDate}` : ""}${source === "hist" ? `${selectedDate ? "&" : "?"}source=hist` : ""}`;
```

- [ ] **Step 2: Read + apply source on the player page** — at the top of the player page component, read the param and select fields. Add a helper and use it for the headline probability, the matchup `vs` (HR page) and per-batter `matchups` (K page) spheres, swapping to `*_hist` when `source==="hist"` (falling back to current when a twin is absent).

```tsx
  const source = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("source");
  const hist = source === "hist";
  const pick = <T,>(cur: T, h: T | undefined) => (hist && h !== undefined ? h : cur);
  // examples:
  //   probability: pick(r.probability, r.probability_hist)
  //   over_prob:   pick(r.over_prob, r.over_prob_hist)
  //   sphere lean: pick(m.lean, m.lean_hist), prob: pick(m.prob, m.prob_hist)
```
Apply `pick(...)` at each display of probability / expected Ks / matchup lean+prob on the player page.

- [ ] **Step 3: Typecheck**

Run: `cd web && node_modules/.bin/tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Manual sanity (dev server)** — toggle History on the board, click a player; the player page reflects history numbers; toggle off → current numbers.

- [ ] **Step 5: Commit**

```bash
git add web/app/page.tsx "web/app/player/[prop]/[id]/page.tsx"
git commit -m "feat: carry Current/History source through to player pages"
```

---

### Task 10: Full-suite gate + local preview

**Files:** none (verification)

- [ ] **Step 1:** `.venv/bin/python -m pytest -q` → all pass (existing + new).
- [ ] **Step 2:** `cd web && node_modules/.bin/tsc --noEmit` → exit 0.
- [ ] **Step 3:** Warm prior seasons once locally: `.venv/bin/python -m model.backfill_history` then regenerate today: `.venv/bin/python -m model.export_web $(TZ=America/New_York date +%F)`.
- [ ] **Step 4:** Verify the board JSON has `probability_hist` on HR rows and `over_prob_hist` on K rows; spot-check that a steady veteran's history value is close to current and a hot-start player's history value is pulled toward his multi-year norm.
- [ ] **Step 5:** Local dev preview; confirm the toggle flips numbers instantly across Props / Game Hub / Top Plays, current mode looks identical to before, then stop at the preview gate for user approval before deploy.

---

## Notes for the executor

- **Math sign-off is done** (spec, user-approved). Do not change weights or regression constants without re-confirming.
- **Current mode is sacred:** if any existing test changes output, that's a regression — investigate, don't update the assertion (except the mechanical `make_profile_fns` 2→4-tuple unpack in tests).
- **Deploy** is the user's call at the Task 10 preview gate (preview-before-production), then force-deploy after merge (code-only change).
