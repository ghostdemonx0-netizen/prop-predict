# Pitcher-K Projected-Line Probability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give pitcher strikeouts an honest "chance of hitting the projected number" — a proj-line probability shown as a second sphere next to the model-line sphere, plus fix the Top Pitchers box's wrong % and wrong tracker rounding.

**Architecture:** Reuse the existing Poisson (`poisson_over_prob`) at threshold `N = round(proj)`. The backend emits `proj_line`/`proj_over_prob` (+ `_hist` twins) on every K row; the recorder+grader capture and score them. The frontend surfaces `projLine`/`projProb` on the K `BoardRow`, fixes the Top Pitchers box, and adds one reusable `KSpherePair` component dropped into Game Hub + BoardView (Cards/Table/Matchups). Pitcher K only.

**Tech Stack:** Python 3 (`model/`, pytest), Next.js/TypeScript (`web/`, vitest), the "Spatial Depth" spatial component kit.

## Global Constraints

- **Scope: pitcher strikeouts (K) ONLY.** No HR/Hits/TB/Runs/RBI/HRR field, sphere, or math change.
- **No model/distribution change.** `proj_over_prob` is a NEW derived read off the EXISTING Poisson; no existing probability (`over_prob`), line, or the pitcher engine is altered or re-graded.
- **Rounding is half-UP on both sides:** `6.7→7, 6.5→7, 6.4→6, 6.0→6`. Backend `math.floor(x + 0.5)` (Python `round` is half-even — do NOT use it). Frontend `Math.round(x)`. Tracker `need` and label `projLine` must always equal the same `N`.
- **No second live tracker.** The single existing tracker stays; only its position (BoardView Table) and its rounding (Top Pitchers box) change.
- **Labels:** model sphere caption `O {line}K (model)`, proj sphere caption `O {projLine}K (proj)`, tag to the SIDE (not forced underneath).
- **Preview before prod.** Localhost preview + user approval before any deploy (per project workflow rule).
- Web note: this is a modified Next.js — before writing web code, check `web/AGENTS.md` / `node_modules/next/dist/docs/` for API differences.

---

### Task 1: Backend — emit `proj_line` + `proj_over_prob` (+ `_hist`) on every K row

**Files:**
- Modify: `model/pipeline.py:188-200` (K row dict in `build_strikeout_rows`)
- Modify: `model/export_web.py:250-252` (K history-twin merge)
- Test: `model/tests/test_pipeline.py` (add cases; create if the K test module differs — match existing test file naming)

**Interfaces:**
- Consumes: existing `lam` (float, expected Ks) and `poisson_over_prob(lam, line)` from `model/projections.py:71`.
- Produces: each strikeout row dict gains `proj_line: int`, `proj_over_prob: float`. After export merge, rows also carry `proj_line_hist: int`, `proj_over_prob_hist: float`.

- [ ] **Step 1: Write the failing test** (in `model/tests/test_pipeline.py`)

```python
import math
from model.projections import poisson_over_prob

def test_proj_line_is_half_up_round_of_expected_ks():
    # half-up: 6.4->6, 6.5->7, 6.7->7, 6.0->6
    for lam, expected_n in [(6.4, 6), (6.5, 7), (6.7, 7), (6.0, 6)]:
        assert int(math.floor(lam + 0.5)) == expected_n

def test_proj_over_prob_matches_poisson_at_N_minus_half():
    lam = 6.7
    n = int(math.floor(lam + 0.5))  # 7
    assert n == 7
    # P(K >= 7) == poisson_over_prob(lam, 6.5)
    assert abs(poisson_over_prob(lam, n - 0.5) - poisson_over_prob(lam, 6.5)) < 1e-12
```

- [ ] **Step 2: Run test to verify it fails / passes trivially, then add the row-level test**

Run: `cd /Users/issiakadiawara/Projects/prop-predict && python -m pytest model/tests/test_pipeline.py -k proj -v`
Expected: the two helper-shape tests PASS (they assert the rule). Now add a row-integration test that builds a K row and asserts the keys exist — it will FAIL until Step 3:

