# Tier 1 Threshold Props (Hits + Total Bases) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new player props — **Hits** (P≥1/2/3) and **Total Bases** (P≥2/3/4) — built from existing Statcast data, with a per-prop threshold filter, the history toggle, and all existing views/Top Plays/player pages reused. Home Runs & Strikeouts unchanged.

**Architecture:** One pure convolution (`count_ge_prob`) turns a per-at-bat outcome vector into P(≥N over ~4 PAs). Hits use a 2-element vector `[1−p_hit, p_hit]`; Total Bases use `[p0,p1,p2,p3,p4]`. Per-at-bat rates come from the batter profile (history-blendable), the HR component reusing the existing adjusted per-PA HR rate, with 1B/2B/3B regressed + matchup/platoon/recent-form. The board carries both current and history (`_hist`) values; the frontend threshold selector picks which `p_geN` becomes the row's `prob`.

**Tech Stack:** Python 3.12 (pure functions + pytest), Next.js 16 / React / TypeScript. Spec: `docs/superpowers/specs/2026-06-18-tier1-threshold-props-design.md`.

## Global Constraints

- **Home Runs and Strikeouts props stay byte-for-byte unchanged** — Tier 1 is purely additive (new module, new profile fields, new pipeline builders, new payload keys `hits`/`total_bases`, new pills). Refactors that touch `hr_probability` MUST preserve its exact output (a regression test guards it).
- **Thresholds:** Hits `1+/2+/3+` (default `1+`); Total Bases `2+/3+/4+` (default `2+`).
- **Total Bases uses accurate at-bat math** (convolution), not Poisson — a HR contributes 4 bases in one PA.
- **League per-PA component rates (regressed toward, R in PA):** single `0.138` R=200, double `0.045` R=200, triple `0.005` R=200, HR `0.033` R=300 (reuse `LEAGUE_HR_RATE`).
- **v1 simplification:** park/weather apply to the HR component only; 1B/2B/3B are park/weather-neutral.
- **History mode:** per-component counts use the 5/4/3 blended totals (existing `model/blend.py`); current mode uses single-season counts. Both props get `_hist` twins via `build_board_with_history`.
- **Per task:** TDD; then independent **spec-review + adversarial-review** subagents must BOTH pass before the next task; ❌/Critical/Important → fix → re-run both. Final whole-branch review before merge.
- Branch: `tier1-threshold-props` off `main`.

---

### Task 1: Pure count combiner (`model/counts.py`)

**Files:**
- Create: `model/counts.py`
- Test: `tests/test_counts.py`

**Interfaces:**
- Produces: `count_distribution(outcome_probs: list[float], expected_pa: float) -> list[float]` (distribution over the game total, index = total units); `count_ge_prob(outcome_probs: list[float], expected_pa: float, n: int) -> float` (= sum of the distribution at index ≥ n).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_counts.py
import math
from model.counts import count_ge_prob, count_distribution

def test_single_certain_pa_one_unit():
    # 1 PA, always 1 unit -> P(>=1)=1, P(>=2)=0
    assert math.isclose(count_ge_prob([0.0, 1.0], 1.0, 1), 1.0)
    assert math.isclose(count_ge_prob([0.0, 1.0], 1.0, 2), 0.0)

def test_two_pa_hit_prob_geq1_matches_complement():
    # p_hit=0.3 over exactly 2 PAs: P(>=1) = 1-(0.7^2)
    assert math.isclose(count_ge_prob([0.7, 0.3], 2.0, 1), 1 - 0.7**2)
    # P(>=2) = 0.3^2
    assert math.isclose(count_ge_prob([0.7, 0.3], 2.0, 2), 0.3**2)

def test_homer_is_four_bases_in_one_pa():
    # one PA that is always a HR (4 bases) clears the 4+ line outright
    assert math.isclose(count_ge_prob([0,0,0,0,1.0], 1.0, 4), 1.0)
    assert math.isclose(count_ge_prob([0,0,0,0,1.0], 1.0, 2), 1.0)

