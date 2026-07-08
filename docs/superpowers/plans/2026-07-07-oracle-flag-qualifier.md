# Oracle Flag Qualifier — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Build **Oracle** — our own gate+points "standout barrel play" qualifier — and wire the (already-built) grayed-logo flag to it, replacing the `Prop Score ≥ 70` placeholder.

**Architecture:** Pure `model/oracle.py` (gate on hitter barrel quality + sample; points from platoon + matchup + form; premium bar). Computed in `_hitter_board`, emitted as `oracle` (1/0) + `oracle_score`. Frontend flag reads `r.stats.oracle`.

**Tech Stack:** Python 3 (pytest), Next.js/TypeScript.

## Global Constraints
- **Spec:** `docs/superpowers/specs/2026-07-07-oracle-flag-qualifier-design.md`.
- All Oracle constants are grader-tunable **SEEDS**. `_QUALITY` weights sum 1.0; edge weights (`_W_PLATOON`+`_W_MATCHUP`+`_W_FORM`) sum 1.0.
- NO change to prop math / probabilities / `prop_score` / `barrel_effect`. Additive: the boards payload gains `oracle`/`oracle_score`; nothing else changes.
- Full pytest suite green each task; frontend `tsc --noEmit` clean + no new lint in touched files (`page.tsx:228` pre-existing baseline).
- Reuse `barrel_effect._dev` and `barrel_effect._A` (league anchors) — do not redefine anchors.

---

### Task 1: `model/oracle.py` — the qualifier

**Files:** Create `model/oracle.py`, `tests/test_oracle.py`.

- [ ] **Step 1: Write the failing tests**

```python
from model.oracle import oracle, _QUALITY, _W_PLATOON, _W_MATCHUP, _W_FORM

_ELITE = {"bbe": 300, "barrel_rate": 0.20, "pulled_barrel_rate": 0.12, "hardhit_rate": 0.55,
          "xwobacon": 0.46, "sweetspot_rate": 0.45, "recent_form_mult": 1.10}
_AVG = {"bbe": 300, "barrel_rate": 0.08, "pulled_barrel_rate": 0.035, "hardhit_rate": 0.40,
        "xwobacon": 0.37, "sweetspot_rate": 0.34, "recent_form_mult": 1.0}

def test_weight_sums():
    assert abs(sum(_QUALITY.values()) - 1.0) < 1e-9
    assert abs((_W_PLATOON + _W_MATCHUP + _W_FORM) - 1.0) < 1e-9

def test_gate_blocks_weak_barrel_even_with_great_edges():
    r = oracle(_AVG, barrel_mult=1.20, platoon_mult=1.06)   # avg bat, max edges
    assert r["oracle"] is False

def test_gate_blocks_thin_sample():
    thin = dict(_ELITE); thin["bbe"] = 10
    assert oracle(thin, barrel_mult=1.20, platoon_mult=1.06)["oracle"] is False

def test_elite_bat_with_stacked_edges_flags():
    r = oracle(_ELITE, barrel_mult=1.18, platoon_mult=1.05)
    assert r["oracle"] is True
    assert 0.0 <= r["oracle_score"] <= 1.0

def test_gated_bat_with_poor_edges_does_not_flag():
    # elite barrel but a bad matchup + bad platoon + cold form -> edges too low to clear premium bar
    cold = dict(_ELITE); cold["recent_form_mult"] = 0.9
    r = oracle(cold, barrel_mult=0.90, platoon_mult=0.95)
    assert r["oracle"] is False
```

- [ ] **Step 2: Run to verify fail**

Run: `.venv/bin/python -m pytest tests/test_oracle.py -q` → FAIL (no module).

- [ ] **Step 3: Implement `model/oracle.py`**

