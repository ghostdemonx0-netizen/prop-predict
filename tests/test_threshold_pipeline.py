# tests/test_threshold_pipeline.py
from model.pipeline import build_hits_rows, build_total_bases_rows


def _bat(pid, pa, s1, s2, s3, hr):
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "season_pa": pa, "season_1b": s1, "season_2b": s2, "season_3b": s3,
            "season_hr": hr, "recent_form_mult": 1.0, "k_rate": 0.22, "hit_rate": (s1+s2+s3+hr)/pa}


def _pit(pid):
    return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R",
            "k_per_bf": 0.22, "expected_bf": 24, "opponent_k_mult": 1.0, "k_line": 5.5,
            "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}


def _slate():
    return [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
             "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]


def _w(g): return {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}


def test_hits_rows_thresholds_monotonic():
    lf = lambda g: {"home": [_bat(1, 400, 90, 25, 3, 20)], "away": [_bat(2, 400, 90, 25, 3, 20)]}
    pf = lambda pid: _pit(pid)
    rows = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    assert r["prop"] == "HITS"
    assert 0 <= r["p_ge3"] <= r["p_ge2"] <= r["p_ge1"] <= 1  # monotonic
    # vs must carry full matchup read (lean is "K"/"H"/"NEU"; prob/k_prob/hit_prob are floats)
    assert r["vs"] is not None, "vs should be set when pitcher present"
    assert r["vs"]["lean"] in ("K", "H", "NEU"), f"unexpected lean: {r['vs']['lean']}"
    for field in ("prob", "k_prob", "hit_prob"):
        assert field in r["vs"], f"vs missing {field}"
        assert isinstance(r["vs"][field], (int, float)), f"vs.{field} not a number"


def test_total_bases_rows_present_and_monotonic():
    lf = lambda g: {"home": [_bat(1, 400, 90, 25, 3, 20)], "away": [_bat(2, 400, 90, 25, 3, 20)]}
    pf = lambda pid: _pit(pid)
    rows = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    assert r["prop"] == "TB"
    assert 0 <= r["p_ge4"] <= r["p_ge3"] <= r["p_ge2"] <= 1
    # vs must carry full matchup read (lean is "K"/"H"/"NEU"; prob/k_prob/hit_prob are floats)
    assert r["vs"] is not None, "vs should be set when pitcher present"
    assert r["vs"]["lean"] in ("K", "H", "NEU"), f"unexpected lean: {r['vs']['lean']}"
    for field in ("prob", "k_prob", "hit_prob"):
        assert field in r["vs"], f"vs missing {field}"
        assert isinstance(r["vs"][field], (int, float)), f"vs.{field} not a number"


def test_low_hit_rate_batter_valid_distribution():
    """A cold batter (low hit_rate) vs a hittable pitcher must not produce p0=0
    thanks to the hit_factor cap at 2.0."""
    # pa=400, s1=10, s2=2, s3=0, hr=1 → hit_rate = 13/400 = 0.0325 (very low)
    cold_bat = _bat(99, 400, 10, 2, 0, 1)
    # pitcher with high hit_allowed_rate to maximise hit_factor before the cap
    hittable_pit = {**_pit(100), "hit_allowed_rate": 0.38}
    lf = lambda g: {"home": [cold_bat], "away": []}
    pf = lambda pid: hittable_pit
    rows = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    assert rows, "expected at least one row"
    r = next(row for row in rows if row["player_id"] == 99)
    assert 0 <= r["p_ge1"] <= 1, "p_ge1 out of [0,1]"
    assert r["p_ge1"] <= 0.95, f"p_ge1={r['p_ge1']} is pathologically high (cap not working)"
    assert r["p_ge3"] <= r["p_ge2"] <= r["p_ge1"], "monotonic check failed"


def test_slugger_vs_slap_hitter_total_bases():
    """Slugger should have higher p_ge4 (extra-base power) than a slap hitter."""
    slugger = _bat(1, 500, 90, 30, 3, 30)
    slap = _bat(2, 500, 140, 15, 2, 0)
    lf = lambda g: {"home": [slugger, slap], "away": []}
    pf = lambda pid: _pit(pid)
    rows = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    slugger_row = next(r for r in rows if r["player_id"] == 1)
    slap_row = next(r for r in rows if r["player_id"] == 2)
    assert slugger_row["p_ge4"] > slap_row["p_ge4"], (
        f"slugger p_ge4={slugger_row['p_ge4']:.4f} should exceed slap p_ge4={slap_row['p_ge4']:.4f}"
    )


# ---------------------------------------------------------------------------
# Tests for new recent_form_mult + pitcher_factor fields (task 10b)
# ---------------------------------------------------------------------------

def _pit_favorable():
    """Hittable pitcher: high hit_allowed_rate, no-HR-suppression."""
    return {"player_id": 300, "name": "easy", "team": "EEE", "throws": "R",
            "k_per_bf": 0.15, "expected_bf": 24, "opponent_k_mult": 1.0, "k_line": 4.5,
            "hit_allowed_rate": 0.32, "hr_allowed_rate": 0.050, "bf": 400}


def _pit_tough():
    """Ace: low hit_allowed_rate, strong HR-suppression."""
    return {"player_id": 301, "name": "ace", "team": "TTT", "throws": "R",
            "k_per_bf": 0.30, "expected_bf": 24, "opponent_k_mult": 1.0, "k_line": 7.5,
            "hit_allowed_rate": 0.18, "hr_allowed_rate": 0.020, "bf": 400}


def _pit_neutral():
    """League-average pitcher: the pitcher_factor ratio should be close to 1.0."""
    return {"player_id": 302, "name": "avg", "team": "NNN", "throws": "R",
            "k_per_bf": 0.22, "expected_bf": 24, "opponent_k_mult": 1.0, "k_line": 5.5,
            "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 400}


def _typical_batter(pid=1):
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "season_pa": 400, "season_1b": 90, "season_2b": 25, "season_3b": 3,
            "season_hr": 20, "recent_form_mult": 1.0, "k_rate": 0.22, "hit_rate": 0.270}


def test_hits_row_carries_recent_form_mult_and_pitcher_factor():
    """hits/tb rows must expose recent_form_mult and pitcher_factor as floats."""
    batter = {**_typical_batter(), "recent_form_mult": 1.15}
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_neutral()
    rows = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    assert rows, "expected at least one row"
    r = rows[0]
    assert "recent_form_mult" in r, "recent_form_mult missing from hits row"
    assert "pitcher_factor" in r, "pitcher_factor missing from hits row"
    assert isinstance(r["recent_form_mult"], (int, float))
    assert isinstance(r["pitcher_factor"], (int, float))
    assert r["recent_form_mult"] == 1.15


def test_tb_row_carries_recent_form_mult_and_pitcher_factor():
    """Same check for total_bases rows."""
    batter = {**_typical_batter(), "recent_form_mult": 0.90}
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_neutral()
    rows = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    assert rows, "expected at least one row"
    r = rows[0]
    assert "recent_form_mult" in r
    assert "pitcher_factor" in r
    assert r["recent_form_mult"] == 0.90


def test_pitcher_factor_favorable_gt_1_hits():
    """A hittable pitcher produces pitcher_factor > 1 on a hits row."""
    batter = _typical_batter()
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_favorable()
    rows = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    assert r["pitcher_factor"] > 1.0, f"expected pitcher_factor > 1 for hittable pitcher, got {r['pitcher_factor']}"


def test_pitcher_factor_tough_lt_1_hits():
    """An ace produces pitcher_factor < 1 on a hits row."""
    batter = _typical_batter()
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_tough()
    rows = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    assert r["pitcher_factor"] < 1.0, f"expected pitcher_factor < 1 for ace, got {r['pitcher_factor']}"


def test_pitcher_factor_favorable_gt_1_tb():
    """A hittable pitcher produces pitcher_factor > 1 on a TB row."""
    batter = _typical_batter()
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_favorable()
    rows = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    assert r["pitcher_factor"] > 1.0, f"expected pitcher_factor > 1 for hittable pitcher on TB, got {r['pitcher_factor']}"


def test_pitcher_factor_tough_lt_1_tb():
    """An ace produces pitcher_factor < 1 on a TB row (bases EV uses Σ i·p_i, not any-hit)."""
    batter = _typical_batter()
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_tough()
    rows = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    assert r["pitcher_factor"] < 1.0, f"expected pitcher_factor < 1 for ace on TB, got {r['pitcher_factor']}"


def test_pitcher_factor_neutral_approx_1():
    """A league-average pitcher should yield pitcher_factor close to 1.0."""
    batter = _typical_batter()
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_neutral()
    rows = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    # R-vs-R is a same-hand matchup, so a small platoon penalty (~0.93) is baked
    # into pitcher_factor even for a league-average pitcher. The ±15% window is
    # deliberately sized to accommodate that — "near 1", not exactly 1.
    assert 0.85 <= r["pitcher_factor"] <= 1.15, f"neutral pitcher_factor={r['pitcher_factor']} far from 1.0"


def test_pitcher_factor_no_pitcher_defaults_to_1():
    """With no opposing pitcher (opp=None), pitcher_factor should be 1.0."""
    batter = _typical_batter()
    slate_no_pit = [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
                     "started": False}]  # no pitcher IDs
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_neutral()
    rows = build_hits_rows(slate_no_pit, lf, pf, _w, bvp_fn=None)
    # With no pitcher assigned, opp is None so actual_ev = neutral_ev => factor = 1.0
    assert rows, "expected rows even with no pitcher"
    assert rows[0]["pitcher_factor"] == 1.0


