# Oracle — Barrel Flag Qualifier — Design Spec

- **Date:** 2026-07-07
- **Branch:** `feat/barrel-edge`
- **Status:** Design (approved through plain-language brainstorming this session).
- **Sign-off:** the qualifier is our own new math determining a *visible* flag (not a bet-number change). Ships with a real-data smoke (which bats flag — must be rare + sensible) for the user to okay.

---

## 1. Goal
Replace the placeholder barrel-flag trigger (`Prop Score ≥ 70`) with **Oracle** — our own premium "standout barrel play" qualifier. Structure = **gate + points** (user-approved): a bat must first be a real barrel bat (gate), then earns points from stacked matchup edges; only the top spots flag. The badge (grayed Aperture logo) is already built; this builds its brain. Barrel Lab's "Barrel Signal" tier is the **reference, not a copy** ([[barrel-lab-read-rules]]).

## 2. The qualifier (agreed shape)
- **Gate** — the hitter's OWN barrel quality (hitter-side factors only — NOT the full Prop Score, which already bundles pitcher+platoon → avoids double-count) must clear a bar, AND the sample (`bbe`) must be big enough to trust.
- **Points** (once gated), stacked matchup edges normalized 0–1:
  - **Platoon/split — heavy** (Barrel Lab's most *proven* lesson: score+split beats raw score).
  - **Pitcher barrel-vulnerability — heavy** (tonight's `barrel_mult`).
  - **Recent barrel form — small** (kept as a tiebreaker; noisy, so light).
- **Premium bar** — only the top spots flag (rare = it means something; grader can loosen later).
- All constants are grader-tunable **SEEDS**.

## 3. Formula (v1)
Pure function in `model/oracle.py`. Reuses `barrel_effect._dev` + the `_A` league anchors.

```
quality  = ( Σ w·_dev(hitter[k], _A[k]) over _QUALITY + 1 ) / 2        # 0..1, league-avg 0.5
  _QUALITY = {barrel_rate .35, pulled_barrel_rate .25, hardhit_rate .20, xwobacon .12, sweetspot_rate .08}

gate     = quality ≥ _GATE_MIN (0.60 SEED)  AND  bbe ≥ _MIN_BBE (40 SEED)

platoon_edge = clamp01((platoon_mult − 0.97) / (1.06 − 0.97))          # favorable handedness → 1
matchup_edge = clamp01((barrel_mult  − 1.00) / (1.20 − 1.00))          # positive barrel tilt → 1
form_edge    = clamp01((recent_form_mult − 1.00) / (1.20 − 1.00))      # hot lately → 1
edges    = 0.45·platoon_edge + 0.40·matchup_edge + 0.15·form_edge      # 0..1

oracle_score = 0.5·quality + 0.5·edges                                 # 0..1 (bat quality AND stacked edges)
ORACLE  = gate AND oracle_score ≥ _FLAG_BAR (0.62 SEED)
```
Rationale: an elite bat (high quality) can flag on modest edges; a good-not-elite bat needs the edges to *stack* (platoon + matchup) — exactly the "everything lines up" premium play. Gate keeps it honest (never fires on a non-barrel bat or a thin sample).

- `barrel_mult` = `barrel_effect_mult(hitter, pitcher, prop="hr")` (the HR/power matchup nudge — the pitcher-vulnerability signal).
- `platoon_mult` = `hr_platoon_mult(bats, throws)` (already computed in `_hitter_board`).
- `recent_form_mult`, `bbe`, barrel factors → all on the hitter profile.

## 4. Where it lives
- **`model/oracle.py`** (new) — `oracle(hitter, *, barrel_mult, platoon_mult) -> {"oracle": bool, "oracle_score": float}`. Pure, seed constants, no I/O.
- **`model/export_web.py` `_hitter_board`** — compute `bmult = barrel_effect_mult(b, opp, prop="hr")` (opp present), call `oracle(b, barrel_mult=bmult, platoon_mult=pmult)`, emit `oracle` (1/0) + `oracle_score` into the hitter `stats`.
- **`web/components/spatial/boards/BoardsView.tsx`** — the flag reads `r.stats.oracle === 1` (replace the `trueScore >= BARREL_FLAG_MIN` placeholder; remove that constant). Rename the badge tooltip/aria to **"Oracle — the model's standout barrel call"**.
- **`web/lib/types.ts`** — no change needed (`BoardHitter.stats` is `Record<string, number>`).
- NO change to prop math / probabilities / prop_score.

## 5. Testing
- Unit tests on `oracle`: gate blocks a weak-barrel bat and a thin-sample bat regardless of edges; a gated elite bat with stacked edges flags; a gated bat with poor edges does NOT flag; `oracle_score` in [0,1]; premium bar is respected. Quality-weights sum to 1.0; edge-weights sum to 1.0.
- Boards-payload test: a hitter with strong barrel + good matchup surfaces `oracle: 1`; a league-average one surfaces `oracle: 0`.
- Full suite green.
- **Real-data smoke** (the sign-off artifact): run a real slate, print how many / which bats get the Oracle flag — confirm it's RARE (a few per slate) and the flagged bats are sensible standouts. Tune `_FLAG_BAR`/`_GATE_MIN` if the rate is off.

## 6. Non-goals
- Tiers (one flag for v1, not multiple).
- Auto-tuning the seeds (grader-review later; part of the seed-tracking roadmap item).
- Flag on the player card / other surfaces (board only for v1).
- Changing any bet number.
