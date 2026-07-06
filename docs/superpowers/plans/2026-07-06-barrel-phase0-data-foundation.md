# Barrel Edge — Phase 0: Data Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Capture barrel / batted-ball quality metrics for hitters AND pitchers-allowed from the existing daily Statcast pull, computed on the profiles — with **zero change to any projection** (pure data foundation). Turns the mock's fake barrel numbers into real, computed ones.

**Architecture:** One pure helper `model/barrel.py` computes the metrics from slim event rows; `model/fetch.py` pulls the extra Statcast columns (and the event cache key is bumped so real pulls include them); `model/profiles.py` merges the metrics into the batter profile (as-is) and pitcher profile (as `*_allowed`). No pipeline/projection math changes.

**Tech Stack:** Python 3, pybaseball 2.2.7 (Statcast), pytest. Run via the repo `.venv`.

## Global Constraints

- **VERIFIED Statcast facts (do not re-assume):** pybaseball's `statcast_batter`/`statcast_pitcher` return **NO `barrel` boolean**. Barrel = **`launch_speed_angle == 6`** (Statcast's own code; 1–6, 6=Barrel). Also present and to be used: `launch_angle`, `launch_speed`, `hc_x`, `hc_y`, `stand`, `bb_type` (`fly_ball`/`ground_ball`/`line_drive`/`popup`), `estimated_woba_using_speedangle` (xwOBAcon per batted ball).
- **ZERO projection change:** touch NO probability math. `model/projections.py`, `model/pipeline.py`, `model/run_props.py`, `model/matchup.py` are OFF LIMITS. This phase only adds fields to profiles.
- **BIP = batted balls** = event rows where `launch_speed is not None`. All rates are `count / len(BIP)` (0.0 when no BIP).
- **No-lookahead:** metrics use only events strictly before `as_of` (mirror the existing `past = [e for e in events if e["game_date"] < as_of]` pattern).
- **Out of Phase 0 scope (later phases):** pitch-level CSW/SwStr, ZoneFit (pitch location), and blending barrel across 3 seasons (`blended_*_profile` stays barrel-free for now — current-season only). Do NOT add these.
- **Testing:** pytest, run from repo root via `.venv/bin/python -m pytest`. Mirror `tests/test_profile_components.py` patterns.
- Run all commands from the repo root `/Users/issiakadiawara/Projects/prop-predict`.

---

### Task 1: `model/barrel.py` — pure barrel-metrics helper

**Files:**
- Create: `model/barrel.py`
- Create: `tests/test_barrel.py`

**Interfaces:**
- Produces: `is_barrel(row) -> bool`, `is_pulled_barrel(row) -> bool`, `barrel_metrics(events, *, as_of, allowed=False) -> dict`. Task 3 consumes `barrel_metrics`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_barrel.py`:

```python
from model.barrel import is_barrel, is_pulled_barrel, barrel_metrics


def _bb(date, events, ls=90.0, la=15.0, lsa=5, bb="line_drive", hx=None, hy=None, stand="R", xw=0.35):
    return {"game_date": date, "events": events, "launch_speed": ls, "launch_angle": la,
            "launch_speed_angle": lsa, "bb_type": bb, "hc_x": hx, "hc_y": hy,
            "stand": stand, "estimated_woba_using_speedangle": xw}


def test_is_barrel_uses_launch_speed_angle_6():
    assert is_barrel(_bb("2026-04-01", "home_run", lsa=6)) is True
    assert is_barrel(_bb("2026-04-01", "single", lsa=5)) is False
    assert is_barrel({"launch_speed_angle": None}) is False


def test_pulled_barrel_needs_barrel_and_pull_side():
    # RHB pulls to LF: hc_x well left of plate (125.42). A barrel pulled = True.
    assert is_pulled_barrel(_bb("2026-04-01", "home_run", lsa=6, hx=80.0, hy=100.0, stand="R")) is True
    # Same batted ball but not a barrel -> False.
    assert is_pulled_barrel(_bb("2026-04-01", "home_run", lsa=5, hx=80.0, hy=100.0, stand="R")) is False
    # Barrel to oppo field (RHB, hit to RF: hc_x right of plate) -> False.
    assert is_pulled_barrel(_bb("2026-04-01", "home_run", lsa=6, hx=170.0, hy=100.0, stand="R")) is False


