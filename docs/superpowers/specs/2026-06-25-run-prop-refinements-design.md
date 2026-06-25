# Run-Prop Refinements (real park factors + recent form) — Design Spec

**Date:** 2026-06-25
**Status:** Design approved in chat (2026-06-25). Extends the shipped-but-unmerged
`feat/runs-rbi-hrr` branch BEFORE it goes to production.
**Related:** 2026-06-25-runs-rbi-hrr-design, props-expansion-roadmap, per-park-hit-factors-design, bvp-hits-gap-audit.
**Math change → requires user sign-off on constants before ship** (math-changes-need-signoff).

## Goal

Replace the two v1 shortcuts on the Runs / RBI / HRR props with real models, before launch:
1. The borrowed **HR-derived park proxy** → a **real per-park run factor** table.
2. The **always-neutral recent form** → a real **two-signal recent-form dial** (hard-hit + production), blended and shown transparently.

## Piece 1 — Real run park factors

**Today:** `model/parks.py:run_park_factor` returns `1 + (hr_park_factor - 1) * 0.6` (a dampened HR proxy). Runs/RBI/HRR all use it.

**Change:**
- Add `RUN_FACTORS: dict[str, float]` (one run-environment factor per park, 1.00 = neutral) + `RUN_FACTORS_LAST_PULLED` date stamp, same pattern as `HIT_FACTORS`. Anchor = published FanGraphs/Statcast multi-year **Runs** park factors, normalized to multipliers. (Run environment is less park-sensitive than HR, so the spread is tighter than `hr_factor`.)
- `run_park_factor(team)` → `RUN_FACTORS.get(team, 1.0)`. Used at **full strength by Runs and RBI** (a park's run-scoring environment applies equally to runs scored and runs driven in — total R ≈ total RBI league-wide; there is no separate published RBI factor).
- New `hrr_park_factor(team)` → `1 + (run_park_factor(team) - 1) * HRR_RUN_SHARE`. **HRR is H+R+RBI**; hits are park-neutral in our model and R+RBI carry the run environment, so HRR gets a **dampened share** of the run factor. `HRR_RUN_SHARE = 0.55` (the R+RBI portion of a typical H+R+RBI total).
- Staleness: `run_factors_stale(today_iso, max_days=400)` mirroring `hit_factors_stale`, surfaced in the daily run email like the hit-factor warning.

**Anchor table (for sign-off — best-knowledge 3-yr, refreshable like HIT_FACTORS):**
COL 1.15 · BOS 1.06 · CIN 1.05 · PHI 1.03 · KC 1.03 · ARI 1.02 · BAL 1.02 · TEX 1.02 · CWS 1.02 · NYY 1.01 · CHC 1.01 · LAA 1.01 · MIN 1.01 · ATL 1.01 · HOU 1.00 · TOR 1.00 · WSH 1.00 · STL 0.99 · MIL 0.99 · CLE 0.99 · LAD 0.99 · DET 0.98 · NYM 0.98 · PIT 0.98 · OAK 0.97 · TB 0.97 · SD 0.96 · MIA 0.96 · SEA 0.95 · SF 0.94

## Piece 2 — Hard-hit form wire-in

The batter profile already computes `recent_form_mult` (recent hard-hit/exit-velocity vs season, clamped 0.80–1.25) and uses it for HR/Hits/TB. The run props currently hardcode it to 1.0. **Change:** carry the existing `recent_form_mult` into the run-prop projection as the **hard-hit** signal. No new math — just stop discarding it.

## Piece 3 — Production form (new)

A second recent-form signal specific to run production: is he actually scoring / driving in / accumulating HRR lately, vs his own season rate.

New pure fn in `model/run_props.py`:
```
production_form_mult(recent_total, recent_games, season_rate, *,
                     shrink_games=PROD_SHRINK_GAMES, lo=0.85, hi=1.15) -> float
```
- `recent_rate = recent_total / recent_games` (per-game over the recent window); if `recent_games <= 0` or `season_rate <= 0` → return 1.0.
- `raw = recent_rate / season_rate` (relative to his season pace).
- Shrink toward 1.0 by sample size: `shrunk = (raw*recent_games + 1.0*shrink_games) / (recent_games + shrink_games)`.
- Clamp `[lo, hi]` → **0.85–1.15** (tighter than hard-hit's 0.80–1.25, because production is noisier / teammate-dependent).

Recent window = last **`RECENT_GAMES_WINDOW = 15`** games; **`PROD_SHRINK_GAMES = 10`**. Each prop (R / RBI / HRR) computes its own production form from its own per-game stat. The needed recent totals over the last 15 game-log entries are summed in `model/profiles.py:with_gamelog` (data already fetched) and threaded through the pipeline.

## Piece 4 — Blend + display

New pure fn in `model/run_props.py`:
```
blend_forms(hard_hit, production, *, w_hard=0.60, lo=0.80, hi=1.20) -> float
  = clamp(1 + w_hard*(hard_hit-1) + (1-w_hard)*(production-1), lo, hi)
```
Hard-hit gets 60% of the say (steadier, less teammate-dependent), production 40%.

- `expected_count` gains a `form_mult` param, multiplied into the Poisson mean alongside pitcher/platoon/park.
- The pipeline computes, per prop: hard-hit form, production form, blended form; passes the blend as `form_mult`; and stores **all three** on the row (`hard_hit_form`, `production_form`, `recent_form_mult` = the blend) for display.
- **Player detail pages (Runs/RBI/HRR only):** the single "Recent form" row becomes **two rows — "Hard-hit form" and "Production form"** — plus the existing "Recent form" line showing the **blended net**. HR / Hits / TB pages unchanged.
- **History/Blend:** forms apply to the **current** projection only; the `_hist` twins stay form-neutral (history = the multi-year baseline; "recent" has no meaning there). Blend (50/50) therefore carries half the form nudge — the correct midpoint.

## Out of scope (roadmap)

- Production-form for HR/Hits/TB (they already have hard-hit form; no ask).
- A career-hits BvP dial for Hits/Bases/Runs/RBI — tracked in **bvp-hits-gap-audit**, a deliberate separate decision.
- Computed-from-our-own-data run factors (the anchor is the published table; same Stage-B deferral as hit factors).
- Splitting platoon into its own player-page row + a season-rate line (user said hold).

## Constants requiring sign-off

| Constant | Value | Where |
|---|---|---|
| `RUN_FACTORS` (30 parks) + `RUN_FACTORS_LAST_PULLED` | table above | parks.py |
| `HRR_RUN_SHARE` | 0.55 | parks.py |
| `RECENT_GAMES_WINDOW` | 15 | run_props.py |
| `PROD_SHRINK_GAMES` | 10 | run_props.py |
| production form clamp | 0.85–1.15 | run_props.py |
| `blend_forms` `w_hard` | 0.60 | run_props.py |
| blend final clamp | 0.80–1.20 | run_props.py |
| (already on list) `REG_GAMES` / league baselines / pitcher clamps | 40 / 0.50,0.50,1.80 / 0.85–1.15 | run_props.py |

## Testing & rollout

- Pure-math unit tests for `production_form_mult` (shrink, clamp, neutral-on-zero), `blend_forms` (weights, clamp, both-neutral=1.0), `run_park_factor`/`hrr_park_factor` (table lookup, neutral default, HRR dampen), `run_factors_stale`.
- Existing HR/K/Hits/TB outputs stay byte-for-byte unchanged.
- Build via subagent-driven-development (2-reviewer gate per task + final whole-branch review), on the existing `feat/runs-rbi-hrr` branch.
- Regenerate the board → present constants + localhost preview → user sign-off → merge + deploy.
