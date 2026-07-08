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
# Task 4 — history-bweight twins propagated (HR + threshold props)
# ===========================================================================

def test_hr_bweight_hist_twin_attached(monkeypatch):
    """probability_bweight on an HR history row must appear as probability_bweight_hist on current row."""
    import model.export_web as ew

    _cur_lf  = object()
    _hist_lf = object()

    cur_row  = {"player_id": 1, "game_id": 201, "probability": 0.15}
    hist_row = {"player_id": 1, "game_id": 201, "probability": 0.12,
                "probability_bweight": 0.14}

    def fake_hr(slate, lf, pf, wf, bvp_fn=None):
        return [dict(hist_row)] if lf is _hist_lf else [dict(cur_row)]

    monkeypatch.setattr(ew, "build_hr_rows", fake_hr)
    monkeypatch.setattr(ew, "build_strikeout_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_hits_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_total_bases_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_runs_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_rbi_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_hrr_rows", lambda *a, **kw: [])

    hr, _, _, _, _, _, _ = ew.build_board_with_history(
        [], _cur_lf, None, _hist_lf, None, None, None)

    assert hr[0].get("probability_bweight_hist") == 0.14, "probability_bweight_hist not attached for HR"


def test_hits_bweight_hist_twin_attached(monkeypatch):
    """p_ge*_bweight on a hits history row must appear as *_bweight_hist twins on current row."""
    import model.export_web as ew

    _cur_lf  = object()
    _hist_lf = object()

    cur_row  = {"player_id": 1, "game_id": 202,
                "p_ge1": 0.70, "p_ge2": 0.40}
    hist_row = {"player_id": 1, "game_id": 202,
                "p_ge1": 0.65, "p_ge2": 0.38,
                "p_ge1_bweight": 0.67, "p_ge2_bweight": 0.39}

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

    assert hits[0].get("p_ge1_bweight_hist") == 0.67, "p_ge1_bweight_hist not attached for hits"
    assert hits[0].get("p_ge2_bweight_hist") == 0.39, "p_ge2_bweight_hist not attached for hits"


def test_tb_bweight_hist_twin_attached(monkeypatch):
    """p_ge*_bweight on a TB history row must appear as *_bweight_hist twins on current row."""
    import model.export_web as ew

    _cur_lf  = object()
    _hist_lf = object()

    cur_row  = {"player_id": 2, "game_id": 203,
                "p_ge2": 0.60, "p_ge3": 0.35}
    hist_row = {"player_id": 2, "game_id": 203,
                "p_ge2": 0.55, "p_ge3": 0.32,
                "p_ge2_bweight": 0.57, "p_ge3_bweight": 0.33}

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

    assert tb[0].get("p_ge2_bweight_hist") == 0.57, "p_ge2_bweight_hist not attached for TB"
    assert tb[0].get("p_ge3_bweight_hist") == 0.33, "p_ge3_bweight_hist not attached for TB"


def test_runs_bweight_hist_twin_attached(monkeypatch):
    """p_ge*_bweight on a runs history row (_attach path) must appear as *_bweight_hist twins."""
    import model.export_web as ew

    _cur_lf  = object()
    _hist_lf = object()

    cur_row  = {"player_id": 3, "game_id": 204,
                "p_ge1": 0.55, "p_ge2": 0.20}
    hist_row = {"player_id": 3, "game_id": 204,
                "p_ge1": 0.50, "p_ge2": 0.18,
                "p_ge1_bweight": 0.52}

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

    assert runs[0].get("p_ge1_bweight_hist") == 0.52, "p_ge1_bweight_hist not attached for runs"


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


# ===========================================================================
# Board headline scores — Matchup + HR Form (hitter) + P Score + K Score (pitcher)
# ===========================================================================

def test_board_score_keys_present_on_hitter_and_pitcher():
    """matchup (30-90) + hrform (20-90) on hitter; pscore (30-60) + kscore (30-60) on pitcher."""
    boards = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P),
    )
    h = boards["games"][0]["awayHitters"][0]["stats"]
    assert "matchup" in h, "matchup key missing from hitter stats"
    assert "hrform" in h, "hrform key missing from hitter stats"
    assert 30 <= h["matchup"] <= 90, f"matchup out of range: {h['matchup']}"
    assert 20 <= h["hrform"] <= 90, f"hrform out of range: {h['hrform']}"

    p = boards["pitchers"][0]["stats"]
    assert "pscore" in p, "pscore key missing from pitcher stats"
    assert "kscore" in p, "kscore key missing from pitcher stats"
    assert 30 <= p["pscore"] <= 60, f"pscore out of range: {p['pscore']}"
    assert 30 <= p["kscore"] <= 60, f"kscore out of range: {p['kscore']}"


