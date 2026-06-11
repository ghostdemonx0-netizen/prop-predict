# Live Data Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `model/export_web.py` produce the website's `latest.json` from REAL games — with player handedness, side-split lineups, batter/pitcher rates, and computed batter-vs-pitcher matchups — fast enough to run via a disk cache.

**Architecture:** Add a thin disk cache so each player's slow Statcast pull happens once per day. Extend the profile builders with the rates + handedness the matchup math needs. Add side-aware lineup + handedness fetchers. Restructure the pipeline so it pairs each hitter with the opposing starter (for `vs`) and each pitcher with the opposing lineup (for `matchups`). Wire it all in `export_web`. Pure logic is unit-tested; network paths get `smoke` tests.

**Tech Stack:** Existing engine (`model/`), `pybaseball`, `MLB-StatsAPI`, `pytest`. No new dependencies.

---

## File Structure

```
prop-predict/
  model/
    cache.py        # CREATE: tiny per-day disk cache (get_or_compute)
    fetch.py        # MODIFY: get_player_meta (name+bats+throws); get_lineups (by side);
                    #         build_batter_profile adds k_rate/hit_rate/bats;
                    #         build_pitcher_profile adds hit_allowed_rate/throws
    pipeline.py     # MODIFY: build_hr_rows + build_strikeout_rows pair by side, attach vs/matchups
    export_web.py   # MODIFY: use cache + new fetchers + side-aware wiring
  tests/
    test_cache.py       # CREATE
    test_pipeline.py    # MODIFY: new signatures + vs/matchups assertions
    test_fetch_smoke.py # MODIFY: smoke tests for get_player_meta + get_lineups
    fixtures.py         # MODIFY: side-split lineups + rates + handedness
```

**Key interface decisions (used across tasks):**
- **batter profile dict:** `{player_id, name, team, bats, season_hr, season_pa, expected_pa, recent_form_mult, matchup_mult, k_rate, hit_rate}`
- **pitcher profile dict:** `{player_id, name, team, throws, k_per_bf, expected_bf, opponent_k_mult, k_line, hit_allowed_rate}`
- **`lineups_fn(game)`** returns `{"home": [batter_profile, ...], "away": [batter_profile, ...]}`
- **`pitcher_fn(pid)`** returns a pitcher profile
- Pairing: home batters face the **away** starter (`away_pitcher_id`); away batters face the **home** starter (`home_pitcher_id`). Home pitcher faces the **away** lineup; away pitcher faces the **home** lineup.

---

### Task 1: Per-day disk cache

**Files:**
- Create: `model/cache.py`
- Test: `tests/test_cache.py`

- [ ] **Step 1: Write the failing test**

`tests/test_cache.py`:
```python
from model.cache import get_or_compute


def test_computes_then_caches(tmp_path):
    calls = {"n": 0}

    def producer():
        calls["n"] += 1
        return {"v": 42}

    a = get_or_compute("k1", producer, cache_dir=tmp_path)
    b = get_or_compute("k1", producer, cache_dir=tmp_path)
    assert a == {"v": 42}
    assert b == {"v": 42}
    assert calls["n"] == 1  # second call served from cache, producer not re-run


def test_distinct_keys_are_independent(tmp_path):
    get_or_compute("a", lambda: {"v": 1}, cache_dir=tmp_path)
    out = get_or_compute("b", lambda: {"v": 2}, cache_dir=tmp_path)
    assert out == {"v": 2}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && uv run pytest tests/test_cache.py -v`
Expected: FAIL (ModuleNotFoundError: No module named 'model.cache').

- [ ] **Step 3: Write minimal implementation**

