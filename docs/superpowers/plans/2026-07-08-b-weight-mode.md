# Barrel Weight (b weight) Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Build the Barrel Weight philosophy — a per-prop probability = `MACHINERY(pure_base_rate × barrel_dominant_mult(cap=0.60))`, sauce (park/weather/BvP) OFF — selected by the "Barrel Weight" mode.

**Architecture:** Reuses A1's `barrel_effect_mult` (with a new `cap` override → ±60%) and the props' existing rate→probability machinery. Each build function adds a parallel b-weight computation emitting `probability_bweight` / `p_geN_bweight`, mirroring how A1's `_beff` twins were wired (twins → export → recorder → frontend).

**Tech Stack:** Python 3 (pytest), Next.js/TypeScript (vitest).

## Global Constraints
- **Spec:** `docs/superpowers/specs/2026-07-08-b-weight-mode-design.md`.
- **SIGN-OFF build.** Sign-off is Task 6's smoke — do NOT deploy.
- **Pure replica:** b weight uses ONLY the raw base rate × the barrel-dominant mult. Park/weather/BvP/crude-pitcher factors are NEUTRAL (1.0) in the b weight path — the barrel recipe's pitcher-barrel-allowed carries the matchup. The base rate anchors.
- **Additive / non-destructive:** the Normal probability AND the `_beff` twins stay byte-identical. Only new `_bweight` keys added.
- ±60% cap is a grader-tunable SEED. Reuses A1 recipes verbatim (only the cap changes).
- Full pytest suite green each task; frontend `tsc --noEmit` clean + no new lint in touched files; vitest where touched.
- Mirror A1's `_beff` twin wiring (`docs/superpowers/plans/2026-07-07-a1-barrel-effect-all-props.md`) for the parallel `_bweight` twin — same shapes, different multiplier/cap and it starts from the PURE BASE rate (not the full-factor prob).

---

### Task 1: `cap` override on `barrel_effect_mult`

**Files:** Modify `model/barrel_effect.py`, `tests/test_barrel_effect.py`.

- [ ] **Step 1: Failing test** — `barrel_effect_mult(maxed_hitter, vuln_pitcher, prop="hr", cap=0.60)` reaches up to 1.60 (not 1.20); omitting `cap` still uses the recipe's 0.20 (b effect unchanged). Reuse the existing max-fixtures.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** — add `cap: float | None = None` to `barrel_effect_mult(hitter, pitcher, *, prop="hr", cap=None, n_stable=_N_STABLE)`. Use `eff_cap = cap if cap is not None else recipe["cap"]` in the final `1.0 + d * eff_cap`. Nothing else changes.
- [ ] **Step 4: Run → pass; full suite green** (existing calls pass no `cap` → identical).
- [ ] **Step 5: Commit** — `feat(bweight): cap override on barrel_effect_mult (±60% for barrel-weight mode)`.

---

### Task 2: b weight for HR + threshold props (Hits, TB)

**Files:** Modify `model/pipeline.py`, `tests/test_pipeline.py` (+ `tests/test_hr_beff.py` pattern).

- [ ] **Step 1: Failing tests** — an HR row carries `probability_bweight`; hits/TB rows carry `p_geN_bweight` for each threshold; each equals `clamp(pure_base_prob × barrel_effect_mult(prop, cap=0.60), 0, 1)`; the Normal `probability`/`p_geN` and `_beff` twins are unchanged.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** — in `build_hr_rows` and `_threshold_rows`:
  - Compute `bw_mult = barrel_effect_mult(b, opp, prop=<prop>, cap=0.60)`.
  - Compute the **pure base probability** for the prop = the machinery applied to the raw regressed base rate with NO factors. For HR: reuse the base HR rate (`hr_rate_per_pa(season_hr, pa)` with all mults 1.0) → its 1+ prob. For threshold props: build the base outcome vector from the raw `regress(season_1b/2b/3b, pa, ...)` terms (hit_factor=form=park=wx=hit_mult=1.0) → `count_ge_prob`. (Many functions already compute a neutral/base vector — reuse it; if it carries park/weather/form, recompute a fully-neutral one for b weight.)
  - Emit `probability_bweight = clamp(base_hr_prob × bw_mult, 0, 1)` (HR) and `row[f"{label}_bweight"] = clamp(base_threshold_prob × bw_mult, 0, 1)` per threshold.
  - Base `probability`/`p_geN` + `_beff` untouched.
- [ ] **Step 4: Run tests + full suite green.**
- [ ] **Step 5: Commit** — `feat(bweight): HR + Hits + TB carry probability_bweight (pure base × ±60% barrel)`.

---

### Task 3: b weight for run props (Runs, RBI, HRR)

**Files:** Modify `model/pipeline.py`, `tests/test_pipeline.py`.

