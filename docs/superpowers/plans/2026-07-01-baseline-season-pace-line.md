# Baseline / Season-Pace Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show two rows on every prop's player page — a neutral-conditions **Baseline chance** (%) and a raw **Season pace** (count) — between the headline and the "what's driving it" factors.

**Architecture:** Each Python row builder additionally computes, with all factors at 1.0, the baseline threshold probabilities (via the existing prob functions) and the raw season pace, and emits them + `_hist` twins. The frontend adds two `pick()`-source-aware rows per prop and a `paceText` formatter. Display-only — no probability/board math changes.

**Tech Stack:** Python (`uv run pytest`), Next.js/React/TS (`web/`, vitest node-env).

## Global Constraints

- **No probability/board math change.** Baseline = existing formula with factors = 1.0; pace = raw season stat. Existing prob tests stay green.
- **Baseline is per-threshold** for hits/TB/runs/HRR (mirrors `p_ge*`); single for HR/K.
- **Source-aware:** every new field gets a `_hist` twin, copied in `build_board_with_history`; frontend `pick()`s vs the Current/Blend/History toggle.
- **Pace = raw average** (`total/games`, or Ks/start for K); **baseline = regressed** — they can differ slightly for thin samples; labels ("chance" vs "per game") keep it clear.
- **No JS math duplication** — pace + baseline are precomputed in Python; frontend only formats.
- Preview-before-prod; deploy needs a board recompute (`force_deploy`).

---

### Task 1: Backend — run props (Runs/RBI/HRR) baseline + pace

**Files:**
- Modify: `model/pipeline.py` (`_run_prop_rows`, the row dict ~line 507 + the `row.update(ge_probs…)` ~line 526)
- Test: `tests/test_run_props_pipeline.py`

**Interfaces:**
- Produces: run rows gain `baseline_p_ge1`/`baseline_p_ge2` (HRR: `baseline_p_ge2/3/4`) and `pace` (runs/game).

- [ ] **Step 1: Write the failing test**

Append to `tests/test_run_props_pipeline.py`:

```python
def test_run_rows_carry_baseline_and_pace():
    L = lambda g: {"home": [_bat(1, 100, 60, 70, 200)], "away": [_bat(2, 100, 50, 50, 180)]}
    rows = build_runs_rows(_SLATE, L, lambda p: _pit(p), _W)
    r = next(x for x in rows if x["player_id"] == 1)
    assert "baseline_p_ge1" in r and "baseline_p_ge2" in r
    # pace = raw season average = total_r / games = 60/100
    assert math.isclose(r["pace"], 60 / 100)
    # baseline = neutral ge-prob from the regressed rate (all factors 1.0)
    _rate = run_props.regressed_per_game(60, 100, run_props.LEAGUE_R_PER_GAME, run_props.REG_GAMES)
    assert math.isclose(r["baseline_p_ge1"], run_props.ge_probs(_rate, [("p_ge1", 1)])["p_ge1"])
    # baseline (no matchup) is <= the tonight prob is NOT guaranteed either way; just sane
    assert 0.0 <= r["baseline_p_ge1"] <= 1.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_run_props_pipeline.py::test_run_rows_carry_baseline_and_pace -v`
Expected: FAIL (`KeyError: 'baseline_p_ge1'`).

- [ ] **Step 3: Implement — add baseline + pace in `_run_prop_rows`**

In `model/pipeline.py`, replace the final `row.update(...)` line (~526) with:

```python
                row["pace"] = season_rate  # raw season average per game
                base = _run_props.ge_probs(rate, cfg["thresholds"], nb_size=cfg.get("nb_size"))
                for _k, _v in base.items():
                    row[f"baseline_{_k}"] = _v
                row.update(_run_props.ge_probs(lam, cfg["thresholds"], nb_size=cfg.get("nb_size")))
```

(`rate` = the regressed neutral per-game rate already computed at line 464; `season_rate` = `total/games` already computed at line 469.)

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_run_props_pipeline.py::test_run_rows_carry_baseline_and_pace -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_run_props_pipeline.py
git commit -m "feat(pipeline): baseline probs + season pace on run-prop rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backend — HR baseline + pace

**Files:**
- Modify: `model/pipeline.py` (`build_hr_rows` row dict ~line 117)
- Test: `tests/test_pipeline.py`

