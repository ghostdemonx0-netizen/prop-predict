# Barrel Edge — A1: Barrel Effect on All Batter Props — Design Spec

- **Date:** 2026-07-07
- **Branch:** `feat/barrel-edge`
- **Status:** Design (user-approved through plain-language brainstorming this session).
- **Sign-off:** **YES** — this changes real bet numbers. Each prop ships with a before/after smoke for the user to approve. Follows [[math-changes-need-signoff]].

---

## 1. Goal

Extend the capped **Barrel Effect** nudge (the "b effect" toggle, already shipped for HR) to **all six batter props** — HR, Total Bases, Hits, Runs, RBI, HRR — each with its own **locked recipe** and a **graduated cap**. Now that A2 built ZoneFit + SwStr, the recipes are **complete** (contact gate + hard-contact both sides). Also **finish HR's own recipe** by folding in ZoneFit + SwStr (it shipped barrel-power-only). Same machinery as HR: ON → probability × a capped, sample-shrunk, timeframe-matched barrel multiplier stored as a `_beff` twin, selected by the existing frontend toggle. OFF = today's number, untouched.

## 2. Scope

- **In:** HR, Total Bases, Hits, Runs, RBI, HRR (the 6 batter barrel props).
- **Out: Ks** — strikeouts have **no barrel** (pure whiff: CSW%/SwStr%). That whiff signal belongs to the **Universal pitcher engine upgrade** (task #3), not a barrel nudge. Decided with user this session.
- **Layers 1 & 3 unchanged** — base rates + machinery per prop are untouched; barrel only tilts Layer 2. OFF path byte-identical.

## 3. Per-prop recipes (LOCKED — §4a of the parent spec, with this session's corrections)

Factors are a shared pantry; each prop draws a different mix. The **contact pair (ZoneFit + low SwStr%) is on every batter prop** — contact gates all offense. **Barrels lead** on the power props; contact leads on Hits. Exact seed weights live in the **plan** (grader-tuned thereafter).

| Prop | Hitter side (voters) | Pitcher side (voters) | Cap |
|---|---|---|---|
| **HR** | PullBrl, Brl, HH%, SweetSpot, FB, xwOBAcon **+ ZoneFit, low SwStr** | barrel-allowed, HH-allowed, FB-allowed | **±20%** |
| **Total Bases** | Brl, PullBrl, HH%, xwOBAcon, SweetSpot, FB **+ ZoneFit, low SwStr** | barrel-allowed, HH-allowed, hit-allowed | **±20%** |
| **Hits** | ZoneFit, low SwStr, HH%, SweetSpot, xwOBAcon **+ small Brl** | hit-allowed, **HH/barrel-allowed** | **±15%** |
| **Runs** | ZoneFit, low SwStr, xwOBAcon, **own power (Brl, HH%)** + lineup-behind (existing) | hit-allowed (suppression), **HH/barrel-allowed** | **±15%** |
| **RBI** | drive-power (HH%, Brl, xwOBAcon), PullBrl **+ ZoneFit, low SwStr** + lineup-ahead (existing) | barrel-allowed, HH-allowed, hit-allowed | **±20%** |
| **HRR** | HR power + Hits/Runs contact (incl. ZoneFit), dampened | combined (barrel-allowed, HH-allowed, hit-allowed) | **±15%** |

**This session's corrections to §4a:**
- **Hits & Runs pitcher side** now include **hard-contact-allowed (HH-allowed / barrel-allowed)**, not just hit-allowed — mirrors the hitter's HardHit% and matches "hard contact → hits/runs." (§4a had hit-allowed only.)
- **Hits hitter side** gets a **small Brl weight** — a barrel *is* a hit, and the co-located **low-SwStr gate cancels the Gallo trap** (high-barrel-but-whiffy → barrel pushes up, SwStr pushes down → net neutral; high-barrel-and-contact → net up, correctly). Kept small; grader can shrink.

## 4. Graduated caps (locked with user)
- **±20%** — HR, TB, RBI (barrel is the whole story).
- **±15%** — Hits, Runs, HRR (barrel is a *supporting* piece; contact/on-base lead).
- The cap is the **ceiling on the whole combined recipe** (all factors, incl. the small Brl, blend into one nudge, then clamp). Grader dials the internal weights over time.

## 5. Roles (locked, consistent with A2)
- **VOTERS** (feed the nudge): the barrel/contact factors above — Brl, PullBrl, HH%, SweetSpot, FB, xwOBAcon, **ZoneFit, SwStr**, and the pitcher-allowed mirrors.
- **VIEWERS** (display only, NOT voters — avoid double-count): **ISO, full xwOBA, Ball%**. (Full xwOBA → Layer-1 base later; not here.)

## 6. Architecture

Generalize the existing HR-only machinery to be **prop-aware**, reusing every piece already built for HR.

- **`model/barrel_effect.py` — prop-aware recipes.** Replace the single `_HR_HITTER`/`_HR_PITCHER` pair with a `_RECIPES` table keyed by prop (`hr, tb, hits, runs, rbi, hrr`), each holding `{hitter: {...}, pitcher: {...}, cap: float}`. `barrel_effect_mult(hitter, pitcher, *, prop, n_stable=40.0)` selects the recipe and clamps to that prop's cap. Two structural additions:
  - **ZoneFit is a hitter-side MATCHUP factor:** its value is `zone_fit(hitter["zone_dmg"], pitcher["zone_freq"])` (from `model.pitch_metrics`), not a plain profile field. The deviation loop special-cases the `zonefit` key to compute it. Keeps the hitter/pitcher side split intact.
  - **`invert` flag for "lower-is-better" factors:** SwStr (batter whiff) is good when *low*, so its factor entry carries `invert=True` and the deviation sign flips. All other factors stay higher-is-better.
  - Sample-shrink (`bbe/n_stable`) and the barrels-lead weighting philosophy carry over unchanged.
- **Wire each prop's build function** to attach `barrel_mult` + `probability_beff = prob * barrel_mult` to its rows, mirroring the shipped HR path (`build_hr_rows`): the threshold props (Hits, TB) and the run props (Runs, RBI, HRR) each get the same two keys added right after their probability is computed, calling `barrel_effect_mult(..., prop="<prop>")`. `probability` stays untouched (additive).
- **Export twins + recorder:** extend the `_beff` twin attach (history-barreled) and the archive triple to every prop, mirroring the HR twin/recorder already shipped.
- **Frontend:** the toggle + `toBoardRows(..., barrelEffect)` already select `_beff` for HR; generalize the field-pick to every prop (each now has `probability_beff`/`probability_hist_beff`). No new UI — the existing toggle now moves all six.

## 7. Timeframe consistency
Same as HR: the history twin's nudge is computed from the **blended (3-yr) profiles**. NOTE — A2's pitch fields (`zone_dmg`, `zone_freq`, `swstr`) currently live on **live** profiles only; the blended profiles carry barrel but not yet the pitch-level fields. So for **History mode**, ZoneFit/SwStr fall back to neutral until the blended profiles carry them (a small follow-up, flagged in A2). Current/Blend barrel + power factors are fully timeframe-matched today.

## 8. Testing
- Unit tests on `barrel_effect_mult` per prop: recipe weights sum to 1.0 each side; ZoneFit matchup factor moves the nudge; `invert` flips SwStr correctly; each prop clamps to its own cap; neutral 1.0 with no data.
- Per-prop wiring tests: each build function attaches `barrel_mult` + `probability_beff`; `probability` unchanged.
- Full suite green each task.
- **Before/after smoke per prop** (the sign-off artifact): real matchups showing each prop's OFF vs ON number, sanity-checked (power bat up on TB/RBI, contact bat up on Hits, Gallo-type ~neutral on Hits).

## 9. Non-goals
- **Ks** (→ pitcher engine, task #3).
- **b weight** per-prop probabilities (the barrel-dominant mode; separate signed-off build).
- Blended profiles carrying pitch-level fields (small A2 follow-up; History ZoneFit/SwStr neutral until then).
- Marcel-weighting the blend (equal-pool v1).
- The "🛢️ Barrel" driving-it card row + active/context column marking (option B — display follow-up, after A1).
