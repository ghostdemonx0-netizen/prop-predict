# A1 — Barrel Effect on All Batter Props — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Extend the capped Barrel Effect nudge (shipped for HR) to all 6 batter props — HR, TB, Hits, Runs, RBI, HRR — each with its own recipe + graduated cap, and finish HR's recipe by folding in ZoneFit + SwStr.

**Architecture:** Generalize `model/barrel_effect.py` to a prop-aware `_RECIPES` table (per-prop hitter/pitcher factor weights + cap), with ZoneFit as a hitter-side matchup factor (`zone_fit(hitter.zone_dmg, pitcher.zone_freq)`) and an `invert` set for lower-is-better factors (SwStr). Each prop's build function attaches `barrel_mult` + `_beff` probability twins, mirroring the shipped HR path. Export twins, recorder, and the frontend toggle generalize to all props.

**Tech Stack:** Python 3 (model, pytest), Next.js/TypeScript (web, vitest).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-07-a1-barrel-effect-all-props-design.md`.
- **SIGN-OFF build, but OFF-path byte-identical:** `probability` and every existing threshold field stay UNCHANGED. Only additive `barrel_mult` / `*_beff` keys. The nudge only shows when the toggle is ON. (Sign-off happens at Task 6's before/after smoke — do not deploy.)
- **Scope:** the 6 batter props only. Do NOT touch Ks (`build_strikeout_rows`) — it goes to the pitcher engine (separate).
- **Weights are grader-tunable SEEDS.** Each hitter recipe sums to 1.0; each pitcher recipe sums to 1.0; hitter/pitcher blend 0.60/0.40 (unchanged).
- **Graduated caps:** HR/TB/RBI = 0.20; Hits/Runs/HRR = 0.15.
- **Roles:** ISO / full xwOBA / Ball% are VIEWERS — never add them to a recipe.
- **Additive:** full pytest suite green after every task; frontend `tsc --noEmit` clean, no new lint in touched files (`page.tsx:228` is a pre-existing baseline error).
- **No-lookahead / timeframe:** history twin nudge uses the blended profiles (as HR does). ZoneFit/SwStr fall back to neutral on blended profiles (they carry barrel but not yet pitch fields — a flagged A2 follow-up).

---

### Task 1: Prop-aware `barrel_effect_mult` (recipes + ZoneFit + invert)

**Files:** Modify `model/barrel_effect.py`, `tests/test_barrel_effect.py`.

- [ ] **Step 1: Write the failing tests**

Replace the HR-specific expectations in `tests/test_barrel_effect.py` and add prop-aware ones. Keep any still-valid tests; add:

```python
import math
from model.barrel_effect import barrel_effect_mult, _RECIPES

def test_every_recipe_side_sums_to_one():
    for prop, r in _RECIPES.items():
        hs = sum(w for _, (_, w) in _hw(r["hitter"]))
        ps = sum(w for _, (_, w) in r["pitcher"].items())
        assert math.isclose(hs, 1.0, abs_tol=1e-9), f"{prop} hitter {hs}"
        assert math.isclose(ps, 1.0, abs_tol=1e-9), f"{prop} pitcher {ps}"

def _hw(spec):
    # normalize entries to (key, ((lo,hi), w)) ignoring the optional invert marker
    return [(k, (v[0], v[1])) for k, v in spec.items()]

def test_caps_are_graduated():
    assert _RECIPES["hr"]["cap"] == 0.20 and _RECIPES["rbi"]["cap"] == 0.20
    assert _RECIPES["hits"]["cap"] == 0.15 and _RECIPES["runs"]["cap"] == 0.15

def test_swstr_inverted_low_whiff_helps_hits():
    strong = {"bbe": 300, "zone_dmg": {}, "swstr": 0.06,  # low whiff (good)
              "hardhit_rate": 0.55, "sweetspot_rate": 0.45, "xwobacon": 0.46, "barrel_rate": 0.20}
    whiffy = dict(strong); whiffy["swstr"] = 0.16          # high whiff (bad)
    assert barrel_effect_mult(strong, None, prop="hits") > barrel_effect_mult(whiffy, None, prop="hits")

