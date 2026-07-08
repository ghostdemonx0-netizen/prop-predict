"""Real-data smoke for the Oracle qualifier.
Checks flag rate + who qualifies across a spread of real 2024 hitters
(elite power, mid bats, contact bats) vs two pitchers (barrel-vulnerable
and stingy). Run: .venv/bin/python scripts/smoke_oracle.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model import fetch, profiles
from model.barrel_effect import barrel_effect_mult
from model.matchup import hr_platoon_mult
from model.oracle import oracle

SEASON = 2024
AS_OF = f"{SEASON}-10-01"

# Mix: elite power, mid bats, contact bats
HITTER_IDS = {
    # --- elite power ---
    "Aaron Judge":    592450,
    "Shohei Ohtani":  660271,
    "Yordan Alvarez": 670541,
    "Kyle Schwarber": 656941,
    # --- mid bats ---
    "Pete Alonso":    624413,
    "Austin Riley":   663586,
    "Rafael Devers":  646240,
    # --- contact / table-setters ---
    "Luis Arraez":    650333,
    "Steven Kwan":    680757,
    "Joey Gallo":     608336,
}

# One barrel-vulnerable, one stingy
PITCHER_IDS = {
    "Aaron Nola":    605400,   # HR-prone, barrels up
    "Tarik Skubal":  669373,   # stingy, misses bats
}

all_ids = list(HITTER_IDS.values()) + list(PITCHER_IDS.values())
print("Fetching player metadata (bats/throws) …")
meta = fetch.get_player_meta(all_ids)

print("Building pitcher profiles …")
pprof: dict[str, dict] = {}
for pname, pid in PITCHER_IDS.items():
    throws = meta.get(pid, {}).get("throws", "R")
    pprof[pname] = profiles.pitcher_profile_from_events(
        fetch.pitcher_events(pid, SEASON),
        as_of=AS_OF, player_id=pid, name=pname, throws=throws,
    )
    print(f"  ✓ {pname:<16} throws={pprof[pname].get('throws','?')}")

print("\nBuilding hitter profiles …")
hprof: dict[str, dict] = {}
for hname, pid in HITTER_IDS.items():
    bats = meta.get(pid, {}).get("bats", "R")
    hprof[hname] = profiles.batter_profile_from_events(
        fetch.batter_events(pid, SEASON),
        as_of=AS_OF, player_id=pid, name=hname, bats=bats,
    )
    h = hprof[hname]
    print(f"  ✓ {hname:<16} bats={h.get('bats','?')}  bbe={h.get('bbe',0):.0f}  "
          f"barrel={h.get('barrel_rate',0):.3f}  hardhit={h.get('hardhit_rate',0):.3f}")

# ── Print results table ────────────────────────────────────────────────────────
HD = f"{'HITTER':<18} {'PITCHER':<16} {'bmult':>6} {'pmult':>6} {'score':>6} {'flag':>5}"
SEP = "-" * len(HD)

print(f"\n{HD}")
print(SEP)

flagged = 0
total = 0
rows: list[dict] = []

for hname, h in hprof.items():
    for pname, p in pprof.items():
        barrel_mult = barrel_effect_mult(h, p, prop="hr")
        platoon_mult = hr_platoon_mult(h.get("bats", "R"), p.get("throws", "R"))
        result = oracle(h, barrel_mult=barrel_mult, platoon_mult=platoon_mult)

        flag_str = "✓" if result["oracle"] else "✗"
        if result["oracle"]:
            flagged += 1
        total += 1

        rows.append({
            "hitter": hname, "pitcher": pname,
            "bmult": barrel_mult, "pmult": platoon_mult,
            "score": result["oracle_score"], "flag": result["oracle"],
        })
        print(f"{hname:<18} {pname:<16} {barrel_mult:>6.3f} {platoon_mult:>6.2f} "
              f"{result['oracle_score']:>6.3f} {flag_str:>5}")

print(SEP)
flag_rate = flagged / total if total else 0.0
print(f"\nFLAG RATE: {flagged}/{total} pairings = {flag_rate:.1%}")

# ── Summary: who flagged ───────────────────────────────────────────────────────
flagged_rows = [r for r in rows if r["flag"]]
if flagged_rows:
    print("\nFlagged pairings:")
    for r in flagged_rows:
        print(f"  {r['hitter']:<18} vs {r['pitcher']:<16}  score={r['score']:.3f}")
else:
    print("\nNo pairings flagged (flag bar may be too high for this sample).")