def test_barrel_metrics_basic_rates():
    evs = [
        _bb("2026-04-01", "home_run", ls=104, la=28, lsa=6, bb="fly_ball", hx=80.0, hy=100.0, stand="R", xw=1.8),
        _bb("2026-04-01", "single",   ls=96,  la=12, lsa=5, bb="line_drive", xw=0.5),
        _bb("2026-04-01", "field_out", ls=80, la=45, lsa=3, bb="fly_ball", xw=0.1),
        _bb("2026-04-01", "strikeout", ls=None),  # not a BIP
    ]
    m = barrel_metrics(evs, as_of="2026-06-01")
    assert m["barrel_rate"] == 1 / 3          # 1 barrel of 3 BIP
    assert m["pulled_barrel_rate"] == 1 / 3   # the barrel was pulled
    assert m["hardhit_rate"] == 2 / 3         # 104 and 96 are >=95
    assert m["fb_rate"] == 2 / 3              # two fly_ball of 3 BIP
    assert m["hrfb_rate"] == 1 / 2            # 1 HR of 2 fly balls
    assert round(m["la_mean"], 3) == round((28 + 12 + 45) / 3, 3)
    assert round(m["xwobacon"], 3) == round((1.8 + 0.5 + 0.1) / 3, 3)
    assert round(m["sweetspot_rate"], 3) == round(2 / 3, 3)  # 28 and 12 in [8,32]


def test_no_bip_all_zeros():
    m = barrel_metrics([_bb("2026-04-01", "strikeout", ls=None), _bb("2026-04-01", "walk", ls=None)], as_of="2026-06-01")
    for k in ("barrel_rate", "pulled_barrel_rate", "sweetspot_rate", "fb_rate", "hardhit_rate", "la_mean", "xwobacon", "hrfb_rate"):
        assert m[k] == 0.0


def test_allowed_flag_renames_keys():
    m = barrel_metrics([_bb("2026-04-01", "home_run", lsa=6, bb="fly_ball")], as_of="2026-06-01", allowed=True)
    assert "barrel_rate_allowed" in m
    assert "barrel_rate" not in m


def test_respects_as_of_cutoff():
    evs = [_bb("2026-04-01", "home_run", lsa=6, bb="fly_ball"), _bb("2026-07-01", "home_run", lsa=6, bb="fly_ball")]
    m = barrel_metrics(evs, as_of="2026-06-01")  # only the April ball counts
    assert m["barrel_rate"] == 1.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_barrel.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.barrel'`.

- [ ] **Step 3: Implement `model/barrel.py`**

Create `model/barrel.py`:

