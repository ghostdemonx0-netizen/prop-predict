"""One-time warmer for prior-season event caches (run off-budget, not in a 30-min job)."""
import sys
from model import fetch
from model.cache import get_or_compute


def prime_prior_seasons(player_ids: list[int], current_season: int, *, batter: bool = True) -> int:
    fetcher = fetch.batter_events if batter else fetch.pitcher_events
    prefix = "bat-events" if batter else "pit-events"
    n = 0
    for pid in player_ids:
        for yr in (current_season - 1, current_season - 2):
            get_or_compute(f"{prefix}-{pid}-{yr}", lambda pid=pid, yr=yr: fetcher(pid, yr))
            n += 1
    return n


if __name__ == "__main__":
    season = int(sys.argv[1]) if len(sys.argv) > 1 else int(fetch.get_schedule.__defaults__ or [0])
    # warm prior seasons for everyone on today's slate (extend to more days as needed)
    from model import export_web
    import datetime as dt
    today = dt.date.today().isoformat()
    slate = fetch.get_schedule(today)
    pids: set[int] = set()
    for g in slate:
        official = fetch.get_lineups(g["game_id"])
        for side, tk in (("home", "home_id"), ("away", "away_id")):
            pids.update(official.get(side) or (fetch.get_recent_lineup(g.get(tk), today) if g.get(tk) else []))
        for pk in ("home_pitcher_id", "away_pitcher_id"):
            if g.get(pk):
                pids.add(g[pk])
    season = season or int(today[:4])
    b = prime_prior_seasons(sorted(pids), season, batter=True)
    p = prime_prior_seasons(sorted(pids), season, batter=False)
    print(f"warmed {b} batter + {p} pitcher prior-season caches for {len(pids)} players")
