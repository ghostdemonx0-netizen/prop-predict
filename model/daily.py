"""Daily automation logic: incremental stat updates, freeze-merge board
refresh, and the early-exit signature. Network fetchers and directories are
injectable so everything unit-tests offline.

History integrity rule: a date file is only ever touched on its own ET day;
past days keep their final pre-game state (the honest record the future
public pick log needs). model/backfill.py stays a manual dev tool.
"""

import datetime as dt
import hashlib
import json
from pathlib import Path

from model import export_web, fetch
from model.cache import DEFAULT_DIR, _safe
from model.pipeline import build_hr_rows, build_strikeout_rows, build_games

_MARKER = "events-updated-through.json"
_SIGNATURE = "last-signature.json"
_MAX_GAP_DAYS = 10

_BAT_KEYS = ("game_date", "events", "launch_speed")
_PIT_KEYS = ("game_date", "events", "game_pk")


def merge_day_into_caches(day_rows: list[dict], cache_dir=DEFAULT_DIR) -> int:
    """Append one day of league-wide slim Statcast rows into the existing
    per-player event caches. Idempotent: rows for that date are replaced.

    Players with NO cache file are skipped, never created - a partial cache
    would masquerade as a full season; they get a full pull on first
    appearance via the normal export path. Returns files updated.
    """
    cache_dir = Path(cache_dir)
    by_key: dict[str, list[dict]] = {}
    for r in day_rows:
        season = str(r["game_date"])[:4]
        if r.get("batter"):
            by_key.setdefault(f"bat-events-{int(r['batter'])}-{season}", []).append(
                {k: r.get(k) for k in _BAT_KEYS})
        if r.get("pitcher"):
            by_key.setdefault(f"pit-events-{int(r['pitcher'])}-{season}", []).append(
                {k: r.get(k) for k in _PIT_KEYS})
    updated = 0
    for key, rows in by_key.items():
        path = cache_dir / f"{_safe(key)}.json"
        if not path.exists():
            continue
        date = rows[0]["game_date"]
        kept = [e for e in json.loads(path.read_text()) if e["game_date"] != date]
        path.write_text(json.dumps(kept + rows))
        updated += 1
    return updated
