# tests/test_blended_pooled.py
"""TDD tests for Fix 1: blended profiles must recompute ISO/xwOBA/SwStr/ZoneFit
on the POOLED 3-season window, not freeze at current-season values.

These tests were written BEFORE the fix was implemented (strict TDD order).
Each assertion verifies the pooled-window value differs from the current-season
value — which proves the pooled recomputation is actually happening.
"""
from model.profiles import (
    batter_profile_from_events,
    blended_batter_profile,
    pitcher_profile_from_events,
    blended_pitcher_profile,
)


# ---------------------------------------------------------------------------
# Shared fixture helpers
# ---------------------------------------------------------------------------

def _pa(date, event, wv=0.0, wd=0):
    """Minimal PA-ending event (no BBE columns needed for ISO/xwOBA via woba_value path)."""
    return {
        "game_date": date, "events": event,
        "description": None, "bb_type": None,
        "launch_speed": None, "launch_angle": None, "launch_speed_angle": None,
        "hc_x": None, "hc_y": None, "stand": None,
        "estimated_woba_using_speedangle": None,
        "zone": None, "woba_value": wv, "woba_denom": wd,
    }


def _pitch_ev(date, desc):
    """Pitch-level row (not PA-ending) for SwStr/CSW metrics."""
    return {
        "game_date": date, "events": None, "description": desc,
        "bb_type": None, "launch_speed": None, "launch_angle": None,
        "launch_speed_angle": None, "hc_x": None, "hc_y": None, "stand": None,
        "estimated_woba_using_speedangle": None, "zone": None,
        "woba_value": 0.0, "woba_denom": 0,
    }


def _zone_pitch(date, zone, desc="ball"):
    """Pitch row with a zone value (for zone_freq / zone_dmg)."""
    return {
        "game_date": date, "events": None, "description": desc,
        "bb_type": None, "launch_speed": None, "launch_angle": None,
        "launch_speed_angle": None, "hc_x": None, "hc_y": None, "stand": None,
        "estimated_woba_using_speedangle": None, "zone": zone,
        "woba_value": 0.0, "woba_denom": 0,
    }


def _bbe(date, event, xw, wd=1, wv=None, zone=None):
    """Batted-ball event with estimated_woba for zone_dmg / xwOBA paths."""
    return {
        "game_date": date, "events": event, "description": None,
        "bb_type": "fly_ball", "launch_speed": 90.0, "launch_angle": 20.0,
        "launch_speed_angle": 5, "hc_x": None, "hc_y": None, "stand": None,
        "estimated_woba_using_speedangle": xw, "zone": zone,
        "woba_value": wv if wv is not None else xw, "woba_denom": wd,
    }


# ---------------------------------------------------------------------------
# Fix 1a: blended_batter_profile — pooled ISO
# ---------------------------------------------------------------------------

def test_blended_batter_recomputes_iso_on_pooled_events():
    """When current season has 0 ISO (all singles) but older seasons have HRs,
    the blended profile must reflect the POOLED ISO — not current-season 0."""
    current = [_pa("2026-04-01", "single", wv=0.9, wd=1)] * 100
    older = [_pa("2025-04-01", "home_run", wv=2.0, wd=1)] * 100

    current_prof = batter_profile_from_events(current, as_of="2026-06-17", player_id=1)
    assert current_prof["iso"] == 0.0, "fixture: current-season ISO should be 0 (all singles)"

    ebs = {2026: current, 2025: older, 2024: older}
    blended = blended_batter_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=1)

    # Pooled has HRs → iso must be > 0 and differ from current-only
    assert blended["iso"] > 0.0, "blended ISO must reflect the pooled 3-season window"
    assert blended["iso"] != current_prof["iso"]


# ---------------------------------------------------------------------------
# Fix 1b: blended_batter_profile — pooled xwOBA
# ---------------------------------------------------------------------------

def test_blended_batter_recomputes_xwoba_on_pooled_events():
    """Older seasons with high woba_value pull the blended xwoba above current-only."""
    current = [_pa("2026-04-01", "single", wv=0.5, wd=1)] * 100
    older = [_pa("2025-04-01", "home_run", wv=2.0, wd=1)] * 100

    current_prof = batter_profile_from_events(current, as_of="2026-06-17", player_id=1)
    assert abs(current_prof["xwoba"] - 0.5) < 1e-4, "fixture check"

    ebs = {2026: current, 2025: older, 2024: older}
    blended = blended_batter_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=1)

    # Pooled mixes 0.5 and 2.0 → blended xwoba should be between them, > current-only 0.5
    assert blended["xwoba"] > current_prof["xwoba"], (
        "blended xwoba must reflect pooled window (pulled up by older high-woba seasons)"
    )


# ---------------------------------------------------------------------------
# Fix 1c: blended_batter_profile — pooled SwStr
# ---------------------------------------------------------------------------

