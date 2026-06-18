"""Wire data (via injected fetcher callables) into model projections.

Fetcher callables are passed in so this module never touches the network
and is fully unit-testable. cli.py / export_web.py supply the real fetchers.

Fetcher contracts:
  lineups_fn(game) -> {"home": [batter_profile, ...], "away": [batter_profile, ...]}
      batter_profile: {player_id, name, team, bats, season_hr, season_pa,
                       recent_form_mult, k_rate, hit_rate}
  pitcher_fn(pitcher_id) -> {player_id, name, team, throws, k_per_bf, expected_bf,
                             opponent_k_mult, k_line, hit_allowed_rate,
                             hr_allowed_rate, bf}
  weather_fn(game) -> {wind_speed_mph, wind_from_deg, temp_f, precip_pct}
"""

from math import sqrt

from model.parks import get_park, hr_park_factor
from model.weather import wind_out_to_cf, weather_hr_multiplier, wind_dir_rel_cf
from model.projections import (
    hr_probability, hr_rate_per_pa, expected_strikeouts, poisson_over_prob,
    lineup_expected_ks, expected_pa_for_slot, pitcher_hr_mult, bvp_hr_mult,
)
from model.matchup import matchup, hr_platoon_mult, bvp_k_mult, classify_lean
from model.counts import count_ge_prob
from model.blend import regress

_LG_1B, _LG_2B, _LG_3B = 0.138, 0.045, 0.005
_COMP_R = 200.0


def _history_adjusted(m: dict, bvp: dict | None) -> dict:
    """Nudge a matchup read's k_prob by career history vs this pitcher
    (capped ±10% in bvp_k_mult) and re-derive the lean to stay consistent."""
    if not bvp or not bvp.get("pa"):
        return m
    kp = min(0.7, m["k_prob"] * bvp_k_mult(bvp.get("k", 0), bvp["pa"]))
    return {**m, "k_prob": kp, **classify_lean(kp, m["hit_prob"])}


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


