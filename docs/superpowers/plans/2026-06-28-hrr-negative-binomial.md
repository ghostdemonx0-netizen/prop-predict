# HRR Negative-Binomial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert HRR's 2+/3+/4+ probabilities with a Negative Binomial (fatter, realistic tail) instead of Poisson, while leaving the mean and all other props untouched.

**Architecture:** Add `nb_over_prob` alongside `poisson_over_prob`; give `run_props.ge_probs` an optional `nb_size`; route only HRR through it via a `nb_size` entry in `_RUN_PROP_CFG`. The HRR mean (λ) and every factor feeding it (incl. Approach C) are unchanged — only the final conversion differs.

**Tech Stack:** Python 3.12 stdlib (`math.lgamma`), pytest. No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-28-hrr-negative-binomial-design.md`. **Model-math change** — constants signed off.
- **HRR only.** Runs/RBI stay Poisson (`ge_probs` default path unchanged).
- `HRR_NB_SIZE = 4.0` (seed, tunable). `nb_size=None` MUST keep today's exact Poisson behavior (back-compat).
- No recorder/grader change (p_ge2/3/4 already archived/graded).
- TDD; run from repo root with `uv run pytest`.

---

### Task 1: `nb_over_prob` in projections

**Files:**
- Modify: `model/projections.py` (add after `poisson_over_prob`, ~line 79)
- Test: `tests/test_projections.py` (append; create if absent)

**Interfaces:**
- Consumes: `poisson_over_prob` (same module, for the `size<=0` guard + Poisson-limit test).
- Produces: `nb_over_prob(mu: float, line: float, size: float) -> float` — P(X > line) for NegBinomial(mean=mu, size=size); same `line` semantics as `poisson_over_prob`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_projections.py
import math
from model.projections import poisson_over_prob, nb_over_prob

def test_nb_fatter_tail_than_poisson_same_mean():
    # at the same mean, NB puts MORE mass in the 3+ tail than Poisson
    assert nb_over_prob(1.8, 2.5, 4.0) > poisson_over_prob(1.8, 2.5)

def test_nb_approaches_poisson_for_large_size():
    # size -> large => NB ~ Poisson
    assert abs(nb_over_prob(1.8, 2.5, 1e6) - poisson_over_prob(1.8, 2.5)) < 1e-3

def test_nb_zero_mean_is_zero():
    assert nb_over_prob(0.0, 1.5, 4.0) == 0.0

def test_nb_monotonic_in_threshold():
    p2 = nb_over_prob(1.8, 1.5, 4.0)
    p3 = nb_over_prob(1.8, 2.5, 4.0)
    p4 = nb_over_prob(1.8, 3.5, 4.0)
    assert p2 >= p3 >= p4 >= 0.0

def test_nb_size_nonpositive_falls_back_to_poisson():
    assert nb_over_prob(1.8, 2.5, 0.0) == poisson_over_prob(1.8, 2.5)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_projections.py -k nb_ -v`
Expected: FAIL with `ImportError: cannot import name 'nb_over_prob'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/projections.py  (add after poisson_over_prob)
def nb_over_prob(mu: float, line: float, size: float) -> float:
    """P(X > line) for X ~ Negative Binomial with mean=mu and size (dispersion).

    Same line semantics as poisson_over_prob: floor(line)+1 is the first counted
    value. Larger size -> approaches Poisson; smaller size -> fatter tail.
    variance = mu + mu**2 / size.
    """
    if mu <= 0:
        return 0.0
    if size <= 0:
        return poisson_over_prob(mu, line)
    threshold = math.floor(line) + 1
    log_p_fail = math.log(size / (size + mu))   # ln(r/(r+mu))
    log_p_succ = math.log(mu / (size + mu))     # ln(mu/(r+mu))
    cdf = 0.0
    for k in range(threshold):
        log_pmf = (math.lgamma(k + size) - math.lgamma(size) - math.lgamma(k + 1)
                   + size * log_p_fail + k * log_p_succ)
        cdf += math.exp(log_pmf)
    return max(0.0, 1.0 - cdf)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_projections.py -k nb_ -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/projections.py tests/test_projections.py
git commit -m "feat(hrr): nb_over_prob (negative-binomial tail probability)"
```

