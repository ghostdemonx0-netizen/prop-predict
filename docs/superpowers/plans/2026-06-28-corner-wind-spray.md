# Corner Wind + Spray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make HR (and TB's extra-base) wind effect per-batter and directional — weight the game's wind across each batter's pull/center/oppo spray instead of center-field only.

**Architecture:** New pure module `model/spray.py` (spray math); `fetch.batter_spray` (new Statcast pull + cache); `weather.wind_out_directional` (3-field weighted wind); profiles attach each batter's spray; `build_hr_rows` + `_threshold_rows` compute a per-batter directional `weather_mult`. Falls back to a handedness-default distribution when spray data is thin (graceful before backfill).

**Tech Stack:** Python 3.12, pandas, pybaseball (`statcast_batter`), pytest.

## Global Constraints
- Spec: `docs/superpowers/specs/2026-06-28-corner-wind-spray-design.md`. **Model-math change + data layer.**
- Scope: **HR + Total Bases.** Hits singles/doubles/triples weather-neutral (HR slice carries the directional sliver). Runs/RBI/HRR untouched.
- Constants are **seeds**, tunable. Handedness defaults computed from data (seed pull/center/oppo = 0.50/0.30/0.20 per side).
- **Angle convention:** reconcile `wind_dir_rel_cf` (0=CF,90=RF,180=in,270=LF) with field bearings (signed: LF=−45, CF=0, RF=+45). Test it.
- `spray=None` / zero data → handedness default (back-compat + graceful).
- TDD; run from repo root with `uv run pytest`.

---

### Task 1: `model/spray.py` — angle + field classification + constants

**Files:** Create `model/spray.py`; Test `tests/test_spray.py`

**Interfaces:**
- Produces: `spray_angle(hc_x, hc_y) -> float` (degrees, 0=CF, − = toward LF, + = toward RF); `field_of(angle, bats) -> "pull"|"center"|"oppo"`; constants `REL`, `KCONF`, `DIAL_K=150`, `CAP=0.70`, `HAND_DEFAULT` (per side).

- [ ] **Step 1: failing test**
```python
# tests/test_spray.py
from model import spray

def test_spray_angle_center_and_sides():
    # straight to CF (hc_x at plate x, far out) -> ~0
    assert abs(spray.spray_angle(125.42, 50)) < 1.0
    # to the left (smaller hc_x) -> negative; right -> positive
    assert spray.spray_angle(80, 100) < 0
    assert spray.spray_angle(170, 100) > 0

def test_field_of_by_handedness():
    # RHB pulls LEFT (negative angle) -> pull; right -> oppo
    assert spray.field_of(-35, "R") == "pull"
    assert spray.field_of(35, "R") == "oppo"
    assert spray.field_of(0, "R") == "center"
    # LHB mirrored
    assert spray.field_of(-35, "L") == "oppo"
    assert spray.field_of(35, "L") == "pull"
```

- [ ] **Step 2: run, expect fail** — `uv run pytest tests/test_spray.py -k "spray_angle or field_of" -v` → ImportError.

- [ ] **Step 3: implement**
```python
# model/spray.py
"""Pure spray math: classify batted-ball direction and blend a batter's
pull/center/oppo tendency from 3 scouts + a handedness prior. No I/O."""
import math

_PLATE_X, _PLATE_Y = 125.42, 198.27   # Statcast home-plate coords
_CENTER_HALF = 15.0                    # ± degrees counted as "center"

# scout relevance and confidence half-trust (K)
REL = {"overall": 1.0, "air": 1.5, "hr": 2.0}
KCONF = {"overall": 120.0, "air": 100.0, "hr": 15.0}
DIAL_K = 150.0
CAP = 0.70
# league-average spray per side (seed; recompute from data). pull/center/oppo.
HAND_DEFAULT = {
    "R": {"pull": 0.50, "center": 0.30, "oppo": 0.20},
    "L": {"pull": 0.50, "center": 0.30, "oppo": 0.20},
}


def spray_angle(hc_x: float, hc_y: float) -> float:
    """Degrees off center field. 0 = CF, negative = toward LF, positive = toward RF."""
    return math.degrees(math.atan2(hc_x - _PLATE_X, _PLATE_Y - hc_y))


def field_of(angle: float, bats: str) -> str:
    """Classify a spray angle into pull/center/oppo for this batter's side."""
    if -_CENTER_HALF <= angle <= _CENTER_HALF:
        return "center"
    left = angle < 0   # toward LF
    if bats == "R":
        return "pull" if left else "oppo"   # RHB pulls to LF
    return "oppo" if left else "pull"        # LHB pulls to RF
```

