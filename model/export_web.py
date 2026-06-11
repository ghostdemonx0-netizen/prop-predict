"""Generate the website's data file from the live engine.

Usage:
    uv run python -m model.export_web 2026-06-10
Writes web/public/data/latest.json. Slow (live Statcast per player).
"""

import datetime as dt
import json
import sys
from pathlib import Path

from model import fetch
from model.cli import _weather_fn
from model.pipeline import build_hr_rows, build_strikeout_rows

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "latest.json"


def main(date_str: str) -> None:
    slate = fetch.get_schedule(date_str)
    season = int(date_str[:4])

    def batters_fn(game_id: int) -> list[dict]:
        ids = fetch.get_lineup_batter_ids(game_id)
        names = fetch.get_player_names(ids)
        return [fetch.build_batter_profile(pid, season, name=names.get(pid, str(pid))) for pid in ids]

    def pitcher_fn(pid: int) -> dict:
        name = fetch.get_player_names([pid]).get(pid, str(pid))
        return fetch.build_pitcher_profile(pid, season, name=name)

    hr_rows = build_hr_rows(slate, batters_fn, _weather_fn)
    k_rows = build_strikeout_rows(slate, pitcher_fn, _weather_fn)

    payload = {
        "date": date_str,
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "hr": hr_rows,
        "strikeouts": k_rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {OUT} ({len(hr_rows)} HR rows, {len(k_rows)} K rows)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "2026-06-10")
