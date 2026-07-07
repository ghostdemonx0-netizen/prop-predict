import math
import pytest
from model.barrel_effect import barrel_effect_mult, _RECIPES

_STRONG = {"pulled_barrel_rate": 0.12, "barrel_rate": 0.20, "hardhit_rate": 0.55,
           "sweetspot_rate": 0.45, "fb_rate": 0.45, "xwobacon": 0.46, "bbe": 300}
_WEAK = {"pulled_barrel_rate": 0.01, "barrel_rate": 0.03, "hardhit_rate": 0.25,
         "sweetspot_rate": 0.25, "fb_rate": 0.18, "xwobacon": 0.26, "bbe": 300}
_VULN_P = {"pulled_barrel_rate_allowed": 0.08, "barrel_rate_allowed": 0.12,
           "hardhit_rate_allowed": 0.52, "fb_rate_allowed": 0.45}
_STINGY_P = {"pulled_barrel_rate_allowed": 0.03, "barrel_rate_allowed": 0.04,
             "hardhit_rate_allowed": 0.35, "fb_rate_allowed": 0.18}


# ---- new prop-aware tests ----

def _hw(spec):
    # normalize entries to (key, ((lo,hi), weight)) format; invert status tracked separately in _INVERT
    return [(k, (v[0], v[1])) for k, v in spec.items()]


def test_every_recipe_side_sums_to_one():
    for prop, r in _RECIPES.items():
        hs = sum(w for _, (_, w) in _hw(r["hitter"]))
        ps = sum(w for _, (_, w) in r["pitcher"].items())
        assert math.isclose(hs, 1.0, abs_tol=1e-9), f"{prop} hitter {hs}"
        assert math.isclose(ps, 1.0, abs_tol=1e-9), f"{prop} pitcher {ps}"


def test_caps_are_graduated():
    assert _RECIPES["hr"]["cap"] == 0.20 and _RECIPES["rbi"]["cap"] == 0.20
    assert _RECIPES["hits"]["cap"] == 0.15 and _RECIPES["runs"]["cap"] == 0.15
    assert _RECIPES["tb"]["cap"] == 0.20 and _RECIPES["hrr"]["cap"] == 0.15


def test_swstr_inverted_low_whiff_helps_hits():
    strong = {"bbe": 300, "zone_dmg": {}, "swstr": 0.06,  # low whiff (good)
              "hardhit_rate": 0.55, "sweetspot_rate": 0.45, "xwobacon": 0.46, "barrel_rate": 0.20}
    whiffy = dict(strong); whiffy["swstr"] = 0.16          # high whiff (bad)
    assert barrel_effect_mult(strong, None, prop="hits") > barrel_effect_mult(whiffy, None, prop="hits")


def test_zonefit_matchup_moves_nudge():
    hitter = {"bbe": 300, "zone_dmg": {5: 0.9}, "swstr": 0.10, "hardhit_rate": 0.40,
              "sweetspot_rate": 0.35, "xwobacon": 0.36, "barrel_rate": 0.10}
    into_hot = {"zone_freq": {5: 1.0}}      # pitcher lives in the hitter's hot zone
    into_cold = {"zone_freq": {1: 1.0}}
    assert barrel_effect_mult(hitter, into_hot, prop="hits") > barrel_effect_mult(hitter, into_cold, prop="hits")


def test_clamps_to_prop_cap_and_neutral_no_data():
    maxed = {"bbe": 300, "zone_dmg": {}, "swstr": 0.06, "pulled_barrel_rate": 0.12,
             "barrel_rate": 0.20, "hardhit_rate": 0.55, "sweetspot_rate": 0.45,
             "fb_rate": 0.45, "xwobacon": 0.46}
    assert barrel_effect_mult(maxed, None, prop="hr") <= 1.20 + 1e-9
    assert abs(barrel_effect_mult({}, None, prop="hr") - 1.0) < 1e-9


def test_hr_reaches_cap_when_all_factors_maxed():
    full_h = {"bbe": 400, "pulled_barrel_rate": 0.12, "barrel_rate": 0.20,
              "hardhit_rate": 0.55, "sweetspot_rate": 0.45, "fb_rate": 0.45,
              "xwobacon": 0.46, "swstr": 0.06,          # low swstr = good
              "zone_dmg": {5: 1.0}}                      # all damage in zone 5
    full_p = {"pulled_barrel_rate_allowed": 0.08, "barrel_rate_allowed": 0.12,
              "hardhit_rate_allowed": 0.52, "fb_rate_allowed": 0.45,
              "zone_freq": {5: 1.0}}                     # pitcher lives in zone 5
    assert barrel_effect_mult(full_h, full_p, prop="hr") == pytest.approx(1.20)


# ---- still-valid legacy tests (recipe now includes ZoneFit+SwStr; exact caps dropped) ----

def test_neutral_matchup_near_one():
    mid_h = {"pulled_barrel_rate": 0.065, "barrel_rate": 0.115, "hardhit_rate": 0.40,
             "sweetspot_rate": 0.35, "fb_rate": 0.315, "xwobacon": 0.36, "bbe": 300}
    mid_p = {"pulled_barrel_rate_allowed": 0.055, "barrel_rate_allowed": 0.08,
             "hardhit_rate_allowed": 0.435, "fb_rate_allowed": 0.315}
    assert abs(barrel_effect_mult(mid_h, mid_p) - 1.0) < 0.02


def test_thin_sample_shrinks_toward_one():
    thin = dict(_STRONG); thin["bbe"] = 4     # 4/40 = 0.1 trust
    full = barrel_effect_mult(_STRONG, _VULN_P) - 1.0
    small = barrel_effect_mult(thin, _VULN_P) - 1.0
    assert 0 < small < full and abs(small - full * 0.1) < 1e-9


def test_no_data_is_neutral():
    assert barrel_effect_mult({}, None) == 1.0


def test_output_in_cap_band():
    assert 0.80 <= barrel_effect_mult(_STRONG, _VULN_P) <= 1.20
