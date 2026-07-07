from model.xstats import iso, xwoba

def _e(d, ev, xw=None, wv=0.0, wd=1, bb=None):
    return {"game_date": d, "events": ev, "estimated_woba_using_speedangle": xw,
            "woba_value": wv, "woba_denom": wd, "bb_type": bb}

def test_iso_extra_bases_per_ab():
    evs = [_e("2026-04-01","home_run"), _e("2026-04-01","double"),
           _e("2026-04-01","single"), _e("2026-04-01","strikeout"),
           _e("2026-04-01","walk")]   # walk excluded from AB
    # AB = 4 (hr,double,single,strikeout); extra bases = 3(hr)+1(double) = 4 -> ISO 1.0
    assert iso(evs, as_of="2026-06-01")["iso"] == 4/4

def test_iso_zero_no_ab():
    assert iso([_e("2026-04-01","walk")], as_of="2026-06-01")["iso"] == 0.0

def test_xwoba_uses_estimated_on_contact_and_woba_value_else():
    evs = [_e("2026-04-01","home_run", xw=1.8, wd=1, bb="fly_ball"),   # contact -> 1.8
           _e("2026-04-01","walk", wv=0.69, wd=1)]                     # non-contact -> 0.69
    r = xwoba(evs, as_of="2026-06-01")
    assert abs(r["xwoba"] - (1.8 + 0.69)/2) < 1e-9
    ra = xwoba(evs, as_of="2026-06-01", allowed=True)
    assert "xwoba_allowed" in ra
