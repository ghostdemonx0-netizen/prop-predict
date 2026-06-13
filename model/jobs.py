"""Automation entrypoints (GitHub Actions): python -m model.jobs morning|refresh

morning  - clear BvP pairs, bring stats up to date through yesterday,
           rebuild today's board, record the slate signature.
refresh   - daily stat-update on the first run of each new day, then cheap structural change-check (early exit), else recompute today.

Both print and (under Actions) emit changed=true|false to $GITHUB_OUTPUT so
the workflow only deploys when the board actually moved. Any exception
propagates -> nonzero exit -> GitHub failure email; the site keeps its last
good board.
"""

import datetime as dt
import os
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

from model import daily, fetch
from model.cache import DEFAULT_DIR


def today_et() -> str:
    """The slate date is the EASTERN date (a 1am UTC run belongs to yesterday ET)."""
    return dt.datetime.now(ZoneInfo("America/New_York")).date().isoformat()


def _clear_bvp(cache_dir=DEFAULT_DIR) -> int:
    """Career head-to-head moves daily for pairs that faced off; re-pulls are cheap."""
    n = 0
    for f in Path(cache_dir).glob("bvp-*.json"):
        f.unlink()
        n += 1
    return n


def _current_signature(date_str: str) -> str:
    slate = fetch.get_schedule(date_str)
    lineups = {g["game_id"]: fetch.get_lineups(g["game_id"])
               for g in slate if not g.get("started")}
    return daily.slate_signature(slate, lineups)


def _record_current_signature(date_str: str, published: bool) -> None:
    daily.record_run(_current_signature(date_str), published=published)


def morning(date_str: str | None = None) -> bool:
    date_str = date_str or today_et()
    print(f"bvp pairs cleared: {_clear_bvp()}")
    print(f"stat days ingested: {daily.update_events(date_str)}")
    changed = daily.refresh_today(date_str)
    _record_current_signature(date_str, published=changed)
    return changed


def refresh(date_str: str | None = None) -> bool:
    date_str = date_str or today_et()
    # Self-healing daily stat update: the first refresh of a new day folds in
    # yesterday's finished games (cheap no-op the rest of the day) so the
    # system no longer depends on a separate, less-reliable morning timer.
    stats_updated = bool(daily.update_events(date_str))
    if stats_updated:
        print(f"folded in new game days; bvp pairs cleared: {_clear_bvp()}")
    sig = _current_signature(date_str)
    # Skip only when nothing changed AND we didn't just refresh the stats
    # (new stats must reach the board even if the lineup signature matches).
    if not stats_updated and daily.should_skip(sig):
        print("no lineup/pitcher changes since last publish - skipping")
        daily.record_run(sig, published=False)
        return False
    changed = daily.refresh_today(date_str)
    # a compute VERIFIES the board is current even when unchanged - advance
    # the freshness window so quiet stretches skip cheaply instead of
    # recomputing every run after 90 minutes
    daily.record_run(sig, published=True)
    return changed


def main(argv: list[str]) -> None:
    mode = argv[0] if argv else "refresh"
    if mode not in ("morning", "refresh"):
        raise SystemExit(f"unknown mode: {mode!r} (expected morning|refresh)")
    changed = morning() if mode == "morning" else refresh()
    flag = "true" if changed else "false"
    print(f"changed={flag}")
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"changed={flag}\n")


if __name__ == "__main__":
    main(sys.argv[1:])
