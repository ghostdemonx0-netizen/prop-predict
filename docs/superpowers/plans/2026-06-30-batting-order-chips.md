# Batting Order in Status Chips — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the batting-order number (1–9) inside every individual-batter proj/conf chip (`CONF·#3` / `PROJ·#1`), site-wide, and add a "Batters" sort button to the Game Hub.

**Architecture:** Emit `bat_order` (the lineup slot the row is already built from) onto each batter row; the web payload serializes the whole row dict, so it reaches the frontend. `StatusChip` gains an optional `order` prop appended as `·#N`. The Game Hub gets a new sort column. Display-only; no probability/recorder/grader change.

**Tech Stack:** Python (`uv run pytest`), Next.js/React/TS (`web/`, `npx tsc`/`vitest`/`eslint`).

## Global Constraints

- **No math / no probability changes.** `bat_order` is a display field, not a factor/dial. Existing probability tests stay green/unchanged.
- **Number on individual-batter chips only.** `StatusChip mode="pair"` (game/team headers) and the pitcher chip never show a number.
- **Format:** `CONF·#3` / `PROJ·#1` — tight, no spaces around the dot. Missing `bat_order` → chip renders exactly as today.
- **`bat_order` is 1-based** (leadoff = 1). It is the same value for a player across all props (their lineup slot).

---

### Task 1: Backend — emit `bat_order` on every batter row

**Files:**
- Modify: `model/pipeline.py` — HR builder (~line 110 row dict), `_threshold_rows` (~line 359 row dict), run-prop builder (~line 487 row dict)
- Test: `tests/test_pipeline.py`, `tests/test_threshold_pipeline.py`, `tests/test_run_props_pipeline.py`

**Interfaces:**
- Produces: each HR/Hits/TB/Runs/RBI/HRR row dict gains `"bat_order": int` = 1-based lineup position. Strikeout (pitcher) rows do NOT get it.

- [ ] **Step 1: Write failing tests**

In `tests/test_pipeline.py` (HR), append:

```python
def test_hr_rows_carry_bat_order():
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    assert rows
    assert all(isinstance(r.get("bat_order"), int) for r in rows)
    # leadoff hitter on each side is #1
    assert min(r["bat_order"] for r in rows) == 1
```

In `tests/test_threshold_pipeline.py`, append (a 2-batter lineup so positions are 1 and 2):

```python
def test_threshold_rows_carry_bat_order():
    lf = lambda g: {"home": [_bat(1, 400, 90, 25, 3, 20), _bat(3, 400, 80, 20, 2, 10)],
                    "away": [_bat(2, 400, 90, 25, 3, 20)]}
    pf = lambda pid: _pit(pid)
    hits = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    tb = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    assert {r["bat_order"] for r in hits} == {1, 2}   # home slots 1,2; away slot 1
    assert all(isinstance(r.get("bat_order"), int) for r in tb)
```

