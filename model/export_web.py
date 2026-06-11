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
from model.pipeline import build_hr_rows, build_strikeout_rows, build_games

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
    dates = sorted(set(dates) | {date_str}, reverse=True)[:7]
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
    """(lineups_fn, pitcher_fn) backed by the on-disk events cache.

    Raw per-player Statcast events are cached once per season; profiles are
    computed fresh per slate date so a regenerated past day only sees games
    played before it.
    """
    pids: set[int] = set()
    lineup_cache: dict[int, dict] = {}
    for g in slate:
        lineup_cache[g["game_id"]] = fetch.get_lineups(g["game_id"])
        pids.update(lineup_cache[g["game_id"]]["home"] + lineup_cache[g["game_id"]]["away"])
        for k in ("home_pitcher_id", "away_pitcher_id"):
            if g.get(k):
                pids.add(g[k])
    meta = fetch.get_player_meta(list(pids))

    def batter_fn(pid: int) -> dict:
        m = meta.get(pid, {})
        events = get_or_compute(f"bat-events-{pid}-{season}", lambda: fetch.batter_events(pid, season))
        return profiles.batter_profile_from_events(
            events, as_of=as_of, player_id=pid, name=m.get("name", str(pid)), bats=m.get("bats", "R"))

    def pitcher_fn(pid: int) -> dict:
        m = meta.get(pid, {})
        events = get_or_compute(f"pit-events-{pid}-{season}", lambda: fetch.pitcher_events(pid, season))
        return profiles.pitcher_profile_from_events(
            events, as_of=as_of, player_id=pid, name=m.get("name", str(pid)), throws=m.get("throws", "R"))

    def lineups_fn(game: dict) -> dict:
        lns = lineup_cache[game["game_id"]]
        return {
            "home": [batter_fn(pid) for pid in lns["home"]],
            "away": [batter_fn(pid) for pid in lns["away"]],
        }

    return lineups_fn, pitcher_fn


def _attach_bvp(hr_rows: list[dict], k_rows: list[dict]) -> None:
    """Annotate matchup entries with career batter-vs-pitcher history (display
    context only; cached per pair, one API call each)."""
    def bvp(batter_id, pitcher_id):
        if not batter_id or not pitcher_id:
            return None
        out = get_or_compute(f"bvp-{batter_id}-{pitcher_id}",
                             lambda: fetch.get_bvp(batter_id, pitcher_id) or {})
        return out or None

    for r in hr_rows:
        if r.get("vs"):
            r["vs"]["bvp"] = bvp(r.get("player_id"), r["vs"].get("player_id"))
    for r in k_rows:
        for m in r.get("matchups") or []:
            m["bvp"] = bvp(m.get("player_id"), r.get("player_id"))


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
    lineups_fn, pitcher_fn = make_profile_fns(slate, season, date_str)
    weather_fn = fetch.make_weather_fn()

    hr_rows = build_hr_rows(slate, lineups_fn, pitcher_fn, weather_fn)
    k_rows = build_strikeout_rows(slate, pitcher_fn, lineups_fn, weather_fn)
    _attach_bvp(hr_rows, k_rows)

    payload = {
        "date": date_str,
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "hr": hr_rows,
        "strikeouts": k_rows,
        "games": build_games(slate, weather_fn),
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / f"{date_str}.json").write_text(json.dumps(payload, indent=2))
    # latest.json mirrors the date just written (fallback default for the site)
    (DATA_DIR / "latest.json").write_text(json.dumps(payload, indent=2))
    _update_index(date_str)
    print(f"Wrote {date_str}.json ({len(hr_rows)} HR rows, {len(k_rows)} K rows, {len(payload['games'])} games)")


if __name__ == "__main__":
    args = sys.argv[1:]
    include_started = "--include-started" in args
    args = [a for a in args if a != "--include-started"]
    date = args[0] if args else "2026-06-11"
    limit = int(args[1]) if len(args) > 1 else None
    main(date, limit, include_started)
