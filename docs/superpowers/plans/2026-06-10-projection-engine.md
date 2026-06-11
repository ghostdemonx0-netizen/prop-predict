# Projection Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tested Python program that pulls free MLB data and produces Home Run and Pitcher Strikeout projections for a given day's games, output to the terminal and as a JSON file.

**Architecture:** Pure, deterministic "model" functions (park factors, wind math, HR probability, strikeout probability) are unit-tested with fixtures. A thin I/O layer fetches data (MLB Stats API, Statcast via `pybaseball`, weather via Open-Meteo) and is checked with live smoke tests. A pipeline wires injected fetchers to the model and emits projection rows; a CLI runs it. This separation keeps the math fully testable without hitting the network.

**Tech Stack:** Python 3.13, `uv` (env + installs), `pybaseball`, `MLB-StatsAPI`, `requests`, `pandas`, `pytest`.

---

## File Structure

```
prop-predict/
  model/
    __init__.py          # package marker
    parks.py             # park HR factors, center-field bearing, dome flag
    weather.py           # pure wind-to-CF math + HR weather multiplier
    projections.py       # pure HR probability + strikeout (Poisson) math
    fetch.py             # I/O: schedule/lineups (StatsAPI), stats (pybaseball), weather (Open-Meteo)
    pipeline.py          # wire fetchers -> model -> projection rows (dependency-injected)
    cli.py               # run pipeline for a date, print table + write JSON
  tests/
    __init__.py
    fixtures.py          # shared sample data for unit tests
    test_parks.py
    test_weather.py
    test_projections.py
    test_pipeline.py
    test_fetch_smoke.py  # live network smoke tests (marked "smoke")
  requirements.txt
  pytest.ini
```

**Responsibilities:**
- `parks.py`, `weather.py`, `projections.py` — pure functions, no network, fully unit-tested.
- `fetch.py` — all network I/O, isolated so the model never imports it directly.
- `pipeline.py` — takes fetcher callables as arguments (so tests inject fakes), returns plain dict rows.
- `cli.py` — the only place real fetchers are wired to the pipeline.

---

### Task 1: Project scaffold

**Files:**
- Create: `requirements.txt`
- Create: `pytest.ini`
- Create: `model/__init__.py`
- Create: `tests/__init__.py`
- Test: `tests/test_smoke_scaffold.py`

- [ ] **Step 1: Create `requirements.txt`**

```
pybaseball==2.2.7
MLB-StatsAPI==1.8.1
requests==2.32.3
pandas==2.2.3
pytest==8.3.3
```

- [ ] **Step 2: Create `pytest.ini`** (registers the `smoke` marker so live tests can be skipped)

```ini
[pytest]
markers =
    smoke: live network tests that hit real APIs (run with -m smoke)
addopts = -m "not smoke"
```

- [ ] **Step 3: Create empty package markers**

Create `model/__init__.py` with a single line:

```python
"""prop-predict projection engine."""
```

Create `tests/__init__.py` as an empty file (no content).

- [ ] **Step 4: Write a trivial scaffold test**

`tests/test_smoke_scaffold.py`:

```python
import model


def test_package_imports():
    assert model is not None
```

- [ ] **Step 5: Create the environment and install deps**

Run:
```bash
cd /Users/issiakadiawara/Projects/prop-predict
uv venv
uv pip install -r requirements.txt
```
Expected: `.venv` created, packages installed without error.

- [ ] **Step 6: Run the test**

Run: `uv run pytest tests/test_smoke_scaffold.py -v`
Expected: PASS (1 passed).

- [ ] **Step 7: Commit**

```bash
git add requirements.txt pytest.ini model/__init__.py tests/__init__.py tests/test_smoke_scaffold.py
git commit -m "feat: scaffold projection-engine package and test setup"
```

---

### Task 2: Parks module

**Files:**
- Create: `model/parks.py`
- Test: `tests/test_parks.py`

- [ ] **Step 1: Write the failing test**

`tests/test_parks.py`:

```python
import pytest
from model.parks import get_park, hr_park_factor, PARKS


def test_known_park_has_required_fields():
    park = get_park("COL")
    assert park["name"] == "Coors Field"
    assert park["hr_factor"] == pytest.approx(1.22)
    assert 0 <= park["cf_bearing_deg"] < 360
    assert park["dome"] is False


def test_hr_park_factor_returns_float():
    assert hr_park_factor("COL") == pytest.approx(1.22)


def test_unknown_team_defaults_to_neutral():
    park = get_park("ZZZ")
    assert park["hr_factor"] == pytest.approx(1.0)
    assert park["dome"] is False
    assert hr_park_factor("ZZZ") == pytest.approx(1.0)


def test_every_park_entry_is_well_formed():
    for abbr, p in PARKS.items():
        assert set(p) == {"name", "hr_factor", "cf_bearing_deg", "dome"}
        assert isinstance(p["hr_factor"], float)
        assert 0 <= p["cf_bearing_deg"] < 360
        assert isinstance(p["dome"], bool)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_parks.py -v`
Expected: FAIL (ModuleNotFoundError: No module named 'model.parks').

- [ ] **Step 3: Write minimal implementation**