def test_high_whiff_pitcher_gets_higher_kscore_than_low_whiff():
    """A pitcher with elite K rate must outscore a low-K pitcher on kscore."""
    high_k_p = dict(_P, k_per_bf=0.35)   # well above league (0.225)
    low_k_p  = dict(_P, k_per_bf=0.10)   # well below league

    def make_boards(pitcher_profile):
        return build_boards_payload(
            _slate(),
            lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
            pitcher_fn=lambda pid: dict(pitcher_profile),
        )

    high_kscore = make_boards(high_k_p)["pitchers"][0]["stats"]["kscore"]
    low_kscore  = make_boards(low_k_p)["pitchers"][0]["stats"]["kscore"]
    assert high_kscore > low_kscore, (
        f"expected high-K pitcher kscore ({high_kscore}) > low-K pitcher kscore ({low_kscore})"
    )


def test_hot_form_hitter_gets_higher_hrform_than_cold():
    """A batter on a hot streak (form_mult > 1) must outscore a cold one (form_mult < 1)."""
    hot_h  = dict(_H, recent_form_mult=1.3)
    cold_h = dict(_H, recent_form_mult=0.7)

    def make_boards(hitter_profile):
        return build_boards_payload(
            _slate(),
            lineups_fn=lambda g: {"home": [dict(hitter_profile)], "away": [dict(hitter_profile)]},
            pitcher_fn=lambda pid: dict(_P),
        )

    hot_hrform  = make_boards(hot_h)["games"][0]["awayHitters"][0]["stats"]["hrform"]
    cold_hrform = make_boards(cold_h)["games"][0]["awayHitters"][0]["stats"]["hrform"]
    assert hot_hrform > cold_hrform, (
        f"expected hot hitter hrform ({hot_hrform}) > cold hitter hrform ({cold_hrform})"
    )


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


# ===========================================================================
# Gap-3 completeness fix — _hist factor twins for HR, Hits, TB, Runs/RBI/HRR
# ===========================================================================

def test_hr_factor_hist_twins_complete(monkeypatch):
    """All 10 previously-missing HR factor _hist twins must be attached."""
    import model.export_web as ew

    _cur_lf  = object()
    _hist_lf = object()

    cur_row  = {"player_id": 1, "game_id": 301, "probability": 0.10,
                "matchup_mult": 1.1, "park_mult": 1.05, "weather_mult": 0.95,
                "pitcher_mult": 1.2, "hard_hit_form": 1.1, "production_form": 0.9,
                "recent_form_mult": 1.05, "bvp_mult": 1.1, "spray_pull": True, "spray_mult": 1.03}
    hist_row = {"player_id": 1, "game_id": 301, "probability": 0.09,
                "matchup_mult": 1.15, "park_mult": 1.06, "weather_mult": 0.94,
                "pitcher_mult": 1.25, "hard_hit_form": 1.12, "production_form": 0.88,
                "recent_form_mult": 1.08, "bvp_mult": 1.12, "spray_pull": True, "spray_mult": 1.04}

    def fake_hr(slate, lf, pf, wf, bvp_fn=None):
        return [dict(hist_row)] if lf is _hist_lf else [dict(cur_row)]

    monkeypatch.setattr(ew, "build_hr_rows", fake_hr)
    monkeypatch.setattr(ew, "build_strikeout_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_hits_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_total_bases_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_runs_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_rbi_rows", lambda *a, **kw: [])
    monkeypatch.setattr(ew, "build_hrr_rows", lambda *a, **kw: [])

    hr, _, _, _, _, _, _ = ew.build_board_with_history(
        [], _cur_lf, None, _hist_lf, None, None, None)

    row = hr[0]
    # newly-added twins
    assert row.get("matchup_mult_hist") == 1.15
    assert row.get("park_mult_hist") == 1.06
    assert row.get("weather_mult_hist") == 0.94
    assert row.get("pitcher_mult_hist") == 1.25
    assert row.get("hard_hit_form_hist") == 1.12
    assert row.get("production_form_hist") == 0.88
    assert row.get("recent_form_mult_hist") == 1.08
    assert row.get("bvp_mult_hist") == 1.12
    assert row.get("spray_pull_hist") is True
    assert row.get("spray_mult_hist") == 1.04
    # existing current-mode values UNCHANGED (additive-only check)
    assert row.get("probability") == 0.10
    assert row.get("matchup_mult") == 1.1
    assert row.get("park_mult") == 1.05


