"""Command-line entry: compute HR + K projections for a date.

Usage:
    uv run python -m model.cli 2026-06-10
Writes JSON to projections-<date>.json and prints tables.
"""

import json
import sys

from model import fetch
from model.export_web import make_profile_fns
from model.pipeline import build_hr_rows, build_strikeout_rows


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


def main(date_str: str) -> None:
    slate = fetch.get_schedule(date_str)
    # Starters are not back-resolved from boxscores here; for finished dates
    # use export_web.main(include_started=True) instead.
    lineups_fn, pitcher_fn = make_profile_fns(slate, int(date_str[:4]), date_str)
    weather_fn = fetch.make_weather_fn()

    hr_rows = build_hr_rows(slate, lineups_fn, pitcher_fn, weather_fn)
    k_rows = build_strikeout_rows(slate, pitcher_fn, lineups_fn, weather_fn)

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
