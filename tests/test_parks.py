import pytest
from model.parks import get_park, hr_park_factor, PARKS, hit_park_factor, hit_factors_stale


def test_known_park_has_required_fields():
    park = get_park("COL")
    assert park["name"] == "Coors Field"
    assert park["hr_factor"] == pytest.approx(1.22)
    assert 0 <= park["cf_bearing_deg"] < 360
    assert park["dome"] is False


def test_hr_park_factor_returns_float():
    assert hr_park_factor("COL") == pytest.approx(1.22)
    assert isinstance(hr_park_factor("COL"), float)


def test_unknown_team_defaults_to_neutral():
    park = get_park("ZZZ")
    assert park["hr_factor"] == pytest.approx(1.0)
    assert park["dome"] is False
    assert hr_park_factor("ZZZ") == pytest.approx(1.0)


def test_every_park_entry_is_well_formed():
    for abbr, p in PARKS.items():
        assert set(p) == {"name", "hr_factor", "cf_bearing_deg", "dome"}
        assert isinstance(p["hr_factor"], float)
        assert 0 <= p["cf_bearing_deg"] < 360
        assert isinstance(p["dome"], bool)


def test_get_park_returns_independent_copy():
    a = get_park("ZZZ")
    a["dome"] = True
    b = get_park("ZZZ")
    assert b["dome"] is False  # mutating one result must not affect later calls


def test_park_names_are_title_cased():
    """Display names must read Title Case (official 'loanDepot park'-style branding gets normalized)."""
    from model.parks import PARKS
    for abbr, park in PARKS.items():
        for word in park["name"].split():
            first = word[0]
            assert not first.isalpha() or first.isupper(), f"{abbr}: {park['name']!r}"


# --- hit_park_factor tests ---

def test_hit_park_factor_col_3b():
    assert hit_park_factor("COL", "3b") == pytest.approx(1.35)


def test_hit_park_factor_sea_3b():
    assert hit_park_factor("SEA", "3b") == pytest.approx(0.80)


def test_hit_park_factor_unknown_park():
    assert hit_park_factor("UNKNOWN", "1b") == pytest.approx(1.0)


def test_hit_park_factor_unknown_kind():
    assert hit_park_factor("COL", "4b") == pytest.approx(1.0)


# --- hit_factors_stale tests ---

def test_hit_factors_stale_same_day():
    assert hit_factors_stale("2026-06-22") is False


def test_hit_factors_stale_over_400_days():
    assert hit_factors_stale("2027-09-01") is True


def test_hit_factors_stale_exactly_365_days():
    assert hit_factors_stale("2027-06-22") is False
