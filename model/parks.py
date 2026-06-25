"""Ballpark home-run factors and orientation.

hr_factor: multiplicative HR park factor (1.0 = neutral, >1 inflates HRs).
cf_bearing_deg: compass bearing (0=N, 90=E) from home plate toward center field;
    the direction a ball hit to straightaway CF travels.
dome: True if a fixed/closed roof neutralizes wind.
Values are reasonable v1 estimates; refine later from data.
"""

HIT_FACTORS_LAST_PULLED = "2026-06-22"
# source: https://www.fangraphs.com/guts.aspx?type=pfh
# FanGraphs multi-year, normalized to multipliers, 1.00=neutral; refresh ~annually preseason.

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
    "MIA": {"name": "LoanDepot Park", "hr_factor": 0.97, "cf_bearing_deg": 30, "dome": True},
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

HIT_FACTORS: dict[str, dict] = {
    "ARI": {"1b": 1.03, "2b": 1.05, "3b": 1.20},
    "ATL": {"1b": 1.01, "2b": 0.98, "3b": 1.01},
    "BAL": {"1b": 1.03, "2b": 0.97, "3b": 1.06},
    "BOS": {"1b": 1.05, "2b": 1.11, "3b": 1.17},
    "CHC": {"1b": 1.01, "2b": 0.96, "3b": 1.13},
    "CWS": {"1b": 1.00, "2b": 0.96, "3b": 0.87},
    "CIN": {"1b": 1.02, "2b": 1.01, "3b": 0.84},
    "CLE": {"1b": 1.01, "2b": 1.01, "3b": 0.89},
    "COL": {"1b": 1.09, "2b": 1.11, "3b": 1.35},
    "DET": {"1b": 1.01, "2b": 1.01, "3b": 1.20},
    "HOU": {"1b": 0.99, "2b": 1.00, "3b": 1.14},
    "KC":  {"1b": 1.03, "2b": 1.08, "3b": 1.23},
    "LAA": {"1b": 1.00, "2b": 0.96, "3b": 1.01},
    "LAD": {"1b": 0.97, "2b": 0.98, "3b": 0.85},
    "MIA": {"1b": 1.01, "2b": 1.01, "3b": 1.09},
    "MIL": {"1b": 0.96, "2b": 0.96, "3b": 1.04},
    "MIN": {"1b": 1.00, "2b": 1.04, "3b": 0.92},
    "NYM": {"1b": 0.98, "2b": 0.96, "3b": 0.88},
    "NYY": {"1b": 0.97, "2b": 0.96, "3b": 0.86},
    "OAK": {"1b": 1.02, "2b": 1.00, "3b": 1.02},  # low confidence — new park
    "PHI": {"1b": 1.00, "2b": 0.98, "3b": 1.03},
    "PIT": {"1b": 1.02, "2b": 1.05, "3b": 0.99},
    "SD":  {"1b": 0.97, "2b": 0.96, "3b": 0.86},
    "SF":  {"1b": 1.01, "2b": 1.02, "3b": 1.11},
    "SEA": {"1b": 0.95, "2b": 0.93, "3b": 0.80},
    "STL": {"1b": 1.01, "2b": 0.98, "3b": 0.89},
    "TB":  {"1b": 1.04, "2b": 0.96, "3b": 0.91},
    "TEX": {"1b": 0.98, "2b": 1.00, "3b": 0.93},
    "TOR": {"1b": 0.98, "2b": 1.02, "3b": 0.89},
    "WSH": {"1b": 1.01, "2b": 1.00, "3b": 0.98},
}


def get_park(team_abbr: str) -> dict:
    """Return a copy of the park dict for a home-team abbreviation, or a neutral default."""
    return dict(PARKS.get(team_abbr, _NEUTRAL))


def hr_park_factor(team_abbr: str) -> float:
    """Return the multiplicative HR park factor for a home-team abbreviation."""
    return get_park(team_abbr)["hr_factor"]


def hit_park_factor(team_abbr: str, kind: str) -> float:
    """Return the per-component hit park factor (kind in {'1b','2b','3b'}).

    Returns 1.0 (neutral) for unknown parks or unknown kind.
    """
    return HIT_FACTORS.get(team_abbr, {}).get(kind, 1.0)


def hit_factors_stale(today_iso: str, max_days: int = 400) -> bool:
    """Return True if HIT_FACTORS_LAST_PULLED is more than max_days before today_iso.

    Pure function — caller passes today (no clock calls inside).
    """
    from datetime import date
    pulled = date.fromisoformat(HIT_FACTORS_LAST_PULLED)
    today = date.fromisoformat(today_iso)
    return (today - pulled).days > max_days


RUN_FACTORS_LAST_PULLED = "2026-06-25"
# source: FanGraphs/Statcast multi-year Runs park factors, normalized to multipliers, 1.00=neutral; refresh ~annually preseason.

RUN_FACTORS: dict[str, float] = {
    "COL": 1.15,
    "BOS": 1.06,
    "CIN": 1.05,
    "PHI": 1.03,
    "KC":  1.03,
    "ARI": 1.02,
    "BAL": 1.02,
    "TEX": 1.02,
    "CWS": 1.02,
    "NYY": 1.01,
    "CHC": 1.01,
    "LAA": 1.01,
    "MIN": 1.01,
    "ATL": 1.01,
    "HOU": 1.00,
    "TOR": 1.00,
    "WSH": 1.00,
    "STL": 0.99,
    "MIL": 0.99,
    "CLE": 0.99,
    "LAD": 0.99,
    "DET": 0.98,
    "NYM": 0.98,
    "PIT": 0.98,
    "OAK": 0.97,
    "TB":  0.97,
    "SD":  0.96,
    "MIA": 0.96,
    "SEA": 0.95,
    "SF":  0.94,
}

HRR_RUN_SHARE = 0.55


def run_park_factor(team_abbr: str) -> float:
    """Return the multiplicative run-environment park factor for a home-team abbreviation.

    Returns 1.0 (neutral) for unknown parks.
    """
    return RUN_FACTORS.get(team_abbr, 1.0)


def hrr_park_factor(team_abbr: str) -> float:
    """Return the park factor for H+R+RBI (HRR) props.

    HRR = H + R + RBI; hits are park-neutral in our model, so HRR gets a
    dampened share (HRR_RUN_SHARE) of the run-environment factor.
    """
    return 1 + (run_park_factor(team_abbr) - 1) * HRR_RUN_SHARE


def run_factors_stale(today_iso: str, max_days: int = 400) -> bool:
    """Return True if RUN_FACTORS_LAST_PULLED is more than max_days before today_iso.

    Pure function — caller passes today (no clock calls inside).
    """
    from datetime import date
    pulled = date.fromisoformat(RUN_FACTORS_LAST_PULLED)
    today = date.fromisoformat(today_iso)
    return (today - pulled).days > max_days
