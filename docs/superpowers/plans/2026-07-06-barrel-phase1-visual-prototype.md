# Barrel Edge — Phase 1: Visual Prototype — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a navigable, MOCK-DATA visual prototype of the Barrel Edge UI — new `Boards` pill, `Normal / Barrel Weight` philosophy selector + `Barrel Effect` toggle, mode-aware heatmap boards (lineup + pitcher), and the props section renamed to "Props" — so the user can preview and steer the look on localhost before any real data/math is wired.

**Architecture:** Pure frontend on the existing Mock-7 "Spatial Depth" Next.js shell (`web/app/page.tsx`). New client components mirror the existing `BoardView`/`NavDock`/`SegmentedControl` patterns and reuse `sp-*` CSS + `chips.tsx`. All board content is driven by a **mock fixture** (`web/lib/barrelMock.ts`) and a mode→columns config (`web/lib/barrelColumns.ts`); a pure `boardsLens()` helper maps the philosophy selector + effect toggle to one of three lenses (`normal | effect | barrel`) that pick the visible columns.

**Tech Stack:** Next.js (custom build — see constraint), React client components, TypeScript, vitest, existing `spatial.css` design tokens.

## Global Constraints

- **Custom Next.js:** `web/AGENTS.md` warns this Next.js differs from training data — consult `node_modules/next/dist/docs/` before writing any Next-specific code. This plan only adds client components that mirror existing files, so follow the established patterns in `web/app/page.tsx` and `web/components/spatial/*`.
- **MOCK DATA ONLY:** Phase 1 changes NO backend, model, math, or real-data wiring. No files under `model/` are touched. Board numbers come from `web/lib/barrelMock.ts`.
- **Skin fidelity:** Reuse existing `sp-*` classes and CSS vars (`--green`, `--red`, `--amber`, `--iris-cyan`); mirror `SegmentedControl`, `NavDock`, `GlassCard`, `chips.tsx`.
- **Don't break existing state/URL:** keep the existing section id `"board"` stable (rename only its *label* to "Props"); the new heatmap section id is `"boards"`. New URL params (`phil`, `effect`) default-off (omitted from URL when default).
- **Testing style (match the repo):** pure logic in `web/lib/*` is unit-tested with vitest (`npm test`); components/visual changes are verified with `npx tsc --noEmit` + `npm run lint` + a localhost preview. The repo currently unit-tests only pure `lib/` modules (no component-render tests), so do NOT add render tests that need new deps.
- **Run all commands from `web/`.**
- No sign-off required (display only), but the user previews on localhost before this branch merges.

---

### Task 1: Rename nav "Board" → "Props" and add the "Boards" pill

**Files:**
- Modify: `web/components/spatial/NavDock.tsx`

**Interfaces:**
- Produces: `NavSection` type extended to `"board" | "hub" | "top" | "parks" | "boards"`. `page.tsx` (Task 2) relies on the new `"boards"` member and the new `IconBoards`.

- [ ] **Step 1: Extend the `NavSection` type**

In `web/components/spatial/NavDock.tsx`, change line 13:

```tsx
export type NavSection = "board" | "hub" | "top" | "parks" | "boards";
```

- [ ] **Step 2: Add a `Boards` icon component**

Add this next to the other icon functions (after `IconParks`, ~line 56):

```tsx
function IconBoards() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M3 14h18M9 4v16M15 4v16" />
    </svg>
  );
}
```

- [ ] **Step 3: Rename the "Board" label to "Props" and append the Boards pill**

Replace the `NAV_ITEMS` array (lines 58-63):

```tsx
const NAV_ITEMS: { id: NavSection; label: string; Icon: () => ReactElement }[] = [
  { id: "board",  label: "Props",     Icon: IconBoard  },
  { id: "hub",    label: "Game Hub",  Icon: IconHub    },
  { id: "top",    label: "Top Plays", Icon: IconTop    },
  { id: "parks",  label: "Parks",     Icon: IconParks  },
  { id: "boards", label: "Boards",    Icon: IconBoards },
];
```

- [ ] **Step 4: Verify types + lint pass**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (`page.tsx` still compiles — it does not yet reference `"boards"`, which is additive.)

- [ ] **Step 5: Commit**

```bash
git add web/components/spatial/NavDock.tsx
git commit -m "feat(barrel): rename Board→Props nav label, add Boards pill"
```

---

### Task 2: Wire the `boards` section into the page shell (with a placeholder view)

**Files:**
- Create: `web/components/spatial/boards/BoardsView.tsx`
- Modify: `web/app/page.tsx`

**Interfaces:**
- Produces: `BoardsView` component (default + named export) taking `{ lens }` — but in this task `lens` is not yet passed; render a placeholder. Task 3 adds the `lens` prop wiring; Tasks 5-6 fill in real board content.

- [ ] **Step 1: Create the placeholder `BoardsView`**

Create `web/components/spatial/boards/BoardsView.tsx`:

