# Barrel Edge — b-weight "Prop Score" — Design Spec

- **Date:** 2026-07-06
- **Branch:** `feat/barrel-edge`
- **Status:** Design agreed with user (brainstorm 2026-07-06). Ready for implementation plan.
- **Parent spec:** `2026-07-06-barrel-edge-design.md` (this is the b-weight scoring sub-piece).
- **Sign-off:** math build — user okays the seed numbers before it goes live ([[math-changes-need-signoff]]).

---

## 1. Goal

Build the **Prop Score** — the single 0–100 headline number the Boards page shows per hitter, answering *"how good is his home-run spot tonight?"* This is our replica of Kasper's **kHR** / Barrel Lab's **BarrelScore**, and it's what makes the mock Boards show *real* numbers (it's the missing piece the Bridge waits on).

**Scope:** ONLY the Prop Score (the board headline). It does NOT include the per-prop **probabilities** (Barrel Effect / Barrel Weight per-prop math — separate later builds, see parent spec §4a recipe) and does NOT change any existing prop probability.

---

## 2. Decisions locked (with the user)

1. **One universal HR-focused score**, not per-prop. It's a 0–100 ranking, so its range reads fine everywhere. Tradeoff accepted: a contact-only hitter scores low on it even if he's a good *hits* play — for those, the reader uses the contact *columns* (ZoneFit, low SwStr), not the headline. Name shown on the board = **"Prop Score"**; "HR-focused" describes how it's built.
2. **Barrels lead** — pulled-barrels + barrel-rate carry the most weight; the rest support. Applies to **both** the hitter side and the pitcher side.
3. **Two barrel-led halves, combined (the matchup):** hitter's barrel quality × how many barrels tonight's pitcher allows. This is what makes the score change nightly (the opponent changes).
4. **+ Split booster** — a favorable L/R (platoon) matchup nudges the score up a little; a bad one dings it. (Barrel Lab's rule: good score + good split beats a higher score with a bad split.)
5. **Uses PURE Phase-0 barrel data** (raw barrel-allowed, no blending) — barrel dominates by design here. This is distinct from the pitcher-engine upgrade (which blends barrel into the *normal* prob math; separate build).
6. **Seed now → grader tunes later** — all weights (per-stat, hitter-vs-pitcher balance, Split size, 0–100 calibration) start as sensible seeds and get tuned from recorded results.

---

## 3. Inputs (all available from Phase 0)

**Hitter (per batter profile):** `pulled_barrel_rate`, `barrel_rate` (lead) · `hardhit_rate`, `sweetspot_rate`, `fb_rate`, `la_mean`, `xwobacon`, `hrfb_rate` (support). Plus `iso` (derivable from season_1b/2b/3b/hr).

**Pitcher — tonight's opposing starter (per pitcher profile, `*_allowed`):** `pulled_barrel_rate_allowed`, `barrel_rate_allowed` (lead) · `hardhit_rate_allowed`, `fb_rate_allowed` (support).

**Split:** the existing platoon edge (batter hand vs pitcher throwing hand) — reuse the model's platoon logic (`hr_platoon_mult`, +6% / −5% seed).

**NOT used** (on purpose): CSW%/SwStr%, contact-allowed, xwOBA (those feed Ks/Hits per-prop probabilities, not this HR score); park/weather/BvP (b-weight rests those — parent spec).

---

## 4. How the score is computed (shape; exact constants in the plan)

Three-step build (all constants are grader-tunable seeds):

1. **Hitter power index (0–100):** convert each hitter barrel stat to a percentile-ish 0–1 vs the league, weight them (pulled-barrel + barrel-rate highest), average → `H`.
2. **Pitcher vulnerability index (0–100):** same over the pitcher's `*_allowed` barrel stats (higher = more barrels allowed = more hittable) → `P`.
3. **Combine + Split:** `matchup = w_h·H + w_p·P` (seed `w_h`/`w_p` e.g. 0.6/0.4), then apply the Split booster as a small multiplier (seed ±~5%, capped), and scale to a clean **0–100 Prop Score**.

Seeds are explicit, documented, and adjustable; the grader tightens them once results accumulate. No probability is produced or changed — this is a ranking/reading number.

---

## 5. Where it lives (architecture)

- **New module `model/prop_score.py`** — pure function `prop_score(hitter_profile, pitcher_profile, platoon_edge) -> float` (0–100). Isolated, unit-testable, no I/O. Seeds/weights as named module constants.
- **League-context** for the percentile scaling: seed with fixed league anchors (like the existing spray `HAND_DEFAULT` pattern) so it's deterministic and testable; refine from a league pull later.
- **Surfaced** on the board rows (the Bridge task wires it to the frontend Boards). Recorder captures it so the grader can evaluate + tune (no grader logic change — it records what's on the row).
- Does NOT touch `projections.py` / `pipeline.py` probability math.

---

## 6. Testing

- Unit tests on `prop_score()`: a strong hitter × barrel-friendly pitcher scores high; strong hitter × barrel-stingy pitcher scores lower; the Split booster moves it the right direction; output always clamped 0–100; missing/zero inputs degrade gracefully (no crash, sensible low score).
- A real-data smoke check (like Phase 0's Judge check): compute the Prop Score for a known elite bat in a good matchup and confirm it lands high and sensible.

---

## 7. Non-goals / later

- Per-prop probabilities (the recipe → Barrel Effect / Barrel Weight per-prop math). Separate builds.
- Our own "barrel-signal" flag (own name, not "Barrel Signal") — tracker task 6, layered on later.
- Calibrating our thresholds to Barrel Lab's exact tiers — we calibrate to OUR grader over time (his numbers are proprietary).
- Norm-mode / b-effect Prop Score variants — this spec is the b-weight (barrel) Prop Score only.
