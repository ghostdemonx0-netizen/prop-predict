# Approach C — Lineup Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bounded lineup-context multiplier to the Runs/RBI/HRR projections so a batter's Runs/RBI shift with the quality of the hitters around him in tonight's order.

**Architecture:** Pure math (slot tables + tailored teammate quality + confidence-weighted trust dial + cap) lives in `model/run_props.py`; `model/pipeline.py` `_run_prop_rows` computes the multiplier from the ordered lineup and feeds it into the existing Poisson mean; `build_board_with_history` carries the new factor onto the history twins; `model/archive.py` captures it for grading.

**Tech Stack:** Python 3.12, pytest. No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-28-approach-c-lineup-context-design.md`. This is a **model-math change** — constants already signed off in the spec; do not invent new ones.
- TDD: write the failing test first, watch it fail, implement minimally, watch it pass, commit.
- Cap is on the **expected-count multiplier** (Poisson mean), clamped to `[0.85, 1.15]`.
- Lineup multiplier applies to Runs/RBI at full strength; HRR gets a dampened `0.55` share.
- Each weighting twin (current/history) computes its lineup multiplier from its own profiles — this realizes spec §7 ("applies to all twins, not neutralized like recent form"); the order + status are identical across twins, only teammate rates differ.
- All new constants are seed values, tunable later from grader data.
- Run from repo root with `uv run pytest` (matches existing test invocation).

---

### Task 1: Lineup-context constants + slot / trust / SLG helpers

**Files:**
- Modify: `model/run_props.py` (add constants + helpers after existing constants block)
- Test: `tests/test_run_props.py` (create if absent)

**Interfaces:**
- Produces:
  - `SLOT_RUNS: dict[int,float]`, `SLOT_RBI: dict[int,float]` (keys 1..9)
  - `TRUST_CONFIRMED=0.80`, `TRUST_PROJECTED=0.35`, `LINEUP_CAP_LO=0.85`, `LINEUP_CAP_HI=1.15`, `HRR_LINEUP_SHARE=0.55`, `TEAMMATE_SENSITIVITY=0.50`, `N_NEIGHBORS=2`, `LEAGUE_ONBASE=0.220`, `LEAGUE_SLG=0.360`
  - `slot_factor(pos:int, prop:str) -> float`
  - `slg_per_pa(s1b:float, s2b:float, s3b:float, hr:float, pa:float) -> float`
  - `trust_weight(lineup_status:str) -> float`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_run_props.py
from model import run_props as rp

def test_slot_factor_runs_peaks_top_rbi_peaks_middle():
    assert rp.slot_factor(1, "RUNS") > rp.slot_factor(9, "RUNS")   # leadoff scores more
    assert rp.slot_factor(4, "RBI") > rp.slot_factor(1, "RBI")     # cleanup drives in more
    assert rp.slot_factor(1, "RUNS") == 1.15
    assert rp.slot_factor(4, "RBI") == 1.18

def test_slot_factor_clamps_out_of_range_position():
    assert rp.slot_factor(0, "RUNS") == rp.slot_factor(1, "RUNS")
    assert rp.slot_factor(12, "RBI") == rp.slot_factor(9, "RBI")

def test_slg_per_pa_total_bases_over_pa():
    # 5 singles, 2 doubles, 1 triple, 2 HR over 40 PA = (5 + 4 + 3 + 8)/40 = 0.5
    assert rp.slg_per_pa(5, 2, 1, 2, 40) == 0.5
    assert rp.slg_per_pa(1, 0, 0, 0, 0) == 0.0   # no PA -> 0

def test_trust_weight_confirmed_vs_projected():
    assert rp.trust_weight("confirmed") == 0.80
    assert rp.trust_weight("projected") == 0.35
    assert rp.trust_weight("anything_else") == 0.35   # default to cautious
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_run_props.py -k "slot_factor or slg_per_pa or trust_weight" -v`
Expected: FAIL with `AttributeError: module 'model.run_props' has no attribute 'slot_factor'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/run_props.py  — add after the existing constants (after REG_GAMES / PROD_SHRINK_GAMES block)

# --- Approach C: lineup-context constants (seed values; tunable from grader data) ---
SLOT_RUNS = {1: 1.15, 2: 1.10, 3: 1.05, 4: 1.00, 5: 0.97, 6: 0.94, 7: 0.91, 8: 0.88, 9: 0.90}
SLOT_RBI  = {1: 0.85, 2: 0.93, 3: 1.10, 4: 1.18, 5: 1.08, 6: 1.00, 7: 0.93, 8: 0.88, 9: 0.85}
TRUST_CONFIRMED = 0.80
TRUST_PROJECTED = 0.35
LINEUP_CAP_LO = 0.85
LINEUP_CAP_HI = 1.15
HRR_LINEUP_SHARE = 0.55
TEAMMATE_SENSITIVITY = 0.50
N_NEIGHBORS = 2
LEAGUE_ONBASE = 0.220   # hit_rate (hits/PA) league proxy for on-base ability
LEAGUE_SLG = 0.360      # total-bases-per-PA league proxy for power


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(x, hi))


def slot_factor(pos: int, prop: str) -> float:
    """Generic per-position multiplier. prop in {'RUNS','RBI'}."""
    p = max(1, min(int(pos), 9))
    table = SLOT_RUNS if prop == "RUNS" else SLOT_RBI
    return table[p]


def slg_per_pa(s1b: float, s2b: float, s3b: float, hr: float, pa: float) -> float:
    """Total bases per plate appearance (power proxy). 0 when pa <= 0."""
    if pa <= 0:
        return 0.0
    return (s1b + 2 * s2b + 3 * s3b + 4 * hr) / pa


def trust_weight(lineup_status: str) -> float:
    """Weight on the real-teammate read; lean cautious (slot) unless confirmed."""
    return TRUST_CONFIRMED if lineup_status == "confirmed" else TRUST_PROJECTED
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_run_props.py -k "slot_factor or slg_per_pa or trust_weight" -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add model/run_props.py tests/test_run_props.py
git commit -m "feat(approach-c): lineup-context constants + slot/slg/trust helpers"
```

