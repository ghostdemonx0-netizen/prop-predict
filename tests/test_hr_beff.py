from model.pipeline import build_hr_rows


def _weather_fn(game):
    return {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}


def _slate():
    return [{"game_id": 1, "started": False, "home": "BOS", "away": "NYY",
             "park_team": "BOS", "home_pitcher_id": 9, "away_pitcher_id": 9}]


_HITTER = {"player_id": 1, "name": "Big Bat", "bats": "R", "season_hr": 30, "season_pa": 500,
           "recent_form_mult": 1.0, "production_form_hr": 1.0, "games": 120,
           "barrel_rate": 0.20, "pulled_barrel_rate": 0.12, "hardhit_rate": 0.55,
           "sweetspot_rate": 0.45, "fb_rate": 0.45, "xwobacon": 0.46, "bbe": 300,
           "k_rate": 0.22, "hit_rate": 0.22, "spray_sides": {}}
_PITCHER = {"player_id": 9, "name": "Arm", "throws": "L", "hr_allowed_rate": 0.033, "bf": 400,
            "barrel_rate_allowed": 0.12, "pulled_barrel_rate_allowed": 0.08,
            "hardhit_rate_allowed": 0.52, "fb_rate_allowed": 0.45, "k_per_bf": 0.22,
            "hit_allowed_rate": 0.22}


def test_hr_row_has_barrel_mult_and_beff():
    rows = build_hr_rows(_slate(), lambda g: {"home": [dict(_HITTER)], "away": []},
                         lambda pid: dict(_PITCHER), _weather_fn, bvp_fn=None)
    r = rows[0]
    assert 0.80 <= r["barrel_mult"] <= 1.20
    assert r["barrel_mult"] > 1.0                       # strong bat vs vulnerable arm
    assert abs(r["probability_beff"] - r["probability"] * r["barrel_mult"]) < 1e-9
    assert r["probability"] > 0                          # normal prob untouched/present
