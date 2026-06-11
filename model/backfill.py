"""Regenerate the last N days of data files (default 7).

Usage:
    uv run python -m model.backfill 2026-06-10 7 [max_games]
First arg is the most-recent date to include; it walks backwards N days.
Past games are included (finished games still have boxscore starters), and
player Statcast pulls are cached so repeated days are fast.
"""

import datetime as dt
import sys

from model import export_web


def main(end_date: str, days: int = 7, max_games: int | None = None) -> None:
    end = dt.date.fromisoformat(end_date)
    for i in range(days):
        d = (end - dt.timedelta(days=i)).isoformat()
        print(f"=== backfilling {d} ===")
        try:
            export_web.main(d, max_games=max_games, include_started=True)
        except Exception as e:  # one bad day shouldn't abort the whole backfill
            print(f"  skipped {d}: {e}")


if __name__ == "__main__":
    end = sys.argv[1] if len(sys.argv) > 1 else dt.date.today().isoformat()
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 7
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else None
    main(end, n, limit)
