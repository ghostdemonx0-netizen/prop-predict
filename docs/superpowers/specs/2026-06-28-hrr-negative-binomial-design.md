# HRR Distribution Upgrade — Negative Binomial (Design)

**Date:** 2026-06-28
**Status:** Design — approved in brainstorm; awaiting spec review
**Author:** brainstorm with user, 2026-06-28

---

## 1. Motivation / how we got here

Runs/RBI/HRR (Approach A) all convert a per-game rate into threshold probabilities with a **Poisson** distribution (`run_props.ge_probs` → `poisson_over_prob`). Poisson assumes events arrive **one at a time, independently** — true enough for Runs (a run is always +1).

But **HRR** is a *combined* H+R+RBI count, so it arrives in **chunks**: a home run is +1 hit, +1 run, +1 RBI = **+3 at once**; a 3-run double is +1 hit and +3 RBI at once. Chunky counts are **over-dispersed** (variance > mean), so Poisson's tail is **too thin** and it **under-estimates the high lines (3+, 4+)**. The 2+ line is roughly fine; the tail is where it misfits.

## 2. Scope

- **HRR only.** Runs and RBI keep Poisson (not chunky in the same way — a run is +1; RBI lumpiness is smaller and out of scope here, noted as a future option).
- Only the **final distribution** changes. The mean (λ) and everything feeding it — rate, pitcher, park, platoon, recent form, **Approach C lineup context**, the Current/Blend/History weightings — stay exactly as they are.

## 3. Design

### 3a. Distribution: Negative Binomial
Replace Poisson with a Negative Binomial for HRR, parameterized by **mean μ (= the existing λ)** and a **size parameter `r`** (the "lumpiness" dial):
- variance = μ + μ²/`r` (so `r` smaller → fatter tail; `r` → ∞ → Poisson).
- PMF (numerically stable via log-gamma):
  `P(X=k) = exp( lgamma(k+r) − lgamma(r) − lgamma(k+1) + r·ln(r/(r+μ)) + k·ln(μ/(r+μ)) )`
- `P(X ≥ n) = 1 − Σ_{k=0}^{n−1} P(X=k)`.
- Edge cases: `μ ≤ 0` → over-prob 0 for any positive line; `r ≤ 0` falls back to Poisson (guard).

### 3b. Lumpiness dial: one league setting
A single module constant `HRR_NB_SIZE = 4.0` (seed). Rationale: at a typical HRR mean μ≈1.8 this gives variance ≈ μ + μ²/4 ≈ 2.6 (~1.5× the mean) — a realistic, mild over-dispersion that fattens the 3+/4+ tail without overshooting. **Seed value, tuned from grader data over time** (same as the Approach C constants). Same value for every hitter (the shape shifts with each player's own μ).

### 3c. Wiring
- Add `projections.nb_over_prob(mu: float, line: float, size: float) -> float` next to `poisson_over_prob` (same `line` semantics: `.5` line → P(X ≥ ceil); integer line → strictly greater).
- `run_props.ge_probs(lam, thresholds, *, nb_size=None)`: when `nb_size` is given, use `nb_over_prob(lam, line, nb_size)`; else `poisson_over_prob` (unchanged default → back-compat for Runs/RBI and existing tests).
- `_RUN_PROP_CFG["HRR"]` carries `"nb_size": HRR_NB_SIZE`; RUNS/RBI carry none (→ `cfg.get("nb_size")` is None → Poisson).
- `_run_prop_rows` passes `nb_size=cfg.get("nb_size")` into `ge_probs`.

### 3d. Weightings
NB applies in all three weightings (Current/Blend/History) automatically — HRR rows are built by the same `_run_prop_rows` in every mode, so the conversion swap covers all twins. `HRR_NB_SIZE` is a constant, identical across twins.

## 4. Recorder / grader

**No change.** Only the HRR `p_ge2/p_ge3/p_ge4` values change; those fields are already archived and graded. No new factor.

## 5. Constants (sign-off)

| Constant | Value | Meaning |
|---|---|---|
| `HRR_NB_SIZE` | 4.0 (seed) | NB size/dispersion; lower = fatter tail. Tunable from grader data. |

## 6. Testing (TDD)

- `nb_over_prob`: with very large `size` it ≈ `poisson_over_prob` (Poisson limit); with small `size` it gives a **higher** P(X≥3) than Poisson at the same mean (fatter tail); `μ=0` → 0; monotonic (P(≥2) ≥ P(≥3) ≥ P(≥4)).
- Numeric pin: e.g. `nb_over_prob(1.8, 2.5, 4.0)` is strictly greater than `poisson_over_prob(1.8, 2.5)`.
- `ge_probs(..., nb_size=None)` is byte-identical to today (Poisson); `nb_size=4.0` differs and stays monotonic.
- Integration: an HRR row's `p_ge3` is higher than the Poisson value at the same λ; a Runs row is unchanged; thresholds stay monotonic.
- Full suite green (existing run-prop tests that pin Poisson HRR numbers updated to the NB baseline, noted in the commit).

## 7. Future refinements (roadmap)

- Per-player lumpiness shrunk toward the league value (brainstorm Option 3) if grader shows boom-or-bust hitters need it.
- Consider mild NB for RBI (grand slams = +4) if the data warrants.
- Tune `HRR_NB_SIZE` from accumulated grader data.

## 8. Sign-off

Model-math change. Build via spec → plan → SDD; preview before prod.
