from model.pitch_metrics import pitch_rates

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
