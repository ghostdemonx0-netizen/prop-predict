"""Network I/O: schedule/lineups (MLB Stats API), Statcast stats
(pybaseball), and weather (Open-Meteo). Isolated from model math so the
pure modules stay testable offline.
"""

import datetime as dt
import statsapi
import requests

# MLB Stats API team-id -> our park abbreviation
_TEAM_ABBR = {
    109: "ARI", 144: "ATL", 110: "BAL", 111: "BOS", 112: "CHC", 145: "CWS",
    113: "CIN", 114: "CLE", 115: "COL", 116: "DET", 117: "HOU", 118: "KC",
    108: "LAA", 119: "LAD", 146: "MIA", 158: "MIL", 142: "MIN", 121: "NYM",
    147: "NYY", 133: "OAK", 143: "PHI", 134: "PIT", 135: "SD", 137: "SF",
    136: "SEA", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 120: "WSH",
}


def _abbr(team_id: int) -> str:
    return _TEAM_ABBR.get(team_id, "ZZZ")


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
    resp = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,wind_speed_10m,wind_direction_10m",
            "temperature_unit": "fahrenheit",
            "wind_speed_unit": "mph",
            "start_date": date,
            "end_date": date,
            "timezone": "UTC",
        },
        timeout=20,
    )
    resp.raise_for_status()
    h = resp.json()["hourly"]
    times = [dt.datetime.fromisoformat(t + "+00:00") for t in h["time"]]
    idx = min(range(len(times)), key=lambda i: abs((times[i] - target).total_seconds()))
    return {
        "temp_f": h["temperature_2m"][idx],
        "wind_speed_mph": h["wind_speed_10m"][idx],
        "wind_from_deg": h["wind_direction_10m"][idx],
    }
