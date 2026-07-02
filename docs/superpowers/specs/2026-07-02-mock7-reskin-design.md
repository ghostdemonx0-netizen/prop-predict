# Prop Predict — Mock 7 "Spatial Depth" Reskin — Design

**Date:** 2026-07-02
**Type:** Full visual reskin of the live site to the mock 7 "Spatial Depth" design. Engine (data/math/live/auth) unchanged.
**Status:** Approved in brainstorm; pending spec review.

## Goal

Move the entire site — desktop AND mobile — from the current "Ballpark Lights" skin to **mock 7 "Spatial Depth"** (the Opus-designed favorite in `.superpowers/design-library/mock7.html`), carrying over **every** feature we've built. Build it on a hidden `/next` route so the live site is untouched during development; promote to root and archive the old skin + the 10 mocks once approved on phone + desktop.

**This is a pure re-skin.** No math, data, probability, live-tracker, auth, or board-pipeline changes. Only presentational components are rebuilt.

## Locked decisions

- **Preview/rollout:** build on hidden `/next` route (Clerk-gated like everything else); test on phone + desktop; when approved, promote `/next` → `/` and archive the old skin + mocks.
- **Player/pitcher detail:** pop-up **modal** (mock 7 style), BUT URL-addressable (query param, e.g. `?player=<id>&prop=<kind>`) so deep-links + refresh + shareable links still work.
- **Mobile:** **fit natively** (responsive from the start, mock 7's own breakpoints) — drop the 600px viewport zoom-hack for `/next` (use `width=device-width`). Keep the 600px hack in reserve only if a specific surface genuinely can't fit. Mobile rules must NOT alter mock 7's desktop layout.
- **Model:** build (incl. all spawned agents) uses Opus, matching mock 7's origin.

## What is PRESERVED and reused unchanged (the engine)

The new skin imports these as-is — never reimplement:
- **Board loading:** `lib/data.ts` (`loadIndex`, `loadProjections`), the `/data/*.json` files + URL scheme (gitignored, robot-delivered).
- **Types:** `lib/types.ts` (`Projections`, `HrRow`/`KRow`/`HitsRow`/`TbRow`/`RunsRow`/`RbiRow`/`HrrRow`, `Matchup`, `Game`) incl. all fields — `_hist` twins, `baseline_p_ge*`, `platoon_mult`, `bat_order`, factor multipliers.
- **Weighting toggle math:** the source-aware selection (`pickN`/`leanFor` in page.tsx; `pick<T>` on the player page) — Current/Blend/History. Every rendered number flows through it. Extract into a shared `lib/weighting.ts` so both the board and the modal reuse identical logic.
- **BoardRow seam:** the presentational row shape + the `page.tsx` mapping that fills it from each prop array (apply weighting + threshold, sort by displayed prob). The new skin consumes `BoardRow[]`.
- **Live system:** `app/api/live/route.ts` (public cached endpoint), `components/LiveProvider.tsx` (`LiveProvider`, `useLiveFor`), `lib/live.ts`. Wrap the board in `<LiveProvider>`, call `useLiveFor()`.
- **Helpers:** `lib/format.ts` (`PropKind`, `pct`, `strengthTier/Label`, `heatColor`, `windText`, `arrowColor`, `gameTimeLabel`, `platoonAdvantage`), `lib/pace.ts` (`paceText`), `lib/platoon.ts` (`platoonEdge`).
- **Auth:** `proxy.ts` Clerk gate (add nothing public; `/next` stays gated), `<ClerkProvider>` + `<UserButton/>`, sign-in route.
- **App shell:** `layout.tsx` ClerkProvider + font-var strategy (ADD mock 7's 3 fonts alongside existing). `/next` may use `width=device-width` (native mobile); the current `/` keeps its `generateViewport`/orientation script until promotion.
- **Deploy/tests:** board-refresh workflow, `web/` project root, existing vitest suites (format/live/derive/pace/platoon/window/statuschip) all stay green.

## Design system — the kit (`web/components/spatial/`)

Port mock 7's design tokens verbatim (HSL CSS custom properties) into `spatial.css` (or a scoped stylesheet). Fonts via `next/font`: **Bricolage Grotesque** (display), **Familjen Grotesk** (body), **Spline Sans Mono** (mono/labels). Rule: display = tight negative tracking for headings; mono = wide positive tracking + uppercase for every label/data element.

**Foundation components:**
- **Depth background** — the 5 fixed layers (`.field`, `.field2`, `.spot`, `.mesh`, `.grain`) with the iridescent radial glows, masked mesh, grain; parallax on the two glow layers (pointer-eased, touch-excluded).
- **`<GlassCard>`** — the `.float` primitive: gradient glass fill, `--line-2` border, ambient+contact shadow + inset top highlight, `backdrop-filter: blur(20) saturate(1.3)`, top-edge gloss `::after`.
- **`<ProbabilityOrb size prob kind>`** — the signature depth-halo orb. Port the exact math: hue `255 − t·112` (indigo→cyan→mint), sat/lightness/blur/halo/glow/elevation all scale with heat `t` (from `heatColor`/tier logic), SVG progress ring encodes raw %, cast shadow + specular highlight + inset volume. Replaces every current flat sphere.
- **`<GlassDot>`** variants — `catDot` (K/C/N fixed hues), `envDot` (park+weather signed %), `leanCell`/`leanPair` (matchup lean dominant+caption / K+C pair with lean tag). Port from `glassDot()`.
- **`<SegmentedControl>`** — sliding-pill toggle (measured indicator via ref + `useLayoutEffect`, spring easing). Variants: default (cyan→violet), ghost, sm. Used for weighting, view switch, thresholds, prop selector (horizontal-scroll strip).
- **`<NavDock>`** — centered floating pill-nav (Board/Game Hub/Top Plays/Parks) with sliding glow behind active tab.
- **`<CommandBar>`** — sticky header: logo mark (gradient orbital ring + bolt, glow filter), iristext wordmark + mono sublabel, live pill (pulsing dot), weighting control (desktop), account avatar (`<UserButton/>`).
- **Chips:** `<Badge>` (strong/lean/pass verdict), `<TagChip>` (conf/proj + batting-order suffix like `CONF·#3`), `<HandChip>` (R/L/SW, `.adv` cyan glow for platoon advantage — must stay visually distinct from green conf), `<FormChip>` (hot/cold/steady), `<FBox>` (condition/stat pill: icon+value+label), `<Bvp>` (career mini-chip).
- **`<FactorBar>`** — the "what's driving it" center-anchored deviation meter: track + center midline + left(red)/right(green) fill + glowing end node + `<Delta>` chip + note. Also the pitcher "projection vs line" bar.
- **`<LiveChip>`** — restyle the 4-state chip (pregame grey / live amber+dot / cleared green / missed red, `have/need` unclamped, `sm` variant) into the glass look; keep it fed by `useLiveFor`.
- **Hooks:** `useTilt` (pointer → `--rx/--ry/--mx/--my`, touch early-return), `useParallax` (glow layers), both no-op on touch/reduced-motion.
- **`<HeroTiles>`** — hero headline + date picker + 4 KPI tiles (Slate / Plays scored / Lineups / Model version).

## Surfaces (each consumes the seam + kit; full feature checklist)

Each surface is a component fed `BoardRow[]`/`Projections` + `useLiveFor()`; nothing about the data changes.

1. **Prop Board** — views: **Cards** (tilt cards w/ orb), **Split** (=current Hybrid: top-3 cards + rest as table), **Table** (orb in prob column), **Matchups** (per-game grouped; K = two-pitcher list, hitters = collapsible away|home split with lit opposing pitcher). Prop selector (7 props) + threshold controls. Every current card element: verdict badge, status chip (conf/proj+order), form chip, hand chip (platoon-lit), matchup text, opponent+hand, BvP chip, weather/condition pills, LiveChip.
2. **Game Hub** — game cards (`<details>`, left border colored by env, EnvSphere, park/weather/wind/temp/rain chips) → breakdown: **Starting pitchers** (line/proj, LiveChip, orb) + **batter breakdown grid** (sortable: K/C/N · HR · Hits · TB · Runs · RBI · HRR, one small orb per column + LiveChip under each), BATTERS sort button, per-column threshold pickers, away/home split with independent sort, `#=batting order` legend.
3. **Top Plays** — 9 collapsible leaderboards (HR, Pitcher Ks, Contact, Batter Ks, Hits, TB, Runs, RBI, HRR) with show-count (10/25/50/All) + inline threshold pillbars on the threshold props; each row: name, platoon-lit hand, opponent+hand, matchup, clock, LiveChip, orb.
4. **Parks** — ranked ledger (best hitting environment first): matchup, park name, park/weather ±%, wind+mph, temp, EnvSphere. Visually distinct from hub cards.
5. **Player/Pitcher modal** — pop-up, URL-addressable (`?player=&prop=` deep-link + refresh + Escape/back/overlay-close). **Batter:** headline % per threshold + big orb, "His base level" panel (baseline chance + season pace), full "what's driving it" **FactorBars** per prop (all current per-prop factor sets incl. 🔄 Platoon as bar for HR/Runs/RBI/HRR and as inline note for Hits/TB), conditions, pitcher-matchup lean + BvP. **Pitcher:** over-line % + proj Ks, projection-vs-line bar, opposing lineup (each batter linked, hand chip, BvP, K/C lean pair), conditions.
6. **Chrome** — CommandBar + hero/tiles + NavDock + weighting toggle + date picker; URL state (`?date=&prop=&threshold=&source=&player=`).

## Mobile (native responsive)

Follow mock 7's breakpoints: `≤880px` (tiles→2col, weighting hidden from bar), `≤600px` (card grid→1col, tighter bar, batter grid narrows w/ horizontal scroll, modal/stat fonts shrink, "LIVE" label hidden). Wide tables/grids use in-container horizontal scroll on narrow (never expand the page). `/next` uses `width=device-width` — no zoom-hack. Verify both orientations. If any surface genuinely can't fit natively, fall back to the 600px approach for that surface only (documented, not default).

## Rollout

1. Build design kit → verify in isolation.
2. Build surfaces (parallel Opus agents) on `/next` → wire to seam + LiveProvider + auth.
3. Full feature-checklist pass + mobile pass; user previews `/next` on phone + desktop; iterate.
4. **Promote:** make the spatial page the root (`app/page.tsx`), route the modal, keep `/next` as an alias or remove. Update `layout.tsx` viewport strategy if native mobile replaces the hack.
5. **Archive:** move old skin components (`PropBoard`, `ParksBoard`, `TopPlays`, `ViewSwitcher`, old player page render, old `globals.css` theme) + `.superpowers/design-library` + `.superpowers/mock` mocks into an `archive/` location (or delete after tagging). Tag the pre-promotion commit.

## Testing

- Engine tests unchanged and green (format/live/derive/pace/platoon/window/statuschip).
- Design-kit pure logic (orb color/heat math, segmented indicator math) gets unit tests where it's a pure function.
- Each surface verified via Playwright screenshots at **desktop (~1280)** and **phone (~390 portrait + ~844 landscape)** widths on `/next`.
- `tsc --noEmit` + eslint clean.
- User preview-and-approve on `/next` (phone + desktop) before promotion. No probability/board-data changes to verify (engine untouched).

## Out of scope (YAGNI)

- No engine/math/data/live/auth logic changes. No new props or features — transfer only.
- No odds/betting-line integration (mock 7 omits it; site is "data not picks").
- The unused `Marks`/`Icons` variants can be dropped; no new logo work.
- Accounts/roles/admin (separate roadmap phase) untouched.