- [ ] **Step 1: Failing test** — Runs/RBI/HRR rows carry `p_geN_bweight` per threshold = `ge_probs(pure_base_rate × bw_mult)`.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** — in `_run_prop_rows`: `bw_mult = barrel_effect_mult(b, opp, prop=prop.lower(), cap=0.60)`; the **pure base rate** = the raw regressed per-PA rate BEFORE pitcher/park/platoon/lineup mults (reuse the `rate`/`season_rate` base term the function already computes for `baseline_p_geN`, but ensure it's the fully-neutral base); `row.update({f"{field}_bweight": v for field,v in ge_probs(base_rate × bw_mult, cfg["thresholds"]).items()})`.
- [ ] **Step 4: Run tests + full suite green.**
- [ ] **Step 5: Commit** — `feat(bweight): Runs + RBI + HRR carry p_geN_bweight (pure base × ±60% barrel)`.

---

### Task 4: Export history twins + recorder

**Files:** Modify `model/export_web.py`, `model/archive.py`, `tests/test_boards_payload.py`, `tests/test_archive.py`.

- [ ] **Step 1: Failing tests** — history `_bweight` twins surface (`probability_bweight_hist` / `p_geN_bweight_hist`); the recorder writes a `"{label} barrel-weight"` probability triple for each prop. Mirror A1's `_beff`/`"barreled"` tests.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** — in `export_web.py`, alongside the `_beff_hist` twin copies (HR twin loop, hits/TB loops, generic `_attach`), copy the `_bweight` history twins. In `archive.py`, alongside the `"barreled"` triples, add `"{label} barrel-weight"` triples from `probability_bweight`/`p_geN_bweight` (+ `_hist`), same `_blend` helper, guarded on presence.
- [ ] **Step 4: Run tests + full suite green.**
- [ ] **Step 5: Commit** — `feat(bweight): history _bweight twins + barrel-weight archive triples for all props`.

---

### Task 5: Frontend — "Barrel Weight" mode reads the _bweight probabilities

**Files:** Modify `web/lib/weighting.ts`, `web/lib/types.ts`, `web/lib/tests/weighting.test.ts` (and confirm `barrelLens.ts`/`page.tsx` already route `philosophy === "barrel"`).

- [ ] **Step 1: Failing vitest** — `toBoardRows` with `philosophy`/source indicating Barrel Weight reads `probability_bweight` (HR) and `p_geN_bweight` (threshold/run) instead of the Normal fields. Mirror the A1 barrel-effect test.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** — `types.ts`: add `probability_bweight?`/`p_geN_bweight?` (+ `_hist`) to the row types (mirror the `_beff` fields). `weighting.ts`: `toBoardRows` gains awareness of the Barrel-Weight mode (a param or reuse the existing lens/source signal) and, when active, selects the `_bweight` fields for every prop (HR + threshold + run). It is a SEPARATE mode — do NOT blend with Normal. Confirm `barrelLens.ts` `boardsLens` already returns `"barrel"` for `philosophy === "barrel"` and that `page.tsx` passes the philosophy down; wire the prob-selection to it.
- [ ] **Step 4: Verify** — vitest pass; `npx tsc --noEmit` clean; `npm run lint` no new errors in touched files.
- [ ] **Step 5: Commit** — `feat(bweight): Barrel Weight mode selects the barrel-dominant probabilities`.

---

### Task 6: Before/after smoke (sign-off)

**Files:** Create `scripts/smoke_bweight.py`.

- [ ] **Step 1: Write the smoke** — for real 2024 hitters (an elite-barrel bat, a contact bat, a weak-barrel bat) vs a barrel-vulnerable + a stingy pitcher, print the **Normal** HR prob vs the **Barrel-Weight** HR prob (and one contact prop), using `pure_base × barrel_effect_mult(prop, cap=0.60)`. Mirror `scripts/smoke_a1.py`.
- [ ] **Step 2: Run + record** — network; retry/swap if a fetch fails. Assess: elite barrel + good spot swings FAR up under b weight (big leash); weak barrel swings far down; base still anchors (a weak hitter isn't carried to absurdity); sensible vs the Normal number. Paste the table.
- [ ] **Step 3: Commit** — `chore(bweight): real-data Normal-vs-BarrelWeight smoke (for sign-off)`.

---

## Self-Review
**Coverage:** cap override (T1) · HR+Hits+TB (T2) · Runs+RBI+HRR (T3) · export+recorder (T4) · frontend mode (T5) · smoke (T6). Pure replica (sauce off), base anchors, ±60% leash, reuses A1 recipes, own mode. ✅
**Placeholder scan:** none — approach + per-prop wiring + mirror-A1 references throughout.
**Type consistency:** `barrel_effect_mult(..., cap=None)`; twins `probability_bweight`/`p_geN_bweight` (+ `_hist`); recorder `"{label} barrel-weight"`; frontend reads `_bweight` for `philosophy === "barrel"`.
**Deferred:** the sauce (weather-first, grader-proven), cap/weight auto-tuning.
