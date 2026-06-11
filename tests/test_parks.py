import pytest
from model.parks import get_park, hr_park_factor, PARKS


def test_known_park_has_required_fields():
    park = get_park("COL")
    assert park["name"] == "Coors Field"
    assert park["hr_factor"] == pytest.approx(1.22)
    assert 0 <= park["cf_bearing_deg"] < 360
    assert park["dome"] is False


def test_hr_park_factor_returns_float():
    assert hr_park_factor("COL") == pytest.approx(1.22)


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