```tsx
/**
 * BoardsView.tsx — the "Boards" section: competitor-style heatmap boards.
 * Phase 1 = MOCK DATA prototype. Content is filled in by later tasks.
 */
"use client";

import "../spatial.css";

export function BoardsView() {
  return (
    <div className="sp-wrap" style={{ padding: "24px 0" }}>
      <h2 className="sp-iristext" style={{ fontSize: 22, marginBottom: 8 }}>
        Boards
      </h2>
      <p style={{ opacity: 0.7 }}>Barrel boards prototype — coming together.</p>
    </div>
  );
}

export default BoardsView;
```

- [ ] **Step 2: Import `BoardsView` in `page.tsx`**

Add after the `Parks` import (line 48):

```tsx
import { BoardsView } from "../components/spatial/boards/BoardsView";
```

- [ ] **Step 3: Accept `"boards"` in the section URL param**

In the mount effect, extend the `sectionParam` guard (lines 253-260):

```tsx
    if (
      sectionParam === "board" ||
      sectionParam === "hub" ||
      sectionParam === "top" ||
      sectionParam === "parks" ||
      sectionParam === "boards"
    ) {
      setSection(sectionParam);
    }
```

- [ ] **Step 4: Render the boards surface**

Add after the `parks` surface line (line 614), inside the `<main>` surface block:

```tsx
          {section === "boards" && <BoardsView />}
```

- [ ] **Step 5: Verify + preview**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.
Then `npm run dev`, open the localhost URL, click the **Boards** pill → placeholder renders; the old props pill now reads **Props**.

- [ ] **Step 6: Commit**

```bash
git add web/app/page.tsx web/components/spatial/boards/BoardsView.tsx
git commit -m "feat(barrel): wire Boards section into the page shell (placeholder)"
```

---

### Task 3: Philosophy selector + Barrel Effect toggle + lens helper

**Files:**
- Create: `web/lib/barrelLens.ts`
- Create: `web/lib/tests/barrelLens.test.ts`
- Modify: `web/app/page.tsx`

**Interfaces:**
- Produces:
  - `type Philosophy = "normal" | "barrel"`
  - `type BoardsLens = "normal" | "effect" | "barrel"`
  - `boardsLens(philosophy: Philosophy, barrelEffect: boolean): BoardsLens`
  - `BoardsView` now consumes `{ lens: BoardsLens }` (updated here).

- [ ] **Step 1: Write the failing test for the lens helper**

Create `web/lib/tests/barrelLens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { boardsLens } from "../barrelLens";

describe("boardsLens", () => {
  it("normal philosophy with effect off → normal", () => {
    expect(boardsLens("normal", false)).toBe("normal");
  });
  it("normal philosophy with effect on → effect", () => {
    expect(boardsLens("normal", true)).toBe("effect");
  });
  it("barrel philosophy → barrel regardless of effect", () => {
    expect(boardsLens("barrel", false)).toBe("barrel");
    expect(boardsLens("barrel", true)).toBe("barrel");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/tests/barrelLens.test.ts`
Expected: FAIL — cannot find module `../barrelLens`.

- [ ] **Step 3: Implement the lens helper**

Create `web/lib/barrelLens.ts`:

```ts
/** The weighting philosophy the user selects for the boards + math. */
export type Philosophy = "normal" | "barrel";

/** Which column set / tilt the Boards heatmap shows. */
export type BoardsLens = "normal" | "effect" | "barrel";

/**
 * Map the philosophy selector + Barrel Effect toggle to a single lens.
 * - Barrel Weight always wins → "barrel" (effect toggle is irrelevant there).
 * - Normal + effect on → "effect" (barrel columns light up on the current board).
 * - Normal + effect off → "normal" (your current drivers only).
 */
export function boardsLens(philosophy: Philosophy, barrelEffect: boolean): BoardsLens {
  if (philosophy === "barrel") return "barrel";
  return barrelEffect ? "effect" : "normal";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/tests/barrelLens.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `lens` prop to `BoardsView`**

Edit `web/components/spatial/boards/BoardsView.tsx` — import the type and accept the prop (the placeholder body can show the active lens for now):

```tsx
"use client";

import "../spatial.css";
import type { BoardsLens } from "../../../lib/barrelLens";

export interface BoardsViewProps {
  lens: BoardsLens;
}

export function BoardsView({ lens }: BoardsViewProps) {
  return (
    <div className="sp-wrap" style={{ padding: "24px 0" }}>
      <h2 className="sp-iristext" style={{ fontSize: 22, marginBottom: 8 }}>
        Boards
      </h2>
      <p style={{ opacity: 0.7 }}>Lens: {lens}</p>
    </div>
  );
}

export default BoardsView;
```

- [ ] **Step 6: Add philosophy + effect state and imports in `page.tsx`**

Add to the imports (after the weighting import, line 37):

```tsx
import { boardsLens, type Philosophy } from "../lib/barrelLens";
```

Add state after the `source` state (line 204):

```tsx
  const [philosophy, setPhilosophy] = useState<Philosophy>("normal");
  const [barrelEffect, setBarrelEffect] = useState<boolean>(false);
```

- [ ] **Step 7: Read/write the new URL params**

In the mount effect, after the `source` param read (line 250), add:

```tsx
    const phil = params.get("phil");
    if (phil === "barrel") setPhilosophy("barrel");
    if (params.get("effect") === "on") setBarrelEffect(true);