`model/cache.py`:
```python
"""Tiny JSON disk cache so slow per-player fetches happen once per run/day.

Keys are sanitized into filenames under cache_dir. Callers include the date
in the key (e.g. "batter-592450-2026") so a new day naturally uses fresh
files; old files can simply be deleted.
"""

import json
import re
from pathlib import Path
from typing import Callable

DEFAULT_DIR = Path(__file__).resolve().parent.parent / ".cache"


def _safe(key: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", key)


def get_or_compute(key: str, producer: Callable[[], dict], cache_dir=DEFAULT_DIR) -> dict:
    """Return cached JSON for `key`, or run `producer()`, cache, and return it."""
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_dir / f"{_safe(key)}.json"
    if path.exists():
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            pass  # fall through and recompute on a corrupt/unreadable file
    value = producer()
    path.write_text(json.dumps(value))
    return value
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_cache.py -v`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add model/cache.py tests/test_cache.py
echo ".cache/" >> .gitignore
git add .gitignore
git commit -m "feat: add per-day JSON disk cache for slow fetches"
```

---

### Task 2: Player metadata (name + handedness)

**Files:**
- Modify: `model/fetch.py` (add `get_player_meta`)
- Test: `tests/test_fetch_smoke.py` (append)

- [ ] **Step 1: Append a smoke test** to `tests/test_fetch_smoke.py`:

```python
def test_get_player_meta_smoke():
    from model.fetch import get_player_meta
    meta = get_player_meta([592450, 669373])  # Judge (R bats), Skubal (L throws)
    assert meta[592450]["name"] == "Aaron Judge"
    assert meta[592450]["bats"] in {"L", "R", "S"}
    assert meta[669373]["throws"] in {"L", "R"}
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -k player_meta -v`
Expected: FAIL (ImportError: cannot import name 'get_player_meta').

- [ ] **Step 3: Append the implementation** to `model/fetch.py`:

```python
def get_player_meta(player_ids: list[int]) -> dict[int, dict]:
    """Map MLBAM ids to {"name", "bats", "throws"} via the MLB Stats API.

    bats/throws are single letters L/R/S (S = switch). Unknown ids omitted.
    """
    ids = [pid for pid in player_ids if pid]
    if not ids:
        return {}
    try:
        data = statsapi.get("people", {"personIds": ",".join(str(i) for i in ids)})
    except Exception:
        return {}
    out: dict[int, dict] = {}
    for person in data.get("people", []):
        out[int(person["id"])] = {
            "name": person.get("fullName", str(person["id"])),
            "bats": (person.get("batSide") or {}).get("code", "R"),
            "throws": (person.get("pitchHand") or {}).get("code", "R"),
        }
    return out
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -k player_meta -v`
Expected: PASS. If `batSide`/`pitchHand` keys differ, inspect one record with
`uv run python -c "import statsapi,json; print(json.dumps(statsapi.get('people',{'personIds':'592450'})['people'][0], indent=2)[:1200])"`
and adjust the key paths, keeping the `{name,bats,throws}` shape. Report any change.

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py tests/test_fetch_smoke.py
git commit -m "feat: fetch player handedness (bats/throws) + name"
```

---

### Task 3: Side-split lineups

**Files:**
- Modify: `model/fetch.py` (add `get_lineups`)
- Test: `tests/test_fetch_smoke.py` (append)

- [ ] **Step 1: Append a smoke test** to `tests/test_fetch_smoke.py`:

```python
def test_get_lineups_smoke():
    from model.fetch import get_schedule, get_lineups
    games = get_schedule("2026-06-10")
    started = [g for g in games if g["started"]]
    assert started, "need a finished game to guarantee posted lineups"
    lns = get_lineups(started[0]["game_id"])
    assert set(lns) == {"home", "away"}
    assert isinstance(lns["home"], list) and isinstance(lns["away"], list)
    # a played game has batting orders for both sides
    assert len(lns["home"]) >= 1 and len(lns["away"]) >= 1
    assert all(isinstance(pid, int) for pid in lns["home"] + lns["away"])
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -k get_lineups -v`
Expected: FAIL (ImportError: cannot import name 'get_lineups').

- [ ] **Step 3: Append the implementation** to `model/fetch.py`:

```python
def get_lineups(game_id: int) -> dict[str, list[int]]:
    """Batting-order MLBAM ids split by side: {"home": [...], "away": [...]}.

    Empty lists if lineups are not posted yet.
    """
    try:
        box = statsapi.boxscore_data(game_id)
    except Exception:
        return {"home": [], "away": []}
    out: dict[str, list[int]] = {"home": [], "away": []}
    for side in ("home", "away"):
        order = box.get(side, {}).get("battingOrder", []) or []
        out[side] = [int(pid) for pid in order]
    return out
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -k get_lineups -v`
Expected: PASS. If `2026-06-10` has no finished game, change the date in the test to a recent past date that does. Note any change.

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py tests/test_fetch_smoke.py
git commit -m "feat: fetch lineups split by home/away side"
```

---

### Task 4: Rates on player profiles

**Files:**
- Modify: `model/fetch.py` (`build_batter_profile`, `build_pitcher_profile`)
- Test: `tests/test_fetch_smoke.py` (append)

- [ ] **Step 1: Append a smoke test** to `tests/test_fetch_smoke.py`:

```python
def test_profiles_include_rates_and_hand_smoke():
    from model.fetch import build_batter_profile, build_pitcher_profile
    b = build_batter_profile(592450, 2026, name="Aaron Judge", bats="R")
    assert 0.0 <= b["k_rate"] <= 1.0
    assert 0.0 <= b["hit_rate"] <= 1.0
    assert b["bats"] == "R"
    p = build_pitcher_profile(669373, 2026, name="Tarik Skubal", throws="L")
    assert 0.0 <= p["hit_allowed_rate"] <= 1.0
    assert p["throws"] == "L"
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -k rates_and_hand -v`
Expected: FAIL (KeyError 'k_rate').

- [ ] **Step 3: Modify `build_batter_profile`** in `model/fetch.py`. It already computes `pa` and `hr` from the Statcast dataframe `df`. Add hit/strikeout counts and include the new keys. Insert these lines after the existing `hr = int((df["events"] == "home_run").sum())` line:

```python
    ks = int(df["events"].isin(["strikeout", "strikeout_double_play"]).sum())
    hits = int(df["events"].isin(["single", "double", "triple", "home_run"]).sum())
    k_rate = (ks / pa) if pa else 0.0
    hit_rate = (hits / pa) if pa else 0.0
```

Then in the returned dict for `build_batter_profile`, add these keys (alongside the existing `matchup_mult` key):
```python
        "k_rate": k_rate,
        "hit_rate": hit_rate,
```
(`bats` is already a parameter and already returned.)

- [ ] **Step 4: Modify `build_pitcher_profile`** in `model/fetch.py`. It already computes `pa` (batters faced) and `ks`. Add the hits-allowed rate. Insert after the existing `k_per_bf = (ks / pa) if pa else 0.0` line:

```python
    hits_allowed = int(df["events"].isin(["single", "double", "triple", "home_run"]).sum())
    hit_allowed_rate = (hits_allowed / pa) if pa else 0.0
```

Then add to the returned dict for `build_pitcher_profile` (alongside `opponent_k_mult`):
```python
        "hit_allowed_rate": hit_allowed_rate,
```
(`throws` is already a parameter and already returned.)

- [ ] **Step 5: Run to verify it passes**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -k rates_and_hand -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add model/fetch.py tests/test_fetch_smoke.py
git commit -m "feat: add k_rate/hit_rate to batters and hit_allowed_rate to pitchers"
```

---

### Task 5: Update fixtures for side-split lineups + rates

**Files:**
- Modify: `tests/fixtures.py`

- [ ] **Step 1: Replace the body of `tests/fixtures.py`** with side-split lineups and the new rate/handedness fields:

```python
"""Sample data structures for pipeline unit tests (no network)."""

SAMPLE_SLATE = [
    {
        "game_id": 1,
        "home": "COL",
        "away": "LAD",
        "park_team": "COL",
        "game_time": "2026-06-10T20:40:00Z",
        "started": False,
        "home_pitcher_id": 201,
        "away_pitcher_id": 202,
        "lat": 39.756,
        "lon": -104.994,
    }
]

def _batter(pid, name, team, bats, hr, k_rate, hit_rate):
    return {
        "player_id": pid, "name": name, "team": team, "bats": bats,
        "season_hr": hr, "season_pa": 600, "expected_pa": 4.3,
        "recent_form_mult": 1.10, "matchup_mult": 1.05,
        "k_rate": k_rate, "hit_rate": hit_rate,
    }

# lineups split by side; keyed by game_id
SAMPLE_LINEUPS = {
    1: {
        "home": [_batter(101, "Home Masher", "COL", "R", 30, 0.22, 0.26)],
        "away": [_batter(111, "Away Slugger", "LAD", "L", 28, 0.25, 0.24)],
    },
}

SAMPLE_PITCHERS = {
    201: {"player_id": 201, "name": "Ace Coors", "team": "COL", "throws": "R",
          "k_per_bf": 0.27, "expected_bf": 24, "opponent_k_mult": 1.04,
          "k_line": 5.5, "hit_allowed_rate": 0.20},
    202: {"player_id": 202, "name": "Dodger Arm", "team": "LAD", "throws": "L",
          "k_per_bf": 0.25, "expected_bf": 23, "opponent_k_mult": 1.00,
          "k_line": 5.5, "hit_allowed_rate": 0.21},
}

# weather keyed by game_id
SAMPLE_WEATHER = {
    1: {"wind_speed_mph": 10.0, "wind_from_deg": 180.0, "temp_f": 80.0, "precip_pct": 30},
}
```