```python
def test_build_strikeout_rows_emits_proj_fields(monkeypatch):
    from model import pipeline
    rows = pipeline.build_strikeout_rows(*_min_k_slate_fixtures())  # reuse existing K-row test fixtures
    r = rows[0]
    assert "proj_line" in r and "proj_over_prob" in r
    assert r["proj_line"] == int(math.floor(r["expected_ks"] + 0.5))
    assert abs(r["proj_over_prob"] - poisson_over_prob(r["expected_ks"], r["proj_line"] - 0.5)) < 1e-9
```
(If no reusable K fixture exists, copy the arrangement from the nearest existing `build_strikeout_rows` test in the file.)

Run again — expect FAIL: `KeyError: 'proj_line'`.

- [ ] **Step 3: Implement — add the two fields to the K row dict** (`model/pipeline.py`, inside the `rows.append({...})` at 188-200)

```python
            proj_line = int(math.floor(lam + 0.5))  # half-up round of expected Ks
            rows.append({
                "prop": "K", "game_id": game["game_id"],
                "game_time": game.get("game_time"),
                "player_id": p.get("player_id"),
                "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                "player": p["name"], "team": team,
                "expected_ks": lam, "line": line, "over_prob": poisson_over_prob(lam, line),
                "proj_line": proj_line,
                "proj_over_prob": poisson_over_prob(lam, proj_line - 0.5),
                "baseline_over_prob": baseline_over, "pace": baseline_ks,
                "wind_out_mph": w["wind_out_mph"], "wind_mph": w["wind_mph"],
                "wind_dir": w["wind_dir"], "temp_f": w["temp_f"], "precip_pct": w["precip_pct"],
                "throws": p.get("throws", "R"), "matchups": matchups,
                "pitcher_status": p.get("pitcher_status", "confirmed"),
            })
```
Ensure `import math` is present at the top of `model/pipeline.py` (add if missing).

- [ ] **Step 4: Add the `_hist` twin merge** (`model/export_web.py`, after line 252)

```python
        r["over_prob_hist"] = h["over_prob"]
        r["expected_ks_hist"] = h["expected_ks"]
        r["baseline_over_prob_hist"] = h.get("baseline_over_prob")
        r["proj_line_hist"] = h["proj_line"]
        r["proj_over_prob_hist"] = h["proj_over_prob"]
```

- [ ] **Step 5: Run the tests**

Run: `python -m pytest model/tests/test_pipeline.py -k proj -v`
Expected: PASS.

- [ ] **Step 6: Full backend suite (no regressions)**

Run: `python -m pytest model/ -q`
Expected: all pass (previous green count + the new tests).

- [ ] **Step 7: Commit**

```bash
git add model/pipeline.py model/export_web.py model/tests/test_pipeline.py
git commit -m "feat(k): emit proj_line + proj_over_prob (+ _hist) on strikeout rows"
```

---

### Task 2: Backend — recorder captures the proj-line fields

**Files:**
- Modify: `model/archive.py:47-76` (`_FACTOR_KEYS`)
- Test: `model/tests/test_archive.py`

**Interfaces:**
- Consumes: K rows now carrying `proj_line`, `proj_over_prob`, `proj_line_hist`, `proj_over_prob_hist` (Task 1).
- Produces: archived K predictions whose `factors` include those four keys.

- [ ] **Step 1: Write the failing test** (`model/tests/test_archive.py`)

```python
def test_strikeout_archive_captures_proj_fields():
    row = _sample_k_row()  # a build_strikeout_rows-shaped dict incl. proj_line/proj_over_prob(+_hist)
    rec = archive.build_prediction_record(row, prop="strikeouts", date="2026-07-11")
    f = rec["factors"]
    assert f["proj_line"] == row["proj_line"]
    assert f["proj_over_prob"] == row["proj_over_prob"]
    assert f["proj_line_hist"] == row["proj_line_hist"]
    assert f["proj_over_prob_hist"] == row["proj_over_prob_hist"]
```
(Match the real record-builder function name in `archive.py`; adjust `_sample_k_row` from an existing archive test fixture, adding the four proj keys.)

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest model/tests/test_archive.py -k proj -v`
Expected: FAIL — keys absent from `factors`.

- [ ] **Step 3: Implement — add keys to `_FACTOR_KEYS`** (`model/archive.py`, in the `# strikeouts / K family` block near line 73)

