# Runs + RBI + HRR Props Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new per-game batter props — Runs, RBI, and HRR (Hits+Runs+RBI combined) — each with over-thresholds, fully integrated into the board, Top Plays, Game Hub, player pages, and the Current/Blend/History weighting.

**Architecture:** A new game-log data source (per-player per-game R/RBI/H from the MLB Stats API) feeds a per-game rate model. Each prop = the player's regressed per-game rate × adjustments (opposing-pitcher suppression + platoon + park run env), converted to over-threshold probabilities via Poisson. HRR is modeled on the combined H+R+RBI per-game total directly. The new props slot into the existing board pipeline / export / frontend exactly like Hits and Total Bases.

**Tech Stack:** Python (model, `uv run pytest`), MLB Stats API via `statsapi`, pybaseball Statcast; Next.js 16 / React / TypeScript frontend (`npx tsc --noEmit`, `npm test` → vitest).

## Global Constraints

- HR + Strikeouts + Hits + Total Bases model outputs must stay **byte-for-byte unchanged**. New props are additive only.
- Math change → **the league baselines, regression strength, pitcher-suppression formula, and park proxy in Task 3/5 are calibration constants that REQUIRE user sign-off** before the build merges (math-changes-need-signoff). The plan ships sensible defaults; flag them at review.
- Thresholds: **Runs 1+ / 2+** (default 1+), **RBI 1+ / 2+** (default 1+), **HRR 2+ / 3+ / 4+** (default 2+).
- All board builders share the signature `(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None)` so new builders slot into `build_board_with_history` and `main`'s payload.
- v1 = Approach A (rate model). Lineup-context (C) and simulation (B) are out of scope (roadmap). Poisson is a known v1 simplification (roadmap: better distribution later). No deep BvP-history dial for these props.
- Python tests: `uv run pytest` (config `pytest.ini`, `addopts = -m "not smoke"`). Frontend: `npx tsc --noEmit` in `web/`, `npm test` (vitest) in `web/`.
- Preview on localhost before production; ship via merge-to-main + `gh workflow run board-refresh.yml -f force_deploy=true`. Rebase onto origin/main before pushing (shared main).

## File Structure

**Backend (create):**
- `model/run_props.py` — pure per-game rate → regress → adjust → Poisson threshold math. One responsibility: the new prop math. Fully unit-tested.
- `tests/test_run_props.py` — unit tests for the math module.

**Backend (modify):**
- `model/fetch.py` — add `batter_gamelog(player_id, season)` (statsapi gameLog hydrate).
- `model/profiles.py` — add `season_r`, `season_rbi`, `season_hrr` (current + blended) to batter profiles.
- `model/parks.py` — add `run_park_factor(team_abbr)` (v1 proxy off `hr_park_factor`, dampened).
- `model/pipeline.py` — add `build_runs_rows`, `build_rbi_rows`, `build_hrr_rows`.
- `model/export_web.py` — extend `build_board_with_history` (+ `make_profile_fns` to supply game-log stats) + `main` payload keys `runs[]`, `rbi[]`, `hrr[]`.
- `tests/test_run_props_board.py` — board-level test that the three props appear with `_hist` twins.

**Frontend (modify):**
- `web/lib/types.ts` — `RunsRow`, `RbiRow`, `HrrRow`, + `Projections` keys.
- `web/lib/format.ts` — extend `PropKind`, `TIERS`, `HEAT`.
- `web/components/tests/format.test.ts` — add new-prop cases.
- `web/app/page.tsx` — prop state, pills, threshold pills, `*Prob` helpers, `*Rows` maps, `*DateQ`, board/TopPlays/Parks wiring, URL params.
- `web/components/TopPlays.tsx` — Top Runs / Top RBI / Top HRR sections.
- `web/components/PropBoard.tsx` — Game Hub 4→7 columns (`ColHeaders`/`ColBatterRow`/`ColTeam`/`ColSplit`/`GameBreakdown`, `COL_GRID`, `SortCol`).
- `web/components/ParksBoard.tsx` — thread new rows/kinds to `GameBreakdown`.
- `web/app/player/[prop]/[id]/page.tsx` — `if (prop === "runs"/"rbi"/"hrr")` detail blocks + `Back` chain.

---

### Task 1: Game-log fetch (R/RBI/H per game)

**Files:**
- Modify: `model/fetch.py`
- Test: `tests/test_fetch_gamelog.py` (create)

**Interfaces:**
- Produces: `batter_gamelog(player_id: int, season: int) -> list[dict]` — one dict per game, keys `{"game_date": "YYYY-MM-DD", "r": int, "rbi": int, "h": int}`. Empty list if no games / on parse failure.

The MLB Stats API hitting gameLog is hydrated like `get_bvp` already does. Each split has `stat` with `runs`, `rbi`, `hits` and `date`.

- [ ] **Step 1: Write the failing test** (`tests/test_fetch_gamelog.py`)

```python
from unittest.mock import patch
from model import fetch

_FAKE = {"people": [{"stats": [{"splits": [
    {"date": "2026-04-01", "stat": {"runs": 1, "rbi": 2, "hits": 1}},
    {"date": "2026-04-02", "stat": {"runs": 0, "rbi": 0, "hits": 2}},
]}]}]}

def test_batter_gamelog_parses_per_game_r_rbi_h():
    with patch.object(fetch, "statsapi") as m:
        m.get.return_value = _FAKE
        rows = fetch.batter_gamelog(12345, 2026)
    assert rows == [
        {"game_date": "2026-04-01", "r": 1, "rbi": 2, "h": 1},
        {"game_date": "2026-04-02", "r": 0, "rbi": 0, "h": 2},
    ]

def test_batter_gamelog_empty_on_missing_splits():
    with patch.object(fetch, "statsapi") as m:
        m.get.return_value = {"people": [{}]}
        assert fetch.batter_gamelog(1, 2026) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_fetch_gamelog.py -v`
Expected: FAIL with `AttributeError: module 'model.fetch' has no attribute 'batter_gamelog'`

- [ ] **Step 3: Write minimal implementation** (add to `model/fetch.py`, near `get_bvp`)

```python
def batter_gamelog(player_id: int, season: int) -> list[dict]:
    """Per-game hitting log for one batter-season: [{game_date, r, rbi, h}]."""
    data = _with_retries(lambda: statsapi.get("people", {
        "personIds": str(player_id),
        "hydrate": f"stats(group=[hitting],type=[gameLog],season={season},sportId=1)",
    }))
    try:
        splits = data["people"][0].get("stats", [{}])[0].get("splits", [])
    except (KeyError, IndexError, TypeError):
        return []
    out = []
    for sp in splits:
        st = sp.get("stat", {}) or {}
        out.append({
            "game_date": sp.get("date"),
            "r": int(st.get("runs", 0) or 0),
            "rbi": int(st.get("rbi", 0) or 0),
            "h": int(st.get("hits", 0) or 0),
        })
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_fetch_gamelog.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py tests/test_fetch_gamelog.py
git commit -m "feat: batter_gamelog fetch (per-game R/RBI/H from statsapi)"
```

---

### Task 2: Per-game rate math module

**Files:**
- Create: `model/run_props.py`
- Test: `tests/test_run_props.py` (create)