```python
"""Pure barrel / batted-ball quality metrics from slim Statcast event rows.

Statcast's own quality class lives in `launch_speed_angle` (1-6); value 6 = Barrel.
Fly balls come from `bb_type`; xwOBAcon = mean `estimated_woba_using_speedangle`
over batted balls. Pull side reuses model.spray. No I/O; no lookahead.
"""
from model.spray import spray_angle, field_of

_BARREL_CODE = 6
_SWEETSPOT_LO, _SWEETSPOT_HI = 8.0, 32.0
_HARDHIT_MPH = 95.0

_KEYS = ("barrel_rate", "pulled_barrel_rate", "sweetspot_rate", "fb_rate",
         "hardhit_rate", "la_mean", "xwobacon", "hrfb_rate")


def is_barrel(row: dict) -> bool:
    """Statcast barrel = launch_speed_angle code 6."""
    return row.get("launch_speed_angle") == _BARREL_CODE


def is_pulled_barrel(row: dict) -> bool:
    """A barrel hit to the batter's pull side (needs hit coords + handedness)."""
    if not is_barrel(row):
        return False
    hx, hy, stand = row.get("hc_x"), row.get("hc_y"), row.get("stand")
    if hx is None or hy is None or not stand:
        return False
    return field_of(spray_angle(hx, hy), stand) == "pull"


def barrel_metrics(events: list[dict], *, as_of: str, allowed: bool = False) -> dict:
    """Season barrel/batted-ball rates from events strictly before `as_of`.

    BIP = batted balls (launch_speed present). Rates are count/len(BIP), 0.0 when
    no BIP. `allowed=True` suffixes every key with `_allowed` (pitcher profiles).
    """
    past = [e for e in events if e["game_date"] < as_of]
    bip = [e for e in past if e.get("launch_speed") is not None]
    n = len(bip)

    def rate(cnt: int) -> float:
        return cnt / n if n else 0.0

    barrels = sum(1 for e in bip if is_barrel(e))
    pulled = sum(1 for e in bip if is_pulled_barrel(e))
    sweet = sum(1 for e in bip
                if e.get("launch_angle") is not None
                and _SWEETSPOT_LO <= e["launch_angle"] <= _SWEETSPOT_HI)
    hard = sum(1 for e in bip if e["launch_speed"] >= _HARDHIT_MPH)
    fbs = [e for e in bip if e.get("bb_type") == "fly_ball"]
    la_vals = [e["launch_angle"] for e in bip if e.get("launch_angle") is not None]
    xw_vals = [e["estimated_woba_using_speedangle"] for e in bip
               if e.get("estimated_woba_using_speedangle") is not None]
    hr_fb = sum(1 for e in fbs if e["events"] == "home_run")

    m = {
        "barrel_rate": rate(barrels),
        "pulled_barrel_rate": rate(pulled),
        "sweetspot_rate": rate(sweet),
        "fb_rate": rate(len(fbs)),
        "hardhit_rate": rate(hard),
        "la_mean": (sum(la_vals) / len(la_vals)) if la_vals else 0.0,
        "xwobacon": (sum(xw_vals) / len(xw_vals)) if xw_vals else 0.0,
        "hrfb_rate": (hr_fb / len(fbs)) if fbs else 0.0,
    }
    if allowed:
        return {f"{k}_allowed": m[k] for k in _KEYS}
    return m
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_barrel.py -q`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add model/barrel.py tests/test_barrel.py
git commit -m "feat(barrel): pure barrel-metrics helper (Phase 0 data foundation)"
```

---

### Task 2: Pull the extra Statcast columns + bump the event cache key

**Files:**
- Modify: `model/fetch.py` (the `_*_EVENT_COLS` lists + the two fetch docstrings)
- Modify: `model/export_web.py` (bump the batter/pitcher event cache keys so stale caches don't hide the new columns)

**Interfaces:**
- Produces: batter/pitcher slim event rows now carry `launch_angle, launch_speed_angle, hc_x, hc_y, stand, bb_type, estimated_woba_using_speedangle`. Task 3's profile compute reads them.

- [ ] **Step 1: Add barrel columns to the event whitelists**

In `model/fetch.py`, replace the three column lists (currently at ~line 181-183):

```python
_BATTER_EVENT_COLS = [
    "game_date", "events", "launch_speed",
    "launch_angle", "launch_speed_angle", "hc_x", "hc_y", "stand",
    "bb_type", "estimated_woba_using_speedangle",
]
_PITCHER_EVENT_COLS = [
    "game_date", "events", "game_pk", "launch_speed",
    "launch_angle", "launch_speed_angle", "hc_x", "hc_y", "stand",
    "bb_type", "estimated_woba_using_speedangle",
]
_DAY_EVENT_COLS = ["batter", "pitcher", "game_date", "events", "launch_speed", "game_pk"]
```

(`_DAY_EVENT_COLS` intentionally unchanged — statcast_day doesn't feed barrel profiles in Phase 0.)

- [ ] **Step 2: Update the two fetch docstrings**

In `model/fetch.py`, update the docstrings of `batter_events` and `pitcher_events` to reflect the new columns, e.g. change `batter_events`'s docstring line to:

```python
    """One batter-season of slim Statcast rows (incl. barrel inputs:
    launch_angle, launch_speed_angle, hc_x/hc_y, stand, bb_type, xwOBAcon)."""
