# Live In-Game Prop Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feed the already-built `LiveChip` indicator with real live MLB box-score counts via a cached Vercel function + polling, replacing the `demoLive` scaffolding.

**Architecture:** Pure core (`web/lib/live.ts`) parses MLB box scores and derives each chip's `{state, have, need}` — fully unit-tested. A thin Vercel route (`web/app/api/live/route.ts`) fetches the public MLB Stats API and returns a cached JSON. A React `LiveProvider` polls it (rules: live-only, tab-visible, 60s) and exposes `liveFor(row, kind)`, which every surface calls instead of `demoLive`.

**Tech Stack:** Next.js (Node route handlers), TypeScript, Vitest (node env, `**/*.test.ts`).

## Global Constraints

- **No probability/board data changes** — this is a live *display* overlay. No recorder/grader touch.
- **Runs on Vercel, zero GitHub Actions minutes.** Route cached `Cache-Control: s-maxage=45, stale-while-revalidate=30`.
- **True counts, never clamped** — `have/need` shows `2/1`, `8/6`. States: `pregame` grey · `live` amber · `cleared` green · `missed` red (final & short).
- **Vitest is node-env, `**/*.test.ts` only** — no DOM. Test pure functions; verify React glue with `npx tsc --noEmit` + localhost preview.
- Build on the existing `preview/live-indicator` branch (keeps the validated chip UI); this plan swaps demo data for real.
- MLB endpoints: schedule `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=YYYY-MM-DD`; boxscore `https://statsapi.mlb.com/api/v1/game/{gamePk}/boxscore`.

---

### Task 1: Pure core — box-score parsing (`web/lib/live.ts`)

**Files:**
- Create: `web/lib/live.ts`
- Test: `web/lib/tests/live.test.ts`

**Interfaces:**
- Produces: `type LiveStat = { game: string; h?: number; tb?: number; hr?: number; r?: number; rbi?: number; bk?: number; pk?: number }`; `type LivePayload = { updated: string; games: Record<string,string>; players: Record<string,LiveStat> }`; `computeTB(h,d,t,hr): number`; `parseBoxscore(gamePk: string, box: any): Record<string,LiveStat>`; `buildPayload(schedule: any, boxes: Record<string,any>, updated: string): LivePayload`.

- [ ] **Step 1: Write the failing test**

`web/lib/tests/live.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeTB, parseBoxscore, buildPayload } from "../live";

const BOX = {
  teams: {
    away: { players: {
      ID111: { person: { id: 111 }, stats: { batting: { hits: 2, doubles: 1, triples: 0, homeRuns: 1, runs: 1, rbi: 3, strikeOuts: 1 } } },
    } },
    home: { players: {
      ID222: { person: { id: 222 }, stats: { pitching: { strikeOuts: 7 } } },
      ID333: { person: { id: 333 }, stats: { batting: {} } }, // no PA -> skipped
    } },
  },
};
const SCHED = { dates: [{ games: [
  { gamePk: 900, status: { abstractGameState: "Live" } },
  { gamePk: 901, status: { abstractGameState: "Preview" } },
] }] };

describe("computeTB", () => {
  it("1B+2*2B+3*3B+4*HR via h+d+2t+3hr", () => {
    expect(computeTB(2, 1, 0, 1)).toBe(2 + 1 + 0 + 3); // 2 hits (a 2B + a HR) = 2 + 4 = 6? -> h+d+2t+3hr = 6
  });
});
describe("parseBoxscore", () => {
  it("extracts batter + pitcher lines, skips no-PA players", () => {
    const p = parseBoxscore("900", BOX);
    expect(p["111"]).toEqual({ game: "900", h: 2, tb: 6, hr: 1, r: 1, rbi: 3, bk: 1 });
    expect(p["222"]).toEqual({ game: "900", pk: 7 });
    expect(p["333"]).toBeUndefined();
  });
});
describe("buildPayload", () => {
  it("maps game statuses + merges player lines", () => {
    const pay = buildPayload(SCHED, { "900": BOX }, "2026-07-01T23:00:00Z");
    expect(pay.games).toEqual({ "900": "Live", "901": "Preview" });
    expect(pay.players["111"].h).toBe(2);
    expect(pay.updated).toBe("2026-07-01T23:00:00Z");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run lib/tests/live.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `web/lib/live.ts`**

```ts
import type { PropKind } from "./format";

export type LiveStat = { game: string; h?: number; tb?: number; hr?: number; r?: number; rbi?: number; bk?: number; pk?: number };
export type LivePayload = { updated: string; games: Record<string, string>; players: Record<string, LiveStat> };

