# Tier 1 Threshold Props (Hits + Total Bases) — Design Spec

**Date:** 2026-06-18
**Status:** Design approved in chat (thresholds + TB model + recipe); awaiting written-spec review → plan
**Math sign-off:** user approved the recipe in chat 2026-06-18. Final numeric constants confirmed here for review.

## Goal

Add two new player props alongside Home Runs and Strikeouts, each with an over-threshold filter:

- **Hits** — P(≥1), P(≥2), P(≥3) hits in the game. Default 1+.
- **Total Bases** — P(≥2), P(≥3), P(≥4) total bases. Default 2+.

Both reuse the existing board, views, Top Plays, player pages, platoon glow, and the **history (3-yr) toggle**. Home Runs and Strikeouts stay byte-for-byte unchanged. Runs / RBIs / H+R+RBI combo are explicitly **out of scope** (need new data — see roadmap).

## Core math

### 1. Per-at-bat outcome distribution

For a batter, derive per-plate-appearance probabilities for each base outcome, from his rates (same Statcast events we already use → **history toggle works automatically**):

- `p1` single, `p2` double, `p3` triple, `p4` home run, and `p0 = 1 − (p1+p2+p3+p4)` (everything else).

Each component rate is **regressed toward its league average** (same shrinkage the model already uses, so thin/hot samples don't blow up):

```
rate_c = (made_c + LEAGUE_c · R_c) / (PA + R_c)
```

| Component | LEAGUE_c (per PA, approx — tunable) | R_c | Notes |
|---|---|---|---|
| single | 0.138 | 200 | new constant |
| double | 0.045 | 200 | new constant |
| triple | 0.005 | 200 | new constant |
| home run | 0.033 (`LEAGUE_HR_RATE`) | 300 | **reuses the existing HR rate + full HR adjustment chain** |

In **history mode** the per-component `made_c`/`PA` are the 5/4/3 blended totals (Task-2 style), then regressed — identical pattern to the history feature. In **current mode** they're the single-season counts.

### 2. Adjustments (reuse existing machinery)

- **HR component** uses the *same per-PA HR rate the Home Runs prop already computes* — platoon × opposing-pitcher × park × weather × recent-form (and the BvP dial, which stays HR-only). This keeps Total Bases' HR contribution consistent with the HR board.
- **Single/double/triple components** get the **matchup + platoon** adjustment via the existing log5 `hit_prob` machinery (applied as the matchup hit multiplier) and **recent form**. *v1 simplification:* park/weather are applied to the HR component only (as today); 1B/2B/3B are left park/weather-neutral. (Noted as a tunable v1 choice — doubles/triples are mildly park-sensitive; revisit later.)

### 3. Per-at-bat → whole-game combiner (new pure function)

A single convolution serves both props:

```
count_ge_prob(outcome_probs: list[float], expected_pa: float, n: int) -> float
```

- `outcome_probs[i]` = probability of `i` units in ONE plate appearance.
  - **Hits:** `[1−p_hit, p_hit]` (0 or 1).
  - **Total Bases:** `[p0, p1, p2, p3, p4]` (0–4).
- **Fractional at-bats:** `expected_pa` (≈4, by lineup slot via `expected_pa_for_slot`) is fractional. Model `floor(expected_pa)` guaranteed PAs plus one extra PA that occurs with probability `frac = expected_pa − floor`: the fractional PA's vector is `(1−frac)·[1,0,…] + frac·outcome_probs`.
- Convolve all PA vectors → distribution over the game total → return `P(total ≥ n)`.

This correctly handles **"a home run = 4 bases in one swing"** (the user-approved accurate model): one HR PA contributes a 4 directly, so it clears the 4+ line on its own.

Hits are mathematically the same engine with a 2-element vector.

## Architecture

### Engine (Python)
- **New pure module** `model/counts.py`: `count_ge_prob(...)` (+ a small `convolve` helper). Fully unit-tested (known distributions, fractional PA, ≥N tails, HR-clears-4 case).
- **Extend `model/profiles.py`:** add per-PA single/double/triple counts to the batter profile (HR already present), plus the history-blended equivalents — additive, existing functions untouched.
- **New pipeline builders** `model/pipeline.py`: `build_hits_rows(...)` and `build_total_bases_rows(...)` — mirror `build_hr_rows`' structure (per not-started game, per batter, reuse weather/park/matchup/bvp), emitting per-threshold probabilities: Hits `{p_ge1, p_ge2, p_ge3}`, TB `{p_ge2, p_ge3, p_ge4}`, plus the shared display fields (player, team, matchup, hand, vs, wind, etc.).
- **`model/export_web.py`:** compute both props in **current and history modes** and attach `*_hist` twins (same dual-value pattern as HR), via `build_board_with_history`. New payload keys: `hits` and `total_bases` arrays.

### Board data
- Each Hits row: `p_ge1, p_ge2, p_ge3` (+ `_hist` twins) + display fields.
- Each TB row: `p_ge2, p_ge3, p_ge4` (+ `_hist` twins) + display fields.

### Frontend
- **Two new prop pills** in the Props row: `Hits`, `Total Bases` (after Home Runs, Strikeouts).
- A **threshold selector** for the active prop (Hits: 1+/2+/3+, default 1+; TB: 2+/3+/4+, default 2+) — small pill group near the prop pills (styled like the Top Plays count selector). The selected threshold picks which `p_geN` becomes the row's `prob` (so cards/table/Top Plays/Game Hub all rank & display by it, unchanged downstream).
- **History toggle** applies via the same source-aware mapping (reads `p_geN` vs `p_geN_hist`).
- **Top Plays:** add `Top Hits` and `Top Total Bases` collapsible sections (ranked by the current threshold).
- **Player pages:** Hits / TB detail pages showing the per-threshold probabilities + the factor breakdown (reusing the HR page layout), source-aware.

### Untouched
Home Runs and Strikeouts props, their math, and their board output are unchanged. The threshold props are purely additive.

## Testing
- **Unit (pure):** `count_ge_prob` — single PA, multiple PAs, fractional PA, ≥N tail correctness, and the HR→4-bases case (one PA of `[…,1.0 at index4]` gives P(≥4)=1 over ≥1 PA); component regression; profile single/double/triple counts (current + blended).
- **Pipeline:** hits/TB rows from event fixtures; per-threshold values sane and monotonic (P(≥1) ≥ P(≥2) ≥ P(≥3)).
- **Calibration sanity:** a slugger's TB 4+ noticeably higher than a slap hitter's; history vs current shifts as expected.
- No change to existing HR/K tests.

## Out of scope / roadmap
- **Runs, RBIs, H+R+RBI combo** — need a new data source (game logs / base-state); separate project. See [[props-expansion-roadmap]].
- Park/weather on 1B/2B/3B (v1 leaves them neutral); per-component platoon nuance — tunable later.