**Interfaces:**
- Produces: HR rows gain `baseline_prob` (neutral HR chance) and `pace` (HR/game).

- [ ] **Step 1: Write the failing test**

Append to `tests/test_pipeline.py`:

```python
def test_hr_rows_carry_baseline_and_pace():
    from model.projections import hr_probability
    from model.pipeline import expected_pa_for_slot
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    r = rows[0]
    assert "baseline_prob" in r and "pace" in r
    assert 0.0 <= r["baseline_prob"] <= 1.0
    assert r["pace"] >= 0.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_pipeline.py::test_hr_rows_carry_baseline_and_pace -v`
Expected: FAIL (`KeyError`).

- [ ] **Step 3: Implement — compute baseline + pace in `build_hr_rows`**

In `build_hr_rows`, right before the `rows.append({...})` (after `prob = hr_probability(...)`), add:

```python
                baseline_prob = hr_probability(
                    season_hr=b["season_hr"], season_pa=b["season_pa"],
                    expected_pa=expected_pa_for_slot(slot),
                )  # all multipliers default 1.0 → neutral base chance
                _g = b.get("games", 0)
                hr_pace = (b["season_hr"] / _g) if _g else 0.0
```

Add to the HR row dict (next to `"spray_mult": spray_mult,`):

```python
                    "baseline_prob": baseline_prob, "pace": hr_pace,
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_pipeline.py::test_hr_rows_carry_baseline_and_pace -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat(pipeline): baseline HR chance + HR/game pace on HR rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Backend — Hits / Total Bases baseline + pace

**Files:**
- Modify: `model/pipeline.py` (`_threshold_rows`, before the `row = {...}` ~line 359)
- Test: `tests/test_threshold_pipeline.py`

**Interfaces:**
- Produces: hits rows gain `baseline_p_ge1/2/3`; TB rows gain `baseline_p_ge2/3/4`; both gain `pace` (hits/game or bases/game).

- [ ] **Step 1: Write the failing test**

Append to `tests/test_threshold_pipeline.py` (add `games` to the fixture batter so pace is testable):

```python
def test_threshold_rows_carry_baseline_and_pace():
    b1 = dict(_bat(1, 400, 90, 25, 3, 20), games=100)
    lf = lambda g: {"home": [b1], "away": [dict(_bat(2, 400, 90, 25, 3, 20), games=100)]}
    pf = lambda pid: _pit(pid)
    hits = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    tb = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    hr = next(x for x in hits if x["player_id"] == 1)
    assert "baseline_p_ge1" in hr and "baseline_p_ge2" in hr and "baseline_p_ge3" in hr
    # hits pace = (1b+2b+3b+hr)/games = (90+25+3+20)/100
    assert math.isclose(hr["pace"], (90 + 25 + 3 + 20) / 100)
    tbr = next(x for x in tb if x["player_id"] == 1)
    assert "baseline_p_ge2" in tbr and "baseline_p_ge4" in tbr
    # tb pace = (1b + 2*2b + 3*3b + 4*hr)/games
    assert math.isclose(tbr["pace"], (90 + 2 * 25 + 3 * 3 + 4 * 20) / 100)
```

(Add `import math` at the top of the file if not present.)

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_threshold_pipeline.py::test_threshold_rows_carry_baseline_and_pace -v`
Expected: FAIL (`KeyError`).

- [ ] **Step 3: Implement — neutral baseline vector + pace in `_threshold_rows`**

In `_threshold_rows`, just before `row = {` (~line 359), add:

```python
                # Baseline: batter's own regressed season rates, ALL factors neutral
                # (opp=None zeroes matchup/platoon/pitcher/bvp; eff_park=1, weather=1, form=1).
                bvec, _ = _batter_outcome_vector(
                    b, None, 1.0, 1.0, slot, None,
                    apply_xbh_park=(units == "bases"), park_1b=1.0, park_2b=1.0, park_3b=1.0, form_mult=1.0,
                )
                boutcomes = [bvec[0], bvec[1] + bvec[2] + bvec[3] + bvec[4]] if units == "hits" else bvec
                _g = b.get("games", 0)
                if units == "bases":
                    pace = ((b.get("season_1b", 0) + 2 * b.get("season_2b", 0) + 3 * b.get("season_3b", 0) + 4 * b.get("season_hr", 0)) / _g) if _g else 0.0
                else:
                    pace = ((b.get("season_1b", 0) + b.get("season_2b", 0) + b.get("season_3b", 0) + b.get("season_hr", 0)) / _g) if _g else 0.0
```

