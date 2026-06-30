# Batting Order in Proj/Conf Status Chips — Design

**Date:** 2026-06-30
**Type:** Display-only (no math / no probability changes). Backend feed add + frontend.
**Status:** Approved in brainstorm; pending spec review.

## Goal

Every **individual batter** projected/confirmed status chip becomes `CONF·#3` / `PROJ·#1`
— the chip's color already means projected-vs-confirmed, and dropping the batting-order
number (1–9) right into it makes that number inherit the same proj/conf meaning for free.
One chip, two meanings: *lineup status* AND *batting order*, both proj/conf at once.

Plus, in the Game Hub, add a **"Batters" sort button** (matching the existing per-prop
sort buttons) so batters can be ordered 1→9, with a small `# = batting order` legend.

**Guarantee: display-only, purely additive.** No probability changes, nothing removed.

## Why the number is automatically proj/conf

Each batter row is built by iterating that game's lineup with `enumerate(...)`, so the
slot index IS the batting-order position. That lineup is the **confirmed** order when
posted, the **projected** order otherwise — the exact same source that drives the chip's
proj/conf color. So `bat_order` needs no separate proj/conf logic; it rides the chip's.

## Scope — where the number appears

The number rides **every individual-batter status chip**. Those chips are produced by
three render paths, which together cover every screen the user named (cards · table ·
top plays · game hub · matchup):

| Render path | File:line | Screens it feeds |
|---|---|---|
| `Card` | `web/components/PropBoard.tsx:155` | Card view **and** ★ Top Plays top-3 cards |
| `Table` | `web/components/PropBoard.tsx:236` | Table view **and** Top Plays "Full board" |
| `ColBatterRow` | `web/components/PropBoard.tsx:627` | Game Hub matchup breakdown (per-batter) |

**Explicitly NOT numbered** (no single batting order exists for them — unchanged):
- `PropBoard.tsx:334` — list/game **header** chip (aggregates a whole game, `mode="pair"`)
- `PropBoard.tsx:471` — Game Hub **team** header chip (aggregates a team, `mode="pair"`)
- `PropBoard.tsx:841` — **pitcher** chip (pitchers don't bat)
- `BoardRowLine` (`PropBoard.tsx:374`) has no status chip today → out of scope (the
  feature augments existing chips; it does not add new ones).

## Format

`CONF·#3` / `PROJ·#1` — the existing uppercase chip text, then a tight `·#N` (no spaces
around the dot, per user: keep it compact). When `bat_order` is missing/undefined, the
chip renders exactly as today (`CONF` / `PROJ`) — safe fallback.

## The four pieces

### 1. Backend — emit `bat_order` on every batter row (no math)

In `model/pipeline.py`, every batter-row builder already loops the lineup with a slot
index (`for slot, b in enumerate(lineups.get(side, []))` in HR/threshold builders; the
run-prop builder has its own `enumerate(order)`). Emit the 1-based position onto each row:

- HR rows (`build_hr_rows`): add `"bat_order": slot + 1`.
- Hits/TB rows (`_threshold_rows`): add `"bat_order": slot + 1`.
- Runs/RBI/HRR rows (`_run_prop_rows`): add `"bat_order": pos` (the existing 1-based
  `pos = i + 1`).

`bat_order` is the same value for a given batter across all props (it's their lineup
slot), so emitting it on every prop's row is consistent. The recorder/grader are
untouched (this is a display field; not a factor/dial).

### 2. Frontend types

- `web/lib/types.ts`: add `bat_order?: number` to `HrRow`, `HitsRow` (inherited by
  `TbRow`), `RunsRow` (inherited by `RbiRow`), `HrrRow`.
- The Game Hub's `BoardRow` (in `PropBoard.tsx`) gains `bat_order?: number`, populated
  from the source row when the board is assembled (same place `status` is set).

### 3. StatusChip — optional order

`web/components/StatusChip.tsx`: add an optional prop `order?: number`. When `order` is a
number AND the chip is in `single` mode (individual batter), append `·#${order}` to the
chip text. `pair` mode ignores `order` (aggregated chips never get a number). No `order`
passed → identical to today.

Then pass `order={...bat_order}` at the three individual-batter call sites (155, 236, 627).
The aggregated/pitcher sites pass nothing → unchanged.

### 4. Game Hub — "Batters" sort button + legend

In the Game Hub columns view (`ColTeam`, ~`PropBoard.tsx:642-707`), the header row already
renders clickable sort buttons per prop (K/C/N, HR, Hits, …). Add a **"Batters"** header
button on that same line, over the batter-name column. Clicking it sorts the batters by
`bat_order` ascending (1→9); clicking again reverses (existing toggle behavior). Batters
with no `bat_order` sort last. Default sort is unchanged (still by HR prob) — the order
button is opt-in, exactly like the prop sort buttons.

Add a small one-line legend near the Game Hub: `# = batting order`.

## Out of scope (YAGNI)

- No auto-sort by batting order (user chose: keep standard order; sorting is opt-in via
  the button only).
- No new chips added anywhere a chip doesn't already exist (e.g. `BoardRowLine`, player page).
- No math/probability/recorder/grader changes.
- No restyle of the chip beyond appending `·#N`.

## Testing

- **Backend:** unit-test that each batter-row builder emits `bat_order` equal to the
  1-based lineup position (e.g. the 3rd batter in the posted order has `bat_order == 3`),
  across HR / hits / TB / runs / RBI / HRR. Existing probability tests stay green/unchanged.
- **Frontend:** `StatusChip` renders `CONF·#3` when given `status="confirmed" order={3}`;
  renders plain `CONF` when `order` is undefined; `pair` mode ignores `order`. Vitest +
  `tsc` + eslint clean.
- **Manual:** localhost preview — confirm the number shows on card/table/top-plays/game-hub
  batter chips, stays absent on game/team/pitcher chips, the Game Hub "Batters" button
  sorts 1→9, and the legend reads `# = batting order`. Then preview-before-prod.

## Rollout

Branch → full suites green → localhost preview → explicit approval → merge + deploy
(board-refresh; the new `bat_order` field reaches the live board on the next fresh slate,
same freeze behavior as any board field). Mirror in the chosen design mock per the UI rule.
