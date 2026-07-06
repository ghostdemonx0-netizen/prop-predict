# Barrel Edge — b-weight Prop Score — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build `model/prop_score.py` — a pure function that turns Phase-0 barrel data into a single 0–100 "Prop Score" (hitter barrels × tonight's pitcher's barrels-allowed + a platoon Split booster), the HR-focused board headline. No probability change; ranking number only.

**Architecture:** One isolated pure module with seed constants (league anchors + weights). Each hitter/pitcher barrel stat is linearly scaled to 0–1 against seed league anchors, weighted (pulled-barrel + barrel-rate lead), the two sides combined (60/40 seed), then nudged by a clamped platoon Split booster and scaled to 0–100. Surfacing onto board rows + wiring the frontend is the separate **Bridge** task.

**Tech Stack:** Python 3, pytest. Run via the repo `.venv`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-06-barrel-prop-score-design.md`.
- **Pure, no I/O:** `model/prop_score.py` imports nothing from the pipeline; it takes two profile dicts + a platoon multiplier and returns a float. No file/network access.
- **ZERO probability change:** do NOT touch `model/projections.py`, `model/pipeline.py`, `model/run_props.py`, `model/matchup.py`, or `model/profiles.py`. This is an additive new module.
- **Inputs = Phase-0 fields only:** hitter uses `pulled_barrel_rate, barrel_rate, hardhit_rate, sweetspot_rate, fb_rate, xwobacon`; pitcher uses the `*_allowed` versions. (LA is excluded — non-linear; SweetSpot already captures launch quality. ISO/HR-FB excluded from v1 — grader can add later.)
- **All weights/anchors are SEED constants**, named at module top, documented as grader-tunable. Barrels lead: pulled_barrel + barrel_rate carry the most weight on both sides.
- **Sign-off:** this is a math build. It stays on the branch; the user okays the seed numbers (Task 2 produces real examples for that) before it's surfaced live.
- **Testing:** pytest via `.venv/bin/python -m pytest`. Run all commands from repo root `/Users/issiakadiawara/Projects/prop-predict`.

---

### Task 1: `model/prop_score.py` — the scoring function

**Files:**
- Create: `model/prop_score.py`
- Create: `tests/test_prop_score.py`

**Interfaces:**
- Produces: `prop_score(hitter: dict, pitcher: dict, *, platoon_mult: float = 1.0) -> float` (0–100). Task 2 + the Bridge consume it.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_prop_score.py`:

```python
from model.prop_score import prop_score

# Every hitter stat at its anchor HIGH -> hitter index = 1.0
_STRONG = {"pulled_barrel_rate": 0.12, "barrel_rate": 0.20, "hardhit_rate": 0.55,
           "sweetspot_rate": 0.45, "fb_rate": 0.45, "xwobacon": 0.46}
# Every hitter stat at its anchor LOW -> hitter index = 0.0
_WEAK = {"pulled_barrel_rate": 0.01, "barrel_rate": 0.03, "hardhit_rate": 0.25,
         "sweetspot_rate": 0.25, "fb_rate": 0.18, "xwobacon": 0.26}
# Pitcher allowed at anchor HIGH -> most barrel-friendly (index 1.0)
_VULN_P = {"pulled_barrel_rate_allowed": 0.08, "barrel_rate_allowed": 0.12,
           "hardhit_rate_allowed": 0.52, "fb_rate_allowed": 0.45}
# Pitcher allowed at anchor LOW -> barrel-stingy (index 0.0)
_STINGY_P = {"pulled_barrel_rate_allowed": 0.03, "barrel_rate_allowed": 0.04,
             "hardhit_rate_allowed": 0.35, "fb_rate_allowed": 0.18}
_MID_H = {"pulled_barrel_rate": 0.06, "barrel_rate": 0.10, "hardhit_rate": 0.40,
          "sweetspot_rate": 0.35, "fb_rate": 0.30, "xwobacon": 0.36}
_MID_P = {"pulled_barrel_rate_allowed": 0.05, "barrel_rate_allowed": 0.08,
          "hardhit_rate_allowed": 0.43, "fb_rate_allowed": 0.30}


def test_max_inputs_score_100():
    assert prop_score(_STRONG, _VULN_P, platoon_mult=1.0) == 100.0


def test_min_inputs_score_0():
    assert prop_score(_WEAK, _STINGY_P, platoon_mult=1.0) == 0.0


def test_barrel_friendly_pitcher_scores_higher_than_stingy():
    assert prop_score(_STRONG, _VULN_P) > prop_score(_STRONG, _STINGY_P)


def test_strong_hitter_beats_weak_hitter_same_pitcher():
    assert prop_score(_STRONG, _MID_P) > prop_score(_WEAK, _MID_P)


def test_platoon_advantage_bumps_score():
    adv = prop_score(_MID_H, _MID_P, platoon_mult=1.06)
    neu = prop_score(_MID_H, _MID_P, platoon_mult=1.0)
    dis = prop_score(_MID_H, _MID_P, platoon_mult=0.95)
    assert adv > neu > dis


def test_split_booster_is_clamped():
    # platoon_mult beyond the clamp is capped, so 1.50 == 1.06.
    assert prop_score(_MID_H, _MID_P, platoon_mult=1.50) == prop_score(_MID_H, _MID_P, platoon_mult=1.06)


def test_missing_fields_degrade_to_low_no_crash():
    assert prop_score({}, {}, platoon_mult=1.0) == 0.0


def test_output_always_0_to_100():
    for pm in (0.5, 1.0, 2.0):
        s = prop_score(_STRONG, _VULN_P, platoon_mult=pm)
        assert 0.0 <= s <= 100.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_prop_score.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.prop_score'`.

