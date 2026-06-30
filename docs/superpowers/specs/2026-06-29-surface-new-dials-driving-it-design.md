# Surface New Dials in "What's Driving It" — Design

**Date:** 2026-06-29
**Type:** Display-only (no math / no probability changes). UI + feed plumbing.
**Status:** Approved in brainstorm; pending spec review.

## Goal

The 8 math upgrades shipped over the last weeks now move the probabilities, but
several of the biggest movers are **invisible** in the player-page "what's
driving it" breakdown. This change surfaces them as their own factor rows so the
breakdown honestly reflects what's actually driving each prop's number.

**Hard guarantee: nothing is removed and no probability changes.** This is
purely additive display. Every existing row stays. We only add new line-items
(and split one existing row into its components). The probabilities the board
already shows are correct and already include all these factors — we are only
making the *itemization* match the math.

## Background — why the values aren't shown yet

Data lives in three places, and only one has a gap:

1. **The math / probabilities** — already include lineup, spray, BvP-hits,
   production-form. ✅ Live on production.
2. **The recorder (grading archive)** — already captures every dial. ✅
3. **The website board feed (JSON the cards read)** — carries the final % plus
   *some* individual factor numbers, but NOT lineup / spray / BvP-hits as their
   own values, and NOT the hard-hit/production components for HR & Hits. ⚠️

So each new row is two small pieces of work: (1) emit the factor's value into
the web feed, (2) draw the row on the card. No math is touched.

## Rows after the change (new rows in **bold**)

| Prop | Rows (top → bottom) |
|---|---|
| **HR** | 🏟️ Park · 🌬️ Weather · **🎯 Spray** · **💥 Hard-hit** · **📈 Production** · 🔥 Recent · ⚾ Pitcher · 📜 History (HR) |
| **Hits** | **💥 Hard-hit · 📈 Production · 🔥 Recent** · ⚾ Pitcher · **📜 History (hits)** |
| **Total Bases** | **🎯 Spray** · **💥 Hard-hit · 📈 Production · 🔥 Recent** · ⚾ Pitcher · 🌦️ Park & weather · **📜 History (hits)** |
| **Runs** | **📋 Lineup** · 💥 Hard-hit · 📈 Production · 🔥 Recent · ⚾ Pitcher · 🏟️ Park |
| **RBI** | **📋 Lineup** · 💥 Hard-hit · 📈 Production · 🔥 Recent · ⚾ Pitcher · 🏟️ Park |
| **HRR** | **📋 Lineup** · 💥 Hard-hit · 📈 Production · 🔥 Recent · ⚾ Pitcher · 🏟️ Park |
| Strikeouts | *(unchanged — no new dials touch it)* |

## The four additions

### 1. Spray row (HR, TB) — split out of weather, no double-count

The corner-wind upgrade made the **weather multiplier itself spray-aware** (it
already accounts for which way the batter hits). So the spray effect is *already
inside* today's Weather number. To show it as its own row without double-counting:

- **Weather row** displays the **neutral** wind effect (wind/temp for an
  average-spray hitter).
- **Spray row** displays **directional ÷ neutral** — how this batter's pull
  tendency amplifies or dampens that wind effect.
- **Invariant:** `weather_display × spray = today's full directional weather`.
  The product is unchanged; we only show it as two rows.

Backend emits two new per-row values for HR and TB:
- `weather_neutral_mult` — wind/temp effect with league-average (or center) spray.
- `spray_mult` — `directional_weather_mult / weather_neutral_mult`.

Frontend:
- **HR:** Weather row reads `weather_neutral_mult` (was `weather_mult`); new
  Spray row reads `spray_mult`.
- **TB:** TB bundles park+weather into `park_weather_factor`. The Spray row reads
  `spray_mult`; the "Park & weather" row displays `park_weather_factor / spray_mult`
  so the two rows still multiply back to the original `park_weather_factor`.
- Spray row note names the tendency, e.g. *"Pulls to RF (46%) · wind out that way → helps"*.
- Hide the Spray row when `spray_mult` rounds to 0% (neutral), to avoid clutter.

The underlying probability keeps using the full directional weather it already
uses — only the *displayed split* is introduced.

