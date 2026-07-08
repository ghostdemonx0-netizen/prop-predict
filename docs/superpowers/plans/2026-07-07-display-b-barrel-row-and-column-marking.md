# Display B — "🛢️ Barrel" driving-it row + active/context column marking

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Make the Barrel Effect *visible* — a "🛢️ Barrel" row in each player card's "what's driving it" (shown when the toggle is ON), and mark board columns as active (feed the math) vs context (read-only).

**Architecture:** Pure frontend (`web/`). The card already receives `barrel_mult` on the row; the board already has a `highlight` styling hook. Two focused tasks: (1) add the card row, (2) add a `context` column flag + muted styling + a legend, and correct ISO (currently mis-marked active) to context.

**Tech Stack:** Next.js/React/TypeScript, vitest.

## Global Constraints
- Pure UI — NO backend/model changes, no math, no sign-off. Additive.
- `barrel_mult` is a multiplier (1.08 = +8%); `FactorBar` already renders a `mult` as ±%.
- Verify each task: `npx tsc --noEmit` clean + `npm run lint` (no NEW errors in touched files; `page.tsx:228` is a pre-existing baseline). Run vitest if a `.test.ts` is touched. Do NOT run `npm run dev`.
- Context (read-only VIEWER) columns = `iso`, `xwoba` (full xwOBA), `hrfb` (HR/FB%), `la` (launch angle) on hitters; `ball` (Ball%) + `xwoba` on pitchers. Everything else is active.

---

### Task 1: "🛢️ Barrel" row on player cards (shown when toggle ON)

**Files:** Modify `web/components/spatial/PlayerModal.tsx`; add a `BarrelIcon` (in the icons module the other FactorBar icons come from — find it via the `ParkIcon`/`WindIcon` import in PlayerModal.tsx); thread `barrelEffect` from `web/app/page.tsx` if the modal doesn't already receive it.

- [ ] **Step 1: Add a `BarrelIcon`** matching the style/signature of the existing factor icons (`ParkIcon`, `WindIcon`, `SprayIcon` — same `size` prop, same stroke style). A simple barrel/drum glyph. Export it from wherever those icons live.

- [ ] **Step 2: Make the card know if the toggle is ON.** In `web/app/page.tsx`, where `<PlayerModal .../>` is rendered, pass the existing `barrelEffect` boolean as a prop (e.g. `barrelEffect={barrelEffect}`). In `PlayerModal.tsx`, accept it and thread it into the per-prop factor components (`HrFactors`, `HitsFactors`, `TbFactors`, `LineupFactors` — add a `barrelEffect: boolean` prop to each, passed where they're invoked ~lines 645+).

- [ ] **Step 3: Render the Barrel row in each factor component.** In EACH of `HrFactors`, `HitsFactors`, `TbFactors`, `LineupFactors`, add (after the Recent-form / near the barrel-relevant rows):
```tsx
{barrelEffect && typeof r.barrel_mult === "number" && (
  <FactorBar icon={<BarrelIcon size={FI} />} label="🛢️ Barrel" mult={r.barrel_mult}
             note="barrel matchup vs this pitcher" />
)}
```
Only renders when the toggle is ON (so it always matches the displayed number) and `barrel_mult` exists.

- [ ] **Step 4: Verify.** `npx tsc --noEmit` clean; `npm run lint` no new errors in touched files. Confirm (by reading) the row is gated on `barrelEffect` in all four factor components.

- [ ] **Step 5: Commit.**
```bash
git add web/components/spatial/PlayerModal.tsx web/app/page.tsx <icons file>
git commit -m "feat(display-b): 🛢️ Barrel driving-it row on player cards (shown when Barrel Effect is ON)"
```

---

### Task 2: Active/context column marking on the boards

**Files:** Modify `web/lib/barrelColumns.ts`, `web/components/spatial/boards/BoardsView.tsx`, and the board CSS (`web/**/spatial.css` or wherever `.sp-boardstable` lives).

- [ ] **Step 1: Add a `context` flag to `ColumnDef`.** In `web/lib/barrelColumns.ts`, add `context?: boolean;` to the `ColumnDef` interface (comment: "read-only viewer — shown but does NOT feed the math").

- [ ] **Step 2: Mark the viewer columns + correct ISO.** Set `context: true` on the read-only columns wherever they appear across the column sets: hitter `iso`, `xwoba`, `hrfb`, `la`; pitcher `ball`, `xwoba`. IMPORTANT: `iso` currently carries `highlight: true` (wrongly marking it an active barrel voter) — REMOVE `highlight` from `iso` (and from `xwoba`/`la`/`hrfb` if present) and give them `context: true` instead. Leave the genuine barrel voters (`brl`, `pbrl`, `sweet`, `zonefit`, `xwobacon`, `fb`) with their `highlight` as-is.

- [ ] **Step 3: Render context columns muted.** In `BoardsView.tsx`'s `HeatTable`, for a column with `c.context`, apply a clearly "read-only" style: dim the header + cell (e.g. lower opacity ~0.55) and italicize the header label; a context column must NOT get the active cyan color/outline even if some other flag is set. (Context styling takes precedence over `highlight`.) Keep the heat coloring but muted.

- [ ] **Step 4: Add a legend.** Below the board table (in `BoardsView.tsx`, once per board or once per view), render a small legend: `● moves your number · ○ context (reading only)` — the ● in the active style, the ○ in the muted/italic context style, so it reads as a key. Keep it subtle (small, muted text).

- [ ] **Step 5: Verify.** `npx tsc --noEmit` clean; `npm run lint` no new errors in touched files. Read back to confirm: the context columns (iso/xwoba/hrfb/la/ball) render muted+italic, are NOT cyan-emphasized, and the legend is present.

- [ ] **Step 6: Commit.**
```bash
git add web/lib/barrelColumns.ts web/components/spatial/boards/BoardsView.tsx web/**/spatial.css
git commit -m "feat(display-b): mark board columns active vs context (ISO/xwOBA/HR-FB/LA/Ball read-only) + legend"
```

---

## Self-Review
**Coverage:** card barrel row gated on toggle across all 4 factor components (Task 1); context flag + muted styling + legend + ISO correction (Task 2). Pure UI, additive, no math. ✅
**Placeholder scan:** none — exact columns, exact flag, exact render intent.
**Consistency:** context set (iso/xwoba/hrfb/la/ball) identical in barrelColumns.ts and the render logic; `barrel_mult` read the same way FactorBar reads other mults.
**Deferred:** none for this scope.
