import math
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


# ===========================================================================
# Task 4 — history-beff twins propagated for threshold props
# ===========================================================================

def test_hits_barrel_mult_beff_surface_as_hist(monkeypatch):
    """barrel_mult + p_ge*_beff on a hits history row must appear as *_hist twins on current row."""
    import model.export_web as ew

    _cur_lf  = object()   # sentinel for current-mode lineup fn
    _hist_lf = object()   # sentinel for history-mode lineup fn

    cur_row  = {"player_id": 1, "game_id": 101,
                "p_ge1": 0.70, "p_ge2": 0.40, "p_ge3": 0.15,
                "barrel_mult": 1.10}
    hist_row = {"player_id": 1, "game_id": 101,
                "p_ge1": 0.65, "p_ge2": 0.38, "p_ge3": 0.14,
                "barrel_mult": 1.15,
                "p_ge1_beff": 0.72, "p_ge2_beff": 0.42}

    def fake_hits(slate, lf, pf, wf, bvp_fn=None):
        return [dict(hist_row)] if lf is _hist_lf else [dict(cur_row)]

    monkeypatch.setattr(ew, "build_hits_rows", fake_hits)
    monkeypatch.setattr(ew, "build_hr_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_strikeout_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_total_bases_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_runs_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_rbi_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_hrr_rows", lambda *a, **kw: [])

    _, _, hits, _, _, _, _ = ew.build_board_with_history(
        [], _cur_lf, None, _hist_lf, None, None, None)

    assert hits[0].get("barrel_mult_hist") == 1.15, "barrel_mult_hist not attached for hits"
    assert hits[0].get("p_ge1_beff_hist") == 0.72, "p_ge1_beff_hist not attached for hits"
    assert hits[0].get("p_ge2_beff_hist") == 0.42, "p_ge2_beff_hist not attached for hits"


def test_tb_barrel_mult_beff_surface_as_hist(monkeypatch):
    """barrel_mult + p_ge*_beff on a TB history row must appear as *_hist twins on current row."""
    import model.export_web as ew

    _cur_lf  = object()
    _hist_lf = object()

    cur_row  = {"player_id": 2, "game_id": 102,
                "p_ge2": 0.60, "p_ge3": 0.35, "p_ge4": 0.10}
    hist_row = {"player_id": 2, "game_id": 102,
                "p_ge2": 0.55, "p_ge3": 0.32, "p_ge4": 0.09,
                "barrel_mult": 1.20,
                "p_ge2_beff": 0.58, "p_ge3_beff": 0.34}

    def fake_tb(slate, lf, pf, wf, bvp_fn=None):
        return [dict(hist_row)] if lf is _hist_lf else [dict(cur_row)]

    monkeypatch.setattr(ew, "build_total_bases_rows", fake_tb)
    monkeypatch.setattr(ew, "build_hr_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_strikeout_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_hits_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_runs_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_rbi_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_hrr_rows", lambda *a, **kw: [])

    _, _, _, tb, _, _, _ = ew.build_board_with_history(
        [], _cur_lf, None, _hist_lf, None, None, None)

    assert tb[0].get("barrel_mult_hist") == 1.20, "barrel_mult_hist not attached for tb"
    assert tb[0].get("p_ge2_beff_hist") == 0.58, "p_ge2_beff_hist not attached for tb"
    assert tb[0].get("p_ge3_beff_hist") == 0.34, "p_ge3_beff_hist not attached for tb"


def test_runs_barrel_mult_beff_surface_as_hist(monkeypatch):
    """barrel_mult + p_ge*_beff on a runs history row (_attach path) must appear as *_hist twins."""
    import model.export_web as ew

    _cur_lf  = object()
    _hist_lf = object()

    cur_row  = {"player_id": 3, "game_id": 103,
                "p_ge1": 0.55, "p_ge2": 0.20}
    hist_row = {"player_id": 3, "game_id": 103,
                "p_ge1": 0.50, "p_ge2": 0.18,
                "barrel_mult": 1.05,
                "p_ge1_beff": 0.57}

    def fake_runs(slate, lf, pf, wf, bvp_fn=None):
        return [dict(hist_row)] if lf is _hist_lf else [dict(cur_row)]

    monkeypatch.setattr(ew, "build_runs_rows", fake_runs)
    monkeypatch.setattr(ew, "build_hr_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_strikeout_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_hits_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_total_bases_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_rbi_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_hrr_rows", lambda *a, **kw: [])

    _, _, _, _, runs, _, _ = ew.build_board_with_history(
        [], _cur_lf, None, _hist_lf, None, None, None)

    assert runs[0].get("barrel_mult_hist") == 1.05, "barrel_mult_hist not attached for runs"
    assert runs[0].get("p_ge1_beff_hist") == 0.57, "p_ge1_beff_hist not attached for runs"


