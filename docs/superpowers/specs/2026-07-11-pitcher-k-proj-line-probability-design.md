# Pitcher-K Projected-Line Probability — Design Spec

**Date:** 2026-07-11
**Branch:** `feat/barrel-edge` (current) — new work branch to be created off `main`
**Scope:** Pitcher strikeouts (K) ONLY. No other prop is touched.
**Status:** Design — awaiting user review before writing the implementation plan.

---

## 1. Problem

The site headlines a pitcher's **projected strikeout count** (e.g. `6.7 K`) in several
places, but that projected number has **no probability of its own**. The `%` shown next
to it is `over_prob` — the chance of clearing the **sportsbook/model line** (e.g. `O 5.5K`),
which is a *different question*. So a pitcher projected for 6.7 K shows `79%`, but that
79% is "chance of 6+ Ks (over 5.5)", not "chance of actually hitting ~7". The honest
"chance he reaches his projection" is missing.

Three concrete symptoms, all in the **Top Pitchers** leaderboard box (`web/components/spatial/HeroTiles.tsx`,
data from `web/app/page.tsx:474`):

1. **Wrong probability metric.** The `%` beside `6.7 K` is the model-line over-prob, not
   the projected-line prob. (`page.tsx:481` `sub: pct(r.prob)`, `r.prob = over_prob`.)
2. **Tracker rounding bug.** The live tracker target (`need`) is derived by feeding the raw
   projection into `propNeed("k", proj)` = `floor(proj)+1` (`web/lib/live.ts:57`, fed at
   `page.tsx:486` `line: r.projection`). That formula was built for `.5` book lines, so a
   raw projection rounds wrong: 6.4 → `floor+1 = 7` (should be `/6`), 6.0 → `7` (should be
   `/6`). Every ~6.x pitcher wrongly shows `/7`. Every OTHER K tracker on the site (board,
   Top Plays, Game Hub, matchups) tracks the **book line** and is correct — this box is the
   only divergence.
3. **Mobile spacing.** In portrait, Top Pitchers rows 3 & 4 are visually glued together
   (landscape is fine).

---

## 2. Key insight — no new math, one number unifies everything

The strikeout distribution already exists. `model/projections.py:71` `poisson_over_prob(lam, line)`
returns `P(K >= floor(line)+1)`. To get the probability of **any** threshold `N`, call it with
`line = N - 0.5` → `P(K >= N)`. This is the same pattern already used elsewhere
(`model/run_props.py:76`). **No distribution changes, no existing probability is altered or
re-graded.** This is a derived value read off the current Poisson.

Define the **projected line** as:

```
N = round(proj_K)      # standard half-up rounding: 6.7→7, 6.4→6, 6.5→7
```

That single `N` becomes **both**:
- the **tracker target** (`need = N`), fixing symptom #2, and
- the **threshold** for the new probability: `proj_line_prob = poisson_over_prob(lam, N - 0.5)`.

Tracker and probability can never disagree because they read the same `N`.

> Note on behavior: because `N ≈ lam`, the proj-line prob for a well-projected pitcher lands
> near ~40–55% (the honest chance of reaching the mean), whereas the model-line prob for the
> same high-projection pitcher is high (79%) because the book line (5.5) sits well below the
> projection. The two numbers *should* differ — that gap is the whole point.

---

## 3. Backend changes (`model/`)

### 3.1 Emit the proj-line fields on every K row
In `model/pipeline.py` (the K-row builder, ~line 182 where `expected_ks`, `line`, `over_prob`
are set), add, computed from the same `lam`:

- `proj_line` = `round(expected_ks)`  (the integer N; the tracker target and label number)
- `proj_over_prob` = `poisson_over_prob(lam, proj_line - 0.5)`  (= `P(K >= N)`)

And the **history twins** for Blend/History modes (mirroring `over_prob_hist`, exported in
`model/export_web.py:250`):
- `proj_line_hist` = `round(expected_ks_hist)`
- `proj_over_prob_hist` = `poisson_over_prob(lam_hist, proj_line_hist - 0.5)`

Export these four fields through `export_web.py` alongside the existing K fields. No other prop
gets these fields.

### 3.2 Record + grade
- **Recorder** (`model/archive.py`): capture `proj_line`, `proj_over_prob` (+ `_hist` twins) on
  K predictions, next to the existing `over_prob`/`line`. New keys, additive.
- **Grader** (`model/grader.py`): grade `proj_over_prob` as a parallel over-call — outcome is
  "did the pitcher's actual Ks reach `proj_line`" (actual_Ks >= proj_line). This sits beside the
  existing book-line K grade; both are scored, so we can later compare calibration of
  model-line vs proj-line calls.

---

## 4. Frontend changes (`web/`)

### 4.1 Weighting/board plumbing
- `web/lib/weighting.ts` `toBoardRows(...,"k",...)`: surface the new fields on the K `BoardRow` —
  `projLine` (`= pickN(proj_line, proj_line_hist)`) and `projProb` (`= pN(proj_over_prob,
  proj_over_prob_hist)`), timeframe-aware like the existing `prob`/`projection`.

