"""Generate the website's data file from the live engine (cached).

Usage:
    uv run python -m model.export_web 2026-06-11 [max_games]
Writes web/public/data/latest.json. Player Statcast pulls are cached under
.cache/ so reruns are fast; pass an optional max_games to limit a slow first run.
"""

import datetime as dt
import json
import re
import sys
from pathlib import Path

from model import fetch, profiles
from model import spray as _spray
from model.cache import get_or_compute
from model.pipeline import build_hr_rows, build_strikeout_rows, build_games, build_hits_rows, build_total_bases_rows, build_runs_rows, build_rbi_rows, build_hrr_rows
from model.prop_score import prop_score
from model.matchup import hr_platoon_mult, LEAGUE_HIT, LEAGUE_K
from model.pitch_metrics import zone_fit
from model.barrel_effect import barrel_effect_mult
from model.oracle import oracle

DATA_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "data"
_DATE_FILE = re.compile(r"^\d{4}-\d{2}-\d{2}\.json$")


def _update_index(date_str: str) -> None:
    """Maintain web/public/data/index.json: a newest-first list of dates that
    have a data file, capped at a strict rolling 7. Date files that fall out
    of the window are deleted (only YYYY-MM-DD.json files are ever deleted;
    latest.json/index.json are never touched)."""
    index_path = DATA_DIR / "index.json"
    dates: list[str] = []
    if index_path.exists():
        try:
            dates = json.loads(index_path.read_text()).get("dates", [])
        except (json.JSONDecodeError, OSError):
            dates = []
            print(f"warning: {index_path} unreadable - index reset to this run's date",
                  file=sys.stderr)
    # self-heal: a date file orphaned by a crash between writes re-enters the
    # index here instead of being pruned tomorrow
    on_disk = {f.stem for f in DATA_DIR.glob("*.json") if _DATE_FILE.match(f.name)}
    dates = sorted(set(dates) | {date_str} | on_disk, reverse=True)[:7]
    index_path.write_text(json.dumps({"dates": dates}, indent=2))
    keep = {f"{d}.json" for d in dates}
    for f in DATA_DIR.glob("*.json"):
        if _DATE_FILE.match(f.name) and f.name not in keep:
            f.unlink()


def _ensure_starters(slate: list[dict]) -> None:
    """Populate home/away_pitcher_id from the boxscore when the schedule's
    probable-pitcher fields are blank (true for finished games)."""
    for g in slate:
        if g.get("home_pitcher_id") and g.get("away_pitcher_id"):
            continue
        s = fetch.get_starters(g["game_id"])
        g["home_pitcher_id"] = g.get("home_pitcher_id") or s["home"]
        g["away_pitcher_id"] = g.get("away_pitcher_id") or s["away"]


