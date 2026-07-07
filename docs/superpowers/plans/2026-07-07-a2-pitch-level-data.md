# A2 — Pitch-Level Data Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Compute the pitch-level data family (SwStr%, CSW%, Ball%, ZoneFit) + ISO + full xwOBA, for batter and pitcher sides, and surface them on the board — DATA/DISPLAY only, no math wiring, no sign-off (like Phase 0).

**Architecture:** The event pull already returns every pitch row; add pitch-descriptor columns (like Phase 0 added barrel columns) + bump the cache key. Pure helpers in `model/pitch_metrics.py` (SwStr/CSW/Ball + per-zone damage/frequency + `zone_fit`) and `model/xstats.py` (ISO, full xwOBA) compute the metrics; merge into the batter/pitcher profiles (+ blended). Surface on the boards payload. No probability/nudge/score math changes.

**Tech Stack:** Python 3, pybaseball (Statcast), pytest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-07-a2-pitch-level-data-design.md`.
- **DATA/DISPLAY ONLY, ZERO math change:** do NOT touch `projections.py`, `pipeline.py` prob math, `run_props.py`, `matchup.py`, `barrel_effect.py`, `prop_score.py`. This phase only computes new profile fields + surfaces them.
- **Roles:** ZoneFit/SwStr/CSW are *future* math voters (wired later); ISO/xwOBA/Ball% are context/viewers. This phase wires NONE of them into math.
- **Verified data:** every pitch row is present (73 mid-count pitches in a 95-pitch sample). Pitch fields present: `description` (ball/blocked_ball/called_strike/swinging_strike/swinging_strike_blocked/foul/foul_tip/hit_into_play), `zone` (1–9, 11–14), `type`, `plate_x/z`, `woba_value`, `woba_denom`, `estimated_woba_using_speedangle`.
- **No-lookahead:** all metrics use events strictly before `as_of` (mirror the `game_date < as_of` pattern).
- **Additive:** full pytest suite MUST stay green after every task.
- **Testing:** pytest via `.venv/bin/python -m pytest` from repo root. Mirror `tests/test_barrel.py` patterns.

---

### Task 1: Pull pitch-descriptor columns + bump cache key

**Files:** Modify `model/fetch.py`, `model/export_web.py`.

- [ ] **Step 1: Add pitch-descriptor columns**

In `model/fetch.py`, extend `_BATTER_EVENT_COLS` and `_PITCHER_EVENT_COLS` (which already carry the barrel columns) with the pitch-level fields — append these to BOTH lists: `"description", "zone", "type", "plate_x", "plate_z", "woba_value", "woba_denom"`. Leave `_DAY_EVENT_COLS` unchanged.

- [ ] **Step 2: Bump the event cache key v2 → v3**

In `model/export_web.py`, change the three event cache keys from `-v2-` to `-v3-` (the `bat-events-v2`, `pit-events-v2`, and the `_events_by_season` prefix `-v2` — grep `grep -n "events-v2\|events-v2-" model/export_web.py` and bump each). Leave all non-event cache keys untouched.

- [ ] **Step 3: Verify the columns survive the slim pull**

Run:
```bash
.venv/bin/python -c "
from model import fetch
rows = fetch.pitcher_events(605400, 2024)
r = next(e for e in rows if e.get('description'))
assert 'zone' in r and 'description' in r and 'woba_denom' in r
print('keys ok; total pitch rows:', len(rows), '| with zone:', sum(1 for e in rows if e.get('zone') is not None))
print('OK')
"
```
Expected: prints keys ok, a large pitch count, and OK.

- [ ] **Step 4: Verify nothing else broke**

Run: `.venv/bin/python -c "import model.fetch, model.export_web"` → clean import. Then `.venv/bin/python -m pytest -q -k fetch` (or confirm no fetch tests → skip).

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py model/export_web.py
git commit -m "feat(a2): pull pitch-descriptor columns (description/zone/type/plate/woba) + bump cache v3"
```

---

### Task 2: SwStr% / CSW% / Ball% — `pitch_metrics.py` + profiles

