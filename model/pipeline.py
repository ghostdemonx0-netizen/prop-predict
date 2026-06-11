"""Wire data (via injected fetcher callables) into model projections.

Fetcher callables are passed in so this module never touches the network
and is fully unit-testable. cli.py supplies the real fetchers.

Fetcher contracts:
  batters_fn(game_id) -> list of batter dicts:
      {player_id, name, team, bats, season_hr, season_pa, expected_pa,
       recent_form_mult, matchup_mult}
  pitcher_fn(pitcher_id) -> pitcher dict:
      {player_id, name, team, throws, k_per_bf, expected_bf,
       opponent_k_mult, k_line}
  weather_fn(game) -> {wind_speed_mph, wind_from_deg, temp_f, precip_pct}
"""

from model.parks import get_park, hr_park_factor
from model.weather import wind_out_to_cf, weather_hr_multiplier, wind_dir_rel_cf
from model.projections import hr_probability, expected_strikeouts, poisson_over_prob


def _game_weather(game: dict, weather_fn) -> dict:
    """Resolve a game's weather into display-ready fields shared by HR and K rows."""
    park = get_park(game["park_team"])
    wx = weather_fn(game)
    wind_out = wind_out_to_cf(wx["wind_speed_mph"], wx["wind_from_deg"], park["cf_bearing_deg"])
    return {
        "park": park,
        "wx": wx,
        "wind_out_mph": wind_out,
        "wind_mph": wx["wind_speed_mph"],
        "wind_dir": wind_dir_rel_cf(wx["wind_from_deg"], park["cf_bearing_deg"]),
        "temp_f": wx["temp_f"],
        "precip_pct": wx.get("precip_pct", 0),
    }


def build_hr_rows(slate: list[dict], batters_fn, weather_fn) -> list[dict]:
    """Return HR projection rows for all not-yet-started games, sorted desc."""
    rows: list[dict] = []
    for game in slate:
        if game.get("started"):
            continue
        w = _game_weather(game, weather_fn)
        wind_out = w["wind_out_mph"]
        weather_mult = weather_hr_multiplier(wind_out, w["temp_f"], w["park"]["dome"])
        park_mult = hr_park_factor(game["park_team"])
        for b in batters_fn(game["game_id"]):
            prob = hr_probability(
                season_hr=b["season_hr"],
                season_pa=b["season_pa"],
                recent_form_mult=b.get("recent_form_mult", 1.0),
                matchup_mult=b.get("matchup_mult", 1.0),
                park_mult=park_mult,
                weather_mult=weather_mult,
                expected_pa=b.get("expected_pa", 4.0),
            )
            rows.append({
                "prop": "HR",
                "game_id": game["game_id"],
                "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                "player": b["name"],
                "team": b["team"],
                "park": game["park_team"],
                "probability": prob,
                "wind_out_mph": wind_out,
                "weather_mult": weather_mult,
                "park_mult": park_mult,
                "recent_form_mult": b.get("recent_form_mult", 1.0),
                "wind_mph": w["wind_mph"],
                "wind_dir": w["wind_dir"],
                "temp_f": w["temp_f"],
                "precip_pct": w["precip_pct"],
            })
    rows.sort(key=lambda r: r["probability"], reverse=True)
    return rows


def build_strikeout_rows(slate: list[dict], pitcher_fn, weather_fn) -> list[dict]:
    """Return strikeout projection rows for both starters of each game, sorted desc.

    Weather (wind/temp/rain) is attached for display parity with HR rows even
    though it has little effect on the strikeout projection itself.
    """
    rows: list[dict] = []
    for game in slate:
        if game.get("started"):
            continue
        w = _game_weather(game, weather_fn)
        for key in ("home_pitcher_id", "away_pitcher_id"):
            pid = game.get(key)
            if pid is None:
                continue
            p = pitcher_fn(pid)
            lam = expected_strikeouts(
                p["k_per_bf"], p["expected_bf"], p.get("opponent_k_mult", 1.0)
            )
            line = p.get("k_line", 5.5)
            rows.append({
                "prop": "K",
                "game_id": game["game_id"],
                "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                "player": p["name"],
                "team": p["team"],
                "expected_ks": lam,
                "line": line,
                "over_prob": poisson_over_prob(lam, line),
                "wind_out_mph": w["wind_out_mph"],
                "wind_mph": w["wind_mph"],
                "wind_dir": w["wind_dir"],
                "temp_f": w["temp_f"],
                "precip_pct": w["precip_pct"],
            })
    rows.sort(key=lambda r: r["over_prob"], reverse=True)
    return rows


def build_games(slate: list[dict], weather_fn) -> list[dict]:
    """Per-game hitting environment (park x weather), sorted most-favorable first."""
    out: list[dict] = []
    for game in slate:
        if game.get("started"):
            continue
        w = _game_weather(game, weather_fn)
        park_mult = hr_park_factor(game["park_team"])
        weather_mult = weather_hr_multiplier(w["wind_out_mph"], w["temp_f"], w["park"]["dome"])
        out.append({
            "game_id": game["game_id"],
            "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
            "park": game["park_team"],
            "park_mult": park_mult,
            "weather_mult": weather_mult,
            "env": round(park_mult * weather_mult, 3),
            "wind_out_mph": w["wind_out_mph"],
            "wind_mph": w["wind_mph"],
            "wind_dir": w["wind_dir"],
            "temp_f": w["temp_f"],
            "precip_pct": w["precip_pct"],
        })
    out.sort(key=lambda g: g["env"], reverse=True)
    return out