```

In the URL-write effect, after the `source` write (line 304), add:

```tsx
    if (philosophy === "barrel") params.set("phil", "barrel");
    else params.delete("phil");
    if (barrelEffect && philosophy === "normal") params.set("effect", "on");
    else params.delete("effect");
```

And add `philosophy` and `barrelEffect` to that effect's dependency array (line 308):

```tsx
  }, [selectedDate, prop, threshold, source, section, view, selection, philosophy, barrelEffect]);
```

- [ ] **Step 8: Render the Philosophy selector + Barrel Effect toggle**

In the weighting row, replace the block (lines 495-504) with:

```tsx
        {/* ── Weighting + Barrel controls row ── */}
        <div className="sp-weighting-row" style={{ flexWrap: "wrap", gap: 14 }}>
          <span className="sp-eyebrow">WEIGHTING</span>
          <SegmentedControl
            options={SOURCE_OPTIONS}
            value={source}
            onChange={(v) => setSource(v as Source)}
            variant="ghost"
          />
          <span className="sp-eyebrow">PHILOSOPHY</span>
          <SegmentedControl
            options={[
              { value: "normal", label: "Normal" },
              { value: "barrel", label: "Barrel Weight" },
            ]}
            value={philosophy}
            onChange={(v) => setPhilosophy(v as Philosophy)}
            variant="ghost"
          />
          {philosophy === "normal" && (
            <>
              <span className="sp-eyebrow">BARREL EFFECT</span>
              <SegmentedControl
                options={[
                  { value: "off", label: "Off" },
                  { value: "on", label: "On" },
                ]}
                value={barrelEffect ? "on" : "off"}
                onChange={(v) => setBarrelEffect(v === "on")}
                variant="ghost"
              />
            </>
          )}
        </div>
```

- [ ] **Step 9: Pass the derived lens to `BoardsView`**

Replace the boards render line from Task 2 (`{section === "boards" && <BoardsView />}`):

```tsx
          {section === "boards" && (
            <BoardsView lens={boardsLens(philosophy, barrelEffect)} />
          )}
```

- [ ] **Step 10: Verify + preview**

Run: `npx vitest run lib/tests/barrelLens.test.ts && npx tsc --noEmit && npm run lint`
Expected: tests pass, no type/lint errors.
Preview: the Philosophy selector + Barrel Effect toggle appear; switching to **Barrel Weight** hides the effect toggle; the Boards placeholder shows the active lens.

- [ ] **Step 11: Commit**

```bash
git add web/lib/barrelLens.ts web/lib/tests/barrelLens.test.ts web/app/page.tsx web/components/spatial/boards/BoardsView.tsx
git commit -m "feat(barrel): Philosophy selector + Barrel Effect toggle + lens helper"
```

---

### Task 4: Mock fixtures + column config + heat-color helper

**Files:**
- Create: `web/lib/barrelMock.ts`
- Create: `web/lib/barrelColumns.ts`
- Create: `web/lib/tests/barrelColumns.test.ts`

**Interfaces:**
- Produces:
  - `barrelMock.ts`: `MockHitter`, `MockPitcher`, `MockGame`, `MOCK_GAMES: MockGame[]`, `MOCK_PITCHER_BOARD: MockPitcher[]`.
  - `barrelColumns.ts`: `interface ColumnDef { key; label; min; max; higherBetter?; highlight? }`, `boardsColumnsFor(lens: BoardsLens): ColumnDef[]`, `PITCHER_COLUMNS: ColumnDef[]`, `heatColor(value, min, max, higherBetter?): string`.
- Tasks 5-6 consume all of the above.

- [ ] **Step 1: Create the mock fixture**

Create `web/lib/barrelMock.ts`:

```ts
/** MOCK data for the Barrel boards prototype (Phase 1). Not real projections. */

export interface MockHitter {
  id: number;
  name: string;
  hand: "R" | "L" | "SW";
  team: string;
  order: number;
  /** every column key → a plausible value */
  stats: Record<string, number>;
}

export interface MockPitcher {
  name: string;
  team: string;
  throws: "R" | "L";
  opp: string;
  stats: Record<string, number>;
}

export interface MockGame {
  id: string;
  away: string;
  home: string;
  venue: string;
  note: string;
  awayPitcher: string;
  homePitcher: string;
  awayHitters: MockHitter[];
  homeHitters: MockHitter[];
}

// Default stat block so each hitter only overrides what makes them interesting.
const BASE: Record<string, number> = {
  trueScore: 50, matchup: 55, park: 0, weather: 0, platoon: 0, pitcher: 0,
  form: 0, hardhit: 38, brl: 9, pbrl: 5, sweet: 34, zonefit: 0.08,
  hrform: 55, iso: 0.17, xwoba: 0.33, xwobacon: 0.36, swstr: 10,
  fb: 30, hh: 40, la: 15,
};

let _id = 100;
function h(
  name: string, hand: "R" | "L" | "SW", team: string, order: number,
  o: Record<string, number>,
): MockHitter {
  return { id: _id++, name, hand, team, order, stats: { ...BASE, ...o } };
}