def make_profile_fns(slate: list[dict], season: int, as_of: str) -> tuple:
    """(lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn) backed by the on-disk events cache.

    Resolves each lineup side to the official batting order when posted, else a
    PROJECTED order from that team's most recent game (fetch.get_recent_lineup).
    Stamps status onto the data the pipeline reads: batter profiles get
    ``lineup_status``, pitcher profiles get ``pitcher_status`` (via a pid map),
    and each game dict gets home_/away_lineup_status + home_/away_pitcher_status.
    A side/pitcher is confirmed once the official lineup is posted (the card
    includes the starter) or the game has started; otherwise projected/probable.
    """
    pids: set[int] = set()
    lineup_cache: dict[int, dict] = {}
    pitcher_status: dict[int, str] = {}
    for g in slate:
        official = fetch.get_lineups(g["game_id"])
        sides: dict[str, list[int]] = {}
        for side, team_key in (("home", "home_id"), ("away", "away_id")):
            confirmed = bool(official.get(side)) or bool(g.get("started"))
            if official.get(side):
                sides[side] = official[side]
            elif g.get("started"):
                sides[side] = official.get(side, [])
            else:
                sides[side] = fetch.get_recent_lineup(g.get(team_key), as_of) if g.get(team_key) else []
            g[f"{side}_lineup_status"] = "confirmed" if confirmed else "projected"
            g[f"{side}_pitcher_status"] = "confirmed" if confirmed else "probable"
        lineup_cache[g["game_id"]] = sides
        pids.update(sides["home"] + sides["away"])
        for pid_key, side in (("home_pitcher_id", "home"), ("away_pitcher_id", "away")):
            if g.get(pid_key):
                pids.add(g[pid_key])
                pitcher_status[g[pid_key]] = g[f"{side}_pitcher_status"]
    meta = fetch.get_player_meta(list(pids))

    def _gamelog_fetch(pid: int) -> dict:
        """Fetch 3 seasons of game logs for a batter; coerce non-list returns to []."""
        result = {}
        for s in (season, season - 1, season - 2):
            raw = get_or_compute(f"bat-gamelog-{pid}-{s}", lambda s=s: fetch.batter_gamelog(pid, s))
            if isinstance(raw, list):
                result[s] = raw
            else:
                import logging
                logging.getLogger(__name__).warning(
                    "batter_gamelog(%s, %s) returned non-list %s — using []",
                    pid, s, type(raw).__name__)
                result[s] = []
        return result

    def batter_fn(pid: int, status: str) -> dict:
        m = meta.get(pid, {})
        events = get_or_compute(f"bat-events-v3-{pid}-{season}", lambda: fetch.batter_events(pid, season))
        prof = profiles.batter_profile_from_events(
            events, as_of=as_of, player_id=pid, name=m.get("name", str(pid)), bats=m.get("bats", "R"))
        prof = profiles.with_gamelog(prof, _gamelog_fetch(pid), current_season=season)
        prof["spray_sides"] = _spray.pool_spray([
            get_or_compute(f"bat-spray-{pid}-{yr}", lambda yr=yr: fetch.batter_spray(pid, yr))
            for yr in (season, season - 1, season - 2)
        ])
        prof["lineup_status"] = status
        return prof

    def _started_set(pid: int):
        """True-start game_pks for this pitcher-season; None if unavailable (-> all appearances)."""
        gl = get_or_compute(f"pit-gamelog-{pid}-{season}", lambda: fetch.pitcher_gamelog(pid, season))
        if not gl or not isinstance(gl, list) or "started" not in (gl[0] or {}):
            return None
        return {g["game_pk"] for g in gl if g.get("started") and g.get("game_pk") is not None}

    def pitcher_fn(pid: int) -> dict:
        m = meta.get(pid, {})
        events = get_or_compute(f"pit-events-v3-{pid}-{season}", lambda: fetch.pitcher_events(pid, season))
        prof = profiles.pitcher_profile_from_events(
            events, as_of=as_of, player_id=pid, name=m.get("name", str(pid)),
            throws=m.get("throws", "R"), started_game_pks=_started_set(pid))
        prof["pitcher_status"] = pitcher_status.get(pid, "confirmed")
        return prof

    def lineups_fn(game: dict) -> dict:
        lns = lineup_cache[game["game_id"]]
        return {
            "home": [batter_fn(pid, game.get("home_lineup_status", "confirmed")) for pid in lns["home"]],
            "away": [batter_fn(pid, game.get("away_lineup_status", "confirmed")) for pid in lns["away"]],
        }

    def _events_by_season(pid: int, kind: str) -> dict:
        fetcher = fetch.batter_events if kind == "bat" else fetch.pitcher_events
        prefix = "bat-events-v3" if kind == "bat" else "pit-events-v3"
        return {yr: get_or_compute(f"{prefix}-{pid}-{yr}", lambda yr=yr: fetcher(pid, yr))
                for yr in (season, season - 1, season - 2)}

    def batter_hist_fn(pid: int, status: str) -> dict:
        m = meta.get(pid, {})
        prof = profiles.blended_batter_profile(_events_by_season(pid, "bat"), as_of=as_of,
                                               current_season=season, player_id=pid,
                                               name=m.get("name", str(pid)), bats=m.get("bats", "R"))
        prof = profiles.with_gamelog(prof, _gamelog_fetch(pid), current_season=season)
        # Remap blended twins into base field names so the history run uses blended values
        prof["games"] = prof["games_hist"]
        prof["total_r"] = prof["total_r_hist"]
        prof["total_rbi"] = prof["total_rbi_hist"]
        prof["total_hrr"] = prof["total_hrr_hist"]
        # recent form is current-season only — the history twin is the form-neutral baseline
        prof["recent_form_mult"] = 1.0
        prof["production_form_hr"] = 1.0
        prof["production_form_hit"] = 1.0
        prof["production_form_tb"] = 1.0
        prof["recent_games"] = 0
        prof["recent_r"] = 0
        prof["recent_rbi"] = 0
        prof["recent_hrr"] = 0
        prof["spray_sides"] = _spray.pool_spray([
            get_or_compute(f"bat-spray-{pid}-{yr}", lambda yr=yr: fetch.batter_spray(pid, yr))
            for yr in (season, season - 1, season - 2)
        ])
        prof["lineup_status"] = status
        return prof

    def pitcher_hist_fn(pid: int) -> dict:
        m = meta.get(pid, {})
        prof = profiles.blended_pitcher_profile(_events_by_season(pid, "pit"), as_of=as_of,
                                                current_season=season, player_id=pid,
                                                name=m.get("name", str(pid)), throws=m.get("throws", "R"),
                                                started_game_pks=_started_set(pid))
        prof["pitcher_status"] = pitcher_status.get(pid, "confirmed")
        return prof

    def lineups_hist_fn(game: dict) -> dict:
        lns = lineup_cache[game["game_id"]]
        return {
            "home": [batter_hist_fn(pid, game.get("home_lineup_status", "confirmed")) for pid in lns["home"]],
            "away": [batter_hist_fn(pid, game.get("away_lineup_status", "confirmed")) for pid in lns["away"]],
        }

    return lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn


