# Barrel Edge — Design Spec

- **Date:** 2026-07-06
- **Branch:** `feat/barrel-edge`
- **Status:** Design approved in brainstorm (2026-07-05 → 06). Ready for phased implementation plans.
- **Roadmap:** see the 🛢️ BARREL EDGE bucket in `master-roadmap.md`.

---

## 1. Goal

Add a **barrel-quality-first** way of scoring players — how hard/ideally a hitter squares the ball, and how much the opposing pitcher allows it — the approach proven to win by **Kasper** (kasperbaseball.win) and **Barrel Lab** (@BarrelLabMLB_). This is the site's "missing edge."

Barrel does **three jobs**, which must stay conceptually separate:
- **Inputs** — the batted-ball factors + pitcher-allowed profile + ZoneFit.
- **Weighting** — a barrel-dominant scoring philosophy (the Kasper/Barrel Lab replica).
- **Display** — dense heatmap boards.

**Source note:** The two YouTube videos could not be transcribed (YouTube blocks scraping; Kasper's app is login-gated; Barrel Lab's numbers live in a linked Google Doc). All competitor detail below is **confirmed from user screenshots** of both boards. The exact weights/formulas remain proprietary — a future refinement source is the Google Doc linked in Barrel Lab's video descriptions.

---

## 2. The core principle — 3 layers (spec centerpiece)

Every prop prediction is three layers:

1. **BASE** — the player's real production rate (his actual hit / HR / K rate).
2. **ADJUST** — factors tilt that up or down (park, weather, pitcher, form, **barrel**).
3. **MACHINERY** — turns it into a probability (log5, Poisson / Negative-Binomial, expected_bf).

**Layers 1 and 3 never change and are never thrown away — in every mode.** Only **Layer 2 (adjust)** differs between modes. Barrel **tilts a grounded prediction; it never predicts from scratch.** This is what keeps the whole feature safe: props that work well today (Hits/TB/Runs/RBI/HRR) keep their base rates and machinery in every mode, and barrel only changes the tilt.

---

## 3. Modes & selector model

```
Timeframe:   [ Current ]  [ Blend ]  [ History ]     ← always present
Philosophy:  [ Normal ]  ·  [ Barrel Weight ]         ← new
Toggle:      [ Barrel Effect ⚪ ]                       ← only applies to Normal
```

| Mode | Layer-2 behavior |
|---|---|
| Normal + Barrel Effect **OFF** | today's factor recipe (running on the upgraded pitcher engine — see §6) |
| Normal + Barrel Effect **ON** | today's factors **+ capped barrel nudge**, timeframe-consistent |
| **Barrel Weight** | barrel-dominant; other edges (park/weather/BvP) rest until the "sauce" phase; still spans Current/Blend/History |

- **Timeframe-consistent barrel:** Current uses current-season barrel, History uses the 3yr (5-4-3 Marcel) blend, Blend blends. Rides the existing `blend.py` / `_hist`-twin machinery.
- **Barrel Weight** is an **additional lens**, not a replacement — the full-featured Normal modes remain untouched and one toggle away.

Existing timeframe selection lives in `web/lib/weighting.ts` (`pickN`) + source param; the new **philosophy** selector and **Barrel Effect** toggle are added alongside.

---

## 4. The 3 jobs, concretely

### 4a. Barrel as INPUTS — per-prop recipe matrix

Factors are a **shared pantry**; each prop is a **recipe** that draws from it in different amounts. Recipes are **generous** (include any relevant factor); the **grader tunes the weights**. The **contact pair (ZoneFit + low SwStr%) is near-universal** — contact is the gate to all offense; only the *power* side re-weights per prop.

**Contact pair = ZoneFit + low SwStr%** is explicit on every batter prop below (it was buried in "contact"/"on-base" shorthand before — LOCKED explicit 2026-07-06). Only the power/whiff side and the pitcher side change per prop.

| Prop | Hitter factors | Pitcher side |
|---|---|---|
| **HR** | full pantry: PulledBrl, Brl/BIP, HH%, SweetSpot%, FB%, LA, xwOBAcon, ISO **+ ZoneFit, low SwStr** | barrel-allowed, HH-allowed, FB-allowed |
| **Hits** | **ZoneFit, low SwStr** + xwOBA + HH% + **SweetSpot%** (line-drive contact) | hit-allowed, CSW% |
| **Total Bases** | **ZoneFit, low SwStr** + HH%, xwOBAcon, ISO, SweetSpot%, FB%, PulledBrl | hit-allowed, barrel-allowed |
| **Runs** | **ZoneFit, low SwStr**, xwOBA (on-base) + own power + lineup-behind (existing) | hit-allowed (suppression) |
| **RBI** | drive-power (HH%, ISO, Brl, xwOBAcon) + **ZoneFit, low SwStr** + lineup-ahead (existing) | hit-allowed, barrel-allowed |
| **HRR** | inherits HR power + Hits/Runs contact (incl. ZoneFit), dampened (as HRR already dampens park) | combined |
| **Ks** | batter K-rate, SwStr, chase — **NO ZoneFit** (whiff ≠ damage-zone) | **CSW%, SwStr%** (whiff) |
| **KCN** | pitcher-K vs batter contact; pitcher hit-allowed vs batter contact | — |