**Interfaces:**
- Produces:
  - `regressed_per_game(total: float, games: float, league_per_game: float, regression_games: float) -> float`
  - `expected_count(rate: float, *, pitcher_mult: float = 1.0, platoon_mult: float = 1.0, park_mult: float = 1.0) -> float`
  - `ge_probs(lam: float, thresholds: list[tuple[str, int]]) -> dict[str, float]` — Poisson P(count ≥ n) per `(label, n)`.
  - Constants: `LEAGUE_R_PER_GAME = 0.50`, `LEAGUE_RBI_PER_GAME = 0.50`, `LEAGUE_HRR_PER_GAME = 1.80`, `REG_GAMES = 40.0` (⚠️ calibration — sign-off).
- Consumes: `model.projections.poisson_over_prob` (reused: `P(count ≥ n) == poisson_over_prob(lam, n - 0.5)`).

- [ ] **Step 1: Write the failing test** (`tests/test_run_props.py`)

```python
import math
from model import run_props as rp

def test_regressed_per_game_pulls_toward_league():
    # 0 made in 0 games -> league; hot player regresses down toward league
    assert rp.regressed_per_game(0, 0, 0.5, 40) == 0.5
    r = rp.regressed_per_game(40, 40, 0.5, 40)   # 1.0/game raw, reg toward 0.5
    assert 0.5 < r < 1.0
    assert math.isclose(r, (40 + 0.5 * 40) / (40 + 40))

def test_expected_count_multiplies_and_floors_at_zero():
    assert rp.expected_count(0.6, pitcher_mult=0.9, platoon_mult=1.06, park_mult=1.05) == \
        0.6 * 0.9 * 1.06 * 1.05
    assert rp.expected_count(-1.0) == 0.0

def test_ge_probs_poisson_thresholds():
    probs = rp.ge_probs(0.7, [("p_ge1", 1), ("p_ge2", 2)])
    assert math.isclose(probs["p_ge1"], 1 - math.exp(-0.7))
    assert math.isclose(probs["p_ge2"], 1 - math.exp(-0.7) * (1 + 0.7))
    # monotonic: P(>=2) <= P(>=1)
    assert probs["p_ge2"] <= probs["p_ge1"]

def test_ge_probs_zero_lambda():
    probs = rp.ge_probs(0.0, [("p_ge1", 1)])
    assert math.isclose(probs["p_ge1"], 0.0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_run_props.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'model.run_props'`

- [ ] **Step 3: Write minimal implementation** (`model/run_props.py`)

```python
"""Per-game rate math for the Runs / RBI / HRR props (Approach A).

A player's regressed per-game rate, scaled by matchup/park multipliers, becomes
a Poisson mean; over-thresholds come from the Poisson CDF. See
docs/superpowers/specs/2026-06-25-runs-rbi-hrr-design.md. League baselines and
REG_GAMES are calibration constants (require sign-off).
"""
from model.projections import poisson_over_prob

LEAGUE_R_PER_GAME = 0.50
LEAGUE_RBI_PER_GAME = 0.50
LEAGUE_HRR_PER_GAME = 1.80
REG_GAMES = 40.0


def regressed_per_game(total: float, games: float, league_per_game: float, regression_games: float) -> float:
    """Per-game rate regressed toward the league per-game average."""
    denom = games + regression_games
    if denom <= 0:
        return league_per_game
    return (total + league_per_game * regression_games) / denom


def expected_count(rate: float, *, pitcher_mult: float = 1.0, platoon_mult: float = 1.0, park_mult: float = 1.0) -> float:
    """Poisson mean = regressed rate scaled by matchup/park multipliers (>= 0)."""
    return max(0.0, rate * pitcher_mult * platoon_mult * park_mult)


def ge_probs(lam: float, thresholds: list[tuple[str, int]]) -> dict[str, float]:
    """{label: P(count >= n)} for a Poisson(lam) count. Monotonic by construction."""
    return {label: poisson_over_prob(lam, n - 0.5) for (label, n) in thresholds}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_run_props.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add model/run_props.py tests/test_run_props.py
git commit -m "feat: run_props per-game rate -> Poisson threshold math"
```

---

### Task 3: Pitcher-suppression + park-run multipliers

**Files:**
- Modify: `model/run_props.py`
- Modify: `model/parks.py`
- Test: `tests/test_run_props.py` (extend)

**Interfaces:**
- Produces:
  - `model.run_props.pitcher_suppression_mult(hit_allowed_rate: float, *, league_hit: float = 0.22, lo: float = 0.85, hi: float = 1.15) -> float` — pitcher's hit-allowed rate vs league, clamped (a stingy pitcher → <1.0).
  - `model.parks.run_park_factor(team_abbr: str) -> float` — v1 proxy: `1 + (hr_park_factor(team) - 1) * 0.6` (dampened HR park factor; ⚠️ proxy — real run park factors are a roadmap upgrade).

- [ ] **Step 1: Write the failing test** (add to `tests/test_run_props.py`)

```python
from model import parks

def test_pitcher_suppression_below_one_for_stingy_pitcher():
    assert rp.pitcher_suppression_mult(0.18) < 1.0     # allows fewer hits than league
    assert rp.pitcher_suppression_mult(0.26) > 1.0     # allows more
    assert rp.pitcher_suppression_mult(0.0) == 0.85    # clamped low
    assert rp.pitcher_suppression_mult(1.0) == 1.15    # clamped high

def test_run_park_factor_dampens_hr_factor():
    import math
    hr = parks.hr_park_factor("COL")        # Coors > 1
    rpf = parks.run_park_factor("COL")
    assert 1.0 < rpf < hr                    # dampened, still > 1
    assert math.isclose(rpf, 1 + (hr - 1) * 0.6)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_run_props.py -v`
Expected: FAIL with `AttributeError: ... has no attribute 'pitcher_suppression_mult'`

- [ ] **Step 3: Write minimal implementation**

Add to `model/run_props.py`:
```python
def pitcher_suppression_mult(hit_allowed_rate: float, *, league_hit: float = 0.22, lo: float = 0.85, hi: float = 1.15) -> float:
    """How many baserunners this pitcher allows vs league, clamped. <1 = stingy."""
    if league_hit <= 0:
        return 1.0
    return max(lo, min(hit_allowed_rate / league_hit, hi))
```

Add to `model/parks.py` (near `hit_park_factor`):
```python
def run_park_factor(team_abbr: str) -> float:
    """v1 run-environment proxy: a dampened HR park factor. Real per-park run
    factors are a roadmap upgrade (see props-expansion-roadmap)."""
    return 1 + (hr_park_factor(team_abbr) - 1) * 0.6
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_run_props.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add model/run_props.py model/parks.py tests/test_run_props.py
git commit -m "feat: pitcher-suppression + run-park-factor multipliers for run props"
```

---

### Task 4: Game-log stats into batter profiles

**Files:**
- Modify: `model/profiles.py`
- Test: `tests/test_profiles_gamelog.py` (create)

