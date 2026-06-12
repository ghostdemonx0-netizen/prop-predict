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


def update_events(today: str, *, fetch_day=None, cache_dir=DEFAULT_DIR) -> list[str]:
    """Bring the event caches up to date through yesterday (relative to the
    ET date ``today``). Walks any missed days; a gap beyond _MAX_GAP_DAYS
    deletes the event caches instead (players re-pull fully on demand -
    slow but automatic). Returns the list of dates ingested.
    """
    fetch_day = fetch_day or fetch.statcast_day
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    marker = cache_dir / _MARKER
    target = dt.date.fromisoformat(today) - dt.timedelta(days=1)
    start = target  # no marker -> just yesterday
    if marker.exists():
        last = dt.date.fromisoformat(json.loads(marker.read_text())["date"])
        if last >= target:
            return []
        start = last + dt.timedelta(days=1)
    if (target - start).days + 1 > _MAX_GAP_DAYS:
        for f in list(cache_dir.glob("bat-events-*.json")) + list(cache_dir.glob("pit-events-*.json")):
            f.unlink()
        marker.write_text(json.dumps({"date": target.isoformat()}))
        return ["<cache-reset>"]
    ingested: list[str] = []
    d = start
    while d <= target:
        merge_day_into_caches(fetch_day(d.isoformat()), cache_dir)
        ingested.append(d.isoformat())
        d += dt.timedelta(days=1)
    marker.write_text(json.dumps({"date": target.isoformat()}))
    return ingested
