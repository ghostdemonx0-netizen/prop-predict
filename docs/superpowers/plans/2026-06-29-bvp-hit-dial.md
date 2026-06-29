# BvP Hit Dial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Add a career BvP hit dial (`bvp_hit_mult`, ±10%, heavy shrinkage, neutral when no history) to the 1B/2B/3B of Hits & TB.

**Architecture:** New `projections.bvp_hit_mult` mirroring `bvp_hr_mult`; apply in `_batter_outcome_vector` to the contact components of both actual + neutral vectors (affects probability, cancels in factor ratios); expose `bvp_hit_mult` on threshold rows + archive it.

**Tech Stack:** Python 3.12, pytest.

## Global Constraints
- Spec: `docs/superpowers/specs/2026-06-29-bvp-hit-dial-design.md`. Math change; ±10% cap reused.
- Mirror `bvp_hr_mult`: `regression_pa=600`, `min_pa=1`, `[0.90, 1.10]`. Anchor = `LEAGUE_HIT=0.22`.
- HR/K/run props unchanged. TDD; `uv run pytest`.

---

### Task 1: `projections.bvp_hit_mult`
**Files:** Modify `model/projections.py`; Test `tests/test_projections.py`

- [ ] **Step 1: failing test**
```python
# tests/test_projections.py (append)
from model.projections import bvp_hit_mult, LEAGUE_HIT

def test_bvp_hit_mult_no_history_neutral():
    assert bvp_hit_mult(0, 0) == 1.0

def test_bvp_hit_mult_zero_hits_fades_down():
    m = bvp_hit_mult(0, 30)        # 0-for-30 vs pitcher
    assert 0.90 <= m < 1.0

def test_bvp_hit_mult_strong_sample_climbs_capped():
    m = bvp_hit_mult(40, 60)       # rakes off him, real sample
    assert 1.0 < m <= 1.10

def test_bvp_hit_mult_small_sample_barely_moves():
    assert abs(bvp_hit_mult(6, 12) - 1.0) < 0.02   # heavy shrinkage
```

- [ ] **Step 2: run, expect fail** — `uv run pytest tests/test_projections.py -k bvp_hit_mult -v`

- [ ] **Step 3: implement** — in `model/projections.py`, add near `LEAGUE_HR_RATE`:
```python
LEAGUE_HIT = 0.22  # league-average hits per plate appearance (matches matchup.LEAGUE_HIT)
```
and the function (after `bvp_hr_mult`):
```python
def bvp_hit_mult(hits: float, pa: float, *, league_hit_rate: float = LEAGUE_HIT,
                 regression_pa: float = 600.0, min_pa: float = 1.0,
                 lo: float = 0.90, hi: float = 1.10) -> float:
    """Career batter-vs-THIS-pitcher hits dial. Mirrors bvp_hr_mult: the career hit
    rate is regressed toward league (heavy phantom PAs), expressed vs league, capped
    +/-10%. No history -> 1.0."""
    if not pa or pa < min_pa:
        return 1.0
    rate = (hits + league_hit_rate * regression_pa) / (pa + regression_pa)
    return max(lo, min(rate / league_hit_rate, hi))
```

- [ ] **Step 4: run, expect pass.**
- [ ] **Step 5: commit** — `git commit -am "feat(bvp-hit): bvp_hit_mult career hits dial"`

---

### Task 2: Apply in `_batter_outcome_vector` + threshold row field
**Files:** Modify `model/pipeline.py`; Test `tests/test_threshold_pipeline.py`

- [ ] **Step 1: failing test**
```python
# tests/test_threshold_pipeline.py (append)
def test_bvp_hit_dial_boosts_hits_for_strong_history():
    batter = _bat(1, 400, 90, 25, 3, 20)
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit(pid)
    strong = lambda b, p: {"pa": 60, "ab": 55, "hits": 40, "hr": 2, "k": 5, "avg": ".364"}
    none = lambda b, p: None
    hi = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=strong)[0]
    base = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=none)[0]
    assert hi["p_ge1"] > base["p_ge1"]            # strong BvP hits history bumps the hit prob
    assert hi["bvp_hit_mult"] > 1.0
    assert base["bvp_hit_mult"] == 1.0            # no history -> neutral
```

- [ ] **Step 2: run, expect fail.**

- [ ] **Step 3: implement** —
In `model/pipeline.py` import: add `bvp_hit_mult` to the `from model.projections import (...)` block.
In `_batter_outcome_vector`, after `form = ...` (the form line) add:
```python
    hit_mult = bvp_hit_mult(bvp.get("hits", 0), bvp["pa"]) if (bvp and bvp.get("pa")) else 1.0
```
Append `* hit_mult` to lines `p1`/`p2`/`p3` and `n1`/`n2`/`n3` (the singles/doubles/triples of both vectors).
In `_threshold_rows`, in the batter loop set on the row dict:
```python
                    "bvp_hit_mult": bvp_hit_mult(bvp.get("hits", 0), bvp["pa"]) if (bvp and bvp.get("pa")) else 1.0,
```

- [ ] **Step 4: run, expect pass.**
- [ ] **Step 5: commit** — `git commit -am "feat(bvp-hit): apply hit dial to 1B/2B/3B of Hits/TB + row field"`

---

### Task 3: Archive key + full-suite regression
**Files:** `model/archive.py`; whole suite; Test `tests/test_archive.py`

- [ ] **Step 1: failing test**
```python
# tests/test_archive.py (append)
def test_record_captures_bvp_hit_mult():
    rec = record_from_row({"game_id": 1, "player_id": 7, "player": "X", "team": "AAA",
                           "p_ge1": 0.4, "bvp_hit_mult": 1.06}, "hits")
    assert rec["factors"]["bvp_hit_mult"] == 1.06
```
- [ ] **Step 2: run, expect fail.**
- [ ] **Step 3: implement** — add `"bvp_hit_mult"`, `"bvp_hit_mult_hist"` to `archive._FACTOR_KEYS`.
- [ ] **Step 4:** `uv run pytest tests/test_archive.py -k bvp_hit_mult -v` (pass), then full suite `uv run pytest -q`. Update any threshold test that pinned an exact Hits/TB probability with a non-None bvp_fn (the contact components now carry the dial). The default bvp_fn=None tests are unaffected (hit_mult=1.0).
- [ ] **Step 5: commit** — `git commit -am "feat(bvp-hit): archive bvp_hit_mult + baselines"`

## Self-Review
- Spec coverage: dial (T1) · wiring + row (T2) · archive + regression (T3). Placeholders: none. Types: `bvp_hit_mult(hits, pa)`, `LEAGUE_HIT`, `bvp_hit_mult` field consistent.
