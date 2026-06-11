"""Generate the website's data file from the live engine (cached).

Usage:
    uv run python -m model.export_web 2026-06-11 [max_games]
Writes web/public/data/latest.json. Player Statcast pulls are cached under
.cache/ so reruns are fast; pass an optional max_games to limit a slow first run.
"""

import datetime as dt
import json
import sys
from pathlib import Path

from model import fetch
from model.cache import get_or_compute
from model.cli import _weather_fn
from model.pipeline import build_hr_rows, build_strikeout_rows, build_games

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "latest.json"


def _ensure_starters(slate: list[dict]) -> None:
    """Populate home/away_pitcher_id from the boxscore when the schedule's
    probable-pitcher fields are blank (true for finished games)."""
    for g in slate:
        if g.get("home_pitcher_id") and g.get("away_pitcher_id"):
            continue
        s = fetch.get_starters(g["game_id"])
        g["home_pitcher_id"] = g.get("home_pitcher_id") or s["home"]
        g["away_pitcher_id"] = g.get("away_pitcher_id") or s["away"]


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

    # resolve handedness once for every player on the slate
    pids: set[int] = set()
    lineup_cache: dict[int, dict] = {}
    for g in slate:
        lineup_cache[g["game_id"]] = fetch.get_lineups(g["game_id"])
        pids.update(lineup_cache[g["game_id"]]["home"] + lineup_cache[g["game_id"]]["away"])
        for k in ("home_pitcher_id", "away_pitcher_id"):
            if g.get(k):
                pids.add(g[k])
    meta = fetch.get_player_meta(list(pids))

    def batter_profile(pid: int) -> dict:
        m = meta.get(pid, {})
        return get_or_compute(
            f"batter-{pid}-{season}",
            lambda: fetch.build_batter_profile(pid, season, name=m.get("name", str(pid)), bats=m.get("bats", "R")),
        )

    def pitcher_profile(pid: int) -> dict:
        m = meta.get(pid, {})
        return get_or_compute(
            f"pitcher-{pid}-{season}",
            lambda: fetch.build_pitcher_profile(pid, season, name=m.get("name", str(pid)), throws=m.get("throws", "R")),
        )

    def lineups_fn(game: dict) -> dict:
        lns = lineup_cache[game["game_id"]]
        return {
            "home": [batter_profile(pid) for pid in lns["home"]],
            "away": [batter_profile(pid) for pid in lns["away"]],
        }

    hr_rows = build_hr_rows(slate, lineups_fn, pitcher_profile, _weather_fn)
    k_rows = build_strikeout_rows(slate, pitcher_profile, lineups_fn, _weather_fn)

    payload = {
        "date": date_str,
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "hr": hr_rows,
        "strikeouts": k_rows,
        "games": build_games(slate, _weather_fn),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {OUT} ({len(hr_rows)} HR rows, {len(k_rows)} K rows, {len(payload['games'])} games)")


if __name__ == "__main__":
    args = sys.argv[1:]
    include_started = "--include-started" in args
    args = [a for a in args if a != "--include-started"]
    date = args[0] if args else "2026-06-11"
    limit = int(args[1]) if len(args) > 1 else None
    main(date, limit, include_started)
