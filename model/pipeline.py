"""Wire data (via injected fetcher callables) into model projections.

Fetcher callables are passed in so this module never touches the network
and is fully unit-testable. cli.py / export_web.py supply the real fetchers.

Fetcher contracts:
  lineups_fn(game) -> {"home": [batter_profile, ...], "away": [batter_profile, ...]}
      batter_profile: {player_id, name, team, bats, season_hr, season_pa,
                       expected_pa, recent_form_mult, matchup_mult, k_rate, hit_rate}
  pitcher_fn(pitcher_id) -> {player_id, name, team, throws, k_per_bf, expected_bf,
                             opponent_k_mult, k_line, hit_allowed_rate}
  weather_fn(game) -> {wind_speed_mph, wind_from_deg, temp_f, precip_pct}
"""

from math import sqrt

from model.parks import get_park, hr_park_factor
from model.weather import wind_out_to_cf, weather_hr_multiplier, wind_dir_rel_cf
from model.projections import (
    hr_probability, expected_strikeouts, poisson_over_prob,
    lineup_expected_ks, expected_pa_for_slot, pitcher_hr_mult,
)
from model.matchup import matchup, hr_platoon_mult


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


def build_hr_rows(slate: list[dict], lineups_fn, pitcher_fn, weather_fn) -> list[dict]:
    """HR rows for all not-yet-started games, each with its opposing-pitcher matchup."""
    rows: list[dict] = []
    for game in slate:
        if game.get("started"):
            continue
        w = _game_weather(game, weather_fn)
        weather_mult = weather_hr_multiplier(w["wind_out_mph"], w["temp_f"], w["park"]["dome"])
        park_mult = hr_park_factor(game["park_team"])
        lineups = lineups_fn(game)
        home_p = pitcher_fn(game["home_pitcher_id"]) if game.get("home_pitcher_id") else None
        away_p = pitcher_fn(game["away_pitcher_id"]) if game.get("away_pitcher_id") else None
        # home batters face the away starter; away batters face the home starter
        for side, opp in (("home", away_p), ("away", home_p)):
            team = game.get(side, "?")
            # the game park factor, with the half already baked into the
            # batter's own season rate (his home park) divided back out
            eff_park = park_mult / sqrt(hr_park_factor(team))
            for slot, b in enumerate(lineups.get(side, [])):
                platoon = hr_platoon_mult(b.get("bats", "R"), opp.get("throws", "R")) if opp else 1.0
                p_mult = pitcher_hr_mult(opp.get("hr_allowed_rate", 0.033), opp.get("bf", 0)) if opp else 1.0
                prob = hr_probability(
                    season_hr=b["season_hr"], season_pa=b["season_pa"],
                    recent_form_mult=b.get("recent_form_mult", 1.0),
                    matchup_mult=platoon, pitcher_mult=p_mult,
                    park_mult=eff_park, weather_mult=weather_mult,
                    expected_pa=expected_pa_for_slot(slot),
                )
                vs = None
                if opp:
                    m = matchup(
                        b_k=b.get("k_rate", 0.22), b_hit=b.get("hit_rate", 0.22),
                        p_k=opp.get("k_per_bf", 0.22), p_hit=opp.get("hit_allowed_rate", 0.22),
                        bats=b.get("bats", "R"), throws=opp.get("throws", "R"),
                    )
                    vs = {"name": opp["name"], "throws": opp.get("throws", "R"), **m}
                rows.append({
                    "prop": "HR", "game_id": game["game_id"],
                    "player_id": b.get("player_id"),
                    "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                    "player": b["name"], "team": team, "park": game["park_team"],
                    "probability": prob, "wind_out_mph": w["wind_out_mph"],
                    "weather_mult": weather_mult, "park_mult": eff_park,
                    "matchup_mult": platoon, "pitcher_mult": p_mult,
                    "recent_form_mult": b.get("recent_form_mult", 1.0),
                    "wind_mph": w["wind_mph"], "wind_dir": w["wind_dir"],
                    "temp_f": w["temp_f"], "precip_pct": w["precip_pct"],
                    "bats": b.get("bats", "R"), "vs": vs,
                })
    rows.sort(key=lambda r: r["probability"], reverse=True)
    return rows


def build_strikeout_rows(slate: list[dict], pitcher_fn, lineups_fn, weather_fn) -> list[dict]:
    """Strikeout rows for both starters, each with the opposing lineup matchup read."""
    rows: list[dict] = []
    for game in slate:
        if game.get("started"):
            continue
        w = _game_weather(game, weather_fn)
        lineups = lineups_fn(game)
        # home pitcher faces away lineup; away pitcher faces home lineup
        for pid_key, opp_side, team in (
            ("home_pitcher_id", "away", game.get("home", "?")),
            ("away_pitcher_id", "home", game.get("away", "?")),
        ):
            pid = game.get(pid_key)
            if pid is None:
                continue
            p = pitcher_fn(pid)
            matchups = []
            for b in lineups.get(opp_side, []):
                m = matchup(
                    b_k=b.get("k_rate", 0.22), b_hit=b.get("hit_rate", 0.22),
                    p_k=p.get("k_per_bf", 0.22), p_hit=p.get("hit_allowed_rate", 0.22),
                    bats=b.get("bats", "R"), throws=p.get("throws", "R"),
                )
                matchups.append({"name": b["name"], "bats": b.get("bats", "R"), **m})
            lam = lineup_expected_ks([m["k_prob"] for m in matchups], p["expected_bf"])
            if lam is None:
                lam = expected_strikeouts(p["k_per_bf"], p["expected_bf"], p.get("opponent_k_mult", 1.0))
            line = p.get("k_line", 5.5)
            rows.append({
                "prop": "K", "game_id": game["game_id"],
                "player_id": p.get("player_id"),
                "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                "player": p["name"], "team": team,
                "expected_ks": lam, "line": line, "over_prob": poisson_over_prob(lam, line),
                "wind_out_mph": w["wind_out_mph"], "wind_mph": w["wind_mph"],
                "wind_dir": w["wind_dir"], "temp_f": w["temp_f"], "precip_pct": w["precip_pct"],
                "throws": p.get("throws", "R"), "matchups": matchups,
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