```

and `pitcher_events` similarly (mention the same barrel-input columns).

- [ ] **Step 3: Verify slim + a real pull include the new columns**

Run (small real pull through the repo's slim path — proves the columns survive `_slim_records`):

```bash
.venv/bin/python -c "
from model import fetch
rows = fetch.batter_events(592450, 2024)   # Aaron Judge, 2024
r = next(e for e in rows if e.get('launch_speed') is not None)
print('keys:', sorted(r.keys()))
assert 'launch_speed_angle' in r and 'bb_type' in r and 'hc_x' in r and 'stand' in r
print('barrels in season:', sum(1 for e in rows if e.get('launch_speed_angle')==6))
print('OK')
"
```
Expected: prints the slim keys incl. `launch_speed_angle`/`bb_type`/`hc_x`/`stand`, a non-zero barrel count, and `OK`.

- [ ] **Step 4: Bump the event cache key so stale caches are bypassed**

Old slim caches were written with the OLD columns (no barrel data), so the new metrics would read as zeros until the cache refreshes. Find the batter/pitcher event cache keys:

Run: `grep -n "bat-events\|pit-events\|events-" model/export_web.py`

Then bump each event cache key by adding a `-v2` marker (e.g. `f"bat-events-{pid}-{season}"` → `f"bat-events-v2-{pid}-{season}"`, and the pitcher one likewise). This forces a fresh Statcast pull that includes the barrel columns. Leave all OTHER cache keys untouched.

- [ ] **Step 5: Verify nothing else broke**

Run: `.venv/bin/python -m pytest tests/test_fetch.py -q` (or `.venv/bin/python -m pytest -q -k fetch`)
Expected: PASS (or "no tests ran" if none exist — then run `.venv/bin/python -c "import model.fetch, model.export_web"` to confirm imports are clean).

- [ ] **Step 6: Commit**

```bash
git add model/fetch.py model/export_web.py
git commit -m "feat(barrel): pull barrel columns from Statcast + bump event cache key"
```

---

### Task 3: Merge barrel metrics into batter & pitcher profiles

**Files:**
- Modify: `model/profiles.py`
- Modify: `tests/test_profile_components.py`

**Interfaces:**
- Consumes: `barrel_metrics` (Task 1); event rows with barrel columns (Task 2).
- Produces: `batter_profile_from_events()` returns the 8 barrel fields; `pitcher_profile_from_events()` returns the 8 `*_allowed` fields. No probability change.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_profile_components.py` (top-of-file import if needed: `from model.profiles import batter_profile_from_events, pitcher_profile_from_events`):

```python
def _brow(d, e, ls=90.0, la=15.0, lsa=5, bb="line_drive", hx=None, hy=None, stand="R", xw=0.3, gp=1):
    return {"game_date": d, "events": e, "launch_speed": ls, "launch_angle": la,
            "launch_speed_angle": lsa, "bb_type": bb, "hc_x": hx, "hc_y": hy,
            "stand": stand, "estimated_woba_using_speedangle": xw, "game_pk": gp}


def test_batter_profile_has_barrel_fields():
    evs = [
        _brow("2026-04-01", "home_run", ls=105, la=27, lsa=6, bb="fly_ball", hx=80.0, hy=100.0),
        _brow("2026-04-02", "single",   ls=88,  la=10, lsa=4, bb="line_drive"),
    ]
    p = batter_profile_from_events(evs, as_of="2026-06-01", player_id=1)
    assert p["barrel_rate"] == 0.5
    assert p["hrfb_rate"] == 1.0          # 1 HR / 1 fly ball
    assert "pulled_barrel_rate" in p and "xwobacon" in p and "sweetspot_rate" in p
    # existing fields untouched
    assert p["season_hr"] == 1 and p["season_pa"] == 2


def test_pitcher_profile_has_allowed_barrel_fields():
    evs = [
        _brow("2026-04-01", "home_run", ls=103, la=25, lsa=6, bb="fly_ball", hx=80.0, hy=100.0),
        _brow("2026-04-01", "strikeout", ls=None),
    ]
    p = pitcher_profile_from_events(evs, as_of="2026-06-01", player_id=9)
    assert p["barrel_rate_allowed"] == 1.0    # 1 barrel of 1 BIP allowed
    assert "pulled_barrel_rate_allowed" in p and "hardhit_rate_allowed" in p
    assert "barrel_rate" not in p             # pitcher uses the _allowed flavor
    # existing fields untouched
    assert p["k_per_bf"] >= 0.0 and p["bf"] == 1
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_profile_components.py -q -k "barrel"`
Expected: FAIL — `KeyError: 'barrel_rate'`.

