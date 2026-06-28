# Swingman True-Starts Fix — Strikeout Prop (Design)

**Date:** 2026-06-28
**Status:** Design — awaiting user sign-off (model-math change)
**Author:** brainstorm with user, 2026-06-28

---

## 1. Motivation / how we got here

The **Strikeouts prop is a pitcher prop.** We project a starter's K total from his game history (`model/profiles.py` `pitcher_profile_from_events`):
- **K line** = median Ks per game (`k_line_from_starts`)
- **expected_bf** = total PAs ÷ games

Confirmed in code: both currently count **every appearance, including short relief outings** (`ks_by_game` is built over all `game_pk`s; `expected_bf = pa / games` over all games). The function is *named* `from_starts` but is fed every game.

So a **swingman** (bounces between rotation and bullpen) who is **starting tonight** gets dragged **down** by his relief outings (short: ~3–9 batters, ~1 K). Example from project notes: 22 appearances, ~10 BF avg, median 2 K → line 1.5 / projection 1.9 — far too low for a real start (~18–25 BF, ~4–6 K). The over% stays internally consistent, but the absolute K number is wrong for those games, which breaks the edge-vs-sportsbook comparison. Historically the user's top model-roadmap pick.

Note: pure relievers already project ~1 K correctly — not by detection, but because *all* their games are short, so the median naturally lands at 1. Only the **mixed (swingman)** case is broken.

## 2. Scope

- **Strikeouts prop only.** Run/batter props untouched.
- Fixes both the **K line** and **expected_bf** for pitchers projected as tonight's starter.

## 3. Design

### 3a. New data — real start flag
Add `fetch.pitcher_gamelog(player_id, season)` mirroring `fetch.batter_gamelog`, using `hydrate=stats(group=[pitching],type=[gameLog],season=...)`. Return one row per game: `{"game_pk": int|None, "started": bool}` where `started = int(stat.get("gamesStarted", 0)) >= 1` and `game_pk = split["game"]["gamePk"]`. Empty list on failure (same as `batter_gamelog`). Cache via `get_or_compute` key `pit-gamelog-{pid}-{season}`.

**Why the real flag (not a BF heuristic):** it classifies **openers** and **early-hook starts** correctly (`gamesStarted = 1` regardless of length) — the exact cases a batters-faced threshold would misfire on.

### 3b. Filter the workload to true starts
`pitcher_profile_from_events` gains an optional param `started_game_pks: set | None = None`:
- **`None`** → current behavior unchanged (all appearances). Preserves back-compat for existing callers/tests and is the safe degradation path when the gamelog is unavailable.
- **a set provided** → restrict the per-game K counts and PA count to games whose `game_pk` is in the set:
  - `started_ks_by_game = {gp: ks for gp, ks in ks_by_game.items() if gp in started_game_pks}`
  - `started_pa = sum of PAs in started games`
  - if `len(started_ks_by_game) >= MIN_STARTS` (=2): `expected_bf = started_pa / len(started_ks_by_game)`, `k_line = k_line_from_starts(list(started_ks_by_game.values()))`
  - else (0–1 true starts): **fall back to the generic-starter default** — `k_line = 4.5`, `expected_bf = 24.0` (existing defaults). This also fixes the reliever-spot-start case (uses a generic start, not his ~1-K relief numbers).

### 3c. Wiring
In `export_web.make_profile_fns`, both `pitcher_fn` and `pitcher_hist_fn` (workload/k_line come from the current season in both modes):
- fetch `gl = get_or_compute("pit-gamelog-{pid}-{season}", lambda: fetch.pitcher_gamelog(pid, season))`
- if `gl`: `started = {g["game_pk"] for g in gl if g["started"] and g["game_pk"] is not None}` → pass `started_game_pks=started` (a set, possibly empty → 0 starts → default).
- if `gl` is empty (API hiccup or no games): pass `started_game_pks=None` → all-appearances back-compat, so a transient failure never nukes pitcher projections.

## 4. Edge cases

| Case | Behavior |
|---|---|
| Swingman (starts + relief) | Filters to starts → correct starter line/BF ✅ |
| Opener / early-hook start | `gamesStarted=1` → counted as a start ✅ |
| Pure reliever making a spot start | gamelog non-empty, 0 started → generic-starter default ✅ |
| Rookie debut start / <2 starts | <2 starts → generic-starter default ✅ |
| Genuine low-K starter (real ~1 K across starts) | Median of his starts stays ~1 → still projected ~1 ✅ (correct, now a trustworthy signal) |
| Gamelog fetch fails / empty | `None` → all-appearances (unchanged) — safe degradation ✅ |

## 5. Constants (sign-off)

| Constant | Value |
|---|---|
| `MIN_STARTS` | 2 |
| Fallback K line | 4.5 (existing) |
| Fallback expected_bf | 24.0 (existing) |

## 6. Recorder / grader

**No change.** This adjusts the existing `line` / `expected_ks` fields (already archived) and the resulting `over_prob`. The grader already grades strikeouts. No new factor field.

## 7. Testing (TDD)

- `pitcher_gamelog` parses `gamesStarted` + `gamePk`; `[]` on failure.
- `pitcher_profile_from_events` with `started_game_pks=None` → identical to today (back-compat).
- With a set: a swingman fixture (e.g., starts of 6/5/7 K + relief games of 1/0/1) → k_line/expected_bf computed from the *starts only*; relief games excluded.
- `<2` started games → returns the 4.5 / 24 fallback.
- Genuine low-K starter (starts all ~1 K) → still ~1 (not inflated).
- Wiring: `pitcher_fn` passes the started set; empty gamelog → `None` path.

## 8. Future refinements (roadmap)

- Regress thin (2–4 start) samples toward a league-starter baseline instead of a hard fallback (the brainstorm's Option 2).
- BF-threshold heuristic as an offline fallback if the gamelog source is ever unavailable.

## 9. Sign-off

Model-math change. Requires user approval of this spec before an implementation plan is written. Build via spec → plan → SDD, preview before prod.