def test_hits_bvp_hit_mult_and_spray_pull_hist_twins(monkeypatch):
    """bvp_hit_mult and spray_pull must get _hist twins on hits rows."""
    import model.export_web as ew

    _cur_lf  = object()
    _hist_lf = object()

    cur_row  = {"player_id": 2, "game_id": 302, "p_ge1": 0.70, "bvp_hit_mult": 1.05, "spray_pull": True}
    hist_row = {"player_id": 2, "game_id": 302, "p_ge1": 0.68, "bvp_hit_mult": 1.06, "spray_pull": False}

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

    row = hits[0]
    assert row.get("bvp_hit_mult_hist") == 1.06
    assert row.get("spray_pull_hist") is False
    # current values unchanged
    assert row.get("bvp_hit_mult") == 1.05
    assert row.get("spray_pull") is True
    assert row.get("p_ge1") == 0.70


def test_tb_bvp_hit_spray_hist_twins(monkeypatch):
    """bvp_hit_mult, spray_pull, spray_mult must get _hist twins on TB rows."""
    import model.export_web as ew

    _cur_lf  = object()
    _hist_lf = object()

    cur_row  = {"player_id": 3, "game_id": 303, "p_ge2": 0.60,
                "bvp_hit_mult": 1.03, "spray_pull": True, "spray_mult": 1.02}
    hist_row = {"player_id": 3, "game_id": 303, "p_ge2": 0.58,
                "bvp_hit_mult": 1.04, "spray_pull": False, "spray_mult": 1.01}

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

    row = tb[0]
    assert row.get("bvp_hit_mult_hist") == 1.04
    assert row.get("spray_pull_hist") is False
    assert row.get("spray_mult_hist") == 1.01
    # current values unchanged
    assert row.get("bvp_hit_mult") == 1.03
    assert row.get("spray_pull") is True
    assert row.get("spray_mult") == 1.02
    assert row.get("p_ge2") == 0.60


def test_runs_platoon_mult_hist_twin(monkeypatch):
    """platoon_mult must get a _hist twin on runs/rbi rows."""
    import model.export_web as ew

    _cur_lf  = object()
    _hist_lf = object()

    cur_row  = {"player_id": 4, "game_id": 304, "p_ge1": 0.55, "platoon_mult": 1.05}
    hist_row = {"player_id": 4, "game_id": 304, "p_ge1": 0.53, "platoon_mult": 1.08}

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

    row = runs[0]
    assert row.get("platoon_mult_hist") == 1.08
    # current values unchanged
    assert row.get("platoon_mult") == 1.05
    assert row.get("p_ge1") == 0.55


# ===========================================================================
# Gap 1 — Driver columns (park / weather / pitcher / platoon / form) surfaced
# ===========================================================================

def test_driver_columns_present_when_factors_by_pid_provided():
    """park, weather, pitcher, platoon, form must be numeric when factors are supplied.

    _H bats=R vs _P throws=L -> platoon advantage -> hr_platoon_mult returns 1.06
    -> _pct_delta(1.06) = round(6.0, 1) = 6.0
    """
    factors = {1: {"park_mult": 1.05, "weather_mult": 0.95, "pitcher_mult": 1.20}}
    boards = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P),
        factors_by_pid=factors,
    )
    h = boards["games"][0]["awayHitters"][0]["stats"]
    assert h["park"]    == round((1.05 - 1.0) * 100, 1),  f"park wrong: {h['park']}"
    assert h["weather"] == round((0.95 - 1.0) * 100, 1),  f"weather wrong: {h['weather']}"
    assert h["pitcher"] == round((1.20 - 1.0) * 100, 1),  f"pitcher wrong: {h['pitcher']}"
    assert h["platoon"] == round((1.06 - 1.0) * 100, 1),  f"platoon wrong: {h['platoon']}"
    # _H has no recent_form_mult -> form = None (not a number)
    assert h["form"] is None, f"expected form=None for hitter without recent_form_mult, got {h['form']}"


