# Run-Prop Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Runs/RBI/HRR park proxy with real per-park run factors, and the always-neutral recent form with a blended hard-hit + production dial, on the `feat/runs-rbi-hrr` branch before ship.

**Architecture:** Pure-math additions in `model/parks.py` and `model/run_props.py`, recent-total accumulation in `model/profiles.py`, wiring in `model/pipeline.py` + `model/export_web.py`, two new factor rows on the Runs/RBI/HRR player pages. Spec: `docs/superpowers/specs/2026-06-25-run-prop-refinements-design.md`.

**Tech Stack:** Python (pytest, `uv run pytest`), Next.js/TypeScript (`npx tsc --noEmit`, vitest) in `web/`.

## Global Constraints

- HR + Strikeouts + Hits + Total Bases model OUTPUTS stay **byte-for-byte unchanged** (additive only).
- All calibration constants are DEFAULTS pending user sign-off — implement exactly the values in the spec's "Constants requiring sign-off" table; do not invent different ones.
- `run_park_factor` keeps its name/signature (used elsewhere) but changes its body to a table lookup.
- Forms apply to the **current** projection only; `_hist` twins stay form-neutral.
- Follow existing file patterns (HIT_FACTORS / hit_factors_stale / with_gamelog).

---

### Task 1: Real run park factors (`model/parks.py`)

**Files:** Modify `model/parks.py`; Test `tests/test_parks.py`

**Interfaces — Produces:**
- `RUN_FACTORS: dict[str,float]`, `RUN_FACTORS_LAST_PULLED = "2026-06-25"`
- `run_park_factor(team_abbr) -> float` (now a table lookup, default 1.0)
- `hrr_park_factor(team_abbr) -> float` = `1 + (run_park_factor(team_abbr)-1)*HRR_RUN_SHARE`, `HRR_RUN_SHARE = 0.55`
- `run_factors_stale(today_iso, max_days=400) -> bool`

- [ ] **Step 1: Tests** — `run_park_factor("COL")==1.15`; `run_park_factor("ZZZ")==1.0`; `hrr_park_factor("COL")==1+(0.15*0.55)` (≈1.0825); `hrr_park_factor("ZZZ")==1.0`; `run_factors_stale("2026-06-26") is False`; `run_factors_stale("2028-01-01") is True`. Assert all 30 keys present and every value in `[0.85,1.20]`.
- [ ] **Step 2:** Run, verify fail.
- [ ] **Step 3:** Add `RUN_FACTORS` (30-park table from spec), `RUN_FACTORS_LAST_PULLED`, `HRR_RUN_SHARE`, rewrite `run_park_factor` to `RUN_FACTORS.get(team_abbr, 1.0)`, add `hrr_park_factor`, add `run_factors_stale` (mirror `hit_factors_stale`).
- [ ] **Step 4:** Run, verify pass.
- [ ] **Step 5:** Commit.

### Task 2: Production form + blend + form_mult (`model/run_props.py`)

**Files:** Modify `model/run_props.py`; Test `tests/test_run_props.py`

**Interfaces — Consumes:** existing `expected_count`. **Produces:**
- `RECENT_GAMES_WINDOW = 15`, `PROD_SHRINK_GAMES = 10`
- `production_form_mult(recent_total, recent_games, season_rate, *, shrink_games=PROD_SHRINK_GAMES, lo=0.85, hi=1.15) -> float`
- `blend_forms(hard_hit, production, *, w_hard=0.60, lo=0.80, hi=1.20) -> float`
- `expected_count(... , form_mult: float = 1.0)` — form_mult multiplied into the mean

- [ ] **Step 1: Tests** —
  `production_form_mult(0, 0, 0.5)==1.0` and `(5,10,0.0)==1.0` (zero guards);
  hot: `production_form_mult(10, 10, 0.5)` → raw=2.0, shrunk=(2*10+1*10)/20=1.5, clamped to **1.15**;
  mild: `production_form_mult(6, 10, 0.5)` → raw=1.2, shrunk=(12+10)/20=1.1 → **1.1**;
  `blend_forms(1.0,1.0)==1.0`; `blend_forms(1.10,1.05)==pytest.approx(1.08)`; `blend_forms(2.0,2.0)` clamps to **1.20**; `blend_forms(0.5,0.5)` clamps to **0.80**;
  `expected_count(0.5, form_mult=1.1)==pytest.approx(0.55)`; existing `expected_count(0.5)==0.5` still holds.
- [ ] **Step 2:** Run, verify fail.
- [ ] **Step 3:** Implement the three functions / param.
- [ ] **Step 4:** Run, verify pass.
- [ ] **Step 5:** Commit.

### Task 3: Recent totals in profiles (`model/profiles.py`)

**Files:** Modify `model/profiles.py`; Test `tests/test_profiles.py`

