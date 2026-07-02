# Mock 7 "Spatial Depth" Reskin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task (fresh Opus subagent per task + review between). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Reskin the entire Prop Predict site to mock 7 "Spatial Depth", preserving the whole engine (data/math/live/auth), built on a hidden `/next` route and promoted to root when approved.

**Architecture:** Pure re-skin. A new design kit (`web/components/spatial/`) + a `/next` route reuse the existing data loaders, types, live system, auth, weighting math, and `BoardRow` seam verbatim; only presentational components are new. Foundation (kit) is built sequentially; the 5 surfaces are built by parallel Opus agents against the kit; then integrate → mobile → promote → archive.

**Tech Stack:** Next.js App Router (modified — see `web/AGENTS.md`, consult `node_modules/next/dist/docs/`), React, TypeScript, CSS (ported HSL tokens), `next/font`, vitest, Playwright (dev-only, for screenshot verification), Clerk.

## Global Constraints

- **Engine is untouched.** No changes to `lib/data.ts`, `lib/types.ts`, `lib/live.ts`, `lib/format.ts`, `lib/pace.ts`, `lib/platoon.ts`, `app/api/live/route.ts`, `proxy.ts`, the board pipeline, or `web/public/data/*` shape/URLs. New skin IMPORTS these.
- **Style source of truth:** `/Users/issiakadiawara/Projects/prop-predict/.superpowers/design-library/mock7.html` (880 lines). Every visual value (tokens, component CSS, orb math, animations) comes from it. The design-system audit in the spec summarizes it.
- **Source-aware rendering:** every displayed number flows through the weighting selection (Current/Blend/History); never read raw `.probability`/`.p_ge2` directly.
- **Live chips:** feed the restyled `LiveChip` from `useLiveFor()`; keep the 4 states + unclamped `have/need`.
- **Mobile:** `/next` uses `width=device-width` (native responsive, mock 7 breakpoints ≤880 / ≤600); do NOT reuse the 600px zoom-hack unless a surface can't fit. Mobile rules must not change the desktop layout.
- **Nothing lost:** the spec's Surfaces section is the feature checklist; every item must be present.
- **The live site (`/`) stays fully working until promotion.** Do not modify `app/page.tsx`, the current components, or `app/player/...` during Phases 0–2.
- **Model:** all spawned build agents use Opus.
- **Commits:** end messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Work on branch `feat/mock7-reskin`.

## File structure (new files only; existing engine untouched)

```
web/lib/weighting.ts                 # extracted source-aware selection + BoardRow mapping (shared, pure-testable)
web/components/spatial/
  spatial.css                        # ported :root tokens + base primitives (.sp-* classes)
  hooks.ts                           # useTilt, useParallax (touch/reduced-motion no-op)
  orbMath.ts                         # pure: (rawProb, kind) -> orb visual params (unit-tested)
  DepthField.tsx                     # 5 fixed background layers + parallax
  GlassCard.tsx                      # .float glass primitive (optional tilt)
  ProbabilityOrb.tsx                 # depth-halo orb (uses orbMath)
  GlassDot.tsx                       # catDot / envDot / leanCell / leanPair
  SegmentedControl.tsx               # sliding-pill toggle (measured indicator)
  chips.tsx                          # Badge, TagChip, HandChip, FormChip, FBox, Bvp
  FactorBar.tsx                      # center-anchored deviation meter + Delta + note
  LiveChipSpatial.tsx                # restyled 4-state live chip
  NavDock.tsx                        # floating pill nav
  CommandBar.tsx                     # sticky header (logo/wordmark/live/weighting/account)
  HeroTiles.tsx                      # hero headline + date picker + 4 KPI tiles
  board/BoardView.tsx                # Cards / Split / Table / Matchups
  GameHub.tsx                        # game cards + BatterGrid + starting pitchers
  BatterGrid.tsx                     # sortable K/C/N+7-prop orb grid
  TopPlays.tsx                       # 9 leaderboards
  Parks.tsx                          # ranked env ledger
  PlayerModal.tsx                    # URL-addressable batter + pitcher detail modal
  KitDemo.tsx                        # (Phase 0 only) renders every kit component for screenshot QA
web/app/next/layout.tsx              # nested layout: device-width viewport for the new skin
web/app/next/page.tsx                # the new skin app shell (state, data, LiveProvider, surfaces, modal)
```

