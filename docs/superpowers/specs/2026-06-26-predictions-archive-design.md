# Predictions Archive (Phase 1 — Capture) — Design Spec

**Date:** 2026-06-26
**Status:** Design agreed in chat (2026-06-26); ready for user review → implementation plan.
**Related:** predictions-archive-grading (top-of-roadmap project), board-data-pipe, prop-factors-cheatsheet, math-changes-need-signoff, kasper-mlb-blueprint.
**Note:** the recorder does NOT change any model math (it only *records* what the model already produces) → **no math sign-off needed**, but preview-before-production still applies.

## Goal

Permanently record every prediction the model makes — the full factor breakdown, all thresholds, and all three weightings — at the moment each game locks, into a private append-only store, so we can later grade those predictions against real outcomes (Phase 2) for **calibration**, **accuracy-by-tier**, and **which-factors/weights-actually-help**. This is the foundation of the "data, not picks" track record and also feeds the future pick-log (shared store + grading engine).

## Scope

**In (Phase 1 = CAPTURE / the recorder):**
- A recorder that snapshots each game's predictions **once, at lock** (its final pre-start state).
- Full structured capture: every prop × every threshold × all 3 weightings + every factor that fed the math + join metadata.
- Stored append-only on a **dedicated private branch**, never served to the public site.
- Starts the day the recorder ships — **no backfill**.

**Out (later phases — referenced, not built here):**
- **Phase 2 — Grading:** after box scores settle (the existing trailing-3-day re-pull), join outcomes to archived predictions, mark hit/miss/**void** (DNP, rainout, doubleheader), compute calibration / accuracy-by-tier / factor value.
- **Public "track record / results" page:** a deliberate, opt-in future build. Until the user says so, the archive + grades stay invisible to site users.
- **Pick-log:** separate project; reuses this archive + the Phase-2 grading engine.

## Privacy (HARD REQUIREMENT)

The archive is **backend/private only**. It must **never** be written into `web/public/data` or any path the live site serves, and must **never** be visible to site visitors. The public board stays exactly as it is. (A results page is a separate future opt-in.)

## What we capture (per prediction)

One record per **(game, player, prop)** at lock, with thresholds + weightings + factors as **named structured fields** (not an opaque blob — so we can later "group by park-factor bucket", etc.):

- **Identity / join keys:** date, captured-at timestamp, game_id, game_time, matchup, player_id, player, team, bats, lineup_status at lock (projected/confirmed), prop.
- **Probabilities:** for each of the prop's thresholds (HR: 1; Hits 1/2/3; TB 2/3/4; Runs 1/2; RBI 1/2; HRR 2/3/4; K: the over line) — the probability at **Current**, **Blend**, **History** weightings.
- **Factor breakdown (the math components that produced the probability):** base rate, regression, expected count/λ, pitcher quality, platoon, park, **weather**, recent-form (and for run props the **hard-hit + production** split), BvP/history where the prop uses it. Where applicable, the `_hist` twins of the factors too. Opposing pitcher (id/name/throws).
- **Implementation note:** most of this already lives on the board rows the engine emits (`p_ge*`, `pitcher_factor`, `park_weather_factor`, `recent_form_mult`, `hard_hit_form`, `production_form`, the `_hist` twins, `vs`/matchup, `lineup_status`). The recorder mostly **persists a structured snapshot of the existing board rows** at lock (computing Blend = (current+hist)/2 like the board does, and including raw park/weather values).

Outcome fields (`actual_*`, hit/miss/void) are **NOT** written here — Phase 2 adds them later, joined on (game_id, player_id, prop).

## When we capture — per game, at lock

A prediction freezes when its game starts (lineups locked, first pitch). Because games start at **staggered times**, a single fixed daily snapshot would freeze late games while their numbers are still changing. So:

- **Each game is captured exactly once, at/just-before its own lock** (final pre-start state).
- The board build already **drops a game the moment it starts** (`if game.get("started"): continue`), and the board-refresh job runs every ~30 min. So a game's **last on-board state = its final prediction.**
- **Mechanism (finalize in the plan):** ride along with the board-refresh job; detect each game's transition to locked (it was on the board last run and is now started / past game_time) and append that game's last-known rows; OR capture a game on the last refresh before its `game_time`. Must be **idempotent** — each game written exactly once per date (a per-date/per-game marker prevents duplicates).

## Where it's stored

- A **new dedicated git branch `predictions-archive`** — **append-only** (e.g. one file per date: `archive/YYYY-MM-DD.jsonl`), **never force-pushed**, history preserved forever. Separate from `board-data` (which is force-pushed/overwritten every run and would wipe an archive). Keeping it separate also leaves the working `board-data` pipe untouched.
- **Read access:** a small pipe (like `scripts/pull_board.sh`) reads the archive branch directly — no auth wall, because it reads the backend branch, not the authed live site. This is how Phase 2 + any analysis reads it.
- **Cost:** slim records, lean/compressed; ~tens of MB/year — negligible on the existing free infra.

## Lifecycle

- **Starts at turn-on; no backfill.** The track-record / calibration clock begins the day Phase 1 ships. (New run props have no pre-launch history, and old board snapshots already rolled off.) Normal — every track record has a start date.
- Every game from turn-on forward is captured at its lock.

## Testing

- Unit-test the pure logic: which games to capture on a given refresh (lock detection), idempotency/dedup, and the record schema/serialization (correct fields, all thresholds, all 3 weightings, factors present).
- Integration: the recorder runs as part of (or alongside) the board-refresh job and writes to the archive branch without disturbing the existing board/`board-data` flow.
- Confirm **nothing** is written into `web/public/data` / the public bundle (privacy check).

## Rollout

- Build via brainstorm → spec → plan → subagent-driven-development (2-reviewer gate), like prior features.
- Not a model-math change (records only) → no math sign-off; but preview the recorder's output locally before enabling in production.
- Ship the recorder; verify the first day's archive lands on the `predictions-archive` branch and the public site is unaffected. Then Phase 2 (grading) is its own spec.
