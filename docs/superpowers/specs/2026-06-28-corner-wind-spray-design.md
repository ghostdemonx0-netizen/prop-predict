# Corner/Pull-Field Wind via Per-Batter Spray (Design)

**Date:** 2026-06-28
**Status:** Design — approved in brainstorm; awaiting spec review
**Author:** brainstorm with user, 2026-06-28

---

## 1. Motivation / how we got here

The HR weather model only credits the wind component blowing **straight to center field** (`wind_out_to_cf` = cosine toward CF). A wind blowing out to **left or right field** is ~perpendicular to center → `cos(90°)≈0` → treated as **neutral**. And handedness is never consulted — wind is computed **once per game**, shared by all batters.

But a crosswind out to a corner genuinely **carries balls out** to that corner. A **pull hitter** with wind blowing out to his pull field gets a real HR boost we currently miss (and a penalty when it blows in). The website already draws the true wind-direction arrow, so the **arrow and the math disagree** today.

**Fix:** make the wind effect **per-batter and directional** — figure out *where each batter hits his HRs* (his spray), then project the game's full wind vector onto that direction.

## 2. Scope

- **HR prop only (v1).** Total Bases keeps its current dampened CF-wind for now (noted as a fast-follow).
- Runs/RBI/HRR unaffected (weather not modeled there).
- New **spray data layer** (backfill + fold) is part of this build — we do NOT wait for an organic cache rebuild.

## 3. The spray engine

### 3a. Three spray "scouts" (per batter, 3-season pooled)
From Statcast batted-ball data (hit location + launch angle + event), compute each batter's **pull tendency** at three resolutions:
- **Overall** — pull share over *all* batted balls.
- **Air-ball** — pull share over *fly balls / liners* (launch angle ≥ ~10°).
- **HR** — pull share over *home runs*.

"Pull share" uses spray angle from `hc_x/hc_y` (home plate ≈ (125.42, 198.27)); sign flipped by handedness so "pull" = LF for RHB, RF for LHB.

### 3b. Combine the 3 into one `his_spray` (relevance × confidence weighted vote)
For each scout: `confidence = n/(n+K)`, `vote = relevance × confidence`.
```
his_spray = Σ(vote_i · pull%_i) / Σ(vote_i)
```
| Scout | relevance | K (half-trust) |
|---|:--:|:--:|
| Overall | 1.0 | 120 batted balls |
| Air-ball | 1.5 | 100 fly balls |
| HR | 2.0 | 15 homers |

(If a batter has zero spray data, `his_spray` is undefined → Stage 3c gives it weight 0, so it never matters.)

### 3c. Blend with handedness (sample dial, capped)
```
w = min(0.70, n_total / (n_total + 150))         # n_total = his pooled batted balls
final_pull = (1 − w)·HAND_DEFAULT_PULL + w·his_spray
```
- `HAND_DEFAULT_PULL = 0.40` (league-average pull rate — the no-data fallback, aimed at his pull field).
- Cap **0.70** → handedness keeps a permanent 30% floor; reached at n≈350, so established hitters sit at 70/30; rookies/call-ups lean handedness.

Spray is a **stable physical trait** (like park/handedness), so `final_pull` is the **same across Current/Blend/History** weightings — it is NOT neutralized in the twins (unlike recent form).

## 4. Directional wind math

### 4a. Pull% → HR-field bearing
Map `final_pull` to a bearing relative to CF: more pull → bearing rotates toward the batter's pull **corner**, less pull → toward center.
```
pull_corner_offset = 45°            # LF corner ≈ 45° left of CF for RHB (mirror for LHB)
hr_field_deg_rel_cf = sign(hand) · pull_corner_offset · pull_lean
```
where `pull_lean` scales league-average pull (0.40) → 0 and full pull (1.0) → 1 (so a 0.40-pull hitter sits partway toward his corner, a 0.70-pull hitter much closer). `sign(hand)`: RHB = toward LF (−), LHB = toward RF (+).

