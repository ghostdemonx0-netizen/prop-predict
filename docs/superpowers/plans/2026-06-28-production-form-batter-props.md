# Production-Form for HR/Hits/TB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give HR/Hits/TB a second recent-form signal (production/results) blended with the existing hard-hit signal — Hits/TB 60/40, HR 80/20.

**Architecture:** `batter_profile_from_events` computes three per-prop production multipliers; the HR and threshold builders blend each with the existing hard-hit `recent_form_mult` (via the existing `run_props.blend_forms`) and feed the blended value into the projection; history twins stay form-neutral.

**Tech Stack:** Python 3.12 stdlib, pytest. No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-28-production-form-batter-props-design.md`. **Model-math change** — constants signed off.
- Blend weights: **HR `w_hard=0.80`**, **Hits/TB `w_hard=0.60`**. Production window `_RECENT_PA=60`, shrink `_PROD_SHRINK_PA=50`, per-signal clamp [0.80, 1.20].
- A profile with no `production_form_*` field defaults to 1.0 → `blend_forms(hard, 1.0)` ≠ hard, so existing tests with non-1.0 hard-hit fixtures may shift (Task 4 updates baselines).
- No recorder change (`hard_hit_form`/`production_form`/`recent_form_mult` keys already archived).
- TDD; run from repo root with `uv run pytest`.

---

### Task 1: Production multipliers in `batter_profile_from_events`

**Files:**
- Modify: `model/profiles.py` (constants near `_RECENT_BIP`; helper + 3 fields in `batter_profile_from_events`)
- Test: `tests/test_profiles.py`

**Interfaces:**
- Produces: profile gains `production_form_hr`, `production_form_hit`, `production_form_tb` (each a multiplier centered 1.0, clamp [0.80, 1.20]); `_RECENT_PA=60`, `_PROD_SHRINK_PA=50.0`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_profiles.py  (append)
def _pa(date, ev):
    return {"game_date": date, "events": ev, "launch_speed": 95.0}

def _season_events(old_ev, recent_ev, *, old_n=40, recent_n=60):
    # older PAs first (earlier dates), recent PAs last (later dates)
    ev = [_pa(f"2026-04-{i%28+1:02d}", old_ev) for i in range(old_n)]
    ev += [_pa(f"2026-06-{i%28+1:02d}", recent_ev) for i in range(recent_n)]
    return ev

def test_production_form_hot_hits_above_one():
    ev = _season_events("field_out", "single")   # cold past, hot recent
    p = pitcher_unused = profiles.batter_profile_from_events(ev, as_of="2026-07-01", player_id=1)
    assert p["production_form_hit"] > 1.0

def test_production_form_cold_hits_below_one():
    ev = _season_events("single", "field_out")   # hot past, cold recent
    p = profiles.batter_profile_from_events(ev, as_of="2026-07-01", player_id=1)
    assert p["production_form_hit"] < 1.0

def test_production_form_uniform_is_neutral():
    ev = _season_events("single", "single")
    p = profiles.batter_profile_from_events(ev, as_of="2026-07-01", player_id=1)
    assert abs(p["production_form_hit"] - 1.0) < 1e-9

def test_production_form_hr_is_heavily_shrunk():
    # a couple recent HR over 60 PA, none in the past -> small move (heavy shrink)
    ev = [_pa(f"2026-04-{i%28+1:02d}", "field_out") for i in range(40)]
    ev += [_pa("2026-06-01", "home_run"), _pa("2026-06-02", "home_run")]
    ev += [_pa(f"2026-06-{i%20+3:02d}", "field_out") for i in range(58)]
    p = profiles.batter_profile_from_events(ev, as_of="2026-07-01", player_id=1)
    assert 1.0 < p["production_form_hr"] <= 1.20   # nudged up but bounded
    assert "production_form_tb" in p
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_profiles.py -k production_form -v`
Expected: FAIL with `KeyError: 'production_form_hit'`

- [ ] **Step 3: Write minimal implementation**

Add constants near `_RECENT_BIP` (line ~16):

```python
_RECENT_PA = 60           # production-form window in plate appearances; tunable
_PROD_SHRINK_PA = 50.0    # shrinkage toward season for production form (tames HR noise); tunable
```

Add a module helper (after `_hard_hit_rate`):

```python
_TB_VALUE = {"single": 1, "double": 2, "triple": 3, "home_run": 4}


def _production_form(pa_sorted: list[dict], season_count: float, season_pa: int,
                     value_fn, *, recent_pa: int = _RECENT_PA, shrink_pa: float = _PROD_SHRINK_PA) -> float:
    """Recent outcome-rate vs season, shrunk toward 1.0 and clamped. 1.0 when no data."""
    if season_pa <= 0:
        return 1.0
    season_rate = season_count / season_pa
    if season_rate <= 0:
        return 1.0
    recent = pa_sorted[-recent_pa:]
    n = len(recent)
    if n == 0:
        return 1.0
    recent_rate = sum(value_fn(e) for e in recent) / n
    raw = recent_rate / season_rate
    shrunk = (raw * n + 1.0 * shrink_pa) / (n + shrink_pa)
    return max(0.80, min(shrunk, 1.20))
```

