# prop-predict — Design Spec

**Date:** 2026-06-10
**Status:** Approved for planning
**Owner:** issiakadiawara

---

## 1. Overview

`prop-predict` is a website that predicts MLB **player props** (home runs, hits, strikeouts, etc.) by combining historical stats, recent form, batter/pitcher matchup, ballpark, and weather. Unlike most prop services, it **shows its reasoning** for every pick and keeps an **honest, permanent public track record**.

It is modeled on creators the owner follows (notably **Kasper / @KasperMLB**) and the gold-standard simulation site **Ballpark Pal**, but differentiates on two things competitors lack: rigorous **weather/park modeling** and a **provable win/loss record**.

## 2. Goals & Non-Goals

**Goals**
- Produce trustworthy per-player prop projections from free data.
- Make the *reasoning* transparent (the "why" behind each number).
- Keep an honest, append-only public record of every flagged play.
- Be buildable and maintainable by a beginner, on a $0 data budget.

**Non-Goals (for now)**
- Live in-game updating (props are pre-game; not needed).
- Paid live player-prop odds (deferred — see §8).
- Replicating Ballpark Pal's full ML simulation on day one (it's the north-star stretch goal, not the MVP).

## 3. Users & Rollout Phases

The product ships in three stages, each building on the last (nothing thrown away):

1. **Personal tool** — private, just the owner. No logins, no payments. Fastest path to something real.
2. **Public + free** — anyone can view; presentable UI; the public pick log goes live (builds an audience/trust).
3. **Public + paywall** — add user accounts and payments; gate premium features behind a subscription.

The architecture must support adding auth/payments later without a rewrite.

## 4. Props Covered

Built as **one generic projection engine** ("project a player's count of stat X tonight → compare to the line"), with props switched on incrementally.

- **Hitters:** Home Runs · Hits · Total Bases · RBIs · Runs · Stolen Bases · H+R+RBI combo
- **Pitchers:** Strikeouts · Hits Allowed · Walks · Outs Recorded

**Launch order:** Home Runs + Pitcher Strikeouts first (flagship props; HR is where the weather edge shows). Then Hits / Total Bases / H+R+RBI, then the rest.

## 5. Architecture

**Pattern: "crunch then display."** A scheduled Python job computes all projections and saves the results; the website only *reads and displays* them. No per-visitor number-crunching (the data libraries are too slow for that).

**Scheduling (handles staggered start times):** the job runs on a **repeating loop** (~every 30–60 min through the day) and only refreshes games that **have not started yet**; once a game begins, its projections **freeze** (props are pre-game). This way 1pm, 6pm, and 10pm games each get their freshest lineup/weather update right before their own first pitch, without hand-picking clock times. The site shows a "last updated HH:MM" stamp.

**Components:**
- **Projection engine (Python)** — pulls data, computes projections + confidence per player/prop, writes results to storage.
- **Storage** — holds today's projections and the permanent pick-log history.
- **Web app (Next.js on Vercel)** — reads stored results, renders the screens.
- **Scheduler** — Vercel Cron Jobs triggers the engine (runs locally during early development).
- **Grader** — a step that, after games finish, records actual outcomes vs. what was flagged, into the pick log.

## 6. Data Sources (all free)

| Need | Source |
|---|---|
| Schedules, lineups, live status | MLB Stats API (`statsapi.mlb.com`) |
| Statcast advanced stats (barrel%, hard-hit%, exit velo, launch angle, xBA/xwOBA, splits) | `pybaseball` → Baseball Savant / FanGraphs |
| Weather (temp, wind speed/direction, humidity, pressure) | Open-Meteo (free; historical to 1940 for back-testing). Optional cross-check: NWS/NOAA |
| Historical baselines / player IDs | Lahman DB, Retrosheet, Chadwick |

**Statcast access note:** Baseball Savant's manual CSV export caps at 40,000 rows; `pybaseball` auto-chunks behind the scenes, so we never hit that limit. Column dictionary at `baseballsavant.mlb.com/csv-docs`.

## 7. The Projection Engine

For each player + that night's matchup, the engine estimates the player's expected stat and a probability vs. a threshold, plus a confidence level.

**Inputs (the three pillars + environment):**
- **Historical baseline** — season/career rates (barrel%, hard-hit%, fly-ball%, K%, BB%, xBA, xwOBA, xSLG, ISO). Statcast publishes expected stats precomputed, so we don't train ML to start.
- **Recent form** — rolling last 7/15/30 days (hot/cold).
- **Matchup** — batter-vs-pitcher handedness splits + opposing pitcher quality.
- **Ballpark** — per-stadium factors, ideally batter-level (spray profile vs. dimensions).
- **Weather** — wind speed/direction (out = HR boost), temperature, humidity. The *edge* is park-specific interpretation (wind matters at Wrigley, not at enclosed parks), which we build on top of the free feed.

