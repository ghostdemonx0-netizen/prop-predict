import math
from model.counts import count_ge_prob, count_distribution

def test_single_certain_pa_one_unit():
    # 1 PA, always 1 unit -> P(>=1)=1, P(>=2)=0
    assert math.isclose(count_ge_prob([0.0, 1.0], 1.0, 1), 1.0)
    assert math.isclose(count_ge_prob([0.0, 1.0], 1.0, 2), 0.0)

def test_two_pa_hit_prob_geq1_matches_complement():
    # p_hit=0.3 over exactly 2 PAs: P(>=1) = 1-(0.7^2)
    assert math.isclose(count_ge_prob([0.7, 0.3], 2.0, 1), 1 - 0.7**2)
    # P(>=2) = 0.3^2
    assert math.isclose(count_ge_prob([0.7, 0.3], 2.0, 2), 0.3**2)

def test_homer_is_four_bases_in_one_pa():
    # one PA that is always a HR (4 bases) clears the 4+ line outright
    assert math.isclose(count_ge_prob([0,0,0,0,1.0], 1.0, 4), 1.0)
    assert math.isclose(count_ge_prob([0,0,0,0,1.0], 1.0, 2), 1.0)

def test_fractional_pa():
    # 1.5 PAs of always-1-unit: dist = 1 full PA (1 unit) + 0.5 chance of another
    # totals: 1 w.p. 0.5, 2 w.p. 0.5  -> P(>=2)=0.5, P(>=1)=1.0
    assert math.isclose(count_ge_prob([0.0, 1.0], 1.5, 2), 0.5)
    assert math.isclose(count_ge_prob([0.0, 1.0], 1.5, 1), 1.0)

def test_distribution_sums_to_one():
    d = count_distribution([0.5, 0.3, 0.2], 3.2)
    assert math.isclose(sum(d), 1.0, abs_tol=1e-9)

def test_n_beyond_range_returns_zero():
    # max possible is 2 units over 2 PAs of 0/1 -> P(>=3) == 0 (exercises the else branch)
    assert count_ge_prob([0.7, 0.3], 2.0, 3) == 0.0

def test_integer_pa_no_spurious_extra_pa():
    # 3 integer PAs of 0/1 -> max 3 units -> distribution length 4 (no ghost 4th PA)
    assert len(count_distribution([0.7, 0.3], 3.0)) == 4

def test_empty_outcome_probs_raises():
    import pytest
    with pytest.raises(ValueError):
        count_distribution([], 3.0)