**Interfaces:**
- Produces: `model.profiles.with_gamelog(profile: dict, gamelogs_by_season: dict[int, list[dict]], *, current_season: int) -> dict` — returns a copy of `profile` with added keys: `games`, `total_r`, `total_rbi`, `total_hrr` (current season), and blended twins `games_hist`, `total_r_hist`, `total_rbi_hist`, `total_hrr_hist` (Marcel 5/4/3 across up to 3 seasons; `hrr = h + r + rbi` per game).
- Consumes: `model.blend.marcel_blend`. `gamelogs_by_season` maps season int → list of `{game_date, r, rbi, h}` from Task 1.

Keeping this as a pure merge function (separate from `batter_profile_from_events`) avoids touching the Statcast profile path and keeps HR/Hits/TB byte-for-byte unchanged.

- [ ] **Step 1: Write the failing test** (`tests/test_profiles_gamelog.py`)

```python
from model import profiles

def _logs(n, r, rbi, h):
    return [{"game_date": f"2026-0{(i%9)+1}-01", "r": r, "rbi": rbi, "h": h} for i in range(n)]

def test_with_gamelog_current_season_totals():
    prof = profiles.with_gamelog({"player_id": 1}, {2026: _logs(10, 1, 1, 1)}, current_season=2026)
    assert prof["games"] == 10
    assert prof["total_r"] == 10
    assert prof["total_rbi"] == 10
    assert prof["total_hrr"] == 30          # (1+1+1) per game * 10

def test_with_gamelog_blended_history_weights_recent():
    logs = {2026: _logs(10, 2, 2, 2), 2025: _logs(10, 0, 0, 0), 2024: _logs(10, 0, 0, 0)}
    prof = profiles.with_gamelog({"player_id": 1}, logs, current_season=2026)
    # current season higher rate; blended hist twin sits between current and 0
    assert prof["total_r"] / prof["games"] == 2.0
    assert 0.0 < prof["total_r_hist"] / prof["games_hist"] < 2.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_profiles_gamelog.py -v`
Expected: FAIL with `AttributeError: module 'model.profiles' has no attribute 'with_gamelog'`

- [ ] **Step 3: Write minimal implementation** (add to `model/profiles.py`)

```python
from model.blend import marcel_blend

def _gamelog_totals(logs: list[dict]) -> tuple[int, int, int, int]:
    """(games, total_r, total_rbi, total_hrr) for one season of game logs."""
    g = len(logs)
    tr = sum(int(x.get("r", 0)) for x in logs)
    trbi = sum(int(x.get("rbi", 0)) for x in logs)
    thrr = sum(int(x.get("h", 0)) + int(x.get("r", 0)) + int(x.get("rbi", 0)) for x in logs)
    return g, tr, trbi, thrr

def with_gamelog(profile: dict, gamelogs_by_season: dict, *, current_season: int) -> dict:
    """Merge per-game R/RBI/HRR season totals (+ Marcel-blended hist twins) into a profile."""
    p = dict(profile)
    cur = gamelogs_by_season.get(current_season, [])
    g, tr, trbi, thrr = _gamelog_totals(cur)
    p["games"], p["total_r"], p["total_rbi"], p["total_hrr"] = g, tr, trbi, thrr
    seasons = [current_season, current_season - 1, current_season - 2]
    per = [_gamelog_totals(gamelogs_by_season.get(s, [])) for s in seasons]
    # marcel_blend((made, games)) -> (eff_made, eff_games) on a single-season scale
    eff_g = marcel_blend([(g_, g_) for (g_, _, _, _) in per])[0]
    eff_r = marcel_blend([(tr_, g_) for (g_, tr_, _, _) in per])[0]
    eff_rbi = marcel_blend([(trbi_, g_) for (g_, _, trbi_, _) in per])[0]
    eff_hrr = marcel_blend([(thrr_, g_) for (g_, _, _, thrr_) in per])[0]
    p["games_hist"], p["total_r_hist"], p["total_rbi_hist"], p["total_hrr_hist"] = eff_g, eff_r, eff_rbi, eff_hrr
    return p
```

(Note: `marcel_blend` returns `(weighted_made/top_weight, weighted_pa/top_weight)`; we use index `[0]` for each blended total and the games-blend `eff_g` as the denominator so `total_x_hist / games_hist` is a properly recency-weighted per-game rate.)

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_profiles_gamelog.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add model/profiles.py tests/test_profiles_gamelog.py
git commit -m "feat: with_gamelog merges per-game R/RBI/HRR (+blended) into profiles"
```

---

### Task 5: Pipeline builders (build_runs_rows / build_rbi_rows / build_hrr_rows)

**Files:**
- Modify: `model/pipeline.py`
- Test: `tests/test_run_props_pipeline.py` (create)

**Interfaces:**
- Produces three builders, each `(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None) -> list[dict]` (bvp_fn accepted-but-unused, for signature parity). Each row carries the shared board keys (`prop, game_id, game_time, player_id, player, team, matchup, bats, lineup_status, vs, wind_*, temp_f, precip_pct`) plus its threshold probabilities:
  - Runs: `p_ge1`, `p_ge2`
  - RBI: `p_ge1`, `p_ge2`
  - HRR: `p_ge2`, `p_ge3`, `p_ge4`
- Consumes: `model.run_props` (Task 2/3), `model.parks.run_park_factor` (Task 3), `model.matchup` (`hr_platoon_mult`, `matchup`), `model.profiles` fields (`games`, `total_r`, `total_rbi`, `total_hrr`). The batter dicts from `lineups_fn` carry the `with_gamelog` fields (wired in Task 6).

Shared internal helper `_run_prop_rows(...)` mirrors the loop in `_threshold_rows` (skip started games, resolve pitchers, iterate sides/slots, build the `vs` block via `matchup(...)`). The per-batter computation differs: per-game rate → multipliers → Poisson thresholds.

- [ ] **Step 1: Write the failing test** (`tests/test_run_props_pipeline.py`)

```python
from model.pipeline import build_runs_rows, build_rbi_rows, build_hrr_rows

def _bat(pid, games, r, rbi, hrr):
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "games": games, "total_r": r, "total_rbi": rbi, "total_hrr": hrr,
            "k_rate": 0.22, "hit_rate": 0.25, "lineup_status": "confirmed"}

def _pit(pid):
    return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R",
            "k_per_bf": 0.22, "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}

