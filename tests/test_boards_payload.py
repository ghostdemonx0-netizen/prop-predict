from model.export_web import build_boards_payload

_H = {"barrel_rate": 0.15, "pulled_barrel_rate": 0.08, "sweetspot_rate": 0.40,
      "fb_rate": 0.30, "hardhit_rate": 0.55, "la_mean": 18.0, "xwobacon": 0.42,
      "hrfb_rate": 0.25, "player_id": 1, "name": "Big Bat", "bats": "R",
      "swstr": 0.10, "csw": 0.30, "ball": 0.35, "iso": 0.25, "xwoba": 0.38,
      "zone_dmg": {5: 1.2}}
_P = {"barrel_rate_allowed": 0.10, "pulled_barrel_rate_allowed": 0.06,
      "fb_rate_allowed": 0.40, "hardhit_rate_allowed": 0.48,
      "player_id": 9, "name": "Hittable Arm", "throws": "L",
      "swstr": 0.12, "csw": 0.31, "ball": 0.34, "xwoba_allowed": 0.30,
      "zone_freq": {5: 0.5}}

def _slate():
    return [{"away": "NYY", "home": "BOS", "away_pitcher_id": 9, "home_pitcher_id": 9,
             "park_name": "Fenway Park", "started": False}]

def test_boards_payload_shape_and_real_values():
    boards = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P),
    )
    assert set(boards) == {"games", "pitchers"}
    g = boards["games"][0]
    assert g["away"] == "NYY" and g["home"] == "BOS" and g["venue"] == "Fenway Park"
    h = g["awayHitters"][0]
    assert h["name"] == "Big Bat" and h["order"] == 1 and h["hand"] == "R"
    # rates converted to percent; Prop Score present and 0-100
    assert h["stats"]["brl"] == 15.0            # 0.15 * 100
    assert h["stats"]["hh"] == 55.0
    assert round(h["stats"]["xwobacon"], 2) == 0.42   # passthrough (not *100)
    assert 0.0 <= h["stats"]["trueScore"] <= 100.0
    # pitcher board carries allowed barrels as percent
    p = boards["pitchers"][0]
    assert p["stats"]["brlbip"] == 10.0 and p["stats"]["pbrl"] == 6.0

def test_started_games_skipped():
    slate = [{"away": "NYY", "home": "BOS", "away_pitcher_id": 9, "home_pitcher_id": 9,
              "park_name": "Fenway", "started": True}]
    boards = build_boards_payload(slate, lambda g: {"home": [], "away": []}, lambda pid: dict(_P))
    assert boards["games"] == []


def test_boards_surfaces_pitch_level_fields():
    boards = build_boards_payload(_slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P))
    h = boards["games"][0]["awayHitters"][0]["stats"]
    assert h["swstr"] == 10.0 and h["csw"] == 30.0 and h["iso"] == 0.25   # swstr/csw/ball *100 for display; iso decimal passthrough
    assert "xwoba" in h and "zonefit" in h                                 # zonefit computed from zone_dmg × zone_freq
    p = boards["pitchers"][0]["stats"]
    assert "swstr" in p and "csw" in p and "ball" in p and "xwoba" in p
