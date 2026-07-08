"""Real-data before/after for pitcher barrel-blend across K/Hit/HR rates.

OLD approach: plain league-regression (K/Hit R=200, HR raw rate).
NEW approach: barrel_blended_rate — regresses toward the pitcher's own
barrel-implied rate instead of league average (votes: K=175, Hit=350, HR=700).

Run: .venv/bin/python scripts/smoke_pitcher_engine.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model import fetch, profiles
from model.blend import regress
from model.matchup import LEAGUE_K, LEAGUE_HIT
from model.projections import LEAGUE_HR_RATE
from model.pitcher_engine import _LG_SWSTR, _LG_HARDHIT, _LG_BARREL, _VOTES_K, _VOTES_HIT, _VOTES_HR

SEASON = 2024
AS_OF = f"{SEASON}-10-01"

# --- pitcher roster ---------------------------------------------------
# Ace/high-whiff: Tarik Skubal (Tigers, Cy Young 2024)
# Homer-prone:    Aaron Nola (Phillies, gave up 23 HR in 2024)
# Thin-sample:    Ryan Helsley (Cardinals closer — reliever = naturally thin BF)
PITCHERS = [
    ("Tarik Skubal (ace/high-whiff)", 669373),
    ("Aaron Nola (homer-prone)",      605400),
    ("Ryan Helsley (thin-sample reliever)", 622072),
]

_K_EVENTS   = ("strikeout", "strikeout_double_play")
_HIT_EVENTS = ("single", "double", "triple", "home_run")


def _raw_counts(events: list[dict]) -> tuple[int, int, int]:
    """(ks, hits, hr) strictly before AS_OF from raw event rows."""
    pa_rows = [e for e in events if e["game_date"] < AS_OF and e["events"]]
    ks   = sum(1 for e in pa_rows if e["events"] in _K_EVENTS)
    hits = sum(1 for e in pa_rows if e["events"] in _HIT_EVENTS)
    hr   = sum(1 for e in pa_rows if e["events"] == "home_run")
    return ks, hits, hr


def old_k(ks: int, bf: int) -> float:
    """OLD: plain league-regression, R=200."""
    return regress(ks, bf, LEAGUE_K, 200)


def old_hit(hits: int, bf: int) -> float:
    """OLD: plain league-regression, R=200."""
    return regress(hits, bf, LEAGUE_HIT, 200)


def old_hr(hr: int, bf: int) -> float:
    """OLD: raw rate (no regression — HR was the most exposed rate)."""
    return (hr / bf) if bf > 0 else LEAGUE_HR_RATE


# ======================================================================
print("=" * 72)
print("PITCHER ENGINE SMOKE  — Before (plain-regress) vs After (barrel-blend)")
print(f"Season {SEASON}  |  as-of {AS_OF}")
print("=" * 72)
print(f"OLD:  K  = regress(ks, bf, LG_K=0.225, R=200)")
print(f"      Hit = regress(hits, bf, LG_Hit=0.220, R=200)")
print(f"      HR  = raw  hr/bf  (no regression)")
print(f"NEW:  barrel_blended_rate(made, pa, signal, lg_rate, lg_signal, votes)")
print(f"      votes  → K={_VOTES_K:.0f}  Hit={_VOTES_HIT:.0f}  HR={_VOTES_HR:.0f}")
print(f"      signals→ swstr(LG={_LG_SWSTR})  hardhit(LG={_LG_HARDHIT})  barrel(LG={_LG_BARREL})")
print()

for name, pid in PITCHERS:
    print(f"{'─' * 72}")
    print(f"  ► {name}  (MLB id={pid})")
    print(f"{'─' * 72}")

    try:
        events = fetch.pitcher_events(pid, SEASON)
    except Exception as exc:
        print(f"  [FETCH ERROR: {exc}]  skipping.")
        continue

    try:
        p = profiles.pitcher_profile_from_events(
            events, as_of=AS_OF, player_id=pid, name=name
        )
    except Exception as exc:
        print(f"  [PROFILE ERROR: {exc}]  skipping.")
        continue

    bf = p["bf"]
    ks, hits, hr = _raw_counts(events)

    # barrel signals stored in the profile (via **bm, **pr in pitcher_profile_from_events)
    swstr   = p.get("swstr")           # swinging-strike rate  -> K signal
    hardhit = p.get("hardhit_rate_allowed")   # hard-hit-allowed rate -> Hit signal
    barrel  = p.get("barrel_rate_allowed")    # barrel-allowed rate   -> HR signal

    print(f"  bf={bf}  |  ks={ks} ({ks/bf*100:.1f}%)  hits={hits} ({hits/bf*100:.1f}%)  hr={hr} ({hr/bf*100:.2f}%)")
    if swstr is not None:
        print(f"  signals: swstr={swstr:.3f} (LG {_LG_SWSTR}) "
              f" hardhit={hardhit:.3f} (LG {_LG_HARDHIT})"
              f" barrel={barrel:.3f} (LG {_LG_BARREL})")
    print()

    rows = [
        ("K/bf",   old_k(ks, bf),   p["k_per_bf"],        LEAGUE_K,       "swstr"),
        ("Hit/bf", old_hit(hits, bf), p["hit_allowed_rate"], LEAGUE_HIT,    "hardhit"),
        ("HR/bf",  old_hr(hr, bf),  p["hr_allowed_rate"], LEAGUE_HR_RATE, "barrel"),
    ]

    print(f"  {'Rate':<8}  {'OLD':>8}  {'NEW':>8}  {'DELTA':>8}  vs LG    signal")
    print(f"  {'─'*8}  {'─'*8}  {'─'*8}  {'─'*8}  ──────   ──────")
    for rate_name, old_val, new_val, lg, sig_name in rows:
        delta = new_val - old_val
        arrow = "↑" if delta > 0.0001 else ("↓" if delta < -0.0001 else "≈")
        print(f"  {rate_name:<8}  {old_val:>8.4f}  {new_val:>8.4f}  {delta:>+8.4f}  {lg:.3f}    {sig_name} {arrow}")
    print()

print("=" * 72)
print("ASSESSMENT NOTES")
print("  • Deep-sample ace    → OLD≈NEW (high bf, raw rate already trusted)")
print("  • Homer-prone arm    → HR/bf NEW > OLD (barrel signal pulls rate up)")
print("  • Thin-sample reliever → all rates pulled toward signal (less league-avg anchor)")
print("=" * 72)