---

### Task 2: Teammate quality, neighbor selection, blend + HRR damping

**Files:**
- Modify: `model/run_props.py`
- Test: `tests/test_run_props.py`

**Interfaces:**
- Consumes (Task 1): `TEAMMATE_SENSITIVITY`, `N_NEIGHBORS`, `LINEUP_CAP_LO/HI`, `HRR_LINEUP_SHARE`, `trust_weight`, `_clamp`
- Produces:
  - `teammate_factor(neighbor_avg:float|None, league_avg:float, *, sensitivity=TEAMMATE_SENSITIVITY) -> float`
  - `neighbor_avg(values_in_order:list[float], idx:int, *, behind:bool, n=N_NEIGHBORS) -> float|None`
  - `lineup_mult(slot:float, teammate:float, lineup_status:str) -> float`
  - `hrr_lineup_mult(runs_mult:float, rbi_mult:float) -> float`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_run_props.py  (append)

def test_teammate_factor_centers_at_one():
    # neighbors exactly league-average -> no nudge
    assert rp.teammate_factor(0.360, 0.360) == 1.0
    # 20% above average, sensitivity 0.5 -> 1 + 0.5*0.2 = 1.10
    assert abs(rp.teammate_factor(0.432, 0.360) - 1.10) < 1e-9
    # missing neighbors -> neutral
    assert rp.teammate_factor(None, 0.360) == 1.0

def test_neighbor_avg_circular_behind_and_ahead():
    vals = [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]  # 9-man order
    # behind idx 0 (leadoff): next two = idx1,idx2 = (1+2)/2 = 1.5
    assert rp.neighbor_avg(vals, 0, behind=True) == 1.5
    # ahead of idx 0 wraps to idx8, idx7 = (8+7)/2 = 7.5
    assert rp.neighbor_avg(vals, 0, behind=False) == 7.5
    # behind idx 8 (9-hole) wraps to idx0, idx1 = (0+1)/2 = 0.5
    assert rp.neighbor_avg(vals, 8, behind=True) == 0.5

def test_neighbor_avg_skips_self_and_handles_short_lists():
    assert rp.neighbor_avg([5.0], 0, behind=True) is None      # no neighbors
    assert rp.neighbor_avg([], 0, behind=True) is None

def test_lineup_mult_blend_and_cap():
    # confirmed: w=0.80 -> 0.2*1.08 + 0.8*1.14 = 1.128
    assert abs(rp.lineup_mult(1.08, 1.14, "confirmed") - 1.128) < 1e-9
    # projected: w=0.35 -> 0.65*1.08 + 0.35*1.14 = 1.101
    assert abs(rp.lineup_mult(1.08, 1.14, "projected") - 1.101) < 1e-9
    # cap: extreme teammate read clamps to 1.15
    assert rp.lineup_mult(1.20, 2.0, "confirmed") == 1.15
    assert rp.lineup_mult(0.5, 0.2, "confirmed") == 0.85