### 4b. Project the wind onto the HR-field bearing
We already compute the wind's direction of travel relative to CF (`wind_dir_rel_cf`). The directional wind-out is the wind speed times the cosine of the angle between **where the wind blows** and **the batter's HR field**:
```
wind_out_dir = wind_speed_mph · cos( wind_to_deg_rel_cf − hr_field_deg_rel_cf )
```
This **replaces** `wind_out_to_cf` as the input to `weather_hr_multiplier` **for HR rows**. When `final_pull` = league average and the wind blows to CF, it reduces to today's behavior (continuity). A LF-out wind now yields positive `wind_out_dir` for a RHB pull hitter (the fix), and negative if it blows in to his field.

### 4c. Feeds the existing multiplier
`weather_hr_multiplier(wind_out_dir, temp_f, dome)` — unchanged formula, new directional input. Per-batter now (each batter in a game can get a different wind_out_dir).

## 5. New data layer: the spray cache

- **`fetch.batter_spray(player_id, season)`** — pulls Statcast batted balls keeping `events, launch_angle, hc_x, hc_y, stand`; returns per-season counts: `{overall_n, overall_pull, air_n, air_pull, hr_n, hr_pull}` (pull = count on the pull side).
- **Cache** `bat-spray-{pid}-{year}` via `get_or_compute` (small summary, not raw events). Pooled over current + 2 prior seasons.
- **One-time backfill** — `model/backfill_spray.py` warms 3 seasons for all rostered batters (run off-budget/locally, like `backfill_history.py`; chunky pull).
- **Incremental fold** — the daily run refreshes the current-season spray cache (spray is stable, so a daily/periodic refresh is cheap; reuse the existing daily fold cadence). Prior seasons are frozen.
- Leaves the existing `bat-events` cache untouched.

## 6. Wiring
- `model/profiles.py` `batter_profile_from_events` (or `make_profile_fns`) attaches `spray_pull` (= `final_pull`) + `spray_n` to each batter profile, computed via the spray engine from the spray cache + handedness.
- `model/weather.py` gains `wind_out_directional(wind_speed, wind_from_deg, cf_bearing_deg, hr_field_deg_rel_cf)`.
- `model/pipeline.py` `build_hr_rows` computes each batter's `hr_field_deg_rel_cf` from `spray_pull` + handedness, calls `wind_out_directional`, and passes the result into `weather_hr_multiplier` (replacing the per-game `wind_out_to_cf` for HR). Row keeps `wind_out_mph` = the directional value for display.

## 7. Recorder / grader
- Archive the new `spray_pull` factor for later "did it help?" analysis — add `spray_pull` (+ `_hist`, though identical) to `_FACTOR_KEYS`. `weather_mult` is already archived. Grader auto-grades (HR outcomes vs the new probabilities).

## 8. Constants (seeds — tunable from grader data; sign-off)
| Constant | Value |
|---|---|
| Relevance overall / air / HR | 1.0 / 1.5 / 2.0 |
| Confidence K overall / air / HR | 120 / 100 / 15 |
| Handedness dial K | 150 |
| Handedness cap | 0.70 |
| `HAND_DEFAULT_PULL` | 0.40 |
| Air-ball launch-angle threshold | 10° |
| Pull-corner offset | 45° |
| Pooling window | 3 seasons |

## 9. Testing (TDD)
- Spray angle → pull/oppo classification by handedness (RHB negative-angle = pull).
- Weighted vote: relevance×confidence; HR dominates only at high HR sample; zero-data → weight 0.
- Handedness dial: 0→0%, 150→50%, 350+→70% cap; default pull 0.40.
- `wind_out_directional`: league-pull + CF wind ≈ old `wind_out_to_cf` (continuity); LF-out wind → positive for RHB pull hitter, negative when blowing in.
- Integration: a strong RHB pull hitter with LF-out wind gets an HR boost the old model missed; a center/oppo hitter gets less; thin-sample rookie ≈ handedness behavior.
- Full suite green (HR baselines that pinned the old CF-wind updated; note in commit).

## 10. Future refinements
- Extend directional wind to Total Bases (XBH).
- Recency-weight the 3 pooled seasons (currently simple pool).
- Per-park, per-field fence distance interactions.
- Tune all §8 constants from grader data.

## 11. Sign-off
Model-math change **+ new data layer** — the biggest build of this set. Build via spec → plan → SDD; the one-time backfill runs off-budget; preview before prod.
