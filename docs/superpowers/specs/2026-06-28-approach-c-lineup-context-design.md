# Approach C — Lineup-Context Layer for Runs / RBI / HRR (Design)

**Date:** 2026-06-28
**Status:** Design — awaiting user sign-off (model-math change; see global rule "math changes need sign-off")
**Author:** brainstorm with user, 2026-06-28

---

## 1. Motivation

Runs and RBI are **teammate-dependent** outcomes:
- You **score a Run** when the hitters **behind** you drive you in.
- You get an **RBI** when the hitters **ahead** of you are on base for you to drive in.

The current model (Approach A, live) projects Runs/RBI from the player's **own** per-game rate scaled by opposing pitcher, platoon, park run-environment, and recent form. It models **zero teammate effect** — two identical hitters get the same projection whether they bat in front of a star or a weak hitter.

**Approach C** adds a **lineup-context multiplier** on top of Approach A. It does **not** replace A; it is one more bounded multiplier in the existing chain, exactly like park / pitcher / platoon / form.

This is the final layer of the Runs/RBI staging (A shipped → C this). The full game-simulation engine (formerly "Approach B") is a separate, far-future, site-wide project and is **out of scope here.**

## 2. Scope

In scope:
- A new `lineup_mult` applied to **Runs** and **RBI** expected counts.
- A **dampened** inherited effect for **HRR** (since part of HRR is Hits, which is lineup-neutral).
- Recorder integration so the new factor is archived.

Out of scope (documented as future refinements in §10):
- Deviation-from-typical double-count correction (Option B).
- Handedness/opponent-aware projected lineup (its own roadmap item).
- True OBP (with walks) for the on-base proxy.
- Game-simulation engine.

## 3. Inputs (all already available)