const n = (v: unknown): number => (typeof v === "number" ? v : parseInt(String(v ?? 0), 10) || 0);

/** Total bases = 1B + 2*2B + 3*3B + 4*HR, which equals h + d + 2t + 3hr. */
export function computeTB(h: number, d: number, t: number, hr: number): number {
  return h + d + 2 * t + 3 * hr;
}

/** Per-player live lines for ONE game's boxscore JSON. Batters with 0 batting stats
 *  and pitchers with 0 pitching stats are skipped (undefined). */
export function parseBoxscore(gamePk: string, box: any): Record<string, LiveStat> {
  const out: Record<string, LiveStat> = {};
  for (const side of ["away", "home"] as const) {
    const players = box?.teams?.[side]?.players ?? {};
    for (const key of Object.keys(players)) {
      const pl = players[key];
      const pid = String(pl?.person?.id ?? key.replace(/^ID/, ""));
      const bat = pl?.stats?.batting;
      const pit = pl?.stats?.pitching;
      const stat: LiveStat = { game: gamePk };
      let has = false;
      if (bat && (bat.atBats != null || bat.plateAppearances != null || bat.hits != null)) {
        const h = n(bat.hits), d = n(bat.doubles), t = n(bat.triples), hr = n(bat.homeRuns);
        stat.h = h; stat.tb = computeTB(h, d, t, hr); stat.hr = hr; stat.r = n(bat.runs); stat.rbi = n(bat.rbi); stat.bk = n(bat.strikeOuts);
        has = has || h > 0 || d > 0 || t > 0 || hr > 0 || n(bat.runs) > 0 || n(bat.rbi) > 0 || n(bat.strikeOuts) > 0 || n(bat.atBats) > 0 || n(bat.plateAppearances) > 0;
      }
      if (pit && pit.strikeOuts != null) { stat.pk = n(pit.strikeOuts); has = true; }
      if (has) out[pid] = stat;
    }
  }
  return out;
}

