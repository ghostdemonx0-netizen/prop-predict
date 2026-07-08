# tests/test_barrel_pull_fix.py
"""TDD tests for Fix 2: align pulled_barrel_rate to the Statcast/Barrel-Lab
standard (any ball to the pull half of the field counts as pulled — no ±15°
center exclusion zone).

Root cause established by real-data investigation (2026-07-08):
  - Our formula and plate origin (125.42, 198.27) are CORRECT.
  - Missing hc_x/hc_y is negligible (<1% of barrels, already returns False).
  - The gap is caused by _CENTER_HALF = 15.0: barrels with spray_angle in the
    (-15°, 0°) range for RHB were classified as "center" and NOT counted as
    pulled.  Barrel Lab uses threshold = 0° (any negative angle = pull for RHB).

Before/after real-data check (2026 partial season):
  Player       Before (±15°)  After (±0°)  Barrel-Lab ref
  Okamoto          5.63%         7.98%          8.4%
  Vlad             2.48%         3.90%          3.9%  ← exact match
  Judge           8.90%        14.38%          (pull hitter; direction confirmed)

These tests pin the CORRECTED behavior (written before the fix — strict TDD).
"""
import math

from model.barrel import is_barrel, is_pulled_barrel, barrel_metrics
from model.spray import spray_angle, _PLATE_X, _PLATE_Y


# ---------------------------------------------------------------------------
# Shared helper (mirrors _bb from test_barrel.py, self-contained here)
# ---------------------------------------------------------------------------

def _bb(date, events, *, ls=90.0, la=15.0, lsa=5, bb="line_drive",
        hx=None, hy=None, stand="R", xw=0.35):
    return {
        "game_date": date, "events": events, "launch_speed": ls,
        "launch_angle": la, "launch_speed_angle": lsa, "bb_type": bb,
        "hc_x": hx, "hc_y": hy, "stand": stand,
        "estimated_woba_using_speedangle": xw,
    }


# ---------------------------------------------------------------------------
# Geometry verification — plate origin and angle math
# ---------------------------------------------------------------------------

def test_plate_origin_matches_savant_standard():
    """Home plate coordinates in spray.py must match the Statcast standard."""
    assert _PLATE_X == 125.42
    assert _PLATE_Y == 198.27


def test_spray_angle_zero_at_center_field():
    """A ball hit straight to CF (hc_x == plate_x) has spray_angle ≈ 0°."""
    angle = spray_angle(_PLATE_X, 50.0)   # directly above home plate → CF
    assert abs(angle) < 0.01


def test_spray_angle_negative_toward_lf():
    """hc_x < plate_x (toward LF) must give a negative spray angle."""
    assert spray_angle(50.0, 100.0) < 0   # well left of center → negative


def test_spray_angle_positive_toward_rf():
    """hc_x > plate_x (toward RF) must give a positive spray angle."""
    assert spray_angle(200.0, 100.0) > 0  # well right of center → positive


# ---------------------------------------------------------------------------
# Core behaviour change: near-center pull barrels now count
# ---------------------------------------------------------------------------

def test_near_center_rhb_pull_barrel_now_counted():
    """RHB barrel with spray_angle just inside the pull half (e.g. -3°)
    must NOW count as pulled (was previously excluded by the ±15° center zone).

    hc_x = 119.0, hc_y = 100.0 → angle ≈ -3.7° (pull half, barely left of CF).
    """
    row = _bb("2026-04-01", "home_run", lsa=6, hx=119.0, hy=100.0, stand="R", bb="fly_ball")
    angle = spray_angle(119.0, 100.0)
    assert angle < 0, f"fixture: expect negative angle, got {angle:.2f}°"
    assert abs(angle) < 15.0, f"fixture: expect angle inside old center zone, got {angle:.2f}°"

    # With the corrected threshold (0°), this barrel IS pulled
    assert is_pulled_barrel(row) is True


def test_near_center_lhb_pull_barrel_now_counted():
    """LHB barrel with spray_angle just inside the pull half (slightly positive)
    must NOW count as pulled.

    LHB pulls to RF (positive angle). hc_x = 132.0 → angle ≈ +3.7°.
    """
    row = _bb("2026-04-01", "home_run", lsa=6, hx=132.0, hy=100.0, stand="L", bb="fly_ball")
    angle = spray_angle(132.0, 100.0)
    assert angle > 0, f"fixture: expect positive angle for LHB pull, got {angle:.2f}°"
    assert angle < 15.0, f"fixture: expect inside old center zone, got {angle:.2f}°"

    assert is_pulled_barrel(row) is True


def test_exactly_at_center_not_counted_as_pull():
    """A barrel hit straight to CF (angle = 0°) is NOT pulled for either hand."""
    # hc_x exactly at plate_x → angle = 0°
    row_r = _bb("2026-04-01", "home_run", lsa=6, hx=_PLATE_X, hy=50.0, stand="R", bb="fly_ball")
    row_l = _bb("2026-04-01", "home_run", lsa=6, hx=_PLATE_X, hy=50.0, stand="L", bb="fly_ball")
    assert is_pulled_barrel(row_r) is False, "Straight-CF barrel not pulled for RHB"
    assert is_pulled_barrel(row_l) is False, "Straight-CF barrel not pulled for LHB"