**Files:** Create `model/pitch_metrics.py`, `tests/test_pitch_metrics.py`; Modify `model/profiles.py`, `tests/test_profile_components.py`.

- [ ] **Step 1: Write the failing helper test**

Create `tests/test_pitch_metrics.py`:

```python
from model.pitch_metrics import pitch_rates

def _p(d, desc, zone=5):
    return {"game_date": d, "description": desc, "zone": zone}

def test_swstr_csw_ball_rates():
    pitches = [
        _p("2026-04-01", "swinging_strike"),
        _p("2026-04-01", "called_strike"),
        _p("2026-04-01", "ball"),
        _p("2026-04-01", "foul"),          # not swstr, not csw, not ball
        _p("2026-04-01", "hit_into_play"),
    ]
    m = pitch_rates(pitches, as_of="2026-06-01")
    assert m["pitches"] == 5
    assert m["swstr"] == 1/5           # 1 swinging_strike
    assert m["csw"] == 2/5             # called + swinging
    assert m["ball"] == 1/5
    assert abs(m["swstr"] - 0.2) < 1e-9

def test_respects_as_of_and_empty():
    assert pitch_rates([_p("2026-07-01", "swinging_strike")], as_of="2026-06-01")["pitches"] == 0
    assert pitch_rates([], as_of="2026-06-01")["swstr"] == 0.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_pitch_metrics.py -q` → FAIL (module not found).

- [ ] **Step 3: Implement `model/pitch_metrics.py`**

```python
"""Pure pitch-level metrics from slim per-pitch rows. SwStr% / CSW% / Ball% over
all pitches strictly before as_of. (For a batter: pitches thrown to him -> his
whiff rate. For a pitcher: pitches he threw -> his induced rate.) No I/O."""

_SWSTR = {"swinging_strike", "swinging_strike_blocked"}
_CSW = _SWSTR | {"called_strike"}
_BALL = {"ball", "blocked_ball"}


def pitch_rates(pitches: list[dict], *, as_of: str) -> dict:
    past = [p for p in pitches if p["game_date"] < as_of and p.get("description")]
    n = len(past)

    def rate(kinds: set) -> float:
        return (sum(1 for p in past if p.get("description") in kinds) / n) if n else 0.0

    return {"swstr": rate(_SWSTR), "csw": rate(_CSW), "ball": rate(_BALL), "pitches": n}
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/python -m pytest tests/test_pitch_metrics.py -q` → PASS.

- [ ] **Step 5: Merge into profiles + failing profile test**

Add to `tests/test_profile_components.py`:

```python
def test_batter_profile_has_pitch_rates():
    evs = [_brow("2026-04-01", "single", ls=90, bb="line_drive")]
    evs[0]["description"] = "hit_into_play"
    evs.append({"game_date": "2026-04-01", "events": None, "launch_speed": None,
                "description": "swinging_strike", "zone": 5})
    p = batter_profile_from_events(evs, as_of="2026-06-01", player_id=1)
    assert "swstr" in p and "csw" in p and "ball" in p and "pitches" in p
```

Then in `model/profiles.py`: `from model.pitch_metrics import pitch_rates` (near the other imports), and in BOTH `batter_profile_from_events` and `pitcher_profile_from_events` return dicts, spread `**pitch_rates(events, as_of=as_of)`.

- [ ] **Step 6: Run new tests + full suite**

Run: `.venv/bin/python -m pytest tests/test_pitch_metrics.py tests/test_profile_components.py -q` → PASS.
Then `.venv/bin/python -m pytest -q` → all green.

- [ ] **Step 7: Commit**

```bash
git add model/pitch_metrics.py tests/test_pitch_metrics.py model/profiles.py tests/test_profile_components.py
git commit -m "feat(a2): SwStr%/CSW%/Ball% pitch-rate metrics on batter + pitcher profiles"
```

---

### Task 3: ISO + full xwOBA — `xstats.py` + profiles

**Files:** Create `model/xstats.py`, `tests/test_xstats.py`; Modify `model/profiles.py`, `tests/test_profile_components.py`.

- [ ] **Step 1: Write the failing test**

Create `tests/test_xstats.py`:

```python
from model.xstats import iso, xwoba

def _e(d, ev, xw=None, wv=0.0, wd=1, bb=None):
    return {"game_date": d, "events": ev, "estimated_woba_using_speedangle": xw,
            "woba_value": wv, "woba_denom": wd, "bb_type": bb}

def test_iso_extra_bases_per_ab():
    evs = [_e("2026-04-01","home_run"), _e("2026-04-01","double"),
           _e("2026-04-01","single"), _e("2026-04-01","strikeout"),
           _e("2026-04-01","walk")]   # walk excluded from AB
    # AB = 4 (hr,double,single,strikeout); extra bases = 3(hr)+1(double) = 4 -> ISO 1.0
    assert iso(evs, as_of="2026-06-01")["iso"] == 4/4

def test_iso_zero_no_ab():
    assert iso([_e("2026-04-01","walk")], as_of="2026-06-01")["iso"] == 0.0

def test_xwoba_uses_estimated_on_contact_and_woba_value_else():
    evs = [_e("2026-04-01","home_run", xw=1.8, wd=1, bb="fly_ball"),   # contact -> 1.8
           _e("2026-04-01","walk", wv=0.69, wd=1)]                     # non-contact -> 0.69
    r = xwoba(evs, as_of="2026-06-01")
    assert abs(r["xwoba"] - (1.8 + 0.69)/2) < 1e-9
    ra = xwoba(evs, as_of="2026-06-01", allowed=True)
    assert "xwoba_allowed" in ra
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_xstats.py -q` → FAIL.

- [ ] **Step 3: Implement `model/xstats.py`**

```python
"""Pure ISO + expected-wOBA (full) from slim PA-ending event rows. Display/context
stats (viewers), not barrel voters. No I/O; no lookahead."""

# PA-ending events that do NOT count as at-bats
_NON_AB = {"walk", "intent_walk", "hit_by_pitch", "sac_fly", "sac_bunt",
           "sac_fly_double_play", "sac_bunt_double_play", "catcher_interf"}
_XB = {"double": 1, "triple": 2, "home_run": 3}   # extra bases beyond a single


def iso(events: list[dict], *, as_of: str) -> dict:
    past = [e for e in events if e["game_date"] < as_of and e.get("events")]
    ab = sum(1 for e in past if e["events"] not in _NON_AB)
    xb = sum(_XB.get(e["events"], 0) for e in past)
    return {"iso": (xb / ab) if ab else 0.0}


def xwoba(events: list[dict], *, as_of: str, allowed: bool = False) -> dict:
    """Expected wOBA: estimated_woba on batted balls, actual woba_value on
    non-contact PA-enders; divided by summed woba_denom."""
    num = 0.0
    den = 0.0
    for e in events:
        if e["game_date"] >= as_of or not e.get("events"):
            continue
        wd = e.get("woba_denom") or 0
        if not wd:
            continue
        if e.get("bb_type") is not None and e.get("estimated_woba_using_speedangle") is not None:
            num += e["estimated_woba_using_speedangle"]
        else:
            num += e.get("woba_value") or 0.0
        den += wd
    val = round((num / den) if den else 0.0, 4)
    return {"xwoba_allowed": val} if allowed else {"xwoba": val}
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/python -m pytest tests/test_xstats.py -q` → PASS.

- [ ] **Step 5: Merge into profiles + test**

Add to `tests/test_profile_components.py`:

```python
def test_profiles_have_iso_and_xwoba():
    evs = [_brow("2026-04-01", "home_run", ls=105, la=27, lsa=6, bb="fly_ball")]
    evs[0]["woba_value"] = 2.0; evs[0]["woba_denom"] = 1
    b = batter_profile_from_events(evs, as_of="2026-06-01", player_id=1)
    assert "iso" in b and "xwoba" in b
    p = pitcher_profile_from_events(evs, as_of="2026-06-01", player_id=9)
    assert "xwoba_allowed" in p        # pitcher gets xwoba-allowed (no ISO)
```