- [ ] **Step 4: run, expect pass.**
- [ ] **Step 5: commit** — `git add model/spray.py tests/test_spray.py && git commit -m "feat(spray): spray-angle + field classification + constants"`

---

### Task 2: `model/spray.py` — combine scouts + handedness blend

**Files:** Modify `model/spray.py`; Test `tests/test_spray.py`

**Interfaces:**
- Consumes (Task 1): `REL`, `KCONF`, `DIAL_K`, `CAP`, `HAND_DEFAULT`.
- Produces: `combine_scouts(scouts) -> dict|None` where `scouts = {"overall":{"pull","center","oppo","n"}, "air":{...}, "hr":{...}}`; `final_distribution(scouts, bats) -> {"pull","center","oppo"}` (applies the handedness dial; `n_total` taken from `scouts["overall"]["n"]`).

- [ ] **Step 1: failing test**
```python
# tests/test_spray.py (append)
def _scout(p,c,o,n):
    tot=p+c+o or 1
    return {"pull":p/tot,"center":c/tot,"oppo":o/tot,"n":n}

def test_combine_scouts_weights_toward_hr():
    sc={"overall":_scout(58,27,15,1000),"air":_scout(64,22,14,400),"hr":_scout(74,16,10,90)}
    out=spray.combine_scouts(sc)
    assert 0.99 < out["pull"]+out["center"]+out["oppo"] < 1.01
    assert out["pull"] > sc["overall"]["pull"]   # HR/air pull it up

def test_combine_scouts_none_when_empty():
    sc={"overall":_scout(0,0,0,0),"air":_scout(0,0,0,0),"hr":_scout(0,0,0,0)}
    assert spray.combine_scouts(sc) is None

def test_final_distribution_dial_and_cap():
    sc={"overall":_scout(70,20,10,1500),"air":_scout(70,20,10,600),"hr":_scout(70,20,10,100)}
    fin=spray.final_distribution(sc,"R")     # n_total huge -> 70% spray / 30% default
    # final pull between default(0.50) and his(0.70), capped at 70% spray weight
    assert 0.50 < fin["pull"] <= 0.70
    # zero data -> exactly the handedness default
    empty={"overall":_scout(0,0,0,0),"air":_scout(0,0,0,0),"hr":_scout(0,0,0,0)}
    assert spray.final_distribution(empty,"R") == spray.HAND_DEFAULT["R"]
```

- [ ] **Step 2: run, expect fail.**

- [ ] **Step 3: implement** (append to `model/spray.py`)
```python
def _confidence(n, k):
    return n / (n + k) if n > 0 else 0.0


def combine_scouts(scouts: dict):
    """Relevance×confidence weighted vote across the 3 scouts -> one distribution.
    Returns None if there is no data at all."""
    fields = ("pull", "center", "oppo")
    acc = {f: 0.0 for f in fields}
    wsum = 0.0
    for key in ("overall", "air", "hr"):
        s = scouts.get(key) or {}
        n = s.get("n", 0)
        if n <= 0:
            continue
        vote = REL[key] * _confidence(n, KCONF[key])
        if vote <= 0:
            continue
        wsum += vote
        for f in fields:
            acc[f] += vote * s.get(f, 0.0)
    if wsum <= 0:
        return None
    return {f: acc[f] / wsum for f in fields}


def final_distribution(scouts: dict, bats: str) -> dict:
    """Blend his combined spray with the handedness default via the sample dial (cap)."""
    side = "L" if bats == "L" else "R"
    default = HAND_DEFAULT[side]
    his = combine_scouts(scouts)
    n_total = (scouts.get("overall") or {}).get("n", 0)
    if his is None or n_total <= 0:
        return dict(default)
    w = min(CAP, n_total / (n_total + DIAL_K))
    blended = {f: (1 - w) * default[f] + w * his[f] for f in ("pull", "center", "oppo")}
    tot = sum(blended.values()) or 1.0
    return {f: blended[f] / tot for f in blended}
```