_SLATE = [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
           "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
_L = lambda g: {"home": [_bat(1, 100, 60, 70, 200)], "away": [_bat(2, 100, 50, 50, 180)]}
_W = lambda g: {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}

def test_runs_rows_have_two_thresholds_in_range():
    rows = build_runs_rows(_SLATE, _L, lambda p: _pit(p), _W)
    r = next(x for x in rows if x["player_id"] == 1)
    assert 0.0 < r["p_ge1"] <= 1.0 and 0.0 <= r["p_ge2"] <= r["p_ge1"]
    assert r["prop"] == "RUNS" and r["vs"]["lean"] in ("K", "H", "NEU")

def test_rbi_and_hrr_rows_thresholds():
    rbi = build_rbi_rows(_SLATE, _L, lambda p: _pit(p), _W)[0]
    assert "p_ge1" in rbi and "p_ge2" in rbi and rbi["prop"] == "RBI"
    hrr = build_hrr_rows(_SLATE, _L, lambda p: _pit(p), _W)[0]
    assert all(k in hrr for k in ("p_ge2", "p_ge3", "p_ge4")) and hrr["prop"] == "HRR"
    assert hrr["p_ge2"] >= hrr["p_ge3"] >= hrr["p_ge4"]   # monotonic
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_run_props_pipeline.py -v`
Expected: FAIL with `ImportError: cannot import name 'build_runs_rows'`

- [ ] **Step 3: Write minimal implementation** (add to `model/pipeline.py`; reuse the existing imports for `matchup`, `hr_platoon_mult`, weather/park helpers, and the side/slot loop shape from `_threshold_rows`)

```python
from model import run_props
from model.parks import run_park_factor
from model.matchup import hr_platoon_mult, matchup

# (label, threshold-n) sets and (current-total-field, league-per-game, hist-total-field)
_RUN_PROPS = {
    "RUNS": {"thresholds": [("p_ge1", 1), ("p_ge2", 2)], "cur": "total_r",   "lg": run_props.LEAGUE_R_PER_GAME},
    "RBI":  {"thresholds": [("p_ge1", 1), ("p_ge2", 2)], "cur": "total_rbi", "lg": run_props.LEAGUE_RBI_PER_GAME},
    "HRR":  {"thresholds": [("p_ge2", 2), ("p_ge3", 3), ("p_ge4", 4)], "cur": "total_hrr", "lg": run_props.LEAGUE_HRR_PER_GAME},
}

def _run_prop_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn, *, prop):
    cfg = _RUN_PROPS[prop]
    rows = []
    for game in slate:
        if game.get("started"):
            continue
        w = _game_weather(game, weather_fn)
        lineups = lineups_fn(game)
        home_p = pitcher_fn(game.get("home_pitcher_id")) if game.get("home_pitcher_id") else None
        away_p = pitcher_fn(game.get("away_pitcher_id")) if game.get("away_pitcher_id") else None
        for side, opp in (("home", away_p), ("away", home_p)):
            team = game.get(side, "?")
            park = run_park_factor(team)
            for b in lineups.get(side, []):
                games = b.get("games", 0)
                total = b.get(cfg["cur"], 0)
                rate = run_props.regressed_per_game(total, games, cfg["lg"], run_props.REG_GAMES)
                psupp = run_props.pitcher_suppression_mult(opp.get("hit_allowed_rate", 0.22)) if opp else 1.0
                platoon = hr_platoon_mult(b.get("bats", "R"), opp.get("throws", "R")) if opp else 1.0
                lam = run_props.expected_count(rate, pitcher_mult=psupp, platoon_mult=platoon, park_mult=park)
                m = matchup(b_k=b.get("k_rate", 0.22), b_hit=b.get("hit_rate", 0.22),
                            p_k=opp.get("k_per_bf", 0.22) if opp else 0.22,
                            p_hit=opp.get("hit_allowed_rate", 0.22) if opp else 0.22,
                            bats=b.get("bats", "R"), throws=opp.get("throws", "R") if opp else "R")
                row = {
                    "prop": prop, "game_id": game.get("game_id"), "game_time": game.get("game_time"),
                    "player_id": b.get("player_id"), "player": b.get("name"), "team": team,
                    "matchup": game.get("matchup"), "bats": b.get("bats"),
                    "lineup_status": b.get("lineup_status"),
                    "recent_form_mult": 1.0, "pitcher_factor": psupp, "park_weather_factor": park,
                    "vs": ({"name": opp.get("name"), "throws": opp.get("throws"), **m} if opp else None),
                    "wind_out_mph": w.get("wind_out_mph"), "wind_mph": w.get("wind_mph"),
                    "wind_dir": w.get("wind_dir"), "temp_f": w.get("temp_f"), "precip_pct": w.get("precip_pct"),
                }
                row.update(run_props.ge_probs(lam, cfg["thresholds"]))
                rows.append(row)
    rows.sort(key=lambda r: r[cfg["thresholds"][0][0]], reverse=True)
    return rows

def build_runs_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None):
    return _run_prop_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn, prop="RUNS")

def build_rbi_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None):
    return _run_prop_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn, prop="RBI")

def build_hrr_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None):
    return _run_prop_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn, prop="HRR")
```

> Implementer note: `_game_weather`, the `vs`/`matchup` shape (`{k_prob,hit_prob,lean,prob}`), and the side/slot loop already exist in `_threshold_rows` in this file — match the existing helper names exactly (check the current `_threshold_rows` body and reuse `_game_weather` / weather field names verbatim; adjust the `w.get(...)` keys to whatever `_game_weather` returns).

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_run_props_pipeline.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_run_props_pipeline.py
git commit -m "feat: build_runs_rows / build_rbi_rows / build_hrr_rows"
```

---

### Task 6: Export wiring — history twins, profile game-logs, payload keys

**Files:**
- Modify: `model/export_web.py`
- Test: `tests/test_run_props_board.py` (create)

**Interfaces:**
- Consumes: Task 5 builders, Task 4 `profiles.with_gamelog`, Task 1 `fetch.batter_gamelog`.
- Produces: `build_board_with_history` returns `(hr, ks, hits, tb, runs, rbi, hrr)`; `main` payload gains `"runs"`, `"rbi"`, `"hrr"` keys. `make_profile_fns`' batter profile dicts gain the `with_gamelog` fields (current + `_hist`).

- [ ] **Step 1: Write the failing test** (`tests/test_run_props_board.py`)

```python
from model.export_web import build_board_with_history

def _bat(pid, games, r, rbi, hrr):
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "games": games, "total_r": r, "total_rbi": rbi, "total_hrr": hrr,
            "games_hist": games, "total_r_hist": r, "total_rbi_hist": rbi, "total_hrr_hist": hrr,
            "k_rate": 0.22, "hit_rate": 0.25, "lineup_status": "confirmed",
            "season_pa": 400, "season_1b": 90, "season_2b": 25, "season_3b": 3, "season_hr": 20,
            "recent_form_mult": 1.0}
def _pit(pid):
    return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R", "k_per_bf": 0.22,
            "k_line": 5.5, "expected_bf": 24, "opponent_k_mult": 1.0,
            "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}

def test_board_includes_runs_rbi_hrr_with_hist():
    slate = [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    cur = lambda g: {"home": [_bat(1, 100, 60, 70, 200)], "away": [_bat(2, 100, 50, 50, 180)]}
    w = lambda g: {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}
    out = build_board_with_history(slate, cur, lambda p: _pit(p), cur, lambda p: _pit(p), w, None)
    assert len(out) == 7
    hr, ks, hits, tb, runs, rbi, hrr = out
    assert "p_ge1_hist" in runs[0] and "p_ge1_hist" in rbi[0]
    assert "p_ge2_hist" in hrr[0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_run_props_board.py -v`
Expected: FAIL — `build_board_with_history` returns 4 values (ValueError unpacking 7), and no `runs` builder is called.

- [ ] **Step 3: Write minimal implementation** (edit `model/export_web.py`)

In `build_board_with_history`, import and build the three new current + `_h` history dicts (mirror the hits/tb pattern), attach threshold `_hist` twins, and return them:

```python
from model.pipeline import build_runs_rows, build_rbi_rows, build_hrr_rows
# ... inside build_board_with_history, after tb is built:
runs = build_runs_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=bvp_fn)
rbi  = build_rbi_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=bvp_fn)
hrr  = build_hrr_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=bvp_fn)
runs_h = {_key(r): r for r in build_runs_rows(slate, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn=bvp_fn) if r.get("player_id") is not None}
rbi_h  = {_key(r): r for r in build_rbi_rows(slate, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn=bvp_fn) if r.get("player_id") is not None}
hrr_h  = {_key(r): r for r in build_hrr_rows(slate, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn=bvp_fn) if r.get("player_id") is not None}

_runs_thresholds = ("p_ge1", "p_ge2")
_hrr_thresholds = ("p_ge2", "p_ge3", "p_ge4")
_run_factor_fields = ("recent_form_mult", "pitcher_factor", "park_weather_factor")

def _attach(rows, hist_map, thresholds):
    for r in rows:
        h = hist_map.get(_key(r))
        if not h:
            continue
        for field in thresholds:
            if field in h:
                r[f"{field}_hist"] = h[field]
        for field in _run_factor_fields:
            if field in h:
                r[f"{field}_hist"] = h[field]
        if r.get("vs") and h.get("vs"):
            _copy_vs(r["vs"], h["vs"])

_attach(runs, runs_h, _runs_thresholds)
_attach(rbi, rbi_h, _runs_thresholds)
_attach(hrr, hrr_h, _hrr_thresholds)
# change the return:
return hr, ks, hits, tb, runs, rbi, hrr
```

Update `main` (the unpack + payload):
```python
hr_rows, k_rows, hits_rows, tb_rows, runs_rows, rbi_rows, hrr_rows = build_board_with_history(...)
payload = {
    "date": date_str,
    "updated": dt.datetime.now(dt.timezone.utc).isoformat(),
    "hr": hr_rows, "strikeouts": k_rows, "hits": hits_rows, "total_bases": tb_rows,
    "runs": runs_rows, "rbi": rbi_rows, "hrr": hrr_rows,
    "games": build_games(slate, weather_fn),
}
```

In `make_profile_fns`, wire game-logs into the batter profile dicts so the pipeline batter dicts carry `games`/`total_r`/`total_rbi`/`total_hrr` (+ `_hist`). Where `batter_fn`/`batter_hist_fn` build the profile (the `get_or_compute("bat-events-...")` site), add:
```python
gamelogs = {s: cache.get_or_compute(f"bat-gamelog-{pid}-{s}", lambda s=s: fetch.batter_gamelog(pid, s))
            for s in (season, season - 1, season - 2)}
prof = profiles.with_gamelog(prof, gamelogs, current_season=season)
```
(Apply to BOTH the current and history batter profile fns so the `_hist` twins exist; `with_gamelog` adds both current and blended fields, so one call per profile suffices.)

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_run_props_board.py tests/test_export_web.py tests/test_threshold_board.py -v`
Expected: PASS — new test passes AND the existing board tests still pass (HR/Hits/TB unchanged; any test that unpacks `build_board_with_history`'s return must be updated to 7-tuple — fix those in this step).

- [ ] **Step 5: Commit**

```bash
git add model/export_web.py tests/test_run_props_board.py
git commit -m "feat: export runs/rbi/hrr rows with _hist twins + game-log profiles"
```

---

### Task 7: Frontend types

**Files:**
- Modify: `web/lib/types.ts`

**Interfaces:**
- Produces: `RunsRow`, `RbiRow`, `HrrRow` types and `Projections` keys `runs?`, `rbi?`, `hrr?`.

- [ ] **Step 1: Add the types** (mirror `HitsRow`/`TbRow`; reuse the shared base via `Omit`)

```ts
export type RunsRow = Omit<HitsRow, "p_ge1" | "p_ge2" | "p_ge3" | "p_ge1_hist" | "p_ge2_hist" | "p_ge3_hist"> & {
  p_ge1: number; p_ge2: number;
  p_ge1_hist?: number; p_ge2_hist?: number;
  park_weather_factor?: number; park_weather_factor_hist?: number;
};
export type RbiRow = RunsRow;
export type HrrRow = Omit<HitsRow, "p_ge1" | "p_ge2" | "p_ge3" | "p_ge1_hist" | "p_ge2_hist" | "p_ge3_hist"> & {
  p_ge2: number; p_ge3: number; p_ge4: number;
  p_ge2_hist?: number; p_ge3_hist?: number; p_ge4_hist?: number;
  park_weather_factor?: number; park_weather_factor_hist?: number;
};
```

Add to `Projections`:
```ts
  runs?: RunsRow[];
  rbi?: RbiRow[];
  hrr?: HrrRow[];
```

- [ ] **Step 2: Verify typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add web/lib/types.ts
git commit -m "feat(web): RunsRow/RbiRow/HrrRow types"
```

---

### Task 8: PropKind / TIERS / HEAT for the new props

**Files:**
- Modify: `web/lib/format.ts`
- Test: `web/components/tests/format.test.ts`

**Interfaces:**
- Produces: `PropKind` gains `"runs1" | "runs2" | "rbi1" | "rbi2" | "hrr2" | "hrr3" | "hrr4"`; `TIERS` and `HEAT` gain matching entries (the `Record<PropKind, …>` makes these compile-time-required).

- [ ] **Step 1: Write the failing test** (add to `web/components/tests/format.test.ts`)

```ts
import { strengthLabel, heatColor } from "../../lib/format";

test("new props have strength tiers and heat colors", () => {
  expect(strengthLabel(0.6, "runs1")).toMatch(/STRONG|Lean|Pass/);
  expect(heatColor(0.4, "hrr2")).toMatch(/^hsl\(/);
  expect(strengthLabel(0.05, "rbi2")).toBe("Pass");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm test -- format`
Expected: FAIL — `"runs1"` not assignable to `PropKind` (tsc error in test) / missing entries.

- [ ] **Step 3: Implement** (edit `web/lib/format.ts`)

Extend the union:
```ts
export type PropKind = "hr" | "k" | "hits1" | "hits2" | "hits3" | "tb2" | "tb3" | "tb4"
  | "runs1" | "runs2" | "rbi1" | "rbi2" | "hrr2" | "hrr3" | "hrr4";
```

Add to `TIERS` (⚠️ calibration — sign-off; starting values reflect that 1+ run/RBI is roughly a coin-flip for a good hitter, HRR ~2 is common):
```ts
  runs1: { strong: 0.55, lean: 0.45 },
  runs2: { strong: 0.18, lean: 0.10 },
  rbi1:  { strong: 0.55, lean: 0.45 },
  rbi2:  { strong: 0.20, lean: 0.12 },
  hrr2:  { strong: 0.62, lean: 0.52 },
  hrr3:  { strong: 0.38, lean: 0.28 },
  hrr4:  { strong: 0.20, lean: 0.12 },
```

Add to `HEAT` (lo ≈ lean − ~0.07, span ≈ strong − lo + ~0.05, same convention as the existing rows):
```ts
  runs1: { lo: 0.38, span: 0.24 },
  runs2: { lo: 0.04, span: 0.20 },
  rbi1:  { lo: 0.38, span: 0.24 },
  rbi2:  { lo: 0.06, span: 0.20 },
  hrr2:  { lo: 0.45, span: 0.24 },
  hrr3:  { lo: 0.21, span: 0.24 },
  hrr4:  { lo: 0.05, span: 0.20 },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test -- format && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/format.ts web/components/tests/format.test.ts
git commit -m "feat(web): PropKind/TIERS/HEAT for runs/rbi/hrr"
```