---

# PHASE 0 — Foundation (sequential; build + verify before surfaces)

### Task 0.1: Extract shared weighting + BoardRow mapping → `lib/weighting.ts`

**Files:** Create `web/lib/weighting.ts`, `web/lib/tests/weighting.test.ts`. (Do NOT edit the current `app/page.tsx`.)

**Interfaces — Produces:**
- `type Source = "current" | "blend" | "hist"`
- `pickN(cur: number | undefined, hist: number | undefined, source: Source): number | undefined` — `current`→cur; `hist`→`hist ?? cur`; `blend`→`(cur+hist)/2` if both numbers else cur.
- `leanFor(vs, source)` → `{ lean: "K"|"H"|"NEU"; prob: number }` (blend recomputes lean from blended k/hit probs; mirror current `page.tsx` `leanFor`).
- `toBoardRows(data: Projections, prop: PropKind, threshold: number, source: Source): BoardRow[]` — replicate the current `page.tsx` mapping (apply pickN + threshold, build `BoardRow`, sort by displayed prob desc). Reuse `BoardRow` type by importing it (Task 0.2 re-exports it from a neutral location; until then import from `components/PropBoard`).

- [ ] **Step 1: Read the current logic** — read `web/app/page.tsx` for `pickN`, `leanFor`, and the prop→BoardRow `.map(...)` + sort (approx lines 132–390) and `BoardRow` in `web/components/PropBoard.tsx`. Copy the exact math.
- [ ] **Step 2: Write failing tests** — `web/lib/tests/weighting.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pickN } from "../weighting";
describe("pickN", () => {
  it("current returns cur", () => expect(pickN(0.3, 0.5, "current")).toBe(0.3));
  it("hist returns hist, falls back to cur", () => { expect(pickN(0.3, 0.5, "hist")).toBe(0.5); expect(pickN(0.3, undefined, "hist")).toBe(0.3); });
  it("blend averages when both numbers", () => expect(pickN(0.3, 0.5, "blend")).toBeCloseTo(0.4));
  it("blend falls back to cur when hist missing", () => expect(pickN(0.3, undefined, "blend")).toBe(0.3));
});
```
- [ ] **Step 3: Run → fail** — `cd web && npx vitest run lib/tests/weighting.test.ts` → FAIL (module not found).
- [ ] **Step 4: Implement** `web/lib/weighting.ts` with `Source`, `pickN`, `leanFor`, `toBoardRows` copied from page.tsx (exact math). Import `Projections`/rows from `lib/types`, `PropKind`/helpers from `lib/format`, `BoardRow` from `components/PropBoard`.
- [ ] **Step 5: Run → pass** — `npx vitest run lib/tests/weighting.test.ts` → all pass. Then full `npx vitest run` → all green.
- [ ] **Step 6: Commit** — `feat(web): extract shared weighting + BoardRow mapping (lib/weighting.ts)`.

### Task 0.2: Scaffold `/next` route (gated, device-width, data + LiveProvider)

**Files:** Create `web/app/next/layout.tsx`, `web/app/next/page.tsx`.

**Interfaces — Produces:** a working `/next` page (auth-gated) that loads the board and renders a placeholder; later tasks fill in surfaces.

