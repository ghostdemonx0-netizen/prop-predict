# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every issue found in the 2026-06-11 Fable 5 audit — wire the already-computed matchup math into the actual probabilities, eliminate lookahead bias in backfilled profiles, fix the website's wrong-date player pages and misleading strength labels, and clean up dead/duplicated code — so the daily-automation plan starts from a clean base.

**Architecture:** The engine keeps its "pure math modules + injected fetchers" shape. Two structural changes: (1) profiles are now computed from cached *raw event lists* as of a slate date (new `model/profiles.py`), instead of cached pre-computed profiles, which kills lookahead bias and lets `cli.py` share `export_web.py`'s plumbing; (2) the web's display scales become prop-aware (`hr` vs `k`) and shared helpers consolidate into `lib/format.ts`. Players gain a stable `player_id` carried from engine to URL.

**Tech Stack:** Python 3 (pytest, pybaseball, MLB-StatsAPI, requests, pandas), Next.js 16 + React (vitest), no new dependencies.

**Out of scope (deliberately):** daily automation itself; intraday "freeze started games" merge logic (belongs to the automation plan — `backfill.py` keeps `include_started=True` for full-day boards); smart per-pitcher K lines (real odds are paywalled; flat 5.5 stays for now); corner/pull-wind credit in the HR math (roadmap).

**Verification baseline (already confirmed):** `.venv/bin/python -m pytest -q` → 37 passed; `cd web && npx vitest run` → 4 passed. Both suites must stay green after every task.

**Commit cadence:** one commit per task, message given in each task's final step. Do NOT push — the user previews locally first (their standing workflow rule).

---

## File map

| File | Change |
|---|---|
| `model/projections.py` | + `lineup_expected_ks`, `pitcher_hr_mult`, `expected_pa_for_slot` |
| `model/matchup.py` | + `hr_platoon_mult` |
| `model/pipeline.py` | wire matchup/pitcher/slot/park-neutralization into HR rows; opponent-adjusted K lambda; export `player_id`, `matchup_mult`, `pitcher_mult` |
| `model/profiles.py` | **new** — pure profile math from event lists, `as_of`-aware |
| `model/fetch.py` | + `batter_events`, `pitcher_events`, `PARK_COORDS`, `make_weather_fn`; − `build_batter_profile`, `build_pitcher_profile`, `get_lineup_batter_ids`, `get_player_names` |
| `model/export_web.py` | + `make_profile_fns` (events cache + as_of profiles); use `fetch.make_weather_fn()` |
| `model/cli.py` | thin: reuse `export_web.make_profile_fns` + `fetch.make_weather_fn`; − `PARK_COORDS`, `_weather_fn` |
| `model/backfill.py` | iterate oldest → newest |
| `tests/fixtures.py` | batters: drop `expected_pa`/`matchup_mult`; pitchers: + `hr_allowed_rate`, `bf` |
| `tests/test_projections.py`, `tests/test_matchup.py`, `tests/test_pipeline.py` | new cases for the above |
| `tests/test_profiles.py` | **new** — pure profile tests incl. lookahead guard |
| `tests/test_fetch_smoke.py` | profile smokes → event smokes; − `get_player_names` smoke |
| `web/lib/format.ts` | prop-aware `strengthTier`/`strengthLabel`/`heatColor`; + `windText`/`arrowColor`; − dead `windLabel`/`sortByProb` (verify unused first) |
| `web/lib/types.ts` | + `player_id?`, `matchup_mult?`, `pitcher_mult?` |
| `web/app/page.tsx` | date-carrying, id-based links; stable row ids; updated-stamp; honest day-count copy |
| `web/components/PropBoard.tsx` | `kind` prop; shared helpers; id keys |
| `web/components/ParksBoard.tsx` | shared helpers |
| `web/app/player/[prop]/[id]/page.tsx` | `searchParams` date; id-or-name lookup; pitcher Factor; shared helpers |
| `web/components/tests/format.test.ts` | updated for the above |

---

### Task 1: Opponent-adjusted strikeout projection

The per-batter log5 `k_prob`s are already computed for every K row (display only). Average them and multiply by expected batters faced → an opponent-adjusted lambda. Falls back to the old pitcher-only estimate when no lineup is posted.

**Files:**
- Modify: `model/projections.py`
- Modify: `model/pipeline.py:83-120` (`build_strikeout_rows`)
- Test: `tests/test_projections.py`, `tests/test_pipeline.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_projections.py`:

```python
def test_lineup_expected_ks_averages_lineup_probs():
    from model.projections import lineup_expected_ks
    # three batters at 0.30/0.20/0.25 -> mean 0.25; * 24 BF = 6.0
    assert lineup_expected_ks([0.30, 0.20, 0.25], 24) == pytest.approx(6.0)


def test_lineup_expected_ks_empty_lineup_returns_none():
    from model.projections import lineup_expected_ks
    assert lineup_expected_ks([], 24) is None
```

Append to `tests/test_pipeline.py`:

```python
def test_strikeout_rows_adjust_lambda_for_opposing_lineup():
    from model.matchup import strikeout_prob
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn)
    ace = next(r for r in rows if r["player"] == "Ace Coors")
    # Ace (k_per_bf 0.27, 24 BF) faces only Away Slugger (k_rate 0.25, bats L vs R)
    expected = strikeout_prob(0.25, 0.27, bats="L", throws="R") * 24
    assert ace["expected_ks"] == pytest.approx(expected)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_projections.py tests/test_pipeline.py -q`
Expected: 2 new tests FAIL (`ImportError: cannot import name 'lineup_expected_ks'`; pipeline lambda still `0.27*24*1.04`).

- [ ] **Step 3: Implement**

Append to `model/projections.py`:

```python
def lineup_expected_ks(k_probs: list[float], expected_bf: float) -> float | None:
    """Opponent-adjusted expected strikeouts.

    Average per-PA strikeout probability against the actual posted lineup
    (log5 + platoon, computed upstream) times expected batters faced.
    Returns None when the lineup is empty so callers can fall back to the
    pitcher-only estimate.
    """
    if not k_probs:
        return None
    return (sum(k_probs) / len(k_probs)) * expected_bf
```

In `model/pipeline.py`, import it (`from model.projections import hr_probability, expected_strikeouts, poisson_over_prob, lineup_expected_ks`) and in `build_strikeout_rows` move the `matchups` loop ABOVE the lambda computation, then replace the `lam = ...` line:

```python
            matchups = []
            for b in lineups.get(opp_side, []):
                m = matchup(
                    b_k=b.get("k_rate", 0.22), b_hit=b.get("hit_rate", 0.22),
                    p_k=p.get("k_per_bf", 0.22), p_hit=p.get("hit_allowed_rate", 0.22),
                    bats=b.get("bats", "R"), throws=p.get("throws", "R"),
                )
                matchups.append({"name": b["name"], "bats": b.get("bats", "R"), **m})
            lam = lineup_expected_ks([m["k_prob"] for m in matchups], p["expected_bf"])
            if lam is None:
                lam = expected_strikeouts(p["k_per_bf"], p["expected_bf"], p.get("opponent_k_mult", 1.0))
            line = p.get("k_line", 5.5)
```

- [ ] **Step 4: Run the full Python suite**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (39 passed).

- [ ] **Step 5: Commit**

```bash
git add model/projections.py model/pipeline.py tests/test_projections.py tests/test_pipeline.py
git commit -m "feat: opponent-adjusted strikeout lambda from posted lineup"
```

---

### Task 2: Pitcher quality + platoon pure functions for HR

Two new pure functions: `pitcher_hr_mult` (regressed HR-allowed rate vs league, as a multiplier) and `hr_platoon_mult` (handedness HR adjustment). Plus `expected_pa_for_slot` (batting-order PA table). Wiring into the pipeline is Task 3.

**Files:**
- Modify: `model/projections.py`, `model/matchup.py`
- Test: `tests/test_projections.py`, `tests/test_matchup.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_projections.py`:

```python
def test_pitcher_hr_mult_league_average_is_neutral():
    from model.projections import pitcher_hr_mult
    assert pitcher_hr_mult(0.033, 500) == pytest.approx(1.0)


def test_pitcher_hr_mult_no_data_is_neutral():
    from model.projections import pitcher_hr_mult
    assert pitcher_hr_mult(0.0, 0) == pytest.approx(1.0)


def test_pitcher_hr_mult_gopher_ball_pitcher_clamped():
    from model.projections import pitcher_hr_mult
    # 0.05 HR/BF over 400 BF: (20 + 6.6)/600 = 0.04433/0.033 = 1.343 -> clamp 1.3
    assert pitcher_hr_mult(0.05, 400) == pytest.approx(1.3)


def test_pitcher_hr_mult_hr_suppressor_below_one():
    from model.projections import pitcher_hr_mult
    assert pitcher_hr_mult(0.015, 500) < 1.0


def test_expected_pa_for_slot_declines_through_order():
    from model.projections import expected_pa_for_slot
    assert expected_pa_for_slot(0) == pytest.approx(4.65)
    assert expected_pa_for_slot(8) == pytest.approx(3.78)
    assert expected_pa_for_slot(0) > expected_pa_for_slot(4) > expected_pa_for_slot(8)
    assert expected_pa_for_slot(11) == 4.0  # out of range -> neutral
```

Append to `tests/test_matchup.py`:

```python
def test_hr_platoon_mult():
    from model.matchup import hr_platoon_mult
    assert hr_platoon_mult("L", "R") == pytest.approx(1.06)  # advantage
    assert hr_platoon_mult("R", "R") == pytest.approx(0.95)  # same-hand
    assert hr_platoon_mult("S", "L") == pytest.approx(1.06)  # switch always has it
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_projections.py tests/test_matchup.py -q`
Expected: new tests FAIL with ImportError.

- [ ] **Step 3: Implement**

Append to `model/projections.py`:

```python
PA_BY_SLOT = (4.65, 4.54, 4.43, 4.32, 4.21, 4.10, 3.99, 3.89, 3.78)


def expected_pa_for_slot(slot: int) -> float:
    """Average plate appearances by batting-order slot (0 = leadoff).

    League-average figures; out-of-range slots get a neutral 4.0.
    """
    return PA_BY_SLOT[slot] if 0 <= slot < len(PA_BY_SLOT) else 4.0


def pitcher_hr_mult(
    hr_allowed_rate: float,
    bf: float,
    *,
    league_hr_rate: float = 0.033,
    regression_bf: float = 200.0,
) -> float:
    """How much the opposing pitcher inflates or suppresses HRs.

    The pitcher's HR-allowed-per-batter rate is regressed toward league
    average with ``regression_bf`` phantom batters faced, then expressed as
    a multiplier vs league (1.0 = average), clamped to [0.75, 1.3].
    """
    reg = (hr_allowed_rate * bf + league_hr_rate * regression_bf) / (bf + regression_bf)
    return max(0.75, min(reg / league_hr_rate, 1.3))
```

Append to `model/matchup.py`:

```python
def hr_platoon_mult(bats: str, throws: str) -> float:
    """HR platoon adjustment: hitters homer more with the platoon advantage
    (opposite hands, or switch), less without it."""
    return 1.06 if batter_advantage(bats, throws) else 0.95
```

- [ ] **Step 4: Run the full Python suite**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (45 passed).

- [ ] **Step 5: Commit**

```bash
git add model/projections.py model/matchup.py tests/test_projections.py tests/test_matchup.py
git commit -m "feat: pitcher HR quality, HR platoon, and per-slot PA pure functions"
```

---

### Task 3: Wire matchup math, slot PAs, and park neutralization into HR rows

`build_hr_rows` now: (a) uses `hr_platoon_mult` as `matchup_mult`, (b) uses `pitcher_hr_mult` from the opposing starter's profile as `pitcher_mult`, (c) takes `expected_pa` from batting-order slot, (d) neutralizes the park double-count by dividing the game park factor by √(batter's own home-park factor), and (e) exports `player_id`, `matchup_mult`, `pitcher_mult` on every row (K rows get `player_id` too).

**Files:**
- Modify: `model/pipeline.py:37-80` (`build_hr_rows`), `build_strikeout_rows` row dict
- Modify: `tests/fixtures.py`
- Test: `tests/test_pipeline.py`

- [ ] **Step 1: Update fixtures**

In `tests/fixtures.py`, replace `_batter` (drop `expected_pa` and `matchup_mult` — both now computed in the pipeline):

```python
def _batter(pid, name, team, bats, hr, k_rate, hit_rate):
    return {
        "player_id": pid, "name": name, "team": team, "bats": bats,
        "season_hr": hr, "season_pa": 600,
        "recent_form_mult": 1.10,
        "k_rate": k_rate, "hit_rate": hit_rate,
    }
```

and replace `SAMPLE_PITCHERS` (adds `hr_allowed_rate` + `bf`):

```python
SAMPLE_PITCHERS = {
    201: {"player_id": 201, "name": "Ace Coors", "team": "COL", "throws": "R",
          "k_per_bf": 0.27, "expected_bf": 24, "opponent_k_mult": 1.04,
          "k_line": 5.5, "hit_allowed_rate": 0.20, "hr_allowed_rate": 0.030, "bf": 430},
    202: {"player_id": 202, "name": "Dodger Arm", "team": "LAD", "throws": "L",
          "k_per_bf": 0.25, "expected_bf": 23, "opponent_k_mult": 1.00,
          "k_line": 5.5, "hit_allowed_rate": 0.21, "hr_allowed_rate": 0.040, "bf": 460},
}
```