---

### Task 9: Board page wiring (pills, thresholds, row maps)

**Files:**
- Modify: `web/app/page.tsx`

**Interfaces:**
- Consumes: Tasks 7–8. Produces: `runsRows`/`rbiRows`/`hrrRows` (typed `BoardRow[]`), three new pills, threshold pills, URL-param restore, and board/TopPlays/Parks wiring. The `prop` state widens to include `"runs" | "rbi" | "hrr"`; the `threshold` state gains `runs: 1 | 2`, `rbi: 1 | 2`, `hrr: 2 | 3 | 4`.

- [ ] **Step 1: Widen state**

```tsx
const [prop, setProp] = useState<"hr" | "k" | "hits" | "tb" | "runs" | "rbi" | "hrr">("hr");
const [threshold, setThreshold] = useState<{ hits: 1 | 2 | 3; tb: 2 | 3 | 4; runs: 1 | 2; rbi: 1 | 2; hrr: 2 | 3 | 4 }>(
  { hits: 1, tb: 2, runs: 1, rbi: 1, hrr: 2 });
```
> Any other `setThreshold((t) => ({ ...t, hits: n }))` calls keep working (spread preserves new keys). Update the `TopPlays` prop type for `threshold`/`setThreshold` accordingly in Task 10.

- [ ] **Step 2: URL-param restore** (extend the existing `propParam`/`tp` block)

```tsx
else if (propParam === "runs") setProp("runs");
else if (propParam === "rbi") setProp("rbi");
else if (propParam === "hrr") setProp("hrr");
if (propParam === "runs" && (tp === "1" || tp === "2")) setThreshold((t) => ({ ...t, runs: Number(tp) as 1 | 2 }));
if (propParam === "rbi" && (tp === "1" || tp === "2")) setThreshold((t) => ({ ...t, rbi: Number(tp) as 1 | 2 }));
if (propParam === "hrr" && (tp === "2" || tp === "3" || tp === "4")) setThreshold((t) => ({ ...t, hrr: Number(tp) as 2 | 3 | 4 }));
```

- [ ] **Step 3: Prob helpers + dateQ** (mirror `hitsProb`/`tbProb`/`hitsDateQ`)

```tsx
function runsProb(r: RunsRow, n: 1 | 2): number {
  return pickN(n === 1 ? r.p_ge1 : r.p_ge2, n === 1 ? r.p_ge1_hist : r.p_ge2_hist);
}
function rbiProb(r: RbiRow, n: 1 | 2): number {
  return pickN(n === 1 ? r.p_ge1 : r.p_ge2, n === 1 ? r.p_ge1_hist : r.p_ge2_hist);
}
function hrrProb(r: HrrRow, n: 2 | 3 | 4): number {
  const base = n === 2 ? r.p_ge2 : n === 3 ? r.p_ge3 : r.p_ge4;
  const hist = n === 2 ? r.p_ge2_hist : n === 3 ? r.p_ge3_hist : r.p_ge4_hist;
  return pickN(base, hist);
}
const runsDateQ = `${selectedDate ? `?date=${selectedDate}&` : "?"}prop=runs&threshold=${threshold.runs}${srcParam ? `&${srcParam}` : ""}`;
const rbiDateQ = `${selectedDate ? `?date=${selectedDate}&` : "?"}prop=rbi&threshold=${threshold.rbi}${srcParam ? `&${srcParam}` : ""}`;
const hrrDateQ = `${selectedDate ? `?date=${selectedDate}&` : "?"}prop=hrr&threshold=${threshold.hrr}${srcParam ? `&${srcParam}` : ""}`;
```
Import `RunsRow, RbiRow, HrrRow` from `../lib/types`.

- [ ] **Step 4: Row maps** (copy the `tbRows` map verbatim three times; change `id` prefix, `data` source, `prob`, `detail`, `href`)

```tsx
const runsRows: BoardRow[] = (data.runs ?? []).map((r) => ({
  id: `runs-${r.player_id ?? r.player}-${r.game_id ?? ""}`,
  player: r.player, team: r.team,
  prob: runsProb(r, threshold.runs),
  detail: `${threshold.runs}+ runs`,
  href: `/player/runs/${r.player_id ?? encodeURIComponent(r.player)}${runsDateQ}`,
  time: gameTimeLabel(r.game_time), timeSort: r.game_time, matchup: r.matchup,
  gameId: r.game_id != null ? String(r.game_id) : undefined,
  hand: r.bats ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}` : undefined,
  playerHand: batHand(r.bats),
  opponent: r.vs ? { name: r.vs.name, hand: pitchHand(r.vs.throws) } : undefined,
  bvp: r.vs?.bvp, lean: leanFor(r.vs),
  hitProb: r.vs ? pickN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
  kProb: r.vs ? pickN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
  status: r.lineup_status, windOut: r.wind_out_mph, windMph: r.wind_mph,
  windDir: r.wind_dir, tempF: r.temp_f, precipPct: r.precip_pct,
}));
// rbiRows: identical with `rbi-`, data.rbi, rbiProb(r, threshold.rbi), `${threshold.rbi}+ RBI`, /player/rbi/...${rbiDateQ}
// hrrRows: identical with `hrr-`, data.hrr, hrrProb(r, threshold.hrr), `${threshold.hrr}+ H+R+RBI`, /player/hrr/...${hrrDateQ}
```
Add to the sort block: `runsRows.sort((a,b)=>b.prob-a.prob); rbiRows.sort(...); hrrRows.sort(...);`

- [ ] **Step 5: Pills + threshold pills** (add to the prop pill list and add three threshold pillbars)

Prop pills — append:
```tsx
["runs", "Runs"], ["rbi", "RBI"], ["hrr", "H+R+RBI"],
```
Threshold pills — add three blocks mirroring the hits/tb ones:
```tsx
{prop === "runs" && (<div className="pillbar">{([1,2] as const).map((n)=>(
  <button key={n} onClick={()=>setThreshold((t)=>({...t,runs:n}))} data-active={threshold.runs===n} className="pill">{n}+</button>))}</div>)}
{prop === "rbi" && (<div className="pillbar">{([1,2] as const).map((n)=>(
  <button key={n} onClick={()=>setThreshold((t)=>({...t,rbi:n}))} data-active={threshold.rbi===n} className="pill">{n}+</button>))}</div>)}
{prop === "hrr" && (<div className="pillbar">{([2,3,4] as const).map((n)=>(
  <button key={n} onClick={()=>setThreshold((t)=>({...t,hrr:n}))} data-active={threshold.hrr===n} className="pill">{n}+</button>))}</div>)}
```

- [ ] **Step 6: Board / TopPlays / Parks wiring** (extend the section that picks rows + kind)

In the `PropBoard` branch, extend `rows` and `kind`:
```tsx
rows={prop === "hr" ? hrRows : prop === "k" ? kRows : prop === "hits" ? hitsRows : prop === "tb" ? tbRows
      : prop === "runs" ? runsRows : prop === "rbi" ? rbiRows : hrrRows}
