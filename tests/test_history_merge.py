# tests/test_history_merge.py
from model.export_web import build_board_with_history
from model.pipeline import build_hr_rows


def _bat(pid, hr_rate, k_rate=0.22, hit_rate=0.22):  # profile stub
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "season_hr": hr_rate, "season_pa": 100, "recent_form_mult": 1.0,
            "k_rate": k_rate, "hit_rate": hit_rate}


def _pit(pid, k_per_bf=0.22):
    return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R",
            "k_per_bf": k_per_bf, "expected_bf": 24, "opponent_k_mult": 1.0, "k_line": 5.5,
            "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}


def _w(g):
    return {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}


def test_history_twins_attached():
    slate = [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    cur_l = lambda g: {"home": [_bat(1, 5)], "away": [_bat(2, 5)]}
    hist_l = lambda g: {"home": [_bat(1, 9)], "away": [_bat(2, 9)]}  # higher HR base in history
    cur_p = lambda pid: _pit(pid)
    hist_p = lambda pid: {**_pit(pid), "k_per_bf": 0.30}
    w = lambda g: {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}
    hr, ks = build_board_with_history(slate, cur_l, cur_p, hist_l, hist_p, w, None)
    assert all("probability_hist" in r for r in hr)
    assert hr[0]["probability_hist"] != hr[0]["probability"]  # history base differs
    assert all("over_prob_hist" in r and "expected_ks_hist" in r for r in ks)


def test_key_based_matching_not_index():
    """Two-game slate where current and history have DIFFERENT sort orders.

    Player A (pid=1) has higher current HR base (season_hr=10) but lower
    history HR base (season_hr=3).
    Player B (pid=2) has lower current HR base (season_hr=4) but higher
    history HR base (season_hr=15).

    After sorting by probability:
      current order:  A first, B second  (10 > 4)
      history order:  B first, A second  (15 > 3)

    A plain index-zip would match A's current row with B's history row and
    vice-versa.  Key-based matching must match A→A and B→B.
    """
    # Two separate games so each batter appears as a separate HR row
    slate = [
        {"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
         "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False},
        {"game_id": 2, "home": "CCC", "away": "DDD", "park_team": "CCC",
         "home_pitcher_id": 101, "away_pitcher_id": 201, "started": False},
    ]
    # game 1: player A (pid=1) on home side
    # game 2: player B (pid=2) on home side
    def cur_l(g):
        if g["game_id"] == 1:
            return {"home": [_bat(1, 10)], "away": []}
        return {"home": [_bat(2, 4)], "away": []}

    def hist_l(g):
        if g["game_id"] == 1:
            return {"home": [_bat(1, 3)], "away": []}  # A: low history
        return {"home": [_bat(2, 15)], "away": []}  # B: high history

    cur_p = lambda pid: _pit(pid)
    hist_p = lambda pid: _pit(pid)

    hr, _ = build_board_with_history(slate, cur_l, cur_p, hist_l, hist_p, _w, None)

    # Verify current probabilities are unchanged (equal to standalone build)
    standalone = build_hr_rows(slate, cur_l, cur_p, _w, bvp_fn=None)
    standalone_by_key = {(r["player_id"], r["game_id"]): r["probability"] for r in standalone}
    for r in hr:
        key = (r["player_id"], r["game_id"])
        assert r["probability"] == standalone_by_key[key], (
            f"current probability changed for player_id={r['player_id']}, game_id={r['game_id']}"
        )

    # Now verify key-based matching: each row's probability_hist must match
    # the history probability for the SAME (player_id, game_id).
    # Build the history twins standalone for ground-truth comparison.
    hist_standalone = build_hr_rows(slate, hist_l, hist_p, _w, bvp_fn=None)
    hist_by_key = {(r["player_id"], r["game_id"]): r["probability"] for r in hist_standalone}

    for r in hr:
        key = (r["player_id"], r["game_id"])
        assert "probability_hist" in r, f"missing probability_hist for player_id={r['player_id']}"
        assert r["probability_hist"] == hist_by_key[key], (
            f"probability_hist mismatch for player_id={r['player_id']}, game_id={r['game_id']}: "
            f"got {r['probability_hist']}, expected {hist_by_key[key]}"
        )


def test_vs_twins_contain_hist_fields():
    """HR row's vs dict must contain k_prob_hist, hit_prob_hist, lean_hist, prob_hist."""
    slate = [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    cur_l = lambda g: {"home": [_bat(1, 5)], "away": []}
    hist_l = lambda g: {"home": [_bat(1, 9)], "away": []}
    cur_p = lambda pid: _pit(pid)
    hist_p = lambda pid: _pit(pid)

    hr, _ = build_board_with_history(slate, cur_l, cur_p, hist_l, hist_p, _w, None)

    # Find the row for player 1 (home, facing away pitcher 200)
    rows_with_vs = [r for r in hr if r.get("vs") is not None]
    assert rows_with_vs, "expected at least one HR row with a vs dict"
    vs = rows_with_vs[0]["vs"]
    for field in ("k_prob_hist", "hit_prob_hist", "lean_hist", "prob_hist"):
        assert field in vs, f"vs dict missing '{field}'"


def test_missing_history_twin_is_graceful():
    """A current HR row whose (player_id, game_id) has no history twin must
    not crash and must NOT have 'probability_hist' attached."""
    slate = [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    # Current mode produces a row for player 1; history mode produces nothing
    # (empty lineups) so there is no twin.
    cur_l = lambda g: {"home": [_bat(1, 5)], "away": []}
    hist_l = lambda g: {"home": [], "away": []}  # no twin
    cur_p = lambda pid: _pit(pid)
    hist_p = lambda pid: _pit(pid)

    hr, _ = build_board_with_history(slate, cur_l, cur_p, hist_l, hist_p, _w, None)

    assert len(hr) == 1
    assert "probability_hist" not in hr[0], (
        "probability_hist must not be present when no history twin exists"
    )