**Output per play:** projected stat / probability, a confidence level (with explicit small-sample flagging, shown as a heatmap color), and — when odds are available — the edge vs. the betting line.

**Staged sophistication (toward the Ballpark Pal north star):**
- **Phase 1:** ranked projections from barrel/hard-hit/fly-ball + recent form + handedness + Open-Meteo weather + park factors.
- **Phase 2:** lean on Statcast's free expected stats; add batter-level park factors.
- **Phase 3 (stretch):** lightweight Monte Carlo matchup simulation.

## 8. Odds Handling (the one paywalled piece)

Live **player-prop** odds (HR, strikeouts) are not available free — they sit behind paid tiers (~$29/mo). Free game-line (moneyline) odds are available (The Odds API free tier, 25 req/day).

**Decision:** the model, projections, and pick log are 100% free and fully functional **without** odds. The "edge vs. the betting line" is an *optional layer*. Free workarounds: use free moneyline odds where applicable, or let the owner manually enter a prop line for flagged plays. Paid prop odds can be added later if the owner chooses.

## 9. Screens / UX

**Product philosophy:** *show everything, but let each person dial in how much detail they see* (progressive disclosure via toggles).

- **Main board** — all plays for the selected prop. **View switcher: Cards / Table / Hybrid / List** (Hybrid is the default: highlighted "Top Plays" cards on top + full sortable table below). Responsive: can favor Table on desktop, Cards on mobile. Prop tabs across the top. Heatmap coloring (green = strong, red = weak/small-sample). Shows "last updated" stamp.
- **Player breakdown** (click a play) — the *why*: power, matchup, recent form, park, weather, a plain-English summary, and recent game log. **Simple ↔ Detailed ↔ Advanced** toggle (Advanced adds spray chart, vs-this-pitcher history, charts).
- **Pick log / track record** — honest, permanent: headline stats (hit rate, units, plays graded, avg edge), record by prop type, recent graded plays (✅/❌, recorded before the game, never deleted). **Simple ↔ Detailed ↔ More** (More adds profit-over-time charts, date/prop filters, closing-line value). Emphasizes **units**, not just win %, since long-odds props (HR) can be profitable below 50%.

## 10. Differentiators

1. **Weather + park modeling** — central to us, ignored by Kasper. Validated as the real edge by Ballpark Pal.
2. **Provable honest record** — every flagged play recorded pre-game and never deleted; no rival publishes a verifiable record.

## 11. Tech Stack

- **Frontend/host:** Next.js (App Router) on **Vercel** (account `ghostdemonx0-netizen`).
- **Model:** Python (`pybaseball` + pandas), run as a scheduled job (Vercel Cron → Python function; or locally in early dev).
- **Storage:** a database for the durable pick-log history and daily projections (e.g., Vercel Marketplace Postgres / Neon free tier). Daily projections may also be cached as JSON. *(Exact storage choice to be confirmed in the implementation plan.)*
- **Scheduling:** Vercel Cron Jobs.
- **Later phases:** auth + payments provider (e.g., Clerk + Stripe) added at the paywall stage.

## 12. Phased Build Plan (high level)

1. **Prove the model** — Python script produces real projections for one prop (HR) for today's games, output to a table. Validates the data pipeline and math before any UI.
2. **Personal MVP** — wire projections into a Next.js site: Hybrid main board (HR + Strikeouts), player breakdown, and the pick log with auto-grading. Scheduled refresh. Private/local.
3. **Expand props** — light up Hits, Total Bases, H+R+RBI, then the rest, through the same engine.
4. **Go public + free** — polish UI, responsive views, deploy publicly, pick log live.
5. **Add paywall** — accounts + payments, gate premium features.

## 13. Success Criteria

- Projections generate reliably on schedule from free data, refreshing pre-game per the staggered-start logic.
- Every screen renders from stored results quickly.
- Every flagged play is recorded pre-game and graded after; the public record is accurate and permanent.
- The owner can read *why* any pick was made.
- Runs at ~$0 data cost.

## 14. Risks & Open Questions

- **Data reliability** — `pybaseball`/Savant can rate-limit or change; need graceful handling and caching.
- **Lineup timing** — confirmed lineups arrive late; the refresh loop must handle "projected vs. confirmed" lineup states.
- **Model accuracy** — early projections are simple; back-testing (using Open-Meteo history) needed to validate before trusting units.
- **Storage choice** — Postgres vs. simpler JSON for the personal MVP (decide in planning).
- **Where Python runs** — Vercel Python function vs. external scheduled runner (decide in planning).
