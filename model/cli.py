"""Command-line entry: compute HR + K projections for a date.

Usage:
    uv run python -m model.cli 2026-06-10
Writes JSON to projections-<date>.json and prints tables.
"""

import json
import sys

from model import fetch
from model.pipeline import build_hr_rows, build_strikeout_rows

# Stadium coordinates for weather lookups, keyed by park abbreviation.
PARK_COORDS = {
    "ARI": (33.445, -112.067), "ATL": (33.890, -84.468), "BAL": (39.284, -76.622),
    "BOS": (42.346, -71.097), "CHC": (41.948, -87.655), "CWS": (41.830, -87.634),
    "CIN": (39.097, -84.507), "CLE": (41.496, -81.685), "COL": (39.756, -104.994),
    "DET": (42.339, -83.049), "HOU": (29.757, -95.355), "KC": (39.051, -94.480),
    "LAA": (33.800, -117.883), "LAD": (34.074, -118.240), "MIA": (25.778, -80.220),
    "MIL": (43.028, -87.971), "MIN": (44.982, -93.278), "NYM": (40.757, -73.846),
    "NYY": (40.829, -73.926), "OAK": (38.580, -121.513), "PHI": (39.906, -75.166),
    "PIT": (40.447, -80.006), "SD": (32.707, -117.157), "SF": (37.778, -122.389),
    "SEA": (47.591, -122.332), "STL": (38.622, -90.193), "TB": (27.768, -82.653),
    "TEX": (32.747, -97.083), "TOR": (43.641, -79.389), "WSH": (38.873, -77.007),
}


def format_table(rows: list[dict], columns: list[str]) -> str:
    """Render rows as a fixed-width text table. 'probability'/'over_prob'
    columns are shown as percentages."""
    pct_cols = {"probability", "over_prob"}
    header = " | ".join(c.ljust(12) for c in columns)
    lines = [header, "-" * len(header)]
    for r in rows:
        cells = []
        for c in columns:
            v = r.get(c, "")
            if c in pct_cols and isinstance(v, (int, float)):
                cells.append(f"{v * 100:.1f}%".ljust(12))
            elif isinstance(v, float):
                cells.append(f"{v:.2f}".ljust(12))
            else:
                cells.append(str(v).ljust(12))
        lines.append(" | ".join(cells))
    return "\n".join(lines)


def _weather_fn(game: dict) -> dict:
    lat, lon = PARK_COORDS.get(game["park_team"], (39.0, -98.0))
    if not game.get("game_time"):
        # Lineups/time not posted yet -> neutral weather rather than crashing.
        return {"wind_speed_mph": 0.0, "wind_from_deg": 0.0, "temp_f": 70.0}
    return fetch.get_weather(lat, lon, game["game_time"])


def main(date_str: str) -> None:
    slate = fetch.get_schedule(date_str)

    def batters_fn(game_id: int) -> list[dict]:
        ids = fetch.get_lineup_batter_ids(game_id)
        return [fetch.build_batter_profile(pid, int(date_str[:4])) for pid in ids]

    def pitcher_fn(pid: int) -> dict:
        return fetch.build_pitcher_profile(pid, int(date_str[:4]))

    hr_rows = build_hr_rows(slate, batters_fn, _weather_fn)
    k_rows = build_strikeout_rows(slate, pitcher_fn)

    print("\n=== HOME RUNS ===")
    print(format_table(hr_rows, ["player", "team", "park", "probability", "wind_out_mph"]))
    print("\n=== STRIKEOUTS ===")
    print(format_table(k_rows, ["player", "team", "expected_ks", "line", "over_prob"]))

    out = {"date": date_str, "hr": hr_rows, "strikeouts": k_rows}
    path = f"projections-{date_str}.json"
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nSaved {path}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "2026-06-10")