def test_hrr_lineup_mult_damped_and_capped():
    # runs 1.15, rbi 1.05 -> avg 1.10 -> 1 + 0.55*0.10 = 1.055
    assert abs(rp.hrr_lineup_mult(1.15, 1.05) - 1.055) < 1e-9
    # neutral inputs -> neutral
    assert rp.hrr_lineup_mult(1.0, 1.0) == 1.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_run_props.py -k "teammate or neighbor or lineup_mult or hrr_lineup" -v`
Expected: FAIL with `AttributeError: ... has no attribute 'teammate_factor'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/run_props.py  (append after Task 1 helpers)

def teammate_factor(neighbor_avg_val, league_avg: float, *, sensitivity: float = TEAMMATE_SENSITIVITY) -> float:
    """Multiplier (centered 1.0) from neighbor quality vs league, scaled by sensitivity."""
    if neighbor_avg_val is None or league_avg <= 0:
        return 1.0
    return 1 + sensitivity * (neighbor_avg_val / league_avg - 1)


def neighbor_avg(values_in_order: list, idx: int, *, behind: bool, n: int = N_NEIGHBORS):
    """Average of the up-to-n nearest neighbors in a circular batting order.

    behind=True -> hitters batting AFTER idx (drive the runner in -> Runs).
    behind=False -> hitters batting BEFORE idx (on base ahead -> RBI).
    Returns None when there are no neighbors.
    """
    length = len(values_in_order)
    picks = []
    step = 1
    while len(picks) < n and step < length:
        j = (idx + step) % length if behind else (idx - step) % length
        if j != idx:
            picks.append(values_in_order[j])
        step += 1
    if not picks:
        return None
    return sum(picks) / len(picks)


def lineup_mult(slot: float, teammate: float, lineup_status: str) -> float:
    """Confidence-weighted blend of slot baseline and teammate read, capped ±15%."""
    w = trust_weight(lineup_status)
    blended = (1 - w) * slot + w * teammate
    return _clamp(blended, LINEUP_CAP_LO, LINEUP_CAP_HI)


def hrr_lineup_mult(runs_mult: float, rbi_mult: float) -> float:
    """Dampened (0.55 share) lineup effect for HRR, since its hits portion is lineup-neutral."""
    avg = (runs_mult + rbi_mult) / 2
    damped = 1 + HRR_LINEUP_SHARE * (avg - 1)
    return _clamp(damped, LINEUP_CAP_LO, LINEUP_CAP_HI)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_run_props.py -k "teammate or neighbor or lineup_mult or hrr_lineup" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/run_props.py tests/test_run_props.py
git commit -m "feat(approach-c): teammate quality + neighbor selection + blend/HRR damping"
```

---

### Task 3: `expected_count` accepts a lineup multiplier

**Files:**
- Modify: `model/run_props.py:51-53` (`expected_count`)
- Test: `tests/test_run_props.py`

**Interfaces:**
- Produces: `expected_count(rate, *, pitcher_mult=1.0, platoon_mult=1.0, park_mult=1.0, form_mult=1.0, lineup_mult=1.0) -> float`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_run_props.py  (append)

def test_expected_count_applies_lineup_mult():
    base = rp.expected_count(0.50)
    assert base == 0.50
    boosted = rp.expected_count(0.50, lineup_mult=1.10)
    assert abs(boosted - 0.55) < 1e-9
    # default keeps old behavior
    assert rp.expected_count(0.50, pitcher_mult=1.2) == rp.expected_count(0.50, pitcher_mult=1.2, lineup_mult=1.0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_run_props.py -k expected_count_applies_lineup -v`
Expected: FAIL with `TypeError: expected_count() got an unexpected keyword argument 'lineup_mult'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/run_props.py  — replace expected_count
def expected_count(rate: float, *, pitcher_mult: float = 1.0, platoon_mult: float = 1.0,
                   park_mult: float = 1.0, form_mult: float = 1.0, lineup_mult: float = 1.0) -> float:
    """Poisson mean = regressed rate scaled by matchup/park/form/lineup multipliers (>= 0)."""
    return max(0.0, rate * pitcher_mult * platoon_mult * park_mult * form_mult * lineup_mult)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_run_props.py -k expected_count -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/run_props.py tests/test_run_props.py
git commit -m "feat(approach-c): expected_count accepts lineup_mult"
```