In `batter_profile_from_events`, after the `s3 = ...` line (season counts) and before the return, add:

```python
    pa_sorted = sorted(pa_rows, key=lambda e: e["game_date"])
    tb_total = s1 + 2 * s2 + 3 * s3 + 4 * hr
    production_form_hr = _production_form(pa_sorted, hr, pa, lambda e: 1 if e["events"] == "home_run" else 0)
    production_form_hit = _production_form(pa_sorted, hits, pa, lambda e: 1 if e["events"] in _HIT_EVENTS else 0)
    production_form_tb = _production_form(pa_sorted, tb_total, pa, lambda e: _TB_VALUE.get(e["events"], 0))
```

Add to the returned dict (after `"recent_form_mult": recent_form_mult,`):

```python
        "production_form_hr": production_form_hr,
        "production_form_hit": production_form_hit,
        "production_form_tb": production_form_tb,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_profiles.py -k production_form -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/profiles.py tests/test_profiles.py
git commit -m "feat(production-form): per-prop production multipliers on batter profiles"
```

---

### Task 2: Keep history twins form-neutral

**Files:**
- Modify: `model/export_web.py` (`batter_hist_fn` neutralization block, ~line 150)
- Test: `tests/test_export_web.py`

**Interfaces:**
- Consumes (Task 1): the `production_form_*` profile fields.
- Produces: history-twin batter profiles have `production_form_hr/hit/tb = 1.0`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_export_web.py  (append)
def test_batter_hist_fn_neutralizes_production_form():
    import inspect
    from model import export_web
    src = inspect.getsource(export_web.make_profile_fns)
    assert 'prof["production_form_hr"] = 1.0' in src
    assert 'prof["production_form_hit"] = 1.0' in src
    assert 'prof["production_form_tb"] = 1.0' in src
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_export_web.py -k neutralizes_production_form -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

In `model/export_web.py` `batter_hist_fn`, in the neutralization block (right after `prof["recent_form_mult"] = 1.0`), add:

```python
        prof["production_form_hr"] = 1.0
        prof["production_form_hit"] = 1.0
        prof["production_form_tb"] = 1.0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_export_web.py -k neutralizes_production_form -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/export_web.py tests/test_export_web.py
git commit -m "feat(production-form): keep history twins form-neutral for batter props"
```

---

### Task 3: Blend into the HR + Hits/TB builders

**Files:**
- Modify: `model/pipeline.py` (`_batter_outcome_vector` gains `form_mult`; `build_hr_rows` + `_threshold_rows` blend per-prop)
- Test: `tests/test_pipeline.py`