- **Ordered lineup** per side — confirmed via `fetch.get_lineups` (official `battingOrder`), projected via `fetch.get_recent_lineup` (team's most recent posted order). Both return ordered 1→9 lists. Live since 2026-06-17.
- **`lineup_status`** per row — `"confirmed"` or `"projected"`. Already stamped on every row.
- **Teammate stats** from existing batter profiles:
  - **on-base proxy** = `hit_rate` (hits / PA). (v1 approximation of OBP; no walks yet.)
  - **power** = SLG = `(season_1b + 2·season_2b + 3·season_3b + 4·season_hr) / season_pa`. All fields already on the profile.
- **League anchors:** `LEAGUE_HIT` (exists) for on-base; add `LEAGUE_SLG` constant for power.

## 4. The lineup-context multiplier

For each batter at lineup position `pos` (1–9, circular — position 9 is followed by position 1):

### 4a. Teammate quality (TAILORED)
Look at the **N = 2** nearest neighbors (v1: equally weighted; N is a tunable constant):
- **For RBI** — the 2 hitters **ahead**: average their on-base proxy (`hit_rate`).
- **For Runs** — the 2 hitters **behind**: average their power (SLG).

Convert to a multiplier centered at 1.0 with a tunable sensitivity `S` (v1 `S = 0.5`):
```
teammate_rbi  = 1 + S × (avg_ahead_onbase / LEAGUE_HIT  − 1)
teammate_runs = 1 + S × (avg_behind_power / LEAGUE_SLG − 1)
```
League-average neighbors → 1.0; better → >1.0; worse → <1.0.

### 4b. Slot baseline (anchor tables, seed values)
Multipliers by batting position, centered ≈ 1.0 (refine from real league splits + grader data later):

| Pos | `SLOT_RUNS` | `SLOT_RBI` |
|:--:|:--:|:--:|
| 1 | 1.15 | 0.85 |
| 2 | 1.10 | 0.93 |
| 3 | 1.05 | 1.10 |
| 4 | 1.00 | 1.18 |
| 5 | 0.97 | 1.08 |
| 6 | 0.94 | 1.00 |
| 7 | 0.91 | 0.93 |
| 8 | 0.88 | 0.88 |
| 9 | 0.90 | 0.85 |

### 4c. Blend — confidence-weighted "trust dial"
`w` = trust in tonight's real teammates, by `lineup_status`:

| `lineup_status` | `w` (teammate) | `1−w` (slot) |
|---|:--:|:--:|
| confirmed | **0.80** | 0.20 |
| projected | **0.35** | 0.65 |

```
lineup_runs = (1−w)·SLOT_RUNS[pos] + w·teammate_runs
lineup_rbi  = (1−w)·SLOT_RBI[pos]  + w·teammate_rbi
```

### 4d. Cap (on the EXPECTED COUNT, not the probability)
Clamp each multiplier to **[0.85, 1.15]** (±15%). This bounds the Poisson mean λ; the displayed probability moves less and is threshold-dependent (Poisson variance = mean, so spread rides along automatically).

### 4e. HRR — dampened inherited effect
HRR is a Hits+Runs+RBI combo modeled on the combined total; its Hits portion is lineup-neutral. So HRR gets a **dampened ~0.55 share** (mirrors how HRR already dampens its park factor):
```
hrr_lineup = 1 + 0.55 × ( (lineup_runs + lineup_rbi) / 2 − 1 )   # then clamp to [0.85, 1.15]
```
Effective HRR move ≈ ±8%. No separate HRR dial.

## 5. Where it plugs in

`model/run_props.py` `expected_count(...)` already multiplies rate × pitcher × platoon × park × form. Add `lineup_mult` as one more factor:
```
λ = rate × pitcher_mult × platoon_mult × park_mult × form_mult × lineup_mult
```
The caller (run-prop builder in `export_web` / `pipeline`) computes `lineup_runs` / `lineup_rbi` / `hrr_lineup` from the ordered lineup + `lineup_status` + neighbor stats and passes the right one per prop.

## 6. Double-counting (Option A, pragmatic v1)

Approach A's own per-game rate already reflects where a player **usually** bats. Applying the slot table as-is mildly double-counts for players in stable unusual roles. **v1 accepts this**; the ±15% cap limits the damage. The deviation-from-typical correction (Option B) is a documented future refinement.

## 7. Weighting twins (current / blend / history)

The lineup multiplier is a **tonight-matchup factor** (like park / pitcher / platoon), **not** a skill-rate or recent-form signal. It therefore applies **identically across all three weightings** (current, blend, history) — it is NOT neutralized in the history/blend twins the way recent form is. Tonight's lineup is the same regardless of which skill-rate weighting is shown.

## 8. Recorder / grader integration

- **Grader:** no change. It grades Runs/RBI/HRR outcomes against the recorded (now lineup-adjusted) probabilities automatically.
- **Recorder (`model/archive.py`):** add the new factor field name(s) to `_FACTOR_KEYS` so they are archived — otherwise the nudge happens but is never captured. Archive the final `lineup_mult` **plus** its components for diagnosis: `lineup_mult`, `lineup_slot`, `lineup_teammate`, and the `w` used. This enables later "did the lineup factor pull its weight / is it calibrated?" analysis — the purpose of the archive.

## 9. Testing (TDD)

- Pure math units: `teammate_*` centering (league-avg neighbors → 1.0), slot lookup, circular neighbor selection (pos 9 → 1 wraparound), blend weights, ±15% clamp, HRR 0.55 dampening + clamp.
- Status-driven blend: confirmed vs projected produce the 0.80/0.35 split.
- Integration: a stacked lineup (stars behind a leadoff hitter) raises his Runs; weak hitters lower it; RBI mirrors with hitters ahead. HRR moves ~0.55 of the R/RBI move.
- Twin parity: lineup_mult identical across current/blend/history.
- Recorder: archived record includes the new factor fields.

## 10. Constants summary (all tunable from grader data)

| Constant | v1 value |
|---|---|
| `w` confirmed / projected | 0.80 / 0.35 |
| Cap | ±15% ([0.85, 1.15]) |
| HRR damping share | 0.55 |
| Teammate sensitivity `S` | 0.50 |
| Neighbors `N` | 2 (equal weight) |
| `SLOT_RUNS`, `SLOT_RBI` | tables in §4b |
| `LEAGUE_SLG` | new constant (set from league data) |

## 11. Future refinements (roadmap)

- Option B deviation-from-typical (removes double-counting).
- Handedness/opponent-aware projected lineup (own roadmap item).
- True OBP (add walks) for the on-base proxy.
- Tune all §10 constants from grader data once Runs/RBI/HRR outcomes accumulate.
- Game-simulation engine (separate far-future, site-wide).

## 12. Sign-off

This is a model-math change. Requires user approval of this spec before an implementation plan is written. Build via brainstorm → spec → plan → SDD with 2-reviewer gate, preview before prod (same as prior math builds).