- [ ] **Step 2: Write the failing test**

Append to `tests/test_pipeline.py` (add `import math` at the top):

```python
def test_hr_rows_wire_pitcher_platoon_slot_and_park():
    from model.projections import pitcher_hr_mult
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    home = next(r for r in rows if r["team"] == "COL")
    # COL R batter vs LAD L starter -> platoon advantage
    assert home["matchup_mult"] == pytest.approx(1.06)
    # pitcher quality from Dodger Arm's HR-allowed profile
    assert home["pitcher_mult"] == pytest.approx(pitcher_hr_mult(0.040, 460))
    # game park (COL 1.22) divided by sqrt of the batter's home park (COL)
    assert home["park_mult"] == pytest.approx(1.22 / math.sqrt(1.22))
    assert home["player_id"] == 101


def test_k_rows_carry_player_id():
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn)
    assert {r["player_id"] for r in rows} == {201, 202}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_pipeline.py -q`
Expected: the 2 new tests FAIL (KeyError `matchup_mult` / `player_id`).

- [ ] **Step 4: Implement in `model/pipeline.py`**

Add imports at the top:

```python
from math import sqrt

from model.matchup import matchup, hr_platoon_mult
from model.projections import (
    hr_probability, expected_strikeouts, poisson_over_prob,
    lineup_expected_ks, expected_pa_for_slot, pitcher_hr_mult,
)
```

Replace the batter loop body in `build_hr_rows`:

```python
        for side, opp in (("home", away_p), ("away", home_p)):
            team = game.get(side, "?")
            # the game park factor, with the half already baked into the
            # batter's own season rate (his home park) divided back out
            eff_park = park_mult / sqrt(hr_park_factor(team))
            for slot, b in enumerate(lineups.get(side, [])):
                platoon = hr_platoon_mult(b.get("bats", "R"), opp.get("throws", "R")) if opp else 1.0
                p_mult = pitcher_hr_mult(opp.get("hr_allowed_rate", 0.033), opp.get("bf", 0)) if opp else 1.0
                prob = hr_probability(
                    season_hr=b["season_hr"], season_pa=b["season_pa"],
                    recent_form_mult=b.get("recent_form_mult", 1.0),
                    matchup_mult=platoon, pitcher_mult=p_mult,
                    park_mult=eff_park, weather_mult=weather_mult,
                    expected_pa=expected_pa_for_slot(slot),
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
                    "player_id": b.get("player_id"),
                    "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                    "player": b["name"], "team": team, "park": game["park_team"],
                    "probability": prob, "wind_out_mph": w["wind_out_mph"],
                    "weather_mult": weather_mult, "park_mult": eff_park,
                    "matchup_mult": platoon, "pitcher_mult": p_mult,
                    "recent_form_mult": b.get("recent_form_mult", 1.0),
                    "wind_mph": w["wind_mph"], "wind_dir": w["wind_dir"],
                    "temp_f": w["temp_f"], "precip_pct": w["precip_pct"],
                    "bats": b.get("bats", "R"), "vs": vs,
                })
```

In `build_strikeout_rows`, add `"player_id": p.get("player_id"),` to the row dict (right after `"game_id": game["game_id"],`).

- [ ] **Step 5: Run the full Python suite**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (47 passed). If `test_build_hr_rows_produces_expected_fields` fails, it only asserts ranges/names — re-read the failure; do not weaken the new assertions.

- [ ] **Step 6: Commit**

```bash
git add model/pipeline.py tests/fixtures.py tests/test_pipeline.py
git commit -m "feat: HR probability now uses pitcher quality, platoon, lineup slot, and park-neutralized rates"
```

---

### Task 4: Events-based profiles with as-of date (kills lookahead bias)

New pure module `model/profiles.py` computes batter/pitcher profiles from slim event lists **as of a slate date** (only games strictly before `as_of` count, recent-form window anchored to `as_of`). `model/fetch.py` gains slim event fetchers. This makes backfilled days honest and is the foundation the future pick-log grader needs.

**Files:**
- Create: `model/profiles.py`
- Create: `tests/test_profiles.py`
- Modify: `model/fetch.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_profiles.py`:

```python
import pytest
from model.profiles import batter_profile_from_events, pitcher_profile_from_events


def _ev(date, events=None, launch_speed=None):
    return {"game_date": date, "events": events, "launch_speed": launch_speed}


def test_batter_profile_counts_and_rates():
    events = [
        _ev("2026-06-01", "home_run", 105.0),
        _ev("2026-06-01", "strikeout"),
        _ev("2026-06-02", "single", 88.0),
        _ev("2026-06-02", None, 70.0),   # non-PA pitch: not a plate appearance
        _ev("2026-06-03", "field_out", 96.0),
    ]
    p = batter_profile_from_events(events, as_of="2026-06-10", player_id=1, name="Test", bats="L")
    assert p["season_pa"] == 4
    assert p["season_hr"] == 1
    assert p["k_rate"] == pytest.approx(0.25)
    assert p["hit_rate"] == pytest.approx(0.5)
    assert p["player_id"] == 1 and p["bats"] == "L"


def test_batter_profile_excludes_games_on_or_after_as_of():
    events = [_ev("2026-06-01", "home_run", 100.0), _ev("2026-06-05", "home_run", 100.0)]
    p = batter_profile_from_events(events, as_of="2026-06-05", player_id=1)
    assert p["season_hr"] == 1  # the as_of-day HR must NOT count (no lookahead)


def test_batter_recent_form_hot_when_recent_contact_harder():
    cold = [_ev("2026-04-01", "field_out", 85.0)] * 10
    hot = [_ev("2026-06-08", "field_out", 105.0)] * 10
    p = batter_profile_from_events(cold + hot, as_of="2026-06-10", player_id=1)
    assert p["recent_form_mult"] > 1.0
    assert p["recent_form_mult"] <= 1.25


def test_pitcher_profile_from_events():
    events = [
        {"game_date": "2026-06-01", "events": "strikeout", "game_pk": 11},
        {"game_date": "2026-06-01", "events": "single", "game_pk": 11},
        {"game_date": "2026-06-06", "events": "home_run", "game_pk": 12},
        {"game_date": "2026-06-06", "events": "strikeout", "game_pk": 12},
    ]
    p = pitcher_profile_from_events(events, as_of="2026-06-10", player_id=2, throws="L")
    assert p["k_per_bf"] == pytest.approx(0.5)
    assert p["hit_allowed_rate"] == pytest.approx(0.25)
    assert p["hr_allowed_rate"] == pytest.approx(0.25)
    assert p["expected_bf"] == pytest.approx(2.0)  # 4 PA over 2 games
    assert p["bf"] == 4
    assert p["k_line"] == 5.5 and p["throws"] == "L"


def test_pitcher_profile_no_data_defaults():
    p = pitcher_profile_from_events([], as_of="2026-06-10", player_id=3)
    assert p["k_per_bf"] == 0.0
    assert p["expected_bf"] == 24.0
    assert p["bf"] == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_profiles.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.profiles'`.

