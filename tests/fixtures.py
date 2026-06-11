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
    }
]

SAMPLE_BATTERS = {
    1: [
        {"player_id": 101, "name": "Big Bopper", "team": "LAD", "bats": "R",
         "season_hr": 30, "season_pa": 600, "expected_pa": 4.3,
         "recent_form_mult": 1.10, "matchup_mult": 1.05},
    ],
}

SAMPLE_PITCHERS = {
    201: {"player_id": 201, "name": "Ace Coors", "team": "COL", "throws": "R",
          "k_per_bf": 0.27, "expected_bf": 24, "opponent_k_mult": 1.04, "k_line": 5.5},
    202: {"player_id": 202, "name": "Dodger Arm", "team": "LAD", "throws": "L",
          "k_per_bf": 0.25, "expected_bf": 23, "opponent_k_mult": 1.00, "k_line": 5.5},
}

# weather keyed by game_id
SAMPLE_WEATHER = {
    1: {"wind_speed_mph": 10.0, "wind_from_deg": 180.0, "temp_f": 80.0},
}