ZoneFit answer (LOCKED): **YES** on Runs/RBI/HRR (contact gates on-base + driving in), **NO** on Ks (Ks is whiff-driven). SweetSpot added to Hits. This is the "eligible factor" list (generous by design); the **exact weights are grader-tuned**. Finalized numeric weights land in the Barrel Effect / Barrel Weight per-prop implementation plans. NOTE: this recipe drives the per-prop **probabilities** (Barrel Effect + Barrel Weight builds) — it is NOT the b-weight **Prop Score** (the HR-focused board headline; see `2026-07-06-barrel-prop-score-design.md`).

### 4b. Barrel as WEIGHTING — Barrel Weight mode
A distinct philosophy where barrel dominates Layer 2. **Pure replica first** (park/weather/BvP rest, by design) so we can validate it lines up with the proven boards; their **score** (kHR / TrueHRScore) becomes a **probability** poured into the normal card face. **HR is its home turf** (uses the full pantry); Hits/TB/Runs/RBI/HRR still stand on real base rates + machinery, tilted by the contact-side barrel factors. Hybrid "sauce" (a little weather/park) is deferred (§9).

### 4c. Barrel as DISPLAY — the `Boards` pill (see §7)

---

## 5. Data foundation (Phase 2)

Capture the **full column set** the boards use (not just 6). Same daily Statcast pull we already run — extend the event columns and aggregate.

- **Hitter raw stats:** Brl/BIP%, PulledBrl%, SweetSpot%, FB%, HH%, LA, ISO, xwOBA, xwOBAcon, SwStr%, HR/FB%, + Hist Pitches / Hist BIP (sample counts).
- **Pitcher-allowed:** barrel-allowed, pulled-barrel-allowed, HH-allowed, FB-allowed, xwOBA-allowed, CSW%, SwStr%, Ball%.
- **Computed scores** (derived from the above + matchup, not sourced): Matchup Score, ZoneFit, Ceiling, kHR-equivalent.
- **Sample-size trust flag** from Hist Pitches / Hist BIP (feeds the deferred name-color polish, §9).

**Seams (from current code):**
- `model/fetch.py` — extend `_BATTER_EVENT_COLS` / `_DAY_EVENT_COLS` to include `barrel`, `launch_angle`, EV, pitch-level fields.
- `model/profiles.py` — compute the hitter + pitcher-allowed metrics in `*_profile_from_events` and blend in `blended_*_profile` (Marcel 5-4-3).
- Today's profiles compute only crude rates (`k_per_bf`, `hr_allowed_rate`, `hit_allowed_rate`) and HH via `launch_speed>=95`; none of barrel/CSW/SwStr/SweetSpot exist yet.

**Flagged complexity — ZoneFit sourcing:** ZoneFit needs pitch-**location**/zone data (hitter damage zones vs pitcher location tendencies), heavier than the event-level pull. It may **phase in later** than the simpler batted-ball stats. It does **not** block the visual prototype (mock column) or the other factors.

---

## 6. Pitcher engine upgrade (Phase 3 — universal, its own sign-off)

**One shared pitcher profile** feeds every prop, so upgrading it once makes the whole site smarter. **Rule: upgrade where a new stat measures the same thing better; keep separate where it's a different thing; keep structural bits.**

Current usage (verified in code):

| Pitcher stat | Feeds | How | Location |
|---|---|---|---|
| `hr_allowed_rate` (raw) | HR | multiplier `pitcher_mult` | `projections.py:pitcher_hr_mult` |
| `hit_allowed_rate` (raw) | Hits, TB | log5 vs batter | `matchup.py:hit_prob` |
| `hit_allowed_rate` | Runs, RBI, HRR | baserunner-suppression mult | `run_props.py:pitcher_suppression_mult` |
| `hit_allowed_rate` + `k_per_bf` | KCN lean | log5 both sides → K/H/NEU | `matchup.py:classify_lean` |
| `k_per_bf` (raw) | Ks | × `expected_bf` → Poisson/NB line | `projections.py:expected_strikeouts` |
| `expected_bf`, `k_line`, `bf` | Ks | workload / the line / sample size | `profiles.py` |

Upgrade plan:

| Today (crude) | Upgrade to | Effect |
|---|---|---|
| `hr_allowed_rate` | blend with barrel-allowed / HH-allowed | sharper HR `pitcher_mult` |
| `hit_allowed_rate` | blend with HH / contact-allowed | better Hits/TB + Runs/RBI suppression |
| `k_per_bf` | blend with CSW% / SwStr% | better expected Ks + sharper KCN, esp. thin samples |

- **Keep separate:** BvP (`bvp_hr_mult` / `bvp_hit_mult`) — batter-vs-this-pitcher history, different thing, ±10% cap stays. Barrel ingredients are general season rates and contain no BvP.
- **Keep structural:** `expected_bf` (volume/role), `k_line` (the sportsbook line), `bf` (sample), platoon/log5, regression constants.
- **History** uses the 3yr blend of the new pitcher fields.
- **Sign-off note:** this shifts numbers in **all** modes (even Barrel Effect OFF), so it is its own before/after sign-off, separate from the Barrel Effect toggle.

