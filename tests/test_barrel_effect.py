from model.barrel_effect import barrel_effect_mult

_STRONG = {"pulled_barrel_rate": 0.12, "barrel_rate": 0.20, "hardhit_rate": 0.55,
           "sweetspot_rate": 0.45, "fb_rate": 0.45, "xwobacon": 0.46, "bbe": 300}
_WEAK = {"pulled_barrel_rate": 0.01, "barrel_rate": 0.03, "hardhit_rate": 0.25,
         "sweetspot_rate": 0.25, "fb_rate": 0.18, "xwobacon": 0.26, "bbe": 300}
_VULN_P = {"pulled_barrel_rate_allowed": 0.08, "barrel_rate_allowed": 0.12,
           "hardhit_rate_allowed": 0.52, "fb_rate_allowed": 0.45}
_STINGY_P = {"pulled_barrel_rate_allowed": 0.03, "barrel_rate_allowed": 0.04,
             "hardhit_rate_allowed": 0.35, "fb_rate_allowed": 0.18}


def test_strong_vs_vulnerable_pushes_up_to_cap():
    assert barrel_effect_mult(_STRONG, _VULN_P) == 1.20   # both maxed -> full +cap


def test_weak_vs_stingy_pushes_down_to_cap():
    assert barrel_effect_mult(_WEAK, _STINGY_P) == 0.80    # both min -> full -cap


def test_neutral_matchup_near_one():
    mid_h = {"pulled_barrel_rate": 0.065, "barrel_rate": 0.115, "hardhit_rate": 0.40,
             "sweetspot_rate": 0.35, "fb_rate": 0.315, "xwobacon": 0.36, "bbe": 300}
    mid_p = {"pulled_barrel_rate_allowed": 0.055, "barrel_rate_allowed": 0.08,
             "hardhit_rate_allowed": 0.435, "fb_rate_allowed": 0.315}
    assert abs(barrel_effect_mult(mid_h, mid_p) - 1.0) < 0.02


def test_thin_sample_shrinks_toward_one():
    thin = dict(_STRONG); thin["bbe"] = 4     # 4/40 = 0.1 trust
    full = barrel_effect_mult(_STRONG, _VULN_P) - 1.0     # +0.20
    small = barrel_effect_mult(thin, _VULN_P) - 1.0
    assert 0 < small < full and abs(small - full * 0.1) < 1e-9


def test_no_data_is_neutral():
    assert barrel_effect_mult({}, None) == 1.0


def test_output_in_cap_band():
    assert 0.80 <= barrel_effect_mult(_STRONG, _VULN_P) <= 1.20