- [ ] **Step 2: Verify it imports**

Run: `uv run python -c "from tests.fixtures import SAMPLE_LINEUPS; print(list(SAMPLE_LINEUPS[1]))"`
Expected: prints `['home', 'away']`.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures.py
git commit -m "test: side-split lineup fixtures with rates and handedness"
```

---

### Task 6: Pipeline pairs hitters with the opposing pitcher (HR `vs`)

**Files:**
- Modify: `model/pipeline.py` (`build_hr_rows` signature + body)
- Test: `tests/test_pipeline.py`

- [ ] **Step 1: Update imports and HR tests** in `tests/test_pipeline.py`.

First, the top-of-file import no longer has `SAMPLE_BATTERS` (Task 5 removed it). Change the import line to:
```python
from tests.fixtures import (
    SAMPLE_SLATE, SAMPLE_LINEUPS, SAMPLE_PITCHERS, SAMPLE_WEATHER,
)
```
Delete the old `fake_batters_fn` helper (it referenced `SAMPLE_BATTERS`) and add `fake_lineups_fn`. Then replace the three HR tests (`test_build_hr_rows_produces_expected_fields`, `test_build_hr_rows_sorted_descending`, `test_build_hr_rows_skips_started_games`) with the versions below:

```python
def fake_lineups_fn(game):
    return SAMPLE_LINEUPS[game["game_id"]]


def test_build_hr_rows_produces_expected_fields():
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    assert len(rows) == 2  # one home batter + one away batter
    home = next(r for r in rows if r["team"] == "COL")
    assert home["player"] == "Home Masher"
    assert home["prop"] == "HR"
    assert home["matchup"] == "LAD @ COL"
    assert 0.0 < home["probability"] <= 1.0
    # home batter faces the AWAY pitcher (Dodger Arm)
    assert home["vs"]["name"] == "Dodger Arm"
    assert home["vs"]["throws"] == "L"
    assert home["vs"]["lean"] in {"K", "H", "NEU"}
    assert 0.0 <= home["vs"]["k_prob"] <= 1.0


def test_build_hr_rows_sorted_descending():
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    probs = [r["probability"] for r in rows]
    assert probs == sorted(probs, reverse=True)