def test_driver_columns_form_numeric_when_recent_form_mult_set():
    """form column must carry the percent-delta of recent_form_mult when present."""
    hitter = dict(_H, recent_form_mult=1.10)
    factors = {1: {"park_mult": 1.0, "weather_mult": 1.0, "pitcher_mult": 1.0}}
    boards = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [hitter], "away": [hitter]},
        pitcher_fn=lambda pid: dict(_P),
        factors_by_pid=factors,
    )
    h = boards["games"][0]["awayHitters"][0]["stats"]
    assert h["form"] == round((1.10 - 1.0) * 100, 1), f"form wrong: {h['form']}"


def test_driver_columns_none_when_no_factors_by_pid():
    """park / weather / pitcher must be None when no factors_by_pid provided (backward compat)."""
    boards = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P),
    )
    h = boards["games"][0]["awayHitters"][0]["stats"]
    assert h["park"] is None,    "park should be None without factors_by_pid"
    assert h["weather"] is None, "weather should be None without factors_by_pid"
    assert h["pitcher"] is None, "pitcher should be None without factors_by_pid"


def test_existing_stats_unchanged_with_factors():
    """Adding factors_by_pid must not alter trueScore, oracle, barrel cols, matchup, hrform."""
    factors = {1: {"park_mult": 1.10, "weather_mult": 1.05, "pitcher_mult": 0.90}}
    boards_with = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P),
        factors_by_pid=factors,
    )
    boards_without = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P),
    )
    h_with    = boards_with["games"][0]["awayHitters"][0]["stats"]
    h_without = boards_without["games"][0]["awayHitters"][0]["stats"]
    for key in ("trueScore", "oracle", "oracle_score", "brl", "pbrl", "matchup", "hrform",
                "hh", "swstr", "csw", "xwobacon", "zonefit"):
        assert h_with[key] == h_without[key], (
            f"{key} changed when adding factors: {h_with[key]} != {h_without[key]}"
        )


# ===========================================================================
# Gap 2 — Tiny-sample swstr / csw gated by pitch count
# ===========================================================================

def test_thin_pitch_sample_hitter_swstr_csw_none():
    """A hitter with fewer than 50 pitches seen must get swstr=None and csw=None."""
    thin_h = dict(_H, pitches=30)   # 30 < MIN_PITCHES_FOR_RATE (50)
    boards = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [thin_h], "away": [thin_h]},
        pitcher_fn=lambda pid: dict(_P),
    )
    h = boards["games"][0]["awayHitters"][0]["stats"]
    assert h["swstr"] is None, f"expected swstr=None for thin-sample hitter, got {h['swstr']}"
    assert h["csw"]   is None, f"expected csw=None for thin-sample hitter, got {h['csw']}"
    # ball is NOT gated — should still come through
    assert h["ball"] is not None, "ball should not be gated by pitch count"


def test_well_sampled_hitter_keeps_swstr_csw():
    """A hitter with >= 50 pitches seen must retain numeric swstr and csw."""
    good_h = dict(_H, pitches=200)
    boards = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [good_h], "away": [good_h]},
        pitcher_fn=lambda pid: dict(_P),
    )
    h = boards["games"][0]["awayHitters"][0]["stats"]
    assert h["swstr"] == 10.0, f"expected swstr=10.0 for well-sampled hitter, got {h['swstr']}"
    assert h["csw"]   == 30.0, f"expected csw=30.0 for well-sampled hitter, got {h['csw']}"


def test_thin_pitch_sample_pitcher_swstr_csw_none():
    """A pitcher with fewer than 50 pitches thrown must get swstr=None and csw=None."""
    thin_p = dict(_P, pitches=10)
    boards = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(thin_p),
    )
    p = boards["pitchers"][0]["stats"]
    assert p["swstr"] is None, f"expected pitcher swstr=None for thin sample, got {p['swstr']}"
    assert p["csw"]   is None, f"expected pitcher csw=None for thin sample, got {p['csw']}"
    # ball not gated
    assert p["ball"] is not None, "pitcher ball should not be gated"


