# Website (Display) Implementation Plan — Plan 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Next.js website that displays the engine's Home Run and Strikeout projections — a board with a Cards/Table/Hybrid/List view switcher plus a per-player breakdown page — with real player names, fed by a JSON file the engine produces.

**Architecture:** The Python engine (Plan 1, already built) writes projections to a JSON file at `web/public/data/latest.json`. The Next.js app (in `web/`) loads that static JSON in the browser and renders it. UI is built against a committed sample JSON so development is fast and reliable; a refresh script regenerates the file from live data. No database, no auth, no deploy in this plan (all deferred to later plans).

**Tech Stack:** Existing Python engine (`model/`); Next.js (App Router, TypeScript, Tailwind) in `web/`; Vitest for pure-logic unit tests; Node 24 / npm.

---

## File Structure

```
prop-predict/
  model/
    fetch.py            # MODIFY: add get_player_names (batch id->name)
    pipeline.py         # MODIFY: include recent_form_mult in HR rows
    export_web.py       # CREATE: run engine -> write web/public/data/latest.json (+ names, timestamp)
  tests/
    test_pipeline.py    # MODIFY: assert recent_form_mult present in HR rows
    test_fetch_smoke.py # MODIFY: smoke test for get_player_names
  web/                  # CREATE: the Next.js app
    public/data/
      latest.json       # CREATE: committed SAMPLE projections (UI dev data)
    app/
      layout.tsx        # scaffold default (minor edit: title)
      page.tsx          # CREATE: the board page (loads data, renders)
      player/[prop]/[id]/page.tsx  # CREATE: player breakdown page
    lib/
      types.ts          # CREATE: Projection types
      data.ts           # CREATE: load + parse latest.json
      format.ts         # CREATE: pure format/sort helpers (TESTED)
    components/
      ViewSwitcher.tsx  # CREATE: Cards|Table|Hybrid|List toggle
      PropBoard.tsx     # CREATE: renders one prop's rows in the chosen view
      tests/
        format.test.ts  # CREATE: vitest tests for format.ts
    vitest.config.ts    # CREATE: vitest setup
```

**Responsibilities:**
- `lib/format.ts` — pure functions (percent formatting, edge labels, sorting). The ONLY unit-tested frontend code.
- `lib/data.ts` / `lib/types.ts` — load and shape the JSON.
- `components/*` — presentational; verified by running the dev server and viewing localhost.
- `model/export_web.py` — bridges the Python engine to the website's data file.

---

### Task 1: Engine — include recent_form_mult in HR rows

**Files:**
- Modify: `model/pipeline.py`
- Test: `tests/test_pipeline.py`

- [ ] **Step 1: Add a failing assertion** to the existing `test_build_hr_rows_produces_expected_fields` in `tests/test_pipeline.py`. Find that test and add this line at the end of it:

```python
    assert "recent_form_mult" in row and row["recent_form_mult"] == pytest.approx(1.10)
```

(The sample batter in `tests/fixtures.py` has `recent_form_mult: 1.10`.)

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && uv run pytest tests/test_pipeline.py -k produces_expected_fields -v`
Expected: FAIL (KeyError / assertion — `recent_form_mult` not in row).

- [ ] **Step 3: Add the field to the HR row** in `model/pipeline.py`. In `build_hr_rows`, inside the `rows.append({...})` dict for HR, add this key (alongside the existing `park_mult` line):

```python
                "recent_form_mult": b.get("recent_form_mult", 1.0),
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_pipeline.py -v`
Expected: PASS (all pipeline tests).

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat: include recent_form_mult in HR projection rows"
```

---

### Task 2: Engine — batch player-name lookup

**Files:**
- Modify: `model/fetch.py`
- Test: `tests/test_fetch_smoke.py`

- [ ] **Step 1: Append a smoke test** to `tests/test_fetch_smoke.py`:

```python
def test_get_player_names_smoke():
    from model.fetch import get_player_names
    names = get_player_names([592450, 669373])  # Judge, Skubal
    assert names[592450] == "Aaron Judge"
    assert names[669373] == "Tarik Skubal"
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -k player_names -v`
Expected: FAIL (ImportError: cannot import name 'get_player_names').

- [ ] **Step 3: Append the implementation** to `model/fetch.py`:

```python
def get_player_names(player_ids: list[int]) -> dict[int, str]:
    """Map MLBAM player ids to 'First Last' names via the MLB Stats API.

    Unknown ids are omitted from the returned dict. One batched request.
    """
    ids = [pid for pid in player_ids if pid]
    if not ids:
        return {}
    data = statsapi.get("people", {"personIds": ",".join(str(i) for i in ids)})
    out: dict[int, str] = {}
    for person in data.get("people", []):
        out[int(person["id"])] = person.get("fullName", str(person["id"]))
    return out
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -k player_names -v`
Expected: PASS (2 names resolved). If the MLB `people` endpoint params differ, inspect `statsapi.get("people", {"personIds": "592450"})` output and adjust the param/key names while keeping the `{id: fullName}` return shape; note any change.

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py tests/test_fetch_smoke.py
git commit -m "feat: add batch MLBAM id->name lookup"
```

---

### Task 3: Scaffold the Next.js app

**Files:**
- Create: `web/` (via create-next-app)

- [ ] **Step 1: Scaffold** (run from the project root)

```bash
cd /Users/issiakadiawara/Projects/prop-predict
npx create-next-app@latest web --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
```
Expected: a `web/` directory with a Next.js app. If `--yes` prompts anyway, accept defaults (App Router yes, Turbopack yes).

- [ ] **Step 2: Verify the dev server starts**

```bash
cd /Users/issiakadiawara/Projects/prop-predict/web
npm run dev
```
Expected: prints `Local: http://localhost:3000`. Open it to confirm the Next.js starter renders, then stop the server (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
cd /Users/issiakadiawara/Projects/prop-predict
git add web
git commit -m "feat: scaffold Next.js web app"
```

(Note: `web/node_modules` and `web/.next` are ignored by create-next-app's own `.gitignore`.)

---

### Task 4: Sample projections data file

**Files:**
- Create: `web/public/data/latest.json`

- [ ] **Step 1: Create the sample data** at `web/public/data/latest.json` (this is the canonical shape the site consumes; HR fields match `build_hr_rows` plus `recent_form_mult`; K fields match `build_strikeout_rows`):

```json
{
  "date": "2026-06-10",
  "updated": "2026-06-10T18:15:00Z",
  "hr": [
    {"player": "Kyle Schwarber", "team": "PHI", "park": "COL", "probability": 0.31, "wind_out_mph": 10.0, "weather_mult": 1.27, "park_mult": 1.22, "recent_form_mult": 1.0},
    {"player": "Aaron Judge", "team": "NYY", "park": "COL", "probability": 0.29, "wind_out_mph": 10.0, "weather_mult": 1.27, "park_mult": 1.22, "recent_form_mult": 1.06},
    {"player": "Shohei Ohtani", "team": "LAD", "park": "COL", "probability": 0.22, "wind_out_mph": 10.0, "weather_mult": 1.27, "park_mult": 1.22, "recent_form_mult": 1.09},
    {"player": "Pete Alonso", "team": "NYM", "park": "NYM", "probability": 0.14, "wind_out_mph": -4.0, "weather_mult": 0.95, "park_mult": 0.97, "recent_form_mult": 0.98}
  ],
  "strikeouts": [
    {"player": "Zack Wheeler", "team": "PHI", "expected_ks": 5.9, "line": 5.5, "over_prob": 0.54},
    {"player": "Tarik Skubal", "team": "DET", "expected_ks": 5.8, "line": 5.5, "over_prob": 0.52},
    {"player": "Gerrit Cole", "team": "NYY", "expected_ks": 3.5, "line": 5.5, "over_prob": 0.14}
  ]
}
```

- [ ] **Step 2: Verify it is valid JSON**

Run: `cd /Users/issiakadiawara/Projects/prop-predict && node -e "console.log(Object.keys(require('./web/public/data/latest.json')))"`
Expected: prints `[ 'date', 'updated', 'hr', 'strikeouts' ]`.

- [ ] **Step 3: Commit**

```bash
git add web/public/data/latest.json
git commit -m "feat: add sample projections data for the website"
```

---

### Task 5: Types, data loader, and tested format helpers

**Files:**
- Create: `web/lib/types.ts`, `web/lib/data.ts`, `web/lib/format.ts`
- Create: `web/vitest.config.ts`, `web/components/tests/format.test.ts`
- Modify: `web/package.json` (add vitest + test script)

- [ ] **Step 1: Install vitest**

```bash
cd /Users/issiakadiawara/Projects/prop-predict/web
npm install -D vitest
```

- [ ] **Step 2: Create `web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["**/*.test.ts"] },
});
```

- [ ] **Step 3: Add a test script** to `web/package.json`. In the `"scripts"` object add:

```json
    "test": "vitest run"