def test_fractional_pa():
    # 1.5 PAs of always-1-unit: dist = 1 full PA (1 unit) + 0.5 chance of another
    # totals: 1 w.p. 0.5, 2 w.p. 0.5  -> P(>=2)=0.5, P(>=1)=1.0
    assert math.isclose(count_ge_prob([0.0, 1.0], 1.5, 2), 0.5)
    assert math.isclose(count_ge_prob([0.0, 1.0], 1.5, 1), 1.0)

def test_distribution_sums_to_one():
    d = count_distribution([0.5, 0.3, 0.2], 3.2)
    assert math.isclose(sum(d), 1.0, abs_tol=1e-9)
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_counts.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'model.counts'`)

- [ ] **Step 3: Implement**

```python
# model/counts.py
"""Pure per-at-bat -> whole-game count math for threshold props (Hits, Total Bases).

Convolve a per-PA outcome distribution over the batter's expected plate
appearances (fractional supported) to get P(game total >= N). See
docs/superpowers/specs/2026-06-18-tier1-threshold-props-design.md.
"""


def _convolve(a: list[float], b: list[float]) -> list[float]:
    out = [0.0] * (len(a) + len(b) - 1)
    for i, ai in enumerate(a):
        if ai == 0.0:
            continue
        for j, bj in enumerate(b):
            out[i + j] += ai * bj
    return out


def count_distribution(outcome_probs: list[float], expected_pa: float) -> list[float]:
    """Distribution over the game total (index = total units) from `expected_pa`
    independent PAs, each drawn from `outcome_probs` (index = units that PA).

    Fractional PAs: floor(expected_pa) guaranteed PAs plus one PA that occurs
    with probability frac (else contributes 0 units).
    """
    if expected_pa <= 0:
        return [1.0]
    full = int(expected_pa)
    frac = expected_pa - full
    dist = [1.0]  # start: total 0 with certainty
    for _ in range(full):
        dist = _convolve(dist, outcome_probs)
    if frac > 0:
        # a PA that happens w.p. frac: blend "no PA" ([1.0]) with the outcome vector
        partial = [(1 - frac) + frac * outcome_probs[0]] + [frac * p for p in outcome_probs[1:]]
        dist = _convolve(dist, partial)
    return dist


def count_ge_prob(outcome_probs: list[float], expected_pa: float, n: int) -> float:
    """P(game total >= n)."""
    if n <= 0:
        return 1.0
    dist = count_distribution(outcome_probs, expected_pa)
    return sum(dist[n:]) if n < len(dist) else 0.0
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/python -m pytest tests/test_counts.py -v` → all pass.

- [ ] **Step 5: Commit**

```bash
git add model/counts.py tests/test_counts.py
git commit -m "feat: pure per-at-bat count combiner (count_ge_prob)"
```

---

### Task 2: Per-PA HR rate helper (`model/projections.py`) — refactor, output-preserving

**Files:**
- Modify: `model/projections.py` (extract the per-PA HR rate so Total Bases can reuse the exact same number; `hr_probability` output must stay identical)
- Test: `tests/test_projections.py` (add a guard test)

**Interfaces:**
- Produces: `hr_rate_per_pa(season_hr, season_pa, *, recent_form_mult=1.0, matchup_mult=1.0, park_mult=1.0, weather_mult=1.0, pitcher_mult=1.0, bvp_mult=1.0, league_hr_rate=LEAGUE_HR_RATE, regression_pa=300.0) -> float` — the clamped per-PA HR probability (the `rate` inside the current `hr_probability`). `hr_probability(...)` now returns `1 - (1 - hr_rate_per_pa(...))**expected_pa` and is unchanged in output.

- [ ] **Step 1: Write the guard + new-function tests**

```python
# add to tests/test_projections.py
from model.projections import hr_probability, hr_rate_per_pa

def test_hr_rate_per_pa_matches_internal_rate():
    # base = (10 + 0.033*300)/(300+300) = 19.9/600
    r = hr_rate_per_pa(10, 300)
    assert abs(r - (10 + 0.033*300)/600) < 1e-9