---

## 7. The `Boards` pill (display, Phase 1 visual + later wiring)

New nav pill added next to Parks. Content **follows the active mode**:

| Active mode | Board shows |
|---|---|
| Normal (Effect OFF) | heatmap of *your* current drivers/factors per player |
| Normal (Effect ON) | same board, barrel columns light up |
| Barrel Weight | full Kasper/Barrel Lab replica (per team, per pitcher) |

- **Layout:** hitters grouped **vs the specific pitcher they face** (matchup framing) + **top-reads cards** + a **pitcher board** (Kasper "Top Slate Pitchers" style) — for **both** lenses.
- **Rename:** the existing props section (currently "Board") → **"Props"**, freeing "Boards" for the heatmap pill (avoids name clash).
- **Pill design detail:** each nav pill's faint watermark = the **Aperture logo**, styled to match the existing pill iconography.
- **No math change** in this job — pure presentation.
- **Flagged complexity — mobile:** the heatmap is wide; needs a deliberate mobile treatment consistent with the hard-won 600px-viewport approach (see `mobile-fit-viewport` memory). Do **not** use JS viewport hacks.

**Frontend seams:** `web/app/page.tsx` (NavDock sections `board|hub|top|parks`), `web/components/spatial/NavDock.tsx`, `web/lib/types.ts`, `web/lib/weighting.ts`; reuse `FactorBar`, `GlassCard`, `ProbabilityOrb`, chips. A new `BoardsView.tsx` mirrors `BoardView.tsx` structure.

---

## 8. Barrel Effect (Phase 4 — toggle, sign-off)

On/off switch on the Normal weights. **ON** folds the **hitter-side barrel recipe** (per-prop, §4a) into existing probabilities as a **capped nudge** — bigger-than-average vote but cannot dominate (the cap is exactly what separates it from Barrel Weight; spirit matches the approved BvP ±10% cap). **OFF** = today's recipe (on the upgraded pitcher engine). Timeframe-consistent barrel. **Layers 1 & 3 unchanged.**

- **Starting cap = sensible seed, then tuned against the grader** (does barreled beat un-barreled on real results?). This is a math change → sign-off before live.
- Enters at the same multiplier seam as park/weather/BvP in `pipeline.py` / `projections.py`.

---

## 9. Barrel Weight (Phase 5 — mode, sign-off)

New philosophy selector; barrel-dominant Layer 2; **pure replica first**. Their score → probability → normal card face. Spans Current/Blend/History. Base rates + machinery still carry every prop.

**Deferred (roadmap, 🟡 later):**
- **Hybrid seasoning** — layer a little weather/park "sauce" onto Barrel Weight; keep **only** if the grader shows it beats pure.
- **Sample-size name-color flags** (High/Medium/Thin/Very-Thin) if not shipped in v1.
- **xStats base-rate upgrade** — sharpen Layer-1 base production with xwOBA/xwOBAcon/xBA (quality over raw results); separate base-rate sign-off; helps all props.
- **Barrel-based form** — rolling recent barrel/contact trend as a sharper per-prop form signal; must avoid double-count with barrel *level*.

---

## 10. Grading & recorder

- **Recorder** (`model/daily.py`, `model/archive.py`) already records every row field and tolerates new keys (`_FACTOR_KEYS` via `.get()`), so barrel factors are captured with minimal change.
- **Record barreled AND un-barreled probabilities** so we can prove the nudge and tune the cap.
- **Grader** (`model/grader.py`) needs no new logic — it grades whatever probabilities we store (KCN already graded).

---

## 11. Build phases (visual-first)

| Phase | What | Data | Sign-off |
|---|---|---|---|
| **1 — Visual prototype** | new selectors + `Boards` pill (both lenses + pitcher board) + Barrel Weight shell + renamed **Props** + pill watermark | **mock** | no (preview flow) |
| **2 — Data foundation** | source full stat set (hitters + pitchers-allowed); compute scores; ZoneFit may phase | real | no |
| **3 — Pitcher engine upgrade** | one shared smarter pitcher profile, universal | real | **yes** |
| **4 — Barrel Effect** | fold per-prop recipes into Normal weights (capped nudge) | real | **yes** |
| **5 — Barrel Weight** | pure replica wired live | real | **yes** |

Phase 1 is built in **Next.js in the existing site, on this branch, previewed on localhost** (same workflow as the mock-7 reskin) — go big on the look, iterate on feedback before wiring real data. Each phase gets its own implementation plan.

---

## 12. Non-goals / rules

- **No 6-box clutter on prop cards** — barrel lives in the math + the `Boards` heatmap only.
- No new probability machinery — barrel reuses the existing multiplier/log5/Poisson seams.
- Normal modes stay honest: Barrel Effect OFF changes nothing except the (separately signed-off) universal pitcher engine.
- All math phases (3, 4, 5) require user sign-off before going live (`math-changes-need-signoff`).