```

- [ ] **Step 4: Create `web/lib/types.ts`**

```ts
export type HrRow = {
  player: string;
  team: string;
  park: string;
  probability: number;
  wind_out_mph: number;
  weather_mult: number;
  park_mult: number;
  recent_form_mult: number;
};

export type KRow = {
  player: string;
  team: string;
  expected_ks: number;
  line: number;
  over_prob: number;
};

export type Projections = {
  date: string;
  updated: string;
  hr: HrRow[];
  strikeouts: KRow[];
};
```

- [ ] **Step 5: Write failing tests** at `web/components/tests/format.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { pct, windLabel, strengthLabel, sortByProb } from "../../lib/format";

describe("pct", () => {
  it("formats a 0-1 number as a percent string", () => {
    expect(pct(0.31)).toBe("31%");
    expect(pct(0.045)).toBe("5%");
  });
});

describe("windLabel", () => {
  it("describes wind out / in / calm", () => {
    expect(windLabel(10)).toBe("10mph wind out");
    expect(windLabel(-6)).toBe("6mph wind in");
    expect(windLabel(0)).toBe("calm");
  });
});

describe("strengthLabel", () => {
  it("buckets a probability into a label", () => {
    expect(strengthLabel(0.3)).toBe("STRONG");
    expect(strengthLabel(0.18)).toBe("Lean");
    expect(strengthLabel(0.05)).toBe("Pass");
  });
});