def test_build_hr_rows_skips_started_games():
    started = [dict(SAMPLE_SLATE[0], started=True)]
    rows = build_hr_rows(started, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    assert rows == []
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_pipeline.py -k build_hr_rows -v`
Expected: FAIL (build_hr_rows takes 3 args, or KeyError on `vs`).

- [ ] **Step 3: Replace `build_hr_rows`** in `model/pipeline.py`. Add the `matchup` import at the top (the line currently importing from `model.projections`), so the imports read:

```python
from model.parks import get_park, hr_park_factor
from model.weather import wind_out_to_cf, weather_hr_multiplier, wind_dir_rel_cf
from model.projections import hr_probability, expected_strikeouts, poisson_over_prob
from model.matchup import matchup
```

Then replace the whole `build_hr_rows` function with:

```python
def build_hr_rows(slate: list[dict], lineups_fn, pitcher_fn, weather_fn) -> list[dict]:
    """HR rows for all not-yet-started games, each with its opposing-pitcher matchup."""
    rows: list[dict] = []
    for game in slate:
        if game.get("started"):
            continue
        w = _game_weather(game, weather_fn)
        weather_mult = weather_hr_multiplier(w["wind_out_mph"], w["temp_f"], w["park"]["dome"])
        park_mult = hr_park_factor(game["park_team"])
        lineups = lineups_fn(game)
        home_p = pitcher_fn(game["home_pitcher_id"]) if game.get("home_pitcher_id") else None
        away_p = pitcher_fn(game["away_pitcher_id"]) if game.get("away_pitcher_id") else None
        # home batters face the away starter; away batters face the home starter
        for side, opp in (("home", away_p), ("away", home_p)):
            team = game.get(side, "?")
            for b in lineups.get(side, []):
                prob = hr_probability(
                    season_hr=b["season_hr"], season_pa=b["season_pa"],
                    recent_form_mult=b.get("recent_form_mult", 1.0),
                    matchup_mult=b.get("matchup_mult", 1.0),
                    park_mult=park_mult, weather_mult=weather_mult,
                    expected_pa=b.get("expected_pa", 4.0),
                )
                vs = None
                if opp:
                    m = matchup(
                        b_k=b.get("k_rate", 0.22), b_hit=b.get("hit_rate", 0.22),
                        p_k=opp.get("k_per_bf", 0.22), p_hit=opp.get("hit_allowed_rate", 0.22),
                        bats=b.get("bats", "R"), throws=opp.get("throws", "R"),
                    )
                    vs = {"name": opp["name"], "throws": opp.get("throws", "R"), **m}
                rows.append({
                    "prop": "HR", "game_id": game["game_id"],
                    "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                    "player": b["name"], "team": team, "park": game["park_team"],
                    "probability": prob, "wind_out_mph": w["wind_out_mph"],
                    "weather_mult": weather_mult, "park_mult": park_mult,
                    "recent_form_mult": b.get("recent_form_mult", 1.0),
                    "wind_mph": w["wind_mph"], "wind_dir": w["wind_dir"],
                    "temp_f": w["temp_f"], "precip_pct": w["precip_pct"],
                    "bats": b.get("bats", "R"), "vs": vs,
                })
    rows.sort(key=lambda r: r["probability"], reverse=True)
    return rows
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_pipeline.py -k build_hr_rows -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat: HR rows pair each hitter with the opposing starter (vs matchup)"
```

---

### Task 7: Pipeline pairs pitchers with the opposing lineup (`matchups`)

**Files:**
- Modify: `model/pipeline.py` (`build_strikeout_rows` signature + body)
- Test: `tests/test_pipeline.py`

- [ ] **Step 1: Replace `test_build_strikeout_rows`** in `tests/test_pipeline.py`:

```python
def test_build_strikeout_rows():
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn)
    names = {r["player"] for r in rows}
    assert names == {"Ace Coors", "Dodger Arm"}
    ace = next(r for r in rows if r["player"] == "Ace Coors")  # home pitcher (COL)
    assert ace["throws"] == "R"
    assert ace["matchup"] == "LAD @ COL"
    # home pitcher faces the AWAY lineup (Away Slugger)
    assert [m["name"] for m in ace["matchups"]] == ["Away Slugger"]
    assert ace["matchups"][0]["lean"] in {"K", "H", "NEU"}
    assert 0.0 <= ace["over_prob"] <= 1.0
    assert ace["temp_f"] == pytest.approx(80.0)
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_pipeline.py -k build_strikeout_rows -v`
Expected: FAIL (signature/`matchups` KeyError).

- [ ] **Step 3: Replace `build_strikeout_rows`** in `model/pipeline.py`:

```python
def build_strikeout_rows(slate: list[dict], pitcher_fn, lineups_fn, weather_fn) -> list[dict]:
    """Strikeout rows for both starters, each with the opposing lineup matchup read."""
    rows: list[dict] = []
    for game in slate:
        if game.get("started"):
            continue
        w = _game_weather(game, weather_fn)
        lineups = lineups_fn(game)
        # home pitcher faces away lineup; away pitcher faces home lineup
        for pid_key, opp_side, team in (
            ("home_pitcher_id", "away", game.get("home", "?")),
            ("away_pitcher_id", "home", game.get("away", "?")),
        ):
            pid = game.get(pid_key)
            if pid is None:
                continue
            p = pitcher_fn(pid)
            lam = expected_strikeouts(p["k_per_bf"], p["expected_bf"], p.get("opponent_k_mult", 1.0))
            line = p.get("k_line", 5.5)
            matchups = []
            for b in lineups.get(opp_side, []):
                m = matchup(
                    b_k=b.get("k_rate", 0.22), b_hit=b.get("hit_rate", 0.22),
                    p_k=p.get("k_per_bf", 0.22), p_hit=p.get("hit_allowed_rate", 0.22),
                    bats=b.get("bats", "R"), throws=p.get("throws", "R"),
                )
                matchups.append({"name": b["name"], "bats": b.get("bats", "R"), **m})
            rows.append({
                "prop": "K", "game_id": game["game_id"],
                "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                "player": p["name"], "team": team,
                "expected_ks": lam, "line": line, "over_prob": poisson_over_prob(lam, line),
                "wind_out_mph": w["wind_out_mph"], "wind_mph": w["wind_mph"],
                "wind_dir": w["wind_dir"], "temp_f": w["temp_f"], "precip_pct": w["precip_pct"],
                "throws": p.get("throws", "R"), "matchups": matchups,
            })
    rows.sort(key=lambda r: r["over_prob"], reverse=True)
    return rows
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_pipeline.py -v`
Expected: PASS (all pipeline tests, including `build_games` which is unchanged).

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat: strikeout rows pair each pitcher with the opposing lineup (matchups)"
```