In `model/profiles.py`: `from model.xstats import iso, xwoba`. In `batter_profile_from_events` return: spread `**iso(events, as_of=as_of)` and `**xwoba(events, as_of=as_of)`. In `pitcher_profile_from_events` return: spread `**xwoba(events, as_of=as_of, allowed=True)` (pitchers get xwoba-allowed; no ISO).

- [ ] **Step 6: Run new tests + full suite**

Run: `.venv/bin/python -m pytest tests/test_xstats.py tests/test_profile_components.py -q` → PASS. Then `.venv/bin/python -m pytest -q` → all green.

- [ ] **Step 7: Commit**

```bash
git add model/xstats.py tests/test_xstats.py model/profiles.py tests/test_profile_components.py
git commit -m "feat(a2): ISO + full xwOBA (context stats) on profiles"
```

---

### Task 4: ZoneFit — per-zone vectors + `zone_fit` combine

**Files:** Modify `model/pitch_metrics.py`, `tests/test_pitch_metrics.py`, `model/profiles.py`, `tests/test_profile_components.py`.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_pitch_metrics.py`:

```python
from model.pitch_metrics import zone_damage, zone_freq, zone_fit

def _bb(d, zone, xw):
    return {"game_date": d, "bb_type": "fly_ball", "zone": zone,
            "estimated_woba_using_speedangle": xw, "description": "hit_into_play"}

def test_zone_fit_rewards_pitcher_living_in_damage_zone():
    # hitter mashes zone 5 (xwOBA 1.5), weak in zone 1 (0.1)
    hitter = [_bb("2026-04-01", 5, 1.5) for _ in range(20)] + [_bb("2026-04-01", 1, 0.1) for _ in range(20)]
    dmg = zone_damage(hitter, as_of="2026-06-01")
    # pitcher who lives in zone 5 vs one who lives in zone 1
    into_5 = zone_freq([{"game_date":"2026-04-01","zone":5,"description":"ball"} for _ in range(30)], as_of="2026-06-01")
    into_1 = zone_freq([{"game_date":"2026-04-01","zone":1,"description":"ball"} for _ in range(30)], as_of="2026-06-01")
    assert zone_fit(dmg, into_5) > zone_fit(dmg, into_1)

def test_zone_freq_sums_to_one():
    f = zone_freq([{"game_date":"2026-04-01","zone":z,"description":"ball"} for z in (1,5,5,9)], as_of="2026-06-01")
    assert abs(sum(f.values()) - 1.0) < 1e-9

def test_zone_fit_empty_is_zero():
    assert zone_fit(zone_damage([], as_of="2026-06-01"), zone_freq([], as_of="2026-06-01")) == 0.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_pitch_metrics.py -q -k zone` → FAIL.

- [ ] **Step 3: Implement the zone functions in `model/pitch_metrics.py`**

Append:

```python
_ZONES = tuple(range(1, 10)) + (11, 12, 13, 14)
_ZONE_PRIOR = 10.0        # regress thin zones toward the hitter's overall xwOBAcon; SEED
_LEAGUE_XWOBACON = 0.37   # fallback when a hitter has no batted balls; SEED


def zone_damage(pitches: list[dict], *, as_of: str) -> dict:
    """Hitter's per-zone damage: mean estimated_woba on his batted balls per zone,
    regressed toward his overall xwOBAcon for thin zones."""
    bbe = [p for p in pitches if p["game_date"] < as_of and p.get("bb_type") is not None
           and p.get("estimated_woba_using_speedangle") is not None and p.get("zone") is not None]
    overall = (sum(p["estimated_woba_using_speedangle"] for p in bbe) / len(bbe)) if bbe else _LEAGUE_XWOBACON
    dmg = {}
    for z in _ZONES:
        vals = [p["estimated_woba_using_speedangle"] for p in bbe if int(p["zone"]) == z]
        dmg[z] = (sum(vals) + overall * _ZONE_PRIOR) / (len(vals) + _ZONE_PRIOR)
    return dmg


def zone_freq(pitches: list[dict], *, as_of: str) -> dict:
    """Pitcher's per-zone pitch frequency (sums to 1 when any pitches)."""
    past = [p for p in pitches if p["game_date"] < as_of and p.get("zone") is not None]
    n = len(past)
    return {z: (sum(1 for p in past if int(p["zone"]) == z) / n) if n else 0.0 for z in _ZONES}