```python
    # strikeouts / K family
    "expected_ks",
    "expected_ks_hist",
    "line",
    "proj_line",
    "proj_line_hist",
    "proj_over_prob",
    "proj_over_prob_hist",
```

- [ ] **Step 4: Run the test**

Run: `python -m pytest model/tests/test_archive.py -k proj -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add model/archive.py model/tests/test_archive.py
git commit -m "feat(k): recorder archives proj_line + proj_over_prob on K predictions"
```

---

### Task 3: Backend — grader scores the proj-line call

**Files:**
- Modify: `model/grader.py:87-103` (strikeouts branch)
- Test: `model/tests/test_grader.py`

**Interfaces:**
- Consumes: archived K prediction with `factors.proj_line` (int) and `factors.proj_over_prob` (Task 2); the pitcher's actual strikeouts `actual_k`.
- Produces: a second graded result key `reach {proj_line}` = `actual_k >= proj_line`, alongside the existing `over {line}` result. Existing book-line grading unchanged.

- [ ] **Step 1: Write the failing test** (`model/tests/test_grader.py`)

```python
def test_grader_scores_proj_line_reach():
    pred = _k_prediction(line=5.5, proj_line=7)   # existing helper + proj_line in factors
    rec = grader.grade_prediction(pred, actual_k=7)
    assert rec["results"]["over 5.5"] is True      # existing book-line grade untouched
    assert rec["results"]["reach 7"] is True        # NEW: actual 7 >= proj_line 7
    rec2 = grader.grade_prediction(pred, actual_k=6)
    assert rec2["results"]["reach 7"] is False       # 6 < 7
```
(Match the real grading entry-point name/signature in `grader.py`; adapt `_k_prediction` from an existing strikeout grader test, adding `proj_line` to `factors`.)

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest model/tests/test_grader.py -k proj_line -v`
Expected: FAIL — `KeyError: 'reach 7'`.

- [ ] **Step 3: Implement — add the proj-line grade** (`model/grader.py`, in the `if prop == "strikeouts":` branch, after the existing `rec["results"] = {label: actual_k > line}` at ~line 103)

```python
        # proj-line reach: did the pitcher reach his rounded PROJECTION (N)?
        proj_line = pred.get("factors", {}).get("proj_line")
        if proj_line is not None:
            rec["results"][f"reach {int(proj_line)}"] = actual_k >= int(proj_line)
```
Ensure `rec["results"]` is a dict already populated by the existing book-line line (it is: `rec["results"] = {label: ...}` runs just above). If the existing code returns early on the integer-line push edge case (`float(line) == int(line) and actual_k == int(line)` at ~99), add the proj-line grade BEFORE that early-return branch so it is not skipped.

- [ ] **Step 4: Run the test**

Run: `python -m pytest model/tests/test_grader.py -k proj_line -v`
Expected: PASS.

- [ ] **Step 5: Full backend suite**

Run: `python -m pytest model/ -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add model/grader.py model/tests/test_grader.py
git commit -m "feat(k): grader scores the proj-line reach alongside the book line"
```

---

### Task 4: Frontend — surface `projLine`/`projProb` on the K BoardRow

**Files:**
- Modify: `web/lib/weighting.ts:171-194` (K branch of `toBoardRows`) + the `BoardRow` type declaration in the same file
- Test: `web/lib/weighting.test.ts` (or the existing weighting test file — match the repo's vitest path)

**Interfaces:**
- Consumes: K JSON rows with `proj_line`, `proj_over_prob` (+ `_hist`) from Task 1; existing helpers `pN(cur, hist)` and `pickN(cur, hist, source)`.
- Produces: K `BoardRow` gains `projLine?: number` and `projProb?: number`, timeframe-aware. Consumed by Tasks 5, 7, 8.

- [ ] **Step 1: Write the failing test** (`web/lib/weighting.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { toBoardRows } from "./weighting";