def test_hr_probability_unchanged_decomposition():
    # hr_probability == 1-(1-rate)^pa with the same per-PA rate
    r = hr_rate_per_pa(20, 400, park_mult=1.1, weather_mult=1.05)
    assert abs(hr_probability(20, 400, park_mult=1.1, weather_mult=1.05, expected_pa=4.2)
               - (1 - (1 - r) ** 4.2)) < 1e-12
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_projections.py -k "hr_rate_per_pa or unchanged" -v`
Expected: FAIL (`cannot import name 'hr_rate_per_pa'`)

- [ ] **Step 3: Implement** — in `model/projections.py`, add `hr_rate_per_pa` and refactor `hr_probability` to call it (identical output):

```python
def hr_rate_per_pa(
    season_hr: float, season_pa: float, *,
    recent_form_mult: float = 1.0, matchup_mult: float = 1.0,
    park_mult: float = 1.0, weather_mult: float = 1.0,
    pitcher_mult: float = 1.0, bvp_mult: float = 1.0,
    league_hr_rate: float = LEAGUE_HR_RATE, regression_pa: float = 300.0,
) -> float:
    """Clamped per-PA HR probability after regression + multiplicative adjustments."""
    if season_pa <= 0:
        return 0.0
    base = (season_hr + league_hr_rate * regression_pa) / (season_pa + regression_pa)
    rate = base * recent_form_mult * matchup_mult * park_mult * weather_mult * pitcher_mult * bvp_mult
    return max(0.0, min(rate, 1.0))
```

Then change `hr_probability`'s body so its `rate` line becomes a call (keep the signature and the final return EXACTLY):

```python
def hr_probability(season_hr, season_pa, *, recent_form_mult=1.0, matchup_mult=1.0,
                   park_mult=1.0, weather_mult=1.0, pitcher_mult=1.0, bvp_mult=1.0,
                   expected_pa=4.0, league_hr_rate=LEAGUE_HR_RATE, regression_pa=300.0):
    if season_pa <= 0:
        return 0.0
    rate = hr_rate_per_pa(season_hr, season_pa, recent_form_mult=recent_form_mult,
                          matchup_mult=matchup_mult, park_mult=park_mult, weather_mult=weather_mult,
                          pitcher_mult=pitcher_mult, bvp_mult=bvp_mult,
                          league_hr_rate=league_hr_rate, regression_pa=regression_pa)
    return 1 - (1 - rate) ** expected_pa
```

(Delete the second bad assertion line in the test — keep only `test_hr_rate_per_pa_matches_internal_rate` and a clean `test_hr_probability_unchanged_decomposition` that recomputes `r = hr_rate_per_pa(20,400,park_mult=1.1,weather_mult=1.05)` then asserts equality.)

- [ ] **Step 4: Run** the full existing projections suite to prove `hr_probability` output is unchanged.

Run: `.venv/bin/python -m pytest tests/test_projections.py -v` → all pass (existing HR tests unchanged + new ones).

- [ ] **Step 5: Commit**

```bash
git add model/projections.py tests/test_projections.py
git commit -m "refactor: extract hr_rate_per_pa (output-preserving) for Total Bases reuse"
```

---

### Task 3: Per-PA component rates in profiles (`model/profiles.py`)

**Files:**
- Modify: `model/profiles.py` (add single/double/triple counts to batter profile + blended profile; existing fns + HR unchanged)
- Test: `tests/test_profile_components.py`

**Interfaces:**
- Produces: `batter_profile_from_events` now also returns `season_1b`, `season_2b`, `season_3b` (counts, strictly-before `as_of`, alongside the existing `season_hr`/`season_pa`). `blended_batter_profile` returns the 5/4/3-blended `season_1b/2b/3b` (normalized like `season_hr`), reusing `model.blend`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_profile_components.py
from model.profiles import batter_profile_from_events

def _ev(d, e): return {"game_date": d, "events": e, "launch_speed": 90.0}

def test_profile_counts_singles_doubles_triples():
    evs = [_ev("2026-04-01","single"), _ev("2026-04-01","double"), _ev("2026-04-01","triple"),
           _ev("2026-04-01","home_run"), _ev("2026-04-01","strikeout"), _ev("2026-04-01","field_out")]
    p = batter_profile_from_events(evs, as_of="2026-06-01", player_id=1, name="X", bats="R")
    assert p["season_pa"] == 6
    assert p["season_1b"] == 1 and p["season_2b"] == 1 and p["season_3b"] == 1
    assert p["season_hr"] == 1
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_profile_components.py -v`
Expected: FAIL (`KeyError: 'season_1b'`)