def test_zonefit_matchup_moves_nudge():
    hitter = {"bbe": 300, "zone_dmg": {5: 0.9}, "swstr": 0.10, "hardhit_rate": 0.40,
              "sweetspot_rate": 0.35, "xwobacon": 0.36, "barrel_rate": 0.10}
    into_hot = {"zone_freq": {5: 1.0}}      # pitcher lives in the hitter's hot zone
    into_cold = {"zone_freq": {1: 1.0}}
    assert barrel_effect_mult(hitter, into_hot, prop="hits") > barrel_effect_mult(hitter, into_cold, prop="hits")

def test_clamps_to_prop_cap_and_neutral_no_data():
    maxed = {"bbe": 300, "zone_dmg": {}, "swstr": 0.06, "pulled_barrel_rate": 0.12,
             "barrel_rate": 0.20, "hardhit_rate": 0.55, "sweetspot_rate": 0.45,
             "fb_rate": 0.45, "xwobacon": 0.46}
    assert barrel_effect_mult(maxed, None, prop="hr") <= 1.20 + 1e-9
    assert abs(barrel_effect_mult({}, None, prop="hr") - 1.0) < 1e-9
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_barrel_effect.py -q` → FAIL (no `_RECIPES`).

- [ ] **Step 3: Rewrite `model/barrel_effect.py`**

Replace the module body (keep `_dev`) with the prop-aware version:

```python
"""Pure "b effect": one combined, capped, sample-shrunk barrel multiplier per prop.
Multiplies onto the normal prob in the existing factor chain. All constants are
grader-tunable SEEDS. ZoneFit is a hitter-side matchup factor (hitter damage-by-zone
× this pitcher's location); SwStr is inverted (low whiff = good)."""
from model.pitch_metrics import zone_fit

# league anchors reused across recipes: (lo, hi)
_A = {
    "pulled_barrel_rate": (0.01, 0.12), "barrel_rate": (0.03, 0.20),
    "hardhit_rate": (0.25, 0.55), "sweetspot_rate": (0.25, 0.45),
    "fb_rate": (0.18, 0.45), "xwobacon": (0.26, 0.46),
    "zonefit": (0.28, 0.52), "swstr": (0.06, 0.16),
    "pulled_barrel_rate_allowed": (0.03, 0.08), "barrel_rate_allowed": (0.04, 0.12),
    "hardhit_rate_allowed": (0.35, 0.52), "fb_rate_allowed": (0.18, 0.45),
    "hit_allowed_rate": (0.20, 0.28),
}
_INVERT = {"swstr"}       # lower is better -> flip the deviation sign
_MATCHUP = {"zonefit"}    # value computed from hitter x pitcher, not a plain field

def _h(pairs):  # build a hitter/pitcher spec dict: {key: ((lo,hi), weight)}
    return {k: (_A[k], w) for k, w in pairs}

# ---- per-prop recipes (hitter side sums 1.0, pitcher side sums 1.0) ----
_RECIPES = {
    "hr": {"cap": 0.20,
        "hitter": _h([("pulled_barrel_rate",0.25),("barrel_rate",0.25),("hardhit_rate",0.12),
                      ("sweetspot_rate",0.08),("fb_rate",0.05),("xwobacon",0.10),
                      ("zonefit",0.10),("swstr",0.05)]),
        "pitcher": _h([("pulled_barrel_rate_allowed",0.35),("barrel_rate_allowed",0.35),
                       ("hardhit_rate_allowed",0.20),("fb_rate_allowed",0.10)])},
    "tb": {"cap": 0.20,
        "hitter": _h([("barrel_rate",0.20),("pulled_barrel_rate",0.15),("hardhit_rate",0.15),
                      ("xwobacon",0.12),("sweetspot_rate",0.10),("fb_rate",0.08),
                      ("zonefit",0.12),("swstr",0.08)]),
        "pitcher": _h([("barrel_rate_allowed",0.40),("hardhit_rate_allowed",0.30),
                       ("hit_allowed_rate",0.30)])},
    "hits": {"cap": 0.15,
        "hitter": _h([("zonefit",0.22),("swstr",0.20),("hardhit_rate",0.18),
                      ("sweetspot_rate",0.15),("xwobacon",0.15),("barrel_rate",0.10)]),
        "pitcher": _h([("hit_allowed_rate",0.50),("hardhit_rate_allowed",0.30),
                       ("barrel_rate_allowed",0.20)])},
    "runs": {"cap": 0.15,
        "hitter": _h([("zonefit",0.20),("swstr",0.18),("xwobacon",0.15),("hardhit_rate",0.15),
                      ("barrel_rate",0.12),("sweetspot_rate",0.10),("fb_rate",0.10)]),
        "pitcher": _h([("hit_allowed_rate",0.50),("hardhit_rate_allowed",0.30),
                       ("barrel_rate_allowed",0.20)])},
    "rbi": {"cap": 0.20,
        "hitter": _h([("hardhit_rate",0.20),("barrel_rate",0.18),("xwobacon",0.15),
                      ("pulled_barrel_rate",0.10),("zonefit",0.15),("swstr",0.12),
                      ("sweetspot_rate",0.10)]),
        "pitcher": _h([("barrel_rate_allowed",0.40),("hardhit_rate_allowed",0.30),
                       ("hit_allowed_rate",0.30)])},
    "hrr": {"cap": 0.15,
        "hitter": _h([("barrel_rate",0.18),("hardhit_rate",0.15),("xwobacon",0.12),
                      ("pulled_barrel_rate",0.10),("zonefit",0.15),("swstr",0.12),
                      ("sweetspot_rate",0.08),("fb_rate",0.10)]),
        "pitcher": _h([("barrel_rate_allowed",0.35),("hardhit_rate_allowed",0.30),
                       ("hit_allowed_rate",0.35)])},
}
_W_HITTER, _W_PITCHER = 0.60, 0.40
_N_STABLE = 40.0