### 2. Three-way form split (HR, Hits) — match Runs/RBI/HRR

Runs/RBI/HRR already show 💥 Hard-hit / 📈 Production / 🔥 Recent. HR and Hits
currently show only the blended 🔥 Recent form. The production-form upgrade
already blends a hard-hit signal and a production signal into that recent number
(HR 80/20, Hits 60/40). We surface the two components:

- Backend emits `hard_hit_form` and `production_form` on **HR** and **Hits** rows
  (TB already carries them; Runs/RBI/HRR already carry them).
- Frontend shows the same three rows used on Runs/RBI/HRR: Hard-hit (component),
  Production (component), Recent (the existing blended `recent_form_mult`, kept as-is).
- The blended Recent row is **not removed** — the components sit above it, same as
  the existing Runs/RBI/HRR layout.

### 3. Lineup row (Runs, RBI, HRR)

Approach C's `lineup_mult` already nudges these three props. Surface it:

- Backend emits `lineup_mult` (and `lineup_slot` / `lineup_teammate` for the note)
  on Runs/RBI/HRR rows.
- Frontend adds a 📋 Lineup row reading `lineup_mult`, with a plain note naming the
  driver: *"strong hitters behind him"* (Runs) / *"good on-base bats ahead"* (RBI) /
  combined for HRR.
- Show only when `lineup_status` exists (confirmed or projected lineup available);
  fall back to hiding the row when there's no lineup context.

### 4. History-vs-pitcher (hits) row (Hits, TB)

HR already shows 📜 History using `bvp_mult`. The BvP-hits dial added the
analogous `bvp_hit_mult` for Hits/TB. Surface it:

- Backend emits `bvp_hit_mult` (+ the head-to-head sample `hits`/`pa`) on
  Hits/TB rows.
- Frontend adds a 📜 History · vs {pitcher} row reading `bvp_hit_mult`, shown
  **only when there's real head-to-head history** (`pa > 0`) — same gating rule
  HR's History row already uses.

## Architecture / where the work lands

**Backend (feed plumbing) — emit values into the web board JSON:**
- `model/export_web.py` / `model/pipeline.py` (whichever assembles the per-row
  web payload) — add the new per-row fields listed above. Values already exist in
  the row computation; this exposes them. The recorder (`archive.py`) already
  records them and is untouched.
- The spray split (`weather_neutral_mult`, `spray_mult`) is the only piece that
  computes a *new displayed* number — and it's a pure decomposition of an existing
  multiplier, not a new model term.

**Frontend (cards) — draw the rows:**
- `web/app/player/[prop]/[id]/page.tsx` — reuse the existing `Factor` component
  (icon, label, delta %, impact bar, note) so new rows match automatically.
- `web/lib/types.ts` (or equivalent) — add the new optional fields to the row types.

## Out of scope (explicit YAGNI)

- **No math / probability changes.** Sign-off rule untouched.
- **Strikeouts card** unchanged.
- **Game Hub batting-order sort** is a *separate* roadmap item (also needs
  `lineup_slot` in the feed, so it pairs naturally) — handled in its own spec.
- No redesign of the `Factor` component, colors, or layout; reuse as-is.

## Testing

- **Backend:** unit-test that the web export now includes the new fields on the
  right prop rows, and assert the spray-split invariant:
  `weather_neutral_mult × spray_mult ≈ directional weather_mult` (and the TB
  `park_weather_factor / spray_mult × spray_mult` round-trips). Existing
  probability tests must remain green and unchanged (proof nothing moved).
- **Frontend:** render each prop card with a fixture row containing the new fields;
  assert the new rows appear with correct labels and that gating works (Spray
  hidden when neutral; History-hits hidden when `pa == 0`; Lineup hidden when no
  lineup context).
- **Manual:** localhost preview, eyeball each of HR/Hits/TB/Runs/RBI/HRR, confirm
  the displayed rows multiply visually to the same total %, then preview-before-prod.

## Rollout

Build on a branch, verify full test suite green, show localhost preview, get
explicit approval, then merge + deploy (board-refresh) per the standard flow.
Mirror the new rows in the chosen design mock per the standing UI rule.