`model/parks.py`:

```python
"""Ballpark home-run factors and orientation.

hr_factor: multiplicative HR park factor (1.0 = neutral, >1 inflates HRs).
cf_bearing_deg: compass bearing (0=N, 90=E) from home plate toward center field;
    the direction a ball hit to straightaway CF travels.
dome: True if a fixed/closed roof neutralizes wind.
Values are reasonable v1 estimates; refine later from data.
"""

PARKS: dict[str, dict] = {
    "ARI": {"name": "Chase Field", "hr_factor": 1.04, "cf_bearing_deg": 0, "dome": True},
    "ATL": {"name": "Truist Park", "hr_factor": 1.05, "cf_bearing_deg": 25, "dome": False},
    "BAL": {"name": "Camden Yards", "hr_factor": 1.02, "cf_bearing_deg": 28, "dome": False},
    "BOS": {"name": "Fenway Park", "hr_factor": 1.03, "cf_bearing_deg": 45, "dome": False},
    "CHC": {"name": "Wrigley Field", "hr_factor": 1.04, "cf_bearing_deg": 30, "dome": False},
    "CWS": {"name": "Rate Field", "hr_factor": 1.06, "cf_bearing_deg": 5, "dome": False},
    "CIN": {"name": "Great American Ball Park", "hr_factor": 1.12, "cf_bearing_deg": 10, "dome": False},
    "CLE": {"name": "Progressive Field", "hr_factor": 0.98, "cf_bearing_deg": 0, "dome": False},
    "COL": {"name": "Coors Field", "hr_factor": 1.22, "cf_bearing_deg": 0, "dome": False},
    "DET": {"name": "Comerica Park", "hr_factor": 0.94, "cf_bearing_deg": 20, "dome": False},
    "HOU": {"name": "Daikin Park", "hr_factor": 1.08, "cf_bearing_deg": 15, "dome": True},
    "KC":  {"name": "Kauffman Stadium", "hr_factor": 0.92, "cf_bearing_deg": 0, "dome": False},
    "LAA": {"name": "Angel Stadium", "hr_factor": 1.00, "cf_bearing_deg": 20, "dome": False},
    "LAD": {"name": "Dodger Stadium", "hr_factor": 1.06, "cf_bearing_deg": 25, "dome": False},
    "MIA": {"name": "loanDepot park", "hr_factor": 0.97, "cf_bearing_deg": 30, "dome": True},
    "MIL": {"name": "American Family Field", "hr_factor": 1.05, "cf_bearing_deg": 0, "dome": True},
    "MIN": {"name": "Target Field", "hr_factor": 1.01, "cf_bearing_deg": 20, "dome": False},
    "NYM": {"name": "Citi Field", "hr_factor": 0.97, "cf_bearing_deg": 25, "dome": False},
    "NYY": {"name": "Yankee Stadium", "hr_factor": 1.10, "cf_bearing_deg": 10, "dome": False},
    "OAK": {"name": "Sutter Health Park", "hr_factor": 0.95, "cf_bearing_deg": 0, "dome": False},
    "PHI": {"name": "Citizens Bank Park", "hr_factor": 1.07, "cf_bearing_deg": 15, "dome": False},
    "PIT": {"name": "PNC Park", "hr_factor": 0.94, "cf_bearing_deg": 40, "dome": False},
    "SD":  {"name": "Petco Park", "hr_factor": 0.95, "cf_bearing_deg": 30, "dome": False},
    "SF":  {"name": "Oracle Park", "hr_factor": 0.90, "cf_bearing_deg": 20, "dome": False},
    "SEA": {"name": "T-Mobile Park", "hr_factor": 0.96, "cf_bearing_deg": 10, "dome": False},
    "STL": {"name": "Busch Stadium", "hr_factor": 0.98, "cf_bearing_deg": 20, "dome": False},
    "TB":  {"name": "Tropicana Field", "hr_factor": 0.97, "cf_bearing_deg": 0, "dome": True},
    "TEX": {"name": "Globe Life Field", "hr_factor": 1.03, "cf_bearing_deg": 15, "dome": True},
    "TOR": {"name": "Rogers Centre", "hr_factor": 1.02, "cf_bearing_deg": 0, "dome": True},
    "WSH": {"name": "Nationals Park", "hr_factor": 1.01, "cf_bearing_deg": 25, "dome": False},
}

_NEUTRAL = {"name": "Unknown Park", "hr_factor": 1.0, "cf_bearing_deg": 0, "dome": False}


def get_park(team_abbr: str) -> dict:
    """Return the park dict for a home-team abbreviation, or a neutral default."""
    return PARKS.get(team_abbr, _NEUTRAL)


def hr_park_factor(team_abbr: str) -> float:
    """Return the multiplicative HR park factor for a home-team abbreviation."""
    return get_park(team_abbr)["hr_factor"]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_parks.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add model/parks.py tests/test_parks.py
git commit -m "feat: add ballpark HR factors and orientation table"
```

---

### Task 3: Weather wind math (pure)

**Files:**
- Create: `model/weather.py`
- Test: `tests/test_weather.py`

- [ ] **Step 1: Write the failing test**