def _dev(value, lo, hi) -> float:
    """Signed deviation vs league: lo -> -1, midpoint -> 0, hi -> +1 (clamped)."""
    if value is None:
        return 0.0
    t = (value - lo) / (hi - lo)
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return 2.0 * t - 1.0


def _hitter_index(hitter: dict, pitcher: dict | None, spec: dict) -> float:
    total = 0.0
    for key, ((lo, hi), w) in spec.items():
        if key in _MATCHUP:
            val = zone_fit(hitter.get("zone_dmg") or {}, pitcher.get("zone_freq") or {}) if pitcher else None
        else:
            val = hitter.get(key)
        dev = _dev(val, lo, hi)
        if key in _INVERT:
            dev = -dev
        total += w * dev
    return total


def _pitcher_index(pitcher: dict, spec: dict) -> float:
    return sum(w * _dev(pitcher.get(k), lo, hi) for k, ((lo, hi), w) in spec.items())


def barrel_effect_mult(hitter: dict, pitcher: dict | None, *, prop: str = "hr",
                       n_stable: float = _N_STABLE) -> float:
    """Combined barrel nudge in [1-cap, 1+cap] for `prop`. Hitter recipe vs pitcher
    recipe, shrunk by the hitter's batted-ball sample (`bbe`). Neutral (1.0) with no data."""
    recipe = _RECIPES[prop]
    d_h = _hitter_index(hitter, pitcher, recipe["hitter"])
    d_p = _pitcher_index(pitcher, recipe["pitcher"]) if pitcher else 0.0
    d = _W_HITTER * d_h + _W_PITCHER * d_p
    bbe = hitter.get("bbe") or 0
    trust = min(bbe / n_stable, 1.0) if n_stable else 1.0
    d *= trust
    d = -1.0 if d < -1.0 else 1.0 if d > 1.0 else d
    return 1.0 + d * recipe["cap"]
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/python -m pytest tests/test_barrel_effect.py -q` → PASS.

- [ ] **Step 5: Full suite (HR nudge value changed — update any HR-value assertions)**

Run: `.venv/bin/python -m pytest -q`. If a test in `tests/test_hr_beff.py` / archive / export asserts a SPECIFIC HR `barrel_mult`/`probability_beff` VALUE (not just presence), update it to the new HR recipe's value (the HR recipe now includes ZoneFit+SwStr, so the number moved — this is intended). Presence-based tests should still pass. If a test breaks only on an exact old value, recompute and pin the new one; do NOT weaken it to presence-only.

- [ ] **Step 6: Commit**

```bash
git add model/barrel_effect.py tests/test_barrel_effect.py
git commit -m "feat(a1): prop-aware barrel_effect_mult — 6 recipes, ZoneFit matchup factor, SwStr invert, graduated caps"
```

---

### Task 2: Wire threshold props (Hits, TB) in `_threshold_rows`

**Files:** Modify `model/pipeline.py`, `tests/test_pipeline.py` (or the existing threshold-prop test file).

- [ ] **Step 1: Write the failing test**

Add a test that a hits row and a TB row carry `barrel_mult` and per-threshold `_beff` twins, and that the base thresholds are unchanged. Mirror the existing threshold-prop test's fixture (read `tests/` for the helper that feeds `build_hits_rows`). Assert e.g.:

```python
def test_hits_rows_have_barrel_beff_twins():
    rows = build_hits_rows(_slate(), _lineups, _pitchers, _weather)
    r = rows[0]
    assert "barrel_mult" in r
    for label in ("p_ge1", "p_ge2", "p_ge3"):
        assert f"{label}_beff" in r
        assert 0.0 <= r[f"{label}_beff"] <= 1.0
        # OFF path unchanged:
        assert r[label] == r[label]   # base threshold still present & untouched
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_pipeline.py -q -k "hits and beff"` → FAIL.

- [ ] **Step 3: Implement in `_threshold_rows`**

In `model/pipeline.py`, add `from model.barrel_effect import barrel_effect_mult` (top). `_threshold_rows` already knows `units` (`"hits"` or `"bases"`); map it to a prop: `bprop = "hits" if units == "hits" else "tb"`. After `form = _run_props.blend_forms(...)` (~line 332), add:

```python
        barrel_mult = barrel_effect_mult(b, opp, prop=bprop)
