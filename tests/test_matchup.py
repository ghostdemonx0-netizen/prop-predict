import pytest
from model.matchup import (
    log5,
    batter_advantage,
    strikeout_prob,
    hit_prob,
    classify_lean,
    matchup,
    hr_platoon_mult,
)


def test_log5_matches_formula():
    a, b, L = 0.28, 0.26, 0.225
    expected = (a * b / L) / ((a * b / L) + ((1 - a) * (1 - b) / (1 - L)))
    assert log5(a, b, L) == pytest.approx(expected)


def test_log5_two_above_average_combine_higher():
    # two .300 rates vs a .225 league average -> combined above .300
    assert log5(0.30, 0.30, 0.225) > 0.30


def test_batter_advantage_platoon():
    assert batter_advantage("L", "R") is True   # opposite hands -> batter edge
    assert batter_advantage("R", "R") is False  # same hand -> pitcher edge
    assert batter_advantage("S", "R") is True   # switch -> bats opposite
    assert batter_advantage("S", "L") is True


def test_same_hand_raises_strikeouts():
    same = strikeout_prob(0.25, 0.30, bats="R", throws="R")
    opp = strikeout_prob(0.25, 0.30, bats="L", throws="R")
    assert same > opp  # same-handed favors the pitcher -> more Ks


def test_opposite_hand_raises_hits():
    opp = hit_prob(0.24, 0.22, bats="L", throws="R")
    same = hit_prob(0.24, 0.22, bats="R", throws="R")
    assert opp > same  # opposite-handed favors the batter -> more hits


def test_classify_lean():
    assert classify_lean(0.34, 0.20)["lean"] == "K"
    assert classify_lean(0.18, 0.30)["lean"] == "H"
    assert classify_lean(0.22, 0.22)["lean"] == "NEU"


def test_matchup_shape_and_bounds():
    m = matchup(b_k=0.28, b_hit=0.25, p_k=0.30, p_hit=0.20, bats="L", throws="R")
    assert set(m) == {"k_prob", "hit_prob", "lean", "prob"}
    assert 0.0 <= m["k_prob"] <= 0.7
    assert 0.0 <= m["hit_prob"] <= 0.6
    assert m["lean"] in {"K", "H", "NEU"}


def test_hr_platoon_mult():
    assert hr_platoon_mult("L", "R") == pytest.approx(1.06)  # advantage
    assert hr_platoon_mult("R", "R") == pytest.approx(0.95)  # same-hand
    assert hr_platoon_mult("S", "L") == pytest.approx(1.06)  # switch always has it