---

### Task 4: Wire lineup context into `_run_prop_rows`

**Files:**
- Modify: `model/pipeline.py:381-445` (`_run_prop_rows`)
- Test: `tests/test_pipeline.py` (create if absent)

**Interfaces:**
- Consumes (Tasks 1–3): `slg_per_pa`, `slot_factor`, `neighbor_avg`, `teammate_factor`, `lineup_mult`, `hrr_lineup_mult`, `LEAGUE_ONBASE`, `LEAGUE_SLG`, `expected_count(..., lineup_mult=...)`
- Produces: run/rbi/hrr rows now carry `lineup_mult` (and `lineup_slot`, `lineup_teammate` for RUNS/RBI), and their probabilities reflect the lineup nudge.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_pipeline.py
from model import pipeline

def _profile(pid, name, *, hit_rate=0.22, slg_components=(5,2,1,1,40), bats="R",
             games=80, total_r=40, status="confirmed"):
    s1b, s2b, s3b, hr, pa = slg_components
    return {
        "player_id": pid, "name": name, "bats": bats, "lineup_status": status,
        "hit_rate": hit_rate, "k_rate": 0.22,
        "season_1b": s1b, "season_2b": s2b, "season_3b": s3b, "season_hr": hr, "season_pa": pa,
        "games": games, "total_r": total_r, "total_rbi": 40, "total_hrr": 120,
        "recent_r": 0, "recent_rbi": 0, "recent_hrr": 0, "recent_games": 0,
        "recent_form_mult": 1.0,
    }

def _slate_one_game():
    return [{"game_id": 1, "home": "AAA", "away": "BBB", "home_id": 10, "away_id": 20,
             "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False,
             "home_lineup_status": "confirmed", "away_lineup_status": "confirmed"}]

def test_runs_row_boosted_when_strong_hitters_bat_behind():
    # leadoff hitter; everyone behind him is a masher (high SLG) -> runs nudge > 1
    mashers = [_profile(i, f"M{i}", slg_components=(10, 8, 2, 12, 40)) for i in range(2, 10)]
    leadoff = _profile(1, "Leadoff")
    lineup = [leadoff] + mashers
    def lineups_fn(game):
        return {"home": lineup, "away": lineup}
    def pitcher_fn(pid):
        return {"name": "P", "player_id": pid, "throws": "R", "hit_allowed_rate": 0.22, "k_per_bf": 0.22}
    rows = pipeline.build_runs_rows(_slate_one_game(), lineups_fn, pitcher_fn, lambda *a, **k: None)
    leadoff_row = next(r for r in rows if r["player_id"] == 1)
    assert leadoff_row["lineup_mult"] > 1.0
    assert "lineup_slot" in leadoff_row and "lineup_teammate" in leadoff_row