- [ ] **Step 3: Implement** — in `batter_profile_from_events`, after the existing `hr = ...` count, add (the per-event constants `_HIT_EVENTS` already exist):

```python
    s1 = sum(1 for e in pa_rows if e["events"] == "single")
    s2 = sum(1 for e in pa_rows if e["events"] == "double")
    s3 = sum(1 for e in pa_rows if e["events"] == "triple")
```

and add to the returned dict: `"season_1b": s1, "season_2b": s2, "season_3b": s3,`.

In `blended_batter_profile`, after the existing HR blend, blend the three components the same way (`_count_batter` already returns pa; extend it to also return 1b/2b/3b, or add a small `_count_components`). Add:

```python
    s1_made, _ = marcel_blend([(_c1(evs, as_of), _cpa(evs, as_of)) for evs in seasons])  # see note
```

Implementation note for the executor: extend the existing private `_count_batter(events, as_of)` to return `(pa, hr, ks, hits, s1, s2, s3)` and update its two call sites; then `blended_batter_profile` blends `(s1, pa)`, `(s2, pa)`, `(s3, pa)` via `marcel_blend` (same `eff_pa`) and sets `prof["season_1b"/"2b"/"3b"]` to the blended counts. Keep `season_hr`/`season_pa`/`k_rate`/`hit_rate` exactly as they are now.

- [ ] **Step 4: Run**

Run: `.venv/bin/python -m pytest tests/test_profile_components.py tests/test_blended_profiles.py tests/test_export_web.py -v` → pass (existing profile tests still green).

- [ ] **Step 5: Commit**

```bash
git add model/profiles.py tests/test_profile_components.py
git commit -m "feat: per-PA single/double/triple counts in batter profiles (current + blended)"
```

---

### Task 4: Outcome-vector builder + pipeline rows (`model/pipeline.py`)

**Files:**
- Modify: `model/pipeline.py` (add `_batter_outcome_vector(...)`, `build_hits_rows(...)`, `build_total_bases_rows(...)`)
- Test: `tests/test_threshold_pipeline.py`

**Interfaces:**
- Consumes: `model.counts.count_ge_prob`; `model.projections.hr_rate_per_pa`, `expected_pa_for_slot`; `model.projections.regress`-style regression for 1B/2B/3B (use `model.blend.regress`); existing `hr_platoon_mult`, `pitcher_hr_mult`, `bvp_hr_mult`, `matchup`, `hr_park_factor`, weather helpers.
- Produces:
  - `build_hits_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None) -> list[dict]` — rows with `prop:"HITS"`, `player`, `player_id`, `team`, `matchup`, `game_id`, `game_time`, `bats`, `vs`, wind/temp, `lineup_status`, and `p_ge1`, `p_ge2`, `p_ge3`.
  - `build_total_bases_rows(...)` — same shape with `prop:"TB"`, `p_ge2`, `p_ge3`, `p_ge4`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_threshold_pipeline.py
from model.pipeline import build_hits_rows, build_total_bases_rows

def _bat(pid, pa, s1, s2, s3, hr):
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "season_pa": pa, "season_1b": s1, "season_2b": s2, "season_3b": s3,
            "season_hr": hr, "recent_form_mult": 1.0, "k_rate": 0.22, "hit_rate": (s1+s2+s3+hr)/pa}

def _pit(pid):
    return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R",
            "k_per_bf": 0.22, "expected_bf": 24, "opponent_k_mult": 1.0, "k_line": 5.5,
            "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}

