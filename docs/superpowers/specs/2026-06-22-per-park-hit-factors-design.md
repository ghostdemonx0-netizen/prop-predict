# Per-Park Hit Factors (1B/2B/3B) for Total Bases — Design Spec

**Date:** 2026-06-22
**Status:** Design approved in chat; anchor data researched. Awaiting user review of this spec → plan → build.
**Math sign-off:** changes Total Bases math → user already green-lit the *approach*; this spec confirms the exact mechanics for review. [[math-changes-need-signoff]]

## Goal
Replace the current Total Bases shortcut — a *dampened* version of the HR park/weather factor applied to doubles/triples — with **real per-park factors for singles (1B), doubles (2B), and triples (3B)**. More accurate, especially Coors + big-outfield parks. Home Runs untouched; Hits stays park-neutral; only Total Bases changes.

## Core design: anchor + our-own-data (combined)
A two-layer model (user-approved):
1. **Anchor (published real factors)** — a curated per-park 1B/2B/3B table in `model/parks.py`, from FanGraphs (multi-year rolling, by hit type). The trusted starting point, with a **`last_pulled` date stamp**.
2. **Computed (our Statcast data)** — per-park 1B/2B/3B rates computed from our own cached events, **regressed toward the anchor** (informative prior) by sample size. Thin/rare components (triples) lean on the anchor; well-sampled ones move toward our data. Auto-improves as data accumulates.

`final_factor = regress(our_observed_rate_for_park, anchor_factor, by_sample_size)`

This is accurate from day one (anchor) AND self-correcting (our data), with no manual upkeep beyond the yearly anchor refresh.

## Anchor data (FanGraphs, multi-year rolling, normalized to multipliers; 1.00 = neutral)
Pulled 2026-06-22 from `fangraphs.com/guts.aspx?type=pfh`. Cross-checked vs FantasyPros (directionally consistent).

| Team | 1B | 2B | 3B |  | Team | 1B | 2B | 3B |
|---|---|---|---|---|---|---|---|---|
| ARI | 1.03 | 1.05 | 1.20 | | MIL | 0.96 | 0.96 | 1.04 |
| ATL | 1.01 | 0.98 | 1.01 | | MIN | 1.00 | 1.04 | 0.92 |
| BAL | 1.03 | 0.97 | 1.06 | | NYM | 0.98 | 0.96 | 0.88 |
| BOS | 1.05 | 1.11 | 1.17 | | NYY | 0.97 | 0.96 | 0.86 |
| CHC | 1.01 | 0.96 | 1.13 | | OAK* | 1.02 | 1.00 | 1.02 |
| CWS | 1.00 | 0.96 | 0.87 | | PHI | 1.00 | 0.98 | 1.03 |
| CIN | 1.02 | 1.01 | 0.84 | | PIT | 1.02 | 1.05 | 0.99 |
| CLE | 1.01 | 1.01 | 0.89 | | SD  | 0.97 | 0.96 | 0.86 |
| COL | 1.09 | 1.11 | 1.35 | | SF  | 1.01 | 1.02 | 1.11 |
| DET | 1.01 | 1.01 | 1.20 | | SEA | 0.95 | 0.93 | 0.80 |
| HOU | 0.99 | 1.00 | 1.14 | | STL | 1.01 | 0.98 | 0.89 |
| KC  | 1.03 | 1.08 | 1.23 | | TB  | 1.04 | 0.96 | 0.91 |
| LAA | 1.00 | 0.96 | 1.01 | | TEX | 0.98 | 1.00 | 0.93 |
| LAD | 0.97 | 0.98 | 0.85 | | TOR | 0.98 | 1.02 | 0.89 |
| MIA | 1.01 | 1.01 | 1.09 | | WSH | 1.01 | 1.00 | 0.98 |

*OAK (Athletics / Sutter Health Park, Sacramento): **low confidence** — new park, rolling data blends old Coliseum. Flag to refine once it has its own multi-year sample.

## How it plugs in (Total Bases only)
In `model/pipeline.py`'s outcome vector (the `apply_xbh_park=True` / Total Bases path):
- 1B component × `park_1b`, 2B × `park_2b`, 3B × `park_3b` (the final blended factors). Replaces the single dampened `xbh_mult` shortcut.
- **HR component unchanged** — keeps its own existing HR park factor.
- **Weather:** keep the existing dampened weather effect on the fly-ball components (2B/3B/HR); park is now per-component, weather stays as-is. (Tunable; revisit if needed.)
- **Hits prop unchanged** — `apply_xbh_park=False` path stays park-neutral on 1B/2B/3B, exactly as today.

## Maintenance (built in at ship time)
1. **Staleness warning (in-engine):** the anchor table carries `last_pulled = 2026-06-22`; the daily robot warns (lands in the run email) when it's >~12 months old. The system reminds the user — never relies on Claude's memory.
2. **Calendar reminder:** a recurring preseason "refresh prop-predict park factors" nudge, set up when this ships.

## Testing & process
- Unit: a hitter-friendly park (COL) lifts TB p_ge2/p_ge3 vs neutral; a suppressive park (SEA) lowers them; Hits rows stay park-neutral (unchanged); HR rows byte-for-byte unchanged.
- Regression: the anchor table loads/normalizes correctly; the blend regresses thin samples toward the anchor.
- Built via brainstorm→spec→plan→subagent-driven-development with the 2-reviewer gate (spec + adversarial) per task, then whole-branch review. Preview before prod. Rebase onto latest origin/main before pushing (shared main).

## Out of scope / notes
- Weather per-component refinement; handedness splits (FanGraphs has L/R — v1 uses the blended average).
- v1 may ship **anchor-first** (table + apply) and add the **computed-blend** as a fast follow if it's cleaner to stage — TBD in the plan. The anchor alone is already a big accuracy win over the current dampened-HR shortcut.
- Related: [[props-expansion-roadmap]], [[board-data-pipe]].
