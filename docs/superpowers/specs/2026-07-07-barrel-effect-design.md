# Barrel Edge — "b effect" (barrel nudge on the real props) — Design Spec

- **Date:** 2026-07-07
- **Branch:** `feat/barrel-edge`
- **Status:** Design agreed with user (brainstorm 2026-07-07). Ready for implementation plan.
- **Parent spec:** `2026-07-06-barrel-edge-design.md` (this is the Barrel Effect toggle, §8 there). Recipe = parent §4a (LOCKED).
- **Sign-off:** MATH change → user okays the seed numbers (the ±20% cap especially) on before/after examples before it goes live ([[math-changes-need-signoff]]).

---

## 1. Goal

Make barrel actually move the props the user bets. When **b effect is ON**, each batter/pitcher prop's **normal probability gets nudged by barrel** — a good barrel matchup pushes it up, a bad one down — as a **capped, sample-shrunk multiplier** in the existing factor chain. OFF = today's numbers. This is the "missing edge" applied to real picks (and it fills the board's blank driver columns as a bonus).

---

## 2. Decisions locked (with the user)

1. **Capped nudge, ±20% seed** — barrel's combined effect on a prop is at most ±20% (a multiplier in `[0.80, 1.20]`). The grader tunes it down/up later; the user signed off on 20% as the start. (Chosen over 15% deliberately: barrels are a strong signal; start with real signal, grader reins in.)
2. **Sample-size shrink** — the nudge scales with how much data backs the barrel rate (batted-ball count). Thin-sample bats get only a fraction of the swing; well-sampled bats get the full ±20%. (Same trust idea as Kasper's name-color flag.)
3. **One combined nudge per prop, NOT per stat** — the prop's several barrel-recipe factors blend into **one** `barrel_mult` (weighted, barrels leading), then that single multiplier is capped at ±20% and applied. NOT ±20% per barrel stat.
4. **Multiplies into the existing chain** — `barrel_mult` stacks alongside park/weather/pitcher/platoon/BvP exactly like they do (the model multiplies factors; this is unchanged). Displayed as its own "🛢️ Barrel" row in "what's driving it" (its own ± percent).
5. **Per-prop recipe** = the locked matrix (parent §4a): HR = full pantry; Hits = ZoneFit+contact; TB = contact+power; Runs/RBI/HRR contact+relevant power; Ks = pitcher CSW/SwStr + batter contact. Each prop's `barrel_mult` is built from ITS recipe factors only.
6. **OFF = today's math**, untouched.

### SCOPE DECISIONS (locked)
- **Timeframe = FULLY MATCHED from day one (user chose "B", 2026-07-07).** Build the **3-season blended barrel FIRST** (extend `blended_batter_profile`/`blended_pitcher_profile` with `barrel_metrics` across the 3 seasons, Marcel-weighted), so Current→current barrel, History→3yr blended barrel, Blend→blend. This is the first task of the plan; b effect then applies timeframe-matched to both the current probs and the `_hist` twins.
- **Props = HR first (implementation decomposition).** The machinery (blended barrel + `barrel_effect_mult` + the `_beff` twin pattern + recorder + frontend toggle + the 🛢️ Barrel display row) is proven end-to-end on **HR** (barrel's home turf), with real before/after HR numbers for sign-off. The other props (Hits/TB/Runs/RBI/HRR/Ks) are a **fast-follow plan** reusing the exact same machinery + their locked recipes. *(This keeps the first plan testable; flag at execution — if you'd rather do all props in one pass, say so.)*

---

## 3. The barrel-effect multiplier (mechanics)

New pure helper, e.g. `model/barrel_effect.py`:

`barrel_effect_mult(hitter, pitcher, prop, *, cap=0.20, n_stable=40) -> float` → a multiplier in `[1-cap, 1+cap]`.

Steps (all constants are grader-tunable SEEDS):
1. **Per-side quality delta:** for the prop's recipe factors, scale each hitter stat to a signed deviation vs league (like the Prop Score's anchors, but centered so league-average = 0), weight them (barrels lead), sum → hitter delta `dH`. Do the same over the pitcher's `*_allowed` recipe factors → pitcher delta `dP`. (Ks: pitcher CSW/SwStr side leads; batter contact.)
2. **Combine:** `d = w_h·dH + w_p·dP` (seed 0.6/0.4), a signed "barrel goodness" for this matchup.
3. **Sample shrink:** `trust = min(BBE / n_stable, 1.0)` where BBE = the hitter's batted-ball count (barrel stabilizes ~40–50 BBE). `d *= trust`. (Pitcher side can use its own BBE-allowed trust.)
4. **Cap + to multiplier:** `mult = 1 + clamp(d, -cap, +cap)`.
5. Neutral (1.0) when no barrel data.

Reuses the same league anchors / weights philosophy as `prop_score.py` (barrels lead), kept as named seed constants.

---

## 4. Twin computation (barreled + un-barreled)

Barrel Effect ON/OFF must both be available without recomputing the board twice at view time — mirror the existing `_hist` twin pattern:
- The pipeline computes each prop's **normal** probability (as today) AND a **barreled** probability (`× barrel_mult`), stored as a twin field, e.g. `probability_beff` (HR) / `p_ge1_beff` … per prop.
- `barrel_mult` itself is stored on the row (for the "🛢️ Barrel" display row + the grader).
- This is additive: the normal `probability` is unchanged; the `_beff` twin is new.
- Interacts with the existing `_hist` twins: v1 applies the barrel nudge to the **current-mode** probs (and, when blended barrel lands, to the hist twins too).

---

## 5. Frontend

- The **b effect toggle** (already wired to `barrelEffect` state) makes `web/lib/weighting.ts` (`toBoardRows`/`pickN`) select the **`_beff`** probability when ON, the normal one when OFF — for the **Props/Board section** (the real bet numbers), not just the Boards heatmap.
- The player card's "what's driving it" gains a **🛢️ Barrel** `FactorBar` row (its own ± percent from `barrel_mult`), shown only when b effect is ON.
- No layout changes beyond the new row; OFF renders exactly as today.

---

## 6. Recorder & grader

- **Recorder** (`archive.py`) already captures all row fields → add `barrel_mult` + the `_beff` prob to `_FACTOR_KEYS`/thresholds so both the barreled and un-barreled probabilities are archived every day.
- **Grader** grades BOTH (no new logic — it grades whatever probs are stored), so we can measure **did barreled beat un-barreled?** and tune the ±20% cap from real results. This is the whole point of storing both.

---

## 7. Seeds + sign-off

Seeds (all grader-tunable, named constants): `cap = 0.20`, hitter/pitcher balance `0.6/0.4`, `n_stable = 40`, the per-factor weights (barrels lead) + league anchors. **Sign-off gate:** before merging/surfacing, produce a **before/after table** (a set of real players' prop probabilities with b effect OFF vs ON) for the user to okay — same as the Prop Score smoke.

---

## 8. Non-goals / later

- **Blended (3yr) barrel** for true timeframe-matching — flagged fast-follow (v1 = current barrel all timeframes).
- **Pitcher-engine upgrade** (CSW/SwStr into the *normal* prob math) — separate build; b effect's Ks recipe uses pitcher CSW/SwStr **only if available**, else falls back to the current pitcher K factor (CSW/SwStr aren't computed yet → Ks barrel nudge is contact/whiff-light in v1).
- **b weight per-prop probabilities** — the barrel-dominant replica; separate.
- No change to the existing factor-combination math (multiply chain) or any OFF-state number.