def _key(r: dict) -> tuple:
    return (r.get("player_id"), r.get("game_id"))


def build_board_with_history(slate, lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn,
                             weather_fn, bvp_fn):
    """Build current-mode rows, then attach history-mode twins (*_hist)."""
    hr = build_hr_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=bvp_fn)
    ks = build_strikeout_rows(slate, pitcher_fn, lineups_fn, weather_fn, bvp_fn=bvp_fn)
    hits = build_hits_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=bvp_fn)
    tb = build_total_bases_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=bvp_fn)

    hr_h = {_key(r): r for r in build_hr_rows(slate, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn=bvp_fn) if r.get("player_id") is not None}
    ks_h = {_key(r): r for r in build_strikeout_rows(slate, pitcher_hist_fn, lineups_hist_fn, weather_fn, bvp_fn=bvp_fn) if r.get("player_id") is not None}
    hits_h = {_key(r): r for r in build_hits_rows(slate, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn=bvp_fn) if r.get("player_id") is not None}
    tb_h = {_key(r): r for r in build_total_bases_rows(slate, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn=bvp_fn) if r.get("player_id") is not None}

    def _copy_vs(dst_vs, src_vs):
        for f in ("k_prob", "hit_prob", "lean", "prob"):
            dst_vs[f"{f}_hist"] = src_vs.get(f)

    for r in hr:
        h = hr_h.get(_key(r))
        if not h:
            continue
        r["probability_hist"] = h["probability"]
        r["probability_hist_beff"] = h.get("probability_beff")
        r["probability_bweight_hist"] = h.get("probability_bweight")
        r["barrel_mult_hist"] = h.get("barrel_mult")
        r["baseline_prob_hist"] = h.get("baseline_prob")
        r["pace_hist"] = h.get("pace")
        r["matchup_mult_hist"] = h.get("matchup_mult")
        r["park_mult_hist"] = h.get("park_mult")
        r["weather_mult_hist"] = h.get("weather_mult")
        r["pitcher_mult_hist"] = h.get("pitcher_mult")
        r["hard_hit_form_hist"] = h.get("hard_hit_form")
        r["production_form_hist"] = h.get("production_form")
        r["recent_form_mult_hist"] = h.get("recent_form_mult")
        r["bvp_mult_hist"] = h.get("bvp_mult")
        r["spray_pull_hist"] = h.get("spray_pull")
        r["spray_mult_hist"] = h.get("spray_mult")
        if r.get("vs") and h.get("vs"):
            _copy_vs(r["vs"], h["vs"])
    for r in ks:
        h = ks_h.get(_key(r))
        if not h:
            continue
        r["over_prob_hist"] = h["over_prob"]
        r["expected_ks_hist"] = h["expected_ks"]
        r["baseline_over_prob_hist"] = h.get("baseline_over_prob")
        r["pace_hist"] = h.get("pace")
        h_m_by_pid = {hm.get("player_id"): hm for hm in h.get("matchups", [])}
        for m in r.get("matchups", []):
            hm = h_m_by_pid.get(m.get("player_id"))
            if hm is not None:
                _copy_vs(m, hm)

    # Attach _hist twins for threshold props (hits: p_ge1/2/3; tb: p_ge2/3/4)
    _hits_thresholds = ("p_ge1", "p_ge2", "p_ge3")
    _tb_thresholds = ("p_ge2", "p_ge3", "p_ge4")
    # park_weather_factor is meaningful only for Total Bases, so it's omitted
    # from the hits twin set (it would always be an inert 1.0 on hits rows).
    _hits_factor_fields = ("recent_form_mult", "pitcher_factor", "hard_hit_form", "production_form",
                           "pace", "baseline_p_ge1", "baseline_p_ge2", "baseline_p_ge3",
                           "bvp_hit_mult", "spray_pull")
    _tb_factor_fields = ("recent_form_mult", "pitcher_factor", "park_weather_factor", "hard_hit_form", "production_form",
                         "pace", "baseline_p_ge2", "baseline_p_ge3", "baseline_p_ge4",
                         "bvp_hit_mult", "spray_pull", "spray_mult")

    for r in hits:
        h = hits_h.get(_key(r))
        if not h:
            continue
        for field in _hits_thresholds:
            if field in h:
                r[f"{field}_hist"] = h[field]
        for field in _hits_factor_fields:
            if field in h:
                r[f"{field}_hist"] = h[field]
        if "barrel_mult" in h:
            r["barrel_mult_hist"] = h["barrel_mult"]
        for field in _hits_thresholds:
            if f"{field}_beff" in h:
                r[f"{field}_beff_hist"] = h[f"{field}_beff"]
        for field in _hits_thresholds:
            if f"{field}_bweight" in h:
                r[f"{field}_bweight_hist"] = h[f"{field}_bweight"]
        if r.get("vs") and h.get("vs"):
            _copy_vs(r["vs"], h["vs"])
    for r in tb:
        h = tb_h.get(_key(r))
        if not h:
            continue
        for field in _tb_thresholds:
            if field in h:
                r[f"{field}_hist"] = h[field]
        for field in _tb_factor_fields:
            if field in h:
                r[f"{field}_hist"] = h[field]
        if "barrel_mult" in h:
            r["barrel_mult_hist"] = h["barrel_mult"]
        for field in _tb_thresholds:
            if f"{field}_beff" in h:
                r[f"{field}_beff_hist"] = h[f"{field}_beff"]
        for field in _tb_thresholds:
            if f"{field}_bweight" in h:
                r[f"{field}_bweight_hist"] = h[f"{field}_bweight"]
        if r.get("vs") and h.get("vs"):
            _copy_vs(r["vs"], h["vs"])

    # Runs / RBI / HRR
    runs = build_runs_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=bvp_fn)
    rbi  = build_rbi_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=bvp_fn)
    hrr  = build_hrr_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=bvp_fn)
    runs_h = {_key(r): r for r in build_runs_rows(slate, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn=bvp_fn) if r.get("player_id") is not None}
    rbi_h  = {_key(r): r for r in build_rbi_rows(slate, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn=bvp_fn) if r.get("player_id") is not None}
    hrr_h  = {_key(r): r for r in build_hrr_rows(slate, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn=bvp_fn) if r.get("player_id") is not None}

    _runs_thresholds = ("p_ge1", "p_ge2")
    _hrr_thresholds = ("p_ge2", "p_ge3", "p_ge4")
    _run_factor_fields = ("recent_form_mult", "pitcher_factor", "park_weather_factor", "hard_hit_form", "production_form",
                          "lineup_mult", "lineup_slot", "lineup_teammate",
                          "pace", "baseline_p_ge1", "baseline_p_ge2", "baseline_p_ge3", "baseline_p_ge4",
                          "platoon_mult")

    def _attach(rows, hist_map, thresholds):
        for r in rows:
            h = hist_map.get(_key(r))
            if not h:
                continue
            for field in thresholds:
                if field in h:
                    r[f"{field}_hist"] = h[field]
            for field in _run_factor_fields:
                if field in h:
                    r[f"{field}_hist"] = h[field]
            if "barrel_mult" in h:
                r["barrel_mult_hist"] = h["barrel_mult"]
            for field in thresholds:
                if f"{field}_beff" in h:
                    r[f"{field}_beff_hist"] = h[f"{field}_beff"]
            for field in thresholds:
                if f"{field}_bweight" in h:
                    r[f"{field}_bweight_hist"] = h[f"{field}_bweight"]
            if r.get("vs") and h.get("vs"):
                _copy_vs(r["vs"], h["vs"])

    _attach(runs, runs_h, _runs_thresholds)
    _attach(rbi, rbi_h, _runs_thresholds)
    _attach(hrr, hrr_h, _hrr_thresholds)

    return hr, ks, hits, tb, runs, rbi, hrr


