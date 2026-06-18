# History-Weighted Projections — Design Spec

**Date:** 2026-06-17
**Status:** Approved (design); awaiting spec review → implementation plan
**Math sign-off:** user approved the recipe in chat 2026-06-17 (weights, regression, no age adj, scope)

## Goal

Add a user-facing **projection-source toggle** with two modes:

- **Current season only** — exactly today's site behavior, unchanged (the default).
- **History-weighted (3-yr)** — the player's *baseline skill rates* are replaced by a Marcel-style weighted blend of the last 3 seasons, steadying small/early-season samples. Everything situational stays live.

The toggle applies to every place player projections appear (Props boards, Game Hub, Top Plays). It does **not** affect Parks (no player projections there).

## What the toggle swaps (scope)

A projection = **baseline skill** × **situational adjustments**. The toggle swaps only the baseline skill rates:

| Swapped in history mode (baseline skill rates) | Always stays current/live (unchanged) |
|---|---|
| batter HR-per-PA | recent hot/cold form |
| batter strikeout-per-PA | park factor |
| batter hit-per-PA | weather |
| pitcher strikeout-per-PA | platoon / handedness |
| pitcher hit-allowed-per-PA | opposing-pitcher quality multiplier |
| pitcher HR-allowed-per-PA | **BvP history dial** (career vs this pitcher — already its own thing) |
| | pitcher strikeout **line** (his "typical night" benchmark) |
| | pitcher **workload** (expected batters faced) |

Rationale: situational factors are about *tonight*, not about how good the player is overall; the strikeout line and workload reflect the pitcher's *current role*, so they stay current-season even in history mode. The BvP dial is already a separate career-history adjustment and is untouched.

## The blend math

For each baseline rate (illustrated with HR-per-PA), take the player's **real totals** from up to 3 seasons — current year **as-of the slate date** (strictly-before, no lookahead, matching the existing profile logic), prior two years complete — and combine with weights **5 / 4 / 3** (current / last / two-years-ago):

```
W_made = 5·made_Y + 4·made_(Y-1) + 3·made_(Y-2)      # only seasons with data
W_pa   = 5·pa_Y   + 4·pa_(Y-1)   + 3·pa_(Y-2)
blended_rate = W_made / W_pa
```

**Normalize to a single-season-equivalent** so the model's existing regression calibration applies unchanged:

```
effective_pa   = W_pa   / 5      # divide by the top weight
effective_made = W_made / 5      # == blended_rate · effective_pa
```

This gives a recency-weighted "effective sample size": a player with 3 full ~600-PA seasons lands near ~1,440 effective PA (high confidence); a rookie with only a 100-PA partial current season lands at ~100 effective PA (low confidence). Worked example (HR): seasons 10/200, 30/600, 25/600 → W_made = 245, W_pa = 5,200 → blended_rate ≈ 4.7%, effective_pa = 1,040.

### Pull-toward-league-average (regression to the mean)

Applied **after** the blend, to the `(effective_made, effective_pa)` pair — the same shrinkage the model already uses, so hot/thin samples never go wild. More effective PA → less pull.

```
final_rate = (effective_made + league_rate · R) / (effective_pa + R)
```

| Rate | league_rate | R (phantom PA) | Notes |
|---|---|---|---|
| HR-per-PA | 0.033 (`LEAGUE_HR_RATE`) | 300 | **Unchanged** — same constant the model uses today |
| K-per-PA | 0.225 (`LEAGUE_K`) | 200 (proposed) | **New in history mode** — K/hit stabilize faster than HR, so a slightly smaller R |
| hit-per-PA | 0.22 (`LEAGUE_HIT`) | 200 (proposed) | **New in history mode** |
| pitcher HR-allowed | 0.033 | 300 | mirrors batter HR |
| pitcher K / hit-allowed | 0.225 / 0.22 | 200 | mirrors batter K/hit |

R values are starting points, validated/tuned with tests during implementation; the user can revisit. **Current-season-only mode keeps today's behavior exactly: HR keeps its existing pull-to-average; K and hit stay raw.** Adding the K/hit net to *current* mode is a deliberate **roadmap item** for after the user evaluates history mode.

> **Equivalence note (reconciles the earlier whiteboard formula):** normalizing by 5 then regressing with `R` is *mathematically identical* to regressing the raw weighted totals directly with an anchor of `5·R` — i.e. `final = (W_made + league·A) / (W_pa + A)` with `A = 1500` for HR. Same result; the normalized form just lets us reuse the model's existing, already-trusted per-season constants (300 for HR).

### Edge cases

