"""Tiny JSON disk cache so slow per-player fetches happen once per season.

Keys map to sanitized filenames under cache_dir. Raw per-player event lists
are keyed ``bat-events-{pid}-{season}`` / ``pit-events-{pid}-{season}`` — no
date in the key, because as-of date filtering happens at profile-compute time
(see model/profiles.py). Freshness: the daily automation merges yesterday's league rows into the
event caches each morning (model/daily.update_events) and clears only the
bvp-* pair files; a full .cache/ wipe is never needed routinely.
"""

import json
import re
from pathlib import Path
from typing import Callable

DEFAULT_DIR = Path(__file__).resolve().parent.parent / ".cache"


def _safe(key: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", key)


def get_or_compute(key: str, producer: Callable[[], dict], cache_dir=DEFAULT_DIR) -> dict:
    """Return cached JSON for `key`, or run `producer()`, cache, and return it."""
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_dir / f"{_safe(key)}.json"
    if path.exists():
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            pass  # fall through and recompute on a corrupt/unreadable file
    value = producer()
    path.write_text(json.dumps(value))
    return value