```python
"""Oracle — our own premium "standout barrel play" flag qualifier.
Gate (real barrel bat + enough sample) + stacked matchup edges (platoon + pitcher
barrel-vulnerability heavy, recent form light), premium bar. Pure; no I/O.
All constants are grader-tunable SEEDS. Barrel Lab's Barrel-Signal tier is the
reference, not a copy."""
from model.barrel_effect import _dev, _A

# --- gate: hitter's OWN barrel quality (hitter-only; NOT pitcher/platoon -> no double-count) ---
_QUALITY = {  # weights sum 1.0
    "barrel_rate": 0.35, "pulled_barrel_rate": 0.25, "hardhit_rate": 0.20,
    "xwobacon": 0.12, "sweetspot_rate": 0.08,
}
_GATE_MIN = 0.60     # quality (0..1, league-avg 0.5) to be a real barrel bat; SEED
_MIN_BBE = 40.0      # sample trust-gate; SEED

# --- edges (once gated), each normalized to 0..1 ---
_W_PLATOON, _W_MATCHUP, _W_FORM = 0.45, 0.40, 0.15   # sum 1.0
_PLATOON_LO, _PLATOON_HI = 0.97, 1.06   # hr_platoon_mult favorable range; SEED
_MATCHUP_LO, _MATCHUP_HI = 1.00, 1.20   # barrel_mult positive tilt (HR cap); SEED
_FORM_LO, _FORM_HI = 1.00, 1.20         # recent_form_mult hot range; SEED

_FLAG_BAR = 0.62     # premium: blended score to flag (rare); SEED


def _clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def _norm(value, lo, hi) -> float:
    return _clamp01(((value if value is not None else lo) - lo) / (hi - lo))


def _quality(hitter: dict) -> float:
    """Hitter's own barrel quality, 0..1 (league-average ~0.5, elite ~1.0)."""
    d = sum(w * _dev(hitter.get(k), *_A[k]) for k, w in _QUALITY.items())   # -1..1
    return (d + 1.0) / 2.0


def oracle(hitter: dict, *, barrel_mult: float, platoon_mult: float) -> dict:
    """Oracle qualifier. Returns {"oracle": bool, "oracle_score": float}."""
    q = _quality(hitter)
    bbe = hitter.get("bbe") or 0
    gate = q >= _GATE_MIN and bbe >= _MIN_BBE

    platoon_edge = _norm(platoon_mult, _PLATOON_LO, _PLATOON_HI)
    matchup_edge = _norm(barrel_mult, _MATCHUP_LO, _MATCHUP_HI)
    form_edge = _norm(hitter.get("recent_form_mult", 1.0), _FORM_LO, _FORM_HI)
    edges = _W_PLATOON * platoon_edge + _W_MATCHUP * matchup_edge + _W_FORM * form_edge

    score = 0.5 * q + 0.5 * edges
    return {"oracle": bool(gate and score >= _FLAG_BAR), "oracle_score": round(score, 3)}
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/python -m pytest tests/test_oracle.py -q` → PASS. Then `.venv/bin/python -m pytest -q` → green.

- [ ] **Step 5: Commit**

```bash
git add model/oracle.py tests/test_oracle.py
git commit -m "feat(oracle): barrel-flag qualifier — gate (barrel quality + sample) + stacked edges, premium bar"
```

---

### Task 2: Wire Oracle into the boards payload

**Files:** Modify `model/export_web.py`, `tests/test_boards_payload.py`.

- [ ] **Step 1: Failing test**

In `tests/test_boards_payload.py`, add: a hitter with strong barrel (elite `barrel_rate`/`pulled_barrel_rate`/`hardhit_rate`/`xwobacon`/`sweetspot_rate` + `bbe` 300 + `recent_form_mult` 1.1) vs a barrel-vulnerable pitcher (high `*_allowed`) surfaces `stats.oracle == 1`; a league-average hitter surfaces `stats.oracle == 0`. Mirror the existing `_hitter_board` fixture shape.

- [ ] **Step 2: Run to verify fail**

Run: `.venv/bin/python -m pytest tests/test_boards_payload.py -q -k oracle` → FAIL.

- [ ] **Step 3: Implement in `_hitter_board`**