---

### Task 8: Wire export_web to real, cached, side-aware data

**Files:**
- Modify: `model/export_web.py`
- Modify: `model/cli.py` (match the new pipeline signatures)

- [ ] **Step 1: Replace `model/export_web.py`** with:

```python
"""Generate the website's data file from the live engine (cached).

Usage:
    uv run python -m model.export_web 2026-06-11 [max_games]
Writes web/public/data/latest.json. Player Statcast pulls are cached under
.cache/ so reruns are fast; pass an optional max_games to limit a slow first run.
"""

import datetime as dt
import json
import sys
from pathlib import Path

from model import fetch
from model.cache import get_or_compute
from model.cli import _weather_fn
from model.pipeline import build_hr_rows, build_strikeout_rows, build_games

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "latest.json"


def main(date_str: str, max_games: int | None = None) -> None:
    season = int(date_str[:4])
    slate = fetch.get_schedule(date_str)
    if max_games is not None:
        slate = slate[:max_games]

    # resolve handedness once for every player on the slate
    pids: set[int] = set()
    lineup_cache: dict[int, dict] = {}
    for g in slate:
        lineup_cache[g["game_id"]] = fetch.get_lineups(g["game_id"])
        pids.update(lineup_cache[g["game_id"]]["home"] + lineup_cache[g["game_id"]]["away"])
        for k in ("home_pitcher_id", "away_pitcher_id"):
            if g.get(k):
                pids.add(g[k])
    meta = fetch.get_player_meta(list(pids))

    def batter_profile(pid: int) -> dict:
        m = meta.get(pid, {})
        return get_or_compute(
            f"batter-{pid}-{season}",
            lambda: fetch.build_batter_profile(pid, season, name=m.get("name", str(pid)), bats=m.get("bats", "R")),
        )

    def pitcher_profile(pid: int) -> dict:
        m = meta.get(pid, {})
        return get_or_compute(
            f"pitcher-{pid}-{season}",
            lambda: fetch.build_pitcher_profile(pid, season, name=m.get("name", str(pid)), throws=m.get("throws", "R")),
        )

    def lineups_fn(game: dict) -> dict:
        lns = lineup_cache[game["game_id"]]
        return {
            "home": [batter_profile(pid) for pid in lns["home"]],
            "away": [batter_profile(pid) for pid in lns["away"]],
        }

    hr_rows = build_hr_rows(slate, lineups_fn, pitcher_profile, _weather_fn)
    k_rows = build_strikeout_rows(slate, pitcher_profile, lineups_fn, _weather_fn)

    payload = {
        "date": date_str,
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "hr": hr_rows,
        "strikeouts": k_rows,
        "games": build_games(slate, _weather_fn),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {OUT} ({len(hr_rows)} HR rows, {len(k_rows)} K rows, {len(payload['games'])} games)")


if __name__ == "__main__":
    date = sys.argv[1] if len(sys.argv) > 1 else "2026-06-11"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else None
    main(date, limit)
```

