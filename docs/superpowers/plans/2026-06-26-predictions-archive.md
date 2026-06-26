# Predictions Archive (Phase 1 — Capture) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A per-game, lock-time recorder that snapshots every prediction (all props × thresholds × 3 weightings + full factor breakdown) into a private append-only `predictions-archive` git branch — never served to the live site, starts at turn-on, no backfill.

**Architecture:** A pure record-builder + dedup in a new `model/archive.py`, a CLI entrypoint that appends to a local date file, a `scripts/pull_archive.sh` read pipe, and a scheduled workflow that reads the latest board (from the `board-data` branch) and pushes new records to the `predictions-archive` branch. Decoupled from the board build — it *consumes* the published board JSON, changes no model math.

**Tech Stack:** Python (pytest, `uv run pytest`), bash, GitHub Actions.

Spec: `docs/superpowers/specs/2026-06-26-predictions-archive-design.md`.

## Global Constraints

- **PRIVACY (hard):** the recorder must NEVER write into `web/public/data` / `export_web.DATA_DIR` or anything the live site serves. Archive output goes only to the archive file / `predictions-archive` branch.
- **No model-math change:** the recorder only *records* existing board values; it must not alter any projection. (No math sign-off needed, but preview before enabling in prod.)
- **Append-only / idempotent:** re-running for the same date must never duplicate a game's records (dedup by `(game_id, player_id, prop)`).
- **Separate from `board-data`:** `board-data` is force-pushed every run; the archive branch is append-only and must never be force-pushed.
- **Starts at turn-on, no backfill.**
- Board payload keys (from `export_web` main payload): `hr, strikeouts, hits, total_bases, runs, rbi, hrr`, plus `games` (each with `game_id`, `game_time`, `started`). Reuse existing row fields verbatim.

---

### Task 1: Pure record builder (`model/archive.py`)

**Files:** Create `model/archive.py`; Test `tests/test_archive.py`

**Interfaces — Produces:**
- `THRESHOLDS = {"hr":[("p_ge1",1)], "hits":[("p_ge1",1),("p_ge2",2),("p_ge3",3)], "total_bases":[("p_ge2",2),("p_ge3",3),("p_ge4",4)], "runs":[("p_ge1",1),("p_ge2",2)], "rbi":[...], "hrr":[("p_ge2",2),("p_ge3",3),("p_ge4",4)]}` (K handled via its `over_prob`/`line`).
- `_blend(cur, hist)` → `(cur+hist)/2` when both present, else `cur`.
- `record_from_row(row, prop) -> dict` — one structured archive record from a board row: identity keys (game_id, game_time, player_id, player, team, bats, matchup, lineup_status, prop), `probs` (per threshold: {current, blend, history} from `p_geN` + `p_geN_hist`), `factors` (pitcher_factor, park_weather_factor, recent_form_mult, hard_hit_form, production_form + their `_hist` twins where present; opp pitcher from `vs`).
- `archive_records(board, now_iso, *, window_min=40) -> list[dict]` — for every game in `board["games"]` that is NOT started and whose `game_time` is within `window_min` of `now_iso`, emit `record_from_row` for each matching row across all prop lists. Each record also carries `date` and `captured_at=now_iso`.

- [ ] **Step 1: Write failing tests** — a small fake `board` with 2 games (one starting in 20 min, one in 5 hours) and a couple rows per prop. Assert: only the soon-starting game's rows are emitted; each record has the right thresholds with current/blend/history (blend = midpoint); factors carried; started games excluded; far-future game excluded.
- [ ] **Step 2:** Run, verify fail.
- [ ] **Step 3:** Implement the constants + 3 functions.
- [ ] **Step 4:** Run `uv run pytest tests/test_archive.py -q`, verify pass.
- [ ] **Step 5:** Commit.

### Task 2: Idempotent dedup (`model/archive.py`)

**Files:** Modify `model/archive.py`; Test `tests/test_archive.py`

**Interfaces — Produces:** `dedup_new(existing: list[dict], candidates: list[dict]) -> list[dict]` — return only candidates whose `(game_id, player_id, prop)` key is not already present in `existing`.

- [ ] **Step 1: Test** — existing has game 1/player 100/runs; candidates include that same key + a new one; assert only the new one returns.
- [ ] **Step 2:** Run, verify fail.
- [ ] **Step 3:** Implement (set of keys from existing, filter candidates).
- [ ] **Step 4:** Run, verify pass.
- [ ] **Step 5:** Commit.