export const MOCK_GAMES: MockGame[] = [
  {
    id: "CWS-BAL",
    away: "CWS", home: "BAL", venue: "Camden Yards",
    note: "Sneaky Value Spot",
    awayPitcher: "Sean Burke", homePitcher: "Shane Baz",
    awayHitters: [
      h("Colson Montgomery", "L", "CWS", 1, { trueScore: 75, matchup: 67, hrform: 62, pbrl: 9, brl: 14, iso: 0.26, xwoba: 0.33, xwobacon: 0.45, hh: 45, la: 19, zonefit: 0.105 }),
      h("Andrew Benintendi", "L", "CWS", 2, { trueScore: 60, matchup: 57, hrform: 66, pbrl: 10, brl: 10, iso: 0.20, hh: 42, la: 18 }),
      h("Miguel Vargas", "R", "CWS", 3, { trueScore: 67, matchup: 54, hrform: 80, pbrl: 9, brl: 12, iso: 0.24, hh: 42, la: 21 }),
      h("Luis Robert", "R", "CWS", 4, { trueScore: 44, matchup: 45, hrform: 40, pbrl: 5, brl: 5, iso: 0.16, swstr: 15, hh: 30, la: 12 }),
    ],
    homeHitters: [
      h("Gunnar Henderson", "L", "BAL", 1, { trueScore: 72, matchup: 64, hrform: 70, pbrl: 8, brl: 13, iso: 0.24, hh: 47, la: 17, zonefit: 0.12 }),
      h("Adley Rutschman", "SW", "BAL", 2, { trueScore: 58, matchup: 59, hrform: 55, pbrl: 6, brl: 9, iso: 0.18, swstr: 7, zonefit: 0.10 }),
      h("Ryan Mountcastle", "R", "BAL", 3, { trueScore: 61, matchup: 56, hrform: 58, pbrl: 7, brl: 11, iso: 0.21, hh: 44 }),
      h("Cedric Mullins", "L", "BAL", 4, { trueScore: 47, matchup: 48, hrform: 45, pbrl: 4, brl: 6, iso: 0.15, la: 13 }),
    ],
  },
  {
    id: "NYM-ATL",
    away: "NYM", home: "ATL", venue: "Truist Park",
    note: "Power Park",
    awayPitcher: "Grant Holmes", homePitcher: "Christian Scott",
    awayHitters: [
      h("Pete Alonso", "R", "NYM", 1, { trueScore: 77, matchup: 76, hrform: 62, pbrl: 6, brl: 15, iso: 0.22, hh: 46, la: 18, zonefit: 0.115 }),
      h("Francisco Lindor", "SW", "NYM", 2, { trueScore: 64, matchup: 60, hrform: 58, pbrl: 7, brl: 10, iso: 0.21, swstr: 8 }),
      h("Brandon Nimmo", "L", "NYM", 3, { trueScore: 55, matchup: 54, hrform: 52, pbrl: 5, brl: 8, iso: 0.18 }),
    ],
    homeHitters: [
      h("Matt Olson", "L", "ATL", 1, { trueScore: 70, matchup: 63, hrform: 60, pbrl: 9, brl: 13, iso: 0.25, hh: 48, la: 19 }),
      h("Ronald Acuña Jr.", "R", "ATL", 2, { trueScore: 73, matchup: 66, hrform: 68, pbrl: 8, brl: 12, iso: 0.23, hh: 45, zonefit: 0.13 }),
      h("Austin Riley", "R", "ATL", 3, { trueScore: 66, matchup: 58, hrform: 61, pbrl: 7, brl: 12, iso: 0.24, hh: 46 }),
    ],
  },
];

export const MOCK_PITCHER_BOARD: MockPitcher[] = [
  { name: "Shane Baz",       team: "BAL", throws: "R", opp: "CWS", stats: { pscore: 51, kscore: 47, xwoba: 0.30, csw: 29, swstr: 13, ball: 35, pbrl: 3.8, brlbip: 6.2, fb: 25, hh: 42 } },
  { name: "Sean Burke",      team: "CWS", throws: "R", opp: "BAL", stats: { pscore: 45, kscore: 43, xwoba: 0.33, csw: 27, swstr: 10, ball: 37, pbrl: 5.2, brlbip: 9.1, fb: 30, hh: 46 } },
  { name: "Christian Scott", team: "NYM", throws: "R", opp: "ATL", stats: { pscore: 48, kscore: 45, xwoba: 0.31, csw: 28, swstr: 12, ball: 34, pbrl: 4.1, brlbip: 7.0, fb: 27, hh: 43 } },
  { name: "Grant Holmes",    team: "ATL", throws: "R", opp: "NYM", stats: { pscore: 44, kscore: 41, xwoba: 0.34, csw: 25, swstr: 9,  ball: 38, pbrl: 5.6, brlbip: 9.8, fb: 31, hh: 47 } },
];
```

- [ ] **Step 2: Write the failing test for the column config + heat color**

Create `web/lib/tests/barrelColumns.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { boardsColumnsFor, heatColor } from "../barrelColumns";