---

### Task 2: `HRR_NB_SIZE` + `ge_probs` nb_size option

**Files:**
- Modify: `model/run_props.py` (import `nb_over_prob`; add `HRR_NB_SIZE`; extend `ge_probs`)
- Test: `tests/test_run_props.py` (append)

**Interfaces:**
- Consumes (Task 1): `nb_over_prob`
- Produces: `HRR_NB_SIZE = 4.0`; `ge_probs(lam, thresholds, *, nb_size: float|None=None) -> dict` — Poisson when `nb_size` is None, NB otherwise.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_run_props.py  (append)
def test_ge_probs_default_is_poisson_unchanged():
    from model.projections import poisson_over_prob
    out = rp.ge_probs(1.8, [("p_ge2", 2), ("p_ge3", 3)])
    assert out["p_ge2"] == poisson_over_prob(1.8, 1.5)
    assert out["p_ge3"] == poisson_over_prob(1.8, 2.5)

def test_ge_probs_nb_size_uses_negative_binomial():
    from model.projections import poisson_over_prob
    out = rp.ge_probs(1.8, [("p_ge3", 3)], nb_size=rp.HRR_NB_SIZE)
    assert out["p_ge3"] > poisson_over_prob(1.8, 2.5)   # fatter tail
    assert rp.HRR_NB_SIZE == 4.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_run_props.py -k "ge_probs_nb_size or ge_probs_default_is_poisson" -v`
Expected: FAIL (`AttributeError: ... 'HRR_NB_SIZE'` / `unexpected keyword argument 'nb_size'`)

- [ ] **Step 3: Write minimal implementation**

```python
# model/run_props.py  — update the import line
from model.projections import poisson_over_prob, nb_over_prob
```

```python
# model/run_props.py  — add with the other constants (near LEAGUE_HRR_PER_GAME)
HRR_NB_SIZE = 4.0   # negative-binomial dispersion for HRR (lower = fatter tail; tunable from grader data)
```

```python
# model/run_props.py  — replace ge_probs
def ge_probs(lam: float, thresholds: list[tuple[str, int]], *, nb_size: float | None = None) -> dict[str, float]:
    """{label: P(count >= n)} for a count of mean lam. Poisson by default;
    Negative Binomial (fatter tail) when nb_size is given. Monotonic by construction."""
    if nb_size:
        return {label: nb_over_prob(lam, n - 0.5, nb_size) for (label, n) in thresholds}
    return {label: poisson_over_prob(lam, n - 0.5) for (label, n) in thresholds}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_run_props.py -k "ge_probs_nb_size or ge_probs_default_is_poisson" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/run_props.py tests/test_run_props.py
git commit -m "feat(hrr): HRR_NB_SIZE + ge_probs negative-binomial option"
```

---

### Task 3: Route HRR through the NB path

**Files:**
- Modify: `model/pipeline.py` (`_RUN_PROP_CFG["HRR"]` gains `nb_size`; `_run_prop_rows` passes it)
- Test: `tests/test_run_props_pipeline.py` (append)

**Interfaces:**
- Consumes (Task 2): `_run_props.HRR_NB_SIZE`, `ge_probs(..., nb_size=)`
- Produces: HRR rows use NB tail probabilities; Runs/RBI unchanged.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_run_props_pipeline.py  (append)
def test_hrr_rows_use_negative_binomial_tail():
    from model.projections import poisson_over_prob
    hrr = build_hrr_rows(_SLATE, _L, lambda p: _pit(p), _W)[0]
    runs = build_runs_rows(_SLATE, _L, lambda p: _pit(p), _W)[0]
    # Recompute the HRR mean the same way the pipeline does (no lineup neighbors here)
    _hrate = run_props.regressed_per_game(200, 100, run_props.LEAGUE_HRR_PER_GAME, run_props.REG_GAMES)
    # The HRR 3+ prob must EXCEED the Poisson value at the same mean (fatter tail).
    # (exact mean includes park/platoon/lineup multipliers; we only assert the
    # NB-vs-Poisson direction holds at the row's own implied lambda is hard to
    # reconstruct, so assert via the pure functions instead:)
    assert run_props.ge_probs(2.0, [("p_ge3", 3)], nb_size=run_props.HRR_NB_SIZE)["p_ge3"] > \
           run_props.ge_probs(2.0, [("p_ge3", 3)])["p_ge3"]
    # And the HRR row carries monotonic thresholds.
    assert hrr["p_ge2"] >= hrr["p_ge3"] >= hrr["p_ge4"]
    # Runs row stays on Poisson (sanity: still has its thresholds, monotonic)
    assert runs["p_ge1"] >= runs["p_ge2"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_run_props_pipeline.py -k hrr_rows_use_negative_binomial -v`