### 4.2 Two spheres (Cards / Game Hub / Matchups / Props Table)
Keep the **existing model sphere exactly as-is**. **Add** a second `ProbabilityOrb` for the
proj line beside it. Labels sit to the SIDE of each line (not forced underneath):

```
 ⭕ 79%      ⭕ 44%
 O 5.5K      O 7K
 (model)     (proj)
```

- `(model)` label pairs with the existing `over_prob` sphere and the book line (`O {line}K`).
- `(proj)` label pairs with the new `projProb` sphere and the projected line (`O {projLine}K`).
- Surfaces: `GameHub.tsx` (~line 194), `TopPlays.tsx` (~478), the Props **Table** view, and the
  matchup view — anywhere a `kind="k"` sphere renders today.

### 4.3 Props Table (B) — tracker moves left
On the **Props Table view only**, when the two spheres render as a pair, the live tracker
(`LiveChip`) moves to the **LEFT** of the orb-pair so it is not sandwiched between the model and
proj spheres. Tracker placement everywhere else is unchanged.

### 4.4 Top Pitchers box — stays lean, two fixes
`web/app/page.tsx:474` + `HeroTiles.tsx`:
- **Keep the structure** (top-6 by projection, then ordered by prob) and the single-value layout.
  NO second orb here — it's a compact leaderboard.
- **Fix the prob** (`page.tsx:477` sort key and `:481` `sub`): use `projProb` (the proj-line
  prob) instead of `r.prob` (model-line over_prob). Both the displayed `%` and the step-2
  ordering become the proj-line prob.
- **Fix the tracker target**: feed `proj_line` (the integer N) as the tracker `need` instead of
  `floor(proj)+1`. Cleanest: pass `projLine` through and set `need = projLine` for this box (or
  feed `line = projLine - 0.5` so the existing `propNeed` floor+1 yields N). 6.4 → `/6`, 6.7 →
  `/7`. Only this header box changes; the board/Top Plays/Game Hub keep tracking the book line.

### 4.5 Top Pitchers box — mobile spacing
Un-glue rows 3 & 4 in portrait: add/adjust vertical spacing (gap/padding) on the `LeaderRow`
inside `LeaderBox` so portrait rows are evenly separated. CSS-only.

---

## 5. Rounding rule (explicit)
`N = round(proj_K)` using standard half-up rounding: `6.7 → 7`, `6.4 → 6`, `6.5 → 7`, `6.0 → 6`.
Frontend: `Math.round(proj)`. Backend: `round(expected_ks)` (Python `round` is banker's/half-even;
use `math.floor(x + 0.5)` to guarantee half-up so it matches the frontend and the user's stated
rule). Confirm both sides use the SAME rule so tracker `need` and label `projLine` always match.

---

## 6. Out of scope (explicitly NOT doing)
- No other prop (HR, Hits, TB, Runs, RBI, HRR) gets a proj-line probability or a twin sphere.
  Their displayed probability already matches their own line; there is no orphaned projected
  count to fix.
- No change to any existing probability, distribution, line, or the pitcher engine.
- No second live tracker anywhere. The single existing tracker stays; only its position (Table)
  and its target-rounding (Top Pitchers box) change.

---

## 7. Testing
- **Backend unit:** `proj_line = round(lam)` half-up cases (6.4→6, 6.5→7, 6.7→7, 6.0→6);
  `proj_over_prob == poisson_over_prob(lam, N-0.5)`; `_hist` twins computed from `lam_hist`;
  recorder captures the new keys; grader scores actual_Ks >= proj_line correctly.
- **Frontend unit:** `toBoardRows` surfaces `projLine`/`projProb` timeframe-aware; Top Pitchers
  box tracker `need == projLine` (6.4→6); Top Pitchers ordering uses `projProb`; two-sphere
  labels render `O {line}K (model)` / `O {projLine}K (proj)`.
- **Visual/manual:** preview on localhost — verify the two spheres, the moved tracker on the
  Table, the corrected `/6` tracker + proj-line % in the Top Pitchers box, and the portrait
  row 3/4 spacing on a phone-width viewport. Preview → user approval → prod (per workflow rule).

---

## 8. Files touched (anticipated)
- `model/pipeline.py` — emit `proj_line`, `proj_over_prob` (+ `_hist`).
- `model/export_web.py` — export the four new K fields.
- `model/archive.py` — record the new keys.
- `model/grader.py` — grade the proj-line call.
- `web/lib/weighting.ts` — surface `projLine`/`projProb` on the K `BoardRow`.
- `web/app/page.tsx` — Top Pitchers box: prob + sort + tracker target.
- `web/components/spatial/HeroTiles.tsx` — Top Pitchers row render + mobile spacing.
- `web/components/spatial/GameHub.tsx`, `TopPlays.tsx`, the Table view, the matchup view —
  add the proj sphere + labels; move tracker left on the Table.
- Tests alongside each.
