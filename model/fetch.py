"""Network I/O: schedule/lineups (MLB Stats API), Statcast stats
(pybaseball), and weather (Open-Meteo). Isolated from model math so the
pure modules stay testable offline.
"""

import datetime as dt
import statsapi
import requests
import pandas as pd
from pybaseball import statcast_batter, statcast_pitcher

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
            "hourly": "temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability",
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
    precip = h.get("precipitation_probability") or []
    return {
        "temp_f": h["temperature_2m"][idx],
        "wind_speed_mph": h["wind_speed_10m"][idx],
        "wind_from_deg": h["wind_direction_10m"][idx],
        "precip_pct": precip[idx] if idx < len(precip) and precip[idx] is not None else 0,
    }


def _date_window(season: int) -> tuple[str, str]:
    return f"{season}-03-01", f"{season}-11-01"


def build_batter_profile(player_id: int, season: int, name: str = "", team: str = "",
                         bats: str = "") -> dict:
    """Season HR/PA + a recent-form multiplier from Statcast batted-ball data.

    recent_form_mult compares last-15-days hard-hit rate to the season hard-hit
    rate, scaled gently and clamped to [0.8, 1.25].
    """
    start, end = _date_window(season)
    df = statcast_batter(start, end, player_id)
    bip = df[df["launch_speed"].notna()]
    season_hard = (bip["launch_speed"] >= 95).mean() if len(bip) else 0.0
    pa = int((df["events"].notna()).sum())
    hr = int((df["events"] == "home_run").sum())
    ks = int(df["events"].isin(["strikeout", "strikeout_double_play"]).sum())
    hits = int(df["events"].isin(["single", "double", "triple", "home_run"]).sum())
    k_rate = (ks / pa) if pa else 0.0
    hit_rate = (hits / pa) if pa else 0.0

    cutoff = pd.to_datetime(df["game_date"]).max() - pd.Timedelta(days=15)
    recent = bip[pd.to_datetime(bip["game_date"]) >= cutoff]
    recent_hard = (recent["launch_speed"] >= 95).mean() if len(recent) else season_hard
    recent_form_mult = 1.0 + (recent_hard - season_hard) * 1.5
    recent_form_mult = max(0.8, min(1.25, recent_form_mult))

    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "bats": bats,
        "season_hr": hr,
        "season_pa": pa,
        "expected_pa": 4.0,
        "recent_form_mult": recent_form_mult,
        "matchup_mult": 1.0,
        "k_rate": k_rate,
        "hit_rate": hit_rate,
    }


def build_pitcher_profile(player_id: int, season: int, name: str = "", team: str = "",
                          throws: str = "", k_line: float = 5.5) -> dict:
    """Per-batter K rate and an expected batters-faced estimate from Statcast."""
    start, end = _date_window(season)
    df = statcast_pitcher(start, end, player_id)
    pa = int((df["events"].notna()).sum())
    ks = int(df["events"].isin(["strikeout", "strikeout_double_play"]).sum())
    k_per_bf = (ks / pa) if pa else 0.0
    hits_allowed = int(df["events"].isin(["single", "double", "triple", "home_run"]).sum())
    hit_allowed_rate = (hits_allowed / pa) if pa else 0.0

    games = df["game_pk"].nunique() if "game_pk" in df else 0
    expected_bf = (pa / games) if games else 24.0

    return {
        "player_id": player_id,
        "name": name or str(player_id),
        "team": team,
        "throws": throws,
        "k_per_bf": k_per_bf,
        "expected_bf": expected_bf,
        "opponent_k_mult": 1.0,
        "k_line": k_line,
        "hit_allowed_rate": hit_allowed_rate,
    }


def get_lineup_batter_ids(game_id: int) -> list[int]:
    """Confirmed batting-order player ids for both teams from the boxscore.

    Falls back to an empty list if lineups aren't posted yet.
    """
    try:
        box = statsapi.boxscore_data(game_id)
    except Exception:
        return []
    ids: list[int] = []
    for side in ("home", "away"):
        order = box.get(side, {}).get("battingOrder", []) or []
        ids.extend(int(pid) for pid in order)
    return ids


def get_player_names(player_ids: list[int]) -> dict[int, str]:
    """Map MLBAM player ids to 'First Last' names via the MLB Stats API.

    Unknown ids are omitted from the returned dict. One batched request.
    """
    ids = [pid for pid in player_ids if pid]
    if not ids:
        return {}
    data = statsapi.get("people", {"personIds": ",".join(str(i) for i in ids)})
    out: dict[int, str] = {}
    for person in data.get("people", []):
        out[int(person["id"])] = person.get("fullName", str(person["id"]))
    return out


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
