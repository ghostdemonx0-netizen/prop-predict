from model.barrel import is_barrel, is_pulled_barrel, barrel_metrics


def _bb(date, events, ls=90.0, la=15.0, lsa=5, bb="line_drive", hx=None, hy=None, stand="R", xw=0.35):
    return {"game_date": date, "events": events, "launch_speed": ls, "launch_angle": la,
            "launch_speed_angle": lsa, "bb_type": bb, "hc_x": hx, "hc_y": hy,
            "stand": stand, "estimated_woba_using_speedangle": xw}


def test_is_barrel_uses_launch_speed_angle_6():
    assert is_barrel(_bb("2026-04-01", "home_run", lsa=6)) is True
    assert is_barrel(_bb("2026-04-01", "single", lsa=5)) is False
    assert is_barrel({"launch_speed_angle": None}) is False


def test_pulled_barrel_needs_barrel_and_pull_side():
    # RHB pulls to LF: hc_x well left of plate (125.42). A barrel pulled = True.
    assert is_pulled_barrel(_bb("2026-04-01", "home_run", lsa=6, hx=80.0, hy=100.0, stand="R")) is True
    # Same batted ball but not a barrel -> False.
    assert is_pulled_barrel(_bb("2026-04-01", "home_run", lsa=5, hx=80.0, hy=100.0, stand="R")) is False
    # Barrel to oppo field (RHB, hit to RF: hc_x right of plate) -> False.
    assert is_pulled_barrel(_bb("2026-04-01", "home_run", lsa=6, hx=170.0, hy=100.0, stand="R")) is False


def test_barrel_metrics_basic_rates():
    evs = [
        _bb("2026-04-01", "home_run", ls=104, la=28, lsa=6, bb="fly_ball", hx=80.0, hy=100.0, stand="R", xw=1.8),
        _bb("2026-04-01", "single",   ls=96,  la=12, lsa=5, bb="line_drive", xw=0.5),
        _bb("2026-04-01", "field_out", ls=80, la=45, lsa=3, bb="fly_ball", xw=0.1),
        _bb("2026-04-01", "strikeout", ls=None, bb=None),  # not a BBE (no bb_type)
    ]
    m = barrel_metrics(evs, as_of="2026-06-01")
    assert m["barrel_rate"] == 1 / 3          # 1 barrel of 3 BBE
    assert m["pulled_barrel_rate"] == 1 / 3   # the barrel was pulled
    assert m["hardhit_rate"] == 2 / 3         # 104 and 96 are >=95
    assert m["fb_rate"] == 2 / 3              # two fly_ball of 3 BBE
    assert m["hrfb_rate"] == 1 / 2            # 1 HR of 2 fly balls
    assert round(m["la_mean"], 3) == round((28 + 12 + 45) / 3, 3)
    assert round(m["xwobacon"], 3) == round((1.8 + 0.5 + 0.1) / 3, 3)
    assert round(m["sweetspot_rate"], 3) == round(2 / 3, 3)  # 28 and 12 in [8,32]


def test_no_bip_all_zeros():
    m = barrel_metrics([_bb("2026-04-01", "strikeout", ls=None, bb=None), _bb("2026-04-01", "walk", ls=None, bb=None)], as_of="2026-06-01")
    for k in ("barrel_rate", "pulled_barrel_rate", "sweetspot_rate", "fb_rate", "hardhit_rate", "la_mean", "xwobacon", "hrfb_rate"):
        assert m[k] == 0.0


def test_allowed_flag_renames_keys():
    m = barrel_metrics([_bb("2026-04-01", "home_run", lsa=6, bb="fly_ball")], as_of="2026-06-01", allowed=True)
    assert "barrel_rate_allowed" in m
    assert "barrel_rate" not in m


def test_respects_as_of_cutoff():
    evs = [_bb("2026-04-01", "home_run", lsa=6, bb="fly_ball"), _bb("2026-07-01", "home_run", lsa=6, bb="fly_ball")]
    m = barrel_metrics(evs, as_of="2026-06-01")  # only the April ball counts
    assert m["barrel_rate"] == 1.0


def test_barrel_metrics_emits_bbe_count():
    evs = [_bb("2026-04-01", "home_run", lsa=6, bb="fly_ball"),
           _bb("2026-04-01", "single", lsa=5, bb="line_drive"),
           _bb("2026-04-01", "strikeout", ls=None, bb=None)]  # not a BBE
    m = barrel_metrics(evs, as_of="2026-06-01")
    assert m["bbe"] == 2
    ma = barrel_metrics(evs, as_of="2026-06-01", allowed=True)
    assert ma["bbe_allowed"] == 2
