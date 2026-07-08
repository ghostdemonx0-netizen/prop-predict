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
import re as _re
from pathlib import Path

from model import export_web, fetch
from model.cache import DEFAULT_DIR, _safe
from model.pipeline import build_games

_MARKER = "events-updated-through.json"
_SIGNATURE = "last-signature.json"
_MAX_GAP_DAYS = 10
_REPULL_WINDOW = 3  # re-pull the trailing N days each fold so a day grabbed
                    # before its stats settled self-heals on a later run

_BAT_KEYS = ("game_date", "events", "launch_speed")
_PIT_KEYS = ("game_date", "events", "game_pk")


def sweep_stale_season_caches(current_season: int, *, keep: int = 3, cache_dir=DEFAULT_DIR) -> list[str]:
    """Delete season-event caches older than the keep-year window (re-downloadable)."""
    cache_dir = Path(cache_dir)
    cutoff = current_season - keep  # delete years <= cutoff
    deleted = []
    pat = _re.compile(r"-(\d{4})\.json$")
    for f in list(cache_dir.glob("bat-events-*.json")) + list(cache_dir.glob("pit-events-*.json")):
        m = pat.search(f.name)
        if m and int(m.group(1)) <= cutoff:
            f.unlink(missing_ok=True)
            deleted.append(str(f))
    return deleted


def merge_day_into_caches(day_rows: list[dict], cache_dir=DEFAULT_DIR) -> int:
    """Append one day of league-wide slim Statcast rows into the existing
    per-player event caches. Idempotent: rows for that date are replaced.

    Players with NO cache file are skipped, never created - a partial cache
    would masquerade as a full season; they get a full pull on first
    appearance via the normal export path. ``day_rows`` must all share one
    ``game_date`` (the caller, update_events, pulls one day at a time).
    Returns files updated.
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
    ET date ``today``). Always re-pulls a trailing _REPULL_WINDOW-day window so
    any day grabbed before Baseball Savant settled self-heals on the next run.
    Walks any missed days; a gap beyond _MAX_GAP_DAYS deletes the event caches
    instead (players re-pull fully on demand - slow but automatic). Returns the
    list of dates ingested.
    """
    fetch_day = fetch_day or fetch.statcast_day
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    marker = cache_dir / _MARKER
    target = dt.date.fromisoformat(today) - dt.timedelta(days=1)
    gap_start = target  # no marker -> just the trailing window (below)
    if marker.exists():
        last = dt.date.fromisoformat(json.loads(marker.read_text())["date"])
        if last >= target:
            return []  # already folded today (once-per-day throttle)
        gap_start = last + dt.timedelta(days=1)
    # always re-pull the trailing window (overwrites/heals recent days),
    # and cover any larger gap too
    start = min(gap_start, target - dt.timedelta(days=_REPULL_WINDOW - 1))
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
    sweep_stale_season_caches(int(today[:4]), cache_dir=cache_dir)
    return ingested


