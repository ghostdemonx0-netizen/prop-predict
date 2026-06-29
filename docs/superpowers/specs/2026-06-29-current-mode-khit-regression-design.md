# K/Hit Pull-to-Average in Current Mode (Design)

**Date:** 2026-06-29
**Status:** Design — approved in brainstorm; awaiting spec review
**Author:** brainstorm with user, 2026-06-29

---

## 1. Motivation

We regress rates toward the league average to tame thin samples ("pull-to-average"). Confirmed in code:
- **HR rate** is regressed in BOTH modes (inside `hr_probability`, R=300) — fine.
- **Batter `k_rate`/`hit_rate`** and **pitcher `k_per_bf`/`hit_allowed_rate`**: regressed in **History** mode (`blended_*_profile`), but **raw** (`ks/pa`, `hits/pa`) in **Current** mode.

So in Current mode a thin-sample hitter/pitcher (early season, call-up, 3-start starter) carries a **noisy raw rate** that feeds the matchup/log5 math → jumpy **Hits, TB, Strikeouts, KCN** reads, and a Current-vs-History mismatch driven purely by small-sample noise.

## 2. Scope

- **Add the same regression to Current mode** for: batter `k_rate`, `hit_rate`; pitcher `k_per_bf`, `hit_allowed_rate`.
- **Same `regress()` and same constants** History already uses (`LEAGUE_K`, `LEAGUE_HIT`, `_K_R=200`, `_HIT_R=200`). No new numbers.
- **Out of scope (already handled):** HR rate (regressed both modes); threshold props' 1B/2B/3B base rates (regressed at use-time in the outcome vector); Runs/RBI/HRR projections (regressed per-game via `regressed_per_game`). The run-prop *displayed matchup lean* reads the batter k/hit rate, so it's stabilized automatically — no run-prop change.

## 3. Design

### Batter (`profiles.batter_profile_from_events`)
Replace the raw rates in the returned dict:
```python
"k_rate":  regress(ks,   pa, LEAGUE_K,   _K_R),     # was (ks / pa) if pa else 0.0
"hit_rate": regress(hits, pa, LEAGUE_HIT, _HIT_R),  # was (hits / pa) if pa else 0.0
```

### Pitcher (`profiles.pitcher_profile_from_events`)
```python
"k_per_bf":         regress(ks,   pa, LEAGUE_K,   _K_R),   # was (ks / pa) if pa else 0.0
"hit_allowed_rate": regress(hits, pa, LEAGUE_HIT, _HIT_R), # was (hits / pa) if pa else 0.0
```

`regress`, `LEAGUE_K`, `LEAGUE_HIT`, `_K_R`, `_HIT_R` are already imported/defined in `profiles.py` (History uses them). `regress(made, pa, league, r) = (made + league*r)/(pa + r)`, so `pa=0` → exactly the league rate (no divide-by-zero; replaces the old `0.0` fallback with the league baseline, which is more correct for a no-data player).

### Interaction with History
`blended_*_profile` calls the base builder first, then **overrides** `k_rate`/`hit_rate` (and pitcher equivalents) with its blended-regressed values. So History is unchanged; only **Current mode** rates change.

## 4. Recorder / grader
**No change.** These rates feed the probabilities (which are already archived/graded). No new factor field.

## 5. Testing (TDD)
- Batter: thin sample (e.g., 10 PA, 5 hits) → `hit_rate` pulled well below the raw 0.50 toward `LEAGUE_HIT`; a large sample (e.g., 600 PA) ≈ its own rate; `pa=0` → exactly `LEAGUE_HIT`/`LEAGUE_K`.
- Pitcher: same for `k_per_bf` / `hit_allowed_rate`.
- History twins unchanged (still use the blended override).
- Full suite green: tests that pinned the **raw** Current-mode rates (e.g., `k_per_bf == 20/66`) updated to the regressed value via `regress(...)`; note in commit.

## 6. Sign-off
Model-math change (constants reused). Build via spec → plan → SDD; preview before prod.