def test_well_sampled_pitcher_keeps_swstr_csw():
    """A pitcher with >= 50 pitches thrown must retain numeric swstr and csw."""
    good_p = dict(_P, pitches=300)
    boards = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(good_p),
    )
    p = boards["pitchers"][0]["stats"]
    assert p["swstr"] == 12.0, f"expected pitcher swstr=12.0 for well-sampled, got {p['swstr']}"
    assert p["csw"]   == 31.0, f"expected pitcher csw=31.0 for well-sampled, got {p['csw']}"


# ===========================================================================
# Part A — board games carry game_id (needed for freeze-started-game merge)
# ===========================================================================

def test_board_games_carry_game_id():
    """Each board game entry must include game_id so refresh_today can match
    frozen started games back onto the boards payload."""
    slate = [{"game_id": 42, "away": "NYY", "home": "BOS", "away_pitcher_id": 9,
              "home_pitcher_id": 9, "park_name": "Fenway Park", "started": False}]
    boards = build_boards_payload(
        slate,
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P),
    )
    assert boards["games"][0].get("game_id") == 42, (
        f"board game must carry game_id=42, got {boards['games'][0].get('game_id')}"
    )


# ===========================================================================
# Part B — History stat twins on board hitter and pitcher rows
# ===========================================================================

_H_HIST = dict(_H, barrel_rate=0.20, hardhit_rate=0.60, recent_form_mult=1.15)
_P_HIST = dict(_P, k_per_bf=0.30, hit_allowed_rate=0.18)


def test_boards_payload_hist_twins_on_hitter_stats():
    """With hist fns provided, each hitter's stats dict carries _hist twin keys
    (trueScore_hist, brl_hist, matchup_hist, oracle_hist, hrform_hist)."""
    slate = [{"game_id": 1, "away": "NYY", "home": "BOS", "away_pitcher_id": 9,
              "home_pitcher_id": 9, "park_name": "Fenway Park", "started": False}]
    boards = build_boards_payload(
        slate,
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P),
        lineups_hist_fn=lambda g: {"home": [dict(_H_HIST)], "away": [dict(_H_HIST)]},
        pitcher_hist_fn=lambda pid: dict(_P_HIST),
    )
    h_stats = boards["games"][0]["awayHitters"][0]["stats"]
    for key in ("trueScore_hist", "brl_hist", "matchup_hist", "oracle_hist", "hrform_hist"):
        assert key in h_stats, f"{key} missing from board hitter stats with hist fns"
    # Additive: current brl value must remain unchanged
    assert h_stats["brl"] == 15.0, "current brl must be unchanged after attaching hist twins"


def test_boards_payload_hist_twins_on_pitcher_stats():
    """With hist fns provided, each pitcher's stats dict carries pscore_hist and kscore_hist."""
    slate = [{"game_id": 1, "away": "NYY", "home": "BOS", "away_pitcher_id": 9,
              "home_pitcher_id": 9, "park_name": "Fenway Park", "started": False}]
    boards = build_boards_payload(
        slate,
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P),
        lineups_hist_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_hist_fn=lambda pid: dict(_P_HIST),
    )
    p_stats = boards["pitchers"][0]["stats"]
    for key in ("pscore_hist", "kscore_hist"):
        assert key in p_stats, f"{key} missing from pitcher stats with hist fns"
    # Additive: current brlbip must be unchanged
    assert p_stats["brlbip"] == 10.0, "current brlbip must be unchanged after attaching hist twins"


def test_boards_payload_no_hist_twins_without_hist_fns():
    """Without hist fns, no _hist keys appear on hitter or pitcher stats (additive/back-compat)."""
    boards = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P),
    )
    h_stats = boards["games"][0]["awayHitters"][0]["stats"]
    hist_keys = [k for k in h_stats if k.endswith("_hist")]
    assert not hist_keys, f"no _hist keys expected without hist fns, found {hist_keys}"

    p_stats = boards["pitchers"][0]["stats"]
    p_hist_keys = [k for k in p_stats if k.endswith("_hist")]
    assert not p_hist_keys, f"no _hist keys expected on pitcher stats without hist fns, found {p_hist_keys}"
