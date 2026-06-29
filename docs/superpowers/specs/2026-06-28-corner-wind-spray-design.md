# Corner/Pull-Field Wind via Per-Batter Spray (Design)

**Date:** 2026-06-28
**Status:** Design — approved in brainstorm; awaiting spec review
**Author:** brainstorm with user, 2026-06-28

---

## 1. Motivation / how we got here

The HR weather model only credits the wind component blowing **straight to center field** (`wind_out_to_cf` = cosine toward CF). A wind blowing out to **left or right field** is ~perpendicular to center → `cos(90°)≈0` → treated as **neutral**. And handedness/spray is never consulted — wind is computed **once per game**, shared by all batters.

But a crosswind out to a corner genuinely **carries balls out** to that corner. A hitter whose batted balls go where the wind is blowing out gets a real HR boost we currently miss (and a penalty when it blows in). The website already draws the true wind-direction arrow, so the **arrow and the math disagree** today.

**Fix:** make the wind effect **per-batter and directional** — figure out the batter's **spray distribution** (how often he hits to pull / center / oppo), then weight the game's full wind vector across all three field directions.

## 2. Scope

- **HR + Total Bases (v1).** HR gets the **full** directional wind; TB gets it **dampened on its extra-base components** (doubles/triples), exactly where TB already applies dampened weather. Singles stay weather-neutral.
- **Hits prop — effectively weather-neutral.** Honest nuance: the small **HR slice** inside the Hits outcome vector already carries weather today; with this change that sliver becomes *directional* too — negligible and pre-existing (singles/doubles untouched), not a new effect.
- Runs/RBI/HRR unaffected (weather not modeled there).
- New **spray data layer** (backfill + fold) is part of this build — we do NOT wait for an organic cache rebuild.
- **Graceful before backfill:** until the one-time spray backfill runs, every batter has n=0 → falls back to the handedness default → which *already* gives directional corner-wind credit (better than today's CF-only). Feature helps from day one; the backfill just personalizes it.

## 3. The spray engine

### 3a. Three spray "scouts" — each a pull/center/oppo distribution (3-season pooled)
From Statcast batted-ball data (hit location + launch angle + event), compute the batter's spray **distribution across three fields** at three resolutions:
- **Overall** — over all batted balls.
- **Air-ball** — over fly balls / liners (launch angle ≥ ~10°).
- **HR** — over home runs.

Each scout returns `{pull, center, oppo}` shares (sum to 1). Field is classified from **spray angle** (`hc_x/hc_y`, home plate ≈ (125.42, 198.27)) into thirds of fair territory, sign-flipped by handedness so **pull = LF for RHB, RF for LHB** (and oppo the mirror).

**Switch hitters:** Statcast tags the batting side (`stand`) per ball, so split a SW hitter's spray into his **lefty-side** and **righty-side** samples; use the side matching tonight's pitcher (bats L vs RHP, R vs LHP) with that side's handedness default.

### 3b. Combine the 3 scouts into one `his_spray` distribution (relevance × confidence vote)
For each scout: `confidence = n/(n+K)`, `vote = relevance × confidence`. Blend **each field share** with the same votes:
```
his_spray[field] = Σ(vote_i · share_i[field]) / Σ(vote_i)   for field in {pull, center, oppo}
```
| Scout | relevance | K (half-trust) |
|---|:--:|:--:|
| Overall | 1.0 | 120 batted balls |
| Air-ball | 1.5 | 100 fly balls |
| HR | 2.0 | 15 homers |

(Zero spray data → `his_spray` undefined → 3c gives it weight 0, so it never matters.) The result is renormalized to sum to 1.

### 3c. Blend with the handedness default (sample dial, capped)
```
w = min(0.70, n_total / (n_total + 150))                       # n_total = pooled batted balls
final[field] = (1 − w)·HAND_DEFAULT[field] + w·his_spray[field]  # per field, then renormalize
```
- `HAND_DEFAULT = {pull 0.40, center 0.35, oppo 0.25}` — the league-average spray distribution, **computed from data** (seed shown), oriented to the batter's pull/oppo sides by handedness. (Replaces the earlier single 0.40-pull scalar — center & oppo now carry their own weight.)
- Cap **0.70** → handedness keeps a permanent 30% floor; reached at n≈350, so established hitters sit at 70/30; rookies/call-ups lean handedness.
- `final` is a **distribution** (pull/center/oppo, sums to 1).

Spray is a **stable physical trait** (like park/handedness), so `final` is the **same across Current/Blend/History** weightings — NOT neutralized in the twins (unlike recent form).

## 4. Directional wind math (weighted over all three fields)

### 4a. Field bearings (relative to CF)
| Field | RHB | LHB |
|---|:--:|:--:|
| Pull corner | −45° (LF) | +45° (RF) |
| Center | 0° | 0° |
| Oppo corner | +45° (RF) | −45° (LF) |

**⚠️ Angle-convention reconciliation (must get right):** the existing `wind_dir_rel_cf` returns the wind's travel direction as **0=out to CF, 90=RF, 180=in, 270=LF**. The field bearings above use **∓45° (− = LF, + = RF)**. The implementation MUST convert both to a single convention before the `cos(...)` — a sign slip here would *invert* the wind effect. Add a test pinning "wind out to LF → positive wind_out for a RHB pull hitter."

### 4b. Wind-out, weighted by where he hits
Using the wind's direction of travel relative to CF (`wind_to_deg_rel_cf` from `wind_dir_rel_cf`):
```
wind_out_dir = final[pull]   · wind_speed·cos(wind_to − pull_bearing)
             + final[center] · wind_speed·cos(wind_to − 0)
             + final[oppo]   · wind_speed·cos(wind_to − oppo_bearing)
```
This **replaces** `wind_out_to_cf` as the input to `weather_hr_multiplier` for HR rows. A league-average distribution with a CF wind ≈ today's behavior (continuity). A wind out to **any** field now helps the batters who hit there — **pull, center, OR oppo** — and hurts when it blows in. (This is the fix for the earlier single-pull% gap: oppo/spray hitters and oppo-field winds are now credited.)

### 4c. Feeds the existing multiplier
`weather_hr_multiplier(wind_out_dir, temp_f, dome)` — unchanged formula, new directional + per-batter input.

**Platoon and wind STACK:** the platoon edge (e.g., LHB vs RHP) is a *separate, existing* multiplier (`hr_platoon_mult`) on the HR rate; the directional wind is its own multiplier (`weather_mult`). Both are applied in `hr_probability`, so a LHB-vs-RHP pull hitter with wind out to right field gets **both** boosts, multiplied together. (Platoon = how likely the HR; wind = the carry. Independent machines.)

## 5. New data layer: the spray cache

- **`fetch.batter_spray(player_id, season)`** — pulls Statcast batted balls keeping `events, launch_angle, hc_x, hc_y, stand`; returns per-season **field counts** for each scout: `{overall:{pull,center,oppo,n}, air:{...}, hr:{...}}`.
- **Cache** `bat-spray-{pid}-{year}` via `get_or_compute` (small summary, not raw events). Pooled over current + 2 prior seasons.
- **One-time backfill** — `model/backfill_spray.py` warms 3 seasons for all rostered batters (run off-budget/locally, like `backfill_history.py`; chunky pull).
- **Incremental fold** — the daily run refreshes the current-season spray cache (spray is stable → cheap; reuse the existing daily fold cadence). Prior seasons frozen.
- Leaves the existing `bat-events` cache untouched.

## 6. Wiring
- `model/profiles.py` (or `make_profile_fns`) attaches `spray = {pull,center,oppo}` (= `final`) + `spray_n` to each batter profile, via the spray engine over the spray cache + handedness.
- `model/weather.py` gains `wind_out_directional(wind_speed, wind_from_deg, cf_bearing_deg, spray, hand)` implementing §4b.
- `model/pipeline.py` `build_hr_rows` calls `wind_out_directional` per batter and passes the result into `weather_hr_multiplier` (replacing the per-game `wind_out_to_cf` for HR). Row keeps `wind_out_mph` = the directional value for display.
- **TB (and the HR slice of any prop):** `_batter_outcome_vector` computes the same per-batter directional `weather_mult` from `wind_out_directional` and uses it where it already applies weather — **full** on the HR component (p4), **dampened** (existing `_XBH_WEATHER_DAMPEN`) on doubles/triples (p2/p3). Singles (p1) stay weather-neutral. This covers Total Bases and the (negligible) HR slice of Hits with the same directional value — one wind computation used everywhere weather appears.

## 7. Recorder / grader
- Archive the new spray for later "did it help?" analysis — add `spray_pull` (the final pull share) to `_FACTOR_KEYS`; `weather_mult` is already archived. Grader auto-grades (HR outcomes vs new probabilities).

## 8. Constants (seeds — tunable from grader data; sign-off)
| Constant | Value |
|---|---|
| Relevance overall / air / HR | 1.0 / 1.5 / 2.0 |
| Confidence K overall / air / HR | 120 / 100 / 15 |
| Handedness dial K | 150 |
| Handedness cap | 0.70 |
| `HAND_DEFAULT` distribution | pull 0.40 / center 0.35 / oppo 0.25 (compute from league data) |
| Air-ball launch-angle threshold | 10° |
| Field bearings | pull ∓45° · center 0° · oppo ±45° (by hand) |
| Pooling window | 3 seasons |

## 9. Testing (TDD)
- Spray angle → pull/center/oppo classification by handedness (RHB pull = LF, oppo = RF; mirror LHB).
- Weighted vote per field; HR dominates only at high HR sample; zero-data → weight 0; shares renormalize to 1.
- Handedness dial: 0→0%, 150→50%, 350+→70% cap; default distribution 40/35/25.
- `wind_out_directional`: league-avg distribution + CF wind ≈ old `wind_out_to_cf` (continuity); wind out to oppo field → **positive** for an oppo-heavy hitter (the gap this fixes); wind blowing in → negative.
- Stacking: a LHB-vs-RHP pull hitter with RF-out wind gets platoon × wind (both >1).
- Integration: strong RHB pull hitter + LF-out wind → boost the old model missed; oppo hitter + RF-out wind → boost; center hitter → mostly CF wind; thin-sample rookie ≈ handedness behavior.
- Full suite green (HR baselines that pinned old CF-wind updated; note in commit).

## 10. Future refinements
- Extend directional wind to Total Bases (XBH).
- Recency-weight the 3 pooled seasons (currently simple pool).
- Finer field resolution than 3 buckets; per-park fence-distance interactions.
- Tune all §8 constants from grader data.

## 11. Sign-off
Model-math change **+ new data layer** — the biggest build of this set. Build via spec → plan → SDD; the one-time backfill runs off-budget; preview before prod.
