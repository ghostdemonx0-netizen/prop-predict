# Universal Pitcher Engine Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Blend each pitcher rate (`k_per_bf`, `hit_allowed_rate`, `hr_allowed_rate`) with a **barrel-implied** rate, sample-weighted — the base engine for every prop.

**Architecture:** A pure `barrel_blended_rate(made, pa, *, signal, league_rate, league_signal, votes)` = regression toward the pitcher's barrel-implied rate instead of league. Wired into both pitcher-profile builders; `pitcher_hr_mult` stops double-regressing HR.

**Tech Stack:** Python 3, pytest.

## Global Constraints
- **Spec:** `docs/superpowers/specs/2026-07-08-pitcher-engine-upgrade-design.md`.
- **SIGN-OFF build — changes the BASE pitcher rates for every prop (always-on).** The sign-off is Task 4's before/after smoke — do NOT deploy.
- All new constants (`_LG_*`, `_VOTES_*`, ratio clamp) are grader-tunable **SEEDs**.
- Batter-side rates (`k_rate`, `hit_rate`) are OUT of scope — do not touch. `regress()` stays for them.
- Additive/behavioral: existing tests that pin specific pitcher rates WILL shift — recompute + re-pin (do NOT weaken to presence-only). Full suite green each task.
- Signals come from the profile's own `barrel_metrics(allowed=True)` (`barrel_rate_allowed`, `hardhit_rate_allowed`) + `pitch_rates` (`swstr`) — compute them FIRST, then use in the blend.

---

### Task 1: `model/pitcher_engine.py` — the barrel-blended-rate helper

**Files:** Create `model/pitcher_engine.py`, `tests/test_pitcher_engine.py`.

- [ ] **Step 1: Write the failing tests**

```python
import math
from model.pitcher_engine import barrel_blended_rate, _implied, _VOTES_HR

def test_implied_scales_league_by_signal_ratio():
    # signal 1.5x league -> implied 1.5x league_rate
    assert math.isclose(_implied(0.033, 0.12, 0.08), 0.033 * 1.5, rel_tol=1e-9)

def test_implied_clamps_and_handles_missing():
    assert _implied(0.033, 0.40, 0.08) == 0.033 * 2.0   # 5x ratio clamps to 2.0
    assert _implied(0.033, 0.0, 0.08) == 0.033 * 0.5    # 0 ratio clamps to 0.5
    assert _implied(0.033, None, 0.08) == 0.033          # missing signal -> league

def test_blend_thin_sample_leans_implied():
    # 10 batters faced, votes=700 (HR) -> implied dominates
    r = barrel_blended_rate(1, 10, signal=0.12, league_rate=0.033, league_signal=0.08, votes=_VOTES_HR)
    implied = 0.033 * 1.5
    assert abs(r - implied) < 0.01           # basically the implied rate

def test_blend_pa_equals_votes_is_5050():
    # observed_rate = 0.05 (35 HR / 700 BF), implied = 0.033, votes=700, pa=700 -> avg
    r = barrel_blended_rate(35, 700, signal=0.08, league_rate=0.033, league_signal=0.08, votes=700)
    # signal==league_signal -> implied == league (0.033); observed = 0.05; 50/50 -> 0.0415
    assert math.isclose(r, (0.05 + 0.033) / 2, rel_tol=1e-6)

def test_blend_deep_sample_leans_observed():
    r = barrel_blended_rate(70, 1400, signal=0.08, league_rate=0.033, league_signal=0.08, votes=700)
    # observed 0.05, implied 0.033, pa=1400 vs votes 700 -> 2/3 observed
    assert abs(r - (0.05 * (1400/2100) + 0.033 * (700/2100))) < 1e-9

def test_blend_zero_denom_returns_implied():
    assert barrel_blended_rate(0, 0, signal=0.16, league_rate=0.033, league_signal=0.08, votes=0) == _implied(0.033, 0.16, 0.08)
```

- [ ] **Step 2: Run to verify fail**

Run: `.venv/bin/python -m pytest tests/test_pitcher_engine.py -q` → FAIL.

- [ ] **Step 3: Implement `model/pitcher_engine.py`**

