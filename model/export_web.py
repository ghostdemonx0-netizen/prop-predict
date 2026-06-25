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
from model.cache import get_or_compute
from model.pipeline import build_hr_rows, build_strikeout_rows, build_games, build_hits_rows, build_total_bases_rows, build_runs_rows, build_rbi_rows, build_hrr_rows

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
        events = get_or_compute(f"bat-events-{pid}-{season}", lambda: fetch.batter_events(pid, season))
        prof = profiles.batter_profile_from_events(
            events, as_of=as_of, player_id=pid, name=m.get("name", str(pid)), bats=m.get("bats", "R"))
        prof = profiles.with_gamelog(prof, _gamelog_fetch(pid), current_season=season)
        prof["lineup_status"] = status
        return prof

    def pitcher_fn(pid: int) -> dict:
        m = meta.get(pid, {})
        events = get_or_compute(f"pit-events-{pid}-{season}", lambda: fetch.pitcher_events(pid, season))
        prof = profiles.pitcher_profile_from_events(
            events, as_of=as_of, player_id=pid, name=m.get("name", str(pid)), throws=m.get("throws", "R"))
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
        prefix = "bat-events" if kind == "bat" else "pit-events"
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
        prof["lineup_status"] = status
        return prof

    def pitcher_hist_fn(pid: int) -> dict:
        m = meta.get(pid, {})
        prof = profiles.blended_pitcher_profile(_events_by_season(pid, "pit"), as_of=as_of,
                                                current_season=season, player_id=pid,
                                                name=m.get("name", str(pid)), throws=m.get("throws", "R"))
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
        if r.get("vs") and h.get("vs"):
            _copy_vs(r["vs"], h["vs"])
    for r in ks:
        h = ks_h.get(_key(r))
        if not h:
            continue
        r["over_prob_hist"] = h["over_prob"]
        r["expected_ks_hist"] = h["expected_ks"]
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
    _hits_factor_fields = ("recent_form_mult", "pitcher_factor")
    _tb_factor_fields = ("recent_form_mult", "pitcher_factor", "park_weather_factor")

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
    _run_factor_fields = ("recent_form_mult", "pitcher_factor", "park_weather_factor")

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