def _slate():
    return [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
             "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]

def _w(g): return {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}

def test_hits_rows_thresholds_monotonic():
    lf = lambda g: {"home": [_bat(1, 400, 90, 25, 3, 20)], "away": [_bat(2, 400, 90, 25, 3, 20)]}
    pf = lambda pid: _pit(pid)
    rows = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    assert r["prop"] == "HITS"
    assert 0 <= r["p_ge3"] <= r["p_ge2"] <= r["p_ge1"] <= 1  # monotonic

def test_total_bases_rows_present_and_monotonic():
    lf = lambda g: {"home": [_bat(1, 400, 90, 25, 3, 20)], "away": [_bat(2, 400, 90, 25, 3, 20)]}
    pf = lambda pid: _pit(pid)
    rows = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    assert r["prop"] == "TB"
    assert 0 <= r["p_ge4"] <= r["p_ge3"] <= r["p_ge2"] <= 1
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_threshold_pipeline.py -v`
Expected: FAIL (`cannot import name 'build_hits_rows'`)

- [ ] **Step 3: Implement** — add to `model/pipeline.py`:

```python
from model.counts import count_ge_prob
from model.projections import hr_rate_per_pa, expected_pa_for_slot
from model.blend import regress

_LG_1B, _LG_2B, _LG_3B = 0.138, 0.045, 0.005
_COMP_R = 200.0


def _batter_outcome_vector(b, opp, eff_park, weather_mult, slot, bvp):
    """Per-PA [p0,p1,p2,p3,p4] (0..4 bases). HR reuses the adjusted HR rate;
    1B/2B/3B are regressed + matchup/platoon/recent-form (park/weather HR-only, v1)."""
    pa = b.get("season_pa", 0)
    # matchup hit factor (platoon/log5) applied to non-HR hit components
    if opp:
        m = matchup(b_k=b.get("k_rate", 0.22), b_hit=b.get("hit_rate", 0.22),
                    p_k=opp.get("k_per_bf", 0.22), p_hit=opp.get("hit_allowed_rate", 0.22),
                    bats=b.get("bats", "R"), throws=opp.get("throws", "R"))
        hit_factor = (m["hit_prob"] / b["hit_rate"]) if b.get("hit_rate") else 1.0
        platoon = hr_platoon_mult(b.get("bats", "R"), opp.get("throws", "R"))
        p_mult = pitcher_hr_mult(opp.get("hr_allowed_rate", 0.033), opp.get("bf", 0))
        b_mult = bvp_hr_mult(bvp["hr"], bvp["pa"]) if bvp else 1.0
    else:
        hit_factor = platoon = p_mult = b_mult = 1.0
    form = b.get("recent_form_mult", 1.0)
    p1 = regress(b.get("season_1b", 0), pa, _LG_1B, _COMP_R) * hit_factor * form
    p2 = regress(b.get("season_2b", 0), pa, _LG_2B, _COMP_R) * hit_factor * form
    p3 = regress(b.get("season_3b", 0), pa, _LG_3B, _COMP_R) * hit_factor * form
    p4 = hr_rate_per_pa(b.get("season_hr", 0), pa, recent_form_mult=form, matchup_mult=platoon,
                        park_mult=eff_park, weather_mult=weather_mult, pitcher_mult=p_mult, bvp_mult=b_mult)
    p1, p2, p3, p4 = (max(0.0, x) for x in (p1, p2, p3, p4))
    total = p1 + p2 + p3 + p4
    if total > 1.0:  # keep a valid distribution
        p1, p2, p3, p4 = (x / total for x in (p1, p2, p3, p4))
        total = 1.0
    return [1 - total, p1, p2, p3, p4]


def _threshold_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn, *, prop, thresholds, units):
    rows = []
    for game in slate:
        if game.get("started"):
            continue
        w = _game_weather(game, weather_fn)
        weather_mult = weather_hr_multiplier(w["wind_out_mph"], w["temp_f"], w["park"]["dome"])
        park_mult = hr_park_factor(game["park_team"])
        lineups = lineups_fn(game)
        home_p = pitcher_fn(game["home_pitcher_id"]) if game.get("home_pitcher_id") else None
        away_p = pitcher_fn(game["away_pitcher_id"]) if game.get("away_pitcher_id") else None
        from math import sqrt
        for side, opp in (("home", away_p), ("away", home_p)):
            team = game.get(side, "?")
            eff_park = park_mult / sqrt(hr_park_factor(team))
            for slot, b in enumerate(lineups.get(side, [])):
                bvp = bvp_fn(b.get("player_id"), opp.get("player_id")) if (bvp_fn and opp) else None
                vec = _batter_outcome_vector(b, opp, eff_park, weather_mult, slot, bvp)
                outcomes = [vec[0], vec[1] + vec[2] + vec[3] + vec[4]] if units == "hits" else vec
                epa = expected_pa_for_slot(slot)
                row = {
                    "prop": prop, "game_id": game["game_id"], "game_time": game.get("game_time"),
                    "player_id": b.get("player_id"), "player": b["name"], "team": team,
                    "matchup": f'{game.get("away","?")} @ {game.get("home","?")}',
                    "bats": b.get("bats", "R"),
                    "vs": {"name": opp["name"], "player_id": opp.get("player_id"), "throws": opp.get("throws", "R")} if opp else None,
                    "wind_out_mph": w["wind_out_mph"], "wind_mph": w["wind_mph"], "wind_dir": w["wind_dir"],
                    "temp_f": w["temp_f"], "precip_pct": w["precip_pct"],
                }
                for label, nthresh in thresholds:
                    row[label] = count_ge_prob(outcomes, epa, nthresh)
                rows.append(row)
    rows.sort(key=lambda r: r[thresholds[0][0]], reverse=True)
    return rows


