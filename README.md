# predictions-archive (append-only)

Private prediction log for prop-predict. Each `archive/YYYY-MM-DD.jsonl` holds one
JSON record per (game, player, prop) captured **at lock** (once a game freezes),
with every probability (all thresholds × current/blend/history) and the full factor
breakdown — for later calibration/grading against box scores.

Written ONLY by the `archive-predictions` GitHub Action. Never served by the live site.
