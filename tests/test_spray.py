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
