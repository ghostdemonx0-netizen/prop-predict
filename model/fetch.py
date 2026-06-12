"""Network I/O: schedule/lineups (MLB Stats API), Statcast stats
(pybaseball), and weather (Open-Meteo). Isolated from model math so the
pure modules stay testable offline.
"""

import datetime as dt
import json
import time
from pathlib import Path
import statsapi
import requests
import pandas as pd
from pybaseball import statcast, statcast_batter, statcast_pitcher

# MLB Stats API team-id -> our park abbreviation
_TEAM_ABBR = {
    109: "ARI", 144: "ATL", 110: "BAL", 111: "BOS", 112: "CHC", 145: "CWS",
    113: "CIN", 114: "CLE", 115: "COL", 116: "DET", 117: "HOU", 118: "KC",
    108: "LAA", 119: "LAD", 146: "MIA", 158: "MIL", 142: "MIN", 121: "NYM",
    147: "NYY", 133: "OAK", 143: "PHI", 134: "PIT", 135: "SD", 137: "SF",
    136: "SEA", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 120: "WSH",
}

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


_NEUTRAL_WX = {"wind_speed_mph": 0.0, "wind_from_deg": 0.0, "temp_f": 70.0, "precip_pct": 0}


def make_weather_fn(cache_dir=None):
    """Per-run memoized game-weather fetcher (one Open-Meteo call per game,
    shared by the HR, K, and games builders).

    Resilient: each success is written through to .cache/wx-<game_id>.json;
    when Open-Meteo times out even after retries (it throttles shared CI
    runners), the last known forecast for that game is reused - a slightly
    stale forecast beats neutral, and neutral beats crashing the whole run.
    """
    from model.cache import DEFAULT_DIR
    cache_dir = Path(cache_dir or DEFAULT_DIR)
    seen: dict[int, dict] = {}

    def weather_fn(game: dict) -> dict:
        gid = game["game_id"]
        if gid in seen:
            return seen[gid]
        fallback = cache_dir / f"wx-{gid}.json"
        if not game.get("game_time"):
            # game time not posted yet -> neutral weather rather than crashing
            seen[gid] = dict(_NEUTRAL_WX)
            return seen[gid]
        lat, lon = PARK_COORDS.get(game["park_team"], (39.0, -98.0))
        try:
            wx = get_weather(lat, lon, game["game_time"])
            try:
                cache_dir.mkdir(parents=True, exist_ok=True)
                fallback.write_text(json.dumps(wx))
            except OSError:
                pass  # fallback cache is best-effort
        except Exception:
            if fallback.exists():
                wx = json.loads(fallback.read_text())
                print(f"weather: using last known forecast for game {gid}")
            else:
                wx = dict(_NEUTRAL_WX)
                print(f"weather: unavailable for game {gid} - neutral assumed")
        seen[gid] = wx
        return seen[gid]

    return weather_fn


def _abbr(team_id: int) -> str:
    return _TEAM_ABBR.get(team_id, "ZZZ")


def _with_retries(producer, attempts: int = 3, base_delay: float = 2.0):
    """Run producer(), retrying transient failures with exponential backoff.

    Statcast/Open-Meteo flake under load (observed 2026-06-11/12: read
    timeouts, garbled CSVs, rate-limit handshake failures); a couple of
    spaced retries clears virtually all of it.
    """
    last = None
    for attempt in range(attempts):
        try:
            return producer()
        except Exception as e:  # network errors come in many shapes (requests, urllib3, pandas)
            last = e
            if attempt < attempts - 1:
                time.sleep(base_delay * (2 ** attempt))
    raise last


def get_schedule(date_str: str) -> list[dict]:
    """Return the day's games as normalized dicts.

    date_str: 'YYYY-MM-DD'. Uses MLB Stats API via the statsapi wrapper.
    """
    games = statsapi.schedule(date=date_str)
    out: list[dict] = []
    for g in games:
        status = (g.get("status") or "").lower()
        started = status not in ("scheduled", "pre-game", "warmup", "")
        out.append({
            "game_id": g["game_id"],
            "home": _abbr(g["home_id"]),
            "away": _abbr(g["away_id"]),
            "park_team": _abbr(g["home_id"]),
            "game_time": g.get("game_datetime"),
            "started": started,
            "home_pitcher_id": g.get("home_probable_pitcher_id"),
            "away_pitcher_id": g.get("away_probable_pitcher_id"),
        })
    return out


def get_weather(lat: float, lon: float, when_iso: str) -> dict:
    """Hourly forecast nearest the game time from Open-Meteo (no key)."""
    target = dt.datetime.fromisoformat(when_iso.replace("Z", "+00:00"))
    date = target.date().isoformat()

    def _pull():
        resp = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "hourly": "temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability",
                "temperature_unit": "fahrenheit",
                "wind_speed_unit": "mph",
                "start_date": date,
                "end_date": date,
                "timezone": "UTC",
            },
            timeout=30,
        )
        resp.raise_for_status()
        h = resp.json()["hourly"]
        times = [dt.datetime.fromisoformat(t + "+00:00") for t in h["time"]]
        idx = min(range(len(times)), key=lambda i: abs((times[i] - target).total_seconds()))
        precip = h.get("precipitation_probability") or []
        return {
            "temp_f": h["temperature_2m"][idx],
            "wind_speed_mph": h["wind_speed_10m"][idx],
            "wind_from_deg": h["wind_direction_10m"][idx],
            "precip_pct": precip[idx] if idx < len(precip) and precip[idx] is not None else 0,
        }

    return _with_retries(_pull)


