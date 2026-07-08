# Universal Pitcher Engine Upgrade — Design Spec

- **Date:** 2026-07-08
- **Branch:** `feat/barrel-edge`
- **Status:** Design (approved through plain-language brainstorming).
- **Sign-off:** **YES — biggest footprint yet.** This changes the **base** pitcher rates for *every* prop (always-on, not a toggle). Ships with a real-data before/after smoke on real pitcher names for the user to okay. [[math-changes-need-signoff]]

---

## 1. Goal
Make each pitcher's rate that feeds the props **smarter** by blending his **raw outcome rate** with his **barrel-implied rate**, sample-weighted. The blend **is regression** — but toward the pitcher's *own barrel-implied rate* instead of the dumb league average. Barrel gets more weight ("votes") for **luck-heavy** rates (HR) than for **clean** ones (Ks). This is the **base** engine (both Barrel-Effect ON and OFF run on it) and it finally makes **Ks** barrel-aware (the piece deferred from A1).

## 2. The blend (the whole mechanism)
Today each rate is `regress(made, pa, LEAGUE_rate, prior_votes)` = a weighted average of the pitcher's observed rate and a prior, weighted by his sample (`pa`) vs `prior_votes`. **The upgrade: swap the prior from `LEAGUE_rate` to a `barrel_implied_rate`.**

```
implied_rate = LEAGUE_rate × clamp(pitcher_barrel_signal / LEAGUE_barrel_signal, 0.5, 2.0)
blended_rate = (made + implied_rate × VOTES) / (pa + VOTES)
             = observed_rate·[pa/(pa+VOTES)] + implied_rate·[VOTES/(pa+VOTES)]
```
- **Sample-aware falls out for free:** thin sample (small `pa`) → the barrel-implied prior leads; deep sample → the observed rate leads. `pa = VOTES` → 50/50.
- **`VOTES` per rate = the one knob** (bigger = barrel-generous). Seeds grounded in stat-stabilization research + the model's existing regression constants.

## 3. Per-rate mapping (which barrel signal, how many votes)
| Pitcher rate | Barrel signal (his) | League baseline (SEED) | VOTES (SEED) | Full-season lean |
|---|---|---|---|---|
| **`k_per_bf`** (Ks) | **SwStr%** (`swstr`) | `_LG_SWSTR = 0.11` | **`_VOTES_K = 175`** | raw-heavy (~80/20) |
| **`hit_allowed_rate`** (Hits/TB/Runs/RBI) | **HardHit-allowed** (`hardhit_rate_allowed`) | `_LG_HARDHIT = 0.40` | **`_VOTES_HIT = 350`** | ~65/35 |
| **`hr_allowed_rate`** (HR) | **barrel-allowed** (`barrel_rate_allowed`) | `_LG_BARREL = 0.08` | **`_VOTES_HR = 700`** | ~50/50 (barrel-generous) |

`implied_rate = LEAGUE_rate × clamp(signal / league_signal, 0.5, 2.0)`: a pitcher who whiffs at 1.5× league SwStr gets an implied K rate 1.5× league, etc. The 0.5–2.0 clamp guards against thin/extreme barrel signals. Signal `None`/missing → implied = league (graceful).

## 4. Architecture
- **New `model/pitcher_engine.py`** (pure): `barrel_blended_rate(made, pa, *, signal, league_rate, league_signal, votes) -> float` (the §2 formula) + `_implied(...)` helper + the `_LG_*` / `_VOTES_*` SEED constants.
- **`model/profiles.py`** — in BOTH `pitcher_profile_from_events` and `blended_pitcher_profile`: compute the barrel/pitch metrics FIRST (into locals), then set the three rates via `barrel_blended_rate(...)` instead of `regress(..., LEAGUE_*, _*_R)` / raw. (`k_per_bf`, `hit_allowed_rate`, `hr_allowed_rate`.)
- **`model/projections.py` `pitcher_hr_mult`** — today it **re-regresses** `hr_allowed_rate` toward league (`reg = (hr_allowed_rate*bf + league_hr_rate*regression_bf)/(bf+regression_bf)`). Since the profile now does the smart blend, **drop that internal regression** — use `reg = hr_allowed_rate` directly (keep the → multiplier conversion + the [0.75, 1.3] clamp). This prevents double-regressing HR (barrel-blend in profile then diluted back toward league in the consumer). Signature unchanged → callers unaffected.
- **K/hits consumers** (`expected_strikeouts`, `pitcher_suppression_mult`, `matchup.hit_prob`) — NO change; they read the (now smarter) profile rate directly.
- The `regress()` helper stays for the HITTER rates (k_rate, hit_rate) — those are NOT part of this upgrade (batter side untouched).

## 5. Roles / scope
- **In:** the 3 pitcher rates (`k_per_bf`, `hit_allowed_rate`, `hr_allowed_rate`) → all 7 props' pitcher side. Always-on base engine.
- **Out:** batter rates; the barrel Effect toggle (separate); the barrel signals as *display* (already shown). No hitter-side change.
- **League baselines are SEEDs** → they join the data-driven-anchors roadmap item (compute from live data later). VOTES are grader-tunable seeds.

## 6. Recording / grading
**Automatic** — the upgrade improves the **base probability** the recorder already archives and the grader already grades. No new recorder/grader wiring (unlike Oracle). Proving it *beat* the old engine = the before/after factor-analysis, once data accrues.

## 7. Testing
- Unit tests on `barrel_blended_rate`: thin sample → leans implied; deep sample → leans observed; `pa = votes` → 50/50 of observed vs implied; missing signal → league; ratio clamp holds; per-rate VOTES produce the intended lean.
- Profile tests: the three pitcher rates now reflect the barrel blend (a high-barrel-allowed thin-sample pitcher gets a higher `hr_allowed_rate` than raw; a high-SwStr pitcher a higher `k_per_bf`).
- `pitcher_hr_mult` no longer double-regresses (given a pre-blended rate, returns the direct multiplier).
- Full suite green (existing tests that pin specific pitcher rates will shift — recompute + re-pin, don't weaken).
- **Before/after smoke** (sign-off): real pitchers (an ace, a thin-sample reliever/callup, a homer-prone arm) — print old vs new `k_per_bf` / `hit_allowed_rate` / `hr_allowed_rate` and confirm the shifts are sensible (thin-sample guys stop being coin-flips; barrel-vulnerable arms read homer-prone sooner).

## 8. Non-goals
- Hitter-side rates. · b weight mode. · Auto-tuning the VOTES (grader later). · Making the league baselines data-driven (roadmap). · Any UI change.