- [ ] **Step 3: Create `model/profiles.py`**

```python
"""Pure profile math from slim Statcast event rows.

Profiles are computed *as of* a slate date: only games strictly before
``as_of`` count, and the recent-form window is anchored to ``as_of``, so
regenerating a past date cannot peek at games played after it (no
lookahead bias in backfills or future backtests).
"""

import datetime as dt

_K_EVENTS = ("strikeout", "strikeout_double_play")
_HIT_EVENTS = ("single", "double", "triple", "home_run")


def _hard_hit_rate(rows: list[dict]) -> float:
    if not rows:
        return 0.0
    return sum(1 for e in rows if e["launch_speed"] >= 95) / len(rows)


def batter_profile_from_events(events: list[dict], *, as_of: str, player_id: int,
                               name: str = "", team: str = "", bats: str = "") -> dict:
    """events: [{game_date, events, launch_speed}, ...] for one batter-season."""
    past = [e for e in events if e["game_date"] < as_of]
    pa_rows = [e for e in past if e["events"]]
    pa = len(pa_rows)
    hr = sum(1 for e in pa_rows if e["events"] == "home_run")
    ks = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)

    bip = [e for e in past if e["launch_speed"] is not None]
    season_hard = _hard_hit_rate(bip)
    cutoff = (dt.date.fromisoformat(as_of) - dt.timedelta(days=15)).isoformat()
    recent = [e for e in bip if e["game_date"] >= cutoff]
    recent_hard = _hard_hit_rate(recent) if recent else season_hard
    recent_form_mult = max(0.8, min(1.25, 1.0 + (recent_hard - season_hard) * 1.5))

    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "bats": bats,
        "season_hr": hr,
        "season_pa": pa,
        "recent_form_mult": recent_form_mult,
        "k_rate": (ks / pa) if pa else 0.0,
        "hit_rate": (hits / pa) if pa else 0.0,
    }


def pitcher_profile_from_events(events: list[dict], *, as_of: str, player_id: int,
                                name: str = "", team: str = "", throws: str = "",
                                k_line: float = 5.5) -> dict:
    """events: [{game_date, events, game_pk}, ...] for one pitcher-season."""
    past = [e for e in events if e["game_date"] < as_of]
    pa_rows = [e for e in past if e["events"]]
    pa = len(pa_rows)
    ks = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)
    hr = sum(1 for e in pa_rows if e["events"] == "home_run")
    games = len({e["game_pk"] for e in past})

    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "throws": throws,
        "k_per_bf": (ks / pa) if pa else 0.0,
        "expected_bf": (pa / games) if games else 24.0,
        "opponent_k_mult": 1.0,
        "k_line": k_line,
        "hit_allowed_rate": (hits / pa) if pa else 0.0,
        "hr_allowed_rate": (hr / pa) if pa else 0.0,
        "bf": pa,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_profiles.py -q`
Expected: 5 passed.

- [ ] **Step 5: Add slim event fetchers to `model/fetch.py`**

