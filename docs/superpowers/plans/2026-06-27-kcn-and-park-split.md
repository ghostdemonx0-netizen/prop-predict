# KCN Capture+Grading & Park/Weather Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture KCN (matchup K/Neutral/Contact reads) and split park-vs-weather in the recorder, then grade KCN per batter-vs-starter in the grader — so both can be calibrated.

**Architecture:** Two phases on two branches. **Phase A** (recorder, branch `feat/kcn-recorder` off `main`, since the recorder is live): capture-only additions to `model/archive.py` + `model/pipeline.py`, merged to main, then wipe/recapture today. **Phase B** (grader, existing `feat/predictions-grader` rebased on updated main): a play-by-play fetch + new matchup-level grading in `model/grader.py`, writing a separate `kcn-grades` file.

**Tech Stack:** Python 3.12, `statsapi`, `pytest`, GitHub Actions.

## Global Constraints

- Python 3.12; standard library + existing deps only.
- **All recorder changes are capture-only — NO projection may change.** Phase A pins existing `p_geN` probabilities with a regression test. No math sign-off needed.
- Privacy: everything reads/writes ONLY the `predictions-archive` branch; never `web/public/data`.
- KCN is a per **batter-vs-pitcher** read: fields `k_prob`, `c_prob` (= the model's `hit_prob`), `lean` (∈ `"K"`/`"NEU"`/`"H"`).
- KCN graded **starter-only** (play-by-play), not whole-game.
- KCN grade file `archive/YYYY-MM-DD.kcn-grades.jsonl` is mutable/idempotent (overwritten each run), separate from prop grades.
- Tests run with `uv run pytest`.

---

## File Structure
- **Modify `model/archive.py`** — Phase A: capture `kcn` on strikeouts records; add `park_factor`/`weather_factor` to `_FACTOR_KEYS`.
- **Modify `model/pipeline.py`** — Phase A: store `park_factor` + `weather_factor` on Hits/TB rows (capture-only).
- **Modify `model/fetch.py`** — Phase B: `_parse_pbp` (pure) + `game_pbp` (network).
- **Modify `model/grader.py`** — Phase B: `tally_vs_starter`, `grade_kcn_matchup`, `grade_kcn_day`, `grade_kcn_file`, CLI writes both grade files.
- **Modify `.github/workflows/grade-predictions.yml`** — Phase B: commit `*.kcn-grades.jsonl` too.
- **Tests:** `tests/test_archive.py`, `tests/test_run_props_pipeline.py` (or `tests/test_grader.py` for Phase B fetch/grade).

---

# PHASE A — Recorder (branch `feat/kcn-recorder` off `main`)

### Task 1: [Phase A] Capture KCN on strikeouts records

**Files:**
- Modify: `model/archive.py` (in `record_from_row`, strikeouts branch)
- Test: `tests/test_archive.py`

**Interfaces:**
- Produces: strikeouts archive records gain `rec["kcn"] = [{"player_id","k_prob","c_prob","lean"}, ...]` sourced from `row["matchups"]` (each matchup entry has `player_id`, `k_prob`, `hit_prob`, `lean`).

- [ ] **Step 1: Write the failing test**

```python
def test_record_strikeouts_captures_kcn():
    from model.archive import record_from_row
    row = {
        "game_id": 1, "player_id": 99, "player": "Ace", "team": "NYY",
        "over_prob": 0.55, "line": 6.5,
        "matchups": [
            {"player_id": 11, "name": "A", "k_prob": 0.30, "hit_prob": 0.22, "lean": "K"},
            {"player_id": 12, "name": "B", "k_prob": 0.18, "hit_prob": 0.28, "lean": "H"},
        ],
    }
    rec = record_from_row(row, "strikeouts")
    assert rec["kcn"] == [
        {"player_id": 11, "k_prob": 0.30, "c_prob": 0.22, "lean": "K"},
        {"player_id": 12, "k_prob": 0.18, "c_prob": 0.28, "lean": "H"},
    ]

def test_record_strikeouts_no_matchups_omits_kcn():
    from model.archive import record_from_row
    rec = record_from_row({"game_id": 1, "player_id": 99, "over_prob": 0.5, "line": 6.5}, "strikeouts")
    assert "kcn" not in rec
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_archive.py -k kcn -v`
Expected: FAIL (`KeyError: 'kcn'` / assertion)

- [ ] **Step 3: Write minimal implementation**

In `model/archive.py`, inside `record_from_row`, in the `prop_lower == "strikeouts"` branch (after the probs block, before `rec["factors"]`), add:

```python
        matchups = row.get("matchups") or []
        if matchups:
            rec["kcn"] = [
                {
                    "player_id": m.get("player_id"),
                    "k_prob":    m.get("k_prob"),
                    "c_prob":    m.get("hit_prob"),
                    "lean":      m.get("lean"),
                }
                for m in matchups
            ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_archive.py -k kcn -v`
Expected: PASS. Then full: `uv run pytest tests/test_archive.py -q` (no regressions).

- [ ] **Step 5: Commit**

```bash
git add model/archive.py tests/test_archive.py
git commit -m "feat(archive): capture KCN (k_prob/c_prob/lean) on strikeouts records (A1)"
```

---

### Task 2: [Phase A] Split park/weather for Hits/TB (capture-only)

**Files:**
- Modify: `model/pipeline.py` (`_threshold_rows`, the TB park/weather block ~300–332)
- Modify: `model/archive.py` (`_FACTOR_KEYS`: add `park_factor`, `weather_factor`)
- Test: `tests/test_run_props_pipeline.py`

**Interfaces:**
- Produces: Hits/TB rows gain `row["park_factor"]` and `row["weather_factor"]` (floats; both `1.0` for Hits, which is park/weather-neutral). The existing `park_weather_factor` stays. `archive._FACTOR_KEYS` captures the two new fields.

- [ ] **Step 1: Write the failing test** (pins projections unchanged + new fields present)

```python
# tests/test_run_props_pipeline.py (append)
def test_tb_rows_split_park_and_weather_without_changing_probs():
    from model.pipeline import build_total_bases_rows
    # Reuse this module's existing slate/lineup/pitcher/weather fixtures.
    # (Build a TB row exactly as the existing pipeline tests in this file do.)
    rows = _build_tb_rows_for_test()  # helper mirrors existing fixture setup in this file
    r = rows[0]
    # New fields exist and are sane multipliers
    assert "park_factor" in r and "weather_factor" in r
    assert 0.5 < r["park_factor"] < 2.0
    assert 0.5 < r["weather_factor"] < 2.0
    # Split is consistent with the combined factor (within rounding)
    assert abs(r["park_factor"] * r["weather_factor"] - r["park_weather_factor"]) < 0.05
    # PROJECTIONS UNCHANGED: pin the p_ge values to the pre-change output
    assert r["p_ge2"] == _PINNED_TB_P_GE2   # implementer fills from current code output
    assert r["p_ge3"] == _PINNED_TB_P_GE3
    assert r["p_ge4"] == _PINNED_TB_P_GE4
```

Implementer note: write `_build_tb_rows_for_test()` using the SAME fixture pattern already in `tests/test_run_props_pipeline.py`. Before implementing Step 3, run the helper against current code to read the real `p_ge2/3/4` values and paste them into `_PINNED_TB_P_GE*` — that is the regression baseline proving Step 3 doesn't move any probability.

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_run_props_pipeline.py -k split_park -v`
Expected: FAIL (`KeyError: 'park_factor'`)

- [ ] **Step 3: Write minimal implementation**

In `model/pipeline.py` `_threshold_rows`, inside the `if units == "bases":` block where `park_weather_factor` is computed (right after `nenv_ev` is set, ~line 308), add the two split factors:

```python
                    # split: park-only (weather neutral) and weather-only (park neutral)
                    pk_vec, _ = _batter_outcome_vector(
                        b, opp, eff_park, 1.0, slot, bvp,
                        apply_xbh_park=True, park_1b=p1f, park_2b=p2f, park_3b=p3f,
                    )
                    pk_ev = pk_vec[1] + 2 * pk_vec[2] + 3 * pk_vec[3] + 4 * pk_vec[4]
                    park_factor = (pk_ev / nenv_ev) if nenv_ev > 0 else 1.0
                    wx_vec, _ = _batter_outcome_vector(
                        b, opp, 1.0, weather_mult, slot, bvp,
                        apply_xbh_park=True, park_1b=1.0, park_2b=1.0, park_3b=1.0,
                    )
                    wx_ev = wx_vec[1] + 2 * wx_vec[2] + 3 * wx_vec[3] + 4 * wx_vec[4]
                    weather_factor = (wx_ev / nenv_ev) if nenv_ev > 0 else 1.0
```

Initialize `park_factor = 1.0` and `weather_factor = 1.0` alongside the existing `park_weather_factor = 1.0` (line ~300, before the `if units == "bases"`). Then add both to the `row` dict (next to `"park_weather_factor": park_weather_factor,`):

```python
                    "park_factor": park_factor,
                    "weather_factor": weather_factor,
```

IMPORTANT: do not touch `actual_vec`, `outcomes`, `epa`, or the `count_ge_prob` calls — the probabilities must stay identical. The new vectors are used ONLY for the stored factors.

Then in `model/archive.py` `_FACTOR_KEYS`, add `"park_factor",` and `"weather_factor",` (in the threshold-families group).

- [ ] **Step 4: Run tests to verify pass + no regressions**

Run: `uv run pytest tests/test_run_props_pipeline.py -k split_park -v`
Expected: PASS (incl. the pinned p_ge equality).
Then: `uv run pytest tests/test_run_props_pipeline.py tests/test_archive.py tests/test_run_props.py -q` — all green.

- [ ] **Step 5: Commit**

```bash
git add model/pipeline.py model/archive.py tests/test_run_props_pipeline.py
git commit -m "feat(pipeline): record park_factor + weather_factor for Hits/TB, captured by recorder (A2)"
```

**After Phase A review passes:** controller merges `feat/kcn-recorder` → `main`, lets a recorder run pick up the new code, then wipes `archive/2026-06-27.jsonl` on `predictions-archive` so today's frozen games re-capture with KCN + split-park fields. (Operational — not a code task.)

---

# PHASE B — Grader (branch `feat/predictions-grader`, rebased on updated `main`)

### Task 3: [Phase B] Play-by-play fetch (`_parse_pbp` + `game_pbp`)

**Files:**
- Modify: `model/fetch.py` (append)
- Test: `tests/test_grader.py`

**Interfaces:**
- Produces: `fetch._parse_pbp(data: dict) -> list[dict]` returning `[{"batter_id","pitcher_id","kind"}]` where `kind ∈ {"k","hit","other"}` for completed plate appearances; and `fetch.game_pbp(game_id) -> list[dict]` (network wrapper, `[]` on failure).

- [ ] **Step 1: Write the failing test**

```python
def test_parse_pbp_classifies_k_hit_other():
    from model import fetch
    data = {"allPlays": [
        {"about": {"isComplete": True}, "matchup": {"batter": {"id": 11}, "pitcher": {"id": 99}},
         "result": {"eventType": "strikeout"}},
        {"about": {"isComplete": True}, "matchup": {"batter": {"id": 11}, "pitcher": {"id": 99}},
         "result": {"eventType": "single"}},
        {"about": {"isComplete": True}, "matchup": {"batter": {"id": 12}, "pitcher": {"id": 99}},
         "result": {"eventType": "walk"}},
        {"about": {"isComplete": False}, "matchup": {"batter": {"id": 13}, "pitcher": {"id": 99}},
         "result": {"eventType": "single"}},  # incomplete -> skipped
    ]}
    out = fetch._parse_pbp(data)
    assert out == [
        {"batter_id": 11, "pitcher_id": 99, "kind": "k"},
        {"batter_id": 11, "pitcher_id": 99, "kind": "hit"},
        {"batter_id": 12, "pitcher_id": 99, "kind": "other"},
    ]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_grader.py -k parse_pbp -v`
Expected: FAIL (`AttributeError: ... '_parse_pbp'`)

- [ ] **Step 3: Write minimal implementation** (append to `model/fetch.py`)

```python
_PBP_K_EVENTS   = {"strikeout", "strikeout_double_play"}
_PBP_HIT_EVENTS = {"single", "double", "triple", "home_run"}


def _parse_pbp(data: dict) -> list[dict]:
    """Pure: statsapi game_playByPlay -> [{batter_id, pitcher_id, kind}] for
    COMPLETED plate appearances. kind: 'k' | 'hit' | 'other'."""
    out: list[dict] = []
    for play in data.get("allPlays", []) or []:
        if not (play.get("about", {}) or {}).get("isComplete"):
            continue
        mu = play.get("matchup", {}) or {}
        bid = (mu.get("batter") or {}).get("id")
        pid = (mu.get("pitcher") or {}).get("id")
        if bid is None or pid is None:
            continue
        et = ((play.get("result") or {}).get("eventType") or "").lower()
        kind = "k" if et in _PBP_K_EVENTS else ("hit" if et in _PBP_HIT_EVENTS else "other")
        out.append({"batter_id": int(bid), "pitcher_id": int(pid), "kind": kind})
    return out


def game_pbp(game_id: int) -> list[dict]:
    """Plate-appearance list for one game (network-tolerant: [] on failure)."""
    try:
        data = _with_retries(lambda: statsapi.get("game_playByPlay", {"gamePk": game_id}))
    except Exception:
        return []
    return _parse_pbp(data)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_grader.py -k parse_pbp -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py tests/test_grader.py
git commit -m "feat(grader): play-by-play fetch + parse (B1)"
```

---

### Task 4: [Phase B] KCN matchup grading core

**Files:**
- Modify: `model/grader.py`
- Test: `tests/test_grader.py`

**Interfaces:**
- Produces: `grader.tally_vs_starter(pbp, batter_id, starter_id) -> dict` (`{"pa","k","hit"}`); `grader.grade_kcn_matchup(kcn_entry, starter_id, game_id, date, pbp, *, final_retry, now_iso, game_final) -> dict | None`; `grader.grade_kcn_day(predictions, pbp_by_game, final_games, *, final_retry, now_iso) -> list[dict]`. Consumes the `kcn` list on strikeouts predictions (entries `{player_id, k_prob, c_prob, lean}`) and pbp entries from B1.

- [ ] **Step 1: Write the failing test**

```python
def test_tally_and_grade_kcn_matchup():
    from model import grader
    pbp = [
        {"batter_id": 11, "pitcher_id": 99, "kind": "k"},
        {"batter_id": 11, "pitcher_id": 99, "kind": "hit"},
        {"batter_id": 11, "pitcher_id": 50, "kind": "hit"},   # vs reliever -> ignored
    ]
    assert grader.tally_vs_starter(pbp, 11, 99) == {"pa": 2, "k": 1, "hit": 1}
    kcn = {"player_id": 11, "k_prob": 0.3, "c_prob": 0.25, "lean": "K"}
    g = grader.grade_kcn_matchup(kcn, 99, 776, "2026-06-27", pbp,
                                 final_retry=False, now_iso="x", game_final=True)
    assert g["status"] == "graded"
    assert g["batter_id"] == 11 and g["pitcher_id"] == 99
    assert g["pa"] == 2 and g["k"] == 1 and g["hit"] == 1
    assert g["pred"] == {"k_prob": 0.3, "c_prob": 0.25, "lean": "K"}
    assert g["actual_lean"] == "K"   # k(1) == hit(1) and k>0 -> K wins ties

def test_grade_kcn_void_no_pa_and_unsettled():
    from model import grader
    kcn = {"player_id": 11, "k_prob": 0.3, "c_prob": 0.25, "lean": "K"}
    # final game, batter never faced the starter -> void no_pa
    g = grader.grade_kcn_matchup(kcn, 99, 776, "2026-06-27", [],
                                 final_retry=False, now_iso="x", game_final=True)
    assert g["status"] == "void" and g["void_reason"] == "no_pa"
    # not final, not last retry -> None (unsettled)
    assert grader.grade_kcn_matchup(kcn, 99, 776, "2026-06-27", [],
                                    final_retry=False, now_iso="x", game_final=False) is None
    # not final, final_retry -> void postponed
    g2 = grader.grade_kcn_matchup(kcn, 99, 776, "2026-06-27", [],
                                  final_retry=True, now_iso="x", game_final=False)
    assert g2["status"] == "void" and g2["void_reason"] == "postponed"

def test_grade_kcn_day_iterates_strikeouts_preds():
    from model import grader
    preds = [
        {"date": "2026-06-27", "game_id": 776, "player_id": 99, "prop": "strikeouts",
         "kcn": [{"player_id": 11, "k_prob": 0.3, "c_prob": 0.2, "lean": "K"}]},
        {"date": "2026-06-27", "game_id": 776, "player_id": 11, "prop": "hits"},  # ignored
    ]
    pbp_by_game = {776: [{"batter_id": 11, "pitcher_id": 99, "kind": "hit"}]}
    grades = grader.grade_kcn_day(preds, pbp_by_game, {776}, final_retry=False, now_iso="x")
    assert len(grades) == 1
    assert grades[0]["actual_lean"] == "H" and grades[0]["hit"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_grader.py -k kcn -v`
Expected: FAIL (functions not defined)

- [ ] **Step 3: Write minimal implementation** (append to `model/grader.py`)

```python
def tally_vs_starter(pbp: list[dict], batter_id, starter_id) -> dict:
    """Count this batter's plate appearances vs ONLY the starter: pa/k/hit."""
    pa = k = hit = 0
    for ev in pbp:
        if ev.get("batter_id") == batter_id and ev.get("pitcher_id") == starter_id:
            pa += 1
            if ev.get("kind") == "k":
                k += 1
            elif ev.get("kind") == "hit":
                hit += 1
    return {"pa": pa, "k": k, "hit": hit}


def _actual_lean(k: int, hit: int) -> str:
    if k > 0 and k >= hit:
        return "K"
    if hit > 0 and hit > k:
        return "H"
    return "NEU"


def grade_kcn_matchup(kcn_entry, starter_id, game_id, date, pbp, *,
                      final_retry, now_iso, game_final) -> dict | None:
    """Grade one batter-vs-starter KCN read. None = unsettled (retry)."""
    rec = {
        "date": date, "game_id": game_id,
        "batter_id": kcn_entry.get("player_id"), "pitcher_id": starter_id,
        "pred": {"k_prob": kcn_entry.get("k_prob"),
                 "c_prob": kcn_entry.get("c_prob"),
                 "lean":   kcn_entry.get("lean")},
        "graded_at": now_iso,
    }
    if not game_final:
        if final_retry:
            rec["status"] = "void"; rec["void_reason"] = "postponed"
            return rec
        return None
    t = tally_vs_starter(pbp, kcn_entry.get("player_id"), starter_id)
    if t["pa"] == 0:
        rec["status"] = "void"; rec["void_reason"] = "no_pa"
        return rec
    rec["status"] = "graded"
    rec["pa"] = t["pa"]; rec["k"] = t["k"]; rec["hit"] = t["hit"]
    rec["actual_lean"] = _actual_lean(t["k"], t["hit"])
    return rec


def grade_kcn_day(predictions, pbp_by_game, final_games, *, final_retry, now_iso) -> list[dict]:
    """Grade every KCN read across the date's strikeouts predictions."""
    out: list[dict] = []
    for pred in predictions:
        if pred.get("prop") != "strikeouts" or not pred.get("kcn"):
            continue
        gid = pred.get("game_id")
        starter_id = pred.get("player_id")
        pbp = pbp_by_game.get(gid, [])
        game_final = gid in final_games
        for entry in pred["kcn"]:
            g = grade_kcn_matchup(entry, starter_id, gid, pred.get("date"), pbp,
                                  final_retry=final_retry, now_iso=now_iso,
                                  game_final=game_final)
            if g is not None:
                out.append(g)
    return out
```

- [ ] **Step 4: Run tests to verify pass**

Run: `uv run pytest tests/test_grader.py -k kcn -v` then `uv run pytest tests/test_grader.py -q`
Expected: PASS (new KCN tests + all prior grader tests).

- [ ] **Step 5: Commit**

```bash
git add model/grader.py tests/test_grader.py
git commit -m "feat(grader): KCN matchup grading core — tally + grade_kcn_day (B2)"
```

---

### Task 5: [Phase B] KCN file I/O + CLI + workflow wiring

**Files:**
- Modify: `model/grader.py` (add `grade_kcn_file`; CLI writes both files)
- Modify: `.github/workflows/grade-predictions.yml`
- Test: `tests/test_grader.py`

**Interfaces:**
- Produces: `grader.grade_kcn_file(predictions_path, kcn_grades_path, slate_date, now_iso, *, pbp_fn=None, status_fn=None, window_days=3) -> int`. Writes/overwrites the kcn-grades JSONL. CLI runs prop grading AND kcn grading for a date.

- [ ] **Step 1: Write the failing test**

```python
def test_grade_kcn_file_writes_and_overwrites(tmp_path):
    import json
    from model import grader
    preds = tmp_path / "2026-06-27.jsonl"
    out = tmp_path / "2026-06-27.kcn-grades.jsonl"
    preds.write_text(json.dumps({
        "date": "2026-06-27", "game_id": 776, "player_id": 99, "prop": "strikeouts",
        "kcn": [{"player_id": 11, "k_prob": 0.3, "c_prob": 0.2, "lean": "K"}],
    }) + "\n")
    pbp = {776: [{"batter_id": 11, "pitcher_id": 99, "kind": "k"}]}
    status = {776: "final"}
    n = grader.grade_kcn_file(str(preds), str(out), "2026-06-27", "2026-06-28T13:00:00Z",
                              pbp_fn=lambda g: pbp.get(g, []),
                              status_fn=lambda g: status.get(g, "other"), window_days=3)
    assert n == 1
    rows = [json.loads(l) for l in out.read_text().splitlines() if l.strip()]
    assert rows[0]["actual_lean"] == "K" and rows[0]["k"] == 1
    # idempotent overwrite
    grader.grade_kcn_file(str(preds), str(out), "2026-06-27", "2026-06-28T13:00:00Z",
                          pbp_fn=lambda g: pbp.get(g, []),
                          status_fn=lambda g: status.get(g, "other"))
    rows2 = [l for l in out.read_text().splitlines() if l.strip()]
    assert len(rows2) == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_grader.py -k kcn_file -v`
Expected: FAIL (`grade_kcn_file` not defined)

- [ ] **Step 3: Write minimal implementation**

Add to `model/grader.py` (reuses `_read_jsonl` from Task 6, and `game_pbp` from B1; `status_fn` defaults to reading `fetch.game_boxscore(g)["status"]`):

```python
def grade_kcn_file(predictions_path, kcn_grades_path, slate_date, now_iso, *,
                   pbp_fn=None, status_fn=None, window_days: int = 3) -> int:
    """Grade KCN matchups for one date, OVERWRITE the kcn-grades JSONL, return count."""
    pbp_fn = pbp_fn or _fetch.game_pbp
    if status_fn is None:
        def status_fn(g):
            return _fetch.game_boxscore(g).get("status", "other")
    preds = _read_jsonl(predictions_path)
    if not preds:
        return 0
    try:
        now_d = datetime.fromisoformat(now_iso.replace("Z", "+00:00")).date()
    except (ValueError, AttributeError):
        final_retry = False
    else:
        final_retry = (now_d - _date.fromisoformat(slate_date)).days >= (window_days - 1)

    game_ids = {p.get("game_id") for p in preds
                if p.get("prop") == "strikeouts" and p.get("kcn") and p.get("game_id") is not None}
    pbp_by_game = {g: pbp_fn(g) for g in game_ids}
    final_games = {g for g in game_ids if status_fn(g) == "final"}

    grades = grade_kcn_day(preds, pbp_by_game, final_games,
                           final_retry=final_retry, now_iso=now_iso)
    with open(kcn_grades_path, "w", encoding="utf-8") as fh:
        for g in grades:
            fh.write(json.dumps(g, separators=(",", ":")) + "\n")
    return len(grades)
```

Update the `__main__` CLI so it writes BOTH grade files for the date. Replace the single `grade_file` call with:

```python
        prop_out = args[1]
        grade_file(args[0], prop_out, args[2], now)
        if prop_out.endswith(".grades.jsonl"):
            kcn_out = prop_out[:-len(".grades.jsonl")] + ".kcn-grades.jsonl"
        else:
            kcn_out = prop_out + ".kcn-grades.jsonl"
        grade_kcn_file(args[0], kcn_out, args[2], now)
        print(f"{prop_out}; {kcn_out}")
```

- [ ] **Step 4: Run tests to verify pass**

Run: `uv run pytest tests/test_grader.py -q`
Expected: PASS (all grader tests incl. KCN file).

- [ ] **Step 5: Update the workflow to commit kcn-grades too**

In `.github/workflows/grade-predictions.yml`, the grader call already produces `archive/${d}.kcn-grades.jsonl` next to `${d}.grades.jsonl` (CLI writes both). Update the copy + add lines in the commit step so both patterns are committed:

```yaml
          cp "$workdir"/*.grades.jsonl "$workdir"/*.kcn-grades.jsonl archive/ 2>/dev/null || true
          git add archive/*.grades.jsonl archive/*.kcn-grades.jsonl
```

(The `set +` change-detection guard `git diff --cached --quiet` already covers both.) Validate parse:
`python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/grade-predictions.yml')); print('jobs:', list(d['jobs']))"` → `jobs: ['grade']`.

- [ ] **Step 6: Commit**

```bash
git add model/grader.py tests/test_grader.py .github/workflows/grade-predictions.yml
git commit -m "feat(grader): KCN grade file + CLI writes both grade files + workflow wiring (B3)"
```

**After Phase B review passes:** controller merges `feat/predictions-grader` → `main` and the user adds the cron-job.org daily trigger (enable).

---

## Self-Review

**1. Spec coverage:**
- A1 capture KCN → Task A1 ✅
- A2 split park/weather (capture-only, projections unchanged) → Task A2 (pinned p_ge test) ✅
- A3 wipe/recapture → post-Phase-A operational note ✅
- B1 play-by-play fetch → Task B1 ✅
- B1 KCN grading starter-only, both views, void no_pa, separate mutable file → Tasks B2 + B3 ✅
- B2 park calibration needs no grader code → noted (no task needed) ✅
- Sequence recorder→recapture→grader→merge→enable → phase ordering + operational notes ✅

**2. Placeholder scan:** `_PINNED_TB_P_GE*` and `_build_tb_rows_for_test()` are explicit implementer instructions (pin real values from current code / mirror existing fixtures), not vague TODOs. No other placeholders.

**3. Type consistency:** `kcn` entry shape `{player_id,k_prob,c_prob,lean}` identical in A1, B2, B3. `grade_kcn_matchup`/`grade_kcn_day`/`grade_kcn_file` signatures consistent across B2/B3. pbp entry `{batter_id,pitcher_id,kind}` identical in B1/B2. `status == "final"` matches Task 1's `_norm_status`. ✅