`tests/test_weather.py`:

```python
import pytest
from model.weather import wind_out_to_cf, weather_hr_multiplier


def test_wind_blowing_straight_out_to_cf_is_positive():
    # CF bearing 0 (due north). Wind COMING FROM south (180) blows toward north -> out to CF.
    out = wind_out_to_cf(wind_speed_mph=10, wind_from_deg=180, cf_bearing_deg=0)
    assert out == pytest.approx(10.0, abs=1e-6)


def test_wind_blowing_straight_in_is_negative():
    # Wind COMING FROM north (0) blows toward south -> in from CF.
    out = wind_out_to_cf(wind_speed_mph=10, wind_from_deg=0, cf_bearing_deg=0)
    assert out == pytest.approx(-10.0, abs=1e-6)


def test_crosswind_is_zero_component():
    # Wind coming from west (270) blows toward east; CF due north -> perpendicular.
    out = wind_out_to_cf(wind_speed_mph=10, wind_from_deg=270, cf_bearing_deg=0)
    assert out == pytest.approx(0.0, abs=1e-6)


def test_weather_multiplier_boosts_with_wind_out_and_heat():
    # 10 mph out, 80F: 1 + 0.02*10 + 0.005*(80-70) = 1.25
    assert weather_hr_multiplier(wind_out_mph=10, temp_f=80, dome=False) == pytest.approx(1.25)


def test_weather_multiplier_is_one_in_dome():
    assert weather_hr_multiplier(wind_out_mph=15, temp_f=95, dome=True) == 1.0


def test_weather_multiplier_is_clamped():
    assert weather_hr_multiplier(wind_out_mph=100, temp_f=120, dome=False) == pytest.approx(1.4)
    assert weather_hr_multiplier(wind_out_mph=-100, temp_f=10, dome=False) == pytest.approx(0.7)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_weather.py -v`
Expected: FAIL (ModuleNotFoundError: No module named 'model.weather').

- [ ] **Step 3: Write minimal implementation**

`model/weather.py`:

```python
"""Pure weather math for HR modeling.

Open-Meteo reports wind direction as the compass bearing the wind is
COMING FROM (meteorological convention). A ball hit to center field
travels along `cf_bearing_deg`. Wind helps a CF home run when it blows
toward CF (i.e., its direction-of-travel aligns with cf_bearing_deg).
"""

import math


def wind_out_to_cf(wind_speed_mph: float, wind_from_deg: float, cf_bearing_deg: float) -> float:
    """Component of wind (mph) blowing OUT toward center field.

    Positive = blowing out (helps HRs), negative = blowing in.
    """
    wind_to_deg = (wind_from_deg + 180.0) % 360.0  # direction wind blows TOWARD
    angle = math.radians(wind_to_deg - cf_bearing_deg)
    return wind_speed_mph * math.cos(angle)


def weather_hr_multiplier(wind_out_mph: float, temp_f: float, dome: bool) -> float:
    """Multiplicative HR adjustment from wind and temperature.

    Domed/closed-roof parks are neutral (1.0). Otherwise each mph blowing
    out adds ~2%, and each degree above 70F adds ~0.5%. Clamped to [0.7, 1.4].
    """
    if dome:
        return 1.0
    mult = 1.0 + 0.02 * wind_out_mph + 0.005 * (temp_f - 70.0)
    return max(0.7, min(1.4, mult))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_weather.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add model/weather.py tests/test_weather.py
git commit -m "feat: add pure wind-to-CF and HR weather multiplier math"
```

---

### Task 4: Projection math (pure) — HR probability and strikeouts

**Files:**
- Create: `model/projections.py`
- Test: `tests/test_projections.py`

- [ ] **Step 1: Write the failing test**

`tests/test_projections.py`:

```python
import math
import pytest
from model.projections import hr_probability, expected_strikeouts, poisson_over_prob


def test_hr_probability_baseline_no_adjustments():
    # 40 HR / 600 PA = 0.0667 per PA; over 4 PA: 1-(1-0.0667)^4
    p = hr_probability(season_hr=40, season_pa=600, expected_pa=4.0)
    expected = 1 - (1 - 40 / 600) ** 4
    assert p == pytest.approx(expected)


def test_hr_probability_multipliers_stack():
    p = hr_probability(
        season_hr=30, season_pa=600,
        recent_form_mult=1.1, matchup_mult=1.2, park_mult=1.22,
        weather_mult=1.25, pitcher_mult=1.1, expected_pa=4.0,
    )
    base = 30 / 600
    rate = base * 1.1 * 1.2 * 1.22 * 1.25 * 1.1
    rate = min(rate, 1.0)
    assert p == pytest.approx(1 - (1 - rate) ** 4)


def test_hr_probability_zero_pa_is_zero():
    assert hr_probability(season_hr=0, season_pa=0) == 0.0


def test_hr_probability_rate_clamped_to_one():
    # Absurd inputs cannot exceed certainty.
    p = hr_probability(season_hr=600, season_pa=600, park_mult=5.0, expected_pa=4.0)
    assert p == pytest.approx(1.0)


def test_expected_strikeouts():
    # 0.28 K per batter * 24 batters * 1.05 opponent factor
    assert expected_strikeouts(k_per_bf=0.28, expected_bf=24, opponent_k_mult=1.05) == pytest.approx(7.056)


def test_poisson_over_prob_matches_manual():
    # lambda=6, line=5.5 -> P(X>=6) = 1 - sum_{k=0}^{5} e^-6 6^k/k!
    lam = 6.0
    manual = 1 - sum(math.exp(-lam) * lam**k / math.factorial(k) for k in range(6))
    assert poisson_over_prob(lam, 5.5) == pytest.approx(manual)


def test_poisson_over_prob_integer_line_uses_strictly_greater():
    # line=6 (integer) -> threshold is 7 -> P(X>=7)
    lam = 6.0
    manual = 1 - sum(math.exp(-lam) * lam**k / math.factorial(k) for k in range(7))
    assert poisson_over_prob(lam, 6) == pytest.approx(manual)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_projections.py -v`
