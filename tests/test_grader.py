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
