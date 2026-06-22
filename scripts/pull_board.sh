#!/usr/bin/env bash
# Pull the latest model board (latest.json + index.json) from the `board-data`
# branch into the working tree.
#
# The board-refresh / board-morning workflows push the fresh board to the
# `board-data` branch every run (morning + ~every 30 min). This grabs that
# snapshot in seconds — far faster than a local rebuild, and it works without
# the site's login wall.
#
# IMPORTANT: it writes the files with `git show > file`, NOT `git checkout -- `,
# so the board lands in the working tree UNSTAGED and can never be committed by
# accident (web/public/data is also gitignored). Run this before any local job
# that needs a current board (e.g. the manual report).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if ! git fetch -q origin board-data --depth=1 2>/dev/null; then
  echo "ERROR: no 'board-data' branch on origin yet." >&2
  echo "It is seeded by the first board-refresh/board-morning run after this was added." >&2
  exit 1
fi

mkdir -p web/public/data
git show origin/board-data:web/public/data/latest.json > web/public/data/latest.json
git show origin/board-data:web/public/data/index.json  > web/public/data/index.json

date=$(python3 -c "import json;print(json.load(open('web/public/data/latest.json'))['date'])" 2>/dev/null || echo '?')
echo "pulled fresh board (date: $date) into web/public/data/ — unstaged, safe."