Expected: FAIL (ModuleNotFoundError: No module named 'model.projections').

- [ ] **Step 3: Write minimal implementation**

`model/projections.py`:

```python
"""Pure projection math for HR and strikeout props (v1, transparent model)."""

import math


def hr_probability(
    season_hr: float,
    season_pa: float,
    *,
    recent_form_mult: float = 1.0,
    matchup_mult: float = 1.0,
    park_mult: float = 1.0,
    weather_mult: float = 1.0,
    pitcher_mult: float = 1.0,
    expected_pa: float = 4.0,
) -> float:
    """Probability a hitter hits at least one HR in the game.

    Starts from the season HR-per-PA rate, applies multiplicative
    adjustments (each centered at 1.0), then converts a per-PA rate into a
    "1 or more in `expected_pa` chances" probability.
    """
    if season_pa <= 0:
        return 0.0
    base = season_hr / season_pa
    rate = base * recent_form_mult * matchup_mult * park_mult * weather_mult * pitcher_mult
    rate = max(0.0, min(rate, 1.0))
    return 1 - (1 - rate) ** expected_pa


def expected_strikeouts(k_per_bf: float, expected_bf: float, opponent_k_mult: float = 1.0) -> float:
    """Expected strikeouts = per-batter K rate * batters faced * opponent factor."""
    return k_per_bf * expected_bf * opponent_k_mult


def poisson_over_prob(lam: float, line: float) -> float:
    """P(strikeouts > line) modeling strikeouts as Poisson(lam).

    For a .5 line (e.g., 5.5) this is P(X >= 6). For an integer line
    (e.g., 6) it is P(X >= 7), i.e., strictly greater than the line.
    """
    threshold = math.floor(line) + 1
    cdf = sum(math.exp(-lam) * lam**k / math.factorial(k) for k in range(threshold))
    return 1 - cdf
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_projections.py -v`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add model/projections.py tests/test_projections.py
git commit -m "feat: add pure HR probability and strikeout Poisson math"
```

---

### Task 5: Shared test fixtures

**Files:**
- Create: `tests/fixtures.py`

- [ ] **Step 1: Create fixtures used by the pipeline test**

`tests/fixtures.py`:

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

SAMPLE_BATTERS = {
    1: [
        {"player_id": 101, "name": "Big Bopper", "team": "LAD", "bats": "R",
         "season_hr": 30, "season_pa": 600, "expected_pa": 4.3,
         "recent_form_mult": 1.10, "matchup_mult": 1.05},
    ],
}

SAMPLE_PITCHERS = {
    201: {"player_id": 201, "name": "Ace Coors", "team": "COL", "throws": "R",
          "k_per_bf": 0.27, "expected_bf": 24, "opponent_k_mult": 1.04, "k_line": 5.5},
    202: {"player_id": 202, "name": "Dodger Arm", "team": "LAD", "throws": "L",
          "k_per_bf": 0.25, "expected_bf": 23, "opponent_k_mult": 1.00, "k_line": 5.5},
}

# weather keyed by game_id
SAMPLE_WEATHER = {
    1: {"wind_speed_mph": 10.0, "wind_from_deg": 180.0, "temp_f": 80.0},
}
```

- [ ] **Step 2: Verify the fixtures import cleanly**

Run: `uv run python -c "from tests.fixtures import SAMPLE_SLATE; print(len(SAMPLE_SLATE))"`
Expected: prints `1`.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures.py
git commit -m "test: add shared fixtures for pipeline tests"
```

---

### Task 6: Pipeline (dependency-injected, pure of network)

**Files:**
- Create: `model/pipeline.py`
- Test: `tests/test_pipeline.py`

- [ ] **Step 1: Write the failing test**

`tests/test_pipeline.py`:

```python
import pytest
from model.pipeline import build_hr_rows, build_strikeout_rows
from tests.fixtures import (
    SAMPLE_SLATE, SAMPLE_BATTERS, SAMPLE_PITCHERS, SAMPLE_WEATHER,
)


def fake_batters_fn(game_id):
    return SAMPLE_BATTERS[game_id]


def fake_pitcher_fn(pitcher_id):
    return SAMPLE_PITCHERS[pitcher_id]


def fake_weather_fn(game):
    return SAMPLE_WEATHER[game["game_id"]]