def make_bvp_fn():
    """Cached career batter-vs-pitcher fetcher for the pipeline (display on
    both props + the capped HR history dial).

    A transient API failure caches the same {} sentinel as genuine
    no-history, so the pair shows "no history" until the next .cache/
    clear - acceptable for display context."""
    def bvp_fn(batter_id, pitcher_id):
        if not batter_id or not pitcher_id:
            return None
        out = get_or_compute(f"bvp-{batter_id}-{pitcher_id}",
                             lambda: fetch.get_bvp(batter_id, pitcher_id) or {})
        return out or None
    return bvp_fn


_MIN_PITCHES_FOR_RATE = 50  # guard thin-sample swstr/csw


def _pct(x) -> float:
    return round((x or 0.0) * 100.0, 1)


def _pct_delta(m):
    """Convert a multiplier (e.g. 1.05) to a percent-delta display value (+5.0).

    Returns None when m is not a real number (so the frontend shows "—"
    for a factor that was never computed)."""
    if not isinstance(m, (int, float)):
        return None
    return round((m - 1.0) * 100, 1)


def _hand(bats: str) -> str:
    if bats == "S":
        return "SW"
    return bats if bats in ("R", "L") else "R"


def _hrform_score(b: dict) -> int:
    """Recent HR/power form -> 20-90 display score. SEED."""
    form = b.get("recent_form_mult") or 1.0
    return max(20, min(90, round(55 + (form - 1.0) * 130)))