```python
"""Barrel-blended pitcher rates. The blend IS regression — but toward the pitcher's
own barrel-implied rate instead of league average, sample-weighted. Barrel gets more
'votes' for luck-heavy rates (HR) than clean ones (Ks). All constants are SEEDs
(grader-tunable; league baselines join the data-driven-anchors item)."""

# league baselines for the barrel signals (SEEDs)
_LG_SWSTR = 0.11            # league swinging-strike rate  -> Ks
_LG_HARDHIT = 0.40         # league hard-hit-allowed rate -> hits
_LG_BARREL = 0.08          # league barrel-allowed rate   -> HR

# barrel "votes" per rate (bigger = barrel-generous / luck-heavier). SEEDs.
_VOTES_K, _VOTES_HIT, _VOTES_HR = 175.0, 350.0, 700.0

_RATIO_LO, _RATIO_HI = 0.5, 2.0   # clamp the barrel/league ratio


def _implied(league_rate: float, signal, league_signal: float) -> float:
    """A pitcher's barrel-implied rate: league_rate scaled by how his barrel signal
    compares to league (clamped). Missing signal -> league_rate (graceful)."""
    if not league_signal or signal is None:
        return league_rate
    ratio = signal / league_signal
    ratio = _RATIO_LO if ratio < _RATIO_LO else _RATIO_HI if ratio > _RATIO_HI else ratio
    return league_rate * ratio


def barrel_blended_rate(made: float, pa: float, *, signal, league_rate: float,
                        league_signal: float, votes: float) -> float:
    """Blend the pitcher's observed rate (made/pa) toward his barrel-implied rate,
    weighted by his sample (pa) vs `votes`. pa==votes -> 50/50 of observed & implied."""
    implied = _implied(league_rate, signal, league_signal)
    denom = pa + votes
    if denom <= 0:
        return implied
    return (made + implied * votes) / denom
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/python -m pytest tests/test_pitcher_engine.py -q` → PASS. Then `.venv/bin/python -m pytest -q` → green.

- [ ] **Step 5: Commit**

```bash
git add model/pitcher_engine.py tests/test_pitcher_engine.py
git commit -m "feat(pitcher): barrel_blended_rate — regress pitcher rates toward barrel-implied (votes per rate)"
```

---

### Task 2: Current-season profile + stop HR double-regressing

**Files:** Modify `model/profiles.py` (`pitcher_profile_from_events`), `model/projections.py` (`pitcher_hr_mult`), `tests/test_profile_components.py`, and the projections test file.

- [ ] **Step 1: Failing tests**

(a) In `tests/test_profile_components.py`: a pitcher with high `barrel_rate_allowed` on a THIN sample gets an `hr_allowed_rate` pulled UP toward his barrel-implied rate (higher than the raw `hr/pa`); a high-`swstr` pitcher gets a `k_per_bf` above the raw `ks/pa` blend-toward-league. Mirror the existing pitcher-profile fixture.
(b) In the projections test file: `pitcher_hr_mult(rate, bf)` returns `clamp(rate/league, 0.75, 1.3)` DIRECTLY (no internal regression) — e.g. `pitcher_hr_mult(0.066, 50)` ≈ `min(0.066/0.033, 1.3)` = 1.3 (not diluted toward league by the small bf).

- [ ] **Step 2: Run to verify fail**

Run: `.venv/bin/python -m pytest tests/test_profile_components.py -q -k "pitcher and barrel_blend"` and the projections test → FAIL.

- [ ] **Step 3: Implement**

In `model/profiles.py`, add `from model.pitcher_engine import barrel_blended_rate, _LG_SWSTR, _LG_HARDHIT, _LG_BARREL, _VOTES_K, _VOTES_HIT, _VOTES_HR`. In `pitcher_profile_from_events`, compute the metrics into locals BEFORE the return, then use them:
```python
    bm = barrel_metrics(events, as_of=as_of, allowed=True)
    pr = pitch_rates(events, as_of=as_of)
    ...
    return {
        ...
        "k_per_bf": barrel_blended_rate(ks, pa, signal=pr.get("swstr"),
                        league_rate=LEAGUE_K, league_signal=_LG_SWSTR, votes=_VOTES_K),
        "hit_allowed_rate": barrel_blended_rate(hits, pa, signal=bm.get("hardhit_rate_allowed"),
                        league_rate=LEAGUE_HIT, league_signal=_LG_HARDHIT, votes=_VOTES_HIT),
        "hr_allowed_rate": barrel_blended_rate(hr, pa, signal=bm.get("barrel_rate_allowed"),
                        league_rate=LEAGUE_HR_RATE, league_signal=_LG_BARREL, votes=_VOTES_HR),
        "bf": pa,
        **bm,
        **pr,
        **xwoba(events, as_of=as_of, allowed=True),
        ...
    }
```
(Replace the old `regress(...)`/raw lines for those three keys. `LEAGUE_HR_RATE` is already imported.)