def zone_fit(dmg: dict, freq: dict) -> float:
    """Hitter's damage weighted by where THIS pitcher lives. 0.0 with no data."""
    return round(sum(dmg.get(z, 0.0) * freq.get(z, 0.0) for z in _ZONES), 4)
```

- [ ] **Step 4: Run to verify pass**

Run: `.venv/bin/python -m pytest tests/test_pitch_metrics.py -q` → PASS.

- [ ] **Step 5: Store the per-zone vectors on the profiles + test**

Add to `tests/test_profile_components.py`:

```python
def test_batter_profile_has_zone_dmg_pitcher_has_zone_freq():
    evs = [_brow("2026-04-01", "home_run", ls=105, la=27, lsa=6, bb="fly_ball")]
    evs[0]["zone"] = 5; evs[0]["estimated_woba_using_speedangle"] = 1.5
    b = batter_profile_from_events(evs, as_of="2026-06-01", player_id=1)
    assert "zone_dmg" in b and isinstance(b["zone_dmg"], dict)
    evs2 = [{"game_date": "2026-04-01", "events": None, "launch_speed": None,
             "description": "ball", "zone": 5}]
    p = pitcher_profile_from_events(evs2, as_of="2026-06-01", player_id=9)
    assert "zone_freq" in p and isinstance(p["zone_freq"], dict)
```

In `model/profiles.py`: import `zone_damage, zone_freq`. In `batter_profile_from_events` return, add `"zone_dmg": zone_damage(events, as_of=as_of)`. In `pitcher_profile_from_events` return, add `"zone_freq": zone_freq(events, as_of=as_of)`.

- [ ] **Step 6: Run new tests + full suite**

Run: `.venv/bin/python -m pytest tests/test_pitch_metrics.py tests/test_profile_components.py -q` → PASS. Then `.venv/bin/python -m pytest -q` → all green.

- [ ] **Step 7: Commit**

```bash
git add model/pitch_metrics.py tests/test_pitch_metrics.py model/profiles.py tests/test_profile_components.py
git commit -m "feat(a2): ZoneFit — per-zone damage/frequency vectors + zone_fit combine"
```

---

### Task 5: Surface on the boards payload + real-data smoke

**Files:** Modify `model/export_web.py` (`_hitter_board`, `_pitcher_board`), `tests/test_boards_payload.py`; Create `scripts/smoke_a2.py`.

- [ ] **Step 1: Failing boards test**

In `tests/test_boards_payload.py`, extend the hitter/pitcher fixtures with the new fields and assert they surface. Add to the `_H` dict: `"swstr": 0.10, "csw": 0.30, "ball": 0.35, "iso": 0.25, "xwoba": 0.38, "zone_dmg": {5: 1.2}`; to `_P`: `"swstr": 0.12, "csw": 0.31, "ball": 0.34, "xwoba_allowed": 0.30, "zone_freq": {5: 0.5}`. Then assert:

```python
def test_boards_surfaces_pitch_level_fields():
    boards = build_boards_payload(_slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P))
    h = boards["games"][0]["awayHitters"][0]["stats"]
    assert h["swstr"] == 10.0 and h["csw"] == 30.0 and h["iso"] == 25.0   # rates *100 for display
    assert "xwoba" in h and "zonefit" in h                                 # zonefit computed from zone_dmg × zone_freq
    p = boards["pitchers"][0]["stats"]
    assert "swstr" in p and "csw" in p and "ball" in p and "xwoba" in p
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_boards_payload.py -q -k pitch_level` → FAIL.

- [ ] **Step 3: Surface in `_hitter_board` / `_pitcher_board`**

In `model/export_web.py`, add `from model.pitch_metrics import zone_fit` near the top. In `_hitter_board`'s `stats` dict, add (rates are fractions → ×100 for the board via the existing `_pct`; xwoba/zonefit pass through):

```python
            "swstr": _pct(b.get("swstr")),
            "csw": _pct(b.get("csw")),
            "ball": _pct(b.get("ball")),
            "iso": round((b.get("iso") or 0.0), 3),
            "xwoba": round((b.get("xwoba") or 0.0), 3),
            "zonefit": zone_fit(b.get("zone_dmg") or {}, opp.get("zone_freq") or {}) if opp else 0.0,