# ---------------------------------------------------------------------------
# Existing good-case behaviour must be preserved
# ---------------------------------------------------------------------------

def test_clear_pull_barrel_still_counted_rhb():
    """RHB barrel well to the left (angle ≈ -25°) still counted as pulled."""
    assert is_pulled_barrel(
        _bb("2026-04-01", "home_run", lsa=6, hx=80.0, hy=100.0, stand="R", bb="fly_ball")
    ) is True


def test_clear_oppo_barrel_not_counted_rhb():
    """RHB barrel to RF (angle > 0) still not counted as pulled."""
    assert is_pulled_barrel(
        _bb("2026-04-01", "home_run", lsa=6, hx=170.0, hy=100.0, stand="R", bb="fly_ball")
    ) is False


def test_non_barrel_never_pulled():
    """is_pulled_barrel returns False regardless of coordinates if not a barrel."""
    assert is_pulled_barrel(
        _bb("2026-04-01", "home_run", lsa=5, hx=80.0, hy=100.0, stand="R")
    ) is False


# ---------------------------------------------------------------------------
# Missing-coordinate handling
# ---------------------------------------------------------------------------

def test_missing_hc_x_returns_false():
    """Barrel with missing hc_x → False (excluded from pull count, stays in BBE denom)."""
    row = _bb("2026-04-01", "home_run", lsa=6, hx=None, hy=100.0, stand="R")
    assert is_pulled_barrel(row) is False


def test_missing_hc_y_returns_false():
    """Barrel with missing hc_y → False."""
    row = _bb("2026-04-01", "home_run", lsa=6, hx=80.0, hy=None, stand="R")
    assert is_pulled_barrel(row) is False


def test_missing_stand_returns_false():
    """Barrel with missing stand → False (can't determine pull side)."""
    row = _bb("2026-04-01", "home_run", lsa=6, hx=80.0, hy=100.0, stand=None)
    assert is_pulled_barrel(row) is False


# ---------------------------------------------------------------------------
# barrel_metrics pulled_barrel_rate — pinned corrected value
# ---------------------------------------------------------------------------

def test_pulled_barrel_rate_includes_near_center_pull():
    """pulled_barrel_rate must include barrels just inside the pull half.

    Fixture: one barrel at angle ≈ -3.7° (hx=119, hy=100, RHB).
    - Before fix: counted as "center" → rate = 0
    - After fix: counted as "pulled"  → rate = 1/1 = 1.0
    """
    evs = [_bb("2026-04-01", "home_run", lsa=6, bb="fly_ball",
                hx=119.0, hy=100.0, stand="R")]
    m = barrel_metrics(evs, as_of="2026-06-01")
    assert m["pulled_barrel_rate"] == 1.0, (
        "barrel at spray_angle ≈ -3.7° (just inside pull half) must be counted as pulled"
    )
    # barrel_rate unchanged
    assert m["barrel_rate"] == 1.0


def test_pulled_barrel_rate_two_barrels_one_near_center():
    """Two barrels: one clearly pull, one near-center pull.
    Both now count as pulled → rate = 2/2 = 1.0."""
    evs = [
        # Clearly pull (angle ≈ -25°)
        _bb("2026-04-01", "home_run", lsa=6, bb="fly_ball", hx=80.0, hy=100.0, stand="R"),
        # Near-center pull (angle ≈ -3.7°)
        _bb("2026-04-01", "home_run", lsa=6, bb="fly_ball", hx=119.0, hy=100.0, stand="R"),
    ]
    m = barrel_metrics(evs, as_of="2026-06-01")
    assert m["pulled_barrel_rate"] == 1.0  # both pulled
    assert m["barrel_rate"] == 1.0


def test_pulled_barrel_rate_oppo_barrel_not_counted():
    """An oppo-field barrel (RHB to RF, angle > 0) must NOT be counted as pulled."""
    evs = [_bb("2026-04-01", "home_run", lsa=6, bb="fly_ball", hx=170.0, hy=100.0, stand="R")]
    m = barrel_metrics(evs, as_of="2026-06-01")
    assert m["pulled_barrel_rate"] == 0.0


def test_pulled_barrel_rate_mixed_pull_oppo():
    """1 pull barrel + 1 oppo barrel → pulled_barrel_rate = 0.5."""
    evs = [
        _bb("2026-04-01", "home_run", lsa=6, bb="fly_ball", hx=80.0, hy=100.0, stand="R"),   # pull
        _bb("2026-04-01", "home_run", lsa=6, bb="fly_ball", hx=170.0, hy=100.0, stand="R"),  # oppo
    ]
    m = barrel_metrics(evs, as_of="2026-06-01")
    assert math.isclose(m["pulled_barrel_rate"], 0.5)