- [ ] **Step 3: Import the helper + merge into the batter profile**

In `model/profiles.py`, add the import near the top (after the existing `from model...` imports, ~line 12):

```python
from model.barrel import barrel_metrics
```

In `batter_profile_from_events()`, change the `return {` block (currently ~line 85-101) so the barrel fields spread in — replace the final `}` return with a merged dict:

```python
    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "bats": bats,
        "season_hr": hr,
        "season_pa": pa,
        "season_1b": s1,
        "season_2b": s2,
        "season_3b": s3,
        "recent_form_mult": recent_form_mult,
        "production_form_hr": production_form_hr,
        "production_form_hit": production_form_hit,
        "production_form_tb": production_form_tb,
        "k_rate": regress(ks, pa, LEAGUE_K, _K_R),
        "hit_rate": regress(hits, pa, LEAGUE_HIT, _HIT_R),
        **barrel_metrics(events, as_of=as_of),
    }
```

- [ ] **Step 4: Merge `*_allowed` metrics into the pitcher profile**

In `pitcher_profile_from_events()`, change its `return {` block (currently ~line 158-170) to spread the allowed metrics:

```python
    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "throws": throws,
        "k_per_bf": regress(ks, pa, LEAGUE_K, _K_R),
        "expected_bf": expected_bf,
        "opponent_k_mult": 1.0,
        "k_line": line,
        "hit_allowed_rate": regress(hits, pa, LEAGUE_HIT, _HIT_R),
        "hr_allowed_rate": (hr / pa) if pa else 0.0,
        "bf": pa,
        **barrel_metrics(events, as_of=as_of, allowed=True),
    }
```

- [ ] **Step 5: Run the new tests, then the full suite**

Run: `.venv/bin/python -m pytest tests/test_profile_components.py -q -k "barrel"`
Expected: PASS (2 tests).

Then the whole suite (confirm zero projection/behavior breakage — adding dict keys must not break anything):

Run: `.venv/bin/python -m pytest -q`
Expected: PASS (all existing tests still green; the barrel additions are additive).

- [ ] **Step 6: Commit**

```bash
git add model/profiles.py tests/test_profile_components.py
git commit -m "feat(barrel): barrel metrics on batter + pitcher(_allowed) profiles (Phase 0)"
```

---

## Self-Review

**Spec coverage (Phase-0 slice of the spec §5 Data foundation):**
- Barrel ingredients for hitters (Brl/BIP, PulledBrl, SweetSpot, FB, HH, LA) → `barrel_metrics` (Task 1), on batter profile (Task 3). ✅
- xwOBAcon + HR/FB% (present in the pull) → included. ✅
- Pitchers-allowed versions → `allowed=True` on pitcher profile (Task 3). ✅
- Same daily Statcast pull, extra columns → Task 2 (+ cache-key bump so it actually refreshes). ✅
- ZERO math change → constraint enforced; only profile dicts gain keys; full suite must stay green (Task 3 Step 5). ✅
- Sample-size counts: `season_pa` already on batter; BIP count is implicit (rates). A dedicated "Hist BIP" surfaced column is deferred to the display-bridge task (not needed for the compute foundation).
- Deferred (correctly NOT here): CSW/SwStr (pitch-level), ZoneFit (pitch-location), 3-season barrel blend, board-JSON surfacing + frontend wiring (that's the next task, "bridge mock → real").

**Placeholder scan:** none — every step has real code/commands. ✅

**Type consistency:** `barrel_metrics(events, *, as_of, allowed=False)` signature identical across Task 1 definition and Task 3 calls. Metric keys (`barrel_rate`… / `*_allowed`) consistent between helper, batter test, and pitcher test. ✅

**Note (verification realism):** Task 2 Step 3 and the full-suite run hit the network (pybaseball) and the real `.venv`. If a Statcast pull is rate-limited/slow during the run, retry; the unit tests in Tasks 1 & 3 are network-free and are the real correctness gate.
