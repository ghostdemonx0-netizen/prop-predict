"""Tiny JSON disk cache so slow per-player fetches happen once per run/day.

Keys are sanitized into filenames under cache_dir. Callers include the date
in the key (e.g. "batter-592450-2026") so a new day naturally uses fresh
files; old files can simply be deleted.
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
