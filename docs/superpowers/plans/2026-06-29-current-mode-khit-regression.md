# K/Hit Pull-to-Average (Current Mode) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Regress batter `k_rate`/`hit_rate` and pitcher `k_per_bf`/`hit_allowed_rate` toward league in Current mode (they're already regressed in History).

**Architecture:** Two one-line swaps in `model/profiles.py` (the base profile builders), reusing the existing `regress()` + `LEAGUE_K`/`LEAGUE_HIT`/`_K_R`/`_HIT_R`. History overrides these downstream, so only Current mode changes.

**Tech Stack:** Python 3.12, pytest.

## Global Constraints
- Spec: `docs/superpowers/specs/2026-06-29-current-mode-khit-regression-design.md`. Math change; constants reused.
- `regress(made, pa, league, r) = (made + league*r)/(pa + r)`; `pa=0` → exactly the league rate.
- History (`blended_*_profile`) overrides these → unchanged. TDD; `uv run pytest`.

---

### Task 1: Batter `k_rate`/`hit_rate` regressed (Current)
**Files:** Modify `model/profiles.py:99-100`; Test `tests/test_profiles.py`

- [ ] **Step 1: failing test**
```python
# tests/test_profiles.py (append)
def test_batter_current_rates_regressed_toward_league():
    from model import profiles as P
    ev = [{"game_date": "2026-05-01", "events": e, "launch_speed": 95.0}
          for e in (["single"] * 5 + ["field_out"] * 5)]   # 10 PA, 5 hits -> raw 0.50
    prof = P.batter_profile_from_events(ev, as_of="2026-07-01", player_id=1)
    assert prof["hit_rate"] < 0.40                          # pulled well below raw 0.50
    assert abs(prof["hit_rate"] - P.regress(5, 10, P.LEAGUE_HIT, P._HIT_R)) < 1e-9
    empty = P.batter_profile_from_events([], as_of="2026-07-01", player_id=1)
    assert empty["hit_rate"] == P.LEAGUE_HIT               # pa=0 -> league rate
    assert empty["k_rate"] == P.LEAGUE_K
```

- [ ] **Step 2: run, expect fail** — `uv run pytest tests/test_profiles.py -k current_rates_regressed -v`

- [ ] **Step 3: implement** — in `batter_profile_from_events` return dict:
```python
        "k_rate": regress(ks, pa, LEAGUE_K, _K_R),
        "hit_rate": regress(hits, pa, LEAGUE_HIT, _HIT_R),
```

- [ ] **Step 4: run, expect pass.**
- [ ] **Step 5: commit** — `git commit -am "feat(current-regression): regress batter k_rate/hit_rate in Current mode"`

---

### Task 2: Pitcher `k_per_bf`/`hit_allowed_rate` regressed (Current)
**Files:** Modify `model/profiles.py:163,167`; Test `tests/test_profiles.py`

- [ ] **Step 1: failing test**
```python
# tests/test_profiles.py (append)
def test_pitcher_current_rates_regressed_toward_league():
    from model import profiles as P
    ev = [{"game_date": "2026-05-01", "events": e, "game_pk": 1}
          for e in (["strikeout"] * 3 + ["single"] * 3 + ["field_out"] * 4)]  # 10 PA
    prof = P.pitcher_profile_from_events(ev, as_of="2026-07-01", player_id=1)
    assert abs(prof["k_per_bf"] - P.regress(3, 10, P.LEAGUE_K, P._K_R)) < 1e-9
    assert abs(prof["hit_allowed_rate"] - P.regress(3, 10, P.LEAGUE_HIT, P._HIT_R)) < 1e-9
    empty = P.pitcher_profile_from_events([], as_of="2026-07-01", player_id=1)
    assert empty["k_per_bf"] == P.LEAGUE_K
```

- [ ] **Step 2: run, expect fail.**

- [ ] **Step 3: implement** — in `pitcher_profile_from_events` return dict:
```python
        "k_per_bf": regress(ks, pa, LEAGUE_K, _K_R),
        "hit_allowed_rate": regress(hits, pa, LEAGUE_HIT, _HIT_R),
```

- [ ] **Step 4: run, expect pass.**
- [ ] **Step 5: commit** — `git commit -am "feat(current-regression): regress pitcher k_per_bf/hit_allowed_rate in Current mode"`

---

### Task 3: Full-suite regression + baseline updates
- [ ] **Step 1:** `uv run pytest -q`. Update any test that pinned a **raw** Current-mode rate (e.g. `k_per_bf == 20/66`, or batter `hit_rate == (s1+s2+s3+hr)/pa`) to the regressed value via `regress(...)`. History-twin tests are unaffected (override). Note changes in commit.
- [ ] **Step 2:** `git add -A && git commit -m "test(current-regression): update raw-rate baselines to regressed Current-mode rates"`

## Self-Review
- Spec coverage: batter (T1) · pitcher (T2) · regression (T3). No recorder change (none added).
- Placeholders: none. Type consistency: `regress`/`LEAGUE_K`/`LEAGUE_HIT`/`_K_R`/`_HIT_R` reused as-defined.
