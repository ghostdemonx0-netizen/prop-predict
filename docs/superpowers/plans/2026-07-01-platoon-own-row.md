# Split Platoon Into Its Own Row — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the handedness (platoon) matchup as its own 🔄 Platoon row on every batter prop — a real +6%/−5% on HR/Runs/RBI/HRR, an info line on Hits/TB.

**Architecture:** Run-prop builder emits the already-computed `platoon` multiplier (one line); the frontend adds a Platoon `<Factor>` on HR (un-merged from Pitcher) + run props, and an info line on Hits/TB. Display-only — every multiplier already exists and is already applied; nothing about the probability changes.

**Tech Stack:** Python (`uv run pytest`), Next.js/React/TS (`web/`, vitest node-env).

## Global Constraints

- **No probability change.** Values already exist/applied; we only re-arrange the display.
- **HR:** un-merge platoon from Pitcher (Pitcher shows `pitcher_mult` only) → no double-count.
- **Runs/RBI/HRR:** platoon was applied but never shown; adding the row is purely additive (the run Pitcher row = `pitcher_factor`/psupp, never included platoon).
- **Hits/TB:** platoon is folded into `pitcher_factor` → **info row only, no standalone %** ("reflected in Pitcher above").
- **Not source-aware:** platoon is handedness-only → one value, no `_hist` twin (rendered raw).
- **Flat value:** +6% advantage / −5% same-hand for everyone (per-batter personalization is a separate roadmap item).

---

### Task 1: Backend — emit `platoon_mult` on run-prop rows

**Files:**
- Modify: `model/pipeline.py` (`_run_prop_rows` row dict, line 541 `"pitcher_factor": psupp,`)
- Test: `tests/test_run_props_pipeline.py`

**Interfaces:**
- Produces: Runs/RBI/HRR rows gain `"platoon_mult": float` = `hr_platoon_mult(bats, throws)`.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_run_props_pipeline.py`:

```python
def test_run_rows_carry_platoon_mult():
    # _bat default bats "R"; _pit default throws "R" -> same-hand -> 0.95
    rows = build_runs_rows(_SLATE, _L, lambda p: _pit(p), _W)
    r = next(x for x in rows if x["player_id"] == 1)
    assert "platoon_mult" in r
    assert math.isclose(r["platoon_mult"], 0.95)  # RHB vs RHP = same-hand
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_run_props_pipeline.py::test_run_rows_carry_platoon_mult -v`
Expected: FAIL (`KeyError: 'platoon_mult'`).

- [ ] **Step 3: Implement — add the field**

In `model/pipeline.py`, the run-prop row dict, next to `"pitcher_factor": psupp,` (line 541):

```python
                    "pitcher_factor": psupp,
                    "platoon_mult": platoon,
```

(`platoon` = `hr_platoon_mult(bats, throws)` already computed at line ~490.)

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_run_props_pipeline.py::test_run_rows_carry_platoon_mult -v`
Expected: PASS.

- [ ] **Step 5: Full suite (proves no prob moved)**

Run: `uv run pytest -q`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add model/pipeline.py tests/test_run_props_pipeline.py
git commit -m "feat(pipeline): emit platoon_mult on run-prop rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Frontend types — `platoon_mult`

**Files:**
- Modify: `web/lib/types.ts`

- [ ] **Step 1: Add the field**

