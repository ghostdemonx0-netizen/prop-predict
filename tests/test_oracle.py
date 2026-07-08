from model.oracle import oracle, _QUALITY, _W_PLATOON, _W_MATCHUP, _W_FORM

_ELITE = {"bbe": 300, "barrel_rate": 0.20, "pulled_barrel_rate": 0.12, "hardhit_rate": 0.55,
          "xwobacon": 0.46, "sweetspot_rate": 0.45, "recent_form_mult": 1.10}
_AVG = {"bbe": 300, "barrel_rate": 0.08, "pulled_barrel_rate": 0.035, "hardhit_rate": 0.40,
        "xwobacon": 0.37, "sweetspot_rate": 0.34, "recent_form_mult": 1.0}

def test_weight_sums():
    assert abs(sum(_QUALITY.values()) - 1.0) < 1e-9
    assert abs((_W_PLATOON + _W_MATCHUP + _W_FORM) - 1.0) < 1e-9

def test_gate_blocks_weak_barrel_even_with_great_edges():
    r = oracle(_AVG, barrel_mult=1.20, platoon_mult=1.06)   # avg bat, max edges
    assert r["oracle"] is False

def test_gate_blocks_thin_sample():
    thin = dict(_ELITE); thin["bbe"] = 10
    assert oracle(thin, barrel_mult=1.20, platoon_mult=1.06)["oracle"] is False

def test_elite_bat_with_stacked_edges_flags():
    r = oracle(_ELITE, barrel_mult=1.18, platoon_mult=1.05)
    assert r["oracle"] is True
    assert 0.0 <= r["oracle_score"] <= 1.0

def test_gated_bat_with_poor_edges_does_not_flag():
    # elite barrel but a bad matchup + bad platoon + cold form -> edges too low to clear premium bar
    cold = dict(_ELITE); cold["recent_form_mult"] = 0.9
    r = oracle(cold, barrel_mult=0.90, platoon_mult=0.95)
    assert r["oracle"] is False
