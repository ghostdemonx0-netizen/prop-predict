from pathlib import Path
from model.daily import sweep_stale_season_caches


def test_sweeps_only_out_of_window(tmp_path):
    for nm in ["bat-events-1-2026.json", "bat-events-1-2024.json", "bat-events-1-2023.json",
               "pit-events-9-2022.json", "bat-events-2021-2026.json", "bvp-1-2.json"]:
        (tmp_path / nm).write_text("[]")
    deleted = sweep_stale_season_caches(2026, keep=3, cache_dir=tmp_path)
    names = {Path(d).name for d in deleted}
    # Files with year <= 2023 (outside the 3-year window) are deleted
    assert names == {"bat-events-1-2023.json", "pit-events-9-2022.json"}
    assert (tmp_path / "bat-events-1-2026.json").exists()
    assert (tmp_path / "bat-events-1-2024.json").exists()
    assert (tmp_path / "bat-events-2021-2026.json").exists()  # 4-digit pid, in-window year; regex anchors to year
    assert (tmp_path / "bvp-1-2.json").exists()  # untouched