describe("boardsColumnsFor", () => {
  it("normal lens shows current-driver columns, no barrel highlights", () => {
    const cols = boardsColumnsFor("normal");
    expect(cols.some((c) => c.key === "matchup")).toBe(true);
    expect(cols.some((c) => c.key === "park")).toBe(true);
    expect(cols.every((c) => !c.highlight)).toBe(true);
    expect(cols.some((c) => c.key === "brl")).toBe(false);
  });
  it("effect lens keeps drivers AND adds highlighted barrel columns", () => {
    const cols = boardsColumnsFor("effect");
    expect(cols.some((c) => c.key === "park")).toBe(true);
    const brl = cols.find((c) => c.key === "brl");
    expect(brl?.highlight).toBe(true);
  });
  it("barrel lens is the full replica column set (kHR + no park/weather)", () => {
    const cols = boardsColumnsFor("barrel");
    expect(cols.some((c) => c.key === "trueScore")).toBe(true);
    expect(cols.some((c) => c.key === "zonefit")).toBe(true);
    expect(cols.some((c) => c.key === "park")).toBe(false);
  });
});

describe("heatColor", () => {
  it("returns an hsl string", () => {
    expect(heatColor(50, 0, 100)).toMatch(/^hsl\(/);
  });
  it("higherBetter=false flips the scale (low value → green-ish, high hue)", () => {
    const lowValGreen = heatColor(0, 0, 100, false);
    const highValRed = heatColor(100, 0, 100, false);
    // green hue (~140) is a larger number than red hue (~4)
    const hue = (s: string) => Number(s.match(/hsl\((\d+)/)![1]);
    expect(hue(lowValGreen)).toBeGreaterThan(hue(highValRed));
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run lib/tests/barrelColumns.test.ts`
Expected: FAIL — cannot find module `../barrelColumns`.

- [ ] **Step 4: Implement the column config + heat color**

Create `web/lib/barrelColumns.ts`:

```ts
import type { BoardsLens } from "./barrelLens";

export interface ColumnDef {
  key: string;
  label: string;
  min: number;
  max: number;
  /** default true; false = lower is better (e.g. SwStr% for a hitter) */
  higherBetter?: boolean;
  /** effect lens: barrel columns that "light up" on the current board */
  highlight?: boolean;
}

/** Your current model's drivers (the "Normal" board). */
const DRIVER_COLUMNS: ColumnDef[] = [
  { key: "trueScore", label: "Score",   min: 20, max: 90 },
  { key: "matchup",   label: "Matchup", min: 30, max: 90 },
  { key: "park",      label: "Park",    min: -15, max: 15 },
  { key: "weather",   label: "Wx",      min: -15, max: 15 },
  { key: "platoon",   label: "Platoon", min: -6, max: 6 },
  { key: "pitcher",   label: "Pitcher", min: -20, max: 20 },
  { key: "form",      label: "Form",    min: -20, max: 20 },
  { key: "hardhit",   label: "HH%",     min: 25, max: 55 },
];

/** Barrel columns that light up when Barrel Effect is ON. */
const BARREL_HIGHLIGHTS: ColumnDef[] = [
  { key: "brl",     label: "Brl/BIP", min: 3, max: 20, highlight: true },
  { key: "pbrl",    label: "PullBrl", min: 1, max: 12, highlight: true },
  { key: "sweet",   label: "Sweet%",  min: 25, max: 45, highlight: true },
  { key: "zonefit", label: "ZoneFit", min: 0.02, max: 0.16, highlight: true },
];

/** The Kasper/Barrel-Lab replica column set (no park/weather). */
const REPLICA_COLUMNS: ColumnDef[] = [
  { key: "trueScore", label: "kHR",     min: 20, max: 90 },
  { key: "matchup",   label: "Matchup", min: 30, max: 90 },
  { key: "zonefit",   label: "ZoneFit", min: 0.02, max: 0.16 },
  { key: "hrform",    label: "HR Form", min: 20, max: 90 },
  { key: "iso",       label: "ISO",     min: 0.08, max: 0.30 },
  { key: "xwoba",     label: "xwOBA",   min: 0.26, max: 0.42 },
  { key: "xwobacon",  label: "xwOBAc",  min: 0.26, max: 0.46 },
  { key: "swstr",     label: "SwStr",   min: 5, max: 18, higherBetter: false },
  { key: "pbrl",      label: "PullBrl", min: 1, max: 12 },
  { key: "brl",       label: "Brl/BIP", min: 3, max: 20 },
  { key: "sweet",     label: "Sweet%",  min: 25, max: 45 },
  { key: "fb",        label: "FB%",     min: 18, max: 45 },
  { key: "hh",        label: "HH%",     min: 25, max: 55 },
  { key: "la",        label: "LA",      min: 8, max: 24 },
];

export function boardsColumnsFor(lens: BoardsLens): ColumnDef[] {
  if (lens === "barrel") return REPLICA_COLUMNS;
  if (lens === "effect") return [...DRIVER_COLUMNS, ...BARREL_HIGHLIGHTS];
  return DRIVER_COLUMNS;
}

/** Pitcher board columns (barrel-allowed + whiff), Kasper "Top Slate Pitchers". */
export const PITCHER_COLUMNS: ColumnDef[] = [
  { key: "pscore", label: "P Score", min: 30, max: 60 },
  { key: "kscore", label: "K Score", min: 30, max: 60 },
  { key: "xwoba",  label: "xwOBA",   min: 0.26, max: 0.40, higherBetter: false },
  { key: "csw",    label: "CSW%",    min: 22, max: 34 },
  { key: "swstr",  label: "SwStr%",  min: 6, max: 18 },
  { key: "ball",   label: "Ball%",   min: 30, max: 42, higherBetter: false },
  { key: "pbrl",   label: "PBrl%",   min: 3, max: 8, higherBetter: false },
  { key: "brlbip", label: "Brl BIP", min: 4, max: 12, higherBetter: false },
  { key: "fb",     label: "FB%",     min: 18, max: 45, higherBetter: false },
  { key: "hh",     label: "HH%",     min: 35, max: 52, higherBetter: false },
];

/**
 * Heatmap cell background. t=0 → red (hue 4), t=1 → green (hue 140), amber mid.
 * higherBetter=false flips so low values read green.
 */
export function heatColor(value: number, min: number, max: number, higherBetter = true): string {
  const clamped = Math.max(min, Math.min(max, value));
  let t = max === min ? 0.5 : (clamped - min) / (max - min);
  if (!higherBetter) t = 1 - t;
  const hue = Math.round(4 + t * (140 - 4));
  return `hsl(${hue} 60% 42% / 0.55)`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/tests/barrelColumns.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Verify types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web/lib/barrelMock.ts web/lib/barrelColumns.ts web/lib/tests/barrelColumns.test.ts
git commit -m "feat(barrel): mock fixtures, per-lens column config, heat-color helper"
```

---

### Task 5: BoardsView — per-game hitters-vs-pitcher heatmap tables

**Files:**
- Modify: `web/components/spatial/boards/BoardsView.tsx`

**Interfaces:**
- Consumes: `boardsLens` output `lens` (prop), `MOCK_GAMES`, `boardsColumnsFor`, `heatColor`, `ColumnDef`, `HandChip`.
- Produces: a `BoardsView` that renders, per game, two heatmap tables ("AWAY hitters vs homePitcher", "HOME hitters vs awayPitcher"), columns driven by `lens`.

- [ ] **Step 1: Implement the heatmap tables**

Replace the entire body of `web/components/spatial/boards/BoardsView.tsx`:

```tsx
/**
 * BoardsView.tsx — the "Boards" section: competitor-style heatmap boards.
 * Phase 1 = MOCK DATA prototype (web/lib/barrelMock.ts).
 * Columns follow the active lens (normal | effect | barrel).
 */
"use client";

import "../spatial.css";
import type { BoardsLens } from "../../../lib/barrelLens";
import { boardsColumnsFor, heatColor, type ColumnDef } from "../../../lib/barrelColumns";
import { MOCK_GAMES, type MockHitter } from "../../../lib/barrelMock";
import { HandChip } from "../chips";

export interface BoardsViewProps {
  lens: BoardsLens;
}

/** Format a stat for display (small decimals stay decimal, else integer). */
function fmt(v: number): string {
  if (Math.abs(v) < 1 && v !== 0) return v.toFixed(3).replace(/^0/, "");
  return String(Math.round(v * 10) / 10);
}

function HeatTable({
  title, hitters, columns,
}: {
  title: string;
  hitters: MockHitter[];
  columns: ColumnDef[];
}) {
  const rows = [...hitters].sort(
    (a, b) => (b.stats.trueScore ?? 0) - (a.stats.trueScore ?? 0),
  );
  return (
    <div style={{ marginBottom: 22 }}>
      <h4 style={{ fontSize: 15, margin: "0 0 8px", fontWeight: 700 }}>{title}</h4>
      <div style={{ overflowX: "auto" }} className="sp-float" >
        <table className="sp-boardstable" style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 10px", position: "sticky", left: 0 }}>Player</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ padding: "6px 8px", textAlign: "center", opacity: c.highlight ? 1 : 0.85, color: c.highlight ? "var(--iris-cyan)" : undefined }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: "5px 10px", whiteSpace: "nowrap", position: "sticky", left: 0 }}>
                  <span style={{ opacity: 0.5, marginRight: 6 }}>#{r.order}</span>
                  {r.name} <HandChip hand={r.hand} />
                </td>
                {columns.map((c) => {
                  const v = r.stats[c.key] ?? 0;
                  return (
                    <td
                      key={c.key}
                      style={{
                        padding: "5px 8px",
                        textAlign: "center",
                        background: heatColor(v, c.min, c.max, c.higherBetter ?? true),
                        outline: c.highlight ? "1px solid var(--iris-cyan)" : undefined,
                      }}
                    >
                      {fmt(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BoardsView({ lens }: BoardsViewProps) {
  const columns = boardsColumnsFor(lens);
  const lensLabel =
    lens === "barrel" ? "Barrel Weight — replica" :
    lens === "effect" ? "Barrel Effect ON — barrel columns lit" :
    "Current drivers";

  return (
    <div className="sp-wrap" style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <h2 className="sp-iristext" style={{ fontSize: 22, margin: 0 }}>Boards</h2>
        <span className="sp-eyebrow">{lensLabel}</span>
      </div>

      {MOCK_GAMES.map((g) => (
        <section key={g.id} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 17, margin: "0 0 4px" }}>
            {g.away} @ {g.home}
          </h3>
          <p style={{ opacity: 0.6, margin: "0 0 12px", fontSize: 13 }}>
            {g.venue} · {g.note}
          </p>
          <HeatTable title={`${g.away} hitters vs ${g.homePitcher}`} hitters={g.awayHitters} columns={columns} />
          <HeatTable title={`${g.home} hitters vs ${g.awayPitcher}`} hitters={g.homeHitters} columns={columns} />
        </section>
      ))}
    </div>
  );
}

export default BoardsView;
```

- [ ] **Step 2: Verify + preview**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.
Preview: **Boards** now shows per-game heatmap tables. Toggle **Barrel Effect On** → 4 barrel columns appear (cyan-outlined). Switch to **Barrel Weight** → columns become the full replica set.

- [ ] **Step 3: Commit**

```bash
git add web/components/spatial/boards/BoardsView.tsx
git commit -m "feat(barrel): per-game hitters-vs-pitcher heatmap tables (mock)"
```

---

### Task 6: BoardsView — top-reads cards + pitcher board

**Files:**
- Modify: `web/components/spatial/boards/BoardsView.tsx`

**Interfaces:**
- Consumes: `MOCK_GAMES` (for top reads), `MOCK_PITCHER_BOARD`, `PITCHER_COLUMNS`, `GlassCard`.
- Produces: a "Top Reads" card strip above the tables and a "Slate Pitchers" heatmap below them.

- [ ] **Step 1: Extend the imports**

At the top of `BoardsView.tsx`, update the mock + columns imports and add `GlassCard`:

```tsx
import { boardsColumnsFor, heatColor, PITCHER_COLUMNS, type ColumnDef } from "../../../lib/barrelColumns";
import { MOCK_GAMES, MOCK_PITCHER_BOARD, type MockHitter } from "../../../lib/barrelMock";
import { GlassCard } from "../GlassCard";
```

- [ ] **Step 2: Add the Top-Reads card strip component**

Add this function above `export function BoardsView`:

```tsx
function TopReads() {
  // Flatten all hitters, take the 4 highest trueScore across the slate.
  const all = MOCK_GAMES.flatMap((g) => [
    ...g.awayHitters.map((h) => ({ h, opp: g.homePitcher, vs: `${g.away} vs ${g.home}` })),
    ...g.homeHitters.map((h) => ({ h, opp: g.awayPitcher, vs: `${g.home} vs ${g.away}` })),
  ]);
  const top = all.sort((a, b) => b.h.stats.trueScore - a.h.stats.trueScore).slice(0, 4);
  const CELLS: [string, string][] = [
    ["Matchup", "matchup"], ["ZoneFit", "zonefit"], ["HR Form", "hrform"],
    ["PullBrl", "pbrl"], ["Brl/BIP", "brl"], ["ISO", "iso"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 22 }}>
      {top.map(({ h, vs }) => (
        <GlassCard key={h.id} style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b style={{ fontSize: 14 }}>{h.name}</b>
            <span className="sp-iristext" style={{ fontSize: 22, fontWeight: 800 }}>
              {Math.round(h.stats.trueScore)}
            </span>
          </div>
          <div style={{ opacity: 0.55, fontSize: 11, marginBottom: 8 }}>{vs}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {CELLS.map(([label, key]) => (
              <div key={key} style={{ textAlign: "center", background: "rgba(255,255,255,.05)", borderRadius: 6, padding: "4px 2px" }}>
                <div style={{ fontSize: 9, opacity: 0.6 }}>{label}</div>
                <b style={{ fontSize: 12 }}>
                  {h.stats[key] < 1 && h.stats[key] !== 0 ? h.stats[key].toFixed(3).replace(/^0/, "") : Math.round(h.stats[key])}
                </b>
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add the Pitcher-board component**

Add this function below `HeatTable`:

```tsx
function PitcherBoard() {
  const rows = [...MOCK_PITCHER_BOARD].sort((a, b) => b.stats.pscore - a.stats.pscore);
  return (
    <div style={{ marginTop: 10 }}>
      <h3 style={{ fontSize: 17, margin: "0 0 10px" }}>Slate Pitchers</h3>
      <div style={{ overflowX: "auto" }} className="sp-float">
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 10px" }}>Pitcher</th>
              <th style={{ padding: "6px 8px" }}>Opp</th>
              {PITCHER_COLUMNS.map((c) => (
                <th key={c.key} style={{ padding: "6px 8px", textAlign: "center", opacity: 0.85 }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.name}>
                <td style={{ padding: "5px 10px", whiteSpace: "nowrap" }}>{p.name} <span style={{ opacity: 0.5 }}>({p.throws})</span></td>
                <td style={{ padding: "5px 8px", textAlign: "center", opacity: 0.7 }}>{p.opp}</td>
                {PITCHER_COLUMNS.map((c) => {
                  const v = p.stats[c.key] ?? 0;
                  return (
                    <td key={c.key} style={{ padding: "5px 8px", textAlign: "center", background: heatColor(v, c.min, c.max, c.higherBetter ?? true) }}>
                      {v < 1 && v !== 0 ? v.toFixed(2).replace(/^0/, "") : Math.round(v * 10) / 10}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount Top-Reads (top) and Pitcher-board (bottom) in `BoardsView`**

In `BoardsView`'s returned JSX, add `<TopReads />` right after the header `<div>…</div>` (before the `MOCK_GAMES.map`), and add `<PitcherBoard />` after the `MOCK_GAMES.map(...)` block, before the closing `</div>`:

```tsx
      {/* after the header row */}
      <TopReads />

      {MOCK_GAMES.map((g) => (
        /* …unchanged per-game sections… */
      ))}

      <PitcherBoard />
    </div>
```

- [ ] **Step 5: Verify + preview**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.
Preview: **Boards** now shows a Top-Reads card strip on top, the per-game heatmaps in the middle, and a Slate Pitchers heatmap at the bottom.

- [ ] **Step 6: Commit**

```bash
git add web/components/spatial/boards/BoardsView.tsx
git commit -m "feat(barrel): top-reads cards + slate pitcher board (mock)"
```

---

### Task 7: Aperture-logo watermark on nav pills + board polish

**Files:**
- Modify: `web/components/spatial/spatial.css`

**Interfaces:**
- Consumes: nothing new. Adds a faint Aperture-style watermark behind each `sp-dock-btn` and light borders to the board tables.

- [ ] **Step 1: Find the nav-button + board style anchors**

Run: `grep -n "sp-dock-btn" web/components/spatial/spatial.css | head` and `grep -n "sp-boardstable\|sp-float" web/components/spatial/spatial.css | head`
Expected: shows the existing `.sp-dock-btn` rule (and confirms `.sp-boardstable` is not yet styled).

- [ ] **Step 2: Add the pill watermark + board table polish**

Append to the end of `web/components/spatial/spatial.css`:

```css
/* ── Barrel Phase 1: faint Aperture watermark behind each nav pill ── */
.sp-root .sp-dock-btn {
  position: relative;
}
.sp-root .sp-dock-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at 50% 45%, transparent 30%, rgba(255,255,255,.05) 31%, transparent 33%),
    conic-gradient(from 0deg,
      rgba(255,255,255,.06) 0 60deg, transparent 60deg 120deg,
      rgba(255,255,255,.06) 120deg 180deg, transparent 180deg 240deg,
      rgba(255,255,255,.06) 240deg 300deg, transparent 300deg 360deg);
  -webkit-mask: radial-gradient(circle at 50% 45%, #000 34%, transparent 60%);
          mask: radial-gradient(circle at 50% 45%, #000 34%, transparent 60%);
  opacity: .5;
  pointer-events: none;
}

/* ── Barrel Phase 1: heatmap table polish ── */
.sp-root .sp-boardstable { border-radius: 12px; overflow: hidden; }
.sp-root .sp-boardstable th { font-weight: 600; letter-spacing: .02em; }
.sp-root .sp-boardstable td,
.sp-root .sp-boardstable th { border: 1px solid rgba(255,255,255,.04); }
```

- [ ] **Step 3: Verify + preview**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.
Preview: each nav pill shows a faint aperture-blade watermark; the board tables read cleanly with subtle gridlines.

- [ ] **Step 4: Commit**

```bash
git add web/components/spatial/spatial.css
git commit -m "feat(barrel): Aperture watermark on nav pills + board table polish"
```

---

## Self-Review

**Spec coverage (Phase-1 slice):**
- New `Boards` pill + rename Props → Tasks 1-2. ✅
- Philosophy selector + Barrel Effect toggle (Effect only on Normal) → Task 3. ✅
- Board content follows the active mode (normal drivers / +barrel columns / replica) → `boardsLens` + `boardsColumnsFor` (Tasks 3-4), rendered Task 5. ✅
- Hitters grouped vs the pitcher they face + top-reads + pitcher board (both lenses) → Tasks 5-6. ✅
- Full column set (not just 6), incl. sample/score columns → `REPLICA_COLUMNS` (Task 4). ✅
- Aperture-watermark pills → Task 7. ✅
- Mock-data only, no math/backend → enforced in Global Constraints; no `model/` files touched. ✅
- Deferred (correctly NOT in Phase 1): real Statcast sourcing, ZoneFit real compute, pitcher-engine math, Barrel Effect/Weight real probabilities, mobile heatmap treatment, name-color sample flags. These belong to Phases 2-5 / roadmap.

**Placeholder scan:** No "TBD/TODO/handle edge cases" — every step has complete code. ✅

**Type consistency:** `Philosophy`/`BoardsLens` defined in `barrelLens.ts` (Task 3) and consumed identically in `barrelColumns.ts` (Task 4) and `BoardsView.tsx` (Tasks 5-6). `ColumnDef` shape (`key/label/min/max/higherBetter?/highlight?`) is consistent across `barrelColumns.ts` and both table renderers. `MockHitter.stats` keys match the `ColumnDef.key`s used. ✅

**Note:** Mobile treatment of the wide heatmap is intentionally deferred (spec §7 flag). The prototype uses `overflow-x: auto` so it's usable on phone via horizontal scroll; a proper mobile design is a later task.
