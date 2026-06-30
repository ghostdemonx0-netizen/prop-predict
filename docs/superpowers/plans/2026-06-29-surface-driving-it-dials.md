# Surface New Dials in "What's Driving It" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the already-computed dials (lineup, spray, production/hard-hit form, BvP-hits) as their own rows in the player-page "what's driving it" breakdown — display-only, no probability changes.

**Architecture:** The web payload serializes each pipeline row dict wholesale, so most new values are ALREADY in the feed (`hard_hit_form`, `production_form`, `bvp_hit_mult`, `spray_pull`, `lineup_mult` are all set in `model/pipeline.py`). The only new backend value is `spray_mult` — a pure decomposition of the existing directional weather effect into neutral-weather × spray, so `weather × spray` equals today's exact total. Everything else is frontend rendering plus TypeScript type declarations and a couple of history-twin field copies.

**Tech Stack:** Python 3 (model, `uv run pytest`), Next.js/React/TypeScript (`web/`).

## Global Constraints

- **No math / no probability changes.** No model term is added or altered; existing probability tests must stay green and unchanged. The spray split is `spray_mult = directional_weather ÷ neutral_weather` (HR) and `= park_weather_factor ÷ park_weather_factor_neutral` (TB), so neutral × spray reproduces the value already used.
- **Purely additive UI.** No existing row is removed. The single "Recent form" row on HR/Hits/TB gains two sibling rows (Hard-hit, Production) above it; it is not deleted.
- **Neutral spray baseline** = `model.spray.final_distribution({}, hand)` (returns `HAND_DEFAULT[hand]`), i.e. a league-average same-handed hitter.
- **Gating:** Spray row hidden when `spray_mult` rounds to 0% (`Math.round((spray_mult-1)*100) === 0`). History-vs-pitcher (hits) row shown only when `r.vs.bvp.pa > 0` (same rule HR's History row uses). Lineup row hidden when `lineup_mult` is undefined.
- **Reuse the existing `Factor` component** (`web/app/player/[prop]/[id]/page.tsx:64`) for every new row — icon, label, mult, note.
- Preview-before-prod: build + localhost preview + explicit approval before merge/deploy.

---

### Task 1: Backend — `spray_mult` on HR rows

**Files:**
- Modify: `model/pipeline.py` (HR builder, ~lines 84-124)
- Test: `tests/test_pipeline.py` (or nearest existing pipeline test module)

**Interfaces:**
- Consumes: `model.spray.final_distribution(scouts, hand)`, `model.weather.wind_out_directional(...)`, `model.weather.weather_hr_multiplier(...)` (all already imported in pipeline).
- Produces: each HR row dict gains `"spray_mult": float` (1.0 = neutral). Invariant: `weather_mult / spray_mult` == the neutral-spray weather multiplier.

- [ ] **Step 1: Write the failing test**

In `tests/test_pipeline.py` (create if absent; mirror existing pipeline-test fixtures — reuse the smallest existing HR-row builder fixture in the suite):

```python
def test_hr_row_has_spray_mult_and_invariant():
    rows = _build_hr_rows_with_wind()  # existing/local helper that posts a windy game
    assert rows, "expected at least one HR row"
    r = rows[0]
    assert "spray_mult" in r
    # neutral * spray reproduces the directional weather actually used in the prob
    neutral = r["weather_mult"] / r["spray_mult"]
    assert 0.5 < neutral < 1.6           # sane neutral-weather band
    assert abs(neutral * r["spray_mult"] - r["weather_mult"]) < 1e-9
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_pipeline.py::test_hr_row_has_spray_mult_and_invariant -v`
Expected: FAIL with `KeyError: 'spray_mult'`.

- [ ] **Step 3: Implement — compute neutral weather + spray_mult in the HR builder**

In `model/pipeline.py`, right after the existing directional block (after `weather_mult = weather_hr_multiplier(wod, w["temp_f"], w["park"]["dome"])`, ~line 90):

```python
                # neutral-spray counterpart, so the card can show Weather (neutral)
                # and Spray (this batter's tilt) separately without double-counting.
                sp_neutral = _spray.final_distribution({}, hand)
                wod_neutral = wind_out_directional(w["wx"]["wind_speed_mph"], w["wx"]["wind_from_deg"],
                                                   w["park"]["cf_bearing_deg"], sp_neutral, hand)
                weather_neutral = weather_hr_multiplier(wod_neutral, w["temp_f"], w["park"]["dome"])
                spray_mult = (weather_mult / weather_neutral) if weather_neutral else 1.0
```

Add `"spray_mult": spray_mult,` to the row dict (next to `"spray_pull": sp["pull"],` at line 117).

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_pipeline.py::test_hr_row_has_spray_mult_and_invariant -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat(pipeline): emit spray_mult on HR rows (weather/spray display split)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backend — `spray_mult` on TB rows

**Files:**
- Modify: `model/pipeline.py` (`_threshold_rows`, ~lines 299-369, `units == "bases"` branch)
- Test: `tests/test_pipeline.py`

**Interfaces:**
- Produces: each Total-Bases row dict gains `"spray_mult": float`. Invariant: `park_weather_factor / spray_mult` == the neutral-spray park&weather factor. Hits rows (`units == "hits"`) do NOT get `spray_mult`.

- [ ] **Step 1: Write the failing test**

```python
def test_tb_row_has_spray_mult_and_invariant():
    rows = _build_tb_rows_with_wind()  # existing/local helper, units="bases"
    assert rows
    r = rows[0]
    assert "spray_mult" in r
    neutral = r["park_weather_factor"] / r["spray_mult"]
    assert abs(neutral * r["spray_mult"] - r["park_weather_factor"]) < 1e-9

def test_hits_row_has_no_spray_mult():
    rows = _build_hits_rows_with_wind()  # units="hits"
    assert rows
    assert "spray_mult" not in rows[0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_pipeline.py -k spray_mult -v`
Expected: `test_tb_row_has_spray_mult_and_invariant` FAILS (`KeyError`); `test_hits_row_has_no_spray_mult` PASSES already.

- [ ] **Step 3: Implement — neutral park_weather factor + spray_mult, bases only**

In `_threshold_rows`, inside the `if units == "bases":` block that computes `park_weather_factor` (after line 334), add a neutral-spray recompute and the ratio:

```python
                    # neutral-spray weather for the Spray display split
                    sp_neutral = _spray.final_distribution({}, hand)
                    wod_neutral = wind_out_directional(w["wx"]["wind_speed_mph"], w["wx"]["wind_from_deg"],
                                                       w["park"]["cf_bearing_deg"], sp_neutral, hand)
                    weather_neutral = weather_hr_multiplier(wod_neutral, w["temp_f"], w["park"]["dome"])
                    nspr_vec, _ = _batter_outcome_vector(
                        b, opp, eff_park, weather_neutral, slot, bvp,
                        apply_xbh_park=True, park_1b=p1f, park_2b=p2f, park_3b=p3f, form_mult=form,
                    )
                    nspr_ev = nspr_vec[1] + 2 * nspr_vec[2] + 3 * nspr_vec[3] + 4 * nspr_vec[4]
                    pwf_neutral = (nspr_ev / nenv_ev) if nenv_ev > 0 else 1.0
                    spray_mult = (park_weather_factor / pwf_neutral) if pwf_neutral else 1.0
```

Then add `spray_mult` to the row dict ONLY for bases. Since the row dict is shared by hits and bases, set a default before the dict and override in the bases branch: initialize `spray_mult = None` next to `park_weather_factor = 1.0` (line 324), and in the row dict add:

```python
                    **({"spray_mult": spray_mult} if spray_mult is not None else {}),
```

(Place this line inside the `row = {...}` dict literal alongside `"spray_pull": _sp["pull"],`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_pipeline.py -k spray_mult -v`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat(pipeline): emit spray_mult on Total Bases rows (bases only)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Backend — history twins for the new form rows (Hits/TB)

**Files:**
- Modify: `model/export_web.py` (`build_board_with_history`, `_hits_factor_fields` ~line and `_tb_factor_fields`)
- Test: full suite regression (`uv run pytest`)

**Interfaces:**
- Produces: Hits rows gain `hard_hit_form_hist`, `production_form_hist`; TB rows gain those plus they already carry `park_weather_factor_hist`. This lets the Hits/TB form rows respect the Current/Blend/History toggle (history twins are form-neutral = 1.0).

- [ ] **Step 1: Extend the factor-field tuples**

In `model/export_web.py`, update:

```python
    _hits_factor_fields = ("recent_form_mult", "pitcher_factor", "hard_hit_form", "production_form")
    _tb_factor_fields = ("recent_form_mult", "pitcher_factor", "park_weather_factor", "hard_hit_form", "production_form")
```

(HR form rows render raw current values — consistent with the existing HR "Recent form" row — so HR needs no twin change. `bvp_hit_mult` and `spray_mult` are matchup/physical-stable and rendered raw, so they need no `_hist` copy.)

- [ ] **Step 2: Run the full suite**

Run: `uv run pytest -q`
Expected: all green (no probability assertions change; this only copies extra display fields).

- [ ] **Step 3: Commit**

```bash
git add model/export_web.py
git commit -m "feat(export): copy hard_hit/production form into Hits/TB history twins

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Frontend — declare new fields in `types.ts`

**Files:**
- Modify: `web/lib/types.ts`

**Interfaces:**
- Produces: optional fields so the card can read them with no `any` casts.

- [ ] **Step 1: Add fields to `HrRow`**

Add inside `HrRow`:

```ts
  hard_hit_form?: number;
  production_form?: number;
  spray_mult?: number;
  spray_pull?: number;
```

- [ ] **Step 2: Add fields to `HitsRow`** (inherited by `TbRow`)

Add inside `HitsRow`:

```ts
  hard_hit_form?: number;
  production_form?: number;
  hard_hit_form_hist?: number;
  production_form_hist?: number;
  bvp_hit_mult?: number;
  spray_pull?: number;
```

Add to `TbRow` specifically:

```ts
  spray_mult?: number;
```

- [ ] **Step 3: Add fields to `RunsRow`** (inherited by `RbiRow`) and `HrrRow`

Add inside `RunsRow` and `HrrRow`:

```ts
  lineup_mult?: number;
  lineup_mult_hist?: number;
  lineup_slot?: number | null;
  lineup_teammate?: number | null;
```

- [ ] **Step 4: Typecheck**

Run: `cd web && npm run build` (or `npx tsc --noEmit` if available)
Expected: compiles (fields are optional; no usage yet).

- [ ] **Step 5: Commit**

```bash
git add web/lib/types.ts
git commit -m "feat(web/types): declare new driving-it factor fields

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Frontend — HR card: Spray + Hard-hit + Production rows

**Files:**
- Modify: `web/app/player/[prop]/[id]/page.tsx` (HR block, ~lines 195-231)

**Interfaces:**
- Consumes: `r.weather_mult`, `r.spray_mult`, `r.spray_pull`, `r.hard_hit_form`, `r.production_form`, `r.bats` from `HrRow`; existing `Factor`, `batLabel`.

- [ ] **Step 1: Add a spray-helper note above the HR `return` (module scope, near `batLabel`)**

```tsx
function pullField(bats?: string) {
  // R pulls to LF, L pulls to RF; switch handled upstream via the chosen hand
  return bats === "L" ? "right field" : "left field";
}
function sprayNote(sprayPull?: number, sprayMult?: number, bats?: string) {
  const pullPct = typeof sprayPull === "number" ? ` (${Math.round(sprayPull * 100)}% pull)` : "";
  const helps = (sprayMult ?? 1) >= 1;
  return `He pulls to ${pullField(bats)}${pullPct} — the wind is ${helps ? "working with" : "working against"} that.`;
}
```

- [ ] **Step 2: Change the HR Weather row to show the neutral effect, and add the Spray row after it**

Replace the existing Weather `<Factor .../>` (lines 201-206) with:

```tsx
          <Factor
            icon="🌬️"
            label="Weather"
            mult={r.spray_mult ? r.weather_mult / r.spray_mult : r.weather_mult}
            note={`${typeof r.wind_mph === "number" ? Math.round(r.wind_mph) + "mph wind " : ""}${typeof r.wind_dir === "number" ? windText(r.wind_dir) : ""}${typeof r.temp_f === "number" ? `, ${Math.round(r.temp_f)}°` : ""}.`}
          />
          {typeof r.spray_mult === "number" && Math.round((r.spray_mult - 1) * 100) !== 0 && (
            <Factor
              icon="🎯"
              label="Spray"
              mult={r.spray_mult}
              note={sprayNote(r.spray_pull, r.spray_mult, r.bats)}
            />
          )}
```

- [ ] **Step 3: Replace the single HR "Recent form" row with the three-row split**

Replace lines 207-212 (the Recent form `<Factor .../>`) with:

```tsx
          {typeof r.hard_hit_form === "number" && (
            <Factor
              icon="💥"
              label="Hard-hit form"
              mult={r.hard_hit_form}
              note={r.hard_hit_form > 1 ? "Squaring the ball up harder than his season norm lately." : r.hard_hit_form < 1 ? "Softer contact than usual recently." : "Contact quality around his season norm."}
            />
          )}
          {typeof r.production_form === "number" && (
            <Factor
              icon="📈"
              label="Production form"
              mult={r.production_form}
              note={r.production_form > 1 ? "Homering at a higher rate than his season pace lately." : r.production_form < 1 ? "Below his HR pace recently." : "Around his season HR pace."}
            />
          )}
          <Factor
            icon="🔥"
            label="Recent form"
            mult={r.recent_form_mult}
            note="The blended net of hard-hit + production form."
          />
```

- [ ] **Step 4: Typecheck/build**

Run: `cd web && npm run build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add web/app/player/[prop]/[id]/page.tsx
git commit -m "feat(web): HR card — add Spray + 3-way form rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Frontend — Hits card: 3-way form + History (hits) rows

**Files:**
- Modify: `web/app/player/[prop]/[id]/page.tsx` (Hits block, ~lines 305-324)

**Interfaces:**
- Consumes: `pick(...)`, `r.hard_hit_form(+_hist)`, `r.production_form(+_hist)`, `r.bvp_hit_mult`, `r.vs.bvp` (pa/ab/hits).

- [ ] **Step 1: Replace the single Hits "Recent form" row with the three-row split**

Replace the Recent-form `<Factor .../>` (lines 310-315) with:

```tsx
          {typeof (r.hard_hit_form ?? r.hard_hit_form_hist) === "number" && (
            <Factor
              icon="💥"
              label="Hard-hit form"
              mult={pick(r.hard_hit_form ?? 1, r.hard_hit_form_hist)}
              note={pick(r.hard_hit_form ?? 1, r.hard_hit_form_hist) > 1 ? "Squaring the ball up harder than his season norm lately." : pick(r.hard_hit_form ?? 1, r.hard_hit_form_hist) < 1 ? "Softer contact than usual recently." : "Contact quality around his season norm."}
            />
          )}
          {typeof (r.production_form ?? r.production_form_hist) === "number" && (
            <Factor
              icon="📈"
              label="Production form"
              mult={pick(r.production_form ?? 1, r.production_form_hist)}
              note={pick(r.production_form ?? 1, r.production_form_hist) > 1 ? "Getting hits at a higher rate than his season pace lately." : pick(r.production_form ?? 1, r.production_form_hist) < 1 ? "Below his hit pace recently." : "Around his season hit pace."}
            />
          )}
          <Factor
            icon="🔥"
            label="Recent form"
            mult={pick(r.recent_form_mult ?? 1, r.recent_form_mult_hist)}
            note="The blended net of hard-hit + production form."
          />
```

- [ ] **Step 2: Add the History-vs-pitcher (hits) row after the Pitcher row**

Immediately after the closing `)}` of the Pitcher `<Factor>` (line 323), add:

```tsx
          {r.vs && r.vs.bvp && r.vs.bvp.pa > 0 && typeof r.bvp_hit_mult === "number" && (
            <Factor
              icon="📜"
              label={`History · vs ${r.vs.name}`}
              mult={r.bvp_hit_mult}
              note={`${r.vs.bvp.hits}-for-${r.vs.bvp.ab} career — his contact history vs this pitcher.`}
            />
          )}
```

- [ ] **Step 3: Build**

Run: `cd web && npm run build`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add web/app/player/[prop]/[id]/page.tsx
git commit -m "feat(web): Hits card — 3-way form + BvP-hits history rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Frontend — TB card: Spray + 3-way form + History (hits) rows

**Files:**
- Modify: `web/app/player/[prop]/[id]/page.tsx` (TB block, ~lines 403-423)

**Interfaces:**
- Consumes: same helpers as Tasks 5-6, plus `r.park_weather_factor(+_hist)`, `r.spray_mult`.

- [ ] **Step 1: Replace the single TB "Recent form" row with the three-row split** (same JSX as Task 6 Step 1, note copy tuned for bases)

Replace lines 403-408 with the Hard-hit / Production / Recent trio (use "driving the ball" wording for production):

```tsx
          {typeof (r.hard_hit_form ?? r.hard_hit_form_hist) === "number" && (
            <Factor icon="💥" label="Hard-hit form"
              mult={pick(r.hard_hit_form ?? 1, r.hard_hit_form_hist)}
              note={pick(r.hard_hit_form ?? 1, r.hard_hit_form_hist) > 1 ? "Squaring the ball up harder than his season norm lately." : pick(r.hard_hit_form ?? 1, r.hard_hit_form_hist) < 1 ? "Softer contact than usual recently." : "Contact quality around his season norm."} />
          )}
          {typeof (r.production_form ?? r.production_form_hist) === "number" && (
            <Factor icon="📈" label="Production form"
              mult={pick(r.production_form ?? 1, r.production_form_hist)}
              note={pick(r.production_form ?? 1, r.production_form_hist) > 1 ? "Racking up bases at a higher rate than his season pace lately." : pick(r.production_form ?? 1, r.production_form_hist) < 1 ? "Below his bases pace recently." : "Around his season bases pace."} />
          )}
          <Factor icon="🔥" label="Recent form"
            mult={pick(r.recent_form_mult ?? 1, r.recent_form_mult_hist)}
            note="The blended net of hard-hit + production form." />
```

- [ ] **Step 2: Add the Spray row, and make "Park & weather" show neutral-of-spray**

Replace the "Park & weather" `<Factor .../>` (lines 417-422) with a spray row + the de-sprayed park&weather row:

```tsx
          {typeof r.spray_mult === "number" && Math.round((r.spray_mult - 1) * 100) !== 0 && (
            <Factor icon="🎯" label="Spray"
              mult={r.spray_mult}
              note={sprayNote(r.spray_pull, r.spray_mult, r.bats)} />
          )}
          <Factor
            icon="🌦️"
            label="Park & weather"
            mult={(() => { const pw = pick(r.park_weather_factor ?? 1, r.park_weather_factor_hist); return r.spray_mult ? pw / r.spray_mult : pw; })()}
            note="The ballpark and conditions' net effect on his extra-base power (doubles, triples, homers). Singles barely move with the park, so the nudge stays modest."
          />
```

- [ ] **Step 3: Add the History-vs-pitcher (hits) row after the Pitcher row** (same JSX as Task 6 Step 2, placed after the TB Pitcher `<Factor>` at line 416).

```tsx
          {r.vs && r.vs.bvp && r.vs.bvp.pa > 0 && typeof r.bvp_hit_mult === "number" && (
            <Factor icon="📜" label={`History · vs ${r.vs.name}`}
              mult={r.bvp_hit_mult}
              note={`${r.vs.bvp.hits}-for-${r.vs.bvp.ab} career — his contact history vs this pitcher.`} />
          )}
```

- [ ] **Step 4: Build**

Run: `cd web && npm run build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add web/app/player/[prop]/[id]/page.tsx
git commit -m "feat(web): TB card — Spray + 3-way form + BvP-hits history rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Frontend — Runs/RBI card: Lineup row

**Files:**
- Modify: `web/app/player/[prop]/[id]/page.tsx` (runs/rbi block, ~lines 506-538)

**Interfaces:**
- Consumes: `pick(r.lineup_mult, r.lineup_mult_hist)`. `prop` is in scope (`"runs"` | `"rbi"`).

- [ ] **Step 1: Add the Lineup row as the FIRST factor row** (before "Hard-hit form" at line 506)

```tsx
          {typeof (r.lineup_mult ?? r.lineup_mult_hist) === "number" && (
            <Factor
              icon="📋"
              label="Lineup"
              mult={pick(r.lineup_mult ?? 1, r.lineup_mult_hist)}
              note={prop === "runs" ? "The hitters batting behind him — better bats behind raise his chance to be driven in." : "The hitters batting ahead of him — more men on base raise his RBI chances."}
            />
          )}
```

- [ ] **Step 2: Build**

Run: `cd web && npm run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add web/app/player/[prop]/[id]/page.tsx
git commit -m "feat(web): Runs/RBI card — add Lineup factor row

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Frontend — HRR card: Lineup row

**Files:**
- Modify: `web/app/player/[prop]/[id]/page.tsx` (hrr block, ~lines 611-643)

**Interfaces:**
- Consumes: `pick(r.lineup_mult, r.lineup_mult_hist)`.

- [ ] **Step 1: Add the Lineup row as the FIRST factor row** (before "Hard-hit form" at line 611)

```tsx
          {typeof (r.lineup_mult ?? r.lineup_mult_hist) === "number" && (
            <Factor
              icon="📋"
              label="Lineup"
              mult={pick(r.lineup_mult ?? 1, r.lineup_mult_hist)}
              note="The hitters around him in the order — affects his combined hits, runs, and RBI chances (dampened, since the hits portion is lineup-neutral)."
            />
          )}
```

- [ ] **Step 2: Build**

Run: `cd web && npm run build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add web/app/player/[prop]/[id]/page.tsx
git commit -m "feat(web): HRR card — add Lineup factor row

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Verification — regenerate a board + localhost preview

**Files:** none (verification only)

- [ ] **Step 1: Full Python suite green**

Run: `uv run pytest -q`
Expected: all pass.

- [ ] **Step 2: Regenerate a local board so the new fields exist in the JSON**

Run: `bash scripts/pull_board.sh` (preferred — pulls a real board) OR `uv run python -m model.export_web <today> --include-started` against cache.
Expected: `web/public/data/latest.json` contains `spray_mult` on HR/TB rows and `lineup_mult` on runs/rbi/hrr rows (spot-check with `grep`).

- [ ] **Step 3: Start the dev server and eyeball each prop card**

Run: `cd web && npm run dev`
Open a player page for HR, Hits, TB, Runs, RBI, HRR. Confirm: new rows render; Spray hidden when neutral; History (hits) only with career history; Lineup only when present; and that Weather×Spray (HR) and Park&weather×Spray (TB) visually reconcile to the prior single number.

- [ ] **Step 4: Report for preview-before-prod approval** (do NOT merge/deploy yet)

Share the localhost link + a screenshot summary; wait for explicit approval before merging `feat/surface-driving-it-dials` and deploying.

---

## Self-Review

**Spec coverage:** Spray row (Tasks 1,2,5,7) ✓ · 3-way form on HR/Hits/TB (Tasks 5,6,7; HR raw, Hits/TB twins via Task 3) ✓ · Lineup row on Runs/RBI/HRR (Tasks 8,9) ✓ · BvP-hits on Hits/TB (Tasks 6,7) ✓ · no-removal/additive (all tasks add/replace-in-place) ✓ · no math change (Tasks 1-2 are pure decompositions; Task 10 Step 1 keeps prob tests green) ✓ · gating rules (Global Constraints, applied per row) ✓.

**Placeholder scan:** none — every step has concrete code/commands. The one helper-name dependency (`_build_*_rows_with_wind` test fixtures) is flagged to reuse the suite's existing pipeline fixtures.

**Type consistency:** `spray_mult`, `spray_pull`, `hard_hit_form`, `production_form`, `bvp_hit_mult`, `lineup_mult`(+`_hist`) declared in Task 4 match every frontend read in Tasks 5-9 and every backend emit in Tasks 1-3.