def test_build_hr_rows_produces_expected_fields():
    rows = build_hr_rows(SAMPLE_SLATE, fake_batters_fn, fake_weather_fn)
    assert len(rows) == 1
    row = rows[0]
    assert row["player"] == "Big Bopper"
    assert row["prop"] == "HR"
    assert row["park"] == "COL"
    # probability is a valid percentage and boosted above the raw baseline
    base = 1 - (1 - 30 / 600) ** 4.3
    assert 0.0 < row["probability"] <= 1.0
    assert row["probability"] > base  # Coors + wind out + heat + form + matchup all boost
    assert "wind_out_mph" in row and row["wind_out_mph"] == pytest.approx(10.0)


def test_build_hr_rows_sorted_descending():
    # Duplicate the batter with a weaker profile and confirm ordering.
    slate = SAMPLE_SLATE
    def two_batters_fn(game_id):
        strong = dict(SAMPLE_BATTERS[game_id][0])
        weak = dict(strong, player_id=102, name="Weak Hitter",
                    season_hr=8, recent_form_mult=0.9, matchup_mult=0.9)
        return [weak, strong]
    rows = build_hr_rows(slate, two_batters_fn, fake_weather_fn)
    assert rows[0]["probability"] >= rows[1]["probability"]


def test_build_strikeout_rows():
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn)
    names = {r["player"] for r in rows}
    assert names == {"Ace Coors", "Dodger Arm"}
    for r in rows:
        assert r["prop"] == "K"
        assert 0.0 <= r["over_prob"] <= 1.0
        assert r["expected_ks"] > 0
        assert r["line"] == 5.5


def test_build_hr_rows_skips_started_games():
    started = [dict(SAMPLE_SLATE[0], started=True)]
    rows = build_hr_rows(started, fake_batters_fn, fake_weather_fn)
    assert rows == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_pipeline.py -v`
Expected: FAIL (ModuleNotFoundError: No module named 'model.pipeline').

- [ ] **Step 3: Write minimal implementation**

`model/pipeline.py`:

```python
"""Wire data (via injected fetcher callables) into model projections.

Fetcher callables are passed in so this module never touches the network
and is fully unit-testable. cli.py supplies the real fetchers.

Fetcher contracts:
  batters_fn(game_id) -> list of batter dicts:
      {player_id, name, team, bats, season_hr, season_pa, expected_pa,
       recent_form_mult, matchup_mult}
  pitcher_fn(pitcher_id) -> pitcher dict:
      {player_id, name, team, throws, k_per_bf, expected_bf,
       opponent_k_mult, k_line}
  weather_fn(game) -> {wind_speed_mph, wind_from_deg, temp_f}
"""

from model.parks import get_park, hr_park_factor
from model.weather import wind_out_to_cf, weather_hr_multiplier
from model.projections import hr_probability, expected_strikeouts, poisson_over_prob


def build_hr_rows(slate: list[dict], batters_fn, weather_fn) -> list[dict]:
    """Return HR projection rows for all not-yet-started games, sorted desc."""
    rows: list[dict] = []
    for game in slate:
        if game.get("started"):
            continue
        park = get_park(game["park_team"])
        wx = weather_fn(game)
        wind_out = wind_out_to_cf(
            wx["wind_speed_mph"], wx["wind_from_deg"], park["cf_bearing_deg"]
        )
        weather_mult = weather_hr_multiplier(wind_out, wx["temp_f"], park["dome"])
        park_mult = hr_park_factor(game["park_team"])
        for b in batters_fn(game["game_id"]):
            prob = hr_probability(
                season_hr=b["season_hr"],
                season_pa=b["season_pa"],
                recent_form_mult=b.get("recent_form_mult", 1.0),
                matchup_mult=b.get("matchup_mult", 1.0),
                park_mult=park_mult,
                weather_mult=weather_mult,
                expected_pa=b.get("expected_pa", 4.0),
            )
            rows.append({
                "prop": "HR",
                "game_id": game["game_id"],
                "player": b["name"],
                "team": b["team"],
                "park": game["park_team"],
                "probability": prob,
                "wind_out_mph": wind_out,
                "weather_mult": weather_mult,
                "park_mult": park_mult,
            })
    rows.sort(key=lambda r: r["probability"], reverse=True)
    return rows


def build_strikeout_rows(slate: list[dict], pitcher_fn) -> list[dict]:
    """Return strikeout projection rows for both starters of each game, sorted desc."""
    rows: list[dict] = []
    for game in slate:
        if game.get("started"):
            continue
        for key in ("home_pitcher_id", "away_pitcher_id"):
            pid = game.get(key)
            if pid is None:
                continue
            p = pitcher_fn(pid)
            lam = expected_strikeouts(
                p["k_per_bf"], p["expected_bf"], p.get("opponent_k_mult", 1.0)
            )
            line = p.get("k_line", 5.5)
            rows.append({
                "prop": "K",
                "game_id": game["game_id"],
                "player": p["name"],
                "team": p["team"],
                "expected_ks": lam,
                "line": line,
                "over_prob": poisson_over_prob(lam, line),
            })
    rows.sort(key=lambda r: r["over_prob"], reverse=True)
    return rows
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_pipeline.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat: add projection pipeline wiring model to injected fetchers"
```

---

### Task 7: Data fetch layer (network I/O) + smoke tests

**Files:**
- Create: `model/fetch.py`
- Test: `tests/test_fetch_smoke.py`

- [ ] **Step 1: Write the smoke test (marked, network-dependent)**

`tests/test_fetch_smoke.py`:

```python
import datetime as dt
import pytest

