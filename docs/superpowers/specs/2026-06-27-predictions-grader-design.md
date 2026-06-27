# Predictions Grader (Phase 2) — Design

**Date:** 2026-06-27
**Status:** Approved (design); ready for implementation plan
**Relationship:** Phase 2 of the predictions archive. Phase 1 (the recorder,
`model/archive.py` + `archive-predictions.yml`) is LIVE as of 2026-06-27 and
writes immutable per-date prediction files to the `predictions-archive` branch.
This grader is the second, separate layer that scores those predictions against
real outcomes. **Not a model-math change** — it only records + scores, so no
math sign-off is required to build it. (Insights it later surfaces WILL drive
math changes, which do need sign-off.)

---

## 1. Purpose

For every prediction the recorder froze, determine what actually happened and
mark each threshold hit/miss/void — producing the raw material for:
- **Calibration** ("of all the ~55% calls, did ~55% hit?"),
- **Accuracy by tier** (do STRONG plays beat Leans?),
- **Factor value** (which factors actually earn their keep).

The grader only *produces graded records*. Calibration/accuracy/factor analysis
are downstream consumers, out of scope here.

## 2. Scope (v1)

Grade **all 7 props**: HR, Hits, Total Bases, Runs, RBI, H+R+RBI (HRR), and
pitcher Strikeouts. Six are batter outcomes; Strikeouts is the pitcher's line —
all are derivable from a single box score per game (see §5).

## 3. Architecture

Mirrors the recorder's shape (pure transforms + thin I/O + CLI + workflow):

- **`model/grader.py`** — pure grading logic, no network. Key functions:
  - `grade_prediction(pred, outcome) -> grade` — turn one prediction record +
    its matched outcome into one grade record.
  - `grade_day(predictions, outcomes_by_game, now_iso) -> list[grade]` — grade
    every prediction for a date against a `{game_id: GameOutcome}` lookup.
  - file I/O helper (`grade_file(...)`) that reads the predictions JSONL, drives
    the fetch, writes/overwrites the grades JSONL. (I/O isolated from the pure
    transforms, exactly like `archive.record_day`.)
- **`model/fetch.py`** — a box-score fetcher: `game_boxscore(game_id) ->
  GameOutcome` returning per-player batting lines (H, 2B, 3B, HR, total bases,
  R, RBI), per-pitcher strikeouts, and the game's **status**
  (final / postponed / suspended / in-progress). Reuses the MLB Stats API
  boxscore access already used to resolve starters in `export_web.py`.
- **`.github/workflows/grade-predictions.yml`** — daily job (see §7).

## 4. Data flow (one daily run)

1. Triggered by **cron-job.org** once a day (GitHub `schedule:` as loose backup).
2. For each date in the **trailing 3-day window** (today back through today−2):
   a. Read that date's predictions file from `predictions-archive`
      (`archive/YYYY-MM-DD.jsonl`). Missing file → skip that date.
   b. Collect the **distinct `game_id`s** in the predictions.
   c. Fetch each game's **final box score once** (Approach A) + read its
      **status** (a pinch of Approach C) to decide final-vs-void.
   d. Grade every prediction against the matched outcome (§5–§6).
   e. **Overwrite** that date's grades file (`archive/YYYY-MM-DD.grades.jsonl`)
      with the freshly recomputed set.
3. Commit + push the changed grades files to `predictions-archive` (normal
   push, never force). Reads/writes ONLY that branch — never the live site.

**Settle behavior:** last night's finals appear on the next morning's run;
late finishes + official-scorer corrections settle over the following days.
Once a date ages past the 3-day window it is **never re-graded** — its grades
are final.

## 5. Outcome source (Approach A + a pinch of C)

**A — one box score per game.** A single boxscore call per `game_id` yields
every player's full line and each pitcher's strikeouts, covering all 7 props in
one place, matched to the **exact game** (so doubleheaders are unambiguous — we
match by `game_id`, which the recorder already stored).

**C (sliver) — game status for finality.** The boxscore/schedule status field
distinguishes Final vs Postponed/Suspended/In-progress, driving void/unsettled
decisions (§6). Not used as a stat source.

Per-prop stat mapping (all from the one box score):

| Prop | Thresholds (from recorder) | Stat checked |
|---|---|---|
| HR | 1+ | home runs |
| Hits | 1+, 2+, 3+ | hits |
| Total Bases | 2+, 3+, 4+ | total bases |
| Runs | 1+, 2+ | runs scored |
| RBI | 1+, 2+ | RBIs |
| HRR | 2+, 3+, 4+ | hits + runs + RBIs |
| Strikeouts | over `line` | pitcher strikeouts vs `line` |