def refresh_today(date_str: str, *, schedule_fn=None, profile_fns=None,
                  weather_fn=None, bvp_fn=None, starters_fn=None) -> bool:
    """Freeze-merge compute of today's board into export_web.DATA_DIR.

    Started games keep their rows from the existing date file untouched
    (frozen at the last pre-game compute); not-started games are recomputed
    fresh. Vanished never-started games drop. Writes the date file +
    latest.json + the rolling index ONLY when content (ignoring the
    ``updated`` stamp) actually changed; returns that changed flag, which
    drives the deploy-skip in CI. Games are remembered in ``started_ids``
    once started, so partial schedule responses can't un-freeze them; an
    empty schedule never wipes an existing record.
    """
    schedule_fn = schedule_fn or fetch.get_schedule
    data_dir = Path(export_web.DATA_DIR)
    slate = schedule_fn(date_str)

    path = data_dir / f"{date_str}.json"
    # a corrupt date file crashes loudly on purpose - silently overwriting
    # the day's frozen record would be worse than a failed (emailed) run
    existing = json.loads(path.read_text()) if path.exists() else {}

    if not slate and any(existing.get(k) for k in ("hr", "strikeouts", "hits", "total_bases", "games")):
        # an empty schedule response must never wipe today's record
        return False

    # remember every game that EVER started today, so one flaky/partial
    # schedule response can't drop a frozen game's rows permanently
    remembered = set(existing.get("started_ids", []))
    started_ids = {g["game_id"] for g in slate if g.get("started")} | remembered
    fresh_slate = [g for g in slate
                   if not g.get("started") and g["game_id"] not in remembered]

    frozen = {
        "hr": [r for r in existing.get("hr", []) if r.get("game_id") in started_ids],
        "strikeouts": [r for r in existing.get("strikeouts", []) if r.get("game_id") in started_ids],
        "hits": [r for r in existing.get("hits", []) if r.get("game_id") in started_ids],
        "total_bases": [r for r in existing.get("total_bases", []) if r.get("game_id") in started_ids],
        "runs": [r for r in existing.get("runs", []) if r.get("game_id") in started_ids],
        "rbi": [r for r in existing.get("rbi", []) if r.get("game_id") in started_ids],
        "hrr": [r for r in existing.get("hrr", []) if r.get("game_id") in started_ids],
        "games": [r for r in existing.get("games", []) if r.get("game_id") in started_ids],
    }

    hr, ks, hits, tb, runs, rbi, hrr, games = [], [], [], [], [], [], [], []
    boards = {"games": [], "pitchers": []}
    if fresh_slate:
        (starters_fn or export_web._ensure_starters)(fresh_slate)
        fns = profile_fns or export_web.make_profile_fns(fresh_slate, int(date_str[:4]), date_str)
        lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn = fns
        wfn = weather_fn or fetch.make_weather_fn()
        bfn = bvp_fn or export_web.make_bvp_fn()
        hr, ks, hits, tb, runs, rbi, hrr = export_web.build_board_with_history(
            fresh_slate, lineups_fn, pitcher_fn, lineups_hist_fn, pitcher_hist_fn, wfn, bfn)
        games = build_games(fresh_slate, wfn)
        # Per-player factor map for driver columns on the Boards page.
        factors_by_pid = {
            r["player_id"]: {
                "park_mult": r.get("park_mult"),
                "weather_mult": r.get("weather_mult"),
                "pitcher_mult": r.get("pitcher_mult"),
            }
            for r in hr if r.get("player_id")
        }
        # Barrel Boards payload (heatmaps + Oracle badges) — same as export_web.main
        # emits. The robot's board omitted this, so production had no Boards page.
        boards = export_web.build_boards_payload(fresh_slate, lineups_fn, pitcher_fn,
                                                 factors_by_pid=factors_by_pid)

    payload = {
        "date": date_str,
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(),
        "started_ids": sorted(started_ids),
        "hr": sorted(hr + frozen["hr"], key=lambda r: r["probability"], reverse=True),
        "strikeouts": sorted(ks + frozen["strikeouts"], key=lambda r: r["over_prob"], reverse=True),
        "hits": sorted(hits + frozen["hits"], key=lambda r: r["p_ge1"], reverse=True),
        "total_bases": sorted(tb + frozen["total_bases"], key=lambda r: r["p_ge2"], reverse=True),
        "runs": sorted(runs + frozen.get("runs", []), key=lambda r: r["p_ge1"], reverse=True),
        "rbi": sorted(rbi + frozen.get("rbi", []), key=lambda r: r["p_ge1"], reverse=True),
        "hrr": sorted(hrr + frozen.get("hrr", []), key=lambda r: r["p_ge2"], reverse=True),
        "games": sorted(games + frozen["games"], key=lambda g: g["env"], reverse=True),
        "boards": boards,
    }

    def _body(d: dict) -> str:
        return json.dumps({k: v for k, v in d.items() if k != "updated"}, sort_keys=True)

    if existing and _body(payload) == _body(existing):
        return False
    data_dir.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2)
    path.write_text(text)
    (data_dir / "latest.json").write_text(text)
    export_web._update_index(date_str)
    return True


def slate_signature(slate: list[dict], lineups_by_game: dict) -> str:
    """Structural fingerprint of today: pitchers, lineups, started flags.

    Weather is deliberately excluded - forecast drift alone doesn't merit a
    republish more often than should_skip's freshness window.
    """
    snap = sorted(
        [g["game_id"], g.get("home_pitcher_id"), g.get("away_pitcher_id"),
         bool(g.get("started")),
         list(lineups_by_game.get(g["game_id"], {}).get("home", [])),
         list(lineups_by_game.get(g["game_id"], {}).get("away", []))]
        for g in slate
    )
    return hashlib.md5(json.dumps(snap).encode()).hexdigest()


def should_skip(sig: str, *, cache_dir=DEFAULT_DIR, max_age_min: int = 90, now=None) -> bool:
    """True when nothing structural changed AND we verified recently.

    This is a pure optimization cache: any corruption or surprise in the
    saved file means "don't skip", never a crash.
    """
    path = Path(cache_dir) / _SIGNATURE
    if not path.exists():
        return False
    try:
        saved = json.loads(path.read_text())
        if saved.get("sig") != sig:
            return False
        published = dt.datetime.fromisoformat(saved["published_at"])
        now = now or dt.datetime.now(dt.timezone.utc)
        return (now - published) < dt.timedelta(minutes=max_age_min)
    except (json.JSONDecodeError, KeyError, ValueError, TypeError, OSError):
        return False


def record_run(sig: str, published: bool, *, cache_dir=DEFAULT_DIR, now=None) -> None:
    """Save the latest signature; the freshness timestamp advances on real
    publishes AND on computes that verified no change (caller passes published=True)."""
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_dir / _SIGNATURE
    now = now or dt.datetime.now(dt.timezone.utc)
    prev = None
    if path.exists():
        try:
            prev = json.loads(path.read_text()).get("published_at")
        except (json.JSONDecodeError, ValueError, OSError):
            prev = None
    published_at = now.isoformat() if (published or not prev) else prev
    path.write_text(json.dumps({"sig": sig, "published_at": published_at}))
