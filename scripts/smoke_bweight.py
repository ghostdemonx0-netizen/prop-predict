"""Real-data Normal-vs-BarrelWeight smoke for HR (and Hits) across elite/contact/weak
barrel bats vs barrel-vulnerable and stingy pitchers. For user sign-off.
Run: .venv/bin/python scripts/smoke_bweight.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model import fetch, profiles
from model.barrel_effect import barrel_effect_mult
from model.projections import hr_probability

SEASON = 2024
AS_OF   = f"{SEASON}-10-01"
EXPECTED_PA = 4.0
BWEIGHT_CAP = 0.60   # the task-6 barrel-weight cap

# ---- batters -----------------------------------------------------------
BATTERS = {
    "Judge (elite-barrel)":    592450,  # Aaron Judge
    "Ohtani (elite-barrel #2)": 660271, # Shohei Ohtani
    "Arraez (contact)":         650333, # Luis Arraez
    "Gallo (weak-barrel/whiff)":608336, # Joey Gallo
}

# ---- pitchers -----------------------------------------------------------
PITCHERS = {
    "Nola (barrel-vulnerable)":  605400,  # Aaron Nola
    "Skubal (stingy)":           669373,  # Tarik Skubal
}

# ---- fetch + build batter profiles ------------------------------------
print("Fetching batter events …")
batter_profiles = {}
for name, pid in BATTERS.items():
    try:
        evts = fetch.batter_events(pid, SEASON)
        prof = profiles.batter_profile_from_events(evts, as_of=AS_OF, player_id=pid, name=name)
        batter_profiles[name] = prof
        print(f"  ✓ {name}  HR={prof['season_hr']}  PA={prof['season_pa']}")
    except Exception as exc:
        print(f"  ✗ {name} FAILED: {exc}")

# ---- fetch + build pitcher profiles -----------------------------------
print("\nFetching pitcher events …")
pitcher_profiles = {}
for name, pid in PITCHERS.items():
    try:
        evts = fetch.pitcher_events(pid, SEASON)
        prof = profiles.pitcher_profile_from_events(evts, as_of=AS_OF, player_id=pid, name=name)
        pitcher_profiles[name] = prof
        print(f"  ✓ {name}")
    except Exception as exc:
        print(f"  ✗ {name} FAILED: {exc}")

# ---- HR smoke table ---------------------------------------------------
print()
print("=" * 78)
print("SMOKE: Normal base HR prob  vs  Barrel-Weight HR prob  (cap=0.60)")
print("=" * 78)
print(f"{'Batter':<28} {'Pitcher':<26} {'Base HR%':>8} {'Mult':>6} {'BWt HR%':>8}  {'Δ':>6}")
print("-" * 78)

for b_name, b_prof in batter_profiles.items():
    hr   = b_prof.get("season_hr", 0)
    pa   = b_prof.get("season_pa", 0)
    base = hr_probability(hr, pa, expected_pa=EXPECTED_PA)   # neutral — all mults 1.0

    for p_name, p_prof in pitcher_profiles.items():
        mult  = barrel_effect_mult(b_prof, p_prof, prop="hr", cap=BWEIGHT_CAP)
        bw    = max(0.0, min(base * mult, 1.0))
        delta = bw - base
        print(f"  {b_name:<26} {p_name:<26} {base*100:>7.2f}%  {mult:>5.3f}  {bw*100:>7.2f}%  {delta*100:>+6.2f}%")

# ---- Hits smoke (optional bonus) --------------------------------------
print()
print("=" * 78)
print("BONUS: Barrel-Weight mult for Hits  (cap=0.60)")
print("=" * 78)
print(f"{'Batter':<28} {'Pitcher':<26} {'Hits mult':>10}")
print("-" * 78)
for b_name, b_prof in batter_profiles.items():
    for p_name, p_prof in pitcher_profiles.items():
        m = barrel_effect_mult(b_prof, p_prof, prop="hits", cap=BWEIGHT_CAP)
        print(f"  {b_name:<26} {p_name:<26} {m:>10.3f}")

print()
print("Done.")
