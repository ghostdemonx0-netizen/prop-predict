# Barrel Edge — b effect (HR) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make barrel nudge the **HR** probability — a capped (±20%), sample-shrunk, timeframe-matched barrel multiplier stored as a `_beff` twin (like the existing `_hist` twins), selected by the b effect toggle. OFF = today's HR number, untouched.

**Architecture:** (1) blended profiles gain 3-yr barrel (pool the 3 seasons' events → `barrel_metrics`), so History/Blend are timeframe-matched; (2) a pure `barrel_effect_mult` combines the HR recipe's barrel factors (barrels lead) into one `[0.80,1.20]` multiplier, shrunk by batted-ball sample; (3) `build_hr_rows` stores `barrel_mult` + `probability_beff`; (4) export attaches the history twin + recorder archives both; (5) the frontend toggle picks the `_beff` prob. Everything is ADDITIVE — the normal `probability` never changes.

**Tech Stack:** Python 3 (model), Next.js/TS (frontend), pytest + vitest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-07-barrel-effect-design.md`.
- **ADDITIVE / OFF = today:** the normal `probability` and every existing factor is untouched. Only NEW fields (`barrel_mult`, `probability_beff`, `*_hist_beff`, `bbe`) and NEW twins are added. The full pytest suite MUST stay green after every backend task.
- **Cap = ±20% (`_CAP = 0.20`), sample-stabilize `_N_STABLE = 40` BBE, hitter/pitcher balance 0.60/0.40** — all named SEED constants, grader-tunable. Barrels lead: hitter pulled+barrel weights sum 0.60; pitcher pulled+barrel-allowed sum 0.70.
- **Scope = HR only.** Other props (Hits/TB/Runs/RBI/HRR/Ks) are a separate fast-follow reusing this machinery. Do NOT touch other props' build functions.
- **Sign-off:** the ±20% seed goes to the user on a before/after HR table (Task 6) BEFORE any merge/surface. Building/testing on the branch is fine.
- **Testing:** pytest via `.venv/bin/python -m pytest` (from repo root); frontend `npx tsc --noEmit` + `npm run lint` (from `web/`; known pre-existing lint baseline — add none new). Do NOT run `npm run dev`.

---

### Task 1: Blended (3-yr) barrel on the blended profiles

**Files:**
- Modify: `model/profiles.py` (`blended_batter_profile`, `blended_pitcher_profile`)
- Modify: `tests/test_profile_components.py`

**Interfaces:**
- Produces: `blended_batter_profile(...)` now carries the 8 barrel fields; `blended_pitcher_profile(...)` carries the 8 `*_allowed` fields — same keys as the current-season profiles, but computed over the pooled 3 seasons.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_profile_components.py`:

```python
def test_blended_batter_profile_has_barrel_fields():
    ev = lambda d, e, **k: {"game_date": d, "events": e, "launch_speed": k.get("ls", 100.0),
                            "launch_angle": 20.0, "launch_speed_angle": k.get("lsa", 6),
                            "bb_type": "fly_ball", "hc_x": 80.0, "hc_y": 100.0, "stand": "R",
                            "estimated_woba_using_speedangle": 0.6, "game_pk": 1}
    by_season = {2026: [ev("2026-04-01", "home_run")],
                 2025: [ev("2025-04-01", "single", lsa=5)],
                 2024: [ev("2024-04-01", "home_run")]}
    p = blended_batter_profile(by_season, as_of="2026-06-01", current_season=2026, player_id=1)
    # pooled 3 BBE, 2 barrels -> blended barrel_rate present and > 0
    assert "barrel_rate" in p and p["barrel_rate"] > 0
    assert "pulled_barrel_rate" in p and "xwobacon" in p


def test_blended_pitcher_profile_has_allowed_barrel_fields():
    ev = lambda d, e: {"game_date": d, "events": e, "launch_speed": 103.0, "launch_angle": 22.0,
                       "launch_speed_angle": 6, "bb_type": "fly_ball", "hc_x": 80.0, "hc_y": 100.0,
                       "stand": "R", "estimated_woba_using_speedangle": 0.6, "game_pk": 1}
    by_season = {2026: [ev("2026-04-01", "home_run")], 2025: [ev("2025-04-01", "home_run")],
                 2024: [ev("2024-04-01", "home_run")]}
    p = blended_pitcher_profile(by_season, as_of="2026-06-01", current_season=2026, player_id=9)
    assert "barrel_rate_allowed" in p and p["barrel_rate_allowed"] > 0
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_profile_components.py -q -k "blended and barrel"`
Expected: FAIL — `KeyError: 'barrel_rate'`.

- [ ] **Step 3: Implement pooled-barrel blending**

In `model/profiles.py`, confirm the import `from model.barrel import barrel_metrics` exists (added in Phase 0). In `blended_batter_profile`, after the profile dict `prof` is built (just before it's returned), merge pooled barrel metrics. Use the same `_seasons_in_order(events_by_season, current_season)` the function already uses to get the 3 season event lists; pool (concatenate) them and run `barrel_metrics` once:

```python
    pooled = [e for evs in _seasons_in_order(events_by_season, current_season) for e in evs]
    prof.update(barrel_metrics(pooled, as_of=as_of))
    return prof
```

In `blended_pitcher_profile`, the same, with `allowed=True`:

```python
    pooled = [e for evs in _seasons_in_order(events_by_season, current_season) for e in evs]
    prof.update(barrel_metrics(pooled, as_of=as_of, allowed=True))
    return prof
```

(If the local variable holding the 3 season lists is named differently, reuse whatever `_seasons_in_order(...)` returns — it's a list of 3 event lists. Pool = flatten.) NOTE: this pools the 3 seasons EQUALLY (a true 3-yr rate); Marcel-weighting the barrel blend is a documented later refinement, not needed for v1.

- [ ] **Step 4: Run the new tests + full suite**

Run: `.venv/bin/python -m pytest tests/test_profile_components.py -q -k "blended and barrel"` → PASS (2).
Then: `.venv/bin/python -m pytest -q` → all green (additive).

- [ ] **Step 5: Commit**

```bash
git add model/profiles.py tests/test_profile_components.py
git commit -m "feat(barrel): 3-yr pooled barrel on blended profiles (timeframe-matched b effect input)"
```

---

### Task 2: `bbe` count + `model/barrel_effect.py` (the HR nudge)

**Files:**
- Modify: `model/barrel.py` (emit `bbe` — the batted-ball count — so the nudge can shrink by sample)
- Create: `model/barrel_effect.py`
- Modify: `tests/test_barrel.py`
- Create: `tests/test_barrel_effect.py`

**Interfaces:**
- Produces: `barrel_effect_mult(hitter: dict, pitcher: dict | None, *, cap=0.20, n_stable=40.0) -> float` in `[1-cap, 1+cap]`. Task 3 consumes it. Also: profiles now carry `bbe` (batter) / `bbe_allowed` (pitcher).

- [ ] **Step 1: Add a failing `bbe` test**

Add to `tests/test_barrel.py`:

```python
def test_barrel_metrics_emits_bbe_count():
    evs = [_bb("2026-04-01", "home_run", lsa=6, bb="fly_ball"),
           _bb("2026-04-01", "single", lsa=5, bb="line_drive"),
           _bb("2026-04-01", "strikeout", ls=None, bb=None)]  # not a BBE
    m = barrel_metrics(evs, as_of="2026-06-01")
    assert m["bbe"] == 2
    ma = barrel_metrics(evs, as_of="2026-06-01", allowed=True)
    assert ma["bbe_allowed"] == 2
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_barrel.py -q -k bbe`
Expected: FAIL — `KeyError: 'bbe'`.

- [ ] **Step 3: Emit `bbe` from `barrel_metrics`**

In `model/barrel.py`: add `"bbe"` to the `_KEYS` tuple, and add `"bbe": n` to the returned `m` dict (where `n = len(bip)`, already computed). The `allowed=True` rename then produces `bbe_allowed` automatically.

- [ ] **Step 4: Write the failing nudge tests**

Create `tests/test_barrel_effect.py`:

```python
from model.barrel_effect import barrel_effect_mult

_STRONG = {"pulled_barrel_rate": 0.12, "barrel_rate": 0.20, "hardhit_rate": 0.55,
           "sweetspot_rate": 0.45, "fb_rate": 0.45, "xwobacon": 0.46, "bbe": 300}
_WEAK = {"pulled_barrel_rate": 0.01, "barrel_rate": 0.03, "hardhit_rate": 0.25,
         "sweetspot_rate": 0.25, "fb_rate": 0.18, "xwobacon": 0.26, "bbe": 300}
_VULN_P = {"pulled_barrel_rate_allowed": 0.08, "barrel_rate_allowed": 0.12,
           "hardhit_rate_allowed": 0.52, "fb_rate_allowed": 0.45}
_STINGY_P = {"pulled_barrel_rate_allowed": 0.03, "barrel_rate_allowed": 0.04,
             "hardhit_rate_allowed": 0.35, "fb_rate_allowed": 0.18}


def test_strong_vs_vulnerable_pushes_up_to_cap():
    assert barrel_effect_mult(_STRONG, _VULN_P) == 1.20   # both maxed -> full +cap


def test_weak_vs_stingy_pushes_down_to_cap():
    assert barrel_effect_mult(_WEAK, _STINGY_P) == 0.80    # both min -> full -cap


def test_neutral_matchup_near_one():
    mid_h = {"pulled_barrel_rate": 0.065, "barrel_rate": 0.115, "hardhit_rate": 0.40,
             "sweetspot_rate": 0.35, "fb_rate": 0.315, "xwobacon": 0.36, "bbe": 300}
    mid_p = {"pulled_barrel_rate_allowed": 0.055, "barrel_rate_allowed": 0.08,
             "hardhit_rate_allowed": 0.435, "fb_rate_allowed": 0.315}
    assert abs(barrel_effect_mult(mid_h, mid_p) - 1.0) < 0.02


def test_thin_sample_shrinks_toward_one():
    thin = dict(_STRONG); thin["bbe"] = 4     # 4/40 = 0.1 trust
    full = barrel_effect_mult(_STRONG, _VULN_P) - 1.0     # +0.20
    small = barrel_effect_mult(thin, _VULN_P) - 1.0
    assert 0 < small < full and abs(small - full * 0.1) < 1e-9


def test_no_data_is_neutral():
    assert barrel_effect_mult({}, None) == 1.0


def test_output_in_cap_band():
    assert 0.80 <= barrel_effect_mult(_STRONG, _VULN_P) <= 1.20
```

- [ ] **Step 5: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_barrel_effect.py -q`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement `model/barrel_effect.py`**

```python
"""Pure "b effect": one combined, capped, sample-shrunk barrel multiplier for HR,
from the HR recipe's barrel factors (barrels lead). Multiplies onto the normal HR
prob in the existing factor chain. All constants are grader-tunable SEEDS. Other
props reuse this machinery with their recipes later."""

# each stat: ((lo, hi) league anchors, weight). weights per side sum to 1.0.
_HR_HITTER = {
    "pulled_barrel_rate": ((0.01, 0.12), 0.30),
    "barrel_rate":        ((0.03, 0.20), 0.30),
    "hardhit_rate":       ((0.25, 0.55), 0.15),
    "sweetspot_rate":     ((0.25, 0.45), 0.10),
    "fb_rate":            ((0.18, 0.45), 0.05),
    "xwobacon":           ((0.26, 0.46), 0.10),
}
_HR_PITCHER = {
    "pulled_barrel_rate_allowed": ((0.03, 0.08), 0.35),
    "barrel_rate_allowed":        ((0.04, 0.12), 0.35),
    "hardhit_rate_allowed":       ((0.35, 0.52), 0.20),
    "fb_rate_allowed":            ((0.18, 0.45), 0.10),
}
_W_HITTER, _W_PITCHER = 0.60, 0.40
_CAP = 0.20
_N_STABLE = 40.0


def _dev(value, lo, hi) -> float:
    """Signed deviation vs league: lo -> -1, midpoint -> 0, hi -> +1 (clamped)."""
    if value is None:
        return 0.0
    t = (value - lo) / (hi - lo)
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return 2.0 * t - 1.0


def _index(profile: dict, spec: dict) -> float:
    return sum(w * _dev(profile.get(k), lo, hi) for k, ((lo, hi), w) in spec.items())


def barrel_effect_mult(hitter: dict, pitcher: dict | None, *, cap: float = _CAP,
                       n_stable: float = _N_STABLE) -> float:
    """Combined HR barrel nudge in [1-cap, 1+cap]. Hitter barrels vs pitcher
    barrels-allowed, shrunk by the hitter's batted-ball sample (`bbe`). Neutral
    (1.0) with no data."""
    d_h = _index(hitter, _HR_HITTER)                       # [-1, 1]
    d_p = _index(pitcher, _HR_PITCHER) if pitcher else 0.0  # [-1, 1]
    d = _W_HITTER * d_h + _W_PITCHER * d_p                 # [-1, 1]
    bbe = hitter.get("bbe") or 0
    trust = min(bbe / n_stable, 1.0) if n_stable else 1.0
    d *= trust
    d = -1.0 if d < -1.0 else 1.0 if d > 1.0 else d
    return 1.0 + d * cap
```

- [ ] **Step 7: Run tests (both files) + full suite**

Run: `.venv/bin/python -m pytest tests/test_barrel.py tests/test_barrel_effect.py -q` → PASS.
Then `.venv/bin/python -m pytest -q` → all green.

- [ ] **Step 8: Commit**

```bash
git add model/barrel.py model/barrel_effect.py tests/test_barrel.py tests/test_barrel_effect.py
git commit -m "feat(barrel): bbe count + barrel_effect_mult HR nudge (capped, sample-shrunk)"
```

---

### Task 3: HR rows get `barrel_mult` + `probability_beff`

**Files:**
- Modify: `model/pipeline.py` (`build_hr_rows`)
- Modify: `tests/` (add an HR-row barrel test — put it in the existing `tests/test_pipeline.py` if present, else create `tests/test_hr_beff.py`)

**Interfaces:**
- Consumes: `barrel_effect_mult` (Task 2).
- Produces: every HR row now carries `barrel_mult: float` and `probability_beff: float` (= `probability * barrel_mult`).

- [ ] **Step 1: Write the failing test**

Create `tests/test_hr_beff.py` (a focused test with a minimal fake slate; mirror how other pipeline tests build inputs — read `tests/test_pipeline.py` for the existing fake `lineups_fn`/`pitcher_fn`/`weather_fn` shape and reuse it):

```python
from model.pipeline import build_hr_rows

def _weather_fn(game):
    return {"wx": {"wind_speed_mph": 0, "wind_from_deg": 0}, "temp_f": 70,
            "park": {"cf_bearing_deg": 0, "dome": False}}

def _slate():
    return [{"game_id": 1, "started": False, "home": "BOS", "away": "NYY",
             "park_team": "BOS", "home_pitcher_id": 9, "away_pitcher_id": 9}]

_HITTER = {"player_id": 1, "name": "Big Bat", "bats": "R", "season_hr": 30, "season_pa": 500,
           "recent_form_mult": 1.0, "production_form_hr": 1.0, "games": 120,
           "barrel_rate": 0.20, "pulled_barrel_rate": 0.12, "hardhit_rate": 0.55,
           "sweetspot_rate": 0.45, "fb_rate": 0.45, "xwobacon": 0.46, "bbe": 300,
           "k_rate": 0.22, "hit_rate": 0.22, "spray_sides": {}}
_PITCHER = {"player_id": 9, "name": "Arm", "throws": "L", "hr_allowed_rate": 0.033, "bf": 400,
            "barrel_rate_allowed": 0.12, "pulled_barrel_rate_allowed": 0.08,
            "hardhit_rate_allowed": 0.52, "fb_rate_allowed": 0.45, "k_per_bf": 0.22,
            "hit_allowed_rate": 0.22}

def test_hr_row_has_barrel_mult_and_beff():
    rows = build_hr_rows(_slate(), lambda g: {"home": [dict(_HITTER)], "away": []},
                         lambda pid: dict(_PITCHER), _weather_fn, bvp_fn=None)
    r = rows[0]
    assert 0.80 <= r["barrel_mult"] <= 1.20
    assert r["barrel_mult"] > 1.0                       # strong bat vs vulnerable arm
    assert abs(r["probability_beff"] - r["probability"] * r["barrel_mult"]) < 1e-9
    assert r["probability"] > 0                          # normal prob untouched/present
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_hr_beff.py -q`
Expected: FAIL — `KeyError: 'barrel_mult'`.

- [ ] **Step 3: Implement in `build_hr_rows`**

In `model/pipeline.py`, add the import at the top: `from model.barrel_effect import barrel_effect_mult`. Inside the per-batter loop, right after `prob = hr_probability(...)` is computed (and before the `rows.append({...})`), add:

```python
                barrel_mult = barrel_effect_mult(b, opp)
                prob_beff = prob * barrel_mult
```

Then in that row's `rows.append({...})` dict, add two keys (next to `"probability": prob,`):

```python
                    "probability": prob,
                    "barrel_mult": barrel_mult,
                    "probability_beff": prob_beff,
```

- [ ] **Step 4: Run the test + full suite**

Run: `.venv/bin/python -m pytest tests/test_hr_beff.py -q` → PASS.
Then `.venv/bin/python -m pytest -q` → all green (only additive keys).

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_hr_beff.py
git commit -m "feat(barrel): HR rows carry barrel_mult + probability_beff twin"
```

---

### Task 4: History twin + recorder

**Files:**
- Modify: `model/export_web.py` (`build_board_with_history`, HR twin loop)
- Modify: `model/archive.py` (`_FACTOR_KEYS` + `record_from_row` HR branch)
- Modify: `tests/test_archive.py` (or the archive test file present)

**Interfaces:**
- Produces: HR rows also carry `probability_hist_beff` + `barrel_mult_hist`; the archive stores a barreled HR prob triple + `barrel_mult`.

- [ ] **Step 1: Attach the history twin in export**

In `model/export_web.py`, in the HR twin loop (the `for r in hr:` block that sets `r["probability_hist"] = h["probability"]`), add two lines:

```python
        r["probability_hist"] = h["probability"]
        r["probability_hist_beff"] = h.get("probability_beff")
        r["barrel_mult_hist"] = h.get("barrel_mult")
```

- [ ] **Step 2: Write the failing recorder test**

In the archive test file (read `tests/test_archive.py` for the existing `record_from_row` test pattern + a sample HR row), add:

```python
def test_archive_captures_barreled_hr():
    row = {  # minimal HR row with beff twins (reuse the file's existing HR row helper if present)
        "prop": "HR", "game_id": 1, "player_id": 5, "player": "X", "team": "BOS",
        "probability": 0.15, "probability_hist": 0.18,
        "probability_beff": 0.18, "probability_hist_beff": 0.216,
        "barrel_mult": 1.20, "barrel_mult_hist": 1.20,
    }
    rec = record_from_row(row, "hr")
    assert rec["factors"].get("barrel_mult") == 1.20
    # a barreled prob triple is recorded
    assert any("barrel" in k.lower() for k in rec["probs"])
```

- [ ] **Step 3: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_archive.py -q -k barrel`
Expected: FAIL.

- [ ] **Step 4: Implement recorder changes**

In `model/archive.py`: add `"barrel_mult"` and `"barrel_mult_hist"` to the `_FACTOR_KEYS` tuple (they'll be auto-captured into `factors`). In `record_from_row`'s HR branch (where `probs["1+"] = {"current":…, "blend":…, "history":…}` is set), add a barreled triple right after:

```python
        cur_b, hist_b = row.get("probability_beff"), row.get("probability_hist_beff")
        if cur_b is not None or hist_b is not None:
            probs["1+ barreled"] = {"current": cur_b, "blend": _blend(cur_b, hist_b), "history": hist_b}
```

(Use the same blend helper the HR branch already uses for the normal triple — match its exact name.)

- [ ] **Step 5: Run tests + full suite**

Run: `.venv/bin/python -m pytest tests/test_archive.py -q -k barrel` → PASS.
Then `.venv/bin/python -m pytest -q` → all green.

- [ ] **Step 6: Commit**

```bash
git add model/export_web.py model/archive.py tests/test_archive.py
git commit -m "feat(barrel): HR history-beff twin + recorder archives barreled HR + barrel_mult"
```

---

### Task 5: Frontend — the b effect toggle picks the barreled HR prob

**Files:**
- Modify: `web/lib/types.ts` (add the new HR twin fields to `HrRow`)
- Modify: `web/lib/weighting.ts` (`toBoardRows` gains a `barrelEffect` param; HR case picks `_beff`)
- Modify: `web/app/page.tsx` (pass `barrelEffect` into `toBoardRows`)
- Modify: `web/lib/tests/weighting.test.ts`

**Interfaces:**
- Consumes: the backend `probability_beff` / `probability_hist_beff` fields on HR rows.

- [ ] **Step 1: Add the twin fields to `HrRow`**

In `web/lib/types.ts`, add to `HrRow`:

```ts
  probability_beff?: number;
  probability_hist_beff?: number;
  barrel_mult?: number;
  barrel_mult_hist?: number;
```

- [ ] **Step 2: Write the failing weighting test**

In `web/lib/tests/weighting.test.ts`, add (mirror the file's existing `toBoardRows` test setup):

```ts
it("barrelEffect picks the _beff HR probability", () => {
  const data = { hr: [{ player: "X", team: "BOS", player_id: 1, game_id: 1,
    probability: 0.15, probability_beff: 0.18,
    probability_hist: 0.18, probability_hist_beff: 0.216 }] } as unknown as Projections;
  const off = toBoardRows(data, "hr", 0, "current", false)[0].prob;
  const on  = toBoardRows(data, "hr", 0, "current", true)[0].prob;
  expect(off).toBeCloseTo(0.15);
  expect(on).toBeCloseTo(0.18);
});
```

- [ ] **Step 3: Run to verify it fails**

Run (from `web/`): `npx vitest run lib/tests/weighting.test.ts`
Expected: FAIL (arity / value mismatch).

- [ ] **Step 4: Thread `barrelEffect` through `toBoardRows`**

In `web/lib/weighting.ts`, add a trailing optional param `barrelEffect: boolean = false` to `toBoardRows`. In the `hr` case, select the field before building `prob`:

```ts
    const curField  = barrelEffect ? "probability_beff" : "probability";
    const histField = barrelEffect ? "probability_hist_beff" : "probability_hist";
    // ...where the HR row's prob is computed:
    prob: pickN(r[curField] as number | undefined, r[histField] as number | undefined, source) ?? 0,
```

(Keep the existing `pickN` signature; only the FIELD chosen changes. Leave the non-HR cases untouched — they have no `_beff` twins yet.)

- [ ] **Step 5: Pass `barrelEffect` from the page**

In `web/app/page.tsx`, the `toBoardRows(data, activeKind, activeThresholdNum(prop, threshold), source)` call gains the state as its last arg: `..., source, barrelEffect)`. `barrelEffect` state already exists in the component.

- [ ] **Step 6: Verify**

Run (from `web/`): `npx vitest run lib/tests/weighting.test.ts && npx tsc --noEmit && npm run lint`
Expected: test passes, tsc clean, no NEW lint in changed files.

- [ ] **Step 7: Commit**

```bash
git add web/lib/types.ts web/lib/weighting.ts web/app/page.tsx web/lib/tests/weighting.test.ts
git commit -m "feat(barrel): b effect toggle selects the barreled HR probability"
```

---

### Task 6: Real-data before/after (sign-off evidence)

**Files:**
- Create: `scripts/smoke_barrel_effect.py`

**Interfaces:**
- Consumes: `barrel_effect_mult`, `model.fetch`, `model.profiles`.

- [ ] **Step 1: Write the smoke script**

Create `scripts/smoke_barrel_effect.py`:

```python
"""Real-data before/after for the HR b effect nudge — prints the barrel multiplier
for real matchups so a human can sign off on the ±20% cap.
Run: .venv/bin/python scripts/smoke_barrel_effect.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model import fetch, profiles
from model.barrel_effect import barrel_effect_mult

SEASON = 2024
HITTERS = {"Aaron Judge": 592450, "Luis Arraez": 650333}
PITCHERS = {"Aaron Nola (HR-prone)": 605400, "Tarik Skubal (stingy)": 669373}

hp = {n: profiles.batter_profile_from_events(fetch.batter_events(p, SEASON),
        as_of=f"{SEASON}-10-01", player_id=p, name=n) for n, p in HITTERS.items()}
pp = {n: profiles.pitcher_profile_from_events(fetch.pitcher_events(p, SEASON),
        as_of=f"{SEASON}-10-01", player_id=p, name=n) for n, p in PITCHERS.items()}

print(f"{'HITTER':<14}{'PITCHER':<26}{'barrel_mult':>12}{'moves a 10% HR to':>20}")
for hn, h in hp.items():
    for pn, p in pp.items():
        m = barrel_effect_mult(h, p)
        print(f"{hn:<14}{pn:<26}{round(m,3):>12}{round(0.10*m*100,1):>18}%")
```

- [ ] **Step 2: Run + record the numbers**

Run: `.venv/bin/python scripts/smoke_barrel_effect.py`
Expected (report the table): every `barrel_mult` in `[0.80, 1.20]`; **Judge > 1.0** vs a HR-prone arm (nudged up), **Arraez < 1.0** (nudged down); Judge's mult higher vs Nola than vs Skubal. This table is the artifact the user signs off on.

(Network run — retry if a pull is slow.)

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke_barrel_effect.py
git commit -m "chore(barrel): real-data before/after smoke for HR b effect sign-off"
```

---

## Self-Review

**Spec coverage:** capped ±20% nudge (Task 2 `_CAP`), sample-shrink (`bbe`+`n_stable`, Task 2), one combined nudge from HR recipe barrels-lead (Task 2 weights), multiplies into the chain (Task 3 `prob*barrel_mult`), timeframe-matched via blended barrel (Task 1) + history twin (Task 4), OFF untouched (additive throughout), records both for the grader (Task 4), frontend toggle picks it (Task 5), sign-off evidence (Task 6). ✅ HR-only scope honored (other props untouched).

**Placeholder scan:** none — real code/commands throughout. The two "read the existing test file for the fake-slate/HR-row helper" notes (Tasks 3, 4) point at a concrete existing file to mirror, not a vague instruction.

**Type consistency:** `barrel_effect_mult(hitter, pitcher, *, cap, n_stable)` identical across module + tests + `build_hr_rows` call. Field names `barrel_mult` / `probability_beff` / `probability_hist_beff` / `barrel_mult_hist` / `bbe` consistent across pipeline, export, archive, types.ts, weighting.ts. `toBoardRows(..., source, barrelEffect)` arity consistent between weighting.ts and page.tsx.

**Deferred (not this plan):** the 🛢️ Barrel `FactorBar` display row in the player card (small display follow-up); other props' b effect (fast-follow); Marcel-weighting the barrel blend.