def build_hits_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None):
    return _threshold_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn,
                           prop="HITS", thresholds=[("p_ge1", 1), ("p_ge2", 2), ("p_ge3", 3)], units="hits")


def build_total_bases_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None):
    return _threshold_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn,
                           prop="TB", thresholds=[("p_ge2", 2), ("p_ge3", 3), ("p_ge4", 4)], units="bases")
```

(The executor should confirm `matchup`, `hr_platoon_mult`, `pitcher_hr_mult`, `bvp_hr_mult`, `hr_park_factor`, `weather_hr_multiplier`, `_game_weather` are already imported/defined in pipeline.py — they are, from `build_hr_rows`.)

- [ ] **Step 4: Run**

Run: `.venv/bin/python -m pytest tests/test_threshold_pipeline.py tests/test_pipeline.py -v` → pass (existing pipeline tests unchanged).

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_threshold_pipeline.py
git commit -m "feat: Hits + Total Bases pipeline rows (per-at-bat outcome vector + thresholds)"
```

---

### Task 5: Wire both props into the board (`model/export_web.py`)

**Files:**
- Modify: `model/export_web.py` (`build_board_with_history` extends to hits/TB with `_hist` twins; `main` payload adds `hits`/`total_bases`)
- Modify: `model/daily.py` (`refresh_today` carries `hits`/`total_bases` through the freeze-merge + payload)
- Test: `tests/test_threshold_board.py`

**Interfaces:**
- Consumes: `build_hits_rows`, `build_total_bases_rows`; existing `make_profile_fns` 4-tuple.
- Produces: `build_board_with_history` returns `(hr, ks, hits, tb)`; each hits/TB row gains `_hist` twins for its `p_geN` fields. Payload + freeze-merge include `hits` and `total_bases`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_threshold_board.py
from model.export_web import build_board_with_history

def _bat(pid, pa, hr): return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
    "season_pa": pa, "season_1b": 90, "season_2b": 25, "season_3b": 3, "season_hr": hr,
    "recent_form_mult": 1.0, "k_rate": 0.22, "hit_rate": (90+25+3+hr)/pa}