In `model/export_web.py`: add `from model.oracle import oracle` and (barrel_effect_mult is likely already imported for the beff twins — if not, `from model.barrel_effect import barrel_effect_mult`). In `_hitter_board(b, opp, order, team)`, after `pmult = hr_platoon_mult(...)`:
```python
    bmult = barrel_effect_mult(b, opp, prop="hr") if opp else 1.0
    orc = oracle(b, barrel_mult=bmult, platoon_mult=pmult)
```
In the returned `stats` dict, add:
```python
            "oracle": 1 if orc["oracle"] else 0,
            "oracle_score": orc["oracle_score"],
```
Leave `trueScore` and everything else unchanged.

- [ ] **Step 4: Run test + full suite**

Run: `.venv/bin/python -m pytest tests/test_boards_payload.py -q` → PASS. Then `.venv/bin/python -m pytest -q` → green.

- [ ] **Step 5: Commit**

```bash
git add model/export_web.py tests/test_boards_payload.py
git commit -m "feat(oracle): emit oracle + oracle_score on board hitters"
```

---

### Task 3: Frontend — flag reads Oracle, badge renamed

**Files:** Modify `web/components/spatial/boards/BoardsView.tsx`, `web/components/spatial/BarrelFlag.tsx`.

- [ ] **Step 1: Point the flag at Oracle**

In `BoardsView.tsx`: replace the placeholder trigger `(r.stats.trueScore ?? 0) >= BARREL_FLAG_MIN` with `r.stats.oracle === 1`, and REMOVE the now-unused `const BARREL_FLAG_MIN = 70;`. The badge now renders exactly when the backend flags Oracle.

- [ ] **Step 2: Rename the badge**

In `BarrelFlag.tsx`, update the `title`/`aria-label` to `"Oracle — the model's standout barrel call"`. (Keep the grayed Aperture `LogoMark` visual unchanged.)

- [ ] **Step 3: Verify**

From `web/`: `npx tsc --noEmit` (clean) + `npm run lint` (no new errors in the 2 files). Do NOT run `npm run dev`.

- [ ] **Step 4: Commit**

```bash
git add web/components/spatial/boards/BoardsView.tsx web/components/spatial/BarrelFlag.tsx
git commit -m "feat(oracle): board flag fires on backend Oracle qualifier; badge renamed Oracle"
```

---

### Task 4: Real-data smoke (sign-off — is it rare + sensible?)

**Files:** Create `scripts/smoke_oracle.py`.

- [ ] **Step 1: Write the smoke**

Create `scripts/smoke_oracle.py`: over a set of real 2024 hitters (mix of elite power, contact, and mid bats) vs a couple pitchers (one barrel-vulnerable, one stingy), compute `oracle(...)` for each and print who flags + their `oracle_score`, plus the overall FLAG RATE (flagged / total). Mirror `scripts/smoke_a1.py`'s fetch/profile structure; compute `barrel_mult = barrel_effect_mult(h, p, prop="hr")` and `platoon_mult = hr_platoon_mult(h["bats"], p["throws"])` per pairing.

- [ ] **Step 2: Run + record**

Run: `.venv/bin/python scripts/smoke_oracle.py` (network — retry if slow). Record: the flag RATE (should be RARE — a small fraction), WHO flags (should be genuine standouts: elite bat + good matchup), and confirm league-average bats do NOT flag. If the rate looks too high/low, note the suggested `_FLAG_BAR`/`_GATE_MIN` tweak (do not change it — that's the user's sign-off call).

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke_oracle.py
git commit -m "chore(oracle): real-data smoke — Oracle flag rate + who qualifies (for sign-off)"
```

---

## Self-Review
**Coverage:** qualifier (Task 1) · boards emit (Task 2) · frontend flag + rename (Task 3) · smoke (Task 4). Gate on hitter-only quality (no double-count) + sample; heavy platoon/matchup, light form; premium bar. ✅
**Placeholder scan:** none — full formula + exact wiring.
**Type consistency:** `oracle(hitter, *, barrel_mult, platoon_mult) -> {"oracle": bool, "oracle_score": float}`; boards emit `oracle` (1/0) + `oracle_score`; frontend reads `r.stats.oracle === 1`.
**Deferred:** tiers, seed auto-tuning, card-surface flag (all non-goals).