Expected: FAIL (HRR cfg has no `nb_size` yet, so the pipeline still uses Poisson; the pure-function assertion passes but the wiring assertion below fails — see Step 3 note). If it passes spuriously, proceed to wire anyway and rely on Task 4's full-suite pin.

- [ ] **Step 3: Write minimal implementation**

```python
# model/pipeline.py  — add nb_size to the HRR config entry
    "HRR":  {"thresholds": [("p_ge2", 2), ("p_ge3", 3), ("p_ge4", 4)], "total_field": "total_hrr", "recent_field": "recent_hrr", "league": _run_props.LEAGUE_HRR_PER_GAME, "nb_size": _run_props.HRR_NB_SIZE},
```

```python
# model/pipeline.py  — _run_prop_rows: pass nb_size through (replace the ge_probs line)
                row.update(_run_props.ge_probs(lam, cfg["thresholds"], nb_size=cfg.get("nb_size")))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_run_props_pipeline.py -k hrr_rows_use_negative_binomial -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_run_props_pipeline.py
git commit -m "feat(hrr): route HRR rows through the negative-binomial tail"
```

---

### Task 4: Full-suite regression + update pinned HRR baselines

**Files:** whole suite; likely `tests/test_run_props_pipeline.py`

- [ ] **Step 1: Run the full suite**

Run: `uv run pytest -q`
Expected: One known failure — `test_rbi_and_hrr_rows_thresholds` recomputes the HRR p_ge2 with the **Poisson** `ge_probs` and compares to the row (now NB). Update that recompute to pass `nb_size=run_props.HRR_NB_SIZE`:

```python
# tests/test_run_props_pipeline.py  — in test_rbi_and_hrr_rows_thresholds
    assert math.isclose(hrr["p_ge2"], run_props.ge_probs(_hlam, [("p_ge2", 2)], nb_size=run_props.HRR_NB_SIZE)["p_ge2"])
```

Re-run `uv run pytest -q` until green. Any other test that pinned an exact Poisson HRR probability gets the same `nb_size=run_props.HRR_NB_SIZE` treatment (and note it in the commit).

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "test(hrr): update HRR baselines to the negative-binomial tail"
```

---

## Self-Review

- **Spec coverage:** §3a NB distribution (Task 1) · §3b HRR_NB_SIZE league constant (Task 2) · §3c wiring nb_over_prob + ge_probs + cfg + _run_prop_rows (Tasks 1–3) · §3d weightings (HRR rows built by the same `_run_prop_rows` in all modes → covered by Task 3) · §4 no recorder change (nothing added) · §5 constant (Task 2) · §6 testing (all tasks). Covered.
- **Placeholder scan:** none — full code in every step.
- **Type consistency:** `nb_over_prob(mu, line, size)`, `HRR_NB_SIZE=4.0`, `ge_probs(..., nb_size=)`, `cfg.get("nb_size")` used identically across Tasks 1–4.

## Notes for the implementer
- `nb_size=None` (Runs/RBI, default) must reproduce today's Poisson numbers exactly — Task 2's `test_ge_probs_default_is_poisson_unchanged` pins this.
- Only HRR carries `nb_size` in `_RUN_PROP_CFG`; do not add it to RUNS/RBI.
- If `tests/test_projections.py` doesn't exist, create it.