Add to the `row = {...}` dict (next to `"spray_pull": _sp["pull"],`):

```python
                    "pace": pace,
```

And after the existing `for label, nthresh in thresholds: row[label] = count_ge_prob(outcomes, epa, nthresh)` loop, add the baseline loop:

```python
                for label, nthresh in thresholds:
                    row[f"baseline_{label}"] = count_ge_prob(boutcomes, epa, nthresh)
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_threshold_pipeline.py::test_threshold_rows_carry_baseline_and_pace -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_threshold_pipeline.py
git commit -m "feat(pipeline): baseline threshold probs + pace on Hits/TB rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Backend — Strikeouts (pitcher) baseline + pace

**Files:**
- Modify: `model/pipeline.py` (`build_strikeout_rows` row dict ~line 169)
- Test: `tests/test_pipeline.py`

**Interfaces:**
- Produces: K rows gain `baseline_over_prob` (neutral, no lineup adj) and `pace` (Ks/start).

- [ ] **Step 1: Write the failing test**

Append to `tests/test_pipeline.py`:

```python
def test_k_rows_carry_baseline_and_pace():
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn)
    r = rows[0]
    assert "baseline_over_prob" in r and "pace" in r
    # pace = neutral Ks/start = k_per_bf * expected_bf
    assert r["pace"] > 0
    assert 0.0 <= r["baseline_over_prob"] <= 1.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/test_pipeline.py::test_k_rows_carry_baseline_and_pace -v`
Expected: FAIL (`KeyError`).

- [ ] **Step 3: Implement — neutral Ks + baseline over-prob in `build_strikeout_rows`**

In `build_strikeout_rows`, after `line = p.get("k_line", 5.5)` (~line 168), add:

```python
            baseline_ks = p["k_per_bf"] * p["expected_bf"]  # neutral: no opposing-lineup adjustment
            baseline_over = poisson_over_prob(baseline_ks, line)
```

Add to the K row dict (next to `"over_prob": poisson_over_prob(lam, line),`):

```python
                "baseline_over_prob": baseline_over, "pace": baseline_ks,
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_pipeline.py::test_k_rows_carry_baseline_and_pace -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py tests/test_pipeline.py
git commit -m "feat(pipeline): baseline over-prob + Ks/start pace on K rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Backend — history twins for baseline + pace

**Files:**
- Modify: `model/export_web.py` (`build_board_with_history`)
- Test: full suite (`uv run pytest -q`)

**Interfaces:**
- Produces: `*_hist` twins for the new baseline/pace fields (so they flip with the source toggle).

- [ ] **Step 1: Add the new fields to the copy sets**

In `model/export_web.py`:
- HR twin copy: after `r["probability_hist"] = h["probability"]`, add:
  ```python
        r["baseline_prob_hist"] = h.get("baseline_prob"); r["pace_hist"] = h.get("pace")
  ```
- K twin copy: after `r["expected_ks_hist"] = h["expected_ks"]`, add:
  ```python
        r["baseline_over_prob_hist"] = h.get("baseline_over_prob"); r["pace_hist"] = h.get("pace")
  ```
- Extend `_hits_factor_fields` to include `"pace"`, `"baseline_p_ge1"`, `"baseline_p_ge2"`, `"baseline_p_ge3"`.
- Extend `_tb_factor_fields` to include `"pace"`, `"baseline_p_ge2"`, `"baseline_p_ge3"`, `"baseline_p_ge4"`.
- Extend `_run_factor_fields` to include `"pace"`, `"baseline_p_ge1"`, `"baseline_p_ge2"`, `"baseline_p_ge3"`, `"baseline_p_ge4"` (superset covers runs/rbi 1/2 and hrr 2/3/4; absent keys are skipped by the `if field in h` guard).

- [ ] **Step 2: Run the full suite**

Run: `uv run pytest -q`
Expected: all green (only additive display fields; no prob assertions change).