def _matchup_score(b: dict, opp: dict | None, pmult: float) -> int:
    """Overall matchup favorability (hitter production x pitcher vulnerability x platoon) -> 30-90. SEED."""
    if not opp:
        return 50
    hit_fav = (b.get("hit_rate", LEAGUE_HIT) / LEAGUE_HIT) * (opp.get("hit_allowed_rate", LEAGUE_HIT) / LEAGUE_HIT) * pmult
    return max(30, min(90, round(55 + (hit_fav - 1.0) * 60)))


def _hitter_board(b: dict, opp: dict | None, order: int, team: str,
                  factors_by_pid=None) -> dict:
    pmult = hr_platoon_mult(b.get("bats", "R"), opp.get("throws", "R")) if opp else 1.0
    bmult = barrel_effect_mult(b, opp, prop="hr") if opp else 1.0
    orc = oracle(b, barrel_mult=bmult, platoon_mult=pmult)
    score = prop_score(b, opp, platoon_mult=pmult) if opp else 0.0
    f = (factors_by_pid or {}).get(b.get("player_id")) or {}
    pitches = b.get("pitches")
    _thin = pitches is not None and pitches < _MIN_PITCHES_FOR_RATE
    return {
        "id": b.get("player_id"),
        "name": b.get("name", ""),
        "hand": _hand(b.get("bats", "R")),
        "team": team,
        "order": order,
        "stats": {
            "trueScore": score,
            "oracle": 1 if orc["oracle"] else 0,
            "oracle_score": orc["oracle_score"],
            "brl": _pct(b.get("barrel_rate")),
            "pbrl": _pct(b.get("pulled_barrel_rate")),
            "sweet": _pct(b.get("sweetspot_rate")),
            "fb": _pct(b.get("fb_rate")),
            "hh": _pct(b.get("hardhit_rate")),
            "hardhit": _pct(b.get("hardhit_rate")),
            "la": round(b.get("la_mean") or 0.0, 1),
            "xwobacon": round(b.get("xwobacon") or 0.0, 3),
            "hrfb": _pct(b.get("hrfb_rate")),
            "swstr": None if _thin else _pct(b.get("swstr")),
            "csw": None if _thin else _pct(b.get("csw")),
            "ball": _pct(b.get("ball")),
            "iso": round((b.get("iso") or 0.0), 3),
            "xwoba": round((b.get("xwoba") or 0.0), 3),
            "zonefit": zone_fit(b.get("zone_dmg") or {}, opp.get("zone_freq") or {}) if opp else 0.0,
            "matchup": _matchup_score(b, opp, pmult),
            "hrform": _hrform_score(b),
            # Driver columns (percent-delta of each multiplier; None = not computed yet)
            "park": _pct_delta(f.get("park_mult")),
            "weather": _pct_delta(f.get("weather_mult")),
            "pitcher": _pct_delta(f.get("pitcher_mult")),
            "platoon": _pct_delta(pmult),
            "form": _pct_delta(b.get("recent_form_mult")),
        },
    }


