from model.prop_score import prop_score

# Every hitter stat at its anchor HIGH -> hitter index = 1.0
_STRONG = {"pulled_barrel_rate": 0.12, "barrel_rate": 0.20, "hardhit_rate": 0.55,
           "sweetspot_rate": 0.45, "fb_rate": 0.45, "xwobacon": 0.46}
# Every hitter stat at its anchor LOW -> hitter index = 0.0
_WEAK = {"pulled_barrel_rate": 0.01, "barrel_rate": 0.03, "hardhit_rate": 0.25,
         "sweetspot_rate": 0.25, "fb_rate": 0.18, "xwobacon": 0.26}
# Pitcher allowed at anchor HIGH -> most barrel-friendly (index 1.0)
_VULN_P = {"pulled_barrel_rate_allowed": 0.08, "barrel_rate_allowed": 0.12,
           "hardhit_rate_allowed": 0.52, "fb_rate_allowed": 0.45}
# Pitcher allowed at anchor LOW -> barrel-stingy (index 0.0)
_STINGY_P = {"pulled_barrel_rate_allowed": 0.03, "barrel_rate_allowed": 0.04,
             "hardhit_rate_allowed": 0.35, "fb_rate_allowed": 0.18}
_MID_H = {"pulled_barrel_rate": 0.06, "barrel_rate": 0.10, "hardhit_rate": 0.40,
          "sweetspot_rate": 0.35, "fb_rate": 0.30, "xwobacon": 0.36}
_MID_P = {"pulled_barrel_rate_allowed": 0.05, "barrel_rate_allowed": 0.08,
          "hardhit_rate_allowed": 0.43, "fb_rate_allowed": 0.30}


def test_max_inputs_score_100():
    assert prop_score(_STRONG, _VULN_P, platoon_mult=1.0) == 100.0


def test_min_inputs_score_0():
    assert prop_score(_WEAK, _STINGY_P, platoon_mult=1.0) == 0.0


def test_barrel_friendly_pitcher_scores_higher_than_stingy():
    assert prop_score(_STRONG, _VULN_P) > prop_score(_STRONG, _STINGY_P)


def test_strong_hitter_beats_weak_hitter_same_pitcher():
    assert prop_score(_STRONG, _MID_P) > prop_score(_WEAK, _MID_P)


def test_platoon_advantage_bumps_score():
    adv = prop_score(_MID_H, _MID_P, platoon_mult=1.06)
    neu = prop_score(_MID_H, _MID_P, platoon_mult=1.0)
    dis = prop_score(_MID_H, _MID_P, platoon_mult=0.95)
    assert adv > neu > dis


def test_split_booster_is_clamped():
    # platoon_mult beyond the clamp is capped, so 1.50 == 1.06.
    assert prop_score(_MID_H, _MID_P, platoon_mult=1.50) == prop_score(_MID_H, _MID_P, platoon_mult=1.06)


def test_missing_fields_degrade_to_low_no_crash():
    assert prop_score({}, {}, platoon_mult=1.0) == 0.0


def test_output_always_0_to_100():
    for pm in (0.5, 1.0, 2.0):
        s = prop_score(_STRONG, _VULN_P, platoon_mult=pm)
        assert 0.0 <= s <= 100.0