**Interfaces — Consumes:** `RECENT_GAMES_WINDOW`. **Produces:** `with_gamelog` output additionally carries `recent_games`, `recent_r`, `recent_rbi`, `recent_hrr` (sums over the last `RECENT_GAMES_WINDOW` game-log entries by date; current-season logs only — NOT the `_hist` blend).

- [ ] **Step 1: Test** — build gamelogs of 20 games (sorted), assert `recent_games == 15` and `recent_r` equals the sum of the last 15 by date; with 8 games assert `recent_games == 8`.
- [ ] **Step 2:** Run, verify fail.
- [ ] **Step 3:** In `with_gamelog`, sort current-season logs by `game_date`, take last `RECENT_GAMES_WINDOW`, sum r / rbi / (h+r+rbi); add the four keys. Do not touch the `_hist` twins.
- [ ] **Step 4:** Run, verify pass.
- [ ] **Step 5:** Commit.

### Task 4: Pipeline wiring (`model/pipeline.py`)

**Files:** Modify `model/pipeline.py`; Test `tests/test_pipeline.py`

**Interfaces — Consumes:** `run_park_factor`, `hrr_park_factor`, `production_form_mult`, `blend_forms`, `expected_count(form_mult=...)`, profile `recent_*` + `recent_form_mult`.

In `_run_prop_rows`, per batter+prop:
- park: `hrr_park_factor(team)` for HRR, else `run_park_factor(team)`.
- hard_hit = `b.get("recent_form_mult", 1.0)`.
- production = `production_form_mult(recent_total, recent_games, season_rate)` where recent_total/season_rate come from the prop's stat (`recent_r`/`total_r`+`games`, etc.); when the profile lacks recent fields → production defaults 1.0.
- blended = `blend_forms(hard_hit, production)`; pass to `expected_count(form_mult=blended)`.
- store on row: `hard_hit_form`, `production_form`, `recent_form_mult` (= blended), `park_weather_factor` (= the park factor used).

- [ ] **Step 1: Test** — a batter hot in production yields `production_form > 1.0` and a higher `p_ge1` than the same batter with neutral recent stats; HRR row's `park_weather_factor` equals `hrr_park_factor(team)` and differs from a Runs row's `run_park_factor(team)` for COL.
- [ ] **Step 2:** Run, verify fail.
- [ ] **Step 3:** Implement wiring.
- [ ] **Step 4:** Run, verify pass.
- [ ] **Step 5:** Commit.

### Task 5: Export twins stay form-neutral (`model/export_web.py`)

**Files:** Modify `model/export_web.py`; Test `tests/test_export_web.py`

**Interfaces:** add `hard_hit_form`, `production_form` to `_run_factor_fields` (so they ride onto rows + are available for display). The `batter_hist_fn` path must NOT apply forms — `_hist` twins are the form-neutral baseline (today they already are, since the hist run uses neutral recent stats; assert it).

- [ ] **Step 1: Test** — board row exposes `hard_hit_form` + `production_form`; a row whose current production is hot has `p_ge1 > p_ge1_hist` (form lifts current, not hist).
- [ ] **Step 2:** Run, verify fail.
- [ ] **Step 3:** Add the two fields to `_run_factor_fields`; ensure hist path passes neutral recent stats (recent_* absent/zero ⇒ production 1.0; hard_hit not applied to hist). Add `run_factors_stale` to the staleness warning alongside `hit_factors_stale`.
- [ ] **Step 4:** Run, verify pass.
- [ ] **Step 5:** Commit.

### Task 6: Player-page two form rows (`web/`)

**Files:** Modify `web/lib/types.ts`, `web/app/player/[prop]/[id]/page.tsx`; Test `npx tsc --noEmit` + `npm test`

**Interfaces — Consumes:** row fields `hard_hit_form`, `production_form`, `recent_form_mult`.

- [ ] **Step 1:** Add `hard_hit_form?: number; production_form?: number` to `RunsRow`/`RbiRow`/`HrrRow` (and `_hist` not needed for these display-only forms).
- [ ] **Step 2:** In the runs/rbi/hrr blocks, replace the single "Recent form" `Factor` with two `Factor` rows — **"Hard-hit form"** (`r.hard_hit_form`) and **"Production form"** (`r.production_form`) — followed by the existing **"Recent form"** row showing the blended `recent_form_mult` net. HR/Hits/TB blocks untouched.
- [ ] **Step 3:** `npx tsc --noEmit` clean; `npm test` green.
- [ ] **Step 4:** Commit.

---

## Self-review notes
- Spec coverage: Piece 1→T1, Piece 2→T4(wire)/T3(data), Piece 3→T2+T3+T4, Piece 4→T2(blend)+T4+T6. ✓
- Byte-for-byte: only `_run_prop_rows` math + run-prop player blocks change; HR/K/Hits/TB paths untouched. ✓
- History neutrality asserted in T5. ✓