it("surfaces projLine and projProb on K rows (current source)", () => {
  const data: any = { strikeouts: [{
    player: "Zebby Matthews", player_id: 1, team: "MIN", throws: "R",
    line: 5.5, over_prob: 0.79, expected_ks: 6.7,
    proj_line: 7, proj_over_prob: 0.44,
    proj_line_hist: 6, proj_over_prob_hist: 0.51,
    over_prob_hist: 0.7, expected_ks_hist: 5.9,
  }] };
  const [r] = toBoardRows(data, "k", 0, "current");
  expect(r.projLine).toBe(7);
  expect(r.projProb).toBeCloseTo(0.44, 5);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/issiakadiawara/Projects/prop-predict/web && npx vitest run lib/weighting.test.ts`
Expected: FAIL — `r.projLine` is `undefined`.

- [ ] **Step 3: Implement — add the two fields in the K map** (`web/lib/weighting.ts`, in the `prop === "k"` branch, next to `projection`/`line`)

```ts
      prob: pN(r.over_prob, r.over_prob_hist),
      projection: (pickN(r.expected_ks, r.expected_ks_hist, source) ?? r.expected_ks).toFixed(1),
      line: r.line.toFixed(1),
      projLine: pickN(r.proj_line, r.proj_line_hist, source) ?? r.proj_line,
      projProb: pN(r.proj_over_prob, r.proj_over_prob_hist),
```
And add to the `BoardRow` type (same file):
```ts
  projLine?: number;
  projProb?: number;
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/weighting.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
cd /Users/issiakadiawara/Projects/prop-predict/web && npx tsc --noEmit
git add web/lib/weighting.ts web/lib/weighting.test.ts
git commit -m "feat(k): surface projLine + projProb on the K BoardRow (timeframe-aware)"
```

---

### Task 5: Frontend — Top Pitchers box: proj-line % + ordering + tracker rounding

**Files:**
- Modify: `web/app/page.tsx:474-487` (`topPitchers`)
- Test: `web/app/topPitchers.test.ts` (new small unit test around the sort+need logic; or fold into an existing page-logic test if one exists)

**Interfaces:**
- Consumes: K `BoardRow` with `projLine`/`projProb` (Task 4); `propNeed("k", line)` from `web/lib/live.ts:56` (`floor(line)+1`).
- Produces: the box ordered by `projProb`, `sub` = `pct(projProb)`, and the tracker `line` string = `projLine - 0.5` so `need == projLine`.

- [ ] **Step 1: Write the failing test** (`web/app/topPitchers.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { propNeed } from "../lib/live";

// The tracker line we will feed for a projected N must yield need === N.
it("proj-line half-line yields tracker need === round(proj)", () => {
  const projLine = 6;                       // e.g. proj 6.4 -> round 6
  const lineStr = String(projLine - 0.5);   // "5.5"
  expect(propNeed("k", lineStr)).toBe(6);   // NOT 7
  const projLine2 = 7;                      // proj 6.7 -> 7
  expect(propNeed("k", String(projLine2 - 0.5))).toBe(7);
});
```

- [ ] **Step 2: Run to verify it passes for the helper, then assert the page wiring**

Run: `cd web && npx vitest run app/topPitchers.test.ts`
Expected: PASS (this pins the rule the page must use). The page edit in Step 3 makes the box actually use it.

- [ ] **Step 3: Implement — update `topPitchers`** (`web/app/page.tsx`)

```ts
  const topPitchers: DashRow[] = toBoardRows(data, "k", 0, source)
    .sort((a, b) => Number(b.projection ?? 0) - Number(a.projection ?? 0)) // step 1: top proj
    .slice(0, 6)
    .sort((a, b) => Number(b.projProb ?? 0) - Number(a.projProb ?? 0))     // step 2: order by PROJ-line prob
    .map((r) => ({
      name: r.player,
      value: r.projection ? `${r.projection} K` : pct(r.projProb ?? r.prob),
      sub: pct(r.projProb ?? r.prob),                       // proj-line %, matches the proj K shown
      hand: handGlyph(r.playerHand),
      team: r.team,
      playerId: r.player_id,
      gameId: r.gameId,
      line: r.projLine != null ? String(r.projLine - 0.5) : (r.projection ?? r.line), // tracker need === round(proj)
    }));
```
Update the block comment above it (lines 460-473) to say the box now HEADLINES proj K, shows the PROJ-line probability, orders by it, and the tracker targets `round(proj)` (`floor(projLine-0.5)+1 = projLine`).

- [ ] **Step 4: Run tests + typecheck**

Run: `cd web && npx vitest run app/topPitchers.test.ts && npx tsc --noEmit`
Expected: PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add web/app/page.tsx web/app/topPitchers.test.ts
git commit -m "fix(k): Top Pitchers box shows proj-line %, orders by it, tracker targets round(proj)"
```

---

### Task 6: Frontend — Top Pitchers box mobile spacing (rows 3 & 4)

**Files:**
- Modify: `web/components/spatial/spatial.css` (the `.sp-drow` / LeaderBox column rules) — and/or `HeroTiles.tsx` if spacing is inline
- Test: visual (CSS; no unit test)

**Interfaces:** none (pure CSS).

- [ ] **Step 1: Reproduce** — run the dev server, open in a portrait phone-width viewport (≤430px), Top Pitchers box, confirm rows 3 & 4 are visually glued (less vertical gap than 1–2 / 5–6).

Run: `cd web && npm run dev` → open `http://localhost:3000` at portrait width (device toolbar).

- [ ] **Step 2: Locate the rule** — inspect `.sp-drow` and the LeaderBox column split (`HeroTiles.tsx:150+` builds column-major `<ol>`s; the 3|3 split can drop the gap between the two columns' rows in portrait). Grep:

Run: `grep -n "sp-drow\|sp-dgrid\|LeaderBox\|column" web/components/spatial/spatial.css`

- [ ] **Step 3: Implement** — add consistent vertical spacing so every portrait row has equal gap (e.g. `row-gap`/`padding-block` on `.sp-drow` within the pitchers box, or fix the column-major reflow so rows 3&4 aren't adjacent without gap). Example:

```css
/* portrait: even spacing between all leaderboard rows incl. the 3|4 column seam */
@media (max-width: 640px) {
  .sp-dbox .sp-drow { padding-block: 6px; }
}
```
(Use the box's actual class; match the existing spacing scale.)

- [ ] **Step 4: Verify** — reload portrait, confirm rows 1–6 are evenly spaced; confirm landscape/desktop unchanged.

- [ ] **Step 5: Commit**

```bash
git add web/components/spatial/spatial.css web/components/spatial/HeroTiles.tsx
git commit -m "fix(k): even portrait spacing for Top Pitchers rows (un-glue 3 & 4)"
```

---

### Task 7: Frontend — reusable `KSpherePair` component

**Files:**
- Create: `web/components/spatial/KSpherePair.tsx`
- Modify: `web/components/spatial/spatial.css` (add `.sp-ksphere*` rules)
- Test: `web/components/spatial/tests/KSpherePair.test.tsx` (match existing spatial test path)

**Interfaces:**
- Consumes: a K `BoardRow` (needs `prob`, `line`, `projProb`, `projLine`); `ProbabilityOrb` from `./ProbabilityOrb`; `pct` from `../../lib/format`.
- Produces: `KSpherePair({ row, size?, tracker? })` — renders model orb + proj orb with side captions; optional `tracker` node placed to the LEFT of the pair (used by BoardView Table in Task 8). If `projProb`/`projLine` are missing, renders the model orb only (graceful during rollout).

- [ ] **Step 1: Write the failing test** (`web/components/spatial/tests/KSpherePair.test.tsx`)

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { KSpherePair } from "../KSpherePair";

it("renders two orbs with model + proj captions", () => {
  const row: any = { prob: 0.79, line: "5.5", projProb: 0.44, projLine: 7 };
  const { container, getByText } = render(<KSpherePair row={row} size={44} />);
  expect(getByText(/O 5.5K/)).toBeTruthy();
  expect(getByText(/\(model\)/)).toBeTruthy();
  expect(getByText(/O 7K/)).toBeTruthy();
  expect(getByText(/\(proj\)/)).toBeTruthy();
  // two orb SVGs
  expect(container.querySelectorAll("svg").length).toBe(2);
});

it("renders only the model orb when proj is missing", () => {
  const row: any = { prob: 0.79, line: "5.5" };
  const { container } = render(<KSpherePair row={row} size={44} />);
  expect(container.querySelectorAll("svg").length).toBe(1);
});
```
(Match the repo's existing spatial test imports/setup — copy the render harness from a neighboring `*.test.tsx`.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run components/spatial/tests/KSpherePair.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component** (`web/components/spatial/KSpherePair.tsx`)

```tsx
import ProbabilityOrb from "./ProbabilityOrb";
import type { BoardRow } from "../../lib/weighting";
import type { ReactNode } from "react";

/** Model-line + projected-line probability orbs for a pitcher K row.
 *  Left: chance of clearing the book line (existing). Right: chance of reaching
 *  the rounded projection (new). Captions sit to the SIDE of each orb.
 *  `tracker` (optional) renders to the LEFT of the pair (BoardView Table). */
export function KSpherePair({
  row,
  size = 44,
  tracker,
}: {
  row: BoardRow;
  size?: number;
  tracker?: ReactNode;
}) {
  const hasProj = typeof row.projProb === "number" && typeof row.projLine === "number";
  return (
    <span className="sp-ksphere-pair">
      {tracker}
      <span className="sp-ksphere">
        <ProbabilityOrb prob={row.prob} kind="k" size={size} />
        <small className="sp-ksphere-cap">O {row.line}K <em>(model)</em></small>
      </span>
      {hasProj && (
        <span className="sp-ksphere">
          <ProbabilityOrb prob={row.projProb as number} kind="k" size={size} />
          <small className="sp-ksphere-cap">O {row.projLine}K <em>(proj)</em></small>
        </span>
      )}
    </span>
  );
}

export default KSpherePair;
```

- [ ] **Step 4: Add CSS** (`web/components/spatial/spatial.css`)

```css
.sp-ksphere-pair { display: inline-flex; align-items: center; gap: 12px; }
.sp-ksphere { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; }
.sp-ksphere-cap { font-size: 10px; opacity: 0.7; white-space: nowrap; }
.sp-ksphere-cap em { font-style: normal; opacity: 0.8; }
```
(Match the existing caption/size scale in `spatial.css`; caption may sit beside rather than under the orb — adjust `flex-direction` if the user prefers side-by-side at preview.)

- [ ] **Step 5: Run tests + typecheck**

Run: `cd web && npx vitest run components/spatial/tests/KSpherePair.test.tsx && npx tsc --noEmit`
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add web/components/spatial/KSpherePair.tsx web/components/spatial/spatial.css web/components/spatial/tests/KSpherePair.test.tsx
git commit -m "feat(k): reusable KSpherePair (model + proj orbs with side captions)"
```

---

### Task 8: Frontend — drop `KSpherePair` into Game Hub + BoardView (Cards/Table/Matchups)

**Files:**
- Modify: `web/components/spatial/GameHub.tsx:194` (PitcherRow)
- Modify: `web/components/spatial/board/BoardView.tsx` — the K sphere sites at `:247` (Split/Cards), `:408`, `:518` (Table + Matchups view modes)
- Test: extend `web/components/spatial/tests/` render tests where they exist; otherwise visual

**Interfaces:**
- Consumes: `KSpherePair` (Task 7); the K `BoardRow` with `projLine`/`projProb`.
- Produces: two spheres on Game Hub + BoardView Cards/Table/Matchups for `kind==="k"`; on the **Table** view the `LiveChip` is passed as `tracker` so it sits LEFT of the pair.

- [ ] **Step 1: Game Hub** (`GameHub.tsx`) — replace the single K orb (line 194) with the pair; the existing LiveChip at 193 already sits left of it, so keep it as-is:

```tsx
      <span className="sp-pit-right">
        {lv && <LiveChip state={lv.state} have={lv.have} need={lv.need} />}
        <KSpherePair row={r} size={44} />
      </span>
```
Add `import KSpherePair from "./KSpherePair";` at the top.

- [ ] **Step 2: BoardView — identify the three K sphere sites.** BoardView renders `<ProbabilityOrb prob={r.prob} kind={prop} .../>` generically at `:247` (Split/Cards row, size 72), `:408` (size 46), `:518` (size 46). Determine which of 408/518 is the **Table** view vs the **Matchups** view (read the surrounding JSX / the `view`/mode conditional). Only apply the pair when `prop === "k"`; keep the single orb for all other props:

```tsx
{prop === "k"
  ? <KSpherePair row={r} size={72} />
  : <ProbabilityOrb prob={r.prob} kind={prop} size={72} />}
```
Apply the analogous swap at 408 and 518 with their sizes (46). Add `import KSpherePair from "../KSpherePair";`.

- [ ] **Step 3: Table view — move the tracker LEFT of the pair.** At the Table-mode K sphere site, pass the existing `LiveChip` into `KSpherePair`'s `tracker` slot instead of rendering it after/around the orb, so it sits to the LEFT of the two orbs:

```tsx
{prop === "k"
  ? <KSpherePair row={r} size={46} tracker={lv ? <LiveChip state={lv.state} have={lv.have} need={lv.need} sm /> : null} />
  : (<>
      <ProbabilityOrb prob={r.prob} kind={prop} size={46} />
      {lv && <LiveChip state={lv.state} have={lv.have} need={lv.need} sm />}
    </>)}
```
Leave the Cards/Split/Matchups tracker placement as-is (user: tracker is fine everywhere except the Table).

- [ ] **Step 4: Typecheck + lint + unit tests**

Run: `cd web && npx tsc --noEmit && npx eslint . --ext .ts,.tsx --max-warnings=0 && npx vitest run`
Expected: clean / all pass.

- [ ] **Step 5: Visual verification** — dev server; for a K prop confirm on **Game Hub**, **Props → Cards**, **Props → Table** (tracker LEFT of the pair), **Props → Matchups**: two orbs with `O {line}K (model)` / `O {projLine}K (proj)`; other props still show ONE orb; Top Pitchers box shows the corrected `/6` tracker + proj-line %; portrait rows 3&4 spaced.

- [ ] **Step 6: Commit**

```bash
git add web/components/spatial/GameHub.tsx web/components/spatial/board/BoardView.tsx
git commit -m "feat(k): twin model+proj spheres on Game Hub + Props Cards/Table/Matchups (tracker left on Table)"
```

---

### Task 9: Verify end-to-end on a real board + preview → approval

**Files:** none (verification only)

- [ ] **Step 1: Regenerate a small real board** (heavy Statcast pull) so the K rows carry real `proj_line`/`proj_over_prob`, per the project's local board-build entry point (e.g. `python -m model.export_web <date> --max-games=N`; confirm the exact command from `model/` docs/CLAUDE notes).

- [ ] **Step 2: Confirm the payload** — the K rows in the generated JSON contain `proj_line`, `proj_over_prob`, `proj_line_hist`, `proj_over_prob_hist`, and that `proj_over_prob == poisson_over_prob(expected_ks, proj_line-0.5)` for a spot-checked pitcher.

- [ ] **Step 3: Dev server preview** — walk all surfaces (Top Pitchers box, Game Hub, Props Cards/Table/Matchups) on that real board; sanity-check that a high-proj pitcher shows a HIGH model % and a LOWER proj %, and the two captions read correctly.

- [ ] **Step 4: Show the user the localhost preview and get explicit approval BEFORE any deploy.** (Per workflow rule; do not deploy without it.)

---

## Self-Review notes (checked against the spec)

- **Spec §3.1** (emit proj fields + hist) → Task 1. **§3.2** (record) → Task 2; **§3.2** (grade) → Task 3.
- **§4.1** (weighting plumbing) → Task 4. **§4.2** (two spheres + labels) → Tasks 7–8. **§4.3** (Table tracker-left) → Task 8 Step 3. **§4.4** (Top Pitchers box) → Task 5. **§4.5** (mobile) → Task 6.
- **§5** rounding half-up → Global Constraints + Task 1 (`floor(x+0.5)`) + Task 5 (frontend line string) — both sides pinned to the same `N`.
- **§6** out-of-scope enforced by `prop === "k"` guards (Task 8) + K-only field emission (Task 1).
- **§7** testing → each task's TDD steps + Task 9.
- Known discovery points (bounded, called out inline): the exact 408-vs-518 Table/Matchups mapping in BoardView (Task 8 Step 2), and the local board-build command (Task 9 Step 1). Neither is a placeholder — each has a concrete lookup instruction.
- **Not included by design:** TopPlays (`TopPlays.tsx:478`) and PlayerModal (`:191`) K spheres — the user named cards/game-hub/table/matchups only. Flag these two at preview as a one-line follow-up if the user wants consistency.