- [ ] **Step 3: Commit**

```bash
git add model/export_web.py
git commit -m "feat(export): baseline + pace history twins (source-aware)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Frontend types

**Files:**
- Modify: `web/lib/types.ts`

- [ ] **Step 1: Add fields**

- `HrRow`: `baseline_prob?: number; baseline_prob_hist?: number; pace?: number; pace_hist?: number;`
- `KRow`: `baseline_over_prob?: number; baseline_over_prob_hist?: number; pace?: number; pace_hist?: number;`
- `HitsRow` (inherited by TbRow/RunsRow/RbiRow/HrrRow): `pace?: number; pace_hist?: number; baseline_p_ge1?: number; baseline_p_ge2?: number; baseline_p_ge3?: number; baseline_p_ge1_hist?: number; baseline_p_ge2_hist?: number; baseline_p_ge3_hist?: number;`
- `TbRow` / `HrrRow` extra: `baseline_p_ge4?: number; baseline_p_ge4_hist?: number;`

- [ ] **Step 2: Typecheck** — `cd web && npx tsc --noEmit` → exit 0.

- [ ] **Step 3: Commit**

```bash
git add web/lib/types.ts
git commit -m "feat(web/types): declare baseline + pace fields

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Frontend — `paceText` helper + two rows per prop

**Files:**
- Create: `web/lib/pace.ts`
- Test: `web/lib/tests/pace.test.ts`
- Modify: `web/app/player/[prop]/[id]/page.tsx`

**Interfaces:**
- Produces: `paceText(kind, pace): string`; a `BaselineBlock` rendered on each prop.

- [ ] **Step 1: Write the failing test** — `web/lib/tests/pace.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { paceText } from "../pace";

describe("paceText", () => {
  it("runs/hits/bases per game", () => {
    expect(paceText("runs1", 0.55)).toBe("0.55 runs/game");
    expect(paceText("hits2", 1.12)).toBe("1.1 hits/game");
    expect(paceText("tb3", 1.63)).toBe("1.6 bases/game");
  });
  it("HR phrased as 'every N games'", () => {
    expect(paceText("hr", 0.045)).toBe("~1 HR every 22 games");
  });
  it("K per start", () => {
    expect(paceText("k", 5.8)).toBe("5.8 Ks/start");
  });
  it("zero pace is graceful", () => {
    expect(paceText("hr", 0)).toBe("—");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run lib/tests/pace.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `web/lib/pace.ts`**

```ts
import type { PropKind } from "./format";

