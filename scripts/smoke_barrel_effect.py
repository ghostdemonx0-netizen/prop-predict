"""Real-data before/after for the HR b effect nudge — prints the barrel multiplier
for real matchups so a human can sign off on the ±20% cap.
Run: .venv/bin/python scripts/smoke_barrel_effect.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model import fetch, profiles
from model.barrel_effect import barrel_effect_mult

SEASON = 2024
HITTERS = {"Aaron Judge": 592450, "Luis Arraez": 650333}
PITCHERS = {"Aaron Nola (HR-prone)": 605400, "Tarik Skubal (stingy)": 669373}

hp = {n: profiles.batter_profile_from_events(fetch.batter_events(p, SEASON),
        as_of=f"{SEASON}-10-01", player_id=p, name=n) for n, p in HITTERS.items()}
pp = {n: profiles.pitcher_profile_from_events(fetch.pitcher_events(p, SEASON),
        as_of=f"{SEASON}-10-01", player_id=p, name=n) for n, p in PITCHERS.items()}

print(f"{'HITTER':<14}{'PITCHER':<26}{'barrel_mult':>12}{'moves a 10% HR to':>20}")
for hn, h in hp.items():
    for pn, p in pp.items():
        m = barrel_effect_mult(h, p)
        print(f"{hn:<14}{pn:<26}{round(m,3):>12}{round(0.10*m*100,1):>18}%")