def build_hr_rows(slate: list[dict], lineups_fn, pitcher_fn, weather_fn, bvp_fn=None) -> list[dict]:
    """HR rows for all not-yet-started games, each with its opposing-pitcher matchup.

    bvp_fn(batter_id, pitcher_id) -> {"pa","ab","hits","hr","k","avg"} | None (career head-to-head; display + capped HR dial)
    """
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
                bvp = bvp_fn(b.get("player_id"), opp.get("player_id")) if (bvp_fn and opp) else None
                b_mult = bvp_hr_mult(bvp["hr"], bvp["pa"]) if bvp else 1.0
                prob = hr_probability(
                    season_hr=b["season_hr"], season_pa=b["season_pa"],
                    recent_form_mult=b.get("recent_form_mult", 1.0),
                    matchup_mult=platoon, pitcher_mult=p_mult, bvp_mult=b_mult,
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
                    m = _history_adjusted(m, bvp)
                    vs = {"name": opp["name"], "player_id": opp.get("player_id"), "throws": opp.get("throws", "R"), "bvp": bvp, "pitcher_status": opp.get("pitcher_status", "confirmed"), **m}
                rows.append({
                    "prop": "HR", "game_id": game["game_id"],
                    "game_time": game.get("game_time"),
                    "player_id": b.get("player_id"),
                    "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                    "player": b["name"], "team": team, "park": game["park_team"],
                    "probability": prob, "wind_out_mph": w["wind_out_mph"],
                    "weather_mult": weather_mult, "park_mult": eff_park,
                    "matchup_mult": platoon, "pitcher_mult": p_mult, "bvp_mult": b_mult,
                    "recent_form_mult": b.get("recent_form_mult", 1.0),
                    "wind_mph": w["wind_mph"], "wind_dir": w["wind_dir"],
                    "temp_f": w["temp_f"], "precip_pct": w["precip_pct"],
                    "bats": b.get("bats", "R"), "vs": vs,
                    "lineup_status": b.get("lineup_status", "confirmed"),
                })
    rows.sort(key=lambda r: r["probability"], reverse=True)
    return rows


def build_strikeout_rows(slate: list[dict], pitcher_fn, lineups_fn, weather_fn, bvp_fn=None) -> list[dict]:
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
                bvp = bvp_fn(b.get("player_id"), pid) if bvp_fn else None
                m = _history_adjusted(m, bvp)
                matchups.append({"name": b["name"], "player_id": b.get("player_id"), "bats": b.get("bats", "R"), "bvp": bvp, "lineup_status": b.get("lineup_status", "confirmed"), **m})
            lam = lineup_expected_ks([m["k_prob"] for m in matchups], p["expected_bf"])
            if lam is None:
                lam = expected_strikeouts(p["k_per_bf"], p["expected_bf"], p.get("opponent_k_mult", 1.0))
            line = p.get("k_line", 5.5)
            rows.append({
                "prop": "K", "game_id": game["game_id"],
                "game_time": game.get("game_time"),
                "player_id": p.get("player_id"),
                "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                "player": p["name"], "team": team,
                "expected_ks": lam, "line": line, "over_prob": poisson_over_prob(lam, line),
                "wind_out_mph": w["wind_out_mph"], "wind_mph": w["wind_mph"],
                "wind_dir": w["wind_dir"], "temp_f": w["temp_f"], "precip_pct": w["precip_pct"],
                "throws": p.get("throws", "R"), "matchups": matchups,
                "pitcher_status": p.get("pitcher_status", "confirmed"),
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
            "game_time": game.get("game_time"),
            "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
            "park": game["park_team"],
            "park_name": w["park"]["name"],
            "park_mult": park_mult,
            "weather_mult": weather_mult,
            "env": round(park_mult * weather_mult, 3),
            "wind_out_mph": w["wind_out_mph"],
            "wind_mph": w["wind_mph"],
            "wind_dir": w["wind_dir"],
            "temp_f": w["temp_f"],
            "precip_pct": w["precip_pct"],
            "home_lineup_status": game.get("home_lineup_status", "confirmed"),
            "away_lineup_status": game.get("away_lineup_status", "confirmed"),
        })
    out.sort(key=lambda g: g["env"], reverse=True)
    return out


def _batter_outcome_vector(b, opp, eff_park, weather_mult, slot, bvp):
    """Per-PA [p0,p1,p2,p3,p4] (0..4 bases). HR reuses the adjusted HR rate;
    1B/2B/3B are regressed + matchup/platoon/recent-form (park/weather HR-only, v1)."""
    pa = b.get("season_pa", 0)
    # matchup hit factor (platoon/log5) applied to non-HR hit components
    if opp:
        m = matchup(b_k=b.get("k_rate", 0.22), b_hit=b.get("hit_rate", 0.22),
                    p_k=opp.get("k_per_bf", 0.22), p_hit=opp.get("hit_allowed_rate", 0.22),
                    bats=b.get("bats", "R"), throws=opp.get("throws", "R"))
        hit_factor = (m["hit_prob"] / b["hit_rate"]) if b.get("hit_rate") else 1.0
        platoon = hr_platoon_mult(b.get("bats", "R"), opp.get("throws", "R"))
        p_mult = pitcher_hr_mult(opp.get("hr_allowed_rate", 0.033), opp.get("bf", 0))
        b_mult = bvp_hr_mult(bvp["hr"], bvp["pa"]) if bvp else 1.0
    else:
        hit_factor = platoon = p_mult = b_mult = 1.0
    form = b.get("recent_form_mult", 1.0)
    p1 = regress(b.get("season_1b", 0), pa, _LG_1B, _COMP_R) * hit_factor * form
    p2 = regress(b.get("season_2b", 0), pa, _LG_2B, _COMP_R) * hit_factor * form
    p3 = regress(b.get("season_3b", 0), pa, _LG_3B, _COMP_R) * hit_factor * form
    p4 = hr_rate_per_pa(b.get("season_hr", 0), pa, recent_form_mult=form, matchup_mult=platoon,
                        park_mult=eff_park, weather_mult=weather_mult, pitcher_mult=p_mult, bvp_mult=b_mult)
    p1, p2, p3, p4 = (max(0.0, x) for x in (p1, p2, p3, p4))
    total = p1 + p2 + p3 + p4
    if total > 1.0:  # keep a valid distribution
        p1, p2, p3, p4 = (x / total for x in (p1, p2, p3, p4))
        total = 1.0
    return [1 - total, p1, p2, p3, p4]


def _threshold_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn, *, prop, thresholds, units):
    rows = []
    for game in slate:
        if game.get("started"):
            continue
        w = _game_weather(game, weather_fn)
        weather_mult = weather_hr_multiplier(w["wind_out_mph"], w["temp_f"], w["park"]["dome"])
        park_mult = hr_park_factor(game["park_team"])
        lineups = lineups_fn(game)
        home_p = pitcher_fn(game["home_pitcher_id"]) if game.get("home_pitcher_id") else None
        away_p = pitcher_fn(game["away_pitcher_id"]) if game.get("away_pitcher_id") else None
        for side, opp in (("home", away_p), ("away", home_p)):
            team = game.get(side, "?")
            eff_park = park_mult / sqrt(hr_park_factor(team))
            for slot, b in enumerate(lineups.get(side, [])):
                bvp = bvp_fn(b.get("player_id"), opp.get("player_id")) if (bvp_fn and opp) else None
                vec = _batter_outcome_vector(b, opp, eff_park, weather_mult, slot, bvp)
                outcomes = [vec[0], vec[1] + vec[2] + vec[3] + vec[4]] if units == "hits" else vec
                epa = expected_pa_for_slot(slot)
                row = {
                    "prop": prop, "game_id": game["game_id"], "game_time": game.get("game_time"),
                    "player_id": b.get("player_id"), "player": b["name"], "team": team,
                    "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                    "bats": b.get("bats", "R"),
                    "vs": {"name": opp["name"], "player_id": opp.get("player_id"), "throws": opp.get("throws", "R")} if opp else None,
                    "wind_out_mph": w["wind_out_mph"], "wind_mph": w["wind_mph"], "wind_dir": w["wind_dir"],
                    "temp_f": w["temp_f"], "precip_pct": w["precip_pct"],
                }
                for label, nthresh in thresholds:
                    row[label] = count_ge_prob(outcomes, epa, nthresh)
                rows.append(row)
    rows.sort(key=lambda r: r[thresholds[0][0]], reverse=True)
    return rows


def build_hits_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None):
    return _threshold_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn,
                           prop="HITS", thresholds=[("p_ge1", 1), ("p_ge2", 2), ("p_ge3", 3)], units="hits")


def build_total_bases_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None):
    return _threshold_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn,
                           prop="TB", thresholds=[("p_ge2", 2), ("p_ge3", 3), ("p_ge4", 4)], units="bases")
