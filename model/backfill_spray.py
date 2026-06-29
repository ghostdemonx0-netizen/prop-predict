"""One-time warmer for the per-batter spray cache (run off-budget, not in a 30-min job)."""
import sys
from model import fetch
from model.cache import get_or_compute


def prime_spray(player_ids: list[int], current_season: int) -> int:
    """Warm bat-spray-{pid}-{year} for current + 2 prior seasons. Returns count primed."""
    n = 0
    for pid in player_ids:
        for yr in (current_season, current_season - 1, current_season - 2):
            get_or_compute(f"bat-spray-{pid}-{yr}", lambda pid=pid, yr=yr: fetch.batter_spray(pid, yr))
            n += 1
    return n


if __name__ == "__main__":
    season = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    print(f"usage: import prime_spray(player_ids, season). season arg = {season}")
