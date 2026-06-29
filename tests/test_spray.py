from model import spray


def test_spray_angle_center_and_sides():
    assert abs(spray.spray_angle(125.42, 50)) < 1.0
    assert spray.spray_angle(80, 100) < 0      # toward LF
    assert spray.spray_angle(170, 100) > 0     # toward RF


def test_field_of_by_handedness():
    assert spray.field_of(-35, "R") == "pull"   # RHB pulls LF
    assert spray.field_of(35, "R") == "oppo"
    assert spray.field_of(0, "R") == "center"
    assert spray.field_of(-35, "L") == "oppo"   # LHB mirror
    assert spray.field_of(35, "L") == "pull"


def _scout(p, c, o, n):
    tot = (p + c + o) or 1
    return {"pull": p / tot, "center": c / tot, "oppo": o / tot, "n": n}


def test_combine_scouts_weights_toward_hr():
    sc = {"overall": _scout(58, 27, 15, 1000), "air": _scout(64, 22, 14, 400), "hr": _scout(74, 16, 10, 90)}
    out = spray.combine_scouts(sc)
    assert 0.99 < out["pull"] + out["center"] + out["oppo"] < 1.01
    assert out["pull"] > sc["overall"]["pull"]


def test_combine_scouts_none_when_empty():
    sc = {"overall": _scout(0, 0, 0, 0), "air": _scout(0, 0, 0, 0), "hr": _scout(0, 0, 0, 0)}
    assert spray.combine_scouts(sc) is None


def test_final_distribution_dial_and_cap():
    sc = {"overall": _scout(70, 20, 10, 1500), "air": _scout(70, 20, 10, 600), "hr": _scout(70, 20, 10, 100)}
    fin = spray.final_distribution(sc, "R")
    assert 0.50 < fin["pull"] <= 0.70
    empty = {"overall": _scout(0, 0, 0, 0), "air": _scout(0, 0, 0, 0), "hr": _scout(0, 0, 0, 0)}
    assert spray.final_distribution(empty, "R") == spray.HAND_DEFAULT["R"]


def _res_R(p, c, o, n):
    sc = {"overall": _scout(p, c, o, n), "air": _scout(p, c, o, 0), "hr": _scout(p, c, o, 0)}
    z = _scout(0, 0, 0, 0)
    return {"R": sc, "L": {"overall": z, "air": z, "hr": z}}


def test_compute_league_default_averages_qualified_hitters():
    out = spray.compute_league_default([_res_R(60, 30, 10, 500), _res_R(80, 10, 10, 500)], min_n=200)
    assert abs(out["R"]["pull"] - 0.70) < 0.01
    assert abs(out["R"]["center"] - 0.20) < 0.01
    # thin samples ignored; no L data -> falls back to current default
    assert out["L"] == spray.HAND_DEFAULT["L"]


def test_compute_league_default_skips_thin_samples():
    out = spray.compute_league_default([_res_R(90, 5, 5, 50)], min_n=200)  # n<min_n
    assert out["R"] == spray.HAND_DEFAULT["R"]