In `model/projections.py` `pitcher_hr_mult`, replace the internal regression with the pre-blended rate:
```python
    reg = hr_allowed_rate   # already barrel-blended in the profile; do not double-regress
    return max(0.75, min(reg / league_hr_rate, 1.3))
```
(Keep the signature — `bf`/`regression_bf` stay for caller compatibility, now unused.)

- [ ] **Step 4: Run tests + full suite**

Run the new tests → PASS. Then `.venv/bin/python -m pytest -q`. Re-pin any existing pitcher-rate assertions that shifted (recompute the new value; do not weaken).

- [ ] **Step 5: Commit**

```bash
git add model/profiles.py model/projections.py tests/test_profile_components.py tests/test_projections.py
git commit -m "feat(pitcher): current-season k/hit/hr rates use barrel-implied blend; drop HR double-regress"
```

---

### Task 3: Blended (multi-season) profile

**Files:** Modify `model/profiles.py` (`blended_pitcher_profile`), `tests/test_profile_components.py`.

- [ ] **Step 1: Failing test**

In `tests/test_profile_components.py`: the blended pitcher profile's `k_per_bf`/`hit_allowed_rate`/`hr_allowed_rate` reflect the barrel blend (use a fixture where the pooled barrel signal pulls the rate off the raw pooled outcome). Mirror the existing blended-pitcher test.

- [ ] **Step 2: Run to verify fail**

Run: `.venv/bin/python -m pytest tests/test_profile_components.py -q -k "blended_pitcher and barrel_blend"` → FAIL.

- [ ] **Step 3: Implement**

In `blended_pitcher_profile`, the pooled barrel metrics are already computed (`prof.update(barrel_metrics(pooled, as_of=as_of, allowed=True))`) and pitch_rates pooled. Ensure the pooled `bm`/`pr` are available as locals, then set the three rates via `barrel_blended_rate(...)` using the pooled `made`/`eff_pa` and the pooled signals (`swstr`, `hardhit_rate_allowed`, `barrel_rate_allowed`), replacing the current `regress(..., LEAGUE_*, _*_R)` lines (259–261). Same signal→rate mapping as Task 2.

- [ ] **Step 4: Run tests + full suite**

New test → PASS. Then `.venv/bin/python -m pytest -q` → green (re-pin shifted blended-pitcher assertions).

- [ ] **Step 5: Commit**

```bash
git add model/profiles.py tests/test_profile_components.py
git commit -m "feat(pitcher): blended (multi-season) k/hit/hr rates use the barrel-implied blend"
```

---

### Task 4: Before/after smoke (sign-off)

**Files:** Create `scripts/smoke_pitcher_engine.py`.

- [ ] **Step 1: Write the smoke**

Create `scripts/smoke_pitcher_engine.py`: for a few real 2024 pitchers — an **ace** (high whiff, e.g. Skubal), a **homer-prone** arm (e.g. Nola), and a **thin-sample** guy (a reliever/callup) — print, for each rate, the **OLD** value (raw / league-regressed, computed inline) vs the **NEW** barrel-blended value from the profile, plus his sample (`bf`). Mirror `scripts/smoke_a1.py` fetch/profile pattern.

- [ ] **Step 2: Run + record**

Run: `.venv/bin/python scripts/smoke_pitcher_engine.py` (network — retry if slow). Record OLD→NEW per rate + assess: does a **thin-sample** pitcher move toward his barrel profile (not a coin-flip)? Does a **barrel-vulnerable** arm read homer-prone sooner? Are deep-sample aces barely moved (raw already trusted)? Paste the table; if a shift looks too large/small, note the `_VOTES_*` direction (do NOT change — user's sign-off call).

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke_pitcher_engine.py
git commit -m "chore(pitcher): real-data before/after smoke across the 3 rates (for sign-off)"
```

---

## Self-Review
**Coverage:** helper (T1) · current-season 3 rates + HR de-double-regress (T2) · blended 3 rates (T3) · smoke (T4). Batter rates untouched; HR double-regression resolved; signals from the profile's own barrel/pitch metrics. ✅
**Placeholder scan:** none — full helper + exact per-rate wiring + the pitcher_hr_mult reconciliation.
**Type consistency:** `barrel_blended_rate(made, pa, *, signal, league_rate, league_signal, votes) -> float`; same call shape in both profile builders; `pitcher_hr_mult` signature unchanged.
**Deferred:** VOTES/baseline auto-tuning (grader), data-driven baselines (roadmap), UI.