# ===========================================================================
# Task 2 — oracle + oracle_score emitted on board hitters
# ===========================================================================

def test_oracle_strong_barrel_bat_flags_true():
    """A strong-barrel bat (elite stats + bbe=300) vs a barrel-vulnerable pitcher
    (maxed allowed rates) must surface stats.oracle == 1."""
    strong_h = {
        "barrel_rate": 0.15, "pulled_barrel_rate": 0.08, "sweetspot_rate": 0.40,
        "fb_rate": 0.30, "hardhit_rate": 0.55, "la_mean": 18.0, "xwobacon": 0.42,
        "hrfb_rate": 0.25, "player_id": 10, "name": "Oracle Bat", "bats": "R",
        "swstr": 0.10, "csw": 0.30, "ball": 0.35, "iso": 0.25, "xwoba": 0.38,
        "zone_dmg": {5: 1.2},
        "bbe": 300, "recent_form_mult": 1.1,
    }
    vuln_p = {
        "barrel_rate_allowed": 0.12, "pulled_barrel_rate_allowed": 0.06,
        "fb_rate_allowed": 0.45, "hardhit_rate_allowed": 0.52,
        "player_id": 99, "name": "Barrel Vuln", "throws": "L",
        "swstr": 0.12, "csw": 0.31, "ball": 0.34, "xwoba_allowed": 0.35,
        "zone_freq": {5: 0.5},
    }
    slate = [{"away": "NYY", "home": "BOS", "away_pitcher_id": 99, "home_pitcher_id": 99,
              "park_name": "Fenway Park", "started": False}]
    boards = build_boards_payload(
        slate,
        lineups_fn=lambda g: {"home": [dict(strong_h)], "away": [dict(strong_h)]},
        pitcher_fn=lambda pid: dict(vuln_p),
    )
    h = boards["games"][0]["awayHitters"][0]["stats"]
    assert "oracle" in h, "oracle key missing from stats"
    assert "oracle_score" in h, "oracle_score key missing from stats"
    assert h["oracle"] == 1, f"expected oracle=1 for elite barrel bat, got {h.get('oracle')} (score={h.get('oracle_score')})"


def test_oracle_average_bat_flags_false():
    """A league-average bat (all None stats, quality < gate) must surface stats.oracle == 0."""
    avg_h = {
        "barrel_rate": None, "pulled_barrel_rate": None, "sweetspot_rate": None,
        "fb_rate": None, "hardhit_rate": None, "xwobacon": None,
        "player_id": 11, "name": "Average Bat", "bats": "R",
        "swstr": None, "csw": None, "ball": None, "iso": None, "xwoba": None,
        "la_mean": None, "hrfb_rate": None, "zone_dmg": {},
        "bbe": 300, "recent_form_mult": 1.0,
    }
    avg_p = {
        "barrel_rate_allowed": None, "pulled_barrel_rate_allowed": None,
        "fb_rate_allowed": None, "hardhit_rate_allowed": None,
        "player_id": 98, "name": "Average Arm", "throws": "R",
        "swstr": None, "csw": None, "ball": None, "xwoba_allowed": None,
        "zone_freq": {},
    }
    slate = [{"away": "CHI", "home": "CLE", "away_pitcher_id": 98, "home_pitcher_id": 98,
              "park_name": "Wrigley Field", "started": False}]
    boards = build_boards_payload(
        slate,
        lineups_fn=lambda g: {"home": [dict(avg_h)], "away": [dict(avg_h)]},
        pitcher_fn=lambda pid: dict(avg_p),
    )
    h = boards["games"][0]["awayHitters"][0]["stats"]
    assert "oracle" in h, "oracle key missing from stats"
    assert "oracle_score" in h, "oracle_score key missing from stats"
    assert h["oracle"] == 0, f"expected oracle=0 for league-average bat, got {h.get('oracle')} (score={h.get('oracle_score')})"
