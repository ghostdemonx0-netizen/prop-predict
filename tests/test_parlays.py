from model.parlays import _best_per_game, _combined, build_all_parlays, build_parlay_set


def test_combined_is_product_of_leg_probs():
    legs = [{"prob": 0.8, "game_id": 1}, {"prob": 0.5, "game_id": 2}]
    assert abs(_combined(legs) - 0.40) < 1e-9


def test_best_per_game_keeps_one_highest_per_game():
    plays = [
        {"prop": "HR", "player": "A", "probability": 0.30, "game_id": 1},
        {"prop": "HR", "player": "B", "probability": 0.40, "game_id": 1},  # same game, higher
        {"prop": "HR", "player": "C", "probability": 0.20, "game_id": 2},
    ]
    pool = _best_per_game(plays)
    assert len(pool) == 2  # one leg per game
    assert pool[0]["prob"] == 0.40  # highest first
    assert pool[0]["label"] == "B HR"


def test_parlay_set_picks_top_by_combined_prob_different_games():
    pool = [
        {"prob": 0.8, "game_id": 1, "label": "a"},
        {"prob": 0.7, "game_id": 2, "label": "b"},
        {"prob": 0.6, "game_id": 3, "label": "c"},
        {"prob": 0.5, "game_id": 4, "label": "d"},
    ]
    res = build_parlay_set(pool, 2, 3)
    assert len(res) == 3
    assert abs(res[0]["prob"] - 0.56) < 1e-9  # 0.8 * 0.7
    for r in res:  # every parlay uses distinct games
        games = {leg["game_id"] for leg in r["legs"]}
        assert len(games) == len(r["legs"])


def test_parlay_set_slate_adaptive_returns_empty_when_too_few_games():
    pool = [{"prob": 0.8, "game_id": 1, "label": "a"}, {"prob": 0.7, "game_id": 2, "label": "b"}]
    assert build_parlay_set(pool, 5, 3) == []  # needs 5 games, only 2


def test_build_all_parlays_structure_and_slate_adaptive():
    # 4 games, each with an HR + K leg
    board = {"hr": [], "strikeouts": [], "hits": []}
    for g in range(1, 5):
        board["hr"].append({"prop": "HR", "player": f"H{g}", "probability": 0.30 + g * 0.01, "game_id": g})
        board["strikeouts"].append({"prop": "K", "player": f"P{g}", "over_prob": 0.70 + g * 0.01,
                                    "line": 4.5, "game_id": g})
    out = build_all_parlays(board, now_iso="2000-01-01T00:00:00+00:00")
    assert {"hr", "hits", "ks", "moneyline"} <= set(out)
    assert len(out["hr"]["3leg"]) > 0  # 4 games can build 3-leg HR
    assert out["ks"]["7leg"] == []  # only 4 games -> no 7-leg
    assert out["moneyline"][15] == []  # no 15-leg on a 4-game slate
    assert len(out["moneyline"][5]) == 0  # need 5 games for a 5-leg
