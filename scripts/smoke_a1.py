"""Real-data before/after for A1 barrel effect across all 6 batter props.
Run: .venv/bin/python scripts/smoke_a1.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model import fetch, profiles
from model.barrel_effect import barrel_effect_mult

SEASON = 2024
PROPS = ["hr", "tb", "hits", "runs", "rbi", "hrr"]
BATTERS = {"Aaron Judge (power)": 592450, "Luis Arraez (contact)": 650333,
           "Joey Gallo (barrel+whiff)": 608336}
PID_NOLA = 605400
p = profiles.pitcher_profile_from_events(fetch.pitcher_events(PID_NOLA, SEASON),
        as_of=f"{SEASON}-10-01", player_id=PID_NOLA, name="Aaron Nola")
for name, pid in BATTERS.items():
    h = profiles.batter_profile_from_events(fetch.batter_events(pid, SEASON),
            as_of=f"{SEASON}-10-01", player_id=pid, name=name)
    print(f"\n{name} vs Nola:")
    for prop in PROPS:
        m = barrel_effect_mult(h, p, prop=prop)
        print(f"  {prop:5s} mult={m:.3f}  (a 20% prob -> {20*m:.1f}%)")