from model.fetch import get_schedule, get_weather

pytestmark = pytest.mark.smoke


def test_get_schedule_returns_games_for_a_known_date():
    # Mid-season date with a full slate.
    games = get_schedule("2026-06-10")
    assert isinstance(games, list)
    assert len(games) > 0
    g = games[0]
    for field in ("game_id", "home", "away", "park_team", "game_time", "started"):
        assert field in g


def test_get_weather_returns_conditions():
    wx = get_weather(lat=39.756, lon=-104.994, when_iso="2026-06-10T20:40:00Z")
    assert "wind_speed_mph" in wx
    assert "wind_from_deg" in wx
    assert "temp_f" in wx
    assert 0 <= wx["wind_from_deg"] <= 360
```

- [ ] **Step 2: Run smoke test to verify it fails**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -v`
Expected: FAIL (ModuleNotFoundError: No module named 'model.fetch').

- [ ] **Step 3: Write the fetch implementation**

`model/fetch.py`:

```python
"""Network I/O: schedule/lineups (MLB Stats API), Statcast stats
(pybaseball), and weather (Open-Meteo). Isolated from model math so the
pure modules stay testable offline.
"""

import datetime as dt
import statsapi
import requests

# MLB Stats API team-id -> our park abbreviation
_TEAM_ABBR = {
    109: "ARI", 144: "ATL", 110: "BAL", 111: "BOS", 112: "CHC", 145: "CWS",
    113: "CIN", 114: "CLE", 115: "COL", 116: "DET", 117: "HOU", 118: "KC",
    108: "LAA", 119: "LAD", 146: "MIA", 158: "MIL", 142: "MIN", 121: "NYM",
    147: "NYY", 133: "OAK", 143: "PHI", 134: "PIT", 135: "SD", 137: "SF",
    136: "SEA", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 120: "WSH",
}


def _abbr(team_id: int) -> str:
    return _TEAM_ABBR.get(team_id, "ZZZ")


def get_schedule(date_str: str) -> list[dict]:
    """Return the day's games as normalized dicts.

    date_str: 'YYYY-MM-DD'. Uses MLB Stats API via the statsapi wrapper.
    """
    games = statsapi.schedule(date=date_str)
    out: list[dict] = []
    for g in games:
        status = (g.get("status") or "").lower()
        started = status not in ("scheduled", "pre-game", "warmup", "")
        out.append({
            "game_id": g["game_id"],
            "home": _abbr(g["home_id"]),
            "away": _abbr(g["away_id"]),
            "park_team": _abbr(g["home_id"]),
            "game_time": g.get("game_datetime"),
            "started": started,
            "home_pitcher_id": g.get("home_probable_pitcher_id"),
            "away_pitcher_id": g.get("away_probable_pitcher_id"),
        })
    return out


def get_weather(lat: float, lon: float, when_iso: str) -> dict:
    """Hourly forecast nearest the game time from Open-Meteo (no key)."""
    target = dt.datetime.fromisoformat(when_iso.replace("Z", "+00:00"))
    date = target.date().isoformat()
    resp = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,wind_speed_10m,wind_direction_10m",
            "temperature_unit": "fahrenheit",
            "wind_speed_unit": "mph",
            "start_date": date,
            "end_date": date,
            "timezone": "UTC",
        },
        timeout=20,
    )
    resp.raise_for_status()
    h = resp.json()["hourly"]
    # pick the hour nearest the game time
    times = [dt.datetime.fromisoformat(t + "+00:00") for t in h["time"]]
    idx = min(range(len(times)), key=lambda i: abs((times[i] - target).total_seconds()))
    return {
        "temp_f": h["temperature_2m"][idx],
        "wind_speed_mph": h["wind_speed_10m"][idx],
        "wind_from_deg": h["wind_direction_10m"][idx],
    }
```

- [ ] **Step 4: Run smoke test to verify it passes**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -v`
Expected: PASS (2 passed). If MLB has no games on that date, change the date in the test to one with a slate.

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py tests/test_fetch_smoke.py
git commit -m "feat: add schedule and weather fetch layer with smoke tests"
```

---

### Task 8: Statcast batter/pitcher stat builders + smoke test

**Files:**
- Modify: `model/fetch.py` (append functions)
- Test: `tests/test_fetch_smoke.py` (append a smoke test)

- [ ] **Step 1: Append a smoke test for stat building**

Append to `tests/test_fetch_smoke.py`:

```python
def test_build_batter_profile_smoke():
    from model.fetch import build_batter_profile
    # Aaron Judge MLBAM id 592450; season 2026
    prof = build_batter_profile(player_id=592450, season=2026)
    assert prof["season_pa"] > 0
    assert prof["season_hr"] >= 0
    assert "recent_form_mult" in prof
    assert prof["recent_form_mult"] > 0


def test_build_pitcher_profile_smoke():
    from model.fetch import build_pitcher_profile
    # Tarik Skubal MLBAM id 669373; season 2026
    prof = build_pitcher_profile(player_id=669373, season=2026)
    assert prof["k_per_bf"] > 0
    assert prof["expected_bf"] > 0
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -k build -v`
Expected: FAIL (ImportError: cannot import name 'build_batter_profile').

- [ ] **Step 3: Append the implementation to `model/fetch.py`**

```python
import pandas as pd
from pybaseball import statcast_batter, statcast_pitcher


def _date_window(season: int) -> tuple[str, str]:
    return f"{season}-03-01", f"{season}-11-01"


def build_batter_profile(player_id: int, season: int, name: str = "", team: str = "",
                         bats: str = "") -> dict:
    """Season HR/PA + a recent-form multiplier from Statcast batted-ball data.

    recent_form_mult compares last-15-days hard-hit rate to the season hard-hit
    rate, scaled gently and clamped to [0.8, 1.25].
    """
    start, end = _date_window(season)
    df = statcast_batter(start, end, player_id)
    bip = df[df["launch_speed"].notna()]
    season_hard = (bip["launch_speed"] >= 95).mean() if len(bip) else 0.0
    pa = int((df["events"].notna()).sum())
    hr = int((df["events"] == "home_run").sum())

    cutoff = pd.to_datetime(df["game_date"]).max() - pd.Timedelta(days=15)
    recent = bip[pd.to_datetime(bip["game_date"]) >= cutoff]
    recent_hard = (recent["launch_speed"] >= 95).mean() if len(recent) else season_hard
    recent_form_mult = 1.0 + (recent_hard - season_hard) * 1.5
    recent_form_mult = max(0.8, min(1.25, recent_form_mult))

    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "bats": bats,
        "season_hr": hr,
        "season_pa": pa,
        "expected_pa": 4.0,
        "recent_form_mult": recent_form_mult,
        "matchup_mult": 1.0,
    }


def build_pitcher_profile(player_id: int, season: int, name: str = "", team: str = "",
                          throws: str = "", k_line: float = 5.5) -> dict:
    """Per-batter K rate and an expected batters-faced estimate from Statcast."""
    start, end = _date_window(season)
    df = statcast_pitcher(start, end, player_id)
    pa = int((df["events"].notna()).sum())
    ks = int(df["events"].isin(["strikeout", "strikeout_double_play"]).sum())
    k_per_bf = (ks / pa) if pa else 0.0

    games = df["game_pk"].nunique() if "game_pk" in df else 0
    expected_bf = (pa / games) if games else 24.0

    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "throws": throws,
        "k_per_bf": k_per_bf,
        "expected_bf": expected_bf,
        "opponent_k_mult": 1.0,
        "k_line": k_line,
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -k build -v`
Expected: PASS (2 passed). (Requires the players to have 2026 data; swap ids/season if needed.)

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py tests/test_fetch_smoke.py
git commit -m "feat: build batter and pitcher Statcast profiles for projections"
```

---

### Task 9: CLI — run for a date, print table, write JSON

**Files:**
- Create: `model/cli.py`
- Test: `tests/test_pipeline.py` (append a test for the formatter)

- [ ] **Step 1: Write a failing test for the pure table formatter**

Append to `tests/test_pipeline.py`:

```python
def test_format_hr_table_renders_rows():
    from model.cli import format_table
    rows = [
        {"player": "Big Bopper", "team": "LAD", "park": "COL",
         "probability": 0.21, "wind_out_mph": 10.0},
    ]
    text = format_table(rows, columns=["player", "team", "park", "probability"])
    assert "Big Bopper" in text
    assert "21.0%" in text  # probability formatted as a percentage
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_pipeline.py -k format_hr_table -v`
Expected: FAIL (ModuleNotFoundError: No module named 'model.cli').

- [ ] **Step 3: Write the CLI**

`model/cli.py`:

```python
"""Command-line entry: compute HR + K projections for a date.

Usage:
    uv run python -m model.cli 2026-06-10
Writes JSON to projections-<date>.json and prints tables.
"""

import json
import sys

from model import fetch
from model.pipeline import build_hr_rows, build_strikeout_rows

# Stadium coordinates for weather lookups, keyed by park abbreviation.
PARK_COORDS = {
    "ARI": (33.445, -112.067), "ATL": (33.890, -84.468), "BAL": (39.284, -76.622),
    "BOS": (42.346, -71.097), "CHC": (41.948, -87.655), "CWS": (41.830, -87.634),
    "CIN": (39.097, -84.507), "CLE": (41.496, -81.685), "COL": (39.756, -104.994),
    "DET": (42.339, -83.049), "HOU": (29.757, -95.355), "KC": (39.051, -94.480),
    "LAA": (33.800, -117.883), "LAD": (34.074, -118.240), "MIA": (25.778, -80.220),
    "MIL": (43.028, -87.971), "MIN": (44.982, -93.278), "NYM": (40.757, -73.846),
    "NYY": (40.829, -73.926), "OAK": (38.580, -121.513), "PHI": (39.906, -75.166),
    "PIT": (40.447, -80.006), "SD": (32.707, -117.157), "SF": (37.778, -122.389),
    "SEA": (47.591, -122.332), "STL": (38.622, -90.193), "TB": (27.768, -82.653),
    "TEX": (32.747, -97.083), "TOR": (43.641, -79.389), "WSH": (38.873, -77.007),
}