**Interfaces:**
- Consumes (Task 1): `production_form_hr/hit/tb`; `_run_props.blend_forms(hard, prod, *, w_hard, lo=0.80, hi=1.20)`.
- Produces: HR/Hits/TB rows use the blended form; rows carry `recent_form_mult` (blended), `hard_hit_form`, `production_form`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_pipeline.py  (append)
def test_hr_row_blends_production_form_80_20():
    from model import run_props
    base = dict(SAMPLE_LINEUPS)  # not mutated; we build a custom lineup below
    # hot-results batter: hard-hit neutral, production_form_hr high
    bat = {"player_id": 501, "name": "Hot", "bats": "R", "lineup_status": "confirmed",
           "season_hr": 20, "season_pa": 400, "season_1b": 50, "season_2b": 20, "season_3b": 2,
           "hit_rate": 0.25, "k_rate": 0.22, "recent_form_mult": 1.0,
           "production_form_hr": 1.20, "production_form_hit": 1.0, "production_form_tb": 1.0}
    slate = [{"game_id": 9, "home": "COL", "away": "LAD", "park_team": "COL",
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    L = lambda g: {"home": [bat], "away": []}
    P = lambda pid: {"name": "P", "player_id": pid, "throws": "R", "hr_allowed_rate": 0.033, "bf": 400,
                     "k_per_bf": 0.22, "hit_allowed_rate": 0.22}
    W = lambda g: {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}
    row = build_hr_rows(slate, L, P, W)[0]
    # blended form = blend_forms(1.0, 1.20, w_hard=0.80) = 1 + 0.2*0.20 = 1.04
    assert abs(row["recent_form_mult"] - run_props.blend_forms(1.0, 1.20, w_hard=0.80)) < 1e-9
    assert row["hard_hit_form"] == 1.0
    assert row["production_form"] == 1.20
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_pipeline.py -k hr_row_blends_production -v`
Expected: FAIL (`row["recent_form_mult"]` == 1.0, and no `hard_hit_form` key)

- [ ] **Step 3: Write minimal implementation**

Add a `form_mult` param to `_batter_outcome_vector` (signature + the `form = ...` line):

```python
def _batter_outcome_vector(b, opp, eff_park, weather_mult, slot, bvp, *, apply_xbh_park: bool = False, park_1b: float = 1.0, park_2b: float = 1.0, park_3b: float = 1.0, form_mult: float | None = None):
```
```python
    form = form_mult if form_mult is not None else b.get("recent_form_mult", 1.0)
```

In `build_hr_rows`, replace the `prob = hr_probability(...)` block's form input and the row's form fields:

```python
                hard = b.get("recent_form_mult", 1.0)
                prod = b.get("production_form_hr", 1.0)
                form = _run_props.blend_forms(hard, prod, w_hard=0.80)
                prob = hr_probability(
                    season_hr=b["season_hr"], season_pa=b["season_pa"],
                    recent_form_mult=form,
                    matchup_mult=platoon, pitcher_mult=p_mult, bvp_mult=b_mult,
                    park_mult=eff_park, weather_mult=weather_mult,
                    expected_pa=expected_pa_for_slot(slot),
                )
```
and in the appended row dict change `"recent_form_mult": b.get("recent_form_mult", 1.0),` to:
```python
                    "recent_form_mult": form,
                    "hard_hit_form": hard,
                    "production_form": prod,
```

In `_threshold_rows`, compute the blended form per prop before the `_batter_outcome_vector` calls and pass `form_mult=form` to all of them; set the row fields:

```python
            for slot, b in enumerate(lineups.get(side, [])):
                bvp = bvp_fn(b.get("player_id"), opp.get("player_id")) if (bvp_fn and opp) else None
                hard = b.get("recent_form_mult", 1.0)
                prod = b.get("production_form_tb" if units == "bases" else "production_form_hit", 1.0)
                form = _run_props.blend_forms(hard, prod, w_hard=0.60)
                actual_vec, neutral_vec = _batter_outcome_vector(
                    b, opp, eff_park, weather_mult, slot, bvp,
                    apply_xbh_park=(units == "bases"),
                    park_1b=p1f, park_2b=p2f, park_3b=p3f, form_mult=form,
                )
```
Pass `form_mult=form` to the other `_batter_outcome_vector` calls in this loop too (the `nenv_vec` and `pk_vec` calls — find them a few lines below and add `form_mult=form`). Then change the row's `"recent_form_mult": b.get("recent_form_mult", 1.0),` to:
```python
                    "recent_form_mult": form,
                    "hard_hit_form": hard,
                    "production_form": prod,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_pipeline.py -k hr_row_blends_production -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat(production-form): blend production into HR (80/20) and Hits/TB (60/40)"
```

---

### Task 4: Full-suite regression + baseline updates

**Files:** whole suite

- [ ] **Step 1: Run the full suite**

Run: `uv run pytest -q`
Expected: Most pass (fixtures with `recent_form_mult == 1.0` and no `production_form_*` blend to 1.0 → unchanged). Any test pinning an HR/Hits/TB probability for a fixture whose `recent_form_mult != 1.0` will shift, because that hard-hit value is now blended (HR 80%, Hits/TB 60%). For each such failure, recompute the expected value through `run_props.blend_forms(hard, 1.0, w_hard=<0.80 HR | 0.60 hits/tb>)` and update the pin. The TB pinned test (`_PINNED_TB_*`) uses `recent_form_mult=1.0` with no production field → blends to 1.0 → should stay green.

- [ ] **Step 2: Commit any baseline updates**

```bash
git add -A
git commit -m "test(production-form): update HR/Hits/TB baselines for blended recent form"
```

---

## Self-Review

- **Spec coverage:** §3a production multipliers (Task 1) · §3b per-prop blend in builders (Task 3) · §3c history-twin neutral (Task 2) · §3d constants (Task 1) · §4 no recorder change (rows now populate existing keys; Task 3) · §5 testing (all tasks). Covered.
- **Placeholder scan:** none — full code in every step.
- **Type consistency:** `production_form_hr/hit/tb`, `_production_form(...)`, `_RECENT_PA`, `_PROD_SHRINK_PA`, `blend_forms(..., w_hard=)`, `_batter_outcome_vector(..., form_mult=)` consistent across tasks.

## Notes for the implementer
- `blend_forms` lives in `model/run_props.py` and is reached in pipeline via the existing `_run_props` import.
- Only `recent_form_mult` (now blended), `hard_hit_form`, `production_form` change on the rows — no new archive keys.
- Don't forget the `nenv_vec`/`pk_vec` `_batter_outcome_vector` calls in `_threshold_rows` also need `form_mult=form` (they cancel in ratios, but pass it for consistency so the neutral baseline matches).