Add `platoon_mult?: number;` to `RunsRow` (inherited by `RbiRow`) and to `HrrRow`. (HR's `matchup_mult` is already declared on `HrRow`.)

- [ ] **Step 2: Typecheck** — `cd web && npx tsc --noEmit` → exit 0.

- [ ] **Step 3: Commit**

```bash
git add web/lib/types.ts
git commit -m "feat(web/types): declare platoon_mult on run rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Frontend — `platoonEdge` helper

**Files:**
- Create: `web/lib/platoon.ts`
- Test: `web/lib/tests/platoon.test.ts`

**Interfaces:**
- Produces: `platoonEdge(bats?: string, throws?: string): boolean` — true when the batter has the handedness advantage (opposite hands, or a switch hitter).

- [ ] **Step 1: Write the failing test** — `web/lib/tests/platoon.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { platoonEdge } from "../platoon";

describe("platoonEdge", () => {
  it("opposite hands = advantage", () => {
    expect(platoonEdge("R", "L")).toBe(true);
    expect(platoonEdge("L", "R")).toBe(true);
  });
  it("same hand = no advantage", () => {
    expect(platoonEdge("R", "R")).toBe(false);
    expect(platoonEdge("L", "L")).toBe(false);
  });
  it("switch hitter always has the edge", () => {
    expect(platoonEdge("S", "R")).toBe(true);
    expect(platoonEdge("S", "L")).toBe(true);
  });
  it("defaults to R when missing", () => {
    expect(platoonEdge(undefined, undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run lib/tests/platoon.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `web/lib/platoon.ts`**

```ts
/** True when the batter has the handedness (platoon) edge: opposite hands, or a
 *  switch hitter (who always bats opposite the pitcher). Mirrors the Python
 *  model's batter_advantage. */
export function platoonEdge(bats?: string, throws?: string): boolean {
  const s = (bats || "R").toUpperCase()[0];
  const h = (throws || "R").toUpperCase()[0];
  if (s === "S") return true;
  return s !== h;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run lib/tests/platoon.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add web/lib/platoon.ts web/lib/tests/platoon.test.ts
git commit -m "feat(web): platoonEdge helper (handedness advantage)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Frontend — the Platoon rows on each prop

**Files:**
- Modify: `web/app/player/[prop]/[id]/page.tsx` (HR Pitcher ~286, hits ~407, tb ~526, runs/rbi ~667, hrr ~782)

**Interfaces:**
- Consumes: `platoonEdge` (Task 3); `r.matchup_mult` (HR), `r.platoon_mult` (run props), `r.bats`/`r.vs.throws`.

- [ ] **Step 1: Import the helper**

Add near the other lib imports: `import { platoonEdge } from "../../../../lib/platoon";`

- [ ] **Step 2: HR — un-merge Pitcher, add the Platoon row**

Replace the HR Pitcher `<Factor>` (lines ~284-291) with a de-platooned Pitcher row **plus** a Platoon row:

```tsx
          {r.vs && r.pitcher_mult !== undefined && (
            <Factor
              icon="⚾"
              label={`Pitcher · ${r.vs.name}`}
              mult={r.pitcher_mult ?? 1}
              note={`${r.vs.name}'s home-run quality (how many he gives up).`}
            />
          )}
          {r.vs && r.matchup_mult !== undefined && (
            <Factor
              icon="🔄"
              label={`Platoon · ${batLabel(r.bats)} vs ${pitLabel(r.vs.throws)}`}
              mult={r.matchup_mult}
              note={`${platoonEdge(r.bats, r.vs.throws) ? "Favorable" : "Tough"} handedness matchup for him.`}
            />
          )}
```

- [ ] **Step 3: Runs/RBI/HRR — add a Platoon row after the Pitcher row**

For the runs/rbi Pitcher `<Factor>` (label `` `Pitcher · ${r.vs.name}` `` at ~667) and the hrr one (~782), add immediately after each closing `)}`:

```tsx
          {r.vs && r.platoon_mult !== undefined && (
            <Factor
              icon="🔄"
              label={`Platoon · ${batLabel(r.bats)} vs ${pitLabel(r.vs.throws)}`}
              mult={r.platoon_mult}
              note={`${platoonEdge(r.bats, r.vs.throws) ? "Favorable" : "Tough"} handedness matchup for him.`}
            />
          )}
```

(Both run/rbi and hrr branches use `r.platoon_mult` — the field is on both row types.)

- [ ] **Step 4: Hits/TB — add the info row after the Pitcher row**

After the hits Pitcher `<Factor>` (`Pitcher · hit quality · ...` ~407) and the tb one (`Pitcher · contact + power · ...` ~526), add:

```tsx
          {r.vs && (
            <div className="factor-note" style={{ marginTop: "0.35rem" }}>
              🔄 <strong style={{ color: "var(--text)" }}>Platoon</strong> · {batLabel(r.bats)} vs {pitLabel(r.vs.throws)} · {platoonEdge(r.bats, r.vs.throws) ? "favorable" : "tough"} — already reflected in the Pitcher factor above.
            </div>
          )}
```

- [ ] **Step 5: Typecheck + lint + vitest**

Run: `cd web && npx tsc --noEmit && npx vitest run && npx eslint app lib`
Expected: tsc 0, vitest all pass, no NEW eslint errors (pre-existing ones remain).

- [ ] **Step 6: Commit**

```bash
git add "web/app/player/[prop]/[id]/page.tsx"
git commit -m "feat(web): 🔄 Platoon row — real % on HR/run props, info on Hits/TB

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verification — regenerate board + preview

- [ ] **Step 1: Full Python suite** — `uv run pytest -q` → all green.
- [ ] **Step 2: Regenerate a local board** — `uv run python -m model.export_web 2026-06-26 1 --include-started`; confirm `grep -c platoon_mult web/public/data/latest.json` > 0.
- [ ] **Step 3: Dev server + eyeball** — `cd web && npm run dev`; open a player page for HR / Hits / TB / Runs / RBI / HRR. Confirm: HR shows a de-platooned Pitcher row **plus** a 🔄 Platoon row (and the rows still visually reconcile to the same headline); run props show a 🔄 Platoon row; Hits/TB show the info line; the favorable/tough label matches the handedness (e.g. RHB vs LHP = favorable).
- [ ] **Step 4: Report + STOP for approval** — share localhost; **do not merge** until the user okays. Then merge + deploy (`force_deploy`, board field added). Mirror in the mock.

---

## Self-Review

**Spec coverage:** run-prop `platoon_mult` emit (Task 1) ✓ · HR un-merge + Platoon row (Task 4 Step 2) ✓ · run-prop Platoon rows (Task 4 Step 3) ✓ · Hits/TB info row (Task 4 Step 4) ✓ · `platoonEdge` helper + tests (Task 3) ✓ · types (Task 2) ✓ · no math change (Task 1 Step 5 keeps prob tests green) ✓ · not source-aware/no `_hist` (rendered raw, no twin added) ✓ · manual preview + stop-before-merge (Task 5) ✓.

**Placeholder scan:** none — complete code/commands throughout.

**Type consistency:** `platoon_mult` (Python emit Task 1 → TS type Task 2 → frontend read Task 4) and `matchup_mult` (already on HrRow) match; `platoonEdge(bats, throws)` signature matches its test + call sites.
