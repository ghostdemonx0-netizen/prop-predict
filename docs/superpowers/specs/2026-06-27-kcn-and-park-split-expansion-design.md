# KCN Capture + Grading & Park/Weather Split — Expansion Design

**Date:** 2026-06-27
**Status:** Design — pending user review
**Context:** Expansion discovered mid-build of the Predictions Grader (Phase 2).
Two gaps surfaced: (1) **KCN** (the matchup lean — K/Neutral/Contact — from
`model/matchup.py`) is computed, displayed, AND feeds the math, but the recorder
does NOT archive it ([[kcn-capture-gap]]); (2) for **Hits/Total Bases**, park and
weather are stored **bundled** so park can't be calibrated independently.
**The grader build is PARKED** until this lands, per the agreed sequence:
fix recorder → extend grader to read the new fields → wipe/recapture today →
merge → turn on.

**Sign-off note:** all RECORDER changes here are **capture-only** (they record
values the model already computes; they do NOT change any projection) → no math
sign-off needed. The park/weather split MUST keep every projection
byte-for-byte identical (pinned by test). Grader changes only score.

---

## What KCN is (recap)
`model/matchup.py` `classify_lean()` → three buckets: `K` (strikeout), `NEU`
(neutral), `H`/Contact. `matchup()` returns `{k_prob, hit_prob, lean, prob}`,
from log5 of the batter's & pitcher's K-rate/hit-rate + platoon. It already
feeds: the K prop (`expected_ks` from the lineup's `k_prob`s) and Hits/TB (the
matchup `hit_prob` as hit_factor). It is a per **batter-vs-pitcher** read.

---

## Part A — Recorder enrichment (capture-only)

### A1. Capture KCN
Every batter-vs-starter KCN read already lives on the **strikeout record's
`matchups` array** (the pitcher row carries the whole opposing lineup, each
entry with `player_id, name, k_prob, hit_prob, lean, ...`). So we capture it
there — no batter-row change, no pipeline change:
- In `model/archive.py`, for `prop == "strikeouts"`, add a slim **`kcn`** list to
  the record: for each entry in `row["matchups"]`, store
  `{"player_id", "k_prob", "c_prob": hit_prob, "lean"}`.
- This single capture covers BOTH views: the **pitcher** view (the record's
  owner = the starter) and the **batter** view (each entry, re-indexed by
  `player_id` + `game_id`). The KCN-grades file (Part B) is the batter-view
  source of truth.

### A2. Split park vs weather for Hits/Total Bases
Hits/TB currently store one combined `park_weather_factor` (`pipeline.py` ~300–328,
an EV-ratio bundling both). Change so the row records **park** and **weather** as
**two separate stored fields** — named `park_factor` and `weather_factor` (added
to `archive._FACTOR_KEYS`). Simplest faithful representation: store the
park-only and weather-only multipliers the model *already applies* (the park
component(s) and the weather multiplier), rather than re-deriving by re-running
the EV sim — whichever the implementer finds cleanest, as long as park and
weather are recoverable independently. **Hard constraint: projection
probabilities must not change** — this only changes what is *stored*, pinned by
a byte-identical test on `p_geN`/`p_ge2` for a sample slate. (Runs/RBI/HRR already
store park-only as `park_weather_factor`; HR already stores `park_mult` +
`weather_mult` separately — both already fine, leave them.)

### A3. Re-capture today
After A1+A2 deploy to main: **wipe** `archive/2026-06-27.jsonl` so the recorder
re-captures today's (stable, intact) frozen games WITH the new fields. Safe
**today only** because the freeze bug is fixed (no rows vanished). The recorder
dedups on (game_id, player_id, prop), so the wipe is required to re-capture.
Only today's file.

---

## Part B — Grader extension

### B1. KCN matchup grading (starter-only, via play-by-play)
A NEW, matchup-level grade (distinct from the 7-prop grades), graded against
**only the batter's plate appearances vs the starting pitcher** — exactly what
KCN predicted.

- **New fetch** `model/fetch.py game_pbp(game_id)` → from
  `statsapi.get("game_playByPlay", {"gamePk": game_id})`, return each plate
  appearance as `{batter_id, pitcher_id, result}` where result ∈
  {strikeout, hit, other} (derive from the play's event type). Pure parser
  `_parse_pbp(...)` is unit-tested; the network wrapper is thin.
- **Identify the starters** (home & away) for the game (the pitchers whose Ks we
  predicted — the strikeout records' `player_id`s, or `fetch.get_starters`).
- **Per (game, batter, starter) KCN read** (from the captured `kcn` list), tally
  the batter's PAs **vs that starter**: `pa`, `k` (strikeouts), `hit` (hits).
- **Grade record** (one per matchup, serves both views):
```json
{"date":"2026-06-27","game_id":776543,"batter_id":12345,"pitcher_id":67890,
 "pa":3,"k":1,"hit":1,
 "pred":{"k_prob":0.31,"c_prob":0.24,"lean":"K"},
 "actual_lean":"K","status":"graded","graded_at":"<iso>"}
```
  - `actual_lean`: `K` if any K vs starter and Ks ≥ hits; `H` if any hit and
    hits > Ks; else `NEU` (no K, no hit vs starter). (Simple, transparent rule;
    refine later if needed.)
  - `status`: `graded` | `void` (batter never faced the starter → `pa == 0` →
    void `no_pa`) | unsettled (game not final → omitted, same window rules as
    prop grading).
- **Output file:** a separate `archive/YYYY-MM-DD.kcn-grades.jsonl` (mutable,
  overwritten each run — same idempotent pattern as prop grades). Keeps prop
  grades clean.
- **Both views fall out of this one record:** pitcher KCN accuracy = group by
  `pitcher_id`; batter/player-prop KCN accuracy = group by `batter_id`. The
  analysis layer (later) computes k_prob/c_prob calibration (k/pa vs k_prob)
  and lean hit-rate.

### B2. Park calibration — no grader change
Park factors are recorded on the prop predictions (now split, A2), and the prop
grader already records prop outcomes. Park calibration is therefore an
**analysis-layer** activity (group prop grades by park + recorded park factor).
No new grader code — A2 is what unblocks it.

---

## Sequence (the agreed order)
1. **Recorder** A1 + A2 → review → merge to `main` (recorder is live).
2. **Wipe + re-capture** today (A3).
3. **Grader** rebased on updated `main`, add B1 (KCN grading) → review.
4. **Merge** grader → `main`; **enable** (cron-job.org daily trigger).

The existing 7-prop grader (already built + reviewed) rides along in step 3–4;
B1 is added to it before merge.

---

## Constraints
- Recorder changes capture-only; **no projection may change** (A2 pinned by a
  byte-identical probability test). No math sign-off needed.
- Privacy unchanged: everything reads/writes ONLY the `predictions-archive`
  branch; never the live site.
- KCN grade file is mutable/idempotent; prop grade + prediction files unchanged
  in shape (we only ADD the `kcn` list to strikeout prediction records and split
  park fields on hits/TB records).
- Grading granularity: **starter-only** (play-by-play), not whole-game.

## Out of scope (later)
- Calibration/accuracy dashboards that READ these grades (KCN k_prob/c_prob
  calibration, lean hit-rate, per-park boost accuracy).
- Using KCN as a NEW factor for props that don't use it yet (e.g. HR) — that
  would be a model-math change needing sign-off; the archive just lets us
  decide whether it's worth it.
- Backfill of KCN/park for days before this ships (no backfill).