In `tests/test_run_props_pipeline.py`, append a test mirroring its existing fixture style asserting `build_runs_rows(...)[0]["bat_order"]` is an int and the leadoff batter is `1`. (Reuse that file's existing lineup-builder helper; assert `min(r["bat_order"] ...) == 1`.)

- [ ] **Step 2: Run to verify they fail**

Run: `uv run pytest tests/test_pipeline.py -k bat_order tests/test_threshold_pipeline.py -k bat_order -v`
Expected: FAIL with `KeyError: 'bat_order'` / assertion error.

- [ ] **Step 3: Implement — add the field in all three builders**

In `build_hr_rows`, in the row dict (next to `"bats": b.get("bats", "R"),`), add:

```python
                    "bat_order": slot + 1,
```

In `_threshold_rows`, in the `row = {...}` dict (next to `"bats": b.get("bats", "R"),`), add:

```python
                    "bat_order": slot + 1,
```

In the run-prop builder, in its row dict (next to the other identity fields), add:

```python
                    "bat_order": pos,
```

(`pos = i + 1` already exists in that loop; `slot` is the `enumerate` index in the HR/threshold loops.)

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest tests/test_pipeline.py tests/test_threshold_pipeline.py tests/test_run_props_pipeline.py -q`
Expected: PASS.

- [ ] **Step 5: Full suite (proves no probability moved)**

Run: `uv run pytest -q`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py tests/test_threshold_pipeline.py tests/test_run_props_pipeline.py
git commit -m "feat(pipeline): emit bat_order (1-9 lineup slot) on every batter row

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Frontend types — declare `bat_order`

**Files:**
- Modify: `web/lib/types.ts`, `web/components/PropBoard.tsx` (BoardRow type, ~line 36)

- [ ] **Step 1: Add `bat_order?: number` to row types**

In `web/lib/types.ts`, add `bat_order?: number;` to `HrRow`, `HitsRow` (TbRow inherits), `RunsRow` (RbiRow inherits), `HrrRow`.

- [ ] **Step 2: Add to `BoardRow`**

In `web/components/PropBoard.tsx`, after `status?: string;` (line 36):

```ts
  bat_order?: number; // batting-order slot 1-9 (hitters only)
```

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add web/lib/types.ts web/components/PropBoard.tsx
git commit -m "feat(web/types): declare bat_order on row + BoardRow types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `StatusChip` — optional `order`

**Files:**
- Modify: `web/components/StatusChip.tsx`
- Test: `web/components/StatusChip.test.tsx` (create; vitest)

**Interfaces:**
- Produces: `<StatusChip status order? mode? />`. In `single` mode with a numeric `order`, the chip text becomes `CONF·#${order}` / `PROJ·#${order}`. `pair` mode ignores `order`. No `order` → unchanged.

- [ ] **Step 1: Write failing test**

Create `web/components/StatusChip.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { StatusChip } from "./StatusChip";
import { describe, it, expect } from "vitest";

describe("StatusChip", () => {
  it("appends batting order in single mode", () => {
    const { container } = render(<StatusChip status="confirmed" order={3} />);
    expect(container.textContent).toBe("CONF·#3");
  });
  it("projected with order", () => {
    const { container } = render(<StatusChip status="projected" order={1} />);
    expect(container.textContent).toBe("PROJ·#1");
  });
  it("no order -> plain", () => {
    const { container } = render(<StatusChip status="confirmed" />);
    expect(container.textContent).toBe("CONF");
  });
  it("pair mode ignores order", () => {
    const { container } = render(<StatusChip status="confirmed" order={3} mode="pair" />);
    expect(container.textContent).toBe("PROJCONF");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run components/StatusChip.test.tsx`
Expected: FAIL (order not rendered / `order` not a prop).

- [ ] **Step 3: Implement**

Edit `web/components/StatusChip.tsx`:

```tsx
export function StatusChip({ status, order, mode = "single" }: { status?: string; order?: number; mode?: "single" | "pair" }) {
  if (!status) return null;
  const confirmed = CONFIRMED.has(status);
  const suffix = typeof order === "number" ? `·#${order}` : "";
  if (mode === "single") {
    return (
      <span
        className={confirmed ? "chip-conf" : "chip-proj"}
        title={confirmed ? "official lineup confirmed" : "projected from the team's last game — not yet official"}
      >
        {(confirmed ? "CONF" : "PROJ") + suffix}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`chip-proj ${confirmed ? "chip-off" : ""}`}>PROJ</span>
      <span className={`chip-conf ${confirmed ? "" : "chip-off"}`}>CONF</span>
    </span>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run components/StatusChip.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add web/components/StatusChip.tsx web/components/StatusChip.test.tsx
git commit -m "feat(web): StatusChip optional batting-order suffix (CONF·#3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire `bat_order` into BoardRow + chip call sites

**Files:**
- Modify: `web/app/page.tsx` (6 batter mapping blocks: HR 167, hits 246, tb 272, runs 298, rbi 324, hrr 350)
- Modify: `web/components/PropBoard.tsx` (StatusChip calls at 155, 236, 627)

- [ ] **Step 1: Carry `bat_order` into BoardRow at the 6 batter sites**

In `web/app/page.tsx`, beside each `status: r.lineup_status,` (the 6 batter blocks — NOT the pitcher block at line 190 which uses `r.pitcher_status`), add:

```ts
    bat_order: r.bat_order,
```

- [ ] **Step 2: Pass `order` to the three individual-batter chips**

In `web/components/PropBoard.tsx`:
- Line 155 (Card): `<StatusChip status={r.status} order={r.bat_order} />`
- Line 236 (Table): `<StatusChip status={r.status} order={r.bat_order} />`
- Line 627 (ColBatterRow): `{hrRow.status && <StatusChip status={hrRow.status} order={hrRow.bat_order} />}`

(Leave 334, 471 `mode="pair"` and 841 pitcher untouched.)

- [ ] **Step 3: Typecheck + lint**

Run: `cd web && npx tsc --noEmit && npx eslint app components`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add web/app/page.tsx web/components/PropBoard.tsx
git commit -m "feat(web): show batting order in batter chips (cards/table/game hub)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Game Hub — "Batters" sort button + legend

**Files:**
- Modify: `web/components/PropBoard.tsx` (`SortCol` 490, `ColTeam.metric`/`onSort` 657-668, `ColHeaders` 494)

- [ ] **Step 1: Add `"order"` to SortCol**

Line 490:

```ts
type SortCol = "order" | "lean" | "hr" | "hits" | "tb" | "runs" | "rbi" | "hrr";
```

- [ ] **Step 2: Default the order column to ascending + add its metric**

In `ColTeam` (line 658), make a first click on `order` sort ascending (1→9); others keep descending:

```ts
  const onSort = (col: SortCol) => setSort((s) => (s.col === col ? { col, dir: s.dir === -1 ? 1 : -1 } : { col, dir: col === "order" ? 1 : -1 }));
```

In `metric` (after line 659's `if (sort.col === "lean") ...`), add:

```ts
    if (sort.col === "order") return r.bat_order ?? 999; // unknown slots sort last
```

- [ ] **Step 3: Add the "Batters" header button (left-aligned) replacing the empty name-column header**

In `ColHeaders`, replace the leading `<div />` (first grid child in the returned grid) with a left-aligned sort button:

```tsx
      <button
        type="button"
        onClick={() => onSort("order")}
        title="sort by batting order"
        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "left", font: "inherit" }}
      >
        <div style={{ fontSize: "0.55rem", letterSpacing: "0.07em", fontWeight: 700, color: sort.col === "order" ? "var(--text)" : "var(--muted)" }}>
          BATTERS<span style={{ color: "var(--green)" }}>{sort.col === "order" ? (sort.dir < 0 ? " ▾" : " ▴") : ""}</span>
        </div>
      </button>
```

- [ ] **Step 4: Add the `# = batting order` legend under the Game Hub headers**

Inside `ColTeam`'s returned JSX, right after `<ColHeaders ... />` (line 688), add a one-line legend (shown once per team table, subtle):

```tsx
      <div className="factor-note" style={{ margin: "0.15rem 0 0", padding: "0 0.25rem", fontSize: "0.62rem", color: "var(--muted)" }}>
        #= batting order
      </div>
```

- [ ] **Step 5: Typecheck + lint + vitest**

Run: `cd web && npx tsc --noEmit && npx eslint components && npx vitest run`
Expected: exit 0, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add web/components/PropBoard.tsx
git commit -m "feat(web): Game Hub Batters sort button (by batting order) + legend

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Verification — board + localhost preview

- [ ] **Step 1: Full Python suite green** — `uv run pytest -q`
- [ ] **Step 2: Regenerate a local board** so `bat_order` is in the JSON:
  Run: `uv run python -m model.export_web 2026-06-26 1 --include-started`
  Confirm: `grep -c bat_order web/public/data/latest.json` > 0.
- [ ] **Step 3: Dev server + eyeball** — `cd web && npm run dev`. Check: card view, table view, Top Plays, and Game Hub batter chips all read `CONF·#N` / `PROJ·#N`; game/team/pitcher chips stay plain; the Game Hub "BATTERS" header sorts 1→9; legend shows `#= batting order`.
- [ ] **Step 4: Report for preview-before-prod** — share localhost; wait for explicit approval before merge/deploy (then merge + `gh workflow run board-refresh.yml -f force_deploy=true`).

---

## Self-Review

**Spec coverage:** chip `·#N` site-wide on individual batters (Tasks 3-4, covering cards/table/top-plays/game-hub via the 3 render paths) ✓ · `bat_order` from lineup slot (Task 1) ✓ · Game Hub Batters sort button + legend (Task 5) ✓ · aggregated/pitcher chips untouched (Task 4 leaves 334/471/841) ✓ · display-only/no math (Task 1 Step 5 keeps prob tests green) ✓.

**Placeholder scan:** none — concrete code/commands throughout. The run-prop test reuses that file's existing fixture helper (flagged) rather than inventing one.

**Type consistency:** `bat_order` (Python `int` → TS `bat_order?: number`) and `order?: number` on StatusChip match across Tasks 1-5; `SortCol` extended once (Task 5 Step 1) and used in `metric`/`onSort`/`ColHeaders`.