- [ ] **Step 1: Nested layout with device-width viewport** — `web/app/next/layout.tsx`:
```tsx
import type { Viewport } from "next";
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export default function NextLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```
(Nested segment viewport overrides the root's phone viewport for `/next`. Verify by curl — see Step 4.)
- [ ] **Step 2: Page shell** — `web/app/next/page.tsx` (client component): copy the data-loading pattern from `app/page.tsx` (`loadIndex`, `loadProjections`, `selectedDate` state, URL `?date=&prop=&threshold=&source=&player=`), build `liveGames` from rows with `game_id`, wrap children in `<LiveProvider date={selectedDate} games={liveGames}>`. Render a temporary `<div className="sp-scaffold">next skin — data loaded: {data ? "yes" : "no"}</div>`. Import `toBoardRows` from `lib/weighting`.
- [ ] **Step 3: Confirm gating** — no proxy.ts change needed (`/next` is covered by the existing catch-all matcher → gated). Verify the matcher still excludes only `_next`/favicon.
- [ ] **Step 4: Verify** — `cd web && npx tsc --noEmit` (0). Start dev, curl `/next` with an iPhone UA and confirm the served viewport meta is `width=device-width` (nested layout won). Confirm `/` (current site) is unchanged.
- [ ] **Step 5: Commit** — `feat(web): scaffold /next route (gated, device-width, data + LiveProvider)`.

### Task 0.3: Design tokens + fonts → `spatial.css`

**Files:** Create `web/components/spatial/spatial.css`; import it in `web/app/next/layout.tsx`; add fonts in `web/app/layout.tsx` (additive — do not remove existing fonts).

- [ ] **Step 1: Port tokens** — copy mock7.html's entire `:root` custom-property block into `spatial.css` under a scope (e.g. `.sp-root { ... }` applied on the `/next` page wrapper, OR `:root` if safe). Include: `--bg/--bg-2/--ink/--ink-dim/--ink-faint/--line/--line-2/--line-3/--glass/--glass-2/--glass-3/--hi`, the 4 `--iris-*`, `--good/--warn/--bad`, `--rad`, `--sh-amb/--sh-con`, `--ease/--spring`. Copy the base `body`/`.field`/`.grain`/keyframes (`irisflow`, `beat`, `rise`, `popin`, `fade`) — namespaced under `.sp-*` classes to avoid clashing with the current `globals.css` while both skins coexist.
- [ ] **Step 2: Fonts** — in `web/app/layout.tsx`, add via `next/font/google`: `Bricolage_Grotesque` (weights 500/600/700/800), `Familjen_Grotesk`, `Spline_Sans_Mono`, exposed as CSS vars `--sp-disp`, `--sp-body`, `--sp-mono`; add their `.variable`s to the `<html>` className alongside the existing ones. Do not remove the current fonts (the live site still uses them).
- [ ] **Step 3: Verify** — `npx tsc --noEmit` (0); dev server renders `/next` with the dark spatial background (screenshot). `/` unchanged.
- [ ] **Step 4: Commit** — `feat(spatial): design tokens + fonts`.

### Task 0.4: `orbMath.ts` (pure, unit-tested) + `ProbabilityOrb`

**Files:** Create `web/components/spatial/orbMath.ts`, `web/components/spatial/tests/orbMath.test.ts`, `web/components/spatial/ProbabilityOrb.tsx`.

**Interfaces — Produces:**
- `orbParams(rawProb: number, heat: number): { hue: number; sat: number; light: number; blur: number; halo: number; ringOffset: number; ... }` — port mock7's `orb()` math EXACTLY: `hue = 255 - heat*112`; sat/light/blur/halo/glow/elevation scale with `heat` (copy the exact formulas from mock7.html's `orb()` function); `ringOffset` from `rawProb` (dasharray/dashoffset for r=42). `heat` is the 0..1 relative heat (compute in the component from `heatColor`/tier or pass in).
- `<ProbabilityOrb prob={number} kind={PropKind} size={number} label?={string} />` — renders the layered orb (shadow, halo, core radial-gradient, specular, SVG ring, number). Reads `heatColor`/tier from `lib/format` to get heat.

