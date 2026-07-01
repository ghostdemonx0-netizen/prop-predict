# Baseline / Season-Pace Line — Design

**Date:** 2026-07-01
**Type:** Display-only (no probability change). Backend emits precomputed baseline+pace; frontend shows two rows.
**Status:** Approved in brainstorm; pending spec review.

## Goal

The player-page "what's driving it" box shows only the *nudge* factors (park, weather,
form, pitcher, lineup, spray…). The single **biggest driver — the player's own base
level — is invisible**, baked silently into the headline %. This adds it as two labeled
rows between the headline and the factor rows, so each card reads top-to-bottom:

> **Baseline → (factors push it up/down) → Tonight's %.**

## The two rows (every prop)

| Row | Shows | Unit |
|---|---|---|
| 📊 **Baseline chance** | his neutral-conditions probability (all matchup factors OFF), matching the selected threshold | a **%** (same unit as the headline) |
| 📈 **Season pace** | his raw season average | the prop's **natural count** |

- **Baseline** = the *existing* probability formula run with every factor = 1.0 (regressed
  rate → per-game/threshold prob, no park/weather/form/pitcher/lineup/spray). It is the
  headline's own math with the nudges removed — **not new math.**
- **Pace** = his raw observed average (a season stat), formatted per prop.

**They are two views of the same base level, and are NOT expected to be equal** — one is a
*chance* (%), the other an *average* (count), like "42% of rainy days" vs "0.55 inches/day."
The distinct labels ("chance" vs "per game") make the units unmistakable.

## Per-prop framing

| Prop | Baseline chance (threshold-matched) | Season pace (natural unit) |
|---|---|---|
| Runs / RBI | chance of 1+ / 2+ | `0.55 runs/game` |
| HRR | chance of 2+ / 3+ / 4+ | `1.9 (H+R+RBI)/game` |
| Hits | chance of 1+ / 2+ / 3+ | `1.1 hits/game` |
| Total Bases | chance of 2+ / 3+ / 4+ | `1.6 bases/game` |
| HR | chance of 1+ HR | `~1 HR every 22 games` (per-game is tiny → phrase as "how often") |
| Strikeouts (pitcher) | chance over the line | `5.8 Ks/start` |

## Source-aware (Current / Blend / History-3yr)

Both rows flip with the existing source toggle, exactly like the headline already does:
- **Current** → current-season base level.
- **History (3yr)** → the Marcel 3-yr blend (5·4·3 weighted).
- **Blend** → the average.

So each row emits a `_hist` twin and the frontend `pick()`s it against the toggle.

## Architecture

**Backend — precompute per row (no model math duplicated in JS):**

Each prop's row builder additionally computes, with every factor multiplier set to 1.0:
- **Baseline probabilities** (matching the prop's thresholds), + `_hist` twins:
  - HR: `baseline_prob` (single threshold).
  - Hits: `baseline_p_ge1/2/3`. TB: `baseline_p_ge2/3/4`. Runs/RBI: `baseline_p_ge1/2`.
    HRR: `baseline_p_ge2/3/4`.
  - K (pitcher): `baseline_over_prob` from neutral expected Ks (`opponent_k_mult = 1`).
- **Pace** — one number in the prop's natural unit, + `pace_hist`:
  - Runs/RBI/HRR: `total_field / games`. HR: `season_hr / games`. Hits:
    `(1b+2b+3b+hr) / games`. TB: `(1b + 2·2b + 3·3b + 4·hr) / games`. K:
    neutral Ks/start = `k_per_bf · expected_bf`.

The `_hist` twins come from the history-mode build (blended profiles), copied in
`build_board_with_history` alongside the existing `*_hist` fields.

**Frontend — `web/app/player/[prop]/[id]/page.tsx`:**
- New optional fields on each row type in `web/lib/types.ts`.
- Two rows rendered between the "our read"/headline block and the "what's driving it" panel,
  on every prop branch (hr/hits/tb/runs/rbi/hrr/k).
- Baseline uses the emitted baseline matching the **selected threshold**, `pick()`ed for source.
- Pace formatted per prop (a small `paceText(kind, pace)` helper; HR gets the
  "1 HR every N games" phrasing from HR/game).

## Two honest details (documented, accepted for v1)

1. **Baseline is per-threshold** for hits/TB/runs/HRR (so it tracks whichever 1+/2+/3+ is
   selected) — mirrors the existing `p_ge*` structure.
2. **Pace = raw average; baseline = regressed.** For players with few games these differ
   slightly (regression tempers thin samples); for established players they're ~identical.
   The distinct labels keep it honest. (No attempt to force them to reconcile — they measure
   different things anyway.)

## Out of scope (YAGNI)

- No new probabilities/board math — baseline is the existing formula at neutral; pace is a
  raw stat. No recorder/grader change.
- The deferred **platoon-as-its-own-row** split stays deferred (separate later pass).
- No sparkline/trend visuals — just the two text rows.

## Testing

- **Backend:** unit-test that each builder emits `baseline_*` and `pace` (+ `_hist`) on its
  rows; that the baseline equals the prob formula with mults = 1 (assert
  `baseline_prob == hr_probability(..., all mults = 1.0)` for a fixture); that pace equals the
  raw season average (`total/games`). Existing probability tests stay green (proof nothing
  moved).
- **Frontend:** `paceText` unit tests (runs/game, HR "1 every N games", Ks/start); render a
  fixture card per prop and assert the two rows appear with the right threshold-matched
  baseline and source-picked value.
- **Manual:** localhost preview across all 7 prop pages, all three source modes; confirm
  baseline ≤/≈ headline moved by the factors, pace reads naturally. Preview-before-prod.

## Rollout

Branch → backend baseline+pace + `_hist` twins → types → frontend rows + `paceText` →
full suites green → localhost preview (all props × 3 modes) → approval → merge + deploy
(needs a board recompute so the new fields land, via `force_deploy`). Mirror in the design mock.
