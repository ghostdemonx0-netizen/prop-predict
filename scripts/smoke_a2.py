"""Real-data sanity for A2 pitch-level metrics. Prints SwStr/CSW/Ball/ISO/xwOBA
for a hitter + a pitcher, and a ZoneFit for the matchup.
Run: .venv/bin/python scripts/smoke_a2.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model import fetch, profiles
from model.pitch_metrics import zone_fit

SEASON = 2024
h = profiles.batter_profile_from_events(fetch.batter_events(592450, SEASON),
        as_of=f"{SEASON}-10-01", player_id=592450, name="Aaron Judge")
p = profiles.pitcher_profile_from_events(fetch.pitcher_events(605400, SEASON),
        as_of=f"{SEASON}-10-01", player_id=605400, name="Aaron Nola")
print("Judge:  SwStr%={:.1f} CSW%={:.1f} Ball%={:.1f} ISO={:.3f} xwOBA={:.3f}".format(
    h["swstr"]*100, h["csw"]*100, h["ball"]*100, h["iso"], h["xwoba"]))
print("Nola:   SwStr%={:.1f} CSW%={:.1f} Ball%={:.1f} xwOBA-allowed={:.3f}".format(
    p["swstr"]*100, p["csw"]*100, p["ball"]*100, p["xwoba_allowed"]))
print("ZoneFit Judge vs Nola:", zone_fit(h["zone_dmg"], p["zone_freq"]))