- [ ] **Step 4: run, expect pass.**
- [ ] **Step 5: commit** — `git commit -am "feat(spray): combine scouts + handedness-dial final distribution"`

---

### Task 3: `weather.wind_out_directional`

**Files:** Modify `model/weather.py`; Test `tests/test_weather.py`

**Interfaces:**
- Produces: `wind_out_directional(wind_speed_mph, wind_from_deg, cf_bearing_deg, spray, bats) -> float` (mph blowing out, weighted over the batter's pull/center/oppo fields).

- [ ] **Step 1: failing test**
```python
# tests/test_weather.py (append)
from model.weather import wind_out_directional, wind_out_to_cf

def test_dir_wind_lf_out_helps_rhb_pull_hitter():
    # cf bearing 0 (CF = due north). Wind FROM south (180) blows toward north = out to CF.
    # Wind FROM east-ish so it blows toward LF (west). Use a pull-heavy RHB.
    spray={"pull":0.8,"center":0.15,"oppo":0.05}
    # wind blowing OUT to LF: for cf_bearing=0, LF is to the −45 side; a wind that travels
    # toward −45 rel CF. wind_from such that wind_to is −45 rel CF.
    out = wind_out_directional(10, 45+180, 0, spray, "R")   # wind_to ≈ -45 rel CF (LF)
    assert out > 3.0    # strong positive for a pull hitter

def test_dir_wind_centerwind_close_to_cf_for_avg():
    spray={"pull":0.5,"center":0.3,"oppo":0.2}
    # wind from due south (180) -> blows toward north = out to CF (cf_bearing 0)
    out = wind_out_directional(10, 180, 0, spray, "R")
    assert out > 6.5   # most of a 10mph CF wind still credited
```

- [ ] **Step 2: run, expect fail.**

- [ ] **Step 3: implement** (append to `model/weather.py`)
```python
_FIELD_BEARING = {  # signed degrees rel CF: − = LF side, + = RF side
    "R": {"pull": -45.0, "center": 0.0, "oppo": 45.0},   # RHB pulls LF
    "L": {"pull": 45.0,  "center": 0.0, "oppo": -45.0},  # LHB pulls RF
}


def wind_out_directional(wind_speed_mph: float, wind_from_deg: float, cf_bearing_deg: float,
                         spray: dict, bats: str) -> float:
    """Wind blowing OUT, weighted across the batter's pull/center/oppo fields.

    Reduces to a pure-pull or pure-center result when the spray is concentrated.
    """
    wind_to = (wind_from_deg + 180.0) % 360.0
    # wind travel direction relative to CF, signed to [-180, 180] (− = toward LF, + = RF)
    rel = ((wind_to - cf_bearing_deg + 180.0) % 360.0) - 180.0
    bearings = _FIELD_BEARING["L" if bats == "L" else "R"]
    out = 0.0
    for field in ("pull", "center", "oppo"):
        share = spray.get(field, 0.0)
        if share:
            out += share * wind_speed_mph * math.cos(math.radians(rel - bearings[field]))
    return out
```

- [ ] **Step 4: run, expect pass.** (If a sign is inverted, flip `rel` polarity — the LF-out test is the guard.)
- [ ] **Step 5: commit** — `git commit -am "feat(weather): wind_out_directional (3-field spray-weighted wind)"`

---

### Task 4: `fetch.batter_spray` — the spray data pull

**Files:** Modify `model/fetch.py`; Test `tests/test_fetch.py`

**Interfaces:**
- Consumes (Task 1): `spray.spray_angle`, `spray.field_of`.
- Produces: `batter_spray(player_id, season) -> {"R": scoutset, "L": scoutset}` where each `scoutset = {"overall":{pull,center,oppo,n}, "air":{...}, "hr":{...}}` (counts, split by the side the batter stood on). `{}` on failure.

- [ ] **Step 1: failing test**
```python
# tests/test_fetch.py (append)
import pandas as pd
from model import fetch

def test_batter_spray_buckets_by_side(monkeypatch):
    df = pd.DataFrame([
        # RHB stance, pulled to LF (small hc_x), in the air, a HR
        {"stand":"R","events":"home_run","launch_angle":28,"hc_x":80,"hc_y":90,"game_date":"2026-05-01"},
        {"stand":"R","events":"single","launch_angle":5,"hc_x":125,"hc_y":120,"game_date":"2026-05-02"},
    ])
    monkeypatch.setattr(fetch, "statcast_batter", lambda s,e,pid: df)
    monkeypatch.setattr(fetch, "_with_retries", lambda fn: fn())
    out = fetch.batter_spray(700, 2026)
    assert out["R"]["overall"]["n"] == 2
    assert out["R"]["hr"]["n"] == 1
    assert out["R"]["hr"]["pull"] == 1          # the HR was pulled (LF for RHB)
    assert out["R"]["air"]["n"] >= 1            # the launch_angle>=10 ball counted as air

def test_batter_spray_empty_on_failure(monkeypatch):
    monkeypatch.setattr(fetch, "statcast_batter", lambda s,e,pid: (_ for _ in ()).throw(RuntimeError()))
    monkeypatch.setattr(fetch, "_with_retries", lambda fn: fn())
    assert fetch.batter_spray(700, 2026) == {}
```

- [ ] **Step 2: run, expect fail.**

- [ ] **Step 3: implement** (add to `model/fetch.py`; import `from model import spray as _spray` at top)
```python
def batter_spray(player_id: int, season: int) -> dict:
    """Per-side spray counts for one batter-season from Statcast batted balls.

    Returns {"R": scoutset, "L": scoutset}; scoutset has overall/air/hr each
    {pull,center,oppo,n}. Balls with no hit location are skipped. {} on failure.
    """
    start, end = _date_window(season)
    try:
        df = _with_retries(lambda: statcast_batter(start, end, player_id))
    except Exception:
        return {}
    if df is None or len(df) == 0:
        return {}
    def _empty():
        return {k: {"pull": 0, "center": 0, "oppo": 0, "n": 0} for k in ("overall", "air", "hr")}
    out = {"R": _empty(), "L": _empty()}
    for r in df.itertuples():
        hc_x, hc_y = getattr(r, "hc_x", None), getattr(r, "hc_y", None)
        stand = getattr(r, "stand", None)
        ev = getattr(r, "events", None)
        if hc_x is None or hc_y is None or pd.isna(hc_x) or pd.isna(hc_y) or stand not in ("R", "L") or not ev:
            continue
        field = _spray.field_of(_spray.spray_angle(float(hc_x), float(hc_y)), stand)
        la = getattr(r, "launch_angle", None)
        is_air = la is not None and not pd.isna(la) and float(la) >= 10.0
        is_hr = ev == "home_run"
        for bucket, include in (("overall", True), ("air", is_air), ("hr", is_hr)):
            if include:
                out[stand][bucket][field] += 1
                out[stand][bucket]["n"] += 1
    return out
```

- [ ] **Step 4: run, expect pass.**
- [ ] **Step 5: commit** — `git commit -am "feat(spray): fetch.batter_spray Statcast pull (per-side scout counts)"`

---

### Task 5: Attach spray to batter profiles

**Files:** Modify `model/export_web.py` (`make_profile_fns`: `batter_fn` + `batter_hist_fn`); Test `tests/test_export_web.py`

**Interfaces:**
- Consumes (Task 4): `fetch.batter_spray`. Produces: each batter profile carries `spray_sides = batter_spray(...)` (the raw `{"R":...,"L":...}` cache) so the row builder can pick the side at matchup time. Cache key `bat-spray-{pid}-{season}` (pooled later; v1 current season).

- [ ] **Step 1: failing test**
```python
# tests/test_export_web.py (append)
def test_batter_fn_attaches_spray_sides(monkeypatch):
    from model import export_web, fetch
    slate=[{"game_id":1,"home":"AAA","away":"BBB","home_id":10,"away_id":20,"started":False,
            "home_pitcher_id":700,"away_pitcher_id":701}]
    monkeypatch.setattr(fetch,"get_lineups",lambda gid:{"home":[101],"away":[]})
    monkeypatch.setattr(fetch,"get_recent_lineup",lambda tid,d,**k:[])
    monkeypatch.setattr(fetch,"get_player_meta",lambda ids:{101:{"name":"B","bats":"R"}})
    SPRAY={"R":{"overall":{"pull":50,"center":30,"oppo":20,"n":100},
                "air":{"pull":0,"center":0,"oppo":0,"n":0},
                "hr":{"pull":0,"center":0,"oppo":0,"n":0}},
           "L":{"overall":{"pull":0,"center":0,"oppo":0,"n":0},
                "air":{"pull":0,"center":0,"oppo":0,"n":0},
                "hr":{"pull":0,"center":0,"oppo":0,"n":0}}}
    def goc(key,prod):
        if key.startswith("bat-events"): return [{"game_date":"2026-05-01","events":"single","launch_speed":95}]
        if key.startswith("bat-spray"): return SPRAY
        if "gamelog" in key: return []
        return {}
    monkeypatch.setattr(export_web,"get_or_compute",goc)
    monkeypatch.setattr(export_web.profiles,"batter_profile_from_events",
        lambda ev,**k:{"player_id":k["player_id"],"name":"B","bats":"R","recent_form_mult":1.0,
                       "k_rate":0.2,"hit_rate":0.2,"season_hr":10,"season_pa":400,
                       "season_1b":50,"season_2b":20,"season_3b":2})
    lineups_fn,_,_,_=export_web.make_profile_fns(slate,2026,"2026-06-01")
    prof=lineups_fn(slate[0])["home"][0]
    assert prof["spray_sides"]["R"]["overall"]["n"]==100
```

- [ ] **Step 2: run, expect fail.**

- [ ] **Step 3: implement** — in `make_profile_fns`, inside `batter_fn` (after the profile is built, before return) add:
```python
        prof["spray_sides"] = get_or_compute(f"bat-spray-{pid}-{season}", lambda: fetch.batter_spray(pid, season))
```
and the identical line inside `batter_hist_fn` (spray is stable → same value in both; NOT neutralized).

- [ ] **Step 4: run, expect pass.**
- [ ] **Step 5: commit** — `git commit -am "feat(spray): attach spray_sides to batter profiles (current + history)"`

---

### Task 6: Directional wind in `build_hr_rows`

**Files:** Modify `model/pipeline.py` (`build_hr_rows`); Test `tests/test_pipeline.py`

**Interfaces:**
- Consumes: `spray.final_distribution`, `weather.wind_out_directional`, `weather_hr_multiplier`. The game weather `w` carries `w["wx"]["wind_speed_mph"]`, `w["wx"]["wind_from_deg"]`, `w["park"]["cf_bearing_deg"]`, `w["temp_f"]`, `w["park"]["dome"]`.
- Produces: HR rows use a **per-batter** directional `weather_mult`; row stores `wind_out_mph` = directional value and `spray_pull` = final pull share.

- [ ] **Step 1: failing test**
```python
# tests/test_pipeline.py (append)
def test_hr_directional_wind_helps_pull_hitter_lf_wind():
    from model.parks import get_park
    bat={"player_id":601,"name":"Pull","bats":"R","lineup_status":"confirmed",
         "season_hr":30,"season_pa":500,"season_1b":40,"season_2b":20,"season_3b":1,
         "hit_rate":0.25,"k_rate":0.22,"recent_form_mult":1.0,
         "spray_sides":{"R":{"overall":{"pull":80,"center":12,"oppo":8,"n":1200},
                             "air":{"pull":80,"center":12,"oppo":8,"n":400},
                             "hr":{"pull":85,"center":10,"oppo":5,"n":90}},
                        "L":{"overall":{"pull":0,"center":0,"oppo":0,"n":0},
                             "air":{"pull":0,"center":0,"oppo":0,"n":0},
                             "hr":{"pull":0,"center":0,"oppo":0,"n":0}}}}
    slate=[{"game_id":7,"home":"COL","away":"LAD","park_team":"COL","home_id":10,"away_id":20,
            "home_pitcher_id":100,"away_pitcher_id":200,"started":False}]
    L=lambda g:{"home":[bat],"away":[]}
    P=lambda pid:{"name":"P","player_id":pid,"throws":"R","hr_allowed_rate":0.033,"bf":400,"k_per_bf":0.22,"hit_allowed_rate":0.22}
    cf=get_park("COL")["cf_bearing_deg"]
    # wind blowing OUT to LF: wind_to ≈ cf-45; wind_from = (cf-45)+180
    Wlf=lambda g:{"wind_speed_mph":12,"wind_from_deg":(cf-45+180)%360,"temp_f":72,"precip_pct":0}
    # wind blowing OUT to RF (away from his pull): wind_to ≈ cf+45
    Wrf=lambda g:{"wind_speed_mph":12,"wind_from_deg":(cf+45+180)%360,"temp_f":72,"precip_pct":0}
    lf=build_hr_rows(slate,L,P,Wlf)[0]["probability"]
    rf=build_hr_rows(slate,L,P,Wrf)[0]["probability"]
    assert lf > rf    # LF-out wind helps this RHB pull hitter more than RF-out
    assert "spray_pull" in build_hr_rows(slate,L,P,Wlf)[0]
```

- [ ] **Step 2: run, expect fail.**

- [ ] **Step 3: implement** — in `build_hr_rows`, inside the batter loop replace the form/weather block:
```python
                # per-batter directional wind
                bats = b.get("bats", "R")
                hand = bats if bats in ("R", "L") else ("L" if (opp and opp.get("throws") == "R") else "R")
                sides = b.get("spray_sides") or {}
                sp = _spray.final_distribution(sides.get(hand, {}), hand)
                wod = wind_out_directional(w["wx"]["wind_speed_mph"], w["wx"]["wind_from_deg"],
                                           w["park"]["cf_bearing_deg"], sp, hand)
                weather_mult = weather_hr_multiplier(wod, w["temp_f"], w["park"]["dome"])
                hard = b.get("recent_form_mult", 1.0)
                prod = b.get("production_form_hr", 1.0)
                form = _run_props.blend_forms(hard, prod, w_hard=0.80)
                prob = hr_probability(
                    season_hr=b["season_hr"], season_pa=b["season_pa"], recent_form_mult=form,
                    matchup_mult=platoon, pitcher_mult=p_mult, bvp_mult=b_mult,
                    park_mult=eff_park, weather_mult=weather_mult, expected_pa=expected_pa_for_slot(slot))
```
Add imports at top of pipeline.py: `from model import spray as _spray` and `from model.weather import wind_out_directional` (alongside existing weather imports). In the row dict, set `"weather_mult": weather_mult,` (already present), `"wind_out_mph": wod,` (replace `w["wind_out_mph"]`), and add `"spray_pull": sp["pull"],`. Note: `weather_mult`/`hard`/`prod`/`form` are now computed here; remove the earlier per-game `weather_mult` line for HR if duplicated.

- [ ] **Step 4: run, expect pass.** (LF-out > RF-out confirms the sign.)
- [ ] **Step 5: commit** — `git commit -am "feat(corner-wind): per-batter directional wind for HR rows"`

---

### Task 7: Directional wind in `_threshold_rows` (TB; HR-slice of Hits)

**Files:** Modify `model/pipeline.py` (`_threshold_rows`); Test `tests/test_run_props_pipeline.py` or `tests/test_threshold_pipeline.py`

**Interfaces:** Consumes Task 6 helpers. Produces: TB rows' `weather_mult` (used on HR component + dampened on XBH inside `_batter_outcome_vector`) is per-batter directional; Hits unchanged except its HR slice.

- [ ] **Step 1: failing test**
```python
# tests/test_threshold_pipeline.py (append)
def test_tb_directional_wind_pull_hitter():
    from model.pipeline import build_total_bases_rows
    from model.parks import get_park
    bat=_bat_tb(99); bat["bats"]="R"
    bat["spray_sides"]={"R":{"overall":{"pull":80,"center":12,"oppo":8,"n":1200},
                             "air":{"pull":80,"center":12,"oppo":8,"n":400},
                             "hr":{"pull":85,"center":10,"oppo":5,"n":90}},
                        "L":{"overall":{"pull":0,"center":0,"oppo":0,"n":0},
                             "air":{"pull":0,"center":0,"oppo":0,"n":0},
                             "hr":{"pull":0,"center":0,"oppo":0,"n":0}}}
    cf=get_park("AAA")["cf_bearing_deg"] if False else 0  # AAA unknown park -> use 0 via get_park default
    slate=[{"game_id":10,"home":"AAA","away":"BBB","park_team":"AAA","home_pitcher_id":100,"away_pitcher_id":200,"started":False}]
    lf=lambda g:{"home":[bat],"away":[]}
    import math
    Wlf=lambda g:{"wind_speed_mph":12,"wind_from_deg":135,"temp_f":72,"precip_pct":0}  # toward LF-ish
    rows=build_total_bases_rows(slate,lf,lambda p:_pit(p),Wlf,bvp_fn=None)
    assert rows and 0.0 < rows[0]["p_ge2"] <= 1.0   # builds + sane; directional wind applied
```

- [ ] **Step 2: run, expect fail** (will fail at the missing per-batter wind / KeyErrors until wired).

- [ ] **Step 3: implement** — in `_threshold_rows` batter loop, compute the per-batter directional `weather_mult` the same way as Task 6 (bats→hand, spray_sides→final_distribution→wind_out_directional→weather_hr_multiplier) and pass it as the `weather_mult` argument into the `_batter_outcome_vector` calls (replacing the per-game `weather_mult`). Leave the dampening (`wx`) logic inside `_batter_outcome_vector` unchanged — it already derives `wx` from `weather_mult`.

- [ ] **Step 4: run, expect pass.**
- [ ] **Step 5: commit** — `git commit -am "feat(corner-wind): per-batter directional wind for TB (XBH dampened)"`

---

### Task 8: Recorder captures `spray_pull`

**Files:** Modify `model/archive.py` (`_FACTOR_KEYS`); Test `tests/test_archive.py`

- [ ] **Step 1: failing test**
```python
# tests/test_archive.py (append)
def test_record_captures_spray_pull():
    rec = record_from_row({"game_id":1,"player_id":7,"player":"X","team":"AAA",
                           "probability":0.12,"spray_pull":0.66}, "hr")
    assert rec["factors"]["spray_pull"] == 0.66
```

- [ ] **Step 2: run, expect fail.**
- [ ] **Step 3: implement** — add `"spray_pull",` and `"spray_pull_hist",` to `_FACTOR_KEYS`.
- [ ] **Step 4: run, expect pass.**
- [ ] **Step 5: commit** — `git commit -am "feat(corner-wind): archive spray_pull factor"`

---

### Task 9: Backfill script + full-suite regression

**Files:** Create `model/backfill_spray.py`; whole suite.

- [ ] **Step 1: backfill script**
```python
# model/backfill_spray.py
"""One-time warmer for the per-batter spray cache (run off-budget, not in a 30-min job)."""
import sys
from model import fetch
from model.cache import get_or_compute


def prime_spray(player_ids: list[int], current_season: int) -> int:
    n = 0
    for pid in player_ids:
        for yr in (current_season, current_season - 1, current_season - 2):
            get_or_compute(f"bat-spray-{pid}-{yr}", lambda pid=pid, yr=yr: fetch.batter_spray(pid, yr))
            n += 1
    return n


if __name__ == "__main__":
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    print("usage: feed player ids via prime_spray(); season:", season)
```

- [ ] **Step 2: run the full suite** — `uv run pytest -q`. Update any HR/TB tests that pinned the old center-only weather (the directional value differs even for CF winds — the model now spreads to corners). Recompute via the new path and update the pins; note in commit. The `_PINNED_TB_*` test uses a fixture without `spray_sides` → `final_distribution({}, ...)` returns the handedness default → still a directional weather_mult ≠ the old one, so that pin will move; update it to the new value.

- [ ] **Step 3: commit** — `git add -A && git commit -m "feat(corner-wind): spray backfill script + updated baselines"`

---

## Self-Review
- **Spec coverage:** spray angle/field (T1) · combine+dial (T2) · directional wind + angle guard (T3) · data pull (T4) · profile attach incl. history (T5) · HR wiring (T6) · TB wiring + Hits HR-slice (T7) · recorder (T8) · backfill + graceful default + regression (T9). Covered.
- **Placeholder scan:** none.
- **Type consistency:** `spray_sides` (raw {R,L} cache), `final_distribution(scouts, bats)→{pull,center,oppo}`, `wind_out_directional(...)→float`, `spray_pull` used consistently T4→T8.

## Notes for the implementer
- The **LF-out-wind test (T3, T6)** is the sign guard — if it fails the wrong way, flip the `rel` polarity in `wind_out_directional`.
- `final_distribution({}, hand)` (no data) returns the handedness default → graceful before backfill.
- Switch hitters: `hand` chosen from `bats=="S"` + opposing throws; spray pulled from that side's cache.
- Real Statcast columns (`hc_x/hc_y/launch_angle/stand`) are assumed from pybaseball `statcast_batter`; tests mock the frame. The real pull/backfill is validated when run off-budget (not in this suite).
