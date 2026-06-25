# Runs + RBI + HRR Props — Design Spec

**Date:** 2026-06-25
**Status:** Design approved by user (2026-06-25); ready for implementation plan.
**Related:** props-expansion-roadmap (Tier 2/3), prop-predict-architecture, history-weighted-projections, per-park-hit-factors. Math change → **requires user sign-off on constants during the build** (math-changes-need-signoff).

## Goal

Add three new batter props to the board: **Runs**, **RBI**, and **HRR** (Hits+Runs+RBI combined), each with over-thresholds, fully integrated into the existing board / Top Plays / Game Hub / player pages / Current·Blend·History weighting.

## Why this is a new kind of build

Today the model derives per-PA outcomes (single/double/triple/HR/K…) from cached Statcast batted-ball events. **Runs and RBIs are not in that data** — a run is scored later by a teammate, an RBI depends on who is on base. They are box-score, lineup-context outcomes. So this build adds a **new data source** (per-player game logs) and projects at the **per-game** level rather than the per-PA level.

## Scope

**In (v1 = "Approach A"):**
- Props: **Runs**, **RBI**, **HRR**.
- Thresholds: **Runs 1+ / 2+** (default 1+), **RBI 1+ / 2+** (default 1+), **HRR 2+ / 3+ / 4+** (default 2+).
- Projection from each player's own per-game rate, regressed toward a baseline, adjusted for opposing-pitcher run/hit suppression + platoon (handedness) + park run environment.
- Threshold probabilities via **Poisson** on the expected per-game count.
- HRR modeled directly on the **combined H+R+RBI per-game total** (correlation baked in).
- Full integration: pills, threshold selectors, Top Plays sections, player detail pages, **Game Hub breakdown columns**, and Current/Blend/History weighting (game logs pulled for current + 3 prior seasons).

**Out (deferred to roadmap):**
- **Lineup-context layer (Approach C):** nudge Runs by the on-base ability of hitters batting behind a player, and RBI by who bats ahead + the player's power, using the projected lineup + per-PA rates we already compute. The planned v2.
- **Full simulation (Approach B):** mechanistic baserunner/lineup simulation. Future big project.
- **Better threshold distribution:** replace Poisson with a distribution that captures HRR "chunkiness" (a HR adds +3 to the combined total at once) and the bounded nature of per-game counts. Roadmap upgrade.
- **Deep career batter-vs-pitcher history dial** for R/RBI/HRR: samples too thin and too teammate-dependent to be predictive in v1. Revisit only if data shows it helps.

## Data layer

A new **game-log fetch + cache** (alongside the existing events cache in `model/fetch.py` / `model/cache.py`):
- Source: MLB Stats API (the `statsapi` package already used) — per-player hitting **game logs**: date, **R, RBI, H** per game (and games played / PA for rate denominators).
- Window: current season + 3 prior seasons (to feed Current and History/Blend).
- Cached on disk under `.cache/` like events; reruns fast; respects the same rebuild mechanics (clean-cache-rebuild).
- Slim the records to the needed columns only (consistent with the existing slimmed event cache).

## Model / math

New pure module (e.g. `model/run_props.py`), unit-tested like `model/counts.py` / `model/projections.py`. For each prop (Runs, RBI, HRR):

1. **Per-game rate** = the player's R / RBI / (H+R+RBI) per game from game logs.
2. **Regression** toward a league baseline (per-game R / RBI / HRR average) by adding phantom league-average games — same safety net as every prop. *(Phantom-game count is a calibration constant, finalized with sign-off during the build.)*
3. **Adjustments** (multiplicative, each centered at 1.0, same pattern as HR's factors):
   - **Opposing-pitcher run/hit suppression** — derived from the starting pitcher's run/hit-allowed rate vs league.
   - **Platoon (handedness)** — reuse the existing platoon multiplier logic.
   - **Park run environment** — reuse/extend `model/parks.py` (park run factor).
4. **Expected per-game count** = regressed rate × adjustments.
5. **Threshold probabilities** = Poisson(expected count) → P(≥1), P(≥2), P(≥3), P(≥4) as needed. Monotonic by construction.
6. **HRR**: steps 1–5 run on the **combined H+R+RBI per-game total** directly (not by combining three separate models), so the correlation is captured by using the real combined stat.

History/Blend: the rate (step 1) has a current-season value and a 3-yr Marcel-blended value (reuse `model/blend.py` weights 5/4/3), producing `current` and `_hist` twins for every threshold probability — exactly like the other props. Blend (50/50) is computed in the frontend from those two, consistent with the shipped Blend weighting.

## Pipeline + export

- `model/pipeline.py`: add `build_runs_rows`, `build_rbi_rows`, `build_hrr_rows`, mirroring `build_hits_rows` / `build_total_bases_rows` (per-threshold probabilities emitted: Runs `{p_ge1, p_ge2}`, RBI `{p_ge1, p_ge2}`, HRR `{p_ge2, p_ge3, p_ge4}`).
- `model/export_web.py`: extend `build_board_with_history` to attach `_hist` twins for the new rows; new payload keys `runs[]`, `rbi[]`, `hrr[]`.
- HR + Strikeouts + Hits + Total Bases outputs stay byte-for-byte unchanged.

## Frontend

- **Pills:** add **Runs · RBI · HRR** to the prop selector (→ 7 props total: HR, Strikeouts, Hits, Total Bases, Runs, RBI, HRR).
- **Threshold selectors:** Runs 1/2, RBI 1/2, HRR 2/3/4, reusing the existing threshold-pill machinery and the source-aware threshold logic.
- **Board views** (Cards / Table / Matchups / Hybrid): the new props render like Hits/TB.
- **Top Plays:** new sections (Top Runs, Top RBI, Top HRR).
- **Player detail pages:** Runs/RBI/HRR pages with headline threshold stats, the "what's driving it" factor breakdown (pitcher suppression, platoon, park, recent form), the pitcher-matchup panel (both-sides K/C spheres + lean), conditions. No BvP-history factor for these in v1.
- **Game Hub breakdown:** add **Runs · RBI · HRR** as 3 new sphere columns → the grid becomes **K/C/N · HR · Hits · TB · Runs · RBI · HRR** (7 columns). The sortable column headers cover all 7; the grid scrolls horizontally on narrow screens; threshold-driven columns show the Game-Hub-selected threshold (extend the existing Game Hub column selectors to Runs/RBI/HRR, or show defaults — finalized in the plan).
- **Honesty:** a small note that Runs/RBI/HRR are inherently noisier than HR/K (context-dependent), so users read them as estimates.
- The Current/Blend/History weighting applies automatically (the new props expose current + `_hist` numbers; Blend averages them in the frontend).

## Testing

- Pure-math unit tests for the new module: per-game rate, regression, each adjustment, Poisson threshold probabilities (incl. monotonicity), and HRR-combined handling. Mirror the `model/counts.py` test style.
- Build via brainstorm→spec→plan→subagent-driven-development with the 2-reviewer gate (spec + adversarial) per task and a final whole-branch review, same as the history feature and Tier 1.
- Preview on localhost before production; ship via the normal merge-to-main + board-refresh deploy.

## Staging (per user)

1. **A (this spec)** — rate model.
2. **C** — lineup-context layer.
3. **B** — full simulation.
