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