def test_blended_batter_recomputes_swstr_on_pooled_events():
    """Older seasons with 100% swinging-strike rate must lift the blended SwStr
    above the current-season 0% value."""
    current = [_pitch_ev("2026-04-01", "ball")] * 50          # swstr = 0
    older = [_pitch_ev("2025-04-01", "swinging_strike")] * 50  # swstr = 1.0

    current_prof = batter_profile_from_events(current, as_of="2026-06-17", player_id=1)
    assert current_prof["swstr"] == 0.0, "fixture: current-season swstr should be 0"

    ebs = {2026: current, 2025: older, 2024: older}
    blended = blended_batter_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=1)

    # Pooled: 50 balls + 100 swinging strikes = 100/150 swstr
    assert blended["swstr"] > 0.0, "blended swstr must reflect the pooled 3-season window"
    assert blended["swstr"] != current_prof["swstr"]


# ---------------------------------------------------------------------------
# Fix 1d: blended_batter_profile — pooled zone_dmg
# ---------------------------------------------------------------------------

def test_blended_batter_recomputes_zone_dmg_on_pooled_events():
    """Older seasons hitting in zone 5 should change zone_dmg[5] in the blended
    profile compared to the current-season-only profile."""
    # Current: BBE with xwoba=0.3 in zone 5
    current = [_bbe("2026-04-01", "single", xw=0.3, zone=5)] * 50
    # Older: BBE with xwoba=1.5 in zone 5
    older = [_bbe("2025-04-01", "home_run", xw=1.5, zone=5)] * 50

    current_prof = batter_profile_from_events(current, as_of="2026-06-17", player_id=1)

    ebs = {2026: current, 2025: older, 2024: older}
    blended = blended_batter_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=1)

    # Pooled zone_dmg[5] should be higher than current-only (pulled up by 1.5 xwoba older events)
    assert blended["zone_dmg"][5] > current_prof["zone_dmg"][5], (
        "blended zone_dmg must reflect pooled window, not just current-season events"
    )


# ---------------------------------------------------------------------------
# Fix 1e: blended_pitcher_profile — pooled SwStr
# ---------------------------------------------------------------------------

def test_blended_pitcher_recomputes_swstr_on_pooled_events():
    """Older seasons with 100% swinging-strike rate must lift the blended pitcher
    SwStr above the current-season 0% value."""
    current = [_pitch_ev("2026-04-01", "ball")] * 50           # swstr = 0
    older = [_pitch_ev("2025-04-01", "swinging_strike")] * 50  # swstr = 1.0

    current_prof = pitcher_profile_from_events(current, as_of="2026-06-17", player_id=9)
    assert current_prof["swstr"] == 0.0, "fixture check"

    ebs = {2026: current, 2025: older, 2024: older}
    blended = blended_pitcher_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=9)

    # Pooled: 50 balls + 100 swinging strikes → 100/150 swstr
    assert blended["swstr"] > 0.0, "blended pitcher swstr must reflect the pooled 3-season window"
    assert blended["swstr"] != current_prof["swstr"]


# ---------------------------------------------------------------------------
# Fix 1f: blended_pitcher_profile — pooled xwoba_allowed
# ---------------------------------------------------------------------------

def test_blended_pitcher_recomputes_xwoba_allowed_on_pooled_events():
    """Older seasons with high woba_value allowed pull the blended xwoba_allowed
    above the current-season-only value."""
    current = [_pa("2026-04-01", "single", wv=0.5, wd=1)] * 50
    older = [_pa("2025-04-01", "home_run", wv=2.0, wd=1)] * 50

    current_prof = pitcher_profile_from_events(current, as_of="2026-06-17", player_id=9)

    ebs = {2026: current, 2025: older, 2024: older}
    blended = blended_pitcher_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=9)

    # Pooled mixes 0.5 and 2.0 → blended xwoba_allowed should exceed current-only
    assert blended["xwoba_allowed"] > current_prof["xwoba_allowed"], (
        "blended pitcher xwoba_allowed must reflect pooled window"
    )


# ---------------------------------------------------------------------------
# Fix 1g: blended_pitcher_profile — pooled zone_freq
# ---------------------------------------------------------------------------

def test_blended_pitcher_recomputes_zone_freq_on_pooled_events():
    """Older seasons pitching to zone 1 must appear in the blended pitcher's
    zone_freq, which only had zone 5 in the current season."""
    current = [_zone_pitch("2026-04-01", zone=5)] * 50   # only zone 5
    older = [_zone_pitch("2025-04-01", zone=1)] * 50     # only zone 1

    current_prof = pitcher_profile_from_events(current, as_of="2026-06-17", player_id=9)
    assert current_prof["zone_freq"].get(1, 0.0) == 0.0, "fixture: zone 1 absent from current"
    assert current_prof["zone_freq"].get(5, 0.0) > 0.0, "fixture: zone 5 present in current"

    ebs = {2026: current, 2025: older, 2024: older}
    blended = blended_pitcher_profile(ebs, as_of="2026-06-17", current_season=2026, player_id=9)

    # After fix: zone_freq[1] should be > 0 (pooled has older-season zone-1 pitches)
    assert blended["zone_freq"].get(1, 0.0) > 0.0, (
        "blended pitcher zone_freq must reflect pooled window — zone 1 pitches from older seasons"
    )
    # And zone_freq[1] should differ from current-only
    assert blended["zone_freq"][1] != current_prof["zone_freq"].get(1, 0.0)
