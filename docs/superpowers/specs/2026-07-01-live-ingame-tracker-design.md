# Live In-Game Prop Tracker — Design

**Date:** 2026-07-01
**Type:** New subsystem — a live-data feeder (Vercel function) + frontend polling that
drives the already-built `LiveChip` indicator with real MLB box-score counts.
**Status:** Design approved in brainstorm (indicator UI done + validated on localhost);
this spec covers the live-data half. Pending spec review.

## Goal

Show, live during games, whether each prop has cleared — a small chip on every board
surface that ticks a batter/pitcher's real stat toward the prop's line and settles green
(cleared) or red (missed) when the game ends. The **indicator UI is already built** (the
`LiveChip` component, 4 states, placement across all surfaces). This spec builds the
**data** behind it: a cached Vercel function that reads live MLB box scores, and the
frontend polling that feeds the chips — **replacing the throwaway `demoLive` scaffolding.**

## Already done (from the design brainstorm)

- `web/components/LiveChip.tsx` — the chip. States: `pregame` (grey), `live` (amber+dot,
  no blink), `cleared` (green, count may exceed need e.g. `2/1`), `missed` (red, final &
  short). `sm` variant for Game Hub. Shows the **true count** `have/need`, not clamped.
- Placement wired on every surface: **Cards, Table, Hybrid, Top Plays** (incl. Top Contact
  & Top Batter Strikeouts), **Matchups**, **Game Hub** (a small chip under each prop sphere
  + a K chip on each starting pitcher).
- **To be removed by this spec:** `demoLive`, `demoLiveN`, and the `liveFor`/`liveOne`/
  `demoLive(...)` call-site scaffolding — replaced by the real data path below.

## Architecture (three pieces)

1. **Feeder** — a Vercel serverless route `web/app/api/live/route.ts` (Node). On request it
   fetches the day's live MLB box scores directly from the public MLB Stats API over HTTP
   (the same data our Python grader reads, but called from Node — no Python on Vercel), parses
   each player's counting stats + each game's status, and returns a compact JSON. **Edge-cached
   ~45s** so all viewers share one upstream fetch (cost bounded by games, not viewers).

2. **Polling** — a React hook `useLive(date, games)` that GETs `/api/live?date=…` on an
   interval, honoring the cost rules: only while ≥1 game is live, **paused when the tab is
   hidden**, every **60s**. Returns a `playerId → statline` map + per-game status.

3. **Wiring** — a `LiveProvider` context exposes the live map + a helper `liveFor(row, kind)`
   that returns `{state, have, need} | null`. Every surface's chip calls `liveFor` instead of
   `demoLive`. No prop-drilling through the component tree.

## Data source — MLB Stats API (HTTP, from Node)

The Python `statsapi` lib is just a wrapper over these public endpoints; Node calls them directly:

- **Schedule + status:** `GET https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=YYYY-MM-DD`
  → each game's `gamePk` and `status.abstractGameState` (`Preview` | `Live` | `Final`).
- **Box score:** `GET https://statsapi.mlb.com/api/v1/game/{gamePk}/boxscore`
  → `teams.{home,away}.players["ID{pid}"].stats.batting` and `.stats.pitching`.

Per-player stats extracted (matching `model/fetch.py:_parse_boxscore`):
- Batting: `hits`, `doubles`, `triples`, `homeRuns`, `runs`, `rbi`, `strikeOuts`.
  Total bases computed: `tb = hits + doubles + 2*triples + 3*homeRuns`.
- Pitching: `strikeOuts`.

Games in `Preview` are **not fetched** (all zeros → `pregame`); only `Live`/`Final` games hit
the boxscore endpoint.

## Data contract — `/api/live` response

```jsonc
{
  "updated": "2026-07-01T23:41:12Z",
  "games": { "776543": "Live", "776544": "Final", "776545": "Preview" },
  "players": {
    "592450": { "game": 776543, "h": 2, "tb": 5, "hr": 1, "r": 1, "rbi": 3, "bk": 1 }, // batter (bk = batter strikeouts)
    "605483": { "game": 776543, "pk": 7 }                                              // pitcher (pk = pitcher strikeouts)
  }
}
```

- `games`: gamePk → status string. Drives pregame/live/final per row (via `row.game_id`).
- `players`: keyed by MLB person id (matches `row.player_id`). Batters carry `h/tb/hr/r/rbi/bk`;
  pitchers carry `pk`. A player absent from `players` (game not started, or no PA/BF yet) → all 0.

Caching header on the route: `Cache-Control: s-maxage=45, stale-while-revalidate=30`.

## Deriving a chip state — `deriveLive(stat, kind, gameStatus)`

Pure function in `web/lib/live.ts`. Given a player's live `stat` (or undefined), the prop
`kind`, and the game status, returns `{ state, have, need } | null`.

