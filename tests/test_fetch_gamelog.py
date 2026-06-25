from unittest.mock import patch
from model import fetch

_FAKE = {"people": [{"stats": [{"splits": [
    {"date": "2026-04-01", "stat": {"runs": 1, "rbi": 2, "hits": 1}},
    {"date": "2026-04-02", "stat": {"runs": 0, "rbi": 0, "hits": 2}},
]}]}]}

def test_batter_gamelog_parses_per_game_r_rbi_h():
    with patch.object(fetch, "statsapi") as m:
        m.get.return_value = _FAKE
        rows = fetch.batter_gamelog(12345, 2026)
    assert rows == [
        {"game_date": "2026-04-01", "r": 1, "rbi": 2, "h": 1},
        {"game_date": "2026-04-02", "r": 0, "rbi": 0, "h": 2},
    ]

def test_batter_gamelog_empty_on_missing_splits():
    with patch.object(fetch, "statsapi") as m:
        m.get.return_value = {"people": [{}]}
        assert fetch.batter_gamelog(1, 2026) == []

def test_batter_gamelog_empty_on_fetch_error():
    with patch.object(fetch, "_with_retries", side_effect=RuntimeError("boom")):
        assert fetch.batter_gamelog(1, 2026) == []