## 6. Grading logic

**Match key:** `(game_id, player_id, prop)`. The grader iterates the immutable
predictions (source of truth) and looks each up in the outcome lookup.

**Grade the outcome ONCE per (player, prop).** The recorder stored three
probabilities per threshold (current / blend / history); they all predicted the
*same* real event, so we store the **single actual outcome + per-threshold
hit/miss**, NOT three grades. Downstream calibration joins each stored
probability against this one outcome.

**Threshold result:** for count props, `result[label] = actual >= N`. For
Strikeouts (over/under a `line`): `over` if `actual_k > line`; on a whole-number
line where `actual_k == line`, mark **push** (neither hit nor miss) so it does
not distort accuracy. (Half-point lines never push.) The numeric `line` is read
from the prediction's `factors.line` (the recorder stores it there); the prob
key `"over <line>"` is only a label.

**Grade record schema** (one per prediction):
```json
{"date":"2026-06-27","game_id":776543,"player_id":12345,"player":"Aaron Judge",
 "team":"NYY","prop":"hits","status":"graded","actual":2,
 "results":{"1+":true,"2+":true,"3+":false},"graded_at":"<iso8601>"}
```
- `status`: `"graded"` | `"void"`. (A prediction whose game is not yet final is
  **omitted** this run and retried next run — its absence means "not settled
  yet." See void rules for the terminal cases.)
- `void` records carry `void_reason` (e.g. `"DNP"`, `"postponed"`) and omit
  `actual`/`results`.
- Strikeouts records may carry `"push": true` in `results` for the pushed line.

**Status / void rules:**
- **Final game, player in box score** → `graded` on actual stats.
- **Final game, player absent from box score** (DNP / scratched / never
  entered) → `void`, `void_reason:"DNP"`. Not a loss.
- **Starter pulled early for a pinch-hitter** → `graded` on actual stats
  (accepted noise; deferred refinement noted in memory).
- **Game not final yet** (in-progress / postponed / suspended) AND this is NOT
  the date's last in-window run → **omitted** this run; retried next day.
- **Game still not final on the date's LAST in-window run** (i.e. the date is the
  oldest one covered, today−2 — its final retry) → `void`,
  `void_reason:"postponed"`. This is the precise trigger for "ages out still not
  final," and it guarantees nothing stays unsettled forever (every prediction is
  terminal — `graded` or `void` — once its date leaves the window).

## 7. Workflow / cadence

- **`grade-predictions.yml`**, `on: [workflow_dispatch, schedule(backup)]`,
  triggered daily by a **cron-job.org** entry the user adds (the reliable timer;
  GitHub's native schedule is unreliable and is only a backup).
- Idempotent: re-running recomputes identical grades and overwrites — double
  fires (cron-job.org + backup schedule) are harmless.
- Reads board predictions from `predictions-archive`, pushes grades back to
  `predictions-archive` (normal push). Never writes `web/public/data` or any
  live-site path. `timeout-minutes: 10`, `concurrency` group to avoid overlap.
- **Manual enable steps** (documented at file top, like the recorder's seed):
  merge to `main`, add the cron-job.org daily entry.

## 8. Error handling

- Missing/failed box score, or a game still in progress → that game's
  predictions are left **unsettled** this run (omitted), retried next run. Never
  crashes the batch.
- Corrupt/blank lines in the predictions JSONL are skipped with a warning
  (same tolerance as the recorder).
- Branch push contention → normal (non-force) push fails loudly and the next
  run heals (grades are recomputed wholesale, so no data loss).
- A prediction with no matching game in the fetched set → unsettled/retry; at
  window expiry → `void`.

## 9. Testing

Test-first (TDD), pure-function suite before any wiring, covering:
- each prop's threshold math (incl. HRR sum, Total Bases),
- Strikeouts over/under + **push** on a whole-number line,
- void on DNP / absent player,
- postponed → unsettled → void at window expiry,
- doubleheader matched by `game_id`,
- grade-the-outcome-once (no triple grading),
- idempotent overwrite (re-grading yields identical output).

## 10. Out of scope (later)

- Calibration / accuracy-by-tier / factor-value dashboards (downstream readers).
- A visual results page.
- Pinch-hitter / plate-appearance weighting refinement (deferred per memory).
- Any model-math change driven by findings (separate, needs sign-off).
