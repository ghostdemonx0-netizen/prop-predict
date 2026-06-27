# tests/test_grader.py
from model import fetch

_SAMPLE_BOX = {
    "home": {
        "battingOrder": [12345],
        "pitchers": [67890],
        "players": {
            "ID12345": {"personId": 12345,
                        "stats": {"batting": {"plateAppearances": 4, "hits": 2,
                                              "totalBases": 4, "homeRuns": 1,
                                              "runs": 1, "rbi": 1},
                                  "pitching": {}}},
            "ID67890": {"personId": 67890,
                        "stats": {"batting": {},
                                  "pitching": {"battersFaced": 25, "strikeOuts": 7}}},
        },
    },
    "away": {"battingOrder": [], "pitchers": [], "players": {}},
}

def test_parse_boxscore_batter_and_pitcher():
    out = fetch._parse_boxscore(_SAMPLE_BOX, "Final")
    assert out["status"] == "final"
    assert out["players"][12345]["bat"] == {"h": 2, "tb": 4, "hr": 1, "r": 1, "rbi": 1}
    assert out["players"][12345]["pit"] is None
    assert out["players"][67890]["pit"] == {"k": 7}
    assert out["players"][67890]["bat"] is None

def test_parse_boxscore_dnp_player_absent():
    # a roster player with zero plate appearances is treated as did-not-bat (no "bat")
    box = {"home": {"players": {"ID999": {"personId": 999,
            "stats": {"batting": {"plateAppearances": 0}, "pitching": {}}}}},
           "away": {"players": {}}}
    out = fetch._parse_boxscore(box, "Final")
    assert out["players"][999]["bat"] is None

def test_parse_boxscore_status_normalization():
    assert fetch._parse_boxscore({"home": {"players": {}}, "away": {"players": {}}}, "Postponed")["status"] == "postponed"
    assert fetch._parse_boxscore({"home": {"players": {}}, "away": {"players": {}}}, "In Progress")["status"] == "live"

from model import grader

def _pred(prop, player_id=12345, game_id=776543, line=None):
    p = {"date": "2026-06-27", "game_id": game_id, "player_id": player_id,
         "player": "Aaron Judge", "team": "NYY", "prop": prop, "probs": {}, "factors": {}}
    if line is not None:
        p["factors"]["line"] = line
    return p

def _outcome(bat=None, pit=None, player_id=12345, status="final", game_id=776543):
    return {"game_id": game_id, "status": status,
            "players": {player_id: {"bat": bat, "pit": pit}}}

def test_grade_hits_all_thresholds():
    g = grader.grade_prediction(_pred("hits"),
            _outcome(bat={"h": 2, "tb": 4, "hr": 1, "r": 1, "rbi": 1}),
            final_retry=False, now_iso="2026-06-28T13:00:00Z")
    assert g["status"] == "graded"
    assert g["actual"] == 2
    assert g["results"] == {"1+": True, "2+": True, "3+": False}

def test_grade_total_bases_and_hrr():
    tb = grader.grade_prediction(_pred("total_bases"),
            _outcome(bat={"h": 1, "tb": 4, "hr": 1, "r": 1, "rbi": 1}),
            final_retry=False, now_iso="x")
    assert tb["actual"] == 4 and tb["results"] == {"2+": True, "3+": True, "4+": True}
    hrr = grader.grade_prediction(_pred("hrr"),
            _outcome(bat={"h": 1, "tb": 1, "hr": 0, "r": 1, "rbi": 1}),  # 1+1+1 = 3
            final_retry=False, now_iso="x")
    assert hrr["actual"] == 3 and hrr["results"] == {"2+": True, "3+": True, "4+": False}

def test_grade_strikeouts_over_under_push():
    over = grader.grade_prediction(_pred("strikeouts", player_id=67890, line=6.5),
             _outcome(pit={"k": 7}, player_id=67890), final_retry=False, now_iso="x")
    assert over["actual"] == 7 and over["results"] == {"over 6.5": True}

    under = grader.grade_prediction(_pred("strikeouts", player_id=67890, line=6.5),
             _outcome(pit={"k": 5}, player_id=67890), final_retry=False, now_iso="x")
    assert under["results"] == {"over 6.5": False}

    push = grader.grade_prediction(_pred("strikeouts", player_id=67890, line=6),
             _outcome(pit={"k": 6}, player_id=67890), final_retry=False, now_iso="x")
    assert push["push"] is True and push["results"] == {"over 6": None}

def test_void_when_player_absent_in_final_game():
    g = grader.grade_prediction(_pred("hits"),
            {"game_id": 776543, "status": "final", "players": {}},  # player not in box
            final_retry=False, now_iso="x")
    assert g["status"] == "void" and g["void_reason"] == "DNP"
    assert "actual" not in g

def test_not_final_returns_none_unless_final_retry():
    pred = _pred("hits")
    live = {"game_id": 776543, "status": "live", "players": {}}
    assert grader.grade_prediction(pred, live, final_retry=False, now_iso="x") is None
    # on the date's last in-window run, an unfinished game settles to void
    g = grader.grade_prediction(pred, live, final_retry=True, now_iso="x")
    assert g["status"] == "void" and g["void_reason"] == "postponed"

def test_missing_outcome_returns_none():
    assert grader.grade_prediction(_pred("hits"), None, final_retry=False, now_iso="x") is None

def test_grade_day_grades_present_skips_unsettled():
    preds = [_pred("hits", player_id=1, game_id=100),
             _pred("rbi",  player_id=1, game_id=100),
             _pred("hits", player_id=2, game_id=200)]  # game 200 not final -> skipped
    outcomes = {100: {"game_id": 100, "status": "final",
                      "players": {1: {"bat": {"h":2,"tb":2,"hr":0,"r":0,"rbi":1}, "pit": None}}},
                200: {"game_id": 200, "status": "live", "players": {}}}
    grades = grader.grade_day(preds, outcomes, final_retry=False, now_iso="x")
    assert len(grades) == 2  # two from game 100; game 200 unsettled, omitted
    assert {g["prop"] for g in grades} == {"hits", "rbi"}

def test_grade_day_one_grade_per_prediction():
    # a prediction carries 3 weightings but produces exactly ONE grade
    preds = [_pred("hits", player_id=1, game_id=100)]
    outcomes = {100: {"game_id": 100, "status": "final",
                      "players": {1: {"bat": {"h":1,"tb":1,"hr":0,"r":0,"rbi":0}, "pit": None}}}}
    assert len(grader.grade_day(preds, outcomes, final_retry=False, now_iso="x")) == 1
