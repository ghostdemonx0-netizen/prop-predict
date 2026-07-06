"""Real-data sanity check for the b-weight Prop Score. Not a unit test —
prints scores for real matchups so a human can eyeball them for sign-off.
Run: .venv/bin/python scripts/smoke_prop_score.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model import fetch, profiles
from model.prop_score import prop_score

SEASON = 2024
HITTERS = {"Aaron Judge": 592450, "Luis Arraez": 650333}   # elite power vs contact-only
PITCHERS = {"Aaron Nola": 605400, "Tarik Skubal": 669373}  # HR-prone vs stingy

hprof = {n: profiles.batter_profile_from_events(
            fetch.batter_events(pid, SEASON), as_of=f"{SEASON}-10-01", player_id=pid, name=n)
         for n, pid in HITTERS.items()}
pprof = {n: profiles.pitcher_profile_from_events(
            fetch.pitcher_events(pid, SEASON), as_of=f"{SEASON}-10-01", player_id=pid, name=n)
         for n, pid in PITCHERS.items()}

print(f"{'HITTER':<14}{'PITCHER':<16}{'neutral':>9}{'adv(1.06)':>11}{'disadv(.95)':>13}")
for hn, hp in hprof.items():
    for pn, pp in pprof.items():
        neu = prop_score(hp, pp, platoon_mult=1.0)
        adv = prop_score(hp, pp, platoon_mult=1.06)
        dis = prop_score(hp, pp, platoon_mult=0.95)
        print(f"{hn:<14}{pn:<16}{neu:>9}{adv:>11}{dis:>13}")
