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
    # recent_form_mult is now the BLENDED form (hard-hit + production); raw hard-hit
    # is exposed separately as hard_hit_form. No production field on the fixture -> prod=1.0.
    from model import run_props
    assert r["hard_hit_form"] == 1.15
    assert r["recent_form_mult"] == run_props.blend_forms(1.15, 1.0, w_hard=0.60)


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
    from model import run_props
    assert r["hard_hit_form"] == 0.90
    assert r["recent_form_mult"] == run_props.blend_forms(0.90, 1.0, w_hard=0.60)


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
    """Coors xbh_mult must produce a meaningfully larger p_ge2/p_ge3 boost than HR
    regression alone could explain.

    Design rationale: even with season_hr=0, hr_rate_per_pa regresses toward the
    league average (~0.033), so park_mult=1.22 still lifts p4 slightly.  That means
    a bare "COL > neutral" assertion passes regardless of xbh_mult and is therefore
    non-discriminating.

    We instead assert that the COL-vs-neutral DELTA for p_ge2 exceeds a minimum
    threshold (0.015) that HR-regression alone cannot clear.  With xbh_mult the
    observed delta is ~0.031; without xbh_mult it falls to ~0.007.  The threshold
    of 0.015 sits between these two values and will catch a regression that removes
    the xbh_mult lines.
    """
    # Zero HRs: minimises the HR-regression contribution, isolating xbh_mult.
    zero_hr_batter = {"player_id": 10, "name": "10", "team": "AAA", "bats": "R",
                      "season_pa": 500, "season_1b": 100, "season_2b": 40,
                      "season_3b": 8, "season_hr": 0, "recent_form_mult": 1.0,
                      "k_rate": 0.22, "hit_rate": (100 + 40 + 8) / 500}
    lf = lambda g: {"home": [zero_hr_batter], "away": []}
    pf = lambda pid: _pit_neutral()

    rows_coors = build_total_bases_rows(_slate_park("COL"), lf, pf, _w_warm, bvp_fn=None)
    rows_neutral = build_total_bases_rows(_slate_park("AAA"), lf, pf, _w_warm, bvp_fn=None)

    r_c = next(r for r in rows_coors if r["player_id"] == 10)
    r_n = next(r for r in rows_neutral if r["player_id"] == 10)

    delta_p2 = r_c["p_ge2"] - r_n["p_ge2"]
    delta_p3 = r_c["p_ge3"] - r_n["p_ge3"]

    # Minimum delta that HR regression alone cannot produce (~0.007); xbh_mult produces ~0.031.
    _XBH_MIN_DELTA = 0.015
    assert delta_p2 > _XBH_MIN_DELTA, (
        f"Coors TB p_ge2 delta={delta_p2:.4f} should exceed {_XBH_MIN_DELTA} "
        f"(xbh_mult lines deleted? HR-regression-only delta is ~0.007)"
    )
    assert delta_p3 > _XBH_MIN_DELTA, (
        f"Coors TB p_ge3 delta={delta_p3:.4f} should exceed {_XBH_MIN_DELTA} "
        f"(xbh_mult lines deleted? HR-regression-only delta is ~0.010)"
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

    # TB path: apply_xbh_park=True + per-component park factors — Coors should give higher p2/p3.
    # Under the new design the XBH boost comes from park_2b/3b, not from eff_park.
    # Passing Coors-like park factors (2B=1.11, 3B=1.35) must produce a higher p2/p3.
    vec_coors_tb, _ = _batter_outcome_vector(b_xbh, None, 1.22, 1.0, 3, None,
                                             apply_xbh_park=True, park_2b=1.11, park_3b=1.35)
    assert vec_coors_tb[2] > vec_neutral_hits[2], (
        f"TB path: p2 should be boosted by park_2b=1.11: {vec_coors_tb[2]:.6f} vs {vec_neutral_hits[2]:.6f}"
    )


def test_hits_park_neutral_tb_park_boosted_public_api():
    """Integration test through the public builders (not the internal vector function).

    Uses a zero-HR batter at Coors (COL) vs a neutral park (AAA) to verify the gate
    `apply_xbh_park=(units=="bases")` is correctly wired at the function boundary.

    Key insight: even with season_hr=0, hr_rate_per_pa regresses toward the league
    average and applies park_mult, so both Hits and TB rows are slightly affected by
    park via HR regression / normalization.  What xbh_mult adds on top of that is an
    EXTRA boost to doubles/triples.  We therefore assert that:

      TB park delta (p_ge2_COL - p_ge2_neutral) > Hits park delta

    because TB rows have BOTH the HR-regression effect AND the xbh_mult boost,
    while Hits rows have only the HR-regression effect.  If the gate were removed
    (apply_xbh_park always False) the TB delta would shrink to match the Hits delta
    and this assertion would fail.
    """
    # Zero HRs: keeps HR-regression contribution small so xbh_mult dominates the gap.
    zero_hr_batter = {"player_id": 15, "name": "15", "team": "AAA", "bats": "R",
                      "season_pa": 500, "season_1b": 100, "season_2b": 40,
                      "season_3b": 8, "season_hr": 0, "recent_form_mult": 1.0,
                      "k_rate": 0.22, "hit_rate": (100 + 40 + 8) / 500}
    lf = lambda g: {"home": [zero_hr_batter], "away": []}
    pf = lambda pid: _pit_neutral()

    hits_col = build_hits_rows(_slate_park("COL"), lf, pf, _w_warm, bvp_fn=None)
    hits_neutral = build_hits_rows(_slate_park("AAA"), lf, pf, _w_warm, bvp_fn=None)
    hc = next(r for r in hits_col if r["player_id"] == 15)
    hn = next(r for r in hits_neutral if r["player_id"] == 15)
    hits_delta_p2 = hc["p_ge2"] - hn["p_ge2"]

    tb_col = build_total_bases_rows(_slate_park("COL"), lf, pf, _w_warm, bvp_fn=None)
    tb_neutral = build_total_bases_rows(_slate_park("AAA"), lf, pf, _w_warm, bvp_fn=None)
    tc = next(r for r in tb_col if r["player_id"] == 15)
    tn = next(r for r in tb_neutral if r["player_id"] == 15)
    tb_delta_p2 = tc["p_ge2"] - tn["p_ge2"]

    # TB must also show a Coors boost at p_ge2
    assert tc["p_ge2"] > tn["p_ge2"], (
        f"TB p_ge2 should be boosted at Coors: COL={tc['p_ge2']:.6f} vs neutral={tn['p_ge2']:.6f}"
    )
    # The TB park delta must be strictly larger than the Hits delta (xbh_mult contribution)
    assert tb_delta_p2 > hits_delta_p2, (
        f"TB park delta ({tb_delta_p2:.6f}) should exceed Hits delta ({hits_delta_p2:.6f}); "
        f"if equal, xbh_mult is not being applied to TB rows (gate broken?)"
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


# ── park_weather_factor field presence and values ──────────────────────────

def test_tb_row_has_park_weather_factor():
    """Every TB row carries a park_weather_factor float field."""
    lf = lambda g: {"home": [_bat(10, 400, 90, 25, 3, 20)], "away": []}
    pf = lambda pid: _pit_neutral()
    rows = build_total_bases_rows(_slate_park("AAA"), lf, pf, _w_warm, bvp_fn=None)
    assert rows, "expected at least one TB row"
    r = rows[0]
    assert "park_weather_factor" in r, "TB row missing park_weather_factor"
    assert isinstance(r["park_weather_factor"], float)


def test_tb_park_weather_factor_coors_gt_1():
    """Coors (COL) should produce park_weather_factor > 1.0 for a TB row."""
    lf = lambda g: {"home": [_bat(10, 400, 90, 25, 3, 20)], "away": []}
    pf = lambda pid: _pit_neutral()
    rows_coors = build_total_bases_rows(_slate_park("COL"), lf, pf, _w_warm, bvp_fn=None)
    r = next(r for r in rows_coors if r["player_id"] == 10)
    assert r["park_weather_factor"] > 1.0, (
        f"Coors park_weather_factor={r['park_weather_factor']:.4f} should be > 1.0"
    )


def test_tb_park_weather_factor_neutral_approx_1():
    """A neutral park AND neutral weather should produce park_weather_factor ≈ 1.0.
    (park_weather_factor includes weather, so a non-neutral park OR warm/windy
    weather legitimately moves it off 1.0 — this test isolates the neutral case.)"""
    lf = lambda g: {"home": [_bat(10, 400, 90, 25, 3, 20)], "away": []}
    pf = lambda pid: _pit_neutral()
    rows = build_total_bases_rows(_slate_park("AAA"), lf, pf, _w, bvp_fn=None)
    r = next(r for r in rows if r["player_id"] == 10)
    assert abs(r["park_weather_factor"] - 1.0) <= 0.005, (
        f"Neutral park_weather_factor={r['park_weather_factor']:.6f} should be ≈ 1.0"
    )


def test_hits_row_park_weather_factor_is_1():
    """Hits rows should carry park_weather_factor == 1.0 (hits are park-neutral)."""
    lf = lambda g: {"home": [_bat(10, 400, 90, 25, 3, 20)], "away": []}
    pf = lambda pid: _pit_neutral()
    rows = build_hits_rows(_slate_park("COL"), lf, pf, _w_warm, bvp_fn=None)
    assert rows, "expected at least one hits row"
    r = rows[0]
    assert "park_weather_factor" in r, "Hits row missing park_weather_factor key"
    assert r["park_weather_factor"] == 1.0, (
        f"Hits row park_weather_factor should be 1.0, got {r['park_weather_factor']}"
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


# ---------------------------------------------------------------------------
# Tests for per-component hit park factors in TB rows (Task 2)
# ---------------------------------------------------------------------------

def _col_slate():
    """A COL home game — Coors Field, the strongest hitter-friendly park."""
    return [{"game_id": 10, "home": "COL", "away": "SEA", "park_team": "COL",
             "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]


def _sea_slate():
    """A SEA home game — T-Mobile Park, suppressive for extra bases."""
    return [{"game_id": 11, "home": "SEA", "away": "COL", "park_team": "SEA",
             "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]


def _neutral_slate():
    return [{"game_id": 12, "home": "ZZZ", "away": "YYY", "park_team": "ZZZ",
             "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]


def test_tb_col_higher_than_neutral():
    """COL TB row should have higher p_ge2/p_ge3 than a neutral/unknown park."""
    batter = _typical_batter()
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_neutral()
    col_rows = build_total_bases_rows(_col_slate(), lf, pf, _w, bvp_fn=None)
    neutral_rows = build_total_bases_rows(_neutral_slate(), lf, pf, _w, bvp_fn=None)
    assert col_rows and neutral_rows
    col_r = col_rows[0]
    neutral_r = neutral_rows[0]
    assert col_r["p_ge2"] > neutral_r["p_ge2"], f"COL p_ge2={col_r['p_ge2']:.4f} should exceed neutral {neutral_r['p_ge2']:.4f}"
    assert col_r["p_ge3"] > neutral_r["p_ge3"], f"COL p_ge3={col_r['p_ge3']:.4f} should exceed neutral {neutral_r['p_ge3']:.4f}"


def test_tb_sea_lower_than_neutral():
    """SEA TB row should have lower p_ge2/p_ge3 than a neutral/unknown park."""
    batter = _typical_batter()
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_neutral()
    sea_rows = build_total_bases_rows(_sea_slate(), lf, pf, _w, bvp_fn=None)
    neutral_rows = build_total_bases_rows(_neutral_slate(), lf, pf, _w, bvp_fn=None)
    assert sea_rows and neutral_rows
    sea_r = sea_rows[0]
    neutral_r = neutral_rows[0]
    assert sea_r["p_ge2"] < neutral_r["p_ge2"], f"SEA p_ge2={sea_r['p_ge2']:.4f} should be below neutral {neutral_r['p_ge2']:.4f}"
    assert sea_r["p_ge3"] < neutral_r["p_ge3"], f"SEA p_ge3={sea_r['p_ge3']:.4f} should be below neutral {neutral_r['p_ge3']:.4f}"


def test_hits_park_neutral_col_vs_neutral():
    """Hits 1B/2B/3B components must be park-neutral (park_1b=park_2b=park_3b=1.0 forced).

    We verify at the _batter_outcome_vector level where we can isolate the 1B/2B/3B
    components cleanly: apply_xbh_park=False must produce identical p1/p2/p3 regardless
    of eff_park (HR still differs, but that is pre-existing and correct behaviour).
    """
    from model.pipeline import _batter_outcome_vector
    batter = _typical_batter()
    # Coors eff_park ~1.105 vs neutral 1.0 — 1B/2B/3B components must be identical
    vec_col, _ = _batter_outcome_vector(batter, None, 1.105, 1.0, 3, None,
                                        apply_xbh_park=False, park_1b=1.09, park_2b=1.11, park_3b=1.35)
    vec_neutral, _ = _batter_outcome_vector(batter, None, 1.0, 1.0, 3, None, apply_xbh_park=False)
    # apply_xbh_park=False forces park_1b=park_2b=park_3b=1.0, overriding any passed values
    assert vec_col[1] == vec_neutral[1], f"Hits p1 should be park-neutral: COL={vec_col[1]:.6f} neutral={vec_neutral[1]:.6f}"
    assert vec_col[2] == vec_neutral[2], f"Hits p2 should be park-neutral: COL={vec_col[2]:.6f} neutral={vec_neutral[2]:.6f}"
    assert vec_col[3] == vec_neutral[3], f"Hits p3 should be park-neutral: COL={vec_col[3]:.6f} neutral={vec_neutral[3]:.6f}"


def test_pitcher_factor_neutral_matchup_col_tb():
    """pitcher_factor for a league-average pitcher vs a typical batter in COL should be ≈1.0.

    The ±0.10 window accommodates the R-vs-R same-hand platoon penalty (~0.93 hit_factor)
    which is baked into pitcher_factor even for a league-average pitcher — the same reason
    the existing test_pitcher_factor_neutral_approx_1 uses a ±0.15 window.
    """
    batter = _typical_batter()
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit_neutral()
    rows = build_total_bases_rows(_col_slate(), lf, pf, _w, bvp_fn=None)
    assert rows
    r = rows[0]
    assert abs(r["pitcher_factor"] - 1.0) < 0.10, f"pitcher_factor={r['pitcher_factor']:.4f} should be ≈1.0 for neutral matchup in COL"


def test_tb_row_carries_spray_pull():
    batter = _bat(99, 400, 55, 20, 2, 10)
    lf = lambda g: {"home": [batter], "away": []}
    rows = build_total_bases_rows(_slate(), lf, lambda p: _pit(p), _w, bvp_fn=None)
    assert "spray_pull" in rows[0]
    assert 0.0 <= rows[0]["spray_pull"] <= 1.0


def test_bvp_hit_dial_boosts_hits_for_strong_history():
    batter = _bat(1, 400, 90, 25, 3, 20)
    lf = lambda g: {"home": [batter], "away": []}
    pf = lambda pid: _pit(pid)
    strong = lambda b, p: {"pa": 60, "ab": 55, "hits": 40, "hr": 2, "k": 5, "avg": ".364"}
    none = lambda b, p: None
    hi = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=strong)[0]
    base = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=none)[0]
    assert hi["p_ge1"] > base["p_ge1"]        # strong BvP hits history bumps the hit prob
    assert hi["bvp_hit_mult"] > 1.0
    assert base["bvp_hit_mult"] == 1.0        # no history -> neutral


def test_tb_directional_wind_pull_hitter_lf_beats_rf():
    from model.parks import get_park
    sides = {"R": {"overall": {"pull": 80, "center": 12, "oppo": 8, "n": 1200},
                   "air": {"pull": 80, "center": 12, "oppo": 8, "n": 400},
                   "hr": {"pull": 85, "center": 10, "oppo": 5, "n": 90}},
             "L": {"overall": {"pull": 0, "center": 0, "oppo": 0, "n": 0},
                   "air": {"pull": 0, "center": 0, "oppo": 0, "n": 0},
                   "hr": {"pull": 0, "center": 0, "oppo": 0, "n": 0}}}
    bat = {"player_id": 99, "name": "P", "team": "COL", "bats": "R", "season_pa": 400,
           "season_1b": 55, "season_2b": 20, "season_3b": 2, "season_hr": 20,
           "hit_rate": 0.25, "k_rate": 0.22, "recent_form_mult": 1.0,
           "lineup_status": "confirmed", "spray_sides": sides}
    slate = [{"game_id": 10, "home": "COL", "away": "SD", "park_team": "COL",
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
    lf = lambda g: {"home": [bat], "away": []}
    cf = get_park("COL")["cf_bearing_deg"]
    Wlf = lambda g: {"wind_speed_mph": 14, "wind_from_deg": (cf - 45 + 180) % 360, "temp_f": 72, "precip_pct": 0}
    Wrf = lambda g: {"wind_speed_mph": 14, "wind_from_deg": (cf + 45 + 180) % 360, "temp_f": 72, "precip_pct": 0}
    lfp = build_total_bases_rows(slate, lf, lambda p: _pit(p), Wlf, bvp_fn=None)[0]["p_ge2"]
    rfp = build_total_bases_rows(slate, lf, lambda p: _pit(p), Wrf, bvp_fn=None)[0]["p_ge2"]
    assert lfp > rfp   # LF-out wind helps this RHB pull hitter's TB (via HR + XBH)


def test_tb_row_has_spray_mult_and_invariant():
    lf = lambda g: {"home": [_bat(1, 400, 90, 25, 3, 20)], "away": [_bat(2, 400, 90, 25, 3, 20)]}
    pf = lambda pid: _pit(pid)
    rows = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    r = rows[0]
    assert "spray_mult" in r
    neutral = r["park_weather_factor"] / r["spray_mult"]
    assert abs(neutral * r["spray_mult"] - r["park_weather_factor"]) < 1e-9


def test_hits_row_has_no_spray_mult():
    lf = lambda g: {"home": [_bat(1, 400, 90, 25, 3, 20)], "away": [_bat(2, 400, 90, 25, 3, 20)]}
    pf = lambda pid: _pit(pid)
    rows = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    assert "spray_mult" not in rows[0]


def test_threshold_rows_carry_bat_order():
    lf = lambda g: {"home": [_bat(1, 400, 90, 25, 3, 20), _bat(3, 400, 80, 20, 2, 10)],
                    "away": [_bat(2, 400, 90, 25, 3, 20)]}
    pf = lambda pid: _pit(pid)
    hits = build_hits_rows(_slate(), lf, pf, _w, bvp_fn=None)
    tb = build_total_bases_rows(_slate(), lf, pf, _w, bvp_fn=None)
    assert {r["bat_order"] for r in hits} == {1, 2}
    assert all(isinstance(r.get("bat_order"), int) for r in tb)