- [ ] **Step 3: Implement `model/prop_score.py`**

Create `model/prop_score.py`:

```python
"""Pure b-weight "Prop Score": a 0-100 HR-focused board headline.

score = (hitter barrel quality) x (tonight's pitcher's barrels-ALLOWED),
nudged by a platoon "Split" booster. Barrel dominates by design — pulled-barrel
and barrel-rate carry the most weight on both sides. Every anchor/weight below is
a SEED (grader-tuned later). No I/O; returns a ranking number only — it produces
no probability and changes no existing prop math.
"""

# Per-stat league anchors (lo, hi) as FRACTIONS (0-1, matching Phase-0 output).
# A stat is linearly scaled: (value-lo)/(hi-lo), clamped to [0,1].
_HITTER_ANCHORS = {
    "pulled_barrel_rate": (0.01, 0.12),
    "barrel_rate":        (0.03, 0.20),
    "hardhit_rate":       (0.25, 0.55),
    "sweetspot_rate":     (0.25, 0.45),
    "fb_rate":            (0.18, 0.45),
    "xwobacon":           (0.26, 0.46),
}
# Weights sum to 1.0. Pulled-barrel + barrel-rate = 0.60 (the "barrels lead" seed).
_HITTER_WEIGHTS = {
    "pulled_barrel_rate": 0.30,
    "barrel_rate":        0.30,
    "hardhit_rate":       0.15,
    "sweetspot_rate":     0.10,
    "fb_rate":            0.05,
    "xwobacon":           0.10,
}
_PITCHER_ANCHORS = {
    "pulled_barrel_rate_allowed": (0.03, 0.08),
    "barrel_rate_allowed":        (0.04, 0.12),
    "hardhit_rate_allowed":       (0.35, 0.52),
    "fb_rate_allowed":            (0.18, 0.45),
}
# Weights sum to 1.0. Pulled-barrel + barrel-allowed = 0.70 (barrels lead).
_PITCHER_WEIGHTS = {
    "pulled_barrel_rate_allowed": 0.35,
    "barrel_rate_allowed":        0.35,
    "hardhit_rate_allowed":       0.20,
    "fb_rate_allowed":            0.10,
}

_W_HITTER, _W_PITCHER = 0.60, 0.40      # matchup balance seed (hitter leads)
_SPLIT_LO, _SPLIT_HI = 0.94, 1.06        # Split booster clamp on the platoon mult


def _clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else 1.0 if x > 1.0 else x


def _scaled(value, lo: float, hi: float) -> float:
    """Linear-scale a stat to [0,1] against its league anchors; None -> 0."""
    if value is None:
        return 0.0
    return _clamp01((value - lo) / (hi - lo))


def _index(profile: dict, anchors: dict, weights: dict) -> float:
    """Weighted 0-1 quality index over a profile's stats (weights sum to 1)."""
    return sum(weights[k] * _scaled(profile.get(k), lo, hi)
               for k, (lo, hi) in anchors.items())


def prop_score(hitter: dict, pitcher: dict, *, platoon_mult: float = 1.0) -> float:
    """0-100 b-weight Prop Score for a hitter vs tonight's opposing starter.

    hitter: a batter profile carrying the Phase-0 barrel fields.
    pitcher: the opposing starter profile carrying the Phase-0 `*_allowed` fields.
    platoon_mult: the batter's platoon edge vs this pitcher (e.g. the model's
        hr_platoon_mult ~1.06 / 0.95); dampened+clamped into the Split booster.
    Missing fields count as 0 (degrade to a low score, never crash).
    """
    h = _index(hitter, _HITTER_ANCHORS, _HITTER_WEIGHTS)      # 0..1
    p = _index(pitcher, _PITCHER_ANCHORS, _PITCHER_WEIGHTS)   # 0..1
    matchup = _W_HITTER * h + _W_PITCHER * p                  # 0..1
    split = _SPLIT_LO if platoon_mult < _SPLIT_LO else _SPLIT_HI if platoon_mult > _SPLIT_HI else platoon_mult
    return round(_clamp01(matchup * split) * 100.0, 1)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/test_prop_score.py -q`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add model/prop_score.py tests/test_prop_score.py
