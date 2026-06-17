"""Sample data structures for pipeline unit tests (no network)."""

SAMPLE_SLATE = [
    {
        "game_id": 1,
        "home": "COL",
        "away": "LAD",
        "park_team": "COL",
        "game_time": "2026-06-10T20:40:00Z",
        "started": False,
        "home_pitcher_id": 201,
        "away_pitcher_id": 202,
        "lat": 39.756,
        "lon": -104.994,
        "home_lineup_status": "projected",
        "away_lineup_status": "confirmed",
    }
]


def _batter(pid, name, team, bats, hr, k_rate, hit_rate):
    return {
        "player_id": pid, "name": name, "team": team, "bats": bats,
        "season_hr": hr, "season_pa": 600,
        "recent_form_mult": 1.10,
        "k_rate": k_rate, "hit_rate": hit_rate,
        "lineup_status": "projected",
    }


# lineups split by side; keyed by game_id
SAMPLE_LINEUPS = {
    1: {
        "home": [_batter(101, "Home Masher", "COL", "R", 30, 0.22, 0.26)],
        "away": [_batter(111, "Away Slugger", "LAD", "L", 28, 0.25, 0.24)],
    },
}

SAMPLE_PITCHERS = {
    201: {"player_id": 201, "name": "Ace Coors", "team": "COL", "throws": "R",
          "k_per_bf": 0.27, "expected_bf": 24, "opponent_k_mult": 1.04,
          "k_line": 5.5, "hit_allowed_rate": 0.20, "hr_allowed_rate": 0.030, "bf": 430,
          "pitcher_status": "probable"},
    202: {"player_id": 202, "name": "Dodger Arm", "team": "LAD", "throws": "L",
          "k_per_bf": 0.25, "expected_bf": 23, "opponent_k_mult": 1.00,
          "k_line": 5.5, "hit_allowed_rate": 0.21, "hr_allowed_rate": 0.040, "bf": 460,
          "pitcher_status": "probable"},
}

# weather keyed by game_id
SAMPLE_WEATHER = {
    1: {"wind_speed_mph": 10.0, "wind_from_deg": 180.0, "temp_f": 80.0, "precip_pct": 30},
}