### Task 3: Recorder CLI / file append (`model/archive.py`)

**Files:** Modify `model/archive.py`; Test `tests/test_archive.py`

**Interfaces — Produces:** `record_day(board_path, archive_path, now_iso, *, window_min=40) -> int` — load board JSON; load existing archive (JSONL; `[]` if file absent); `archive_records` → `dedup_new` vs existing → append new records as JSONL lines to `archive_path`; return count appended. Plus a `__main__` (`python -m model.archive <board_json> <archive_jsonl> [now_iso]`).

- [ ] **Step 1: Test** (tmp files) — write a board JSON + empty archive; run `record_day`; assert N lines written, each valid JSON. Run AGAIN with same inputs; assert 0 new lines (idempotent).
- [ ] **Step 2:** Run, verify fail.
- [ ] **Step 3:** Implement (json/jsonl read+write, append mode).
- [ ] **Step 4:** Run, verify pass.
- [ ] **Step 5:** Commit.

### Task 4: Read pipe (`scripts/pull_archive.sh`)

**Files:** Create `scripts/pull_archive.sh`

**Interfaces:** mirrors `scripts/pull_board.sh` — `git fetch origin predictions-archive --depth=1`; copy `archive/*.jsonl` from `origin/predictions-archive` into a local (gitignored) `web/archive/` dir via `git show ... > file` (unstaged, never committable). Prints what it pulled. Errors clearly if the branch doesn't exist yet.

- [ ] **Step 1:** Write the script (model on `scripts/pull_board.sh`; read-only, safe).
- [ ] **Step 2:** `bash -n scripts/pull_archive.sh` (syntax check) + `chmod +x`.
- [ ] **Step 3:** Add `web/archive/` to `.gitignore` (so a local pull never enters git / the public bundle).
- [ ] **Step 4:** Commit.

### Task 5: Scheduled archive workflow (`.github/workflows/archive-predictions.yml`)

**Files:** Create `.github/workflows/archive-predictions.yml`

A workflow on the same ~30-min cron as board-refresh (offset a few min later so the board is fresh). Steps: checkout; fetch the latest board (`git show origin/board-data:web/public/data/latest.json > /tmp/board.json`); fetch the current date's archive file from `predictions-archive` (or empty if first run); `python -m model.archive /tmp/board.json archive/<date>.jsonl <now>`; if new lines were appended, commit the date file to `predictions-archive` and push (NO force). Must write ONLY the archive file — never `web/public/data`.

- [ ] **Step 1:** Write the workflow YAML (mirror auth/secrets + git identity from `board-refresh.yml`; use a `predictions-archive` worktree/branch; append + normal push).
- [ ] **Step 2:** Document seeding: create the `predictions-archive` branch as an empty orphan (`git checkout --orphan predictions-archive && git rm -rf . && mkdir archive && git commit --allow-empty -m "seed predictions archive" && git push`) — a one-time manual/owner step before enabling.
- [ ] **Step 3:** Privacy: confirm the workflow has no step touching `web/public/data`.
- [ ] **Step 4:** Commit.

### Task 6: Privacy guard test + docs

**Files:** Modify `tests/test_archive.py`; Modify the spec/README note

**Interfaces:** a test that `record_day` writes only to its `archive_path` and leaves any `export_web.DATA_DIR` untouched (call it with a tmp DATA_DIR monkeypatched and assert no files created there).

- [ ] **Step 1: Test** — monkeypatch `export_web.DATA_DIR` to an empty tmp dir; run `record_day` to a separate archive path; assert the tmp DATA_DIR is still empty.
- [ ] **Step 2:** Run, verify pass (privacy guaranteed by construction; the test pins it).
- [ ] **Step 3:** Commit.

---

## Self-review notes
- Spec coverage: capture schema → T1; idempotency → T2/T3; storage/append → T3/T5; read access → T4; privacy → T6 + global constraint; separate append-only branch → T5; starts-at-turn-on/no-backfill → inherent (recorder only sees live boards). ✓
- No model-math change: recorder only reads board JSON; touches no model/projection code. ✓
- After build: preview locally (run the recorder against a pulled board, inspect the JSONL), seed the branch, enable the workflow, verify first day's archive lands + site unaffected. Then Phase 2 (grading) is its own spec.
