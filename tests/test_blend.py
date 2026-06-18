import math
import pytest
from model.blend import marcel_blend, regress, WEIGHTS

def test_weights_are_543():
    assert WEIGHTS == (5, 4, 3)

def test_blend_normalizes_by_top_weight():
    # 3 full seasons: 30/600 each. W_made=12*30=360, W_pa=12*600=7200; /5 -> 72, 1440
    made, pa = marcel_blend([(30, 600), (30, 600), (30, 600)])
    assert math.isclose(made, 72.0)
    assert math.isclose(pa, 1440.0)

def test_blend_recency_weighting():
    # current 10/200, last 30/600, twoAgo 25/600
    made, pa = marcel_blend([(10, 200), (30, 600), (25, 600)])
    # W_made=5*10+4*30+3*25=245; W_pa=5*200+4*600+3*600=5200; /5
    assert math.isclose(made, 49.0)
    assert math.isclose(pa, 1040.0)
    assert math.isclose(made / pa, 245 / 5200)

def test_blend_missing_season_contributes_zero():
    # only current + two-years-ago (last year missing -> (0,0))
    made, pa = marcel_blend([(10, 200), (0, 0), (25, 600)])
    # W_made=5*10+3*25=125; W_pa=5*200+3*600=2800; /5
    assert math.isclose(made, 25.0)
    assert math.isclose(pa, 560.0)

def test_blend_no_data_returns_zeros():
    assert marcel_blend([(0, 0), (0, 0), (0, 0)]) == (0.0, 0.0)

def test_regress_pulls_thin_sample_toward_league():
    # thin sample (R dominates) lands at league rate via the formula
    assert math.isclose(regress(0, 0, 0.033, 300), 0.033)

def test_regress_big_sample_barely_moves():
    # 72 HR in 1440 PA (5.0%), R=300 toward 3.3%
    r = regress(72, 1440, 0.033, 300)
    assert math.isclose(r, (72 + 0.033 * 300) / (1440 + 300))
    assert 0.044 < r < 0.048  # close to observed 5%, lightly pulled down

def test_regress_zero_denom_hits_guard():
    # pa + r == 0 -> guard branch returns league_rate exactly
    assert regress(5.0, 0.0, 0.033, 0.0) == 0.033

def test_blend_short_list_equals_zero_padding():
    # zip-truncation: a 1-season list must equal the zero-padded 3-season form
    assert marcel_blend([(10, 200)]) == marcel_blend([(10, 200), (0, 0), (0, 0)])

def test_blend_zero_top_weight_raises():
    with pytest.raises(ValueError):
        marcel_blend([(10, 200), (5, 100), (0, 0)], weights=(0, 4, 3))