```

Where the row is assembled (~line 430, before/inside the threshold loop), set `row["barrel_mult"] = barrel_mult` once, and inside the `for label, nthresh in thresholds:` loop, after `row[label] = ...`, add the clamped twin:

```python
            row[f"{label}_beff"] = min(1.0, max(0.0, row[label] * barrel_mult))
```

`row[label]` (the base) stays exactly as-is.

- [ ] **Step 4: Run test + full suite**

Run: `.venv/bin/python -m pytest tests/test_pipeline.py -q` → PASS. Then `.venv/bin/python -m pytest -q` → green.

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat(a1): Hits + Total Bases rows carry barrel_mult + per-threshold _beff twins"
```

---

### Task 3: Wire run props (Runs, RBI, HRR) in `_run_prop_rows`

**Files:** Modify `model/pipeline.py`, `tests/test_pipeline.py`.

- [ ] **Step 1: Write the failing test**

```python
def test_run_props_have_barrel_beff_twins():
    for build, labels in ((build_runs_rows, ("p_ge1","p_ge2")),
                          (build_rbi_rows, ("p_ge1","p_ge2")),
                          (build_hrr_rows, ("p_ge2","p_ge3","p_ge4"))):
        rows = build(_slate(), _lineups, _pitchers, _weather)
        r = rows[0]
        assert "barrel_mult" in r
        for label in labels:
            assert f"{label}_beff" in r and 0.0 <= r[f"{label}_beff"] <= 1.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_pipeline.py -q -k "run_props and beff"` → FAIL.

- [ ] **Step 3: Implement in `_run_prop_rows`**

`_run_prop_rows` receives `prop` in (`"RUNS"`, `"RBI"`, `"HRR"`). Map to the recipe key: `bprop = prop.lower()` (runs/rbi/hrr — matches `_RECIPES`). After `blended = _run_props.blend_forms(...)` (~line 505):

```python
        barrel_mult = barrel_effect_mult(b, opp, prop=bprop)
```

After the row's probability fields are set via `row.update(_run_props.ge_probs(lam, cfg["thresholds"], ...))` (~line 560), add `row["barrel_mult"] = barrel_mult` and the clamped twins:

```python
        row["barrel_mult"] = barrel_mult
        for _field, _n in cfg["thresholds"]:
            if _field in row:
                row[f"{_field}_beff"] = min(1.0, max(0.0, row[_field] * barrel_mult))
```

Base probability fields stay unchanged.

- [ ] **Step 4: Run test + full suite**