def _pit(pid): return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R",
    "k_per_bf": 0.22, "expected_bf": 24, "opponent_k_mult": 1.0, "k_line": 5.5,
    "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}

def test_board_includes_hits_tb_with_hist():
    slate = [{"game_id":1,"home":"AAA","away":"BBB","park_team":"AAA","home_pitcher_id":100,"away_pitcher_id":200,"started":False}]
    cur_l = lambda g: {"home":[_bat(1,400,20)],"away":[_bat(2,400,20)]}
    hist_l = lambda g: {"home":[_bat(1,400,35)],"away":[_bat(2,400,35)]}  # different HR base
    w = lambda g: {"wind_speed_mph":0,"wind_from_deg":0,"temp_f":70,"precip_pct":0}
    hr, ks, hits, tb = build_board_with_history(slate, cur_l, lambda p:_pit(p), hist_l, lambda p:_pit(p), w, None)
    assert hits and "p_ge1_hist" in hits[0] and tb and "p_ge2_hist" in tb[0]
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_threshold_board.py -v`
Expected: FAIL (`build_board_with_history` returns 2 values / no hits twins).

- [ ] **Step 3: Implement** — in `build_board_with_history`: also build `hits`/`tb` current + history, attach `_hist` twins by `(player_id, game_id)` (same `_key` helper + None-skip as the HR/K merge), copying each `p_geN` → `p_geN_hist`. Return `(hr, ks, hits, tb)`. Update `export_web.main` to unpack 4 and add `"hits": hits, "total_bases": tb` to the payload. Update `daily.refresh_today` to unpack 4, freeze-merge `hits`/`total_bases` like `hr`/`strikeouts` (sorted by `p_ge1`/`p_ge2` desc), and add them to its payload + `started_ids` carry-over. Update any existing test that unpacks `build_board_with_history` into 2.

- [ ] **Step 4: Run**

Run: `.venv/bin/python -m pytest tests/test_threshold_board.py tests/test_history_merge.py tests/test_daily.py tests/test_export_web.py -v` → pass. Then full suite `.venv/bin/python -m pytest -q`.

- [ ] **Step 5: Commit**

```bash
git add model/export_web.py model/daily.py tests/test_threshold_board.py
git commit -m "feat: hits + total_bases on the board (current + history twins, freeze-merge)"
```

---

### Task 6: Frontend types + prop pills + threshold selector (`web/`)

**Files:**
- Modify: `web/lib/types.ts` (add `HitsRow`, `TbRow`, `hits?`, `total_bases?` on `Projections`)
- Modify: `web/app/page.tsx` (two new prop pills, the threshold selector, source-aware mapping)
- Test: `web/node_modules/.bin/tsc --noEmit` (type gate)

**Interfaces:**
- Consumes: payload `hits[]`/`total_bases[]` with `p_geN`(+`_hist`). Produces: `prop` state extended to `"hr"|"k"|"hits"|"tb"`; a `threshold` state per prop; `hitsRows`/`tbRows` mapped to `BoardRow` with `prob` = the selected `p_geN` (source-aware `_hist`), reusing all downstream views.

- [ ] **Step 1** Add types to `web/lib/types.ts`:

```ts
export type HitsRow = { player: string; team: string; matchup?: string; game_time?: string;
  player_id?: number; game_id?: number; bats?: string; vs?: Matchup; lineup_status?: string;
  wind_out_mph?: number; wind_mph?: number; wind_dir?: number; temp_f?: number; precip_pct?: number;
  p_ge1: number; p_ge2: number; p_ge3: number;
  p_ge1_hist?: number; p_ge2_hist?: number; p_ge3_hist?: number; };
export type TbRow = Omit<HitsRow, "p_ge1"|"p_ge2"|"p_ge3"|"p_ge1_hist"|"p_ge2_hist"|"p_ge3_hist"> & {
  p_ge2: number; p_ge3: number; p_ge4: number;
  p_ge2_hist?: number; p_ge3_hist?: number; p_ge4_hist?: number; };