def test_hrr_lineup_effect_is_damped_vs_runs():
    mashers = [_profile(i, f"M{i}", slg_components=(10, 8, 2, 12, 40)) for i in range(2, 10)]
    lineup = [_profile(1, "Leadoff")] + mashers
    def lineups_fn(game):
        return {"home": lineup, "away": lineup}
    def pitcher_fn(pid):
        return {"name": "P", "player_id": pid, "throws": "R", "hit_allowed_rate": 0.22, "k_per_bf": 0.22}
    slate = _slate_one_game()
    runs_mult = next(r for r in pipeline.build_runs_rows(slate, lineups_fn, pitcher_fn, lambda *a, **k: None) if r["player_id"] == 1)["lineup_mult"]
    hrr_mult = next(r for r in pipeline.build_hrr_rows(slate, lineups_fn, pitcher_fn, lambda *a, **k: None) if r["player_id"] == 1)["lineup_mult"]
    # HRR nudge is a damped share -> closer to 1.0 than the runs nudge
    assert abs(hrr_mult - 1.0) < abs(runs_mult - 1.0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_pipeline.py -k "runs_row_boosted or hrr_lineup_effect" -v`
Expected: FAIL (`KeyError: 'lineup_mult'`)

- [ ] **Step 3: Write minimal implementation**

In `model/pipeline.py` `_run_prop_rows`, replace the `for b in lineups.get(side, []):` loop opening and the `lam = ...` / `row = {...}` section. Add ordered stat lists before the batter loop and compute the multiplier per batter:

```python
        for side, opp in (("home", away_p), ("away", home_p)):
            team = game.get(side, "?")
            park = hrr_park_factor(team) if prop == "HRR" else run_park_factor(team)
            order = lineups.get(side, [])
            onbase_order = [b.get("hit_rate", _run_props.LEAGUE_ONBASE) for b in order]
            power_order = [
                _run_props.slg_per_pa(b.get("season_1b", 0), b.get("season_2b", 0),
                                      b.get("season_3b", 0), b.get("season_hr", 0),
                                      b.get("season_pa", 0))
                for b in order
            ]
            for i, b in enumerate(order):
                games = b.get("games", 0)
                total = b.get(cfg["total_field"], 0)
                rate = _run_props.regressed_per_game(total, games, cfg["league"], _run_props.REG_GAMES)
                psupp = _run_props.pitcher_suppression_mult(opp.get("hit_allowed_rate", 0.22)) if opp else 1.0
                platoon = hr_platoon_mult(b.get("bats", "R"), opp.get("throws", "R")) if opp else 1.0
                hard_hit = b.get("recent_form_mult", 1.0)
                season_rate = (total / games) if games > 0 else 0.0
                production = _run_props.production_form_mult(
                    b.get(cfg["recent_field"], 0), b.get("recent_games", 0), season_rate)
                blended = _run_props.blend_forms(hard_hit, production)

                # --- Approach C: lineup context ---
                status = b.get("lineup_status", "confirmed")
                pos = i + 1
                runs_slot = _run_props.slot_factor(pos, "RUNS")
                runs_team = _run_props.teammate_factor(
                    _run_props.neighbor_avg(power_order, i, behind=True), _run_props.LEAGUE_SLG)
                runs_lmult = _run_props.lineup_mult(runs_slot, runs_team, status)
                rbi_slot = _run_props.slot_factor(pos, "RBI")
                rbi_team = _run_props.teammate_factor(
                    _run_props.neighbor_avg(onbase_order, i, behind=False), _run_props.LEAGUE_ONBASE)
                rbi_lmult = _run_props.lineup_mult(rbi_slot, rbi_team, status)
                if prop == "RUNS":
                    lmult, lslot, lteam = runs_lmult, runs_slot, runs_team
                elif prop == "RBI":
                    lmult, lslot, lteam = rbi_lmult, rbi_slot, rbi_team
                else:  # HRR
                    lmult, lslot, lteam = _run_props.hrr_lineup_mult(runs_lmult, rbi_lmult), None, None

                lam = _run_props.expected_count(
                    rate, pitcher_mult=psupp, platoon_mult=platoon, park_mult=park,
                    form_mult=blended, lineup_mult=lmult)
```

Then add the factor fields to the `row` dict (insert after the existing `"park_weather_factor": park,` line):

```python
                    "park_weather_factor": park,
                    "lineup_mult": lmult,
                    **({"lineup_slot": lslot, "lineup_teammate": lteam} if lslot is not None else {}),
```

(The rest of the `row` dict, `row.update(...)`, and `rows.append(row)` stay as they are.)

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_pipeline.py -k "runs_row_boosted or hrr_lineup_effect" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat(approach-c): apply lineup-context multiplier in run-prop rows"
```

---

### Task 5: Carry the lineup factor onto history twins

**Files:**
- Modify: `model/export_web.py:260` (`_run_factor_fields`)
- Test: `tests/test_export_web.py`

**Interfaces:**
- Consumes: rows from Task 4 carrying `lineup_mult` / `lineup_slot` / `lineup_teammate`.
- Produces: history twins gain `lineup_mult_hist` (+ `lineup_slot_hist`, `lineup_teammate_hist`).

- [ ] **Step 1: Write the failing test**

```python
# tests/test_export_web.py  (append)
from model import export_web

def test_run_factor_fields_includes_lineup_factors():
    # the history-twin attach list must carry the lineup factor so it is archived
    import inspect
    src = inspect.getsource(export_web.build_board_with_history)
    assert "lineup_mult" in src
```

(Note: if the project already has an end-to-end run-prop twin test, prefer extending it to assert `row.get("lineup_mult_hist") is not None`; the source-scan above is the minimal guard.)

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_export_web.py -k run_factor_fields_includes_lineup -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```python
# model/export_web.py  — extend the run-prop factor twin list
    _run_factor_fields = ("recent_form_mult", "pitcher_factor", "park_weather_factor",
                          "hard_hit_form", "production_form",
                          "lineup_mult", "lineup_slot", "lineup_teammate")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_export_web.py -k run_factor_fields_includes_lineup -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/export_web.py tests/test_export_web.py
git commit -m "feat(approach-c): attach lineup factor to run-prop history twins"
```

---

### Task 6: Recorder captures the lineup factor

**Files:**
- Modify: `model/archive.py:47-72` (`_FACTOR_KEYS`)
- Test: `tests/test_archive.py`

**Interfaces:**
- Consumes: rows carrying `lineup_mult` (+ components, + `_hist` variants).
- Produces: archived records' `factors` dict includes the lineup fields.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_archive.py  (append)
from model import archive

def test_record_from_row_captures_lineup_factors():
    row = {
        "game_id": 1, "player_id": 7, "player": "X", "team": "AAA",
        "p_ge1": 0.42, "p_ge2": 0.15,
        "lineup_mult": 1.08, "lineup_slot": 1.05, "lineup_teammate": 1.12,
        "lineup_mult_hist": 1.06,
    }
    rec = archive.record_from_row(row, "runs")
    assert rec["factors"]["lineup_mult"] == 1.08
    assert rec["factors"]["lineup_slot"] == 1.05
    assert rec["factors"]["lineup_teammate"] == 1.12
    assert rec["factors"]["lineup_mult_hist"] == 1.06
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_archive.py -k captures_lineup_factors -v`
Expected: FAIL (`KeyError: 'lineup_mult'`)

- [ ] **Step 3: Write minimal implementation**

```python
# model/archive.py  — add to the _FACTOR_KEYS tuple (alongside the threshold-family keys)
    "lineup_mult",
    "lineup_mult_hist",
    "lineup_slot",
    "lineup_slot_hist",
    "lineup_teammate",
    "lineup_teammate_hist",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_archive.py -k captures_lineup_factors -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/archive.py tests/test_archive.py
git commit -m "feat(approach-c): archive the lineup-context factor for grading"
```

---

### Task 7: Full-suite regression + sanity board

**Files:**
- Test: whole suite

- [ ] **Step 1: Run the full test suite**

Run: `uv run pytest -q`
Expected: PASS (all existing tests + the new ones). If any prior run-prop test asserted exact probabilities, it will now shift by the lineup multiplier — update the expected values to match the new (correct) numbers and note it in the commit.

- [ ] **Step 2: Generate a real board locally and eyeball it**

Run: `uv run python -m model.export_web $(date +%F)` (or a recent date with posted lineups)
Expected: runs/rbi/hrr rows carry `lineup_mult` between 0.85 and 1.15; leadoff/top-order hitters in stacked lineups show >1.0 Runs nudges; HRR nudges are visibly smaller than the Runs/RBI ones. Confirm no row is pinned at a cap across the board (a sign the sensitivity is too hot).

- [ ] **Step 3: Commit any test-baseline updates**

```bash
git add -A
git commit -m "test(approach-c): update run-prop probability baselines for lineup context"
```

---

## Self-Review

- **Spec coverage:** §3 inputs (Task 4 reads order/status/stats) · §4a tailored teammate (Task 2 + 4) · §4b slot tables (Task 1) · §4c trust dial (Tasks 1–2) · §4d cap (Task 2) · §4e HRR damping (Task 2 + 4) · §5 expected_count wiring (Task 3 + 4) · §6 Option A double-count (no deviation logic — slot applied as-is, ✓) · §7 twins (Task 5) · §8 recorder/grader (Task 6; grader unchanged ✓) · §9 testing (Tasks 1–7) · §10 constants (Task 1). All covered.
- **Placeholders:** none — every step has real code/commands.
- **Type consistency:** `lineup_mult`, `slot_factor`, `teammate_factor`, `neighbor_avg`, `hrr_lineup_mult`, `LEAGUE_ONBASE`, `LEAGUE_SLG`, `expected_count(..., lineup_mult=)` used identically across Tasks 1–6.

## Open notes for the implementer
- If `tests/test_run_props.py` / `tests/test_pipeline.py` already exist, append to them rather than overwriting.
- `build_hrr_rows` is referenced (it exists alongside `build_runs_rows`/`build_rbi_rows`); confirm its signature matches the others before Task 4's HRR test.
- Per spec §7, the history twin computes its own lineup_mult from history profiles — this is intended; do not force it equal to the current value.