git commit -m "feat(barrel): b-weight Prop Score (hitter barrels x pitcher barrels-allowed + Split)"
```

---

### Task 2: Real-data smoke validation (sign-off evidence)

**Files:**
- Create: `scripts/smoke_prop_score.py` (a throwaway validation script — kept so the numbers are reproducible for sign-off)

**Interfaces:**
- Consumes: `prop_score` (Task 1), `model.fetch`, `model.profiles`.

- [ ] **Step 1: Write the smoke script**

Create `scripts/smoke_prop_score.py`:

```python
"""Real-data sanity check for the b-weight Prop Score. Not a unit test —
prints scores for real matchups so a human can eyeball them for sign-off.
Run: .venv/bin/python scripts/smoke_prop_score.py
"""
from model import fetch, profiles
from model.prop_score import prop_score

SEASON = 2024
HITTERS = {"Aaron Judge": 592450, "Luis Arraez": 650333}   # elite power vs contact-only
PITCHERS = {"Aaron Nola": 605400, "Tarik Skubal": 669373}  # HR-prone vs stingy

hprof = {n: profiles.batter_profile_from_events(
            fetch.batter_events(pid, SEASON), as_of=f"{SEASON}-10-01", player_id=pid, name=n)
         for n, pid in HITTERS.items()}
pprof = {n: profiles.pitcher_profile_from_events(
            fetch.pitcher_events(pid, SEASON), as_of=f"{SEASON}-10-01", player_id=pid, name=n)
         for n, pid in PITCHERS.items()}

print(f"{'HITTER':<14}{'PITCHER':<16}{'neutral':>9}{'adv(1.06)':>11}{'disadv(.95)':>13}")
for hn, hp in hprof.items():
    for pn, pp in pprof.items():
        neu = prop_score(hp, pp, platoon_mult=1.0)
        adv = prop_score(hp, pp, platoon_mult=1.06)
        dis = prop_score(hp, pp, platoon_mult=0.95)
        print(f"{hn:<14}{pn:<16}{neu:>9}{adv:>11}{dis:>13}")
```

- [ ] **Step 2: Run it and record the numbers**

Run: `.venv/bin/python scripts/smoke_prop_score.py`
Expected: a table of 0–100 scores. Sanity checks to confirm (report them):
- every number is in 0–100;
- the **elite power bat (Judge)** scores **higher than the contact-only bat (Arraez)** against the same pitcher (barrels lead);
- each hitter scores **higher vs the HR-prone pitcher (Nola)** than vs the stingy one (Skubal);
- `adv > neutral > disadv` in every row (Split booster works).

(If a Statcast pull is slow/rate-limited, retry; this is a network run. The unit tests in Task 1 are the deterministic gate — this is the human-eyeball sign-off evidence.)

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke_prop_score.py
git commit -m "chore(barrel): real-data smoke script for Prop Score sign-off"
```

---

## Self-Review

**Spec coverage (`2026-07-06-barrel-prop-score-design.md`):**
- One universal 0–100 HR-focused score → `prop_score` returns rounded 0–100 (Task 1). ✅
- Barrels lead (both sides) → pulled+barrel weights = 0.60 (hitter) / 0.70 (pitcher). ✅
- Two barrel-led halves combined (matchup) → `_W_HITTER`/`_W_PITCHER` 60/40. ✅
- Split booster (clamped) → `_SPLIT_LO/_HI` on `platoon_mult`. ✅
- Pure Phase-0 data, no blend, no prob change → module imports nothing from pipeline; constraints forbid touching prob files. ✅
- Seed-now/grader-tune → all constants named at module top, documented as seeds. ✅
- Sign-off evidence → Task 2 real-data smoke. ✅
- NOT included (CSW/SwStr, contact-allowed, xwOBA, park/weather/BvP, ISO/LA/HR-FB) → excluded from the input dicts. ✅
- Surfacing on board rows + recorder capture → correctly deferred to the Bridge task (spec §5). ✅

**Placeholder scan:** none — every step has real code/commands. ✅

**Type consistency:** `prop_score(hitter, pitcher, *, platoon_mult=1.0) -> float` identical in the module, the unit tests, and the smoke script. Stat keys match Phase-0's profile fields exactly (`pulled_barrel_rate`… / `*_allowed`). ✅

**Note:** the smoke script's real scores are the artifact the user signs off on before the Bridge surfaces the score live. Nothing here changes an existing probability, so no sign-off is needed to *build/test* on the branch — only to surface it.