describe("sortByProb", () => {
  it("sorts descending by the given key without mutating input", () => {
    const rows = [{ p: 0.1 }, { p: 0.5 }, { p: 0.3 }];
    const out = sortByProb(rows, "p");
    expect(out.map((r) => r.p)).toEqual([0.5, 0.3, 0.1]);
    expect(rows.map((r) => r.p)).toEqual([0.1, 0.5, 0.3]); // original untouched
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `cd /Users/issiakadiawara/Projects/prop-predict/web && npm test`
Expected: FAIL (cannot find module `../../lib/format`).

- [ ] **Step 7: Create `web/lib/format.ts`**

```ts
export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function windLabel(windOutMph: number): string {
  const v = Math.round(windOutMph);
  if (v > 0) return `${v}mph wind out`;
  if (v < 0) return `${Math.abs(v)}mph wind in`;
  return "calm";
}

export function strengthLabel(prob: number): string {
  if (prob >= 0.25) return "STRONG";
  if (prob >= 0.12) return "Lean";
  return "Pass";
}

export function sortByProb<T>(rows: T[], key: keyof T): T[] {
  return [...rows].sort((a, b) => Number(b[key]) - Number(a[key]));
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm test`
Expected: PASS (all format tests).

- [ ] **Step 9: Create `web/lib/data.ts`** (browser-side fetch of the static JSON)

```ts
import type { Projections } from "./types";

export async function loadProjections(): Promise<Projections> {
  const res = await fetch("/data/latest.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load projections: ${res.status}`);
  return (await res.json()) as Projections;
}
```

- [ ] **Step 10: Commit**

```bash
cd /Users/issiakadiawara/Projects/prop-predict
git add web/lib web/components/tests web/vitest.config.ts web/package.json web/package-lock.json
git commit -m "feat: add web types, data loader, and tested format helpers"
```

---

### Task 6: View switcher + prop board components

**Files:**
- Create: `web/components/ViewSwitcher.tsx`, `web/components/PropBoard.tsx`

- [ ] **Step 1: Create `web/components/ViewSwitcher.tsx`**

```tsx
"use client";

export type ViewMode = "cards" | "table" | "hybrid" | "list";
const MODES: ViewMode[] = ["hybrid", "cards", "table", "list"];

export function ViewSwitcher({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
      {MODES.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 text-sm capitalize ${
            mode === m ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `web/components/PropBoard.tsx`** (renders one prop's rows in the chosen view; cells are links to the breakdown page)

```tsx
"use client";

import Link from "next/link";
import type { ViewMode } from "./ViewSwitcher";
import { pct, strengthLabel } from "../lib/format";

export type BoardRow = {
  player: string;
  team: string;
  prob: number; // probability or over_prob
  detail: string; // e.g. "vs COL" or "5.5 line"
  context?: string; // e.g. wind label
  href: string;
};

function colorFor(prob: number): string {
  if (prob >= 0.25) return "border-green-500";
  if (prob >= 0.12) return "border-green-300";
  return "border-gray-200 opacity-70";
}

export function PropBoard({ rows, mode }: { rows: BoardRow[]; mode: ViewMode }) {
  if (rows.length === 0) {
    return <p className="text-gray-500 py-6">No plays yet — lineups may not be posted.</p>;
  }

  const Card = (r: BoardRow) => (
    <Link
      href={r.href}
      key={r.player}
      className={`block rounded-lg border-l-4 ${colorFor(r.prob)} border border-gray-200 p-3 hover:bg-gray-50`}
    >
      <div className="flex justify-between">
        <span className="font-semibold">{r.player}</span>
        <span className="text-green-700 font-bold">{pct(r.prob)}</span>
      </div>
      <div className="text-sm text-gray-600">
        {r.detail} · {strengthLabel(r.prob)}
        {r.context ? ` · ${r.context}` : ""}
      </div>
    </Link>
  );

  const Table = () => (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="py-1">Player</th>
          <th>Team</th>
          <th>Detail</th>
          <th className="text-right">Chance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.player} className="border-b hover:bg-gray-50">
            <td className="py-1">
              <Link href={r.href} className="text-blue-700 hover:underline">{r.player}</Link>
            </td>
            <td>{r.team}</td>
            <td className="text-gray-600">{r.detail}</td>
            <td className="text-right font-medium">{pct(r.prob)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const List = () => (
    <div className="divide-y">
      {rows.map((r) => (
        <Link key={r.player} href={r.href} className="flex justify-between py-2 hover:bg-gray-50">
          <span>{r.player} <span className="text-gray-500">{r.detail}</span></span>
          <span className="font-medium">{pct(r.prob)}</span>
        </Link>
      ))}
    </div>
  );

  if (mode === "table") return <Table />;
  if (mode === "list") return <List />;
  if (mode === "cards") return <div className="grid gap-2 sm:grid-cols-2">{rows.map(Card)}</div>;

  // hybrid: top 3 as cards, the rest as a table
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">{top.map(Card)}</div>
      {rest.length > 0 && <Table />}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/issiakadiawara/Projects/prop-predict
git add web/components/ViewSwitcher.tsx web/components/PropBoard.tsx
git commit -m "feat: add view switcher and prop board components"
```

---

### Task 7: The board page

**Files:**
- Modify: `web/app/page.tsx`
- Modify: `web/app/layout.tsx` (title only)

- [ ] **Step 1: Replace `web/app/page.tsx`** with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { loadProjections } from "../lib/data";
import type { Projections } from "../lib/types";
import { ViewSwitcher, type ViewMode } from "../components/ViewSwitcher";
import { PropBoard, type BoardRow } from "../components/PropBoard";
import { windLabel } from "../lib/format";

export default function Home() {
  const [data, setData] = useState<Projections | null>(null);
  const [mode, setMode] = useState<ViewMode>("hybrid");
  const [prop, setProp] = useState<"hr" | "k">("hr");

  useEffect(() => {
    loadProjections().then(setData).catch(console.error);
  }, []);

  if (!data) return <main className="p-6">Loading…</main>;

  const hrRows: BoardRow[] = data.hr.map((r) => ({
    player: r.player,
    team: r.team,
    prob: r.probability,
    detail: `@ ${r.park}`,
    context: windLabel(r.wind_out_mph),
    href: `/player/hr/${encodeURIComponent(r.player)}`,
  }));
  const kRows: BoardRow[] = data.strikeouts.map((r) => ({
    player: r.player,
    team: r.team,
    prob: r.over_prob,
    detail: `${r.line} Ks`,
    href: `/player/k/${encodeURIComponent(r.player)}`,
  }));

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">⚾ prop-predict</h1>
        <p className="text-sm text-gray-500">
          {data.date} · updated {new Date(data.updated).toLocaleTimeString()}
        </p>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {(["hr", "k"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProp(p)}
              className={`px-3 py-1.5 text-sm ${prop === p ? "bg-gray-800 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
            >
              {p === "hr" ? "Home Runs" : "Strikeouts"}
            </button>
          ))}
        </div>
        <ViewSwitcher mode={mode} onChange={setMode} />
      </div>

      <PropBoard rows={prop === "hr" ? hrRows : kRows} mode={mode} />
    </main>
  );
}
```

- [ ] **Step 2: Set the title** in `web/app/layout.tsx`. Find the `metadata` export and change it to:

```tsx
export const metadata = {
  title: "prop-predict",
  description: "MLB player prop projections",
};
```

- [ ] **Step 3: Run the dev server and verify**

```bash
cd /Users/issiakadiawara/Projects/prop-predict/web && npm run dev
```
Open `http://localhost:3000`. Expected: the board shows Home Runs (Schwarber, Judge, Ohtani as cards with %, then Alonso in a table below in Hybrid view). The "Home Runs / Strikeouts" toggle switches props; the view switcher changes layout (Cards/Table/Hybrid/List). Clicking a player navigates to `/player/hr/<name>` (will 404 until Task 8). Stop the server.

- [ ] **Step 4: Commit**

```bash
cd /Users/issiakadiawara/Projects/prop-predict
git add web/app/page.tsx web/app/layout.tsx
git commit -m "feat: add projections board page with prop + view toggles"
```

---

### Task 8: Player breakdown page

**Files:**
- Create: `web/app/player/[prop]/[id]/page.tsx`

- [ ] **Step 1: Create `web/app/player/[prop]/[id]/page.tsx`**

```tsx
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { loadProjections } from "../../../../lib/data";
import type { Projections } from "../../../../lib/types";
import { pct, windLabel, strengthLabel } from "../../../../lib/format";

export default function PlayerPage({
  params,
}: {
  params: Promise<{ prop: string; id: string }>;
}) {
  const { prop, id } = use(params);
  const name = decodeURIComponent(id);
  const [data, setData] = useState<Projections | null>(null);

  useEffect(() => {
    loadProjections().then(setData).catch(console.error);
  }, []);

  if (!data) return <main className="p-6">Loading…</main>;

  const back = (
    <Link href="/" className="text-blue-700 hover:underline text-sm">← back to board</Link>
  );

  if (prop === "hr") {
    const r = data.hr.find((x) => x.player === name);
    if (!r) return <main className="p-6">{back}<p className="mt-4">No data for {name}.</p></main>;
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-4">
        {back}
        <h1 className="text-2xl font-bold">{r.player} — Home Run</h1>
        <div className="flex gap-6">
          <div><div className="text-3xl font-bold text-green-700">{pct(r.probability)}</div><div className="text-sm text-gray-500">our HR chance</div></div>
          <div><div className="text-3xl font-bold">{strengthLabel(r.probability)}</div><div className="text-sm text-gray-500">our read</div></div>
        </div>
        <div>
          <h2 className="font-semibold mb-2">Why</h2>
          <ul className="space-y-1 text-sm">
            <li>🏟️ Park ({r.park}): ×{r.park_mult.toFixed(2)} {r.park_mult > 1 ? "(boost)" : r.park_mult < 1 ? "(suppress)" : ""}</li>
            <li>🌬️ Weather: {windLabel(r.wind_out_mph)} → ×{r.weather_mult.toFixed(2)}</li>
            <li>🔥 Recent form: ×{r.recent_form_mult.toFixed(2)} {r.recent_form_mult > 1 ? "(hot)" : r.recent_form_mult < 1 ? "(cold)" : "(neutral)"}</li>
          </ul>
        </div>
      </main>
    );
  }

  const r = data.strikeouts.find((x) => x.player === name);
  if (!r) return <main className="p-6">{back}<p className="mt-4">No data for {name}.</p></main>;
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      {back}
      <h1 className="text-2xl font-bold">{r.player} — Strikeouts</h1>
      <div className="flex gap-6">
        <div><div className="text-3xl font-bold text-green-700">{pct(r.over_prob)}</div><div className="text-sm text-gray-500">over {r.line}</div></div>
        <div><div className="text-3xl font-bold">{r.expected_ks.toFixed(1)}</div><div className="text-sm text-gray-500">projected Ks</div></div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run the dev server and verify navigation**

```bash
cd /Users/issiakadiawara/Projects/prop-predict/web && npm run dev
```
Open `http://localhost:3000`, click a Home Run player → see the breakdown (HR chance, read, park/weather/form "Why" list). Click "back to board", switch to Strikeouts, click a pitcher → see the strikeout breakdown. Stop the server.

- [ ] **Step 3: Commit**

```bash
cd /Users/issiakadiawara/Projects/prop-predict
git add web/app/player
git commit -m "feat: add player breakdown page"
```

---

### Task 9: Live-data refresh script

**Files:**
- Create: `model/export_web.py`

- [ ] **Step 1: Create `model/export_web.py`** (runs the engine for a date and writes the website's data file with real names + a timestamp)

```python
"""Generate the website's data file from the live engine.

Usage:
    uv run python -m model.export_web 2026-06-10
Writes web/public/data/latest.json. Slow (live Statcast per player).
"""

import datetime as dt
import json
import sys
from pathlib import Path

from model import fetch
from model.cli import _weather_fn
from model.pipeline import build_hr_rows, build_strikeout_rows

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "latest.json"


def main(date_str: str) -> None:
    slate = fetch.get_schedule(date_str)
    season = int(date_str[:4])

    def batters_fn(game_id: int) -> list[dict]:
        ids = fetch.get_lineup_batter_ids(game_id)
        names = fetch.get_player_names(ids)
        return [fetch.build_batter_profile(pid, season, name=names.get(pid, str(pid))) for pid in ids]

    def pitcher_fn(pid: int) -> dict:
        name = fetch.get_player_names([pid]).get(pid, str(pid))
        return fetch.build_pitcher_profile(pid, season, name=name)

    hr_rows = build_hr_rows(slate, batters_fn, _weather_fn)
    k_rows = build_strikeout_rows(slate, pitcher_fn)

    payload = {
        "date": date_str,
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "hr": hr_rows,
        "strikeouts": k_rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {OUT} ({len(hr_rows)} HR rows, {len(k_rows)} K rows)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "2026-06-10")
```

- [ ] **Step 2: Verify it runs and writes valid JSON** (live; may be slow / sparse if lineups aren't posted — that's OK, we only need it to produce a valid file)

Run: `cd /Users/issiakadiawara/Projects/prop-predict && export PATH="$HOME/.local/bin:$PATH" && uv run python -m model.export_web 2026-06-10`
Expected: prints `Wrote .../web/public/data/latest.json (N HR rows, M K rows)`. **Important:** if it overwrites the sample with empty arrays (no posted lineups), restore the sample afterward so the UI still demos: `git checkout web/public/data/latest.json`.

- [ ] **Step 3: Commit the script** (do NOT commit an empty data file — keep the good sample)

```bash
cd /Users/issiakadiawara/Projects/prop-predict
git checkout web/public/data/latest.json   # ensure sample is intact
git add model/export_web.py
git commit -m "feat: add live-data refresh script for the website"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Python tests still green**

Run: `cd /Users/issiakadiawara/Projects/prop-predict && export PATH="$HOME/.local/bin:$PATH" && uv run pytest -q`
Expected: all unit tests pass (27 now), smoke deselected.

- [ ] **Step 2: Web logic tests green**

Run: `cd /Users/issiakadiawara/Projects/prop-predict/web && npm test`
Expected: format tests pass.

- [ ] **Step 3: Production build succeeds** (catches type/route errors)

Run: `cd /Users/issiakadiawara/Projects/prop-predict/web && npm run build`
Expected: build completes with no type errors; `/` and `/player/[prop]/[id]` routes listed.

- [ ] **Step 4: Manual end-to-end at localhost** (this is the user preview)

Run: `npm run dev`, open `http://localhost:3000`. Confirm: board renders with names, prop toggle works, all 4 views render, clicking a player shows the breakdown. Leave it running for the user to look at.

---

## Notes for the implementer

- Build the UI against the committed **sample** `latest.json`. The live refresh script (Task 9) is for later real use; do not let an empty live run overwrite the sample in git.
- This plan does NOT deploy anything and adds no database/auth — those are later plans (pick log = Plan 3; public + paywall later).
- Player names in the breakdown's "Why" are limited to park/weather/form for v1 (those are the fields the engine row exposes). Deeper stats (barrel%, hard-hit%) would need the pipeline to include them — a later enhancement.
- The breakdown's Simple/Advanced toggles from the design are deferred; v1 shows the single "Why" view. Note this is intentional scope-trimming, not an omission.