def _kscore(p: dict) -> int:
    """Pitcher strikeout ability -> 30-60 display score. SEED."""
    kpb = p.get("k_per_bf") or LEAGUE_K
    return max(30, min(60, round(45 + (kpb / LEAGUE_K - 1.0) * 40)))


def _pscore(p: dict) -> int:
    """Overall pitcher quality: whiff + contact suppression -> 30-60 display score. SEED."""
    kpb = p.get("k_per_bf") or LEAGUE_K
    ha = p.get("hit_allowed_rate") or LEAGUE_HIT
    quality = (kpb / LEAGUE_K + LEAGUE_HIT / max(ha, 0.05)) / 2.0
    return max(30, min(60, round(45 + (quality - 1.0) * 30)))


def _pitcher_board(p: dict, opp_team: str) -> dict:
    pitches = p.get("pitches")
    _thin = pitches is not None and pitches < _MIN_PITCHES_FOR_RATE
    return {
        "name": p.get("name", ""),
        "team": "",
        "throws": p.get("throws", "R"),
        "opp": opp_team,
        "stats": {
            "pbrl": _pct(p.get("pulled_barrel_rate_allowed")),
            "brlbip": _pct(p.get("barrel_rate_allowed")),
            "fb": _pct(p.get("fb_rate_allowed")),
            "hh": _pct(p.get("hardhit_rate_allowed")),
            "swstr": None if _thin else _pct(p.get("swstr")),
            "csw": None if _thin else _pct(p.get("csw")),
            "ball": _pct(p.get("ball")),
            "xwoba": round((p.get("xwoba_allowed") or 0.0), 3),
            "pscore": _pscore(p),
            "kscore": _kscore(p),
        },
    }


def build_boards_payload(slate: list[dict], lineups_fn, pitcher_fn,
                         factors_by_pid=None,
                         lineups_hist_fn=None, pitcher_hist_fn=None,
                         factors_by_pid_hist=None) -> dict:
    """Per-game barrel boards (display only): each team's hitters (real barrel
    stats + Prop Score) vs the pitcher they face, plus a slate-pitchers list of
    barrel-allowed rows.

    factors_by_pid: optional {player_id: {"park_mult": …, "weather_mult": …,
    "pitcher_mult": …}} map built from the HR rows so the driver columns
    (park / weather / pitcher / platoon / form) can be surfaced on the board.

    lineups_hist_fn / pitcher_hist_fn / factors_by_pid_hist: optional history
    counterparts. When provided, every stat key on each hitter row's ``stats``
    dict gets a ``<key>_hist`` twin computed from the blended history profile,
    and each pitcher board row gets ``pscore_hist`` / ``kscore_hist`` etc.
    The current-mode values are never modified (additive only)."""
    games, pitchers, seen_p = [], [], set()
    use_hist = lineups_hist_fn is not None and pitcher_hist_fn is not None
    for game in slate:
        away, home = game.get("away", "?"), game.get("home", "?")
        home_p = pitcher_fn(game["home_pitcher_id"]) if game.get("home_pitcher_id") else None
        away_p = pitcher_fn(game["away_pitcher_id"]) if game.get("away_pitcher_id") else None
        lns = lineups_fn(game)
        # away batters face the HOME pitcher; home batters face the AWAY pitcher
        away_hitters = [_hitter_board(b, home_p, i + 1, away, factors_by_pid)
                        for i, b in enumerate(lns.get("away", []))]
        home_hitters = [_hitter_board(b, away_p, i + 1, home, factors_by_pid)
                        for i, b in enumerate(lns.get("home", []))]

        # History twins: build a second set of rows from blended profiles and
        # attach every stat as a <key>_hist onto the matching current row.
        home_p_h = away_p_h = None
        if use_hist:
            home_p_h = pitcher_hist_fn(game["home_pitcher_id"]) if game.get("home_pitcher_id") else None
            away_p_h = pitcher_hist_fn(game["away_pitcher_id"]) if game.get("away_pitcher_id") else None
            lns_h = lineups_hist_fn(game)
            # away hist hitters face home pitcher (hist); index by player_id for matching
            away_hist_by_id = {
                row["id"]: row
                for row in [_hitter_board(b_h, home_p_h, i + 1, away, factors_by_pid_hist)
                             for i, b_h in enumerate(lns_h.get("away", []))]
            }
            home_hist_by_id = {
                row["id"]: row
                for row in [_hitter_board(b_h, away_p_h, i + 1, home, factors_by_pid_hist)
                             for i, b_h in enumerate(lns_h.get("home", []))]
            }
            for h in away_hitters:
                h_hist = away_hist_by_id.get(h["id"])
                if h_hist:
                    for k, v in h_hist["stats"].items():
                        h["stats"][f"{k}_hist"] = v
            for h in home_hitters:
                h_hist = home_hist_by_id.get(h["id"])
                if h_hist:
                    for k, v in h_hist["stats"].items():
                        h["stats"][f"{k}_hist"] = v

        games.append({
            "game_id": game.get("game_id"),
            "id": f"{away}-{home}",
            "away": away, "home": home,
            "venue": game.get("park_name", ""),
            "note": "",
            "awayPitcher": home_p.get("name", "") if home_p else "",
            "homePitcher": away_p.get("name", "") if away_p else "",
            "awayHitters": away_hitters,
            "homeHitters": home_hitters,
        })
        for p, p_h, opp in ((home_p, home_p_h, away), (away_p, away_p_h, home)):
            if p and p.get("player_id") not in seen_p:
                seen_p.add(p.get("player_id"))
                p_row = _pitcher_board(p, opp)
                if p_h:
                    p_h_row = _pitcher_board(p_h, opp)
                    for k, v in p_h_row["stats"].items():
                        p_row["stats"][f"{k}_hist"] = v
                pitchers.append(p_row)
    return {"games": games, "pitchers": pitchers}


