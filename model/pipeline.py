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

from model.parks import get_park, hr_park_factor, hit_park_factor
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
_XBH_WEATHER_DAMPEN = 0.5  # weather-only dampen for fly-ball XBH (doubles/triples); real per-park factors are applied separately (tunable v1)


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


def _batter_outcome_vector(b, opp, eff_park, weather_mult, slot, bvp, *, apply_xbh_park: bool = False, park_1b: float = 1.0, park_2b: float = 1.0, park_3b: float = 1.0):
    """Per-PA [p0,p1,p2,p3,p4] (0..4 bases). HR reuses the adjusted HR rate;
    1B/2B/3B are regressed + matchup/platoon/recent-form.

    apply_xbh_park=True (TB rows only): doubles/triples receive a dampened weather
    multiplier (wx) plus per-component park factors (park_1b/2b/3b).
    apply_xbh_park=False (Hits path): all park factors forced to 1.0 and wx=1.0 —
    output is byte-for-byte park-neutral for 1B/2B/3B.

    Returns (actual_vec, neutral_vec) where neutral_vec uses league-average pitcher
    and no platoon/bvp so only park/weather/form remain (matchup adjustments cancel
    in the pitcher_factor ratio).
    """
    pa = b.get("season_pa", 0)
    # matchup hit factor (platoon/log5) applied to non-HR hit components
    if opp:
        m = matchup(b_k=b.get("k_rate", 0.22), b_hit=b.get("hit_rate", 0.22),
                    p_k=opp.get("k_per_bf", 0.22), p_hit=opp.get("hit_allowed_rate", 0.22),
                    bats=b.get("bats", "R"), throws=opp.get("throws", "R"))
        hit_factor = min(m["hit_prob"] / b["hit_rate"], 2.0) if b.get("hit_rate") else 1.0
        platoon = hr_platoon_mult(b.get("bats", "R"), opp.get("throws", "R"))
        p_mult = pitcher_hr_mult(opp.get("hr_allowed_rate", 0.033), opp.get("bf", 0))
        b_mult = bvp_hr_mult(bvp["hr"], bvp["pa"]) if bvp else 1.0
    else:
        hit_factor = platoon = p_mult = b_mult = 1.0
    form = b.get("recent_form_mult", 1.0)

    # Per-component park factors + dampened weather for TB rows.
    # When apply_xbh_park is False (Hits path), all factors stay 1.0 → park-neutral.
    if apply_xbh_park:
        wx = 1.0 + _XBH_WEATHER_DAMPEN * (weather_mult - 1.0)
    else:
        wx = 1.0
        park_1b = park_2b = park_3b = 1.0

    p1 = regress(b.get("season_1b", 0), pa, _LG_1B, _COMP_R) * hit_factor * form * park_1b
    p2 = regress(b.get("season_2b", 0), pa, _LG_2B, _COMP_R) * hit_factor * form * park_2b * wx
    p3 = regress(b.get("season_3b", 0), pa, _LG_3B, _COMP_R) * hit_factor * form * park_3b * wx
    p4 = hr_rate_per_pa(b.get("season_hr", 0), pa, recent_form_mult=form, matchup_mult=platoon,
                        park_mult=eff_park, weather_mult=weather_mult, pitcher_mult=p_mult, bvp_mult=b_mult)
    p1, p2, p3, p4 = (max(0.0, x) for x in (p1, p2, p3, p4))
    total = p1 + p2 + p3 + p4
    if total > 1.0:  # keep a valid distribution
        p1, p2, p3, p4 = (x / total for x in (p1, p2, p3, p4))
        total = 1.0
    actual_vec = [1 - total, p1, p2, p3, p4]

    # Neutral vector: same batter form + park/weather, but league-average pitcher
    # (no platoon, no pitcher quality, no bvp) so the ratio isolates pitcher effect.
    n1 = regress(b.get("season_1b", 0), pa, _LG_1B, _COMP_R) * form * park_1b
    n2 = regress(b.get("season_2b", 0), pa, _LG_2B, _COMP_R) * form * park_2b * wx
    n3 = regress(b.get("season_3b", 0), pa, _LG_3B, _COMP_R) * form * park_3b * wx
    n4 = hr_rate_per_pa(b.get("season_hr", 0), pa, recent_form_mult=form,
                        park_mult=eff_park, weather_mult=weather_mult)
    n1, n2, n3, n4 = (max(0.0, x) for x in (n1, n2, n3, n4))
    ntotal = n1 + n2 + n3 + n4
    if ntotal > 1.0:
        n1, n2, n3, n4 = (x / ntotal for x in (n1, n2, n3, n4))
        ntotal = 1.0
    neutral_vec = [1 - ntotal, n1, n2, n3, n4]

    return actual_vec, neutral_vec


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
        # Per-component hit park factors for TB (Hits stays park-neutral)
        if units == "bases":
            p1f = hit_park_factor(game["park_team"], "1b")
            p2f = hit_park_factor(game["park_team"], "2b")
            p3f = hit_park_factor(game["park_team"], "3b")
        else:
            p1f = p2f = p3f = 1.0

        for side, opp in (("home", away_p), ("away", home_p)):
            team = game.get(side, "?")
            eff_park = park_mult / sqrt(hr_park_factor(team))
            for slot, b in enumerate(lineups.get(side, [])):
                bvp = bvp_fn(b.get("player_id"), opp.get("player_id")) if (bvp_fn and opp) else None
                actual_vec, neutral_vec = _batter_outcome_vector(
                    b, opp, eff_park, weather_mult, slot, bvp,
                    apply_xbh_park=(units == "bases"),
                    park_1b=p1f, park_2b=p2f, park_3b=p3f,
                )
                outcomes = [actual_vec[0], actual_vec[1] + actual_vec[2] + actual_vec[3] + actual_vec[4]] if units == "hits" else actual_vec

                # Compute pitcher_factor as the ratio of actual expected value to neutral
                if units == "hits":
                    actual_ev = actual_vec[1] + actual_vec[2] + actual_vec[3] + actual_vec[4]
                    neutral_ev = neutral_vec[1] + neutral_vec[2] + neutral_vec[3] + neutral_vec[4]
                else:  # "bases"
                    actual_ev = actual_vec[1] + 2 * actual_vec[2] + 3 * actual_vec[3] + 4 * actual_vec[4]
                    neutral_ev = neutral_vec[1] + 2 * neutral_vec[2] + 3 * neutral_vec[3] + 4 * neutral_vec[4]
                pitcher_factor = (actual_ev / neutral_ev) if neutral_ev > 0 else 1.0

                park_weather_factor = 1.0
                if units == "bases":
                    nenv_vec, _ = _batter_outcome_vector(
                        b, opp, 1.0, 1.0, slot, bvp,
                        apply_xbh_park=True,
                        park_1b=1.0, park_2b=1.0, park_3b=1.0,
                    )
                    nenv_ev = nenv_vec[1] + 2 * nenv_vec[2] + 3 * nenv_vec[3] + 4 * nenv_vec[4]
                    park_weather_factor = (actual_ev / nenv_ev) if nenv_ev > 0 else 1.0

                epa = expected_pa_for_slot(slot)
                vs = None
                if opp:
                    m = matchup(
                        b_k=b.get("k_rate", 0.22), b_hit=b.get("hit_rate", 0.22),
                        p_k=opp.get("k_per_bf", 0.22), p_hit=opp.get("hit_allowed_rate", 0.22),
                        bats=b.get("bats", "R"), throws=opp.get("throws", "R"),
                    )
                    m = _history_adjusted(m, bvp)
                    vs = {"name": opp["name"], "player_id": opp.get("player_id"), "throws": opp.get("throws", "R"), "bvp": bvp, "pitcher_status": opp.get("pitcher_status", "confirmed"), **m}
                row = {
                    "prop": prop, "game_id": game["game_id"], "game_time": game.get("game_time"),
                    "player_id": b.get("player_id"), "player": b["name"], "team": team,
                    "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                    "bats": b.get("bats", "R"),
                    "lineup_status": b.get("lineup_status", "confirmed"),
                    "recent_form_mult": b.get("recent_form_mult", 1.0),
                    "pitcher_factor": pitcher_factor,
                    "park_weather_factor": park_weather_factor,
                    "vs": vs,
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


# ---------------------------------------------------------------------------
# Runs / RBI / HRR builders (per-game Poisson rate model)
# ---------------------------------------------------------------------------

from model import run_props as _run_props  # noqa: E402  (local import to keep top-level clean)
from model.parks import run_park_factor, hrr_park_factor  # noqa: E402

_RUN_PROP_CFG = {
    "RUNS": {"thresholds": [("p_ge1", 1), ("p_ge2", 2)], "total_field": "total_r",   "recent_field": "recent_r",   "league": _run_props.LEAGUE_R_PER_GAME},
    "RBI":  {"thresholds": [("p_ge1", 1), ("p_ge2", 2)], "total_field": "total_rbi", "recent_field": "recent_rbi", "league": _run_props.LEAGUE_RBI_PER_GAME},
    "HRR":  {"thresholds": [("p_ge2", 2), ("p_ge3", 3), ("p_ge4", 4)], "total_field": "total_hrr", "recent_field": "recent_hrr", "league": _run_props.LEAGUE_HRR_PER_GAME},
}


def _run_prop_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn, *, prop):
    """Shared loop for Runs / RBI / HRR rows.

    Mirrors the structure of _threshold_rows but uses the Poisson per-game
    rate model (run_props) instead of the per-PA outcome-vector model.
    bvp_fn is accepted for signature parity but not used.
    """
    cfg = _RUN_PROP_CFG[prop]
    rows = []
    for game in slate:
        if game.get("started"):
            continue
        w = _game_weather(game, weather_fn)
        lineups = lineups_fn(game)
        home_p = pitcher_fn(game["home_pitcher_id"]) if game.get("home_pitcher_id") else None
        away_p = pitcher_fn(game["away_pitcher_id"]) if game.get("away_pitcher_id") else None
        # home batters face the away starter; away batters face the home starter
        for side, opp in (("home", away_p), ("away", home_p)):
            team = game.get(side, "?")
            park = hrr_park_factor(team) if prop == "HRR" else run_park_factor(team)
            for b in lineups.get(side, []):
                games = b.get("games", 0)
                total = b.get(cfg["total_field"], 0)
                rate = _run_props.regressed_per_game(total, games, cfg["league"], _run_props.REG_GAMES)
                psupp = _run_props.pitcher_suppression_mult(opp.get("hit_allowed_rate", 0.22)) if opp else 1.0
                platoon = hr_platoon_mult(b.get("bats", "R"), opp.get("throws", "R")) if opp else 1.0
                # Recent-form blending
                hard_hit = b.get("recent_form_mult", 1.0)
                season_rate = (total / games) if games > 0 else 0.0
                production = _run_props.production_form_mult(
                    b.get(cfg["recent_field"], 0),
                    b.get("recent_games", 0),
                    season_rate,
                )
                blended = _run_props.blend_forms(hard_hit, production)
                lam = _run_props.expected_count(rate, pitcher_mult=psupp, platoon_mult=platoon, park_mult=park, form_mult=blended)
                m = matchup(
                    b_k=b.get("k_rate", 0.22), b_hit=b.get("hit_rate", 0.22),
                    p_k=opp.get("k_per_bf", 0.22) if opp else 0.22,
                    p_hit=opp.get("hit_allowed_rate", 0.22) if opp else 0.22,
                    bats=b.get("bats", "R"), throws=opp.get("throws", "R") if opp else "R",
                )
                vs = None
                if opp:
                    vs = {"name": opp["name"], "player_id": opp.get("player_id"), "throws": opp.get("throws", "R"),
                          "bvp": None, "pitcher_status": opp.get("pitcher_status", "confirmed"), **m}
                row = {
                    "prop": prop, "game_id": game["game_id"], "game_time": game.get("game_time"),
                    "player_id": b.get("player_id"), "player": b["name"], "team": team,
                    "matchup": f'{game.get("away", "?")} @ {game.get("home", "?")}',
                    "bats": b.get("bats", "R"),
                    "lineup_status": b.get("lineup_status", "confirmed"),
                    "recent_form_mult": blended,
                    "hard_hit_form": hard_hit,
                    "production_form": production,
                    "pitcher_factor": psupp,
                    "park_weather_factor": park,
                    "vs": vs,
                    "wind_out_mph": w["wind_out_mph"], "wind_mph": w["wind_mph"],
                    "wind_dir": w["wind_dir"], "temp_f": w["temp_f"], "precip_pct": w["precip_pct"],
                }
                row.update(_run_props.ge_probs(lam, cfg["thresholds"]))
                rows.append(row)
    rows.sort(key=lambda r: r[cfg["thresholds"][0][0]], reverse=True)
    return rows


def build_runs_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None):
    return _run_prop_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn, prop="RUNS")


def build_rbi_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None):
    return _run_prop_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn, prop="RBI")


def build_hrr_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn=None):
    return _run_prop_rows(slate, lineups_fn, pitcher_fn, weather_fn, bvp_fn, prop="HRR")
