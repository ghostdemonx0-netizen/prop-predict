# Projected Lineups + Proj/Confirmed Chips — Design Spec (2026-06-17)

## Goal

The board is **populated all day** instead of empty until official lineups post: when a team's official lineup isn't up yet, project it from their most recent completed game, and show a **status chip** — yellow **PROJ** (projected / probable) that flips to green **CONF** (confirmed) the moment official data locks it in. Free, uses only data we already pull. Directly fixes the user's "I see nothing until lineups come out" complaint.

## User decisions (2026-06-17)

| Decision | Choice |
|---|---|
| Hitter projected-lineup source | **Predict ourselves (free):** team's most-recent completed-game batting order, until official posts |
| Pitcher "confirmed" trigger (Choice A) | **A1** — an announced starter reads **probable/yellow** until the official lineup card locks it → then **confirmed/green** (truest to reality; scratches happen) |
| Chip wording (Choice B) | **PROJ** (yellow glow) / **CONF** (green glow) |
| Build timing | Whole feature (pitchers + hitters) ships together now |

## Status model

Every projection carries a confirmation status the UI renders as a chip:

- **Hitters (a lineup side):** `projected` → `confirmed`.
  - **confirmed** when `get_lineups(today_game)[side]` returns a non-empty battingOrder for that side (official lineup posted), OR the game has started.
  - **projected** otherwise — rows built from that team's most-recent completed-game batting order.
- **Pitchers:** `probable` → `confirmed`.
  - **confirmed** when that pitcher's own team's official lineup is posted (the lineup card includes the starter), OR the game has started.
  - **probable** otherwise (even if announced days ahead — Choice A1).
- Started/frozen games are `confirmed` by definition (the existing freeze already locks them pre-recompute).

## Projected-lineup data (engine)

New fetch helper, e.g. `fetch.get_recent_lineup(team_id, before_date)`:
- Walk the schedule backward from `before_date` up to **7 days**, find that team's most recent **completed** game, return its batting-order MLBAM ids for that team's side.
- None found within the window → no projection (that side stays empty, today's behavior).
- Cacheable per `(team, date)` for the run; only invoked when the official lineup for that side is absent.

Integration in `model/export_web.py` lineup resolution (`make_profile_fns` / `lineups_fn`):
- For each game side: if official `get_lineups` battingOrder is **non-empty** → use it, status `confirmed`.
- Else → use the projected lineup (recent-game order), status `projected`.
- Profiles are built from whichever id list results (projected players' stats are already cached the same way).

## Engine row tagging (`model/pipeline.py`)

- `build_hr_rows`: each HR row gains `lineup_status: "projected"|"confirmed"` (the batter's side) and the `vs` dict gains `pitcher_status: "probable"|"confirmed"`.
- `build_strikeout_rows`: each K row gains `pitcher_status` (the starter himself); each `matchups` entry gains `lineup_status` (the opposing lineup it's drawn from).
- `build_games`: each game gains the two sides' `lineup_status` and the two pitchers' `pitcher_status` (enough for the Game Hub header chips).
- The status is passed in from the lineup/pitcher resolution; pipeline stays pure (statuses arrive via the injected fns / slate, like weather does).

## Frontend (web/)

**Types (`web/lib/types.ts`):** add `lineup_status?` / `pitcher_status?` to `HrRow`, `KRow`, `Matchup`, `Game` as the data above dictates.

**A `StatusChip` component** (in PropBoard or a small shared file), reusing the `.hand` chip family:
- `PROJ` → yellow glow (`var(--amber)` family); `CONF` → green glow (`var(--green)` family — same treatment as the platoon chip).
- Two render modes:
  - **single** (Cards): one chip showing the row's own status (hitter card → lineup_status; pitcher card → pitcher_status).
  - **pair** (Matchups + Game Hub): both chips shown on the team's home/away header line, the active one lit, the inactive one a dim outline.

**Placement (following the user's stated intent; build finalizes pixels):**
- **Cards** (`Card` renderer): a single status chip near the badge/detail row.
- **Matchups list + Game Hub `TeamSplit`**: the PROJ/CONF pair on each team's `TEAM · away/home` header line (status = that team's lineup confirmation).
- **Game Hub `GameBreakdown` pitcher rows**: a single chip per starting pitcher (its `pitcher_status`).
- **Table view**: a single status chip in the player row (low priority; include if clean).

**CSS (`web/app/globals.css`):** chip variants `.chip-proj` (amber glow) and `.chip-conf` (green glow), mirroring the existing soft-glow chip styling; plus a dim/outline state for the inactive chip in pair mode.

## Honesty / correctness notes

- A projected lineup is a guess from the last game — the yellow **PROJ** chip IS the disclosure; projected players who don't actually start simply get replaced when the side flips to CONF.
- The freeze rule still governs the *projection numbers* (a game freezes at first pitch); status of a frozen game is `confirmed`.
- No model-math change — this is lineup sourcing + display only. (Per the math-sign-off rule, nothing here touches probabilities.)

## Cost

Projected-lineup lookups are a few schedule/boxscore calls per team per day, cached, and only when an official lineup is absent — negligible against the GitHub-minutes budget; no new external source, no money.

## Testing

- Engine unit tests (offline, injected fns): projected-vs-confirmed status resolution; recent-lineup fallback + 7-day-gap empty case; row tagging on HR/K/games; started game → confirmed.
- `fetch.get_recent_lineup` live smoke (network).
- Web: `StatusChip` render logic if any pure helper is extracted; existing vitest + `tsc` + `npm run build` stay green.

## Out of scope

Paid/scraped projected-lineup sources (revisit later if free prediction proves insufficient); any change to projection math; manager roles; the pick-log.