Run: `.venv/bin/python -m pytest tests/test_pipeline.py -q` → PASS. Then `.venv/bin/python -m pytest -q` → green.

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat(a1): Runs + RBI + HRR rows carry barrel_mult + per-threshold _beff twins"
```

---

### Task 4: Export history twins + recorder for all props

**Files:** Modify `model/export_web.py`, `model/archive.py`, `tests/test_boards_payload.py`, `tests/test_archive.py`.

- [ ] **Step 1: Failing tests**

(a) In `tests/test_boards_payload.py`: a hits/TB/runs history row with `barrel_mult` + `p_geN_beff` surfaces `barrel_mult_hist` + `p_geN_beff_hist` on the current row. (b) In `tests/test_archive.py`: a hits row with `p_ge1_beff`/`p_ge1_beff_hist` records a `"1+ barreled"` (or the prop's label) triple. Mirror the existing HR-twin/HR-archive tests.

- [ ] **Step 2: Run to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_boards_payload.py tests/test_archive.py -q -k "beff or barreled"` → FAIL.

- [ ] **Step 3: Export twins (`model/export_web.py`)**

In the Hits `_hist` attach loop and the TB `_hist` attach loop, after the existing `_hist` field copies, add barrel-mult + per-threshold beff twins:

```python
        for field in ("barrel_mult",):
            if field in h:
                r["barrel_mult_hist"] = h[field]
        for field in _hits_thresholds:          # or _tb_thresholds
            if f"{field}_beff" in h:
                r[f"{field}_beff_hist"] = h[f"{field}_beff"]
```

In the generic `_attach(rows, hist_map, thresholds)` used for Runs/RBI/HRR, add the same two blocks (using its `thresholds` arg for the beff loop). The current-row `barrel_mult` and `p_geN_beff` are already on the row from Tasks 2/3; this only adds the `_hist` twins.

- [ ] **Step 4: Recorder (`model/archive.py`)**

`_FACTOR_KEYS` already carries `barrel_mult`/`barrel_mult_hist` (confirm; add if missing). In `record_from_row`, after the threshold-family loop that builds `probs[label]`, add barreled triples for every threshold prop:

```python
        for field, label in THRESHOLDS.get(prop_lower, []):
            cur_b = row.get(f"{field}_beff")
            if cur_b is not None:
                hist_b = row.get(f"{field}_beff_hist")
                probs[f"{label} barreled"] = {"current": cur_b, "blend": _blend(cur_b, hist_b), "history": hist_b}
```

