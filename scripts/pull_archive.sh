#!/usr/bin/env bash
# Pull the latest predictions archive (archive/*.jsonl) from the
# `predictions-archive` branch into a local (gitignored) web/archive/ directory.
#
# The first-run / nightly archive scripts push every graded prediction to the
# `predictions-archive` branch. This grabs that snapshot in seconds — no auth
# needed, no live-site access required — so Phase 2 analysis jobs can read the
# full history locally.
#
# IMPORTANT: it writes the files with `git show > file`, NOT `git checkout -- `,
# so the archive lands in the working tree UNSTAGED and can never be committed by
# accident (web/archive/ is also gitignored). Run this before any local analysis
# job that needs the full archive (e.g. calibration reports).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if ! git fetch -q origin predictions-archive --depth=1 2>/dev/null; then
  echo "ERROR: no 'predictions-archive' branch on origin yet." >&2
  echo "It is seeded by the first archive run (scripts/archive_predictions.py)." >&2
  exit 1
fi

mkdir -p web/archive

# List every file inside the archive/ tree on the branch, then copy each one
# into web/archive/ via `git show` — this keeps them unstaged and gitignored.
files=$(git ls-tree --name-only origin/predictions-archive archive/ 2>/dev/null || true)

if [ -z "$files" ]; then
  echo "WARNING: 'predictions-archive' branch exists but archive/ is empty." >&2
  exit 1
fi

count=0
for filepath in $files; do
  filename=$(basename "$filepath")
  git show "origin/predictions-archive:${filepath}" > "web/archive/${filename}"
  count=$((count + 1))
done

echo "pulled ${count} archive file(s) into web/archive/ — unstaged, safe."
echo "  files: $(echo "$files" | xargs -n1 basename | tr '\n' ' ')"