- [ ] **Step 1: Read mock7 `orb()`** — read the `orb()` and heat/`tier` functions in mock7.html; transcribe the exact numeric formulas.
- [ ] **Step 2: Failing test** — `tests/orbMath.test.ts`: assert `orbParams(x,0).hue===255`, `orbParams(x,1).hue===143` (255−112), and that blur/halo increase monotonically with heat (`orbParams(x,1).blur > orbParams(x,0).blur`), and ring offset for prob=0 vs 1 differ correctly. Use the exact expected numbers transcribed in Step 1.
- [ ] **Step 3: Run → fail** — `npx vitest run components/spatial/tests/orbMath.test.ts`.
- [ ] **Step 4: Implement** `orbMath.ts` (pure) then `ProbabilityOrb.tsx` (layered divs + SVG ring exactly per mock7's DOM structure `.orbShadow/.orbHalo/.orbCore/.orbSpec/.orbRing/.orbNum`, styled via spatial.css classes).
- [ ] **Step 5: Run → pass** + `npx tsc --noEmit`.
- [ ] **Step 6: Commit** — `feat(spatial): probability orb + orbMath`.

### Task 0.5: `DepthField` + `GlassCard` + `hooks` (tilt/parallax)

**Files:** Create `web/components/spatial/DepthField.tsx`, `GlassCard.tsx`, `hooks.ts`.

**Interfaces — Produces:** `<DepthField/>` (renders the 5 bg layers; mounts parallax), `<GlassCard tilt?={boolean} className? style? children/>` (the `.float` primitive; when `tilt`, uses `useTilt`), `useTilt(ref)` and `useParallax()` (both early-return on touch / `prefers-reduced-motion`).

- [ ] **Step 1** — read mock7's `.field/.field2/.spot/.mesh/.grain`, `.float`, `.tilt`/`.sheen`/`.lift-layer`, `attachTilt`, and the parallax rAF loop.
- [ ] **Step 2** — implement `hooks.ts` (`useTilt` sets `--rx/--ry/--mx/--my` on pointermove, resets on leave, `pointerType==='touch'` returns; `useParallax` eases the two glow layers toward pointer, touch-excluded).
- [ ] **Step 3** — implement `DepthField.tsx` (5 layers) and `GlassCard.tsx` (glass classes + optional tilt wrapper with `.sheen`/`.lift-layer`). Add the corresponding CSS to `spatial.css`.
- [ ] **Step 4: Verify** — `npx tsc --noEmit`; render `<DepthField/>` + a `<GlassCard tilt>` on `/next`, screenshot (glass panel over glow field). Confirm no tilt/parallax on a touch-emulated context.
- [ ] **Step 5: Commit** — `feat(spatial): depth field, glass card, tilt/parallax hooks`.

### Task 0.6: `SegmentedControl` (sliding pill)

**Files:** Create `web/components/spatial/SegmentedControl.tsx`.

**Interfaces — Produces:** `<SegmentedControl options={{value,label,node?}[]} value onChange variant?="default"|"ghost"|"sm" scroll?={boolean} />` — renders a track + buttons + an absolutely-positioned pill that animates `left`/`width` (measured via refs + `useLayoutEffect`, `--spring` easing) to the active option. `scroll` wraps in a horizontal-scroll strip (for the 7-prop selector).

- [ ] **Step 1** — read mock7 `.seg/.pill/.props` + `movePill()`.
- [ ] **Step 2** — implement with a `ref` per button, measure active button rect, set pill left/width; re-measure on `value`/resize.
- [ ] **Step 3: Verify** — `npx tsc --noEmit`; render weighting (Current/Blend/History) + threshold (1+/2+/3+) instances on `/next`, screenshot the pill in each position.
- [ ] **Step 4: Commit** — `feat(spatial): segmented control (sliding pill)`.

### Task 0.7: Chips + `GlassDot` + `FactorBar` + `LiveChipSpatial`

**Files:** Create `web/components/spatial/chips.tsx`, `GlassDot.tsx`, `FactorBar.tsx`, `LiveChipSpatial.tsx`.

**Interfaces — Produces:**
- `chips.tsx`: `<Badge kind="strong"|"lean"|"pass">`, `<TagChip status order?>` (conf/proj + `·#N`), `<HandChip hand adv?>`, `<FormChip kind="hot"|"cold"|"steady">`, `<FBox icon label value>`, `<Bvp>`.
- `GlassDot.tsx`: `<CatDot kind="K"|"C"|"N" prob>`, `<EnvDot pct>`, `<LeanPair k h lean>` (dominant dot + caption or K/C pair + lean tag).
- `FactorBar.tsx`: `<FactorBar icon label mult note>` (center midline, left/right fill scaled to ±40%, end node, `<Delta>` chip up/down/flat).
- `LiveChipSpatial.tsx`: `<LiveChip state have need sm?>` restyled; re-export `LiveState`.

- [ ] **Step 1** — read mock7 `.badge/.tagchip/.hand/.formchip/.fbox/.bvp`, `glassDot()/catDot/envDot/leanPair`, `.track/factorBar()`, and the current `LiveChip.tsx` for state logic.
- [ ] **Step 2** — implement each; keep `HandChip` `.adv` cyan glow visually distinct from green `TagChip.conf`. Keep LiveChip's 4 states + unclamped `have/need`.
- [ ] **Step 3: Verify** — `npx tsc --noEmit`; render one of each on `/next`, screenshot.
- [ ] **Step 4: Commit** — `feat(spatial): chips, glass dots, factor bar, live chip`.

### Task 0.8: `CommandBar` + `NavDock` + `HeroTiles` + Kit demo QA

**Files:** Create `web/components/spatial/CommandBar.tsx`, `NavDock.tsx`, `HeroTiles.tsx`, `KitDemo.tsx`; render `KitDemo` on `/next` temporarily.

**Interfaces — Produces:** `<CommandBar source onSourceChange/>` (logo + iristext wordmark + live pill + weighting `SegmentedControl` (desktop) + `<UserButton/>`), `<NavDock section onSection/>` (Board/Game Hub/Top Plays/Parks with sliding glow), `<HeroTiles dates selectedDate onDate tiles/>`.

- [ ] **Step 1** — read mock7 `.cmd`, logo SVG + glow filter, `.live/.dot-live`, `.dock/.glow`, `.hero/.heroline/.tiles/.tile`.
- [ ] **Step 2** — implement the three; CommandBar hides weighting <880px (mock 7 rule); wire `<UserButton/>` from `@clerk/nextjs`.
- [ ] **Step 3: Kit demo** — `KitDemo.tsx` renders every kit component (orb sizes, dots, chips, seg controls, factor bar, card, command bar, nav, tiles). Render it on `/next`.
- [ ] **Step 4: Verify** — `npx tsc --noEmit`; screenshot `/next` KitDemo at desktop (1280) + phone (390) widths; compare against mock7.html visually. Fix mismatches.
- [ ] **Step 5: Commit** — `feat(spatial): command bar, nav dock, hero/tiles + kit demo`.

**Phase 0 gate:** the full kit renders and visually matches mock 7. STOP for user preview of `/next` KitDemo (phone + desktop) before Phase 1.

---

# PHASE 1 — Surfaces (parallel Opus agents, each against the kit + seam)

Each surface task: build the component consuming `BoardRow[]`/`Projections` + `useLiveFor()` + kit components; match mock 7; implement the full feature checklist for that surface (spec Surfaces section); verify `tsc` + screenshot (desktop + phone). Each ends with a commit. These 5 can run in parallel (distinct files).

### Task 1.1: Board — `board/BoardView.tsx`
**Produces:** `<BoardView rows view prop threshold onOpenPlayer/>` with views **Cards** (tilt cards + orb), **Split** (top-3 cards + table), **Table** (orb in prob col), **Matchups** (per-game grouped; K=two-pitcher list, hitters=collapsible away|home split w/ lit opposing pitcher). Full card contents per checklist (badge, tagchip, formchip, hand+platoon, matchup, opponent, bvp, weather pills, LiveChip). Reads `heatColor`/`strengthLabel`/`gameTimeLabel`/`platoonAdvantage` from `lib/format`.
- [ ] Read mock7 `.pcard/.topr/.pmeta/.conds`, `table.board`, split/list layouts. Build all 4 views. `tsc`. Screenshot each view desktop+phone. Commit `feat(spatial): board views (cards/split/table/matchups)`.

### Task 1.2: Game Hub — `GameHub.tsx` + `BatterGrid.tsx`
**Produces:** `<GameHub games projections thresholds onOpenPlayer/>`: game cards (`<details>`, env left-border, EnvDot, park/weather/wind/temp/rain chips) → starting pitchers (line/proj, LiveChip, orb) + `<BatterGrid/>` (sortable K/C/N + HR/Hits/TB/Runs/RBI/HRR small orbs + LiveChip each, BATTERS sort, per-column thresholds, away/home split w/ independent sort, `#=batting order` legend). Preserve K/C/N dominant-vs-faint-vs-neutral logic and lean directions.
- [ ] Read mock7 `.hubcard/.bhead/.brow` + sort. Build. `tsc`. Screenshot desktop+phone (grid horizontal-scroll on narrow). Commit `feat(spatial): game hub + batter grid`.

### Task 1.3: Top Plays — `TopPlays.tsx`
**Produces:** `<TopPlays projections source threshold onThreshold onOpenPlayer/>`: 9 collapsible leaderboards (HR, Pitcher Ks, Contact, Batter Ks, Hits, TB, Runs, RBI, HRR) with show-count (10/25/50/All) + inline threshold pills on threshold props (stopPropagation); each row name/hand(platoon)/opp/matchup/clock/LiveChip/orb.
- [ ] Read mock7 `details.lb/.lrow`. Build. `tsc`. Screenshot. Commit `feat(spatial): top plays`.

### Task 1.4: Parks — `Parks.tsx`
**Produces:** `<Parks games/>` ranked env ledger (best hitting env first): matchup, park name, park/weather ±%, wind+mph, temp, EnvDot. Visually distinct from hub cards.
- [ ] Read mock7 parks section. Build. `tsc`. Screenshot. Commit `feat(spatial): parks ledger`.

### Task 1.5: Player/Pitcher modal — `PlayerModal.tsx`
**Produces:** `<PlayerModal open playerId prop date source onClose/>` URL-addressable (`?player=&prop=`, Escape/overlay/back close, refresh-safe). Batter: headline % per threshold + big orb, "His base level" (baseline + `paceText`), full per-prop `FactorBar`s (all current factor sets incl. 🔄 Platoon bar for HR/Runs/RBI/HRR and inline note for Hits/TB), conditions, pitcher lean+BvP. Pitcher: over % + proj Ks, projection-vs-line bar, opposing lineup (linked batters, hand, BvP, K/C LeanPair), conditions. Loads via `loadProjections(date)` + finds the row; source-aware via `lib/weighting` `pickN`; baseline keys via `` `baseline_p_ge${threshold}` ``.
- [ ] Read mock7 `.overlay/.modal/.mpanel/.mtop`, batterModal/pitcherModal. Build. `tsc`. Screenshot desktop+phone. Commit `feat(spatial): player/pitcher modal`.

---

# PHASE 2 — Integrate + mobile + checklist

### Task 2.1: Assemble the `/next` app shell
**Files:** finalize `web/app/next/page.tsx` (remove KitDemo).
- [ ] Wire CommandBar + Hero/tiles + NavDock + sub-controls (prop selector/threshold/view via SegmentedControl) + the active surface + modal. URL state: `?date=&prop=&threshold=&source=&player=` (read on load, write on change). Weighting via `lib/weighting`. Board rows via `toBoardRows`. `tsc` + `npx vitest run` (green) + `eslint`. Screenshot full flow desktop+phone. Commit `feat(spatial): assemble /next app shell`.

### Task 2.2: Mobile responsive pass
- [ ] Apply mock 7 breakpoints (≤880 tiles→2col + hide weighting from bar; ≤600 cards→1col, tighter bar, batter grid narrows w/ scroll, modal/stat fonts shrink, hide "LIVE" label). Verify with Playwright at 390 portrait, 844 landscape, 1280 desktop — every surface + the modal fit with no page-level horizontal overflow (wide grids scroll in-container). If a surface truly can't fit natively, document + apply the 600px fallback for THAT surface only. Commit `feat(spatial): mobile responsive pass`.

### Task 2.3: Feature-checklist audit
- [ ] Dispatch a fresh Opus reviewer agent: given the spec's Surfaces checklist + the original app audit, verify EVERY feature exists on `/next` (all 7 props, thresholds, baseline/pace, platoon (bar + note), live chips 4 states, batting-order chips, game-hub sort + column thresholds, weighting blend, matchups split, top-plays categories + counts, parks ledger, deep-linkable modal, hand/platoon chips distinct). Fix gaps. Commit fixes.

**Phase 2 gate:** STOP for user preview of full `/next` on phone + desktop; iterate until approved.

---

# PHASE 3 — Promote + archive

### Task 3.1: Promote `/next` → root
- [ ] Move the spatial shell to `app/page.tsx` (replace current), route the modal at root (keep `?player=` deep-link). Move `web/app/next/layout.tsx`'s `device-width` viewport into the root `app/layout.tsx` (replace the phone-600 `generateViewport` + orientation script IF native mobile fully replaces it; else keep). Remove the `/next` route (or leave as alias). `tsc` + full test suite + eslint green. Commit `feat(spatial): promote Spatial Depth skin to root`.

### Task 3.2: Archive old skin + mocks
- [ ] Tag pre-promotion commit `git tag skin-ballpark-lights`. Move old components (`PropBoard.tsx`, `ParksBoard.tsx`, `TopPlays.tsx`, `ViewSwitcher.tsx`, old `app/player/[prop]/[id]/page.tsx`, the "Ballpark Lights" parts of `globals.css`, unused `Marks`/`Icons`) and `.superpowers/design-library` + `.superpowers/mock` into `web/archive/` (or delete — they're recoverable via the tag). Keep engine libs + live/auth. Ensure nothing still-used was moved (`tsc` + tests + build). Commit `chore(spatial): archive Ballpark Lights skin + mocks`.

### Task 3.3: Deploy + verify on production
- [ ] Merge `feat/mock7-reskin` → main; trigger `board-refresh.yml -f force_deploy=true`; confirm Vercel deploy success; verify prod on desktop + phone (both orientations); confirm live chips, deep-links, auth, all surfaces work with real board data. Update memory + roadmap.

---

## Self-Review

**Spec coverage:** engine-preserve (Global Constraints + Task 0.1/0.2 reuse) ✓ · design kit tokens/fonts/orb/glass/seg/chips/factorbar/dots/livechip/nav/cmd/hero (Tasks 0.3–0.8) ✓ · Board 4 views (1.1) ✓ · Game Hub + grid (1.2) ✓ · Top Plays (1.3) ✓ · Parks (1.4) ✓ · player+pitcher modal URL-addressable (1.5) ✓ · weighting source-aware (0.1, used throughout) ✓ · live chips (0.7 + surfaces via useLiveFor) ✓ · mobile native + breakpoints + fallback (2.2) ✓ · feature checklist (2.3) ✓ · /next preview + promote + archive (0.2, 3.1, 3.2) ✓ · testing (per-task tsc/vitest/screenshot; engine tests unchanged) ✓.

**Placeholder scan:** visual tasks point to mock7.html (a complete in-repo reference) + the audit for exact values — concrete, not "TBD". Pure-logic/scaffold tasks show real code. No "implement later".

**Type consistency:** `Source`/`pickN`/`toBoardRows` (0.1) reused by 0.2/1.x/2.1; `BoardRow` imported from `components/PropBoard` (unchanged); `PropKind` from `lib/format`; `orbParams` (0.4) consumed by `ProbabilityOrb` and surfaces; `useLiveFor` from existing `LiveProvider`; `LiveState` re-exported by `LiveChipSpatial`.

**Scope note:** large but cohesive; Phase 0 is the sequential dependency, Phases 1.1–1.5 parallelize, Phases 2–3 sequential. Each phase produces a previewable `/next`. If Phase 1 proves too heavy for one pass, each surface task already stands alone.