def _date_window(season: int) -> tuple[str, str]:
    return f"{season}-03-01", f"{season}-11-01"


_BATTER_EVENT_COLS = ["game_date", "events", "launch_speed"]
_PITCHER_EVENT_COLS = ["game_date", "events", "game_pk"]
_DAY_EVENT_COLS = ["batter", "pitcher", "game_date", "events", "launch_speed", "game_pk"]


def _slim_records(df: pd.DataFrame, cols: list[str]) -> list[dict]:
    """Reduce a Statcast frame to JSON-safe dicts with only the columns the
    profile math needs (cache-friendly: ~100x smaller than the raw pull)."""
    if df is None or len(df) == 0:
        return []
    d = df[cols].copy()
    d["game_date"] = pd.to_datetime(d["game_date"]).dt.strftime("%Y-%m-%d")
    d = d.astype(object).where(pd.notna(d), None)
    return d.to_dict("records")


def batter_events(player_id: int, season: int) -> list[dict]:
    """One batter-season of slim Statcast rows: game_date, events, launch_speed."""
    start, end = _date_window(season)
    return _slim_records(_with_retries(lambda: statcast_batter(start, end, player_id)), _BATTER_EVENT_COLS)


def pitcher_events(player_id: int, season: int) -> list[dict]:
    """One pitcher-season of slim Statcast rows: game_date, events, game_pk."""
    start, end = _date_window(season)
    return _slim_records(_with_retries(lambda: statcast_pitcher(start, end, player_id)), _PITCHER_EVENT_COLS)


def statcast_day(date_str: str) -> list[dict]:
    """One calendar day of league-wide Statcast rows, slim columns only.

    The morning job appends this to the per-player event caches - one pull
    instead of ~500 per-player pulls.
    """
    df = _with_retries(lambda: statcast(start_dt=date_str, end_dt=date_str))
    return _slim_records(df, _DAY_EVENT_COLS)


def get_lineups(game_id: int) -> dict[str, list[int]]:
    """Batting-order MLBAM ids split by side: {"home": [...], "away": [...]}.

    Empty lists if lineups are not posted yet.
    """
    try:
        box = statsapi.boxscore_data(game_id)
    except Exception:
        return {"home": [], "away": []}
    out: dict[str, list[int]] = {"home": [], "away": []}
    for side in ("home", "away"):
        order = box.get(side, {}).get("battingOrder", []) or []
        out[side] = [int(pid) for pid in order]
    return out


def get_player_meta(player_ids: list[int]) -> dict[int, dict]:
    """Map MLBAM ids to {"name", "bats", "throws"} via the MLB Stats API.

    bats/throws are single letters L/R/S (S = switch). Unknown ids omitted.
    """
    ids = [pid for pid in player_ids if pid]
    if not ids:
        return {}
    try:
        data = statsapi.get("people", {"personIds": ",".join(str(i) for i in ids)})
    except Exception:
        return {}
    out: dict[int, dict] = {}
    for person in data.get("people", []):
        out[int(person["id"])] = {
            "name": person.get("fullName", str(person["id"])),
            "bats": (person.get("batSide") or {}).get("code", "R"),
            "throws": (person.get("pitchHand") or {}).get("code", "R"),
        }
    return out


def get_bvp(batter_id: int, pitcher_id: int) -> dict | None:
    """Career batter-vs-pitcher line from the MLB Stats API.

    Display context only — deliberately NOT used in the probability math
    (head-to-head samples are tiny). Returns None when either id is missing,
    there is no history, or the API call fails.
    """
    if not batter_id or not pitcher_id:
        return None
    try:
        data = _with_retries(lambda: statsapi.get("people", {
            "personIds": str(batter_id),
            "hydrate": f"stats(group=[hitting],type=[vsPlayerTotal],opposingPlayerId={pitcher_id},sportId=1)",
        }))
        splits = data["people"][0].get("stats", [{}])[0].get("splits", [])
        if not splits:
            return None
        st = splits[0].get("stat", {})
        return {
            "pa": st.get("plateAppearances", 0),
            "ab": st.get("atBats", 0),
            "hits": st.get("hits", 0),
            "hr": st.get("homeRuns", 0),
            "k": st.get("strikeOuts", 0),
            "avg": st.get("avg", ""),
        }
    except Exception:
        return None


def get_starters(game_id: int) -> dict[str, int | None]:
    """Actual starting pitcher MLBAM ids from a game's boxscore: {"home", "away"}.

    The boxscore's per-side `pitchers` list is in appearance order, so [0] is
    the starter. Returns None for a side if unavailable. Use this for finished
    games, whose schedule "probable pitcher" fields are blank.
    """
    try:
        box = statsapi.boxscore_data(game_id)
    except Exception:
        return {"home": None, "away": None}
    out: dict[str, int | None] = {"home": None, "away": None}
    for side in ("home", "away"):
        pitchers = box.get(side, {}).get("pitchers", []) or []
        out[side] = int(pitchers[0]) if pitchers else None
    return out
