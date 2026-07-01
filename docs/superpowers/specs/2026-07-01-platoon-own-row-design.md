# Split Platoon Into Its Own Row — Design

**Date:** 2026-07-01
**Type:** Display-only (no probability change). Backend one-line emit (run props); frontend rows.
**Status:** Approved in brainstorm; pending spec review.

## Goal

The player-page "what's driving it" hides the **handedness (platoon) matchup** — the
lefty-vs-righty edge bettors care about. On HR it's shown *merged* into the Pitcher row;
on Runs/RBI/HRR it moves the number but isn't shown at all; on Hits/TB it's folded into the
Pitcher factor. This surfaces it as its own **🔄 Platoon** row on every batter prop, so the
handedness edge is visible.

**Display-only:** every platoon multiplier already exists and is already applied to the
probability. We only re-arrange what's shown — **no probability changes.**

## The platoon value (flat, league-average — same for everyone today)

`hr_platoon_mult` = **+6%** (advantage: opposite-hand *or* switch hitter) / **−5%** (same-hand).
The contact side (Hits/TB) uses **+8% / −7%** inside the log5. All flat/uniform for now; the
per-batter personalization is a separate roadmap item (#2) that will later make these numbers
individual — same rows, smarter values.

## Per-prop mechanics

| Prop | Today | Change | Double-count? |
|---|---|---|---|
| **HR** | `matchup_mult` emitted, shown *merged* into Pitcher (`pitcher_mult × matchup_mult`) | Pitcher row → `pitcher_mult` only; new **🔄 Platoon** row → `matchup_mult` (+6/−5) | none (un-merged) |
| **Runs/RBI/HRR** | `platoon` applied to the prob, **not shown**; Pitcher row = `pitcher_factor` (psupp, no platoon) | Emit `platoon_mult`; add **🔄 Platoon** row from it | none (purely additive; platoon was never in the run Pitcher row) |
| **Hits/TB** | platoon **folded into** `pitcher_factor` (log5) | Add an **info** 🔄 Platoon row: matchup + favorable/unfavorable, noted "reflected in the Pitcher factor above" — **no standalone %** | none (info only, not a multiplying row) |

**Why Hits/TB is info-only:** its platoon is a *blend* of the contact (+8/−7) and HR (+6/−5)
effects — no single clean number — and it's entangled in the log5. Rather than a rushed
decompose, the info row surfaces the edge honestly ("he has the platoon advantage tonight,
already counted in Pitcher") with no double-count. The proper pulled-out number for Hits/TB
comes with the per-batter #2 upgrade.

**Not source-aware:** platoon depends only on handedness — identical across Current/Blend/
History. One value, no `_hist` twin (rendered raw, like spray/BvP).

## Architecture

**Backend (`model/pipeline.py`):**
- **Runs/RBI/HRR** (`_run_prop_rows`): add `"platoon_mult": platoon` to the row dict (the
  `platoon` var already computed at line ~490). One line.
- HR: no change (`matchup_mult` already emitted). Hits/TB: no change (the info row derives
  favorable/unfavorable from `bats` + `vs.throws`, both already on the row).

**Frontend (`web/app/player/[prop]/[id]/page.tsx`):**
- Small helper `platoonEdge(bats, throws): boolean` (mirrors `batter_advantage`: switch → true;
  else opposite hands → true).
- **HR:** Pitcher `<Factor>` mult `(pitcher_mult × matchup_mult)` → `pitcher_mult`; note drops
  the platoon mention. Add a 🔄 Platoon `<Factor>` (`mult={matchup_mult}`), note names the
  matchup + favorable/tough.
- **Runs/RBI/HRR:** add a 🔄 Platoon `<Factor>` (`mult={platoon_mult}`) after the Pitcher row.
- **Hits/TB:** add an info row (plain `factor-note`, no `<Factor>`/%): `🔄 Platoon · {RHB} vs
  {LHP} · favorable/tough — reflected in the Pitcher factor above.`

**Types (`web/lib/types.ts`):** add `platoon_mult?: number` to `RunsRow` (inherited by
`RbiRow`) and `HrrRow`. (HR's `matchup_mult` already declared.)

## Out of scope (YAGNI)

- No math/probability change; no recorder/grader touch.
- Hits/TB pulled-out platoon % → deferred to the per-batter #2 item.
- K (pitcher prop) gets no platoon row (it's a batter-side effect).

## Testing

- **Backend:** unit-test that run-prop rows carry `platoon_mult` equal to
  `hr_platoon_mult(bats, throws)` for a fixture (e.g. RHB vs LHP → 1.06; RHB vs RHP → 0.95).
  Existing prob tests stay green.
- **Frontend:** `platoonEdge` unit tests (R vs L → true, R vs R → false, S vs anything → true).
  Render a fixture card per prop: HR shows Pitcher (de-platooned) + a Platoon row; run props
  show a Platoon row; Hits/TB show the info row with the right favorable/tough label.
- **Manual:** localhost preview across HR/Hits/TB/Runs/RBI/HRR; confirm HR's rows still
  multiply to the same headline (platoon just moved out of Pitcher), run props gain a visible
  Platoon row, Hits/TB show the info line. Preview-before-prod.

## Rollout

Branch → backend `platoon_mult` (run props) → types → frontend rows + `platoonEdge` → full
suites green → localhost preview → **stop for approval before merge** → merge + deploy
(`force_deploy`, since a board field is added). Mirror in the mock.
