from model.pitch_metrics import pitch_rates
from model.pitch_metrics import zone_damage, zone_freq, zone_fit

def _p(d, desc, zone=5):
    return {"game_date": d, "description": desc, "zone": zone}

def test_swstr_csw_ball_rates():
    pitches = [
        _p("2026-04-01", "swinging_strike"),
        _p("2026-04-01", "called_strike"),
        _p("2026-04-01", "ball"),
        _p("2026-04-01", "foul"),          # not swstr, not csw, not ball
        _p("2026-04-01", "hit_into_play"),
    ]
    m = pitch_rates(pitches, as_of="2026-06-01")
    assert m["pitches"] == 5
    assert m["swstr"] == 1/5           # 1 swinging_strike
    assert m["csw"] == 2/5             # called + swinging
    assert m["ball"] == 1/5
    assert abs(m["swstr"] - 0.2) < 1e-9

def test_respects_as_of_and_empty():
    assert pitch_rates([_p("2026-07-01", "swinging_strike")], as_of="2026-06-01")["pitches"] == 0
    assert pitch_rates([], as_of="2026-06-01")["swstr"] == 0.0


def _bb(d, zone, xw):
    return {"game_date": d, "bb_type": "fly_ball", "zone": zone,
            "estimated_woba_using_speedangle": xw, "description": "hit_into_play"}

def test_zone_fit_rewards_pitcher_living_in_damage_zone():
    # hitter mashes zone 5 (xwOBA 1.5), weak in zone 1 (0.1)
    hitter = [_bb("2026-04-01", 5, 1.5) for _ in range(20)] + [_bb("2026-04-01", 1, 0.1) for _ in range(20)]
    dmg = zone_damage(hitter, as_of="2026-06-01")
    # pitcher who lives in zone 5 vs one who lives in zone 1
    into_5 = zone_freq([{"game_date":"2026-04-01","zone":5,"description":"ball"} for _ in range(30)], as_of="2026-06-01")
    into_1 = zone_freq([{"game_date":"2026-04-01","zone":1,"description":"ball"} for _ in range(30)], as_of="2026-06-01")
    assert zone_fit(dmg, into_5) > zone_fit(dmg, into_1)

def test_zone_freq_sums_to_one():
    f = zone_freq([{"game_date":"2026-04-01","zone":z,"description":"ball"} for z in (1,5,5,9)], as_of="2026-06-01")
    assert abs(sum(f.values()) - 1.0) < 1e-9

def test_zone_fit_empty_is_zero():
    assert zone_fit(zone_damage([], as_of="2026-06-01"), zone_freq([], as_of="2026-06-01")) == 0.0
