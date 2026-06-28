# Production-Form for HR / Hits / Total Bases (Design)

**Date:** 2026-06-28
**Status:** Design — approved in brainstorm; awaiting spec review
**Author:** brainstorm with user, 2026-06-28

---

## 1. Motivation / how we got here

"Recent form" has two flavors:
- **Hard-hit form** (`recent_form_mult`) — quality of contact, measured by **exit velocity** (% of batted balls hit hard). A leading indicator. Already computed for every batter in `batter_profile_from_events` (last `_RECENT_BIP=55` batted balls, shrunk toward season, sensitivity 1.5, clamp [0.8, 1.25]).
- **Production form** — actual *results* lately (is he getting hits / homers / extra bases), vs his season rate. Captures hot/cold streaks in outcomes.

The run props (Runs/RBI/HRR) already blend **both** (60/40 hard/production). But **HR / Hits / Total Bases use only the hard-hit signal.** This adds the production (results) half to those three.

## 2. Scope & key decisions

- **All three props** (HR, Hits, TB) get a production signal, **blended per-prop** with the existing hard-hit signal:
  | Prop | hard-hit | production |
  |---|:--:|:--:|
  | Hits | 60% | 40% |
  | Total Bases | 60% | 40% |
  | HR | **80%** | **20%** |
- **HR is down-weighted (80/20)** because recent HR *count* is rare/noisy and exit velo is the better power signal; Hits/TB (60/40) mirror the run props since hit/XBH results are frequent enough to trust.
- Per-prop production metric (each a recent rate vs season, from the batter's events):
  - **HR:** recent HR/PA vs season HR/PA
  - **Hits:** recent hits/PA vs season hits/PA
  - **TB:** recent total-bases/PA vs season total-bases/PA (total bases = 1·1B + 2·2B + 3·3B + 4·HR)
- Mean/factor pipeline otherwise unchanged; only the **recent-form multiplier** each prop uses becomes a blend instead of hard-hit alone.

## 3. Design

### 3a. Production multipliers (in `batter_profile_from_events`)
From `pa_rows` (events strictly before `as_of`), compute three production multipliers, each centered at 1.0, using the last `_RECENT_PA` PAs by `game_date`, shrunk toward 1.0 by `_PROD_SHRINK_PA` phantom PAs, clamped [0.80, 1.20]:
```
recent = last _RECENT_PA pa_rows by game_date
raw    = (recent_outcome_rate) / (season_outcome_rate)        # outcome = hr | hit | total_bases
shrunk = (raw·n + 1.0·_PROD_SHRINK_PA) / (n + _PROD_SHRINK_PA) # n = len(recent)
mult   = clamp(shrunk, 0.80, 1.20)                            # 1.0 if season_rate==0 or n==0
```
Store as `production_form_hr`, `production_form_hit`, `production_form_tb` on the profile. (Heavier shrinkage than the run props' per-game version because per-PA rates — especially HR — are noisier.)

### 3b. Blend per-prop (in the row builders)
Mirror the run-prop pattern (`blend_forms` already exists in `run_props`, clamp [0.80, 1.20]):
- **HR** (`build_hr_rows`): `hard = b["recent_form_mult"]`; `prod = b["production_form_hr"]`; `form = blend_forms(hard, prod, w_hard=0.80)`; pass `form` as `recent_form_mult` into `hr_probability`.
- **Hits/TB** (`_threshold_rows`): `prod = b["production_form_hit"|"production_form_tb"]` (by prop); `form = blend_forms(hard, prod, w_hard=0.60)`; use `form` as the recent-form multiplier in the outcome vector.
- Each row stores, for transparency + archiving: `recent_form_mult` = blended, `hard_hit_form` = raw hard-hit, `production_form` = raw production (the prop's value). (Same three field names the run props already use.)

### 3c. History/Blend twins stay form-neutral
`batter_hist_fn` already zeroes recent form for the history twins (`recent_form_mult = 1.0`). Add `production_form_hr/hit/tb = 1.0` there too, so the per-prop blend evaluates to `blend_forms(1.0, 1.0) = 1.0` — history twins remain the form-neutral baseline (consistent with run props).

### 3d. Constants (seeds; tunable from grader data)
| Constant | Value | Meaning |
|---|---|---|
| `_RECENT_PA` | 60 | production window (recent PAs) |
| `_PROD_SHRINK_PA` | 50 | phantom PAs shrinking recent → season (tames HR noise) |
| HR blend `w_hard` | 0.80 | hard-hit weight for HR (production 0.20) |
| Hits/TB blend `w_hard` | 0.60 | hard-hit weight for Hits/TB (production 0.40) |
| production clamp | [0.80, 1.20] | per-signal bound |

## 4. Recorder / grader

**No archive code change.** `_FACTOR_KEYS` already includes `hard_hit_form`, `production_form`, `recent_form_mult` (+ `_hist`) from the run props — HR/Hits/TB rows simply start populating `hard_hit_form` and `production_form` (they already carry `recent_form_mult`). Grader auto-grades.

## 5. Testing (TDD)

- `production_form_*`: league-average recent vs season → 1.0; hot results → >1.0; cold → <1.0; 0 recent PAs or 0 season rate → 1.0; clamped to [0.80, 1.20]; HR heavily shrunk (a 1-HR-in-60 vs season blip barely moves).
- Blend: HR uses 80/20, Hits/TB use 60/40 (a fixed hard+production pair yields the expected blended numbers per prop).
- Row fields: HR/Hits/TB rows now carry `hard_hit_form` + `production_form` + blended `recent_form_mult`.
- History twins: `production_form_*` and `recent_form_mult` are 1.0 → blended form neutral.
- Integration: a hot-results batter's HR/Hits/TB probability rises vs an identical cold-results batter; full suite green (existing tests that pin HR/Hits/TB probabilities updated to the blended-form baseline, noted in commit).

## 6. Future refinements
- Tune `_RECENT_PA`, `_PROD_SHRINK_PA`, and the blend weights from grader data.
- Revisit whether HR should keep production at all once the "did it help?" factor analysis has data.

## 7. Sign-off
Model-math change. Build via spec → plan → SDD; preview before prod.