# ---------------------------------------------------------------------------
# Tests for dampened park/weather on doubles+triples (TB-only, Hits neutral)
# ---------------------------------------------------------------------------

def _slate_park(park_team):
    """Slate with a customisable park_team so we can swap Coors vs neutral."""
    return [{"game_id": 2, "home": "AAA", "away": "BBB", "park_team": park_team,
             "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]


def _w_warm(g):
    """Warm, calm weather so weather_mult ≈ 1 and differences are park-driven."""
    return {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 72, "precip_pct": 0}


def test_tb_park_boost_coors_vs_neutral():
    """Coors (hr_factor ~1.22) should give higher p_ge2 / p_ge3 than neutral park on TB rows."""
    batter = _typical_batter(pid=10)
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_neutral()

    rows_coors = build_total_bases_rows(_slate_park("COL"), lf, pf, _w_warm, bvp_fn=None)
    rows_neutral = build_total_bases_rows(_slate_park("AAA"), lf, pf, _w_warm, bvp_fn=None)

    # AAA is a dummy team; if park lookup falls back to hr_factor=1.0 that's the neutral baseline
    r_c = next(r for r in rows_coors if r["player_id"] == 10)
    r_n = next(r for r in rows_neutral if r["player_id"] == 10)

    assert r_c["p_ge2"] > r_n["p_ge2"], (
        f"Coors TB p_ge2={r_c['p_ge2']:.4f} should exceed neutral p_ge2={r_n['p_ge2']:.4f}"
    )
    assert r_c["p_ge3"] > r_n["p_ge3"], (
        f"Coors TB p_ge3={r_c['p_ge3']:.4f} should exceed neutral p_ge3={r_n['p_ge3']:.4f}"
    )


def test_hits_rows_no_xbh_dampening():
    """HITS rows must NOT apply the XBH park dampening (apply_xbh_park=False).
    We verify this by checking that the outcome vector for Hits is the same whether
    park is Coors or neutral, when only non-HR hits are present (isolates XBH path).
    Since HR is already park-adjusted in both paths, we use a singles+doubles-only
    batter and confirm _batter_outcome_vector gives identical p2/p3 when apply_xbh_park=False."""
    from model.pipeline import _batter_outcome_vector

    b_xbh = {"player_id": 11, "name": "xbh", "team": "AAA", "bats": "R",
              "season_pa": 400, "season_1b": 60, "season_2b": 30, "season_3b": 5,
              "season_hr": 0, "recent_form_mult": 1.0, "k_rate": 0.22, "hit_rate": 0.2375}

    # Hits path: apply_xbh_park=False — Coors park vs neutral park must give same p2/p3
    vec_coors_hits, _ = _batter_outcome_vector(b_xbh, None, 1.22, 1.0, 3, None, apply_xbh_park=False)
    vec_neutral_hits, _ = _batter_outcome_vector(b_xbh, None, 1.0, 1.0, 3, None, apply_xbh_park=False)

    assert vec_coors_hits[2] == vec_neutral_hits[2], (
        f"HITS path: p2 should be park-neutral: Coors={vec_coors_hits[2]:.6f} vs neutral={vec_neutral_hits[2]:.6f}"
    )
    assert vec_coors_hits[3] == vec_neutral_hits[3], (
        f"HITS path: p3 should be park-neutral: Coors={vec_coors_hits[3]:.6f} vs neutral={vec_neutral_hits[3]:.6f}"
    )

    # TB path: apply_xbh_park=True — Coors should give higher p2/p3
    vec_coors_tb, _ = _batter_outcome_vector(b_xbh, None, 1.22, 1.0, 3, None, apply_xbh_park=True)
    assert vec_coors_tb[2] > vec_neutral_hits[2], (
        f"TB path: p2 should be boosted by Coors park: {vec_coors_tb[2]:.6f} vs {vec_neutral_hits[2]:.6f}"
    )


def test_tb_pitcher_factor_neutral_approx_1_nonneutral_park():
    """In a non-neutral park (Coors), a league-avg pitcher still yields pitcher_factor ≈ 1.
    The dampened xbh_mult is identical in both actual and neutral vectors, so it cancels."""
    batter = _typical_batter(pid=12)
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_neutral()

    rows = build_total_bases_rows(_slate_park("COL"), lf, pf, _w_warm, bvp_fn=None)
    r = next(r for r in rows if r["player_id"] == 12)

    # Same R-vs-R platoon window as the hits test (±15%)
    assert 0.85 <= r["pitcher_factor"] <= 1.15, (
        f"TB neutral pitcher at Coors: pitcher_factor={r['pitcher_factor']:.4f} far from 1.0"
    )


def test_tb_singles_unchanged_by_park():
    """p1 (singles) in the outcomes vector should not be inflated by xbh_mult.
    Proxy: compare actual_vec p1 via a synthetic batter with only singles (no 2B/3B/HR)."""
    from model.pipeline import _batter_outcome_vector

    b_singles_only = {"player_id": 20, "name": "singles", "team": "AAA", "bats": "R",
                      "season_pa": 400, "season_1b": 100, "season_2b": 0, "season_3b": 0,
                      "season_hr": 0, "recent_form_mult": 1.0, "k_rate": 0.22, "hit_rate": 0.25}

    # eff_park=1.22 (Coors-like), weather_mult=1.0
    vec_park, _ = _batter_outcome_vector(b_singles_only, None, 1.22, 1.0, 3, None, apply_xbh_park=True)
    vec_neutral, _ = _batter_outcome_vector(b_singles_only, None, 1.22, 1.0, 3, None, apply_xbh_park=False)

    # p1 is index 1; xbh_mult should NOT touch it
    assert vec_park[1] == vec_neutral[1], (
        f"p1 (singles) changed with apply_xbh_park: park={vec_park[1]:.6f} vs neutral={vec_neutral[1]:.6f}"
    )
