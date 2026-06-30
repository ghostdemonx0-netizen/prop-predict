import math
from model.pipeline import build_runs_rows, build_rbi_rows, build_hrr_rows
from model import run_props
from model.matchup import hr_platoon_mult
from model.parks import run_park_factor, hrr_park_factor

def _bat(pid, games, r, rbi, hrr, *, recent_games=0, recent_r=0, recent_rbi=0, recent_hrr=0, recent_form_mult=1.0):
    return {"player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
            "games": games, "total_r": r, "total_rbi": rbi, "total_hrr": hrr,
            "recent_games": recent_games, "recent_r": recent_r, "recent_rbi": recent_rbi,
            "recent_hrr": recent_hrr, "recent_form_mult": recent_form_mult,
            "k_rate": 0.22, "hit_rate": 0.25, "lineup_status": "confirmed"}

def _pit(pid):
    return {"player_id": pid, "name": str(pid), "team": "BBB", "throws": "R",
            "k_per_bf": 0.22, "hit_allowed_rate": 0.22, "hr_allowed_rate": 0.033, "bf": 300}

_SLATE = [{"game_id": 1, "home": "AAA", "away": "BBB", "park_team": "AAA",
           "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]
_L = lambda g: {"home": [_bat(1, 100, 60, 70, 200)], "away": [_bat(2, 100, 50, 50, 180)]}
_W = lambda g: {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}

def test_runs_rows_have_two_thresholds_in_range():
    rows = build_runs_rows(_SLATE, _L, lambda p: _pit(p), _W)
    r = next(x for x in rows if x["player_id"] == 1)
    assert 0.0 < r["p_ge1"] <= 1.0 and 0.0 <= r["p_ge2"] <= r["p_ge1"]
    assert r["prop"] == "RUNS" and r["vs"]["lean"] in ("K", "H", "NEU")

    # Independent recomputation: catch wrong-league/field regressions.
    # Approach C: the lone home batter has no neighbors -> teammate-neutral, so its
    # Runs lineup multiplier is the slot(1) baseline blended at the confirmed weight.
    _rate = run_props.regressed_per_game(60, 100, run_props.LEAGUE_R_PER_GAME, run_props.REG_GAMES)
    _lmult = run_props.lineup_mult(run_props.slot_factor(1, "RUNS"), 1.0, "confirmed")
    _lam = run_props.expected_count(_rate, pitcher_mult=run_props.pitcher_suppression_mult(0.22),
                                    platoon_mult=hr_platoon_mult("R", "R"), park_mult=run_park_factor("AAA"),
                                    lineup_mult=_lmult)
    assert math.isclose(r["p_ge1"], run_props.ge_probs(_lam, [("p_ge1", 1)])["p_ge1"])

def test_rbi_and_hrr_rows_thresholds():
    rbi = build_rbi_rows(_SLATE, _L, lambda p: _pit(p), _W)[0]
    assert "p_ge1" in rbi and "p_ge2" in rbi and rbi["prop"] == "RBI"
    hrr = build_hrr_rows(_SLATE, _L, lambda p: _pit(p), _W)[0]
    assert all(k in hrr for k in ("p_ge2", "p_ge3", "p_ge4")) and hrr["prop"] == "HRR"
    assert hrr["p_ge2"] >= hrr["p_ge3"] >= hrr["p_ge4"]   # monotonic

    # Independent recomputation: catch wrong-league/field regressions on HRR
    _hrate = run_props.regressed_per_game(200, 100, run_props.LEAGUE_HRR_PER_GAME, run_props.REG_GAMES)
    _hlam = run_props.expected_count(_hrate, pitcher_mult=run_props.pitcher_suppression_mult(0.22),
                                     platoon_mult=hr_platoon_mult("R", "R"), park_mult=run_park_factor("AAA"))
    assert math.isclose(hrr["p_ge2"], run_props.ge_probs(_hlam, [("p_ge2", 2)], nb_size=run_props.HRR_NB_SIZE)["p_ge2"])


# ---------------------------------------------------------------------------
# R4 tests: production form wiring + HRR park factor
# ---------------------------------------------------------------------------

def _bat_col(pid, games, r, rbi, hrr, *, recent_games=0, recent_r=0, recent_rbi=0, recent_hrr=0, recent_form_mult=1.0):
    """Batter playing for COL (Coors Field) to test park factor routing."""
    return {"player_id": pid, "name": str(pid), "team": "COL", "bats": "R",
            "games": games, "total_r": r, "total_rbi": rbi, "total_hrr": hrr,
            "recent_games": recent_games, "recent_r": recent_r, "recent_rbi": recent_rbi,
            "recent_hrr": recent_hrr, "recent_form_mult": recent_form_mult,
            "k_rate": 0.22, "hit_rate": 0.25, "lineup_status": "confirmed"}


_SLATE_COL = [{"game_id": 2, "home": "COL", "away": "SD", "park_team": "COL",
               "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]

_W_COL = lambda g: {"wind_speed_mph": 0, "wind_from_deg": 0, "temp_f": 70, "precip_pct": 0}


def test_production_form_hot_batter_raises_p_ge1():
    """Hot batter (elevated recent production) gets production_form > 1.0 and higher p_ge1."""
    # Season: 60 R in 100 games → rate 0.60/game
    # Recent: 12 R in 15 games → 0.80/game → hot vs season_rate ~0.60 → production_form > 1.0
    hot_batter = _bat(10, 100, 60, 70, 200,
                      recent_games=15, recent_r=12, recent_rbi=14, recent_hrr=35,
                      recent_form_mult=1.0)
    # Neutral batter: same season stats but no recent data → production_form = 1.0
    neutral_batter = _bat(11, 100, 60, 70, 200,
                          recent_games=0, recent_r=0, recent_rbi=0, recent_hrr=0,
                          recent_form_mult=1.0)

    slate = [{"game_id": 3, "home": "AAA", "away": "BBB", "park_team": "AAA",
              "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]

    # Home lineup: hot_batter; Away lineup: neutral_batter (faces same pitcher)
    def lineups_fn(g):
        return {"home": [hot_batter], "away": [neutral_batter]}

    rows = build_runs_rows(slate, lineups_fn, lambda p: _pit(p), _W)

    hot_row = next(r for r in rows if r["player_id"] == 10)
    neutral_row = next(r for r in rows if r["player_id"] == 11)

    # production_form should be > 1.0 for the hot batter
    assert hot_row["production_form"] > 1.0, (
        f"Expected production_form > 1.0 for hot batter, got {hot_row['production_form']}"
    )
    # hot batter gets higher p_ge1
    assert hot_row["p_ge1"] > neutral_row["p_ge1"], (
        f"Hot batter p_ge1={hot_row['p_ge1']} should exceed neutral p_ge1={neutral_row['p_ge1']}"
    )
    # hard_hit_form and recent_form_mult (blended) are present
    assert "hard_hit_form" in hot_row
    assert "recent_form_mult" in hot_row


def test_hrr_uses_hrr_park_factor_runs_uses_run_park_factor_col():
    """For COL games, HRR rows use hrr_park_factor(COL) and Runs rows use run_park_factor(COL), and they differ."""
    batter = _bat_col(20, 100, 60, 70, 200)

    def lineups_fn(g):
        return {"home": [batter], "away": []}

    hrr_rows = build_hrr_rows(_SLATE_COL, lineups_fn, lambda p: _pit(p), _W_COL)
    runs_rows = build_runs_rows(_SLATE_COL, lineups_fn, lambda p: _pit(p), _W_COL)

    hrr_row = next(r for r in hrr_rows if r["player_id"] == 20)
    runs_row = next(r for r in runs_rows if r["player_id"] == 20)

    expected_hrr_park = hrr_park_factor("COL")
    expected_run_park = run_park_factor("COL")

    assert math.isclose(hrr_row["park_weather_factor"], expected_hrr_park), (
        f"HRR row park_weather_factor={hrr_row['park_weather_factor']} != hrr_park_factor('COL')={expected_hrr_park}"
    )
    assert math.isclose(runs_row["park_weather_factor"], expected_run_park), (
        f"Runs row park_weather_factor={runs_row['park_weather_factor']} != run_park_factor('COL')={expected_run_park}"
    )
    assert expected_hrr_park != expected_run_park, "COL hrr_park_factor and run_park_factor should differ"
    assert hrr_row["park_weather_factor"] != runs_row["park_weather_factor"], (
        "HRR and Runs park_weather_factor should differ for COL"
    )


# ---------------------------------------------------------------------------
# Task 2 (Phase A): split park_factor / weather_factor for TB rows
# ---------------------------------------------------------------------------

# Pinned baseline from current code (pre-implementation); must NOT change post-implementation.
_PINNED_TB_P_GE2 = 0.39634350464612905
_PINNED_TB_P_GE3 = 0.23083415252074782
_PINNED_TB_P_GE4 = 0.15761146289006178


def _bat_tb(pid):
    """TB batter fixture with season hit/XBH components needed by _batter_outcome_vector."""
    return {
        "player_id": pid, "name": str(pid), "team": "AAA", "bats": "R",
        "season_pa": 400, "season_1b": 55, "season_2b": 20, "season_3b": 2, "season_hr": 10,
        "hit_rate": 0.25, "k_rate": 0.22,
        "recent_form_mult": 1.0,
        "lineup_status": "confirmed",
    }


_SLATE_TB = [{"game_id": 10, "home": "AAA", "away": "BBB", "park_team": "AAA",
               "home_pitcher_id": 100, "away_pitcher_id": 200, "started": False}]


def _build_tb_rows_for_test():
    from model.pipeline import build_total_bases_rows
    batter = _bat_tb(99)
    def lineups_fn(g):
        return {"home": [batter], "away": []}
    return build_total_bases_rows(_SLATE_TB, lineups_fn, lambda p: _pit(p), _W)


def test_tb_rows_split_park_and_weather_without_changing_probs():
    """park_factor and weather_factor are captured; projections p_ge2/3/4 are unchanged."""
    rows = _build_tb_rows_for_test()
    r = rows[0]
    # New fields exist and are sane multipliers
    assert "park_factor" in r and "weather_factor" in r
    assert 0.5 < r["park_factor"] < 2.0
    assert 0.5 < r["weather_factor"] < 2.0
    # Split is consistent with the combined factor (within rounding)
    assert abs(r["park_factor"] * r["weather_factor"] - r["park_weather_factor"]) < 0.05
    # PROJECTIONS UNCHANGED: pin the p_ge values to the pre-change output
    assert r["p_ge2"] == _PINNED_TB_P_GE2
    assert r["p_ge3"] == _PINNED_TB_P_GE3
    assert r["p_ge4"] == _PINNED_TB_P_GE4


# --- HRR negative-binomial tail ---

def test_hrr_cfg_routes_through_nb_runs_does_not():
    from model.pipeline import _RUN_PROP_CFG
    assert _RUN_PROP_CFG["HRR"].get("nb_size") == run_props.HRR_NB_SIZE
    assert _RUN_PROP_CFG["RUNS"].get("nb_size") is None
    assert _RUN_PROP_CFG["RBI"].get("nb_size") is None


def test_hrr_row_uses_negative_binomial_tail():
    hrr = build_hrr_rows(_SLATE, _L, lambda p: _pit(p), _W)[0]
    # Reconstruct the HRR mean the pipeline used (single batter -> no neighbors ->
    # lineup mult is neutral; no recent form).
    rate = run_props.regressed_per_game(200, 100, run_props.LEAGUE_HRR_PER_GAME, run_props.REG_GAMES)
    lam = run_props.expected_count(
        rate, pitcher_mult=run_props.pitcher_suppression_mult(0.22),
        platoon_mult=hr_platoon_mult("R", "R"), park_mult=hrr_park_factor("AAA"),
        form_mult=1.0, lineup_mult=1.0)
    assert math.isclose(
        hrr["p_ge3"], run_props.ge_probs(lam, [("p_ge3", 3)], nb_size=run_props.HRR_NB_SIZE)["p_ge3"])
    # NB tail is fatter than Poisson at the same mean
    assert hrr["p_ge3"] > run_props.ge_probs(lam, [("p_ge3", 3)])["p_ge3"]


def test_run_prop_rows_carry_bat_order():
    L2 = lambda g: {"home": [_bat(1, 100, 60, 70, 200), _bat(3, 100, 40, 40, 150)],
                    "away": [_bat(2, 100, 50, 50, 180)]}
    for build in (build_runs_rows, build_rbi_rows, build_hrr_rows):
        rows = build(_SLATE, L2, lambda p: _pit(p), _W)
        assert all(isinstance(r.get("bat_order"), int) for r in rows)
        assert min(r["bat_order"] for r in rows) == 1
        assert max(r["bat_order"] for r in rows) == 2