def main(date_str: str, max_games: int | None = None, include_started: bool = False) -> None:
    season = int(date_str[:4])
    slate = fetch.get_schedule(date_str)
    if max_games is not None:
        slate = slate[:max_games]
    if include_started:
        # demo/backfill mode: process finished games too (so a past date with
        # posted lineups produces a full board to preview the site with real data)
        for g in slate:
            g["started"] = False

    _ensure_starters(slate)
    lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn = make_profile_fns(slate, season, date_str)
    weather_fn = fetch.make_weather_fn()
    bvp_fn = make_bvp_fn()
    hr_rows, k_rows, hits_rows, tb_rows, runs_rows, rbi_rows, hrr_rows = build_board_with_history(
        slate, lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn, weather_fn, bvp_fn)

    # Build per-player factor map from HR rows so the Boards page can surface
    # the park / weather / pitcher driver columns (same compute, display-only).
    factors_by_pid = {
        r["player_id"]: {
            "park_mult": r.get("park_mult"),
            "weather_mult": r.get("weather_mult"),
            "pitcher_mult": r.get("pitcher_mult"),
        }
        for r in hr_rows if r.get("player_id")
    }

    payload = {
        "date": date_str,
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "hr": hr_rows,
        "strikeouts": k_rows,
        "hits": hits_rows,
        "total_bases": tb_rows,
        "runs": runs_rows,
        "rbi": rbi_rows,
        "hrr": hrr_rows,
        "games": build_games(slate, weather_fn),
        "boards": build_boards_payload(slate, lineups_fn, pitcher_fn,
                                       factors_by_pid=factors_by_pid,
                                       lineups_hist_fn=lineups_hist_fn,
                                       pitcher_hist_fn=pitcher_hist_fn),
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / f"{date_str}.json").write_text(json.dumps(payload, indent=2))
    # latest.json mirrors the date just written (fallback default for the site)
    (DATA_DIR / "latest.json").write_text(json.dumps(payload, indent=2))
    _update_index(date_str)
    print(f"Wrote {date_str}.json ({len(hr_rows)} HR rows, {len(k_rows)} K rows, {len(hits_rows)} hits rows, {len(tb_rows)} TB rows, {len(runs_rows)} runs rows, {len(rbi_rows)} RBI rows, {len(hrr_rows)} HRR rows, {len(payload['games'])} games)")


if __name__ == "__main__":
    args = sys.argv[1:]
    include_started = "--include-started" in args
    args = [a for a in args if a != "--include-started"]
    date = args[0] if args else "2026-06-11"
    limit = int(args[1]) if len(args) > 1 else None
    main(date, limit, include_started)
