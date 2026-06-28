import json


def test_make_bvp_fn_caches_and_handles_missing_ids(monkeypatch):
    from model import export_web
    calls = []
    monkeypatch.setattr(export_web, "get_or_compute", lambda key, producer: producer())
    monkeypatch.setattr(export_web.fetch, "get_bvp", lambda b, p: calls.append((b, p)) or {"pa": 3, "ab": 3, "hits": 1, "hr": 0, "k": 1, "avg": ".333"})
    fn = export_web.make_bvp_fn()
    assert fn(1, 2)["pa"] == 3
    assert fn(None, 2) is None and fn(1, None) is None
    assert calls == [(1, 2)]


def test_update_index_caps_at_seven_and_prunes_old_files(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    (tmp_path / "latest.json").write_text("{}")
    for day in range(1, 10):  # nine consecutive days
        d = f"2026-06-{day:02d}"
        (tmp_path / f"{d}.json").write_text("{}")
        export_web._update_index(d)
    idx = json.loads((tmp_path / "index.json").read_text())
    # newest 7 only, newest first
    assert idx["dates"] == [f"2026-06-{day:02d}" for day in range(9, 2, -1)]
    # files that fell out of the window are deleted; the rest survive
    assert not (tmp_path / "2026-06-01.json").exists()
    assert not (tmp_path / "2026-06-02.json").exists()
    assert (tmp_path / "2026-06-03.json").exists()
    assert (tmp_path / "2026-06-09.json").exists()
    # latest.json and index.json are never pruned
    assert (tmp_path / "latest.json").exists()
    assert (tmp_path / "index.json").exists()


def test_update_index_corrupt_index_resets_and_prunes_only_date_files(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    (tmp_path / "index.json").write_text("NOT JSON{{{")
    (tmp_path / "latest.json").write_text("{}")
    # 7 recent date files fill the window; 2026-06-01 is the 8th so it's pruned
    for day in range(5, 12):  # 2026-06-05 through 2026-06-11
        (tmp_path / f"2026-06-{day:02d}.json").write_text("{}")
    (tmp_path / "2026-06-01.json").write_text("{}")     # date file outside new window
    (tmp_path / "schema.json").write_text("{}")          # stray non-date json
    export_web._update_index("2026-06-11")
    idx = json.loads((tmp_path / "index.json").read_text())
    assert idx["dates"] == [f"2026-06-{day:02d}" for day in range(11, 4, -1)]
    assert not (tmp_path / "2026-06-01.json").exists()  # pruned (outside window)
    assert (tmp_path / "schema.json").exists()           # non-date json never deleted
    assert (tmp_path / "latest.json").exists()


def test_update_index_self_heals_orphaned_date_files(tmp_path, monkeypatch):
    from model import export_web
    monkeypatch.setattr(export_web, "DATA_DIR", tmp_path)
    # an orphan written by a crashed run, never indexed
    (tmp_path / "2026-06-09.json").write_text("{}")
    (tmp_path / "2026-06-10.json").write_text("{}")
    export_web._update_index("2026-06-10")
    idx = json.loads((tmp_path / "index.json").read_text())
    assert idx["dates"] == ["2026-06-10", "2026-06-09"]  # orphan re-entered


def test_make_profile_fns_projects_and_tags_status(monkeypatch):
    from model import export_web, fetch
    slate = [{"game_id": 5, "home": "COL", "away": "LAD", "park_team": "COL",
              "home_id": 115, "away_id": 119, "game_time": "2026-06-10T20:00:00Z",
              "started": False, "home_pitcher_id": 201, "away_pitcher_id": 202}]
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {"home": [], "away": [111]})
    monkeypatch.setattr(fetch, "get_recent_lineup", lambda tid, d, **k: [101, 102] if tid == 115 else [])
    monkeypatch.setattr(fetch, "get_player_meta", lambda ids: {})
    monkeypatch.setattr(export_web, "get_or_compute", lambda key, prod: {"events_stub": True})
    monkeypatch.setattr(export_web.profiles, "batter_profile_from_events",
                        lambda ev, **k: {"player_id": k["player_id"], "name": str(k["player_id"]), "bats": "R", "season_hr": 1, "season_pa": 100, "recent_form_mult": 1.0, "k_rate": 0.2, "hit_rate": 0.2})
    monkeypatch.setattr(export_web.profiles, "pitcher_profile_from_events",
                        lambda ev, **k: {"player_id": k["player_id"], "name": str(k["player_id"]), "throws": "R", "k_per_bf": 0.2, "expected_bf": 24, "hit_allowed_rate": 0.2, "hr_allowed_rate": 0.03, "bf": 400, "k_line": 5.5})
    lineups_fn, pitcher_fn, *_ = export_web.make_profile_fns(slate, 2026, "2026-06-10")
    g = slate[0]
    assert g["home_lineup_status"] == "projected" and g["away_lineup_status"] == "confirmed"
    assert g["home_pitcher_status"] == "probable" and g["away_pitcher_status"] == "confirmed"
    lns = lineups_fn(g)
    assert [b["player_id"] for b in lns["home"]] == [101, 102]
    assert all(b["lineup_status"] == "projected" for b in lns["home"])
    assert all(b["lineup_status"] == "confirmed" for b in lns["away"])
    assert pitcher_fn(201)["pitcher_status"] == "probable"
    assert pitcher_fn(202)["pitcher_status"] == "confirmed"


# ---------------------------------------------------------------------------
# Run-prop board: form fields exposed; history twin is form-neutral
# ---------------------------------------------------------------------------

def _run_bat(pid, games, r, rbi, hrr, *, recent_form_mult=1.0, recent_games=0,
             recent_r=0, recent_rbi=0, recent_hrr=0):
    """Minimal batter profile for run-prop board tests."""
    return {
        "player_id": pid, "name": str(pid), "bats": "R",
        "games": games, "total_r": r, "total_rbi": rbi, "total_hrr": hrr,
        "games_hist": games, "total_r_hist": r, "total_rbi_hist": rbi, "total_hrr_hist": hrr,
        "k_rate": 0.22, "hit_rate": 0.25, "lineup_status": "confirmed",
        "season_pa": 400, "season_1b": 90, "season_2b": 25, "season_3b": 3, "season_hr": 20,
        "recent_form_mult": recent_form_mult,
        "recent_games": recent_games,
        "recent_r": recent_r,
        "recent_rbi": recent_rbi,
        "recent_hrr": recent_hrr,
    }


def _run_pit(pid):
    return {"player_id": pid, "name": str(pid), "throws": "R", "k_per_bf": 0.22,
            "k_line": 5.5, "expected_bf": 24, "opponent_k_mult": 1.0,
            "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}


def _weather_fn(_g):
    return {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}


def _slate():
    return [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
             "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]


def test_run_prop_rows_expose_hard_hit_form_and_production_form():
    """Run-prop board rows must carry hard_hit_form and production_form fields
    (and their _hist twins must be present after history wiring)."""
    from model.export_web import build_board_with_history

    cur  = lambda g: {"home": [_run_bat(1, 100, 60, 70, 200)], "away": [_run_bat(2, 100, 50, 50, 180)]}
    hist = lambda g: {"home": [_run_bat(1, 100, 60, 70, 200)], "away": [_run_bat(2, 100, 50, 50, 180)]}
    _, _, _, _, runs, rbi, hrr = build_board_with_history(
        _slate(), cur, lambda p: _run_pit(p), hist, lambda p: _run_pit(p), _weather_fn, None)
    row = runs[0]
    assert "hard_hit_form" in row, "hard_hit_form missing from runs row"
    assert "production_form" in row, "production_form missing from runs row"
    assert "hard_hit_form_hist" in row, "hard_hit_form_hist missing — not wired in _run_factor_fields"
    assert "production_form_hist" in row, "production_form_hist missing — not wired in _run_factor_fields"


def test_run_prop_hot_current_lifts_p_ge1_above_hist():
    """A batter hot in production (many recent R vs season avg) should have
    p_ge1 (current) > p_ge1_hist (form-neutral history twin)."""
    from model.export_web import build_board_with_history

    # Hot batter: 20 R in 15 recent games → 1.33/g vs season_rate 60/100=0.60/g
    hot = _run_bat(1, 100, 60, 70, 200,
                   recent_form_mult=1.15, recent_games=15,
                   recent_r=20, recent_rbi=22, recent_hrr=55)
    cur  = lambda g: {"home": [hot], "away": [_run_bat(2, 100, 50, 50, 180)]}
    # History fn must neutralize form — use same season totals but batter_hist_fn
    # applies neutralization; simulate that here by using neutral batter for hist
    hist_neutral = _run_bat(1, 100, 60, 70, 200,
                            recent_form_mult=1.0, recent_games=0,
                            recent_r=0, recent_rbi=0, recent_hrr=0)
    hist = lambda g: {"home": [hist_neutral], "away": [_run_bat(2, 100, 50, 50, 180)]}
    _, _, _, _, runs, rbi, hrr = build_board_with_history(
        _slate(), cur, lambda p: _run_pit(p), hist, lambda p: _run_pit(p), _weather_fn, None)
    r = next(x for x in runs if x["player_id"] == 1)
    assert "p_ge1_hist" in r, "p_ge1_hist not attached"
    assert r["p_ge1"] > r["p_ge1_hist"], (
        f"Expected current p_ge1 ({r['p_ge1']:.4f}) > hist p_ge1_hist ({r['p_ge1_hist']:.4f}); "
        "form should lift current above the form-neutral twin"
    )


def test_run_prop_hist_recent_form_mult_is_neutral():
    """The history twin's recent_form_mult must be 1.0 (form-neutral).

    This is guaranteed by batter_hist_fn setting recent_form_mult=1.0 and
    recent_* counts to 0 before the pipeline runs.  The _hist field on the
    board row should therefore equal 1.0.
    """
    from model.export_web import build_board_with_history

    cur  = lambda g: {"home": [_run_bat(1, 100, 60, 70, 200, recent_form_mult=1.2, recent_games=15, recent_r=18, recent_rbi=20, recent_hrr=50)], "away": []}
    hist = lambda g: {"home": [_run_bat(1, 100, 60, 70, 200)], "away": []}
    _, _, _, _, runs, _, _ = build_board_with_history(
        _slate(), cur, lambda p: _run_pit(p), hist, lambda p: _run_pit(p), _weather_fn, None)
    r = next((x for x in runs if x["player_id"] == 1), None)
    assert r is not None, "no runs row for player 1"
    assert "recent_form_mult_hist" in r, "recent_form_mult_hist not wired"
    assert r["recent_form_mult_hist"] == 1.0, (
        f"Expected recent_form_mult_hist == 1.0 (form-neutral), got {r['recent_form_mult_hist']}"
    )


def test_batter_hist_fn_neutralizes_form_end_to_end(monkeypatch):
    """E2E: the REAL batter_hist_fn must zero the recent-form fields even when the
    blended profile is HOT (recent_form_mult>1) and the gamelogs have recent games.

    The other run-prop tests feed pre-neutralized mocks into the history lambda;
    this one drives batter_hist_fn itself (via make_profile_fns) so the 5
    neutralization lines are actually exercised — it would catch a future refactor
    that reorders the override before with_gamelog, or drops a field.
    """
    from model import export_web, fetch
    slate = [{"game_id": 7, "home": "COL", "away": "LAD", "park_team": "COL",
              "home_id": 115, "away_id": 119, "game_time": "2026-06-10T20:00:00Z",
              "started": False, "home_pitcher_id": 201, "away_pitcher_id": 202}]
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {"home": [101], "away": []})
    monkeypatch.setattr(fetch, "get_recent_lineup", lambda tid, d, **k: [])
    monkeypatch.setattr(fetch, "get_player_meta", lambda ids: {})

    def fake_goc(key, prod):
        # 10 current-season game logs → with_gamelog WILL populate recent_* (>0)
        if "gamelog" in key:
            return [{"game_date": f"2026-06-{d:02d}", "r": 1, "rbi": 1, "h": 1} for d in range(1, 11)]
        return {"events_stub": True}
    monkeypatch.setattr(export_web, "get_or_compute", fake_goc)
    # current-path profile (hard-hit form present, real recent games)
    monkeypatch.setattr(export_web.profiles, "batter_profile_from_events",
                        lambda ev, **k: {"player_id": k["player_id"], "name": str(k["player_id"]),
                                         "bats": "R", "recent_form_mult": 1.25, "k_rate": 0.2, "hit_rate": 0.2})
    # history-path blended profile comes back HOT — batter_hist_fn must neutralize it
    monkeypatch.setattr(export_web.profiles, "blended_batter_profile",
                        lambda ev, **k: {"player_id": k["player_id"], "name": str(k["player_id"]),
                                         "bats": "R", "recent_form_mult": 1.25})

    lineups_fn, _pf, lineups_hist_fn, _phf = export_web.make_profile_fns(slate, 2026, "2026-06-10")

    # the data IS present on the current path (proves the gamelogs produce recent games)
    cur = lineups_fn(slate[0])["home"][0]
    assert cur["recent_games"] == 10 and cur["recent_form_mult"] == 1.25

    # ...and the history twin neutralizes ALL of it
    hist = lineups_hist_fn(slate[0])["home"][0]
    assert hist["recent_form_mult"] == 1.0, "hard-hit form not neutralized in history twin"
    assert hist["recent_games"] == 0, "recent_games not zeroed in history twin"
    assert hist["recent_r"] == 0 and hist["recent_rbi"] == 0 and hist["recent_hrr"] == 0


def test_run_factor_fields_includes_lineup_factors():
    # The history-twin attach list must carry the lineup factor so it is archived.
    import inspect
    from model import export_web
    src = inspect.getsource(export_web.build_board_with_history)
    assert "lineup_mult" in src
    assert "lineup_slot" in src
    assert "lineup_teammate" in src