(HR's `"1+ barreled"` branch already exists — leave it.)

- [ ] **Step 5: Run tests + full suite**

Run: `.venv/bin/python -m pytest tests/test_boards_payload.py tests/test_archive.py -q` → PASS. Then `.venv/bin/python -m pytest -q` → green.

- [ ] **Step 6: Commit**

```bash
git add model/export_web.py model/archive.py tests/test_boards_payload.py tests/test_archive.py
git commit -m "feat(a1): history-beff twins + barreled archive triples for Hits/TB/Runs/RBI/HRR"
```

---

### Task 5: Frontend — toggle picks `_beff` for every prop

**Files:** Modify `web/lib/weighting.ts`, `web/lib/types.ts`, `web/lib/tests/weighting.test.ts`.

- [ ] **Step 1: Failing vitest**

Add a test: with `barrelEffect=true`, `toBoardRows` for `hits2` (and one run prop) reads `p_ge2_beff`/`p_ge2_beff_hist`; with `false` it reads `p_ge2`/`p_ge2_hist`. Mirror the existing HR barrel test in the file.

- [ ] **Step 2: Run to verify it fails**

Run (from `web/`): `npx vitest run lib/tests/weighting.test.ts` → FAIL.

- [ ] **Step 3: Implement**

In `web/lib/types.ts`, add the optional `_beff` twin fields to the threshold/run row types: for each threshold key `p_geN`, add `p_geN_beff?` and `p_geN_beff_hist?`, plus `barrel_mult?` / `barrel_mult_hist?` (mirror what HrRow already has).

In `web/lib/weighting.ts`, for each prop branch (hits/tb/runs/rbi/hrr), select the beff field when `barrelEffect`:

```typescript
        const baseField = barrelEffect ? `p_ge${n}_beff` : `p_ge${n}`;
        const histField = barrelEffect ? `p_ge${n}_beff_hist` : `p_ge${n}_hist`;
        const base = (r as any)[baseField];
        const hist = (r as any)[histField];
        return { ...spread..., prob: pN(base, hist), ... };
```

Keep every non-prob field and the non-HR/non-threshold branches untouched.

- [ ] **Step 4: Verify**

Run (from `web/`): `npx vitest run lib/tests/weighting.test.ts` → PASS. Then `npx tsc --noEmit` → clean. Then `npm run lint` → no NEW errors in the 3 touched files (`page.tsx:228` pre-existing).

- [ ] **Step 5: Commit**

```bash
git add web/lib/weighting.ts web/lib/types.ts web/lib/tests/weighting.test.ts
git commit -m "feat(a1): b effect toggle selects the barreled probability for all batter props"
```

---

### Task 6: Before/after smoke (the sign-off artifact)

**Files:** Create `scripts/smoke_a1.py`.

- [ ] **Step 1: Write the smoke**

Create `scripts/smoke_a1.py`: for a couple of real matchups (an elite power bat, a contact/slap bat, and a high-barrel-high-whiff "Gallo" type), fetch profiles and print, per prop (HR/TB/Hits/Runs/RBI/HRR), the `barrel_effect_mult(hitter, pitcher, prop=...)` and what it does to a sample base probability (OFF vs ON). Mirror `scripts/smoke_barrel_effect.py`'s structure.

```python
"""Real-data before/after for A1 barrel effect across all 6 batter props.
Run: .venv/bin/python scripts/smoke_a1.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model import fetch, profiles
from model.barrel_effect import barrel_effect_mult

SEASON = 2024
PROPS = ["hr", "tb", "hits", "runs", "rbi", "hrr"]
BATTERS = {"Aaron Judge (power)": 592450, "Luis Arraez (contact)": 650333,
           "Joey Gallo (barrel+whiff)": 608336}
PID_NOLA = 605400
p = profiles.pitcher_profile_from_events(fetch.pitcher_events(PID_NOLA, SEASON),
        as_of=f"{SEASON}-10-01", player_id=PID_NOLA, name="Aaron Nola")
for name, pid in BATTERS.items():
    h = profiles.batter_profile_from_events(fetch.batter_events(pid, SEASON),
            as_of=f"{SEASON}-10-01", player_id=pid, name=name)
    print(f"\n{name} vs Nola:")
    for prop in PROPS:
        m = barrel_effect_mult(h, p, prop=prop)
        print(f"  {prop:5s} mult={m:.3f}  (a 20% prob -> {20*m:.1f}%)")
```

- [ ] **Step 2: Run it + sanity-check**

Run: `.venv/bin/python scripts/smoke_a1.py` (network — retry if slow). Sanity checks to record: every mult within its prop's cap band; power bat (Judge) > 1.0 on HR/TB/RBI; contact bat (Arraez) ≥ ~1.0 on Hits; Gallo ~neutral on Hits (barrel up cancelled by SwStr down) but > 1.0 on HR/TB. Paste the table in the report.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke_a1.py
git commit -m "chore(a1): real-data before/after smoke across all 6 batter props for sign-off"
```

---

## Self-Review

**Spec coverage:** 6 recipes + graduated caps + ZoneFit(matchup)/SwStr(invert) (Task 1); Hits/TB wiring (Task 2); Runs/RBI/HRR wiring (Task 3); export twins + recorder (Task 4); frontend toggle (Task 5); before/after smoke for sign-off (Task 6). Ks untouched. ISO/xwOBA/Ball% never enter a recipe. ✅

**Placeholder scan:** none — full recipe table + refactored module + exact insertion points (from the seam map) throughout.

**Type consistency:** `barrel_effect_mult(hitter, pitcher, *, prop="hr", n_stable=40.0) -> float`; `_RECIPES[prop] = {"hitter","pitcher","cap"}`; row twin keys `{label}_beff` + `{label}_beff_hist` + `barrel_mult`/`barrel_mult_hist`; recorder label `"{label} barreled"`; frontend reads `p_geN_beff`/`p_geN_beff_hist`. Consistent across model → export → archive → frontend.

**Deferred (not this plan):** Ks (pitcher engine); b weight; blended profiles carrying pitch fields (History ZoneFit/SwStr neutral until then); the card "🛢️ Barrel" driving-it row + active/context marking (option B); ZoneFit fine-tune (plate_x/z heatmap).