/** Merge the schedule's game statuses + all fetched boxscores into the wire payload. */
export function buildPayload(schedule: any, boxes: Record<string, any>, updated: string): LivePayload {
  const games: Record<string, string> = {};
  for (const d of schedule?.dates ?? []) {
    for (const g of d?.games ?? []) {
      games[String(g.gamePk)] = g?.status?.abstractGameState ?? "Preview";
    }
  }
  const players: Record<string, LiveStat> = {};
  for (const pk of Object.keys(boxes)) Object.assign(players, parseBoxscore(pk, boxes[pk]));
  return { updated, games, players };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run lib/tests/live.test.ts`
Expected: PASS. (Note: `computeTB(2,1,0,1)` = `2+1+0+3` = 6 — the test's comment arithmetic resolves to 6.)

- [ ] **Step 5: Commit**

```bash
git add web/lib/live.ts web/lib/tests/live.test.ts
git commit -m "feat(live): box-score parsing core (parseBoxscore/buildPayload)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Derive chip state (`deriveLive` + `propNeed`)

**Files:**
- Modify: `web/lib/live.ts`
- Test: `web/lib/tests/derive.test.ts`

**Interfaces:**
- Produces: `type LiveState = "pregame" | "live" | "cleared" | "missed"`; `type LiveKind = PropKind | "contact" | "batterK"`; `propNeed(kind: LiveKind, line?: string): number`; `deriveLive(stat: LiveStat | undefined, kind: LiveKind, status: string | undefined, line?: string): { state: LiveState; have: number; need: number }`.

- [ ] **Step 1: Write the failing test**

`web/lib/tests/derive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveLive } from "../live";

const S = (o: any) => ({ game: "1", ...o });

describe("deriveLive need", () => {
  it("thresholds parse from kind", () => {
    expect(deriveLive(S({ h: 0 }), "hits2", "Live").need).toBe(2);
    expect(deriveLive(S({ tb: 0 }), "tb4", "Live").need).toBe(4);
    expect(deriveLive(S({ hr: 0 }), "hr", "Live").need).toBe(1);
    expect(deriveLive(S({ pk: 0 }), "k", "Live", "5.5").need).toBe(6); // floor(5.5)+1
  });
});
describe("deriveLive have + state", () => {
  it("pregame when Preview / unknown", () => {
    expect(deriveLive(undefined, "hr", "Preview").state).toBe("pregame");
    expect(deriveLive(undefined, "hr", undefined).state).toBe("pregame");
  });
  it("live while in play and short", () => {
    expect(deriveLive(S({ h: 1 }), "hits2", "Live")).toEqual({ state: "live", have: 1, need: 2 });
  });
  it("cleared at/over the line, count not clamped", () => {
    expect(deriveLive(S({ h: 2 }), "hits1", "Live")).toEqual({ state: "cleared", have: 2, need: 1 }); // 2/1
    expect(deriveLive(S({ pk: 8 }), "k", "Final", "5.5")).toEqual({ state: "cleared", have: 8, need: 6 }); // 8/6
  });
  it("missed only when Final and short", () => {
    expect(deriveLive(S({ h: 1 }), "hits2", "Final")).toEqual({ state: "missed", have: 1, need: 2 });
  });
  it("hrr sums h+r+rbi; contact=hits; batterK=batter strikeouts", () => {
    expect(deriveLive(S({ h: 1, r: 1, rbi: 1 }), "hrr2", "Live").have).toBe(3);
    expect(deriveLive(S({ h: 2 }), "contact", "Live")).toEqual({ state: "cleared", have: 2, need: 1 });
    expect(deriveLive(S({ bk: 1 }), "batterK", "Final")).toEqual({ state: "cleared", have: 1, need: 1 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run lib/tests/derive.test.ts`
Expected: FAIL (`deriveLive` not exported).

- [ ] **Step 3: Implement — append to `web/lib/live.ts`**

```ts
export type LiveState = "pregame" | "live" | "cleared" | "missed";
export type LiveKind = PropKind | "contact" | "batterK";

export function propNeed(kind: LiveKind, line?: string): number {
  if (kind === "k") return Math.floor(parseFloat(line ?? "5.5")) + 1;
  if (kind === "contact" || kind === "batterK" || kind === "hr") return 1;
  const m = kind.match(/(\d)$/);
  return m ? parseInt(m[1], 10) : 1;
}

function haveFor(stat: LiveStat | undefined, kind: LiveKind): number {
  if (!stat) return 0;
  switch (kind) {
    case "hr": return stat.hr ?? 0;
    case "k": return stat.pk ?? 0;
    case "contact": return stat.h ?? 0;
    case "batterK": return stat.bk ?? 0;
    default:
      if (kind.startsWith("hits")) return stat.h ?? 0;
      if (kind.startsWith("tb")) return stat.tb ?? 0;
      if (kind.startsWith("runs")) return stat.r ?? 0;
      if (kind.startsWith("rbi")) return stat.rbi ?? 0;
      if (kind.startsWith("hrr")) return (stat.h ?? 0) + (stat.r ?? 0) + (stat.rbi ?? 0);
      return 0;
  }
}

export function deriveLive(stat: LiveStat | undefined, kind: LiveKind, status: string | undefined, line?: string): { state: LiveState; have: number; need: number } {
  const need = propNeed(kind, line);
  const have = haveFor(stat, kind);
  let state: LiveState;
  if (!status || status === "Preview") state = "pregame";
  else if (have >= need) state = "cleared";
  else if (status === "Final") state = "missed";
  else state = "live";
  return { state, have, need };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run lib/tests/derive.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/live.ts web/lib/tests/derive.test.ts
git commit -m "feat(live): deriveLive — chip state from live stat + prop threshold

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Polling gate (`isActiveWindow`)

**Files:**
- Modify: `web/lib/live.ts`
- Test: `web/lib/tests/window.test.ts`

**Interfaces:**
- Produces: `type LiveGame = { id: string; startMs?: number }`; `isActiveWindow(games: LiveGame[], statuses: Record<string,string>, nowMs: number): boolean`.

- [ ] **Step 1: Write the failing test**

`web/lib/tests/window.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isActiveWindow } from "../live";