kind={
  prop === "k" ? "k"
  : prop === "hits" ? (`hits${threshold.hits}` as PropKind)
  : prop === "tb"   ? (`tb${threshold.tb}`   as PropKind)
  : prop === "runs" ? (`runs${threshold.runs}` as PropKind)
  : prop === "rbi"  ? (`rbi${threshold.rbi}`  as PropKind)
  : prop === "hrr"  ? (`hrr${threshold.hrr}`  as PropKind)
  : "hr"
}
```
Pass `runsRows`/`rbiRows`/`hrrRows` + `runsKind`/`rbiKind`/`hrrKind` to `<TopPlays>` and `<ParksBoard>` (define `const runsKind = \`runs${threshold.runs}\` as PropKind;` etc.).

- [ ] **Step 7: Verify typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: errors only from `TopPlays`/`ParksBoard`/`PropBoard` not yet accepting the new props (fixed in Tasks 10–12). Page-local code must be clean.

- [ ] **Step 8: Commit**

```bash
git add web/app/page.tsx
git commit -m "feat(web): runs/rbi/hrr pills, thresholds, rows, board wiring"
```

---

### Task 10: Top Plays sections

**Files:**
- Modify: `web/components/TopPlays.tsx`

**Interfaces:**
- Consumes: `runsRows`/`rbiRows`/`hrrRows` + `runsKind`/`rbiKind`/`hrrKind` + the widened `threshold`/`setThreshold` from Task 9.

- [ ] **Step 1: Widen the component props**

```tsx
runsRows: BoardRow[]; rbiRows: BoardRow[]; hrrRows: BoardRow[];
runsKind: PropKind; rbiKind: PropKind; hrrKind: PropKind;
threshold: { hits: 1|2|3; tb: 2|3|4; runs: 1|2; rbi: 1|2; hrr: 2|3|4 };
setThreshold: React.Dispatch<React.SetStateAction<{ hits: 1|2|3; tb: 2|3|4; runs: 1|2; rbi: 1|2; hrr: 2|3|4 }>>;
```
Add `const runsThresh = runsKind.replace("runs",""); const rbiThresh = rbiKind.replace("rbi",""); const hrrThresh = hrrKind.replace("hrr","");`

- [ ] **Step 2: Add three `<LeaderSection>`s** (copy the "Top Total Bases" block verbatim, swap labels/kind/threshold)

```tsx
<LeaderSection title="Top Runs" sub={`chance to score ${runsThresh}+ runs`}
  tip="Batters most likely to score the selected number of runs."
  rows={runsRows} count={count}
  render={(r) => <TopPlayRow key={r.id} r={r} sphere={<HeatSphere prob={r.prob} kind={runsKind} />} />}
  controls={<div className="pillbar" onClick={(e)=>e.stopPropagation()} style={{flexShrink:0}}>
    {([1,2] as const).map((n)=>(<button key={n} className="pill" data-active={threshold.runs===n}
      style={{padding:"0.16rem 0.45rem",fontSize:"0.62rem"}}
      onClick={(e)=>{e.preventDefault();e.stopPropagation();setThreshold((t)=>({...t,runs:n}));}}>{n}+</button>))}</div>} />
// Top RBI: same with rbiRows/rbiKind/[1,2]/rbi, sub "reach {rbiThresh}+ RBI"
// Top HRR: same with hrrRows/hrrKind/[2,3,4]/hrr, sub "reach {hrrThresh}+ hits+runs+RBI"
```

- [ ] **Step 3: Verify typecheck** — `cd web && npx tsc --noEmit` (TopPlays now clean).

- [ ] **Step 4: Commit**

```bash
git add web/components/TopPlays.tsx
git commit -m "feat(web): Top Runs / Top RBI / Top HRR sections"
```

---

### Task 11: Game Hub — 4→7 breakdown columns

**Files:**
- Modify: `web/components/PropBoard.tsx`

**Interfaces:**
- Consumes: `runsRows`/`rbiRows`/`hrrRows` + their kinds, threaded through `GameBreakdown` → `ColSplit` → `ColTeam` → `ColHeaders`/`ColBatterRow`.

- [ ] **Step 1: Widen the grid + sort type**

```tsx
const COL_GRID = `minmax(0, 1fr) repeat(7, ${COL_SLOT}px)`;
type SortCol = "lean" | "hr" | "hits" | "tb" | "runs" | "rbi" | "hrr";
```

- [ ] **Step 2: `ColHeaders`** — add `runsKind`/`rbiKind`/`hrrKind` props, derive labels, add 3 `cell(...)`:

```tsx
const runsLabel = runsKind === "runs1" ? "1R+" : "2R+";
const rbiLabel = rbiKind === "rbi1" ? "1RBI+" : "2RBI+";
const hrrLabel = hrrKind === "hrr2" ? "2HRR+" : hrrKind === "hrr3" ? "3HRR+" : "4HRR+";
// ...after {cell(tbLabel, "tb")}:
{cell(runsLabel, "runs")}
{cell(rbiLabel, "rbi")}
{cell(hrrLabel, "hrr")}
```

- [ ] **Step 3: `ColBatterRow`** — add `runsRow`/`rbiRow`/`hrrRow` (+ kinds) props and 3 sphere cells:

```tsx
{sphereCell(runsRow ? <HeatSphere prob={runsRow.prob} kind={runsKind} size={COL_SPHERE} /> : null, "runs")}
{sphereCell(rbiRow ? <HeatSphere prob={rbiRow.prob} kind={rbiKind} size={COL_SPHERE} /> : null, "rbi")}
{sphereCell(hrrRow ? <HeatSphere prob={hrrRow.prob} kind={hrrKind} size={COL_SPHERE} /> : null, "hrr")}
```

- [ ] **Step 4: `ColTeam`** — thread `runsByPlayer`/`rbiByPlayer`/`hrrByPlayer` maps + kinds; add to `metric`:

```tsx
if (sort.col === "runs") return runsByPlayer.get(r.player)?.prob ?? 0;
if (sort.col === "rbi") return rbiByPlayer.get(r.player)?.prob ?? 0;
if (sort.col === "hrr") return hrrByPlayer.get(r.player)?.prob ?? 0;
```
and pass the rows/kinds into `ColHeaders` + `ColBatterRow`.

- [ ] **Step 5: `ColSplit` + `GameBreakdown`** — add `runsRows`/`rbiRows`/`hrrRows` + kinds to both prop lists; build `runsByPlayer = new Map(runsRows.map(r=>[r.player,r]))` etc.; filter by `inGame` in `GameBreakdown` like hits/tb; pass through.

- [ ] **Step 6: Make the grid scroll on narrow screens** — wrap the breakdown in a horizontally scrollable container (the `GameBreakdown` root): `style={{ overflowX: "auto" }}` plus a `minWidth` on the grid rows equal to `name + 7*COL_SLOT + gaps` so columns don't crush on mobile. (Add `overflowX:"auto"` to the wrapping div around the `ColSplit` output.)

- [ ] **Step 7: Verify typecheck** — `cd web && npx tsc --noEmit`.