/** Human "season pace" for a prop's raw per-game (or per-start) average. */
export function paceText(kind: PropKind, pace: number): string {
  if (!pace || pace <= 0) return "—";
  if (kind === "k") return `${pace.toFixed(1)} Ks/start`;
  if (kind === "hr") return `~1 HR every ${Math.round(1 / pace)} games`;
  if (kind.startsWith("hits")) return `${pace.toFixed(1)} hits/game`;
  if (kind.startsWith("tb")) return `${pace.toFixed(1)} bases/game`;
  if (kind.startsWith("runs")) return `${pace.toFixed(2)} runs/game`;
  if (kind.startsWith("rbi")) return `${pace.toFixed(2)} RBI/game`;
  if (kind.startsWith("hrr")) return `${pace.toFixed(1)} (H+R+RBI)/game`;
  return `${pace.toFixed(2)}/game`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run lib/tests/pace.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Add a shared `BaselineBlock` + render it on each prop**

In `web/app/player/[prop]/[id]/page.tsx`, add a module-level component near `Factor` (uses the same `pick`/`pct` already imported; add `import { paceText } from "../../../../lib/pace"`):

```tsx
function BaselineBlock({ baseline, baselineHist, pace, paceHist, kind, blend, hist }:
  { baseline?: number; baselineHist?: number; pace?: number; paceHist?: number; kind: PropKind; blend: boolean; hist: boolean }) {
  const b = blend && typeof baseline === "number" && typeof baselineHist === "number" ? (baseline + baselineHist) / 2 : (hist && baselineHist != null ? baselineHist : baseline);
  const p = blend && typeof pace === "number" && typeof paceHist === "number" ? (pace + paceHist) / 2 : (hist && paceHist != null ? paceHist : pace);
  if (typeof b !== "number" && typeof p !== "number") return null;
  return (
    <div className="panel rise" style={{ animationDelay: "100ms" }}>
      <div className="eyebrow mb-1">His base level</div>
      {typeof b === "number" && (
        <div className="factor-head"><span>📊 Baseline chance</span><span className="delta flat">{pct(b)}</span></div>
      )}
      {typeof p === "number" && p > 0 && (
        <div className="factor-note" style={{ marginTop: 4 }}>📈 Season pace · {paceText(kind, p)}</div>
      )}
    </div>
  );
}
```

Then on each prop branch, render it right after the headline `Stat`/"Our read" panel and before the "What's driving it" panel, passing the threshold-matched baseline:
- **HR:** `<BaselineBlock baseline={r.baseline_prob} baselineHist={r.baseline_prob_hist} pace={r.pace} paceHist={r.pace_hist} kind="hr" blend={blend} hist={hist} />`
- **Hits:** baseline field = `r[\`baseline_p_ge${hitsThreshold}\`]` and hist twin `r[\`baseline_p_ge${hitsThreshold}_hist\`]`; `kind={hitsKind}`.
- **TB:** `baseline_p_ge${tbThreshold}` (+`_hist`); `kind={tbKind}`.
- **Runs/RBI:** `baseline_p_ge${n}` (+`_hist`); `kind={kind}`.
- **HRR:** `baseline_p_ge${hrrThreshold}` (+`_hist`); `kind={kind}`.
- **K:** `baseline={r.baseline_over_prob} baselineHist={r.baseline_over_prob_hist} pace={r.pace} paceHist={r.pace_hist} kind="k"`.

(Read the threshold-indexed baseline with a tiny inline helper, e.g. `const baseAt = (n: number) => (r as Record<string, number|undefined>)[\`baseline_p_ge${n}\`];` inside each threshold branch.)

- [ ] **Step 6: Typecheck + lint + vitest**

Run: `cd web && npx tsc --noEmit && npx vitest run && npx eslint app components lib`
Expected: tsc 0, vitest all pass, no NEW eslint errors.

- [ ] **Step 7: Commit**

```bash
git add web/lib/pace.ts web/lib/tests/pace.test.ts "web/app/player/[prop]/[id]/page.tsx"
git commit -m "feat(web): baseline + season-pace rows on every prop page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Verification — regenerate board + preview all props

- [ ] **Step 1: Full Python suite** — `uv run pytest -q` → all green.
- [ ] **Step 2: Regenerate a local board** — `uv run python -m model.export_web 2026-06-26 1 --include-started`; confirm `grep -c baseline_ web/public/data/latest.json` > 0 and `grep -c '"pace"' web/public/data/latest.json` > 0.
- [ ] **Step 3: Dev server + eyeball** — `cd web && npm run dev`; open a player page for **each** prop (hr/hits/tb/runs/rbi/hrr/k) and each source mode (current/blend/hist). Confirm the "His base level" panel shows Baseline chance % + Season pace, the baseline tracks the selected threshold, and both flip with the source toggle.
- [ ] **Step 4: Report for preview-before-prod** — share localhost; wait for approval before merge + deploy (`force_deploy` so the new fields land on the live board). Mirror in the design mock.

---

## Self-Review

**Spec coverage:** two rows all props (Tasks 1-4 backend + Task 7 frontend) ✓ · baseline = neutral formula (Tasks 1-4 use factors=1) ✓ · pace raw average, per-prop wording (Task 7 `paceText`) ✓ · per-threshold baseline (Task 7 threshold-indexed read) ✓ · source-aware `_hist` (Task 5 + BaselineBlock `pick` logic) ✓ · no math change (Task 5 Step 2 keeps prob tests green) ✓ · testing (Tasks 1-4,7 unit; 8 manual) ✓.

**Placeholder scan:** none — complete code/commands throughout. Threshold-indexed baseline read is spelled out with the `baseAt`/record-cast pattern.

**Type consistency:** field names `baseline_prob`, `baseline_p_ge{1..4}`, `baseline_over_prob`, `pace` (+ `_hist`) match across Python emit (Tasks 1-4), export twins (Task 5), TS types (Task 6), and frontend reads (Task 7). `paceText(kind, pace)` signature matches its test + call.