**`need`** (threshold) by kind — reuse `propNeed` logic:
| kind | need | `have` source |
|---|---|---|
| `hr` | 1 | `stat.hr` |
| `hits1/2/3` | 1/2/3 | `stat.h` |
| `tb2/3/4` | 2/3/4 | `stat.tb` |
| `runs1/2` | 1/2 | `stat.r` |
| `rbi1/2` | 1/2 | `stat.rbi` |
| `hrr2/3/4` | 2/3/4 | `stat.h + stat.r + stat.rbi` |
| `k` (pitcher) | `floor(line)+1` | `stat.pk` |
| **contact** (Top Contact) | 1 | `stat.h` |
| **batterK** (Top Batter Ks) | 1 | `stat.bk` |

`contact` and `batterK` are passed as explicit modes (Top Plays only), since they read the
per-AB matchup stat lines (hits / batter strikeouts), not a game prop kind.

**`state`:**
```
have = <from table>  (0 if stat missing)
if gameStatus is "Preview" (or unknown/not started) → "pregame"
else if have >= need   → "cleared"     // count may exceed need — show it (2/1, 8/6)
else if gameStatus is "Final" → "missed"
else                   → "live"
```

`have` is the **true count**, never clamped. Returns `null` for surfaces/props with no live
concept (none currently — every prop maps).

## Polling hook — `useLive(date, games)`

`web/components/LiveProvider.tsx`. Returns `{ players, gameStatus, updated }`.

Rules (the cost controls, all from the brainstorm):
1. **Active window only.** Compute from the board's games: active = at least one game has a
   start time in the past AND not all games are `Final` (per the latest response, or the
   board's `started` flags before the first fetch). Outside the window → no polling.
2. **Pause when hidden.** Listen to `visibilitychange`; when `document.hidden`, clear the
   interval; on re-show, fetch once immediately then resume.
3. **60s interval.** `setInterval` at 60_000ms while active + visible.
4. Stop entirely once every game is `Final` (falls out of the active window automatically).

Fetch failures are swallowed (keep the last good map; a blip just means the chips hold their
prior state). Abort in-flight fetches on unmount.

## Wiring into the surfaces (replace `demoLive`)

`LiveProvider` wraps the board in `web/app/page.tsx`. A tiny helper hook `useLiveFor()` returns
`liveFor(row, kind)` bound to the current live map. Replace each demo call:

- **Card / Table / BoardRowLine** (`PropBoard.tsx`): `demoLive(kind, r.player, r.line)` →
  `liveFor(r, kind)`.
- **Game Hub `propCell`** (`PropBoard.tsx`): same swap; the pitcher K chip →
  `liveFor(r, "k")`.
- **Top Plays** (`TopPlays.tsx`): standard sections → `liveFor(r, kind)`; **Top Contact** →
  `liveFor(r, "contact")`; **Top Batter Strikeouts** → `liveFor(r, "batterK")`.

`liveFor` looks up `players[row.player_id]`, reads `gameStatus[row.game_id]`, calls
`deriveLive`. Chips render only when it returns non-null (always, once a game exists) — but a
`pregame` chip is intentionally shown (grey) so the column heights/alignment stay stable.

## Cost / caching (recap)

- The route is edge-cached 45s → one upstream MLB fetch per ~45s **shared across all viewers**;
  work bounded by games (~15/day), not traffic.
- Runs on **Vercel** (first feature-function there), **zero GitHub Actions minutes**.
- Polling stops outside game hours and when the tab's hidden → near-zero when idle.

## Out of scope (YAGNI)

- No websockets / true push — 60s polling is enough for baseball.
- No historical live replay; only today's (or the selected date's) in-progress games.
- No new stored data / recorder / grader changes — this is a live *display* overlay; the
  grader still scores finals independently.
- No Game-Hub K/C/N live tracker (kept as the projection text, per the design decision).
- No pregame countdown / inning display in v1 (could add later).

## Testing

- **Feeder (route):** unit-test the boxscore parser against a captured MLB JSON fixture
  (live + final samples) → correct `h/tb/hr/r/rbi/bk/pk` and `tb` computation; and that
  `Preview` games are skipped. Test the route returns the contract shape and sets the cache header.
- **`deriveLive`:** table-test every kind → correct `need`; `have` from the right field;
  state transitions (pregame → live → cleared, and live → missed at Final); over-count
  (`have > need` stays `cleared` and shows the real number).
- **`useLive`:** test the polling gates — no fetch when outside window / hidden tab; resumes
  on visibility; stops when all Final. (Mock timers + `document.hidden`.)
- **Manual:** point at a date with live games (or a finished date via the API) on localhost;
  confirm chips reflect real box scores across all surfaces; confirm the network tab shows one
  request per ~60s and none when the tab is backgrounded. Preview-before-prod.

## Rollout

Branch off the design work (which stays), build feeder + wiring, remove `demoLive` scaffolding,
full test suites green, localhost preview against real live data, explicit approval, then merge
+ deploy. The frontend deploys to Vercel via git push as always; the `/api/live` route becomes
the first Vercel function. No `force_deploy` recompute needed (no board fields change).