Add after `_date_window` (keep `build_batter_profile`/`build_pitcher_profile` in place for now — they're removed in Task 5):

```python
_BATTER_EVENT_COLS = ["game_date", "events", "launch_speed"]
_PITCHER_EVENT_COLS = ["game_date", "events", "game_pk"]


def _slim_records(df: pd.DataFrame, cols: list[str]) -> list[dict]:
    """Reduce a Statcast frame to JSON-safe dicts with only the columns the
    profile math needs (cache-friendly: ~100x smaller than the raw pull)."""
    if df is None or len(df) == 0:
        return []
    d = df[cols].copy()
    d["game_date"] = pd.to_datetime(d["game_date"]).dt.strftime("%Y-%m-%d")
    d = d.astype(object).where(pd.notna(d), None)
    return d.to_dict("records")


def batter_events(player_id: int, season: int) -> list[dict]:
    """One batter-season of slim Statcast rows: game_date, events, launch_speed."""
    start, end = _date_window(season)
    return _slim_records(statcast_batter(start, end, player_id), _BATTER_EVENT_COLS)


def pitcher_events(player_id: int, season: int) -> list[dict]:
    """One pitcher-season of slim Statcast rows: game_date, events, game_pk."""
    start, end = _date_window(season)
    return _slim_records(statcast_pitcher(start, end, player_id), _PITCHER_EVENT_COLS)
```

Also add the live smoke tests to `tests/test_fetch_smoke.py`:

```python
def test_batter_events_smoke():
    from model.fetch import batter_events
    ev = batter_events(592450, 2026)  # Aaron Judge
    assert len(ev) > 0
    assert {"game_date", "events", "launch_speed"} <= set(ev[0])
    assert ev[0]["game_date"][:4] == "2026"


def test_pitcher_events_smoke():
    from model.fetch import pitcher_events
    ev = pitcher_events(669373, 2026)  # Tarik Skubal
    assert len(ev) > 0
    assert {"game_date", "events", "game_pk"} <= set(ev[0])
```

- [ ] **Step 6: Run the full suite + the two new smokes**

Run: `.venv/bin/python -m pytest -q && .venv/bin/python -m pytest -q -m smoke -k "events" --override-ini "addopts="`
Expected: unit suite all pass; 2 event smokes pass (network required — if offline, note it and continue; rerun before final verification). Note: check `pytest.ini` for how smoke tests are deselected; adjust the `-m`/`addopts` invocation to match.

- [ ] **Step 7: Commit**

```bash
git add model/profiles.py model/fetch.py tests/test_profiles.py tests/test_fetch_smoke.py
git commit -m "feat: as-of-date profiles from slim cached events (no lookahead bias)"
```

---

### Task 5: Rewire export_web + cli onto events cache; weather memoize; remove dead code

`export_web` caches raw events (`bat-events-{pid}-{season}`) and computes profiles per date. `cli.py` reuses the same plumbing instead of its own uncached copy. Weather is fetched once per game per run via a memoizing factory in `fetch` (was 3 Open-Meteo calls per game; also breaks the cli↔export_web import cycle). Dead fetch functions removed.

**Files:**
- Modify: `model/fetch.py` (+`PARK_COORDS`, `make_weather_fn`; − `build_batter_profile`, `build_pitcher_profile`, `get_lineup_batter_ids`, `get_player_names`)
- Modify: `model/export_web.py`, `model/cli.py`
- Modify: `tests/test_fetch_smoke.py` (drop smokes for removed functions)

- [ ] **Step 1: Move park coords + weather fn into `model/fetch.py`**

Move the `PARK_COORDS` dict verbatim from `model/cli.py:15-26` into `model/fetch.py` (module level, after `_TEAM_ABBR`), and add:

```python
def make_weather_fn():
    """Per-run memoized game-weather fetcher (one Open-Meteo call per game,
    shared by the HR, K, and games builders)."""
    seen: dict[int, dict] = {}

    def weather_fn(game: dict) -> dict:
        gid = game["game_id"]
        if gid not in seen:
            lat, lon = PARK_COORDS.get(game["park_team"], (39.0, -98.0))
            if not game.get("game_time"):
                # game time not posted yet -> neutral weather rather than crashing
                seen[gid] = {"wind_speed_mph": 0.0, "wind_from_deg": 0.0,
                             "temp_f": 70.0, "precip_pct": 0}
            else:
                seen[gid] = get_weather(lat, lon, game["game_time"])
        return seen[gid]

    return weather_fn
```

- [ ] **Step 2: Rewire `model/export_web.py`**

Replace the imports of `_weather_fn` and the profile/lineup plumbing inside `main` with a reusable factory. Full new file body for the changed parts:

```python
from model import fetch, profiles
from model.cache import get_or_compute
from model.pipeline import build_hr_rows, build_strikeout_rows, build_games
```

(remove `from model.cli import _weather_fn`), and above `main`:

```python
def make_profile_fns(slate: list[dict], season: int, as_of: str):
    """(lineups_fn, pitcher_fn) backed by the on-disk events cache.

    Raw per-player Statcast events are cached once per season; profiles are
    computed fresh per slate date so a regenerated past day only sees games
    played before it.
    """
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
        events = get_or_compute(f"bat-events-{pid}-{season}", lambda: fetch.batter_events(pid, season))
        return profiles.batter_profile_from_events(
            events, as_of=as_of, player_id=pid, name=m.get("name", str(pid)), bats=m.get("bats", "R"))

    def pitcher_fn(pid: int) -> dict:
        m = meta.get(pid, {})
        events = get_or_compute(f"pit-events-{pid}-{season}", lambda: fetch.pitcher_events(pid, season))
        return profiles.pitcher_profile_from_events(
            events, as_of=as_of, player_id=pid, name=m.get("name", str(pid)), throws=m.get("throws", "R"))

    def lineups_fn(game: dict) -> dict:
        lns = lineup_cache[game["game_id"]]
        return {
            "home": [batter_profile(pid) for pid in lns["home"]],
            "away": [batter_profile(pid) for pid in lns["away"]],
        }

    return lineups_fn, pitcher_fn
```

and `main` becomes:

```python
def main(date_str: str, max_games: int | None = None, include_started: bool = False) -> None:
    season = int(date_str[:4])
    slate = fetch.get_schedule(date_str)
    if max_games is not None:
        slate = slate[:max_games]
    if include_started:
        # demo/backfill mode: process finished games too (so a past date with
        # posted lineups produces a full board to preview the site with real data)
        for g in slate:
            g["started"] = False

    _ensure_starters(slate)
    lineups_fn, pitcher_fn = make_profile_fns(slate, season, date_str)
    weather_fn = fetch.make_weather_fn()

    hr_rows = build_hr_rows(slate, lineups_fn, pitcher_fn, weather_fn)
    k_rows = build_strikeout_rows(slate, pitcher_fn, lineups_fn, weather_fn)

    payload = {
        "date": date_str,
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "hr": hr_rows,
        "strikeouts": k_rows,
        "games": build_games(slate, weather_fn),
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / f"{date_str}.json").write_text(json.dumps(payload, indent=2))
    # latest.json mirrors the date just written (fallback default for the site)
    (DATA_DIR / "latest.json").write_text(json.dumps(payload, indent=2))
    _update_index(date_str)
    print(f"Wrote {date_str}.json ({len(hr_rows)} HR rows, {len(k_rows)} K rows, {len(payload['games'])} games)")
```

- [ ] **Step 3: Slim `model/cli.py` to reuse the same plumbing**

Replace `model/cli.py`'s `PARK_COORDS`, `_weather_fn`, and `main` (keep `format_table` exactly as is — a pipeline test imports it):

```python
"""Command-line entry: compute HR + K projections for a date.

Usage:
    uv run python -m model.cli 2026-06-10
Writes JSON to projections-<date>.json and prints tables.
"""

import json
import sys

from model import fetch
from model.export_web import make_profile_fns
from model.pipeline import build_hr_rows, build_strikeout_rows


def format_table(rows: list[dict], columns: list[str]) -> str:
    ... (unchanged) ...


def main(date_str: str) -> None:
    slate = fetch.get_schedule(date_str)
    lineups_fn, pitcher_fn = make_profile_fns(slate, int(date_str[:4]), date_str)
    weather_fn = fetch.make_weather_fn()

    hr_rows = build_hr_rows(slate, lineups_fn, pitcher_fn, weather_fn)
    k_rows = build_strikeout_rows(slate, pitcher_fn, lineups_fn, weather_fn)

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

- [ ] **Step 4: Delete dead code**

From `model/fetch.py` remove: `build_batter_profile`, `build_pitcher_profile`, `get_lineup_batter_ids`, `get_player_names`.
From `tests/test_fetch_smoke.py` remove: `test_build_batter_profile_smoke`, `test_build_pitcher_profile_smoke`, `test_get_player_names_smoke`, `test_profiles_include_rates_and_hand_smoke`.
Verify nothing else references them: `grep -rn "build_batter_profile\|build_pitcher_profile\|get_lineup_batter_ids\|get_player_names" model/ tests/` → expect no hits.

- [ ] **Step 5: Run the full suite + a live one-game export**

Run: `.venv/bin/python -m pytest -q`
Expected: all unit tests pass.
Run: `rm -rf .cache && .venv/bin/python -m model.export_web 2026-06-10 2 --include-started`
Expected: prints `Wrote 2026-06-10.json (... HR rows, ... K rows, 2 games)` with nonzero rows; spot-check that a row has `"player_id"`, `"pitcher_mult"`, `"matchup_mult"`. (Old `batter-*`/`pitcher-*` cache keys are orphaned — the `rm -rf .cache` clears them.)

- [ ] **Step 6: Commit**

```bash
git add model/fetch.py model/export_web.py model/cli.py tests/test_fetch_smoke.py
git commit -m "refactor: events cache + as-of profiles in export/cli, memoized weather, drop dead fetchers"
```

---

### Task 6: Backfill oldest → newest + strict rolling-7 window

Two related fixes. (a) `export_web.main` mirrors every written date into `latest.json`; backfill currently walks newest→oldest, so a clean run leaves `latest.json` pointing at the OLDEST day — reverse the order. (b) The date index caps at 14 while the site promises 7, and date files that fall out of the window are never deleted — make `_update_index` keep a strict rolling 7 and prune stale files (user-confirmed 2026-06-11; this was originally queued for the automation plan). The intraday freeze-merge for today's games is still the automation plan's job — `include_started=True` intentionally stays.

**Files:**
- Modify: `model/backfill.py:16-24`, `model/export_web.py` (`_update_index`)
- Test: `tests/test_export_web.py` (new)

- [ ] **Step 1: Write the failing test for the rolling window**

Create `tests/test_export_web.py`:

```python
import json


def test_update_index_caps_at_seven_and_prunes_old_files(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    (tmp_path / "latest.json").write_text("{}")
    for day in range(1, 10):  # nine consecutive days
        d = f"2026-06-{day:02d}"
        (tmp_path / f"{d}.json").write_text("{}")
        export_web._update_index(d)
    idx = json.loads((tmp_path / "index.json").read_text())
    # newest 7 only, newest first
    assert idx["dates"] == [f"2026-06-{day:02d}" for day in range(9, 2, -1)]
    # files that fell out of the window are deleted; the rest survive
    assert not (tmp_path / "2026-06-01.json").exists()
    assert not (tmp_path / "2026-06-02.json").exists()
    assert (tmp_path / "2026-06-03.json").exists()
    assert (tmp_path / "2026-06-09.json").exists()
    # latest.json and index.json are never pruned
    assert (tmp_path / "latest.json").exists()
    assert (tmp_path / "index.json").exists()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_export_web.py -q`
Expected: FAIL — index holds 9 dates (cap is 14) and old files still exist.

- [ ] **Step 3: Implement the rolling window in `model/export_web.py`**

Replace `_update_index`:

```python
def _update_index(date_str: str) -> None:
    """Maintain web/public/data/index.json: a newest-first list of dates that
    have a data file, capped at a strict rolling 7. Date files that fall out
    of the window are deleted (latest.json/index.json are never touched)."""
    index_path = DATA_DIR / "index.json"
    dates: list[str] = []
    if index_path.exists():
        try:
            dates = json.loads(index_path.read_text()).get("dates", [])
        except (json.JSONDecodeError, OSError):
            dates = []
    dates = sorted(set(dates) | {date_str}, reverse=True)[:7]
    index_path.write_text(json.dumps({"dates": dates}, indent=2))
    keep = {f"{d}.json" for d in dates} | {"latest.json", "index.json"}
    for f in DATA_DIR.glob("*.json"):
        if f.name not in keep:
            f.unlink()
```

- [ ] **Step 4: Implement the backfill order fix**

Run the new test first: `.venv/bin/python -m pytest tests/test_export_web.py -q` → expected PASS now.

In `model/backfill.py`, change the loop:

```python
def main(end_date: str, days: int = 7, max_games: int | None = None) -> None:
    end = dt.date.fromisoformat(end_date)
    # oldest first, so the newest day is written LAST and latest.json +
    # index.json finish pointing at the most recent date
    for i in reversed(range(days)):
        d = (end - dt.timedelta(days=i)).isoformat()
        print(f"=== backfilling {d} ===")
        try:
            export_web.main(d, max_games=max_games, include_started=True)
        except Exception as e:  # one bad day shouldn't abort the whole backfill
            print(f"  skipped {d}: {e}")
```

- [ ] **Step 5: Run the full suite**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (backfill itself has no unit tests — network module; the one-line order change is verified by reading).

- [ ] **Step 6: Commit**

```bash
git add model/backfill.py model/export_web.py tests/test_export_web.py
git commit -m "fix: backfill oldest-first; strict rolling-7 index with stale-file pruning"
```

---

### Task 7: Prop-aware strength/heat scales + shared wind helpers in `web/lib/format.ts`

K over-probabilities live in 0.35–0.75; HR probabilities in 0.05–0.45. One shared threshold set made every strikeout row scream STRONG. Make `strengthLabel`/`heatColor` take a `PropKind`, add a `strengthTier` for CSS classes, and consolidate the thrice-duplicated `windText`/`arrowColor`/`heatColor` helpers here. Delete dead `windLabel`/`sortByProb` if unused.

**Files:**
- Modify: `web/lib/format.ts`, `web/components/PropBoard.tsx`, `web/components/ParksBoard.tsx`, `web/app/page.tsx`, `web/app/player/[prop]/[id]/page.tsx`
- Test: `web/components/tests/format.test.ts`

- [ ] **Step 1: Check the dead helpers really are dead**

Run: `grep -rn "windLabel\|sortByProb" web/app web/components --include="*.tsx" --include="*.ts" | grep -v tests`
Expected: no hits → safe to delete both (and their test blocks). If there IS a hit, keep that helper and only delete the unused one.

- [ ] **Step 2: Write the failing tests**

Replace `web/components/tests/format.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { pct, strengthLabel, strengthTier, heatColor, windText, arrowColor } from "../../lib/format";

describe("pct", () => {
  it("formats a 0-1 number as a percent string", () => {
    expect(pct(0.31)).toBe("31%");
    expect(pct(0.045)).toBe("5%");
  });
});

describe("strengthLabel / strengthTier", () => {
  it("uses HR thresholds by default", () => {
    expect(strengthLabel(0.3)).toBe("STRONG");
    expect(strengthLabel(0.18)).toBe("Lean");
    expect(strengthLabel(0.05)).toBe("Pass");
  });
  it("uses K-specific thresholds for over-probabilities", () => {
    expect(strengthLabel(0.65, "k")).toBe("STRONG");
    expect(strengthLabel(0.55, "k")).toBe("Lean");
    expect(strengthLabel(0.45, "k")).toBe("Pass");
  });
  it("tier matches label buckets", () => {
    expect(strengthTier(0.3, "hr")).toBe("strong");
    expect(strengthTier(0.45, "k")).toBe("pass");
  });
});

describe("heatColor", () => {
  it("spans the same blue->red range on each prop's own scale", () => {
    expect(heatColor(0.05)).toBe(heatColor(0.35, "k"));  // both bottom of scale
    expect(heatColor(0.45)).toBe(heatColor(0.75, "k"));  // both top of scale
  });
});

describe("wind helpers", () => {
  it("describes the wind direction relative to center field", () => {
    expect(windText(0)).toBe("out to center");
    expect(windText(180)).toBe("blowing in");
  });
  it("colors out-wind green, in-wind red, crosswind amber", () => {
    expect(arrowColor(0)).toBe("var(--green)");
    expect(arrowColor(180)).toBe("var(--red)");
    expect(arrowColor(90)).toBe("var(--amber)");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd web && npx vitest run`
Expected: FAIL — `strengthTier`/`heatColor`/`windText`/`arrowColor` not exported.

- [ ] **Step 4: Implement `web/lib/format.ts`**

Replace the file with:

```ts
export type PropKind = "hr" | "k";

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

// HR probabilities live around 0.05-0.45; K over-probabilities around 0.35-0.75.
// Each prop gets its own thresholds so labels mean the same thing on both boards.
const TIERS: Record<PropKind, { strong: number; lean: number }> = {
  hr: { strong: 0.25, lean: 0.12 },
  k: { strong: 0.6, lean: 0.52 },
};

export function strengthTier(prob: number, kind: PropKind = "hr"): "strong" | "lean" | "pass" {
  const t = TIERS[kind];
  return prob >= t.strong ? "strong" : prob >= t.lean ? "lean" : "pass";
}

export function strengthLabel(prob: number, kind: PropKind = "hr"): string {
  const tier = strengthTier(prob, kind);
  return tier === "strong" ? "STRONG" : tier === "lean" ? "Lean" : "Pass";
}

// Heat-map: cool blue (low) -> warm red-orange (high) across each prop's own range.
const HEAT: Record<PropKind, { lo: number; span: number }> = {
  hr: { lo: 0.05, span: 0.4 },
  k: { lo: 0.35, span: 0.4 },
};

export function heatColor(p: number, kind: PropKind = "hr"): string {
  const { lo, span } = HEAT[kind];
  const t = Math.max(0, Math.min(1, (p - lo) / span));
  return `hsl(${210 - t * 210}, 52%, 40%)`;
}

// Wind direction-of-travel relative to center field: 0 = out to CF,
// 90 = out to RF, 180 = blowing in, 270 = out to LF.
const DIRS = [
  "out to center", "out to right-center", "out to right field", "blowing in (right)",
  "blowing in", "blowing in (left)", "out to left field", "out to left-center",
];

export function windText(dir: number): string {
  return DIRS[Math.round((((dir % 360) + 360) % 360) / 45) % 8];
}

export function arrowColor(dir: number): string {
  const c = Math.cos((dir * Math.PI) / 180);
  return c > 0.2 ? "var(--green)" : c < -0.2 ? "var(--red)" : "var(--amber)";
}
```

- [ ] **Step 5: Update the consumers**

`web/components/PropBoard.tsx`:
- Import: `import { pct, strengthLabel, strengthTier, heatColor, type PropKind } from "../lib/format";`
- Signature: `export function PropBoard({ rows, mode, kind }: { rows: BoardRow[]; mode: ViewMode; kind: PropKind })`
- Delete local `strengthClass`, `badgeClass`, `heatColor`; derive classes from the tier:
  - card class: `` `card rise s-${strengthTier(r.prob, kind)}` ``
  - badge: `` <span className={`badge ${strengthTier(r.prob, kind)}`}>{strengthLabel(r.prob, kind)}</span> ``
- `HeatSphere` takes kind: `function HeatSphere({ prob, kind }: { prob: number; kind: PropKind })` with `const c = heatColor(prob, kind);` — update its three call sites to `<HeatSphere prob={r.prob} kind={kind} />`.

`web/app/page.tsx`: pass the prop kind — `<PropBoard rows={prop === "hr" ? hrRows : kRows} mode={mode} kind={prop === "hr" ? "hr" : "k"} />`.

`web/components/ParksBoard.tsx`: delete local `heatColor`, `arrowColor`, `DIRS`, `windText`; import `{ heatColor, arrowColor, windText }` from `../lib/format` (EnvSphere keeps the default `"hr"` heat scale).

`web/app/player/[prop]/[id]/page.tsx`: delete local `DIRS`, `windText`, `arrowColor`; import them from `../../../../lib/format`. Where the page shows `strengthLabel(r.probability)` for HR keep the default; no K-side strengthLabel is shown.

- [ ] **Step 6: Run web tests + build**

Run: `cd web && npx vitest run && npm run build`
Expected: tests pass; build succeeds with no TS errors.

- [ ] **Step 7: Commit**

```bash
git add web/lib/format.ts web/components/PropBoard.tsx web/components/ParksBoard.tsx web/app/page.tsx "web/app/player/[prop]/[id]/page.tsx" web/components/tests/format.test.ts
git commit -m "fix: prop-aware strength/heat scales; consolidate wind helpers; drop dead format fns"
```

---

### Task 8: Stable player ids + date-carrying links (fixes wrong-day player pages)

Board links now use `player_id` (falling back to name for old sample files) and carry the selected date as `?date=`, so the player page loads the same day the user was browsing instead of always `latest.json`. React keys become collision-safe.

**Files:**
- Modify: `web/lib/types.ts`, `web/app/page.tsx`, `web/components/PropBoard.tsx`, `web/app/player/[prop]/[id]/page.tsx`

- [ ] **Step 1: Extend the types**

In `web/lib/types.ts` add to `HrRow`:

```ts
  player_id?: number;
  matchup_mult?: number; // platoon adjustment vs this starter
  pitcher_mult?: number; // opposing starter's HR quality
```

and to `KRow`:

```ts
  player_id?: number;
```

- [ ] **Step 2: Build id + date-aware links in `web/app/page.tsx`**

Add `id` and date-aware `href` to both row mappings (inside the component, where `selectedDate` is in scope):

```ts
  const dateQ = selectedDate ? `?date=${selectedDate}` : "";
  const hrRows: BoardRow[] = data.hr.map((r) => ({
    id: String(r.player_id ?? r.player),
    player: r.player,
    // ...existing fields unchanged...
    href: `/player/hr/${r.player_id ?? encodeURIComponent(r.player)}${dateQ}`,
```

(same pattern for `kRows` with `/player/k/...`).

In `web/components/PropBoard.tsx`, add `id: string;` to `BoardRow` and switch every `key={r.player}` to `key={r.id}` (Card, Table `<tr>`, and Row).

- [ ] **Step 3: Date + id lookup on the player page**

In `web/app/player/[prop]/[id]/page.tsx`:

```tsx
export default function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ prop: string; id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { prop, id } = use(params);
  const { date } = use(searchParams);
  const name = decodeURIComponent(id);
  const [data, setData] = useState<Projections | null>(null);

  useEffect(() => {
    loadProjections(date).then(setData).catch(console.error);
  }, [date]);
```

and the lookups become id-first with name fallback (sample data has no ids):

```tsx
    const r = data.hr.find((x) => String(x.player_id) === id) ?? data.hr.find((x) => x.player === name);
```

```tsx
  const r = data.strikeouts.find((x) => String(x.player_id) === id) ?? data.strikeouts.find((x) => x.player === name);
```

Also make the "← back to board" link preserve the date: `<Link href={date ? `/?date=${date}` : "/"} ...>`. In `web/app/page.tsx`, read it back on load:

```tsx
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("date");
    loadIndex().then((ds) => {
      setDates(ds);
      setSelectedDate(want && ds.includes(want) ? want : ds[0] ?? "");
    });
  }, []);
```

- [ ] **Step 4: Build + manual check**

Run: `cd web && npx vitest run && npm run build`
Expected: pass, no TS errors. (Behavioral check happens in Task 10's preview: pick an older date → click a player → page shows that date's numbers → back returns to the same date.)

- [ ] **Step 5: Commit**

```bash
git add web/lib/types.ts web/app/page.tsx web/components/PropBoard.tsx "web/app/player/[prop]/[id]/page.tsx"
git commit -m "fix: player pages honor the browsed date; id-based links and keys"
```

---

### Task 9: Updated stamp, honest day-count copy, pitcher factor on HR pages

Three small honesty upgrades: show the engine's `updated` timestamp in the header (trust signal that was always in the data, never rendered); only claim multi-day browsing when multiple days exist; show the new pitcher-matchup factor on HR player pages so the displayed factors match the math.

**Files:**
- Modify: `web/app/page.tsx`, `web/app/player/[prop]/[id]/page.tsx`

- [ ] **Step 1: Header stamp + copy in `web/app/page.tsx`**

Replace the static `· browse the last 7 days` span block with:

```tsx
          {dates.length > 1 && <span style={{ opacity: 0.6 }}>· last {dates.length} days</span>}
          {data.updated && (
            <span style={{ opacity: 0.6 }}>
              · updated {new Date(data.updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
```

- [ ] **Step 2: Pitcher factor on the HR player page**

In `web/app/player/[prop]/[id]/page.tsx`, inside the "What's driving it" panel after the Recent form `<Factor />`, add:

```tsx
          {r.vs && (r.pitcher_mult !== undefined || r.matchup_mult !== undefined) && (
            <Factor
              icon="⚾"
              label={`Pitcher · ${r.vs.name}`}
              mult={(r.pitcher_mult ?? 1) * (r.matchup_mult ?? 1)}
              note={`Combines ${r.vs.name}'s home-run quality with the ${
                (r.matchup_mult ?? 1) > 1 ? "favorable" : "unfavorable"
              } ${batLabel(r.bats)}-vs-${pitLabel(r.vs.throws)} platoon matchup.`}
            />
          )}
```

- [ ] **Step 3: Build + tests**

Run: `cd web && npx vitest run && npm run build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add web/app/page.tsx "web/app/player/[prop]/[id]/page.tsx"
git commit -m "feat: updated stamp, honest day-count copy, pitcher factor on HR pages"
```

---

### Task 10: Full verification, data regeneration, local preview

Everything green, real data regenerated with the new math, site previewed by the user before any push/deploy. **Data regeneration pulls several hundred MB from Baseball Savant — confirm the user is on wifi (not hotspot) before running the backfill.**

- [ ] **Step 1: Full test suites**

Run: `.venv/bin/python -m pytest -q` → all unit tests pass.
Run: `.venv/bin/python -m pytest -q -m smoke --override-ini "addopts="` (network) → smoke tests pass. Note: read `pytest.ini` first and use whatever invocation it defines for including smoke tests.
Run: `cd web && npx vitest run && npm run build` → pass.

- [ ] **Step 2: Regenerate the week of data (ASK THE USER FIRST — heavy download)**

```bash
rm -rf .cache
.venv/bin/python -m model.backfill 2026-06-11 7
```

Expected: seven `=== backfilling YYYY-MM-DD ===` blocks oldest→newest, each ending `Wrote <date>.json (...)`; `latest.json` matches the newest date. A "Error tokenizing data" on one day is a transient garbled Savant CSV — rerun just that date via `model.export_web`.

- [ ] **Step 3: Sanity-check the regenerated output**

```bash
.venv/bin/python - <<'EOF'
import json
d = json.load(open("web/public/data/latest.json"))
hr, ks = d["hr"], d["strikeouts"]
assert hr and ks, "empty board"
assert all("player_id" in r and "pitcher_mult" in r for r in hr), "HR rows missing new fields"
assert all("player_id" in r for r in ks), "K rows missing player_id"
probs = sorted((r["probability"] for r in hr), reverse=True)
assert probs[0] < 0.45, f"top HR prob suspicious: {probs[0]}"
print("OK:", d["date"], len(hr), "HR rows; top prob", round(probs[0], 3))
EOF
```

- [ ] **Step 4: Git data-file choreography (per project memory)**

Only `index.json`, `2026-06-10.json`, `latest.json` are tracked sample files; everything else under `web/public/data/` is gitignored. After the backfill: `git restore web/public/data/index.json web/public/data/2026-06-10.json web/public/data/latest.json` so the tracked samples stay as committed, then regenerate a LOCAL `index.json` listing the on-disk date files so the local picker shows the full week (do not commit it).

- [ ] **Step 5: Local preview for the user**

```bash
pkill -f "next dev" || true; rm -rf web/.next
cd web && npm run dev
```

Share `http://localhost:3000` and walk the user through what changed: K board no longer all-STRONG; pick an old date → click a player → numbers match that date; updated stamp in header; pitcher factor on an HR player page; Parks view unchanged. **Stop here for user approval before any push or deploy** (their standing rule).

---

## Self-review notes

- **Coverage vs audit:** every 🔴/🟠 finding and all "what I'd fix first" items 1–4 have a task; deferred items (K line, corner wind, freeze-merge, automation) are listed as out of scope with reasons.
- **Type consistency check:** `pitcher_hr_mult(hr_allowed_rate, bf)` signature matches its uses in Tasks 3/5; profile dicts emitted by `model/profiles.py` carry every key `pipeline.py` reads (`season_hr`, `season_pa`, `recent_form_mult`, `k_rate`, `hit_rate`, `bats` / `k_per_bf`, `expected_bf`, `k_line`, `hit_allowed_rate`, `hr_allowed_rate`, `bf`, `throws`, `player_id`, `name`); `BoardRow.id` + `kind` props match between page.tsx and PropBoard.
- **Known acceptances:** committed sample data files lack `player_id` — name-fallback lookup keeps them working; `expected_pa` is now always slot-based (profile field removed); `opponent_k_mult` still emitted by pitcher profiles but only used in the no-lineup fallback path.