```

In `_pitcher_board`'s `stats` dict, add:

```python
            "swstr": _pct(p.get("swstr")),
            "csw": _pct(p.get("csw")),
            "ball": _pct(p.get("ball")),
            "xwoba": round((p.get("xwoba_allowed") or 0.0), 3),
```

- [ ] **Step 4: Run boards test + full suite**

Run: `.venv/bin/python -m pytest tests/test_boards_payload.py -q` → PASS. Then `.venv/bin/python -m pytest -q` → all green.

- [ ] **Step 5: Real-data smoke**

Create `scripts/smoke_a2.py`:

```python
"""Real-data sanity for A2 pitch-level metrics. Prints SwStr/CSW/Ball/ISO/xwOBA
for a hitter + a pitcher, and a ZoneFit for the matchup.
Run: .venv/bin/python scripts/smoke_a2.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model import fetch, profiles
from model.pitch_metrics import zone_fit

SEASON = 2024
h = profiles.batter_profile_from_events(fetch.batter_events(592450, SEASON),
        as_of=f"{SEASON}-10-01", player_id=592450, name="Aaron Judge")
p = profiles.pitcher_profile_from_events(fetch.pitcher_events(605400, SEASON),
        as_of=f"{SEASON}-10-01", player_id=605400, name="Aaron Nola")
print("Judge:  SwStr%={:.1f} CSW%={:.1f} Ball%={:.1f} ISO={:.3f} xwOBA={:.3f}".format(
    h["swstr"]*100, h["csw"]*100, h["ball"]*100, h["iso"], h["xwoba"]))
print("Nola:   SwStr%={:.1f} CSW%={:.1f} Ball%={:.1f} xwOBA-allowed={:.3f}".format(
    p["swstr"]*100, p["csw"]*100, p["ball"]*100, p["xwoba_allowed"]))
print("ZoneFit Judge vs Nola:", zone_fit(h["zone_dmg"], p["zone_freq"]))
```

- [ ] **Step 6: Run it + record**

Run: `.venv/bin/python scripts/smoke_a2.py`
Expected (report the numbers): every rate 0–100 and sensible (Judge low SwStr% for an elite bat is fine; Nola CSW% in the high-20s%); ISO/xwOBA plausible for Judge (ISO ~.3, xwOBA ~.4); ZoneFit a small positive number. Network run — retry if slow.

- [ ] **Step 7: Commit**

```bash
git add model/export_web.py tests/test_boards_payload.py scripts/smoke_a2.py
git commit -m "feat(a2): surface SwStr/CSW/Ball/ISO/xwOBA/ZoneFit on the boards payload + smoke"
```

---

## Self-Review

**Spec coverage:** SwStr/CSW/Ball (Task 2), ISO + full xwOBA (Task 3), ZoneFit per-zone + combine (Task 4), pull+cache (Task 1), board surfacing (Task 5). Roles honored — nothing wired into prob/nudge/score math (constraints forbid touching those files). Batter + pitcher both covered. Full suite green each task. ✅

**Placeholder scan:** none — real code/commands throughout.

**Type consistency:** `pitch_rates(...) -> {swstr,csw,ball,pitches}`, `iso(...) -> {iso}`, `xwoba(..., allowed) -> {xwoba|xwoba_allowed}`, `zone_damage/zone_freq -> dict`, `zone_fit(dmg, freq) -> float` — identical across helpers, profile merges, and the boards payload. Board keys (swstr/csw/ball/iso/xwoba/zonefit) match the frontend column keys.

**Deferred (not this plan):** wiring ZoneFit/SwStr/CSW into prop math (sign-off); xwOBA→Layer-1 base; Marcel-weighting; pitcher scores; ZoneFit display-scale tuning of the board column anchors (values arrive real; anchor tuning is a trivial later display tweak).