```
and add `hits?: HitsRow[]; total_bases?: TbRow[];` to `Projections`.

- [ ] **Step 2** In `web/app/page.tsx`: extend `prop` to `"hr"|"k"|"hits"|"tb"`; add a `threshold` state (default `{hits:1, tb:2}`); add `Hits` + `Total Bases` to the prop pill row; render a small threshold pill group when prop is hits/tb (Hits 1/2/3, TB 2/3/4); build `hitsRows`/`tbRows` mapping the selected `p_ge{threshold}` (source-aware: `_hist` when `source==="hist"`, `?? current`) into `BoardRow.prob`, with `detail` like `${threshold}+ hits` / `${threshold}+ bases`, `href` to the player page, hand/opponent/vs/wind reused. Route the active prop's rows into the existing `<PropBoard>` (and include in Top Plays in Task 7).

- [ ] **Step 3** Typecheck: `cd web && node_modules/.bin/tsc --noEmit` → exit 0.

- [ ] **Step 4** Manual: dev server, pick Hits/Total Bases, flip thresholds + history — numbers change and re-sort.

- [ ] **Step 5: Commit**

```bash
git add web/lib/types.ts web/app/page.tsx
git commit -m "feat: Hits + Total Bases prop pills + threshold selector (source-aware)"
```

---

### Task 7: Top Plays sections + player pages for Hits/TB

**Files:**
- Modify: `web/components/TopPlays.tsx` (add `Top Hits` + `Top Total Bases` sections from the mapped rows)
- Modify: `web/app/player/[prop]/[id]/page.tsx` (Hits/TB detail: per-threshold probabilities + factor breakdown, source-aware via existing `pick`)
- Modify: `web/app/page.tsx` (pass hitsRows/tbRows into TopPlays; player links carry prop+threshold+source)
- Test: `web/node_modules/.bin/tsc --noEmit`

- [ ] **Step 1** TopPlays: accept `hitsRows`/`tbRows` props and render two more `LeaderSection`s (reuse the existing collapsible section + count selector); rank by the row `prob` (already the selected threshold).
- [ ] **Step 2** Player page: handle `prop === "hits"` and `prop === "tb"` — show the three threshold probabilities (`pick`-wrapped for history) and the same factor panel pattern (park/weather/matchup) used by HR; reuse `Back`/nav with `navQ`.
- [ ] **Step 3** page.tsx: pass the new rows to `<TopPlays>`; ensure player `href`s include `?prop=hits|tb` + threshold + source so the detail page matches.
- [ ] **Step 4** Typecheck → exit 0; dev-server sanity on Top Plays + a Hits/TB player page.
- [ ] **Step 5: Commit**

```bash
git add web/components/TopPlays.tsx "web/app/player/[prop]/[id]/page.tsx" web/app/page.tsx
git commit -m "feat: Top Plays + player pages for Hits + Total Bases"
```

---

### Task 8: Full-suite gate + local preview

- [ ] **Step 1** `.venv/bin/python -m pytest -q` → all pass (existing + new).
- [ ] **Step 2** `cd web && node_modules/.bin/tsc --noEmit` → exit 0.
- [ ] **Step 3** Regenerate today's board: `.venv/bin/python -m model.export_web $(TZ=America/New_York date +%F) --include-started`; verify the JSON has `hits[]` and `total_bases[]` with `p_geN` + `_hist`, and probabilities are monotonic (P≥1 ≥ P≥2 ≥ P≥3).
- [ ] **Step 4** Dev preview: Hits & Total Bases pills, threshold selector, history toggle, Top Plays sections, a player page; confirm HR + Strikeouts look identical to before. **STOP at the preview gate for user approval before deploy.**

---

## Notes for the executor
- **HR/K untouched:** any change to their output is a regression — investigate (the `hr_probability` refactor in Task 2 must be output-identical; its existing tests are the guard).
- **Math sign-off done** (spec). Don't change the league constants / R values without re-confirming.
- **Deploy** is the user's call at the Task 8 preview gate; after merge, force-deploy — and note the first run recomputes the board (no extra prior-season pull needed; history caches are already warm).