- **Limited history (rookies, young players, injuries):** use whatever seasons exist. A true rookie with only the current season blends just that one (weight 5), then gets pulled to average — i.e., history mode ≈ current mode for him. Never breaks; degrades smoothly.
- **Missing a prior season** (didn't play / no data): that season contributes 0 and is dropped from the weights.
- **No data at all** (`W_pa == 0`): same fallback as today (rate 0 / "no projection").

## Architecture

### Engine (Python)

- **New pure module** (e.g., `model/blend.py`): `marcel_blend(per_season_totals, weights=(5,4,3))` → `(effective_made, effective_pa)`, plus a `regress(made, pa, league_rate, R)` helper. Pure, fully unit-tested.
- **Prior-season data:** reuse `fetch.batter_events(pid, season-1/-2)` and `fetch.pitcher_events(...)`, cached as `bat-events-{pid}-{year}` / `pit-events-{pid}-{year}`. Prior seasons are static → cached permanently (one-time pull, then free). The current season cache continues refreshing via the rolling window.
- **One-time backfill** of the two prior seasons for all relevant players is chunky; run it **off-budget** (locally or a one-off long-timeout workflow), not inside a normal 30-min run. After that, daily runs only ever touch the current day.
- **Blended profiles:** a history-mode profile builder combines per-season `*_from_events` counts into blended rates, reusing `profiles.py` to count each season, then applying `blend.py`.
- The existing pure projection functions (`hr_probability`, `matchup`, `expected_strikeouts`, etc.) are **unchanged** — they just receive blended base rates instead of single-season ones.

### Board data (dual values in one file)

Because the board is pre-generated (the robot computes it; the frontend only displays), the export computes **both** modes and stores both in the same JSON, so the toggle is **instant** (no refetch). Situational multipliers are computed once and **shared** across modes — only the base rate and the values that depend on it differ — so the added payload is small.

Per-row additions (history-mode twins of the base-rate-dependent outputs only):
- HR rows: `probability_hist` (+ blended base rate for the player-page breakdown).
- K rows: `over_prob_hist`, `expected_ks_hist`.
- Matchup reads (the K/C/N spheres, on HR rows' `vs` and K rows' per-batter `matchups`): `k_prob_hist`, `hit_prob_hist`, `lean_hist`, `prob_hist`.

The robot computes both modes every run; the heavy cost (prior-season pulls) is one-time and cached, so steady-state runs stay fast.

### Frontend

- A small global **`Current · History (3-yr)`** toggle, applied to all projection numbers wherever they appear (Props, Game Hub, Top Plays). Placement: in the selector area near the section/prop pills. **Default: Current season** (preserves today's behavior).
- When set to History, every displayed projection reads the `*_hist` field instead of the current one. Player-page breakdowns show the blended base rate; situational multipliers display identically (they're shared).
- A short tooltip/label explains: "blends the last 3 seasons (5/4/3) for a steadier baseline — situational factors stay live."

## Season rollover & cache lifecycle

Weights key off **recency relative to the slate year** (Y, Y−1, Y−2), never hardcoded years — so the window auto-shifts every Jan 1 with **no re-download**:

- The just-finished season is already fully cached from its daily folds; it simply changes role (current → last-year) and picks up the lighter weight automatically. The new current season accumulates fresh via the same incremental daily fold. **This is the spring cold-start rescue** — April of a new year is carried by the prior two full seasons instead of near-empty data.
- **Never delete in-window prior-season caches** — they're frozen and reused.
- **Auto-sweep:** bake a cleanup into rollover that deletes season-event caches **older than the 3-year window** (safe — re-downloadable). The season that falls out of the window becomes an orphaned cache to remove.
- **Two independent cache systems** (keep separate): (a) season caches `bat/pit-events-{pid}-{year}` = our rolling 3-yr skill-rate window (oldest swept); (b) `bvp-*` head-to-head = MLB's all-time record, re-queried/cleared daily, never rolls or expires. The rollover touches only (a).

## Testing

- **Unit tests (pure):** `marcel_blend` weights & normalization; `regress` shrinkage behavior; edge cases (1 season, 2 seasons, zero data, zero-PA prior).
- **Profile tests:** blended batter/pitcher profile from multi-season event fixtures.
- **Calibration sanity:** history-mode probabilities stay in-range and move sensibly vs current mode on representative players (rookie shrinks hard; steady veteran barely moves; hot-start player pulled toward his multi-year norm).
- No change to existing current-mode tests (behavior preserved).

## Out of scope (v1) / roadmap

- **Age adjustment** (aging curve) — deferred; the 5/4/3 recency weighting already captures most of aging implicitly.
- **K/hit pull-to-average in *current* mode** — deferred; decide after evaluating history mode.
- Per-stat custom weighting, configurable lookback length, or BvP blending — not needed.