def format_table(rows: list[dict], columns: list[str]) -> str:
    """Render rows as a fixed-width text table. 'probability'/'over_prob'
    columns are shown as percentages."""
    pct_cols = {"probability", "over_prob"}
    header = " | ".join(c.ljust(12) for c in columns)
    lines = [header, "-" * len(header)]
    for r in rows:
        cells = []
        for c in columns:
            v = r.get(c, "")
            if c in pct_cols and isinstance(v, (int, float)):
                cells.append(f"{v * 100:.1f}%".ljust(12))
            elif isinstance(v, float):
                cells.append(f"{v:.2f}".ljust(12))
            else:
                cells.append(str(v).ljust(12))
        lines.append(" | ".join(cells))
    return "\n".join(lines)


def _weather_fn(game: dict) -> dict:
    lat, lon = PARK_COORDS.get(game["park_team"], (39.0, -98.0))
    return fetch.get_weather(lat, lon, game["game_time"])


def main(date_str: str) -> None:
    slate = fetch.get_schedule(date_str)

    def batters_fn(game_id: int) -> list[dict]:
        # v1: confirmed-lineup hitters via the StatsAPI boxscore; profiles from Statcast.
        ids = fetch.get_lineup_batter_ids(game_id)
        return [fetch.build_batter_profile(pid, int(date_str[:4])) for pid in ids]

    def pitcher_fn(pid: int) -> dict:
        return fetch.build_pitcher_profile(pid, int(date_str[:4]))

    hr_rows = build_hr_rows(slate, batters_fn, _weather_fn)
    k_rows = build_strikeout_rows(slate, pitcher_fn)

    print("\n=== HOME RUNS ===")
    print(format_table(hr_rows, ["player", "team", "park", "probability", "wind_out_mph"]))
    print("\n=== STRIKEOUTS ===")
    print(format_table(k_rows, ["player", "team", "expected_ks", "line", "over_prob"]))

    out = {"date": date_str, "hr": hr_rows, "strikeouts": k_rows}
    path = f"projections-{date_str}.json"
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nSaved {path}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "2026-06-10")
```

- [ ] **Step 4: Add the lineup fetcher used by the CLI to `model/fetch.py`**

Append to `model/fetch.py`:

```python
def get_lineup_batter_ids(game_id: int) -> list[int]:
    """Confirmed batting-order player ids for both teams from the boxscore.

    Falls back to an empty list if lineups aren't posted yet.
    """
    try:
        box = statsapi.boxscore_data(game_id)
    except Exception:
        return []
    ids: list[int] = []
    for side in ("home", "away"):
        order = box.get(side, {}).get("battingOrder", []) or []
        ids.extend(int(pid) for pid in order)
    return ids
```

- [ ] **Step 5: Run the formatter test to verify it passes**

Run: `uv run pytest tests/test_pipeline.py -k format_hr_table -v`
Expected: PASS.

- [ ] **Step 6: Run the full CLI live (manual end-to-end check)**

Run: `uv run python -m model.cli 2026-06-10`
Expected: prints a HOME RUNS table and a STRIKEOUTS table, and writes `projections-2026-06-10.json`. (If lineups aren't posted for that date, HR rows may be sparse — rerun closer to game time or pick a date with confirmed lineups.)

- [ ] **Step 7: Add the output file to `.gitignore` and commit**

```bash
echo "projections-*.json" >> .gitignore
git add model/cli.py model/fetch.py tests/test_pipeline.py .gitignore
git commit -m "feat: add CLI to compute and print HR + strikeout projections"
```

---

### Task 10: Run the full unit suite

**Files:** none (verification only)

- [ ] **Step 1: Run all non-smoke tests**

Run: `uv run pytest -v`
Expected: all unit tests PASS; smoke tests are skipped by default (per `pytest.ini`).

- [ ] **Step 2: Run smoke tests explicitly (optional, needs network)**

Run: `uv run pytest -m smoke -v`
Expected: PASS when MLB has a slate and APIs are reachable.

- [ ] **Step 3: Final commit (if anything changed)**

```bash
git add -A
git commit -m "test: verify full projection-engine suite green" || echo "nothing to commit"
```

---

## Notes for the implementer

- The v1 model is intentionally simple and transparent (multiplicative adjustments + Poisson). It is the foundation; later plans add EV-vs-odds, more props (Hits, Total Bases, H+R+RBI, walks, outs), batter-level park factors, and eventually simulation.
- `matchup_mult` and `opponent_k_mult` are wired through but default to 1.0 in v1; a later task computes them from handedness splits and opposing-lineup K%.
- Keep network code only in `fetch.py`. If you need a new data point, add a fetcher there and inject it through the pipeline so the math stays unit-testable.