- [ ] **Step 2: Fix `model/cli.py` to the new pipeline signatures.** The CLI's `build_batter_profile`/`build_pitcher_profile` closures and the `build_*_rows` calls must match. Replace the body of `main` in `model/cli.py` from the `def batters_fn` line through the `k_rows = ...` line with:

```python
    def lineups_fn(game: dict) -> dict:
        lns = fetch.get_lineups(game["game_id"])
        meta = fetch.get_player_meta(lns["home"] + lns["away"])
        def prof(pid):
            m = meta.get(pid, {})
            return fetch.build_batter_profile(pid, int(date_str[:4]), name=m.get("name", str(pid)), bats=m.get("bats", "R"))
        return {"home": [prof(p) for p in lns["home"]], "away": [prof(p) for p in lns["away"]]}

    def pitcher_fn(pid: int) -> dict:
        m = fetch.get_player_meta([pid]).get(pid, {})
        return fetch.build_pitcher_profile(pid, int(date_str[:4]), name=m.get("name", str(pid)), throws=m.get("throws", "R"))

    hr_rows = build_hr_rows(slate, lineups_fn, pitcher_fn, _weather_fn)
    k_rows = build_strikeout_rows(slate, pitcher_fn, lineups_fn, _weather_fn)
```

- [ ] **Step 3: Verify the full unit suite still passes** (no live calls)

Run: `uv run pytest -q`
Expected: all unit tests pass; smoke deselected.

- [ ] **Step 4: Live end-to-end on ONE game (cached, bounded)**

Run: `export PATH="$HOME/.local/bin:$PATH" && uv run python -m model.export_web 2026-06-11 1`
Expected: prints `Wrote .../latest.json (...)`. It may be empty if no lineups/probables are posted for that date — that is acceptable; the goal is a clean run with no errors. Run it a second time and confirm it is much faster (cache hit).

- [ ] **Step 5: Restore the demo sample so the site still shows a full board**

The live run may overwrite `latest.json` with sparse/empty data. Restore the committed sample:
```bash
cd /Users/issiakadiawara/Projects/prop-predict
git checkout web/public/data/latest.json
node -e "console.log('hr', require('./web/public/data/latest.json').hr.length)"   # expect 4
```

- [ ] **Step 6: Commit**

```bash
git add model/export_web.py model/cli.py
git commit -m "feat: wire export_web to live cached side-aware data with matchups"
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Unit suite green**

Run: `uv run pytest -q`
Expected: all unit tests pass (cache + pipeline + matchup + projections + weather + parks), smoke deselected.

- [ ] **Step 2: Smoke suite (live network)**

Run: `uv run pytest -m smoke -q`
Expected: pass (player_meta, get_lineups, profiles-with-rates, plus earlier weather/schedule smokes). If a date-specific test has no data, adjust its date per its note.

- [ ] **Step 3: Confirm the website still builds and renders the sample**

Run: `cd web && npm test && npm run build`
Expected: vitest passes; production build succeeds. (The web app is unchanged by this plan; it already reads the `vs`/`matchups`/`games` shape these tasks now produce for real.)

---

## Notes for the implementer

- **Performance:** the cache (Task 1) is the key to usability — the first run of a full slate is still slow (hundreds of player pulls), but every rerun that day is near-instant. Use the `max_games` arg to test without waiting on the whole slate.
- **Data timing:** lineups and probable pitchers post a few hours before games. Early-day runs will be partial; the site already handles empty sections ("lineups not posted yet").
- **Web app unchanged:** the website already consumes `vs`, `matchups`, `bats`/`throws`, and `games`. This plan makes the engine produce them for real games; no `web/` changes are needed.
- **Scheduling (future):** running `export_web` on a repeating cron (Vercel Cron) per the architecture doc's "crunch then display" loop is a later, separate task.
- **Deferred:** smarter per-pitcher K line (vs flat 5.5) and crediting pull-side wind in the HR math remain on the model roadmap.
