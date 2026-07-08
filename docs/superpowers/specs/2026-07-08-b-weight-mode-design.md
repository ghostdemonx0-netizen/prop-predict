# Barrel Weight (b weight) Mode — Design Spec

- **Date:** 2026-07-08
- **Branch:** `feat/barrel-edge`
- **Status:** Design (approved through plain-language brainstorming).
- **Sign-off:** **YES** — a new per-prop probability the user can switch to. Ships with a before/after smoke; recorded + graded so the sauce experiments can be judged later. [[math-changes-need-signoff]]

---

## 1. Goal
Build **Barrel Weight** — the barrel-*dominant* philosophy (the 4th weighting option, its own Current/Blend/History sub-row). Where **b effect** is a capped *nudge* on the normal number, **b weight** is a distinct philosophy: **barrel drives the number**, the environmental "sauce" (park / weather / BvP) steps aside (**pure replica v1**), and the result is a **probability** the board shows when "Barrel Weight" is selected. HR is its home turf (full pantry). Models how Kasper / Barrel Lab operate (barrel-first). It **never mixes into the Normal blend** — it's its own mode.

## 2. The mechanism (locked with user)
Same 3 layers: BASE (real production, Layer 1) and MACHINERY (Layer 3) **never change**; only Layer 2 (adjust) swaps to barrel-dominant.

```
b_weight_rate  = pure_base_rate × barrel_dominant_mult          # Layer 2 = barrel only
probability_bweight = MACHINERY(b_weight_rate)                   # Layer 3 unchanged
```
- **`pure_base_rate`** = the prop's raw, regressed base production **with every matchup/park/weather/BvP factor left at neutral (1.0)** — the "what does this hitter do, ungarnished" rate. (Each build function already computes this as its first `regress(...)` / `hr_rate_per_pa(..., mults=1.0)` term.)
- **`barrel_dominant_mult`** = `barrel_effect_mult(hitter, pitcher, prop=<prop>, cap=0.60)` — the SAME per-prop barrel recipes from A1 (barrel + contact + pitcher-barrel-allowed + ZoneFit + SwStr), but on a **long ±60% leash** instead of ±20%.
- **MACHINERY** = the prop's existing rate→probability step (threshold vector `count_ge_prob`, HR rate→prob, run-prop `ge_probs`) — reused unchanged.

**Pure replica:** park / weather / BvP / the crude pitcher factor are **OFF** (left at 1.0). The barrel recipe's own **pitcher-barrel-allowed** carries the matchup, so the pitcher still matters — through barrel, not the crude rate (no double-count). Base rate still anchors, so a genuinely weak hitter can't be carried to the moon.

## 3. Leash + roles (locked)
- **±60% cap** (`barrel_dominant_mult` in [0.40, 1.60]) — barrel really drives; grader-tunable SEED.
- **HR = home turf** — uses the full barrel pantry (already its A1 recipe).
- **Reuses A1's recipes** verbatim; only the cap changes (0.20 → 0.60) via a new `cap` override on `barrel_effect_mult`.
- **Sauce comes back LATER, strategically** (weather first — the strongest), each proven beneficial by the grader before it stays. Logged as a roadmap follow-up; NOT in v1.

## 4. Architecture
- **`model/barrel_effect.py`** — add an optional `cap` override to `barrel_effect_mult(hitter, pitcher, *, prop, cap=None, n_stable)`: when `cap` is given, use it instead of `_RECIPES[prop]["cap"]`. (b effect keeps calling without it → unchanged.)
- **Per-prop build functions** (`model/pipeline.py`): alongside the existing normal + `_beff` computations, add a **b weight** computation = MACHINERY(pure_base_rate × barrel_dominant_mult(cap=0.60)). Emit `probability_bweight` (HR) and `p_geN_bweight` (threshold/run props). The `pure_base_rate` is the raw base term (no factors); reuse the existing base/neutral rate each function already has.
- **Export twins + recorder** (`export_web.py`, `archive.py`) — attach the history `_bweight` twins and archive a "barrel-weight" probability triple, mirroring the `_beff` pattern from A1.
- **Frontend** (`web/lib/weighting.ts`, `barrelLens.ts`, `page.tsx`) — the **"Barrel Weight"** philosophy option already exists in the UI (from the visual prototype). Wire `toBoardRows` so when `philosophy === "barrel"` it reads the `_bweight` probabilities (per prop), with its own Current/Blend/History timeframe. It is a SEPARATE mode — never blended with Normal.
- **Prop Score** (already built) stays the b-weight board headline; this adds the per-prop *probabilities* underneath it.

## 5. Recording / grading
Wire `probability_bweight` / `p_geN_bweight` into the recorder (a "barrel-weight" triple, like the "barreled" triple). The grader then measures b weight's accuracy — and, crucially, gives us the yardstick to judge each **sauce** addition later (record pure vs +weather, compare).

## 6. Testing
- `barrel_effect_mult` `cap` override: `cap=0.60` reaches ±60%; omitting it uses the recipe cap (b effect unchanged).
- Per-prop: a `probability_bweight`/`p_geN_bweight` twin appears; it equals MACHINERY(pure_base × barrel(0.60)); the NORMAL probability + `_beff` twins are byte-identical (additive).
- Full suite green.
- **Before/after smoke** (sign-off): real hitters — show Normal prob vs Barrel-Weight prob for HR (+ one contact prop); an elite barrel bat in a great barrel spot should swing FAR up under b weight (big leash), a weak-barrel bat far down; confirm the base still anchors.

## 7. Non-goals
- The sauce (park/weather/BvP) in v1 — deferred, weather-first, grader-proven.
- Changing b effect, the Normal mode, or any Layer 1/3 machinery.
- b weight bleeding into the Normal blend (kept fully separate).
- Auto-tuning the ±60% cap or recipe weights (grader later).