const now = 1_000_000_000_000;
describe("isActiveWindow", () => {
  it("false when nothing has started", () => {
    expect(isActiveWindow([{ id: "1", startMs: now + 1000 }], {}, now)).toBe(false);
  });
  it("true when a started game is not final", () => {
    expect(isActiveWindow([{ id: "1", startMs: now - 1000 }], { "1": "Live" }, now)).toBe(true);
  });
  it("false when all started games are final", () => {
    expect(isActiveWindow([{ id: "1", startMs: now - 1000 }], { "1": "Final" }, now)).toBe(false);
  });
  it("false with no games", () => {
    expect(isActiveWindow([], {}, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run lib/tests/window.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement — append to `web/lib/live.ts`**

```ts
export type LiveGame = { id: string; startMs?: number };

/** Poll only while at least one game has started and not every started game is Final. */
export function isActiveWindow(games: LiveGame[], statuses: Record<string, string>, nowMs: number): boolean {
  const started = games.filter((g) => typeof g.startMs === "number" && g.startMs <= nowMs);
  if (started.length === 0) return false;
  return started.some((g) => statuses[g.id] !== "Final");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run lib/tests/window.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/live.ts web/lib/tests/window.test.ts
git commit -m "feat(live): isActiveWindow polling gate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The Vercel route (`/api/live`)

**Files:**
- Create: `web/app/api/live/route.ts`

**Interfaces:**
- Consumes: `buildPayload` (Task 1).
- Produces: `GET(req: Request): Response` returning `LivePayload` JSON, cache-controlled.

- [ ] **Step 1: Implement the route**

`web/app/api/live/route.ts`:

```ts
import { buildPayload } from "../../../lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // we set our own cache header

function etDate(): string {
  // YYYY-MM-DD in America/New_York (baseball day)
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts; // en-CA gives YYYY-MM-DD
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") ?? "") ? url.searchParams.get("date")! : etDate();
  try {
    const sched = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`, { cache: "no-store" }).then((r) => r.json());
    const pks: string[] = [];
    for (const d of sched?.dates ?? []) for (const g of d?.games ?? []) {
      const st = g?.status?.abstractGameState;
      if (st === "Live" || st === "Final") pks.push(String(g.gamePk));
    }
    const boxes: Record<string, any> = {};
    await Promise.all(pks.map(async (pk) => {
      try { boxes[pk] = await fetch(`https://statsapi.mlb.com/api/v1/game/${pk}/boxscore`, { cache: "no-store" }).then((r) => r.json()); }
      catch { /* skip a failed game — others still return */ }
    }));
    const payload = buildPayload(sched, boxes, new Date().toISOString());
    return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json", "cache-control": "s-maxage=45, stale-while-revalidate=30" } });
  } catch {
    return new Response(JSON.stringify({ updated: new Date().toISOString(), games: {}, players: {} }), { headers: { "content-type": "application/json", "cache-control": "s-maxage=15" } });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Manual smoke (a date with finished games returns real data)**

Run: `cd web && npm run dev` (in background), then `curl -s "http://localhost:3000/api/live?date=2026-06-26" | head -c 400`
Expected: JSON with `games` statuses and (for a played date) some `players` lines. (This route is not auth-gated; it returns 200.)

- [ ] **Step 4: Commit**

```bash
git add web/app/api/live/route.ts
git commit -m "feat(live): /api/live Vercel route (MLB boxscore feeder, cached 45s)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `LiveProvider` — context + polling hook + `liveFor`

**Files:**
- Create: `web/components/LiveProvider.tsx`

**Interfaces:**
- Consumes: `deriveLive`, `isActiveWindow`, types from `web/lib/live.ts`; `BoardRow` from `./PropBoard`; `LiveKind`.
- Produces: `<LiveProvider date games>`; `useLiveFor(): (row: BoardRow, kind: LiveKind) => { state, have, need } | null`.

- [ ] **Step 1: Implement**

`web/components/LiveProvider.tsx`:

```tsx
"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { BoardRow } from "./PropBoard";
import { deriveLive, isActiveWindow, type LivePayload, type LiveKind, type LiveGame } from "../lib/live";

const EMPTY: LivePayload = { updated: "", games: {}, players: {} };
const Ctx = createContext<LivePayload>(EMPTY);

export function LiveProvider({ date, games, children }: { date: string; games: LiveGame[]; children: React.ReactNode }) {
  const [payload, setPayload] = useState<LivePayload>(EMPTY);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const gamesKey = games.map((g) => `${g.id}:${g.startMs ?? ""}`).join(",");

  useEffect(() => {
    let cancelled = false;
    const qs = date ? `?date=${date}` : "";
    const fetchNow = async () => {
      try {
        const r = await fetch(`/api/live${qs}`, { cache: "no-store" });
        const p = (await r.json()) as LivePayload;
        if (!cancelled) setPayload(p);
      } catch { /* keep last good */ }
    };
    const tick = () => { if (isActiveWindow(games, payloadRef.current.games, Date.now()) && !document.hidden) fetchNow(); };
    // bootstrap: fetch once if we're in the window; then poll every 60s
    if (isActiveWindow(games, {}, Date.now())) fetchNow();
    timer.current = setInterval(tick, 60_000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; if (timer.current) clearInterval(timer.current); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, gamesKey]);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  return <Ctx.Provider value={payload}>{children}</Ctx.Provider>;
}

export function useLiveFor() {
  const payload = useContext(Ctx);
  return (row: BoardRow, kind: LiveKind) => {
    const pid = row.player_id != null ? String(row.player_id) : undefined;
    if (!pid) return null;
    const status = row.gameId ? payload.games[row.gameId] : undefined;
    return deriveLive(payload.players[pid], kind, status, row.line);
  };
}
```

- [ ] **Step 2: Typecheck** (expect errors: `BoardRow.player_id` missing — fixed in Task 6)

Run: `cd web && npx tsc --noEmit`
Expected: errors ONLY about `player_id` on BoardRow (resolved next task). No other errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/LiveProvider.tsx
git commit -m "feat(live): LiveProvider context + 60s polling hook (live-only, tab-aware)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Wire it in + remove demo scaffolding

**Files:**
- Modify: `web/components/PropBoard.tsx` (BoardRow type; remove `demoLive` import; swap call sites)
- Modify: `web/components/LiveChip.tsx` (move `LiveState` import; delete demo funcs)
- Modify: `web/components/TopPlays.tsx` (swap `liveFor`/`liveOne`)
- Modify: `web/app/page.tsx` (set `player_id` on rows; wrap board in `LiveProvider`)

- [ ] **Step 1: `LiveChip.tsx` — source `LiveState` from lib, delete demo generators**

Replace the top `export type LiveState = ...` line with:

```ts
import type { LiveState } from "../lib/live";
```

Delete `propNeed`, `demoLiveN`, and `demoLive` from `LiveChip.tsx` (they now live in `lib/live.ts`). Keep the `LiveChip` component and re-export the type: add `export type { LiveState };` at the bottom.

- [ ] **Step 2: `PropBoard.tsx` — BoardRow gains `player_id`; use the live hook**

Add to the `BoardRow` type (next to `bat_order?`):

```ts
  player_id?: number;
```

Replace `import { LiveChip, demoLive } from "./LiveChip";` with:

```ts
import { LiveChip } from "./LiveChip";
import { useLiveFor } from "./LiveProvider";
import type { LiveKind } from "../lib/live";
```

In `PropBoard(...)`, near the top of the component body (where hooks run), add:

```ts
  const liveFor = useLiveFor();
```

Swap the three demo call sites (they currently read `demoLive(kind, r.player, r.line)`):
- Card (left-of-%): `const lv = demoLive(kind, r.player, r.line);` → `const lv = liveFor(r, kind);`
- Card bottom CONF row already has no chip — leave.
- Table (left of sphere): `demoLive(kind, r.player, r.line)` → `liveFor(r, kind)`.

`BoardRowLine` and `ColBatterRow` are module-level functions (not inside `PropBoard`), so they can't see `liveFor` from closure — call the hook inside each:
- In `BoardRowLine`, replace `const _lv = demoLive(kind, r.player, r.line);` with `const liveFor = useLiveFor(); const _lv = liveFor(r, kind);`.
- In `ColBatterRow`, add `const liveFor = useLiveFor();` at the top; in `propCell`, replace `demoLive(kind, row.player, row.line)` with `liveFor(row, kind as LiveKind)`; the pitcher-K chip in `GameBreakdown` (`demoLive("k", r.player, r.line)`) → add `const liveFor = useLiveFor();` at the top of `GameBreakdown` and use `liveFor(r, "k")`.

(`useLiveFor` just reads context — safe to call in any of these render functions.)

- [ ] **Step 3: `TopPlays.tsx` — swap the two demo helpers for the hook**

Replace the import block:

```ts
import { LiveChip } from "./LiveChip";
import { useLiveFor } from "./LiveProvider";
import type { LiveKind } from "../lib/live";
```

Delete the `liveFor` and `liveOne` demo functions. Inside `TopPlays(...)` add `const liveFor = useLiveFor();`, and inside `TopPlayRow` the `live` prop is passed by callers, so update each `LeaderSection` render callback:
- standard sections: `live={renderChip(liveFor(r, "<kind>"))}`
- Top Contact: `live={renderChip(liveFor(r, "contact"))}`
- Top Batter Strikeouts: `live={renderChip(liveFor(r, "batterK"))}`

where `renderChip` is a local helper added inside `TopPlays`:

```tsx
  const renderChip = (lv: { state: any; have: number; need: number } | null) =>
    lv ? <LiveChip state={lv.state} have={lv.have} need={lv.need} /> : null;
```

(Replace `liveFor(r, "hr")` etc. — the kind strings already used — so the 9 render callbacks become `live={renderChip(liveFor(r, "hr"))}`, `...(r, hitsKind)`, etc., and the two matchup ones use `"contact"`/`"batterK"`.)

- [ ] **Step 4: `page.tsx` — set `player_id`, wrap board in `LiveProvider`**

In each of the 6 batter row mappings AND the `kRows` (pitcher) mapping, add `player_id: r.player_id,` (next to `id:`). This gives every `BoardRow` its MLB id.

Near the top of the render (after `data` is loaded), derive the games list:

```tsx
  const liveGames: import("../lib/live").LiveGame[] = data
    ? Array.from(new Map(
        [...data.hr, ...data.strikeouts].filter((r) => r.game_id != null)
          .map((r) => [String(r.game_id), { id: String(r.game_id), startMs: r.game_time ? Date.parse(r.game_time) : undefined }])
      ).values())
    : [];
```

Wrap the board's render tree (the `<main>` or the section that renders PropBoard/TopPlays) with:

```tsx
  <LiveProvider date={selectedDate || todayET()} games={liveGames}>
    {/* existing board JSX */}
  </LiveProvider>
```

Add `import { LiveProvider } from "../components/LiveProvider";` and a small `todayET()` (mirror the route's `etDate`) or reuse `selectedDate || ""` (the route defaults to ET today when the param is empty — so passing `date={selectedDate}` and letting empty fall through is fine; simplest: `date={selectedDate}`).

- [ ] **Step 5: Typecheck + lint + vitest**

Run: `cd web && npx tsc --noEmit && npx vitest run && npx eslint app components`
Expected: tsc 0, vitest all pass, no NEW eslint errors (the pre-existing `Cannot create components during render` in PropBoard.tsx remains, unrelated).

- [ ] **Step 6: Commit**

```bash
git add web/components/PropBoard.tsx web/components/LiveChip.tsx web/components/TopPlays.tsx web/app/page.tsx
git commit -m "feat(live): wire real live data into every chip; remove demo scaffolding

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Verification — real live data on localhost

- [ ] **Step 1: Full frontend checks** — `cd web && npx tsc --noEmit && npx vitest run && npx eslint app components` (all green / no new errors).
- [ ] **Step 2: Route returns real data** — dev server up, `curl -s "http://localhost:3000/api/live?date=<a date with finished games>" | python3 -m json.tool | head -40`. Confirm `games` statuses + `players` lines with real counts.
- [ ] **Step 3: Board reflects it** — open localhost:3000 for that date; confirm chips across Cards / Table / Hybrid / Top Plays (incl. Contact & Batter-K) / Matchups / Game Hub show real cleared(green over-counts)/missed(red) states, and pregame(grey) for a future date.
- [ ] **Step 4: Polling behavior** — with DevTools Network open on a live date: one `/api/live` request per ~60s; background the tab → requests pause; foreground → resumes; a future/no-games date → no polling.
- [ ] **Step 5: Report for preview-before-prod** — share findings; wait for explicit approval before merge + deploy (frontend to Vercel via git push; `/api/live` becomes the first Vercel function; no `force_deploy` needed).

---

## Self-Review

**Spec coverage:** feeder route (Task 4) ✓ · MLB HTTP endpoints + parse (Task 1) ✓ · data contract shape (Tasks 1,4) ✓ · deriveLive need/have/state incl. contact/batterK + over-counts (Task 2) ✓ · polling rules live-only/hidden/60s (Tasks 3,5) ✓ · caching header (Task 4) ✓ · wiring replaces demoLive on all surfaces + removes scaffolding (Task 6) ✓ · testing (Tasks 1-3 unit, 7 manual) ✓ · rollout (Task 7) ✓.

**Placeholder scan:** none — complete code in every step. The one runtime dependency (`BoardRow.player_id`) is intentionally introduced in Task 5 and satisfied in Task 6 Step 2 (flagged in Task 5 Step 2's expected tsc output).

**Type consistency:** `LiveStat`/`LivePayload`/`LiveState`/`LiveKind`/`LiveGame` defined in Task 1-3, consumed identically in Tasks 4-6. `deriveLive(stat, kind, status, line?)` signature matches every call in `useLiveFor`. `liveFor(row, kind)` return shape matches `LiveChip` props.
