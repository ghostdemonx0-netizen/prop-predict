# BvP Hit Dial for Hits / Total Bases (Design)

**Date:** 2026-06-29
**Status:** Design — approved in brainstorm; awaiting spec review
**Author:** brainstorm with user, 2026-06-29

---

## 1. Motivation

Career batter-vs-pitcher (BvP) history is wired into the math **per stat**: HR → `bvp_hr_mult` (career HR), K → `bvp_k_mult` (career K). But for **Hits / Total Bases**, BvP only touches the **HR slice** of the outcome vector — the **singles/doubles/triples get none**, even though the career hits/AVG line is **shown on the card.** So the displayed head-to-head AVG is currently **display-only** for contact hits.

User wants the batter's career *contact* success vs a pitcher to count (a hitter who genuinely rakes off a pitcher should get a small bump) — done the **safe** way, like the HR/K dials.

## 2. Decision (from brainstorm)
- Add a **`bvp_hit_mult`** dial mirroring `bvp_hr_mult`: career hits regressed toward league, **±10% cap**, heavy shrinkage, **neutral when no history**.
- Applied to the **1B/2B/3B components** of Hits & TB (the HR component already has `bvp_hr_mult`).
- **One BvP dial per prop** — no "all-around" boost stacked on HR/TB (would double-count contact↔power; scratched in brainstorm).
- Full **career** record, same across Current/Blend/History (BvP is a matchup factor, not season-split).
- ±10% kept equal to HR/K (no reason to let noisier hit-BvP swing harder); future tuning of shrink/caps is a **grader-driven** pass.

## 3. Design

### 3a. New `projections.bvp_hit_mult`
Mirror `bvp_hr_mult` exactly, anchored on league hit rate:
```python
def bvp_hit_mult(hits, pa, *, league_hit_rate=LEAGUE_HIT, regression_pa=600.0,
                 min_pa=1.0, lo=0.90, hi=1.10) -> float:
    if not pa or pa < min_pa:
        return 1.0
    rate = (hits + league_hit_rate * regression_pa) / (pa + regression_pa)
    return max(lo, min(rate / league_hit_rate, hi))
```
Heavy shrinkage → a 6-for-12 barely moves; a large, strong (or weak) sample climbs toward ±10%. No history → 1.0.

### 3b. Apply in `_batter_outcome_vector`
Compute once and multiply into the **1B/2B/3B** components of BOTH the actual and neutral vectors (so it affects the final probability but **cancels in the pitcher/park/weather factor ratios**, keeping those breakdowns clean — same reasoning the HR slice follows for the probability):
```python
hit_mult = bvp_hit_mult(bvp.get("hits", 0), bvp["pa"]) if (bvp and bvp.get("pa")) else 1.0
# actual p1/p2/p3 and neutral n1/n2/n3 each get an extra "* hit_mult"
```
The HR component (`p4`/`n4`) is unchanged (already carries `bvp_hr_mult`).

### 3c. Row field + recorder
`_threshold_rows` sets `row["bvp_hit_mult"] = bvp_hit_mult(...)` (1.0 when no bvp) for display/diagnosis; add `bvp_hit_mult` (+ `_hist`) to `archive._FACTOR_KEYS`. The card already shows the head-to-head line — it now drives a small part of the Hits/TB number.

## 4. Scope / not changing
- HR prop, K prop, Runs/RBI/HRR: unchanged (BvP off for run props by design).
- Same record across weightings; no new BvP data pull (uses existing `bvp_fn`).
- AVG/AB columns stay context; the dial uses the **hits** count.

## 5. Testing (TDD)
- `bvp_hit_mult`: no history (pa=0) → 1.0; 0-for-many → fades toward 0.90; many hits in a real sample → climbs toward 1.10; clamped; heavy shrinkage (small sample barely moves).
- Integration: a batter with a strong career-hits record vs the pitcher gets a higher Hits `p_ge1` than the same batter with no history; a 0-for-20 hitter dips; `bvp_hit_mult` appears on the row; pitcher_factor unchanged by the bvp (ratio cancels).
- Full suite green.

## 6. Sign-off
Math change (mirrors existing dial; one new ±10% cap reused). Build via spec → plan → SDD; preview before prod.
