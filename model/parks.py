"""Ballpark home-run factors and orientation.

hr_factor: multiplicative HR park factor (1.0 = neutral, >1 inflates HRs).
cf_bearing_deg: compass bearing (0=N, 90=E) from home plate toward center field;
    the direction a ball hit to straightaway CF travels.
dome: True if a fixed/closed roof neutralizes wind.
Values are reasonable v1 estimates; refine later from data.
"""

PARKS: dict[str, dict] = {
    "ARI": {"name": "Chase Field", "hr_factor": 1.04, "cf_bearing_deg": 0, "dome": True},
    "ATL": {"name": "Truist Park", "hr_factor": 1.05, "cf_bearing_deg": 25, "dome": False},
    "BAL": {"name": "Camden Yards", "hr_factor": 1.02, "cf_bearing_deg": 28, "dome": False},
    "BOS": {"name": "Fenway Park", "hr_factor": 1.03, "cf_bearing_deg": 45, "dome": False},
    "CHC": {"name": "Wrigley Field", "hr_factor": 1.04, "cf_bearing_deg": 30, "dome": False},
    "CWS": {"name": "Rate Field", "hr_factor": 1.06, "cf_bearing_deg": 5, "dome": False},
    "CIN": {"name": "Great American Ball Park", "hr_factor": 1.12, "cf_bearing_deg": 10, "dome": False},
    "CLE": {"name": "Progressive Field", "hr_factor": 0.98, "cf_bearing_deg": 0, "dome": False},
    "COL": {"name": "Coors Field", "hr_factor": 1.22, "cf_bearing_deg": 0, "dome": False},
    "DET": {"name": "Comerica Park", "hr_factor": 0.94, "cf_bearing_deg": 20, "dome": False},
    "HOU": {"name": "Daikin Park", "hr_factor": 1.08, "cf_bearing_deg": 15, "dome": True},
    "KC":  {"name": "Kauffman Stadium", "hr_factor": 0.92, "cf_bearing_deg": 0, "dome": False},
    "LAA": {"name": "Angel Stadium", "hr_factor": 1.00, "cf_bearing_deg": 20, "dome": False},
    "LAD": {"name": "Dodger Stadium", "hr_factor": 1.06, "cf_bearing_deg": 25, "dome": False},
    "MIA": {"name": "loanDepot park", "hr_factor": 0.97, "cf_bearing_deg": 30, "dome": True},
    "MIL": {"name": "American Family Field", "hr_factor": 1.05, "cf_bearing_deg": 0, "dome": True},
    "MIN": {"name": "Target Field", "hr_factor": 1.01, "cf_bearing_deg": 20, "dome": False},
    "NYM": {"name": "Citi Field", "hr_factor": 0.97, "cf_bearing_deg": 25, "dome": False},
    "NYY": {"name": "Yankee Stadium", "hr_factor": 1.10, "cf_bearing_deg": 10, "dome": False},
    "OAK": {"name": "Sutter Health Park", "hr_factor": 0.95, "cf_bearing_deg": 0, "dome": False},
    "PHI": {"name": "Citizens Bank Park", "hr_factor": 1.07, "cf_bearing_deg": 15, "dome": False},
    "PIT": {"name": "PNC Park", "hr_factor": 0.94, "cf_bearing_deg": 40, "dome": False},
    "SD":  {"name": "Petco Park", "hr_factor": 0.95, "cf_bearing_deg": 30, "dome": False},
    "SF":  {"name": "Oracle Park", "hr_factor": 0.90, "cf_bearing_deg": 20, "dome": False},
    "SEA": {"name": "T-Mobile Park", "hr_factor": 0.96, "cf_bearing_deg": 10, "dome": False},
    "STL": {"name": "Busch Stadium", "hr_factor": 0.98, "cf_bearing_deg": 20, "dome": False},
    "TB":  {"name": "Tropicana Field", "hr_factor": 0.97, "cf_bearing_deg": 0, "dome": True},
    "TEX": {"name": "Globe Life Field", "hr_factor": 1.03, "cf_bearing_deg": 15, "dome": True},
    "TOR": {"name": "Rogers Centre", "hr_factor": 1.02, "cf_bearing_deg": 0, "dome": True},
    "WSH": {"name": "Nationals Park", "hr_factor": 1.01, "cf_bearing_deg": 25, "dome": False},
}

_NEUTRAL = {"name": "Unknown Park", "hr_factor": 1.0, "cf_bearing_deg": 0, "dome": False}


def get_park(team_abbr: str) -> dict:
    """Return the park dict for a home-team abbreviation, or a neutral default."""
    return PARKS.get(team_abbr, _NEUTRAL)


def hr_park_factor(team_abbr: str) -> float:
    """Return the multiplicative HR park factor for a home-team abbreviation."""
    return get_park(team_abbr)["hr_factor"]