- [ ] **Step 8: Commit**

```bash
git add web/components/PropBoard.tsx
git commit -m "feat(web): Game Hub breakdown 7 columns (add Runs/RBI/HRR)"
```

---

### Task 12: ParksBoard threading

**Files:**
- Modify: `web/components/ParksBoard.tsx`

- [ ] **Step 1: Accept + forward the new props** — add `runsRows`/`rbiRows`/`hrrRows` + `runsKind`/`rbiKind`/`hrrKind` to the `ParksBoard` props type, and pass them into every `<GameBreakdown ... />` call (mirroring how `hitsRows`/`tbRows`/`hitsKind`/`tbKind` are passed today).

- [ ] **Step 2: Verify typecheck** — `cd web && npx tsc --noEmit` (whole app clean now).

- [ ] **Step 3: Commit**

```bash
git add web/components/ParksBoard.tsx
git commit -m "feat(web): thread runs/rbi/hrr through ParksBoard to Game Hub"
```

---

### Task 13: Player detail pages

**Files:**
- Modify: `web/app/player/[prop]/[id]/page.tsx`

**Interfaces:**
- Consumes: the `/player/runs|rbi|hrr/...` hrefs from Task 9. Produces: detail blocks for the three props + the `Back` query chain.

- [ ] **Step 1: Threshold parse + Back chain**

```tsx
const runsThreshold: 1 | 2 = (thresholdParam === "2" ? 2 : 1);
const rbiThreshold: 1 | 2 = (thresholdParam === "2" ? 2 : 1);
const hrrThreshold: 2 | 3 | 4 = (thresholdParam === "3" ? 3 : thresholdParam === "4" ? 4 : 2);
```
In `Back`, extend the `if (prop === ...)` chain: `if (prop === "runs") q.set("prop","runs");` (same for rbi, hrr), and keep the existing `threshold` set guarded for these props too.

- [ ] **Step 2: Add detail blocks** (mirror the `if (prop === "hits")` block; lookup row, headline threshold stats via `pick`, the "what's driving it" factors using `pitcher_factor`/`park_weather_factor`/`recent_form_mult`, the pitcher-matchup `LeanPair`, conditions). Runs/RBI show their 2 thresholds; HRR shows 3.

```tsx
if (prop === "runs" || prop === "rbi") {
  const arr = prop === "runs" ? (data.runs ?? []) : (data.rbi ?? []);
  const r = arr.find((x) => String(x.player_id) === id) ?? arr.find((x) => x.player === name);
  if (!r) return notFound;
  const n = prop === "runs" ? runsThreshold : rbiThreshold;
  const kind = (`${prop}${n}`) as PropKind;
  const p1 = pick(r.p_ge1, r.p_ge1_hist), p2 = pick(r.p_ge2, r.p_ge2_hist);
  // render: header (team/hand/prop/time), headline Stats (1+ glow on n===1, 2+ glow on n===2),
  // "what's driving it" Factors (pitcher_factor, park_weather_factor, recent_form_mult),
  // pitcher matchup LeanPair (k_prob/hit_prob), Conditions WeatherStrip — same structure as the hits block.
}
if (prop === "hrr") {
  const r = (data.hrr ?? []).find((x) => String(x.player_id) === id) ?? (data.hrr ?? []).find((x) => x.player === name);
  if (!r) return notFound;
  const kind = (`hrr${hrrThreshold}`) as PropKind;
  const p2 = pick(r.p_ge2, r.p_ge2_hist), p3 = pick(r.p_ge3, r.p_ge3_hist), p4 = pick(r.p_ge4, r.p_ge4_hist);
  // render mirrors the TB block (3 thresholds, glow on the selected one) + matchup + factors + conditions.
}
```
> Implementer: open the existing `if (prop === "hits")` and `if (prop === "tb")` blocks and copy their exact JSX structure (Stat/Factor/LeanPair/WeatherStrip usage, `animationDelay` rhythm, the eyebrow header line). Use the prop's label ("Run"/"RBI"/"Hits+Runs+RBI") in the eyebrow and a one-line note that these props are inherently noisier than HR/K.

- [ ] **Step 3: Verify typecheck + build** — `cd web && npx tsc --noEmit && npm run build` (build typechecks the dynamic route).

- [ ] **Step 4: Commit**

```bash
git add "web/app/player/[prop]/[id]/page.tsx"
git commit -m "feat(web): runs/rbi/hrr player detail pages"
```

---

### Task 14: End-to-end preview + honesty note

**Files:**
- Modify: `web/app/page.tsx` (small copy note) — optional shared note that R/RBI/HRR are estimates.

- [ ] **Step 1: Regenerate a local board with the new props** so preview shows real numbers:

Run: `uv run python -m model.export_web` (writes `web/public/data/...`) OR `uv run pytest` to confirm the whole Python suite is green first.
Expected: board JSON now contains `runs`, `rbi`, `hrr` arrays.

- [ ] **Step 2: Preview** — start/verify the dev server, open localhost, click through: the 3 new pills + thresholds, Top Plays sections, Game Hub 7-column breakdown (scroll + sort the new columns), and a Runs/RBI/HRR player page. Confirm Current/Blend/History all shift the numbers.

- [ ] **Step 3: Final whole-branch review** (per subagent-driven-development) then ship: rebase onto origin/main, merge, push, `gh workflow run board-refresh.yml -f force_deploy=true`, watch it green, verify on prod.

- [ ] **Step 4: Commit any preview-driven fixes; update the roadmap memory** (mark Runs/RBI/HRR shipped; note the Poisson→better-distribution and real-run-park-factors upgrades remain).

---

## Self-Review

**Spec coverage:** new data (T1) ✓; per-game rate model + regression + Poisson (T2) ✓; pitcher-suppression + park (T3) ✓; game-log profiles + blend twins (T4, T6) ✓; three builders with correct thresholds (T5) ✓; export twins + payload (T6) ✓; HR/Hits/TB unchanged (additive + tests in T6) ✓; pills/thresholds/board (T9) ✓; Top Plays (T10) ✓; Game Hub 7 columns + scroll (T11) ✓; Parks threading (T12) ✓; player pages (T13) ✓; Current/Blend/History (frontend `pickN`/`pick` already 3-way, T9/T13) ✓; honesty note (T13/T14) ✓; out-of-scope C/B + Poisson + real run factors flagged ✓.

**Calibration constants needing sign-off (surface at review):** `run_props.LEAGUE_*_PER_GAME`, `REG_GAMES`, `pitcher_suppression_mult` clamps/league, `run_park_factor` 0.6 dampen, and the `TIERS`/`HEAT` values in Task 8. These are the model-math knobs.

**Type consistency:** `BoardRow` fields (`prob`, `lean`, `kProb`, `hitProb`) used in T9 match PropBoard's existing `BoardRow`. `PropKind` strings (`runs1`…`hrr4`) are consistent across format.ts (T8), page.tsx kinds (T9), TopPlays (T10), PropBoard ColHeaders/ColBatterRow (T11). Row threshold fields (`p_ge1/p_ge2` for runs/rbi, `p_ge2/p_ge3/p_ge4` for hrr) consistent backend (T5) ↔ types (T7) ↔ page maps (T9) ↔ player page (T13).
