# Date Filter / Past-Week Browse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let visitors browse projections for any of the last ~7 days via a date picker — including a fix so past (finished) games show their real starting pitchers (and therefore strikeouts + matchups), not just hitters.

**Architecture:** Add `fetch.get_starters` to read the actual starters from a finished game's boxscore (the schedule's "probable pitcher" is blank once a game ends). `export_web` fills any missing pitcher ids from that, writes one data file per date (`web/public/data/<date>.json`), and maintains an `index.json` manifest. A `backfill` script generates the last N days (cached, so fast after the first day). The website reads `index.json`, shows a date `<select>`, and loads the chosen day's file.

**Tech Stack:** Existing engine (`model/`), `pybaseball`, `MLB-StatsAPI`, `pytest`; Next.js web app (`web/`). No new dependencies.

---

## File Structure

```
prop-predict/
  model/
    fetch.py        # MODIFY: add get_starters(game_id) -> {"home": pid|None, "away": pid|None}
    export_web.py   # MODIFY: fill missing starters; write <date>.json + index.json (+ latest.json copy)
    backfill.py     # CREATE: regenerate the last N days
  tests/
    test_fetch_smoke.py  # MODIFY: smoke test for get_starters
  web/
    lib/data.ts     # MODIFY: loadIndex() + loadProjections(date)
    app/page.tsx    # MODIFY: date-picker state + <select>
    public/data/
      index.json    # CREATE (sample): {"dates": ["2026-06-10"]}
      2026-06-10.json  # CREATE (sample): the current sample payload, renamed from latest.json
  .gitignore        # MODIFY: ignore generated per-date data files, keep the two samples
```

**Data-dir contract:**
- `web/public/data/index.json` = `{"dates": ["YYYY-MM-DD", ...]}` (newest first).
- `web/public/data/<date>.json` = `{date, updated, hr, strikeouts, games}` (same payload shape as today).
- The site loads `index.json`, defaults to the newest date, and loads that `<date>.json`.

---

### Task 1: Fetch actual starters from the boxscore

**Files:**
- Modify: `model/fetch.py` (add `get_starters`)
- Test: `tests/test_fetch_smoke.py` (append)

- [ ] **Step 1: Append a smoke test** to `tests/test_fetch_smoke.py`:

```python
def test_get_starters_smoke():
    from model.fetch import get_schedule, get_starters
    games = get_schedule("2026-06-10")
    finished = [g for g in games if g["started"]]
    assert finished, "need a finished game (its starters live in the boxscore)"
    s = get_starters(finished[0]["game_id"])
    assert set(s) == {"home", "away"}
    # a completed game has a starting pitcher id for each side
    assert isinstance(s["home"], int) and isinstance(s["away"], int)
```

- [ ] **Step 2: Run to verify it fails**

Run: `export PATH="$HOME/.local/bin:$PATH" && uv run pytest tests/test_fetch_smoke.py -m smoke -k get_starters -v`
Expected: FAIL (ImportError: cannot import name 'get_starters').

- [ ] **Step 3: Append the implementation** to `model/fetch.py`:

```python
def get_starters(game_id: int) -> dict[str, int | None]:
    """Actual starting pitcher MLBAM ids from a game's boxscore: {"home", "away"}.

    The boxscore's per-side `pitchers` list is in appearance order, so [0] is
    the starter. Returns None for a side if unavailable. Use this for finished
    games, whose schedule "probable pitcher" fields are blank.
    """
    try:
        box = statsapi.boxscore_data(game_id)
    except Exception:
        return {"home": None, "away": None}
    out: dict[str, int | None] = {"home": None, "away": None}
    for side in ("home", "away"):
        pitchers = box.get(side, {}).get("pitchers", []) or []
        out[side] = int(pitchers[0]) if pitchers else None
    return out
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/test_fetch_smoke.py -m smoke -k get_starters -v`
Expected: PASS (for 2026-06-10's finished BOS @ TB this returns Rasmussen/Bennett ids). If 2026-06-10 has no finished game, use a recent past date with a completed game and note it.

- [ ] **Step 5: Commit**

```bash
git add model/fetch.py tests/test_fetch_smoke.py
git commit -m "feat: fetch actual starting pitchers from the boxscore"
```

---

### Task 2: Fill missing starters in export_web

**Files:**
- Modify: `model/export_web.py`

- [ ] **Step 1: Add a starter-fill helper and call it.** In `model/export_web.py`, add this function above `main`:

```python
def _ensure_starters(slate: list[dict]) -> None:
    """Populate home/away_pitcher_id from the boxscore when the schedule's
    probable-pitcher fields are blank (true for finished games)."""
    for g in slate:
        if g.get("home_pitcher_id") and g.get("away_pitcher_id"):
            continue
        s = fetch.get_starters(g["game_id"])
        g["home_pitcher_id"] = g.get("home_pitcher_id") or s["home"]
        g["away_pitcher_id"] = g.get("away_pitcher_id") or s["away"]
```

Then in `main`, call it right after the `include_started` block (after the slate is finalized, before the `pids` loop):
```python
    _ensure_starters(slate)
```

- [ ] **Step 2: Manual verification (bounded).** The 2026-06-10 *batters* are cached from the earlier backfill, but the starters weren't fetched then (there were no pitcher ids), so this run pulls ~2 starters fresh (~1-2 min for one game):

Run: `export PATH="$HOME/.local/bin:$PATH" && uv run python -m model.export_web 2026-06-10 1 --include-started`
Expected: prints a line with **non-zero K rows** now (e.g., `... 2 K rows ...`) because the starters are filled from the boxscore. (HR rows will also now have a `vs` pitcher.) Confirm with:
```bash
node -e "const d=require('./web/public/data/latest.json'); console.log('K rows', d.strikeouts.length, '| first HR vs', d.hr[0] && d.hr[0].vs && d.hr[0].vs.name)"
```
Expected: K rows > 0 and a real pitcher name for the first HR's `vs`.

- [ ] **Step 3: Commit**

```bash
git add model/export_web.py
git commit -m "feat: fill missing starting pitchers from boxscore in export_web"
```

---

### Task 3: Per-date output files + index manifest

**Files:**
- Modify: `model/export_web.py`

- [ ] **Step 1: Replace the output section of `main`.** Find the block that builds `OUT` / writes the payload / prints, and the `OUT = ...` module constant. Replace the module-level `OUT = ...` line with:

```python
DATA_DIR = Path(__file__).resolve().parent.parent / "web" / "public" / "data"
```

Then replace the payload-writing tail of `main` (from `OUT.parent.mkdir(...)` through the final `print(...)`) with:

```python
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / f"{date_str}.json").write_text(json.dumps(payload, indent=2))
    # latest.json mirrors the date just written (fallback default for the site)
    (DATA_DIR / "latest.json").write_text(json.dumps(payload, indent=2))
    _update_index(date_str)
    print(f"Wrote {date_str}.json ({len(hr_rows)} HR rows, {len(k_rows)} K rows, {len(payload['games'])} games)")
```

- [ ] **Step 2: Add the `_update_index` helper** above `main`:

```python
def _update_index(date_str: str) -> None:
    """Maintain web/public/data/index.json: a newest-first list of dates that
    have a data file, limited to the most recent 14."""
    index_path = DATA_DIR / "index.json"
    dates: list[str] = []
    if index_path.exists():
        try:
            dates = json.loads(index_path.read_text()).get("dates", [])
        except (json.JSONDecodeError, OSError):
            dates = []
    dates = sorted(set(dates) | {date_str}, reverse=True)[:14]
    index_path.write_text(json.dumps({"dates": dates}, indent=2))
```

- [ ] **Step 3: Manual verification.**

Run: `uv run python -m model.export_web 2026-06-10 1 --include-started`
Then:
```bash
node -e "console.log('index:', JSON.stringify(require('./web/public/data/index.json')))"
node -e "console.log('date file exists, HR:', require('./web/public/data/2026-06-10.json').hr.length)"
```
Expected: index lists `2026-06-10`; the `2026-06-10.json` file exists with HR rows.

- [ ] **Step 4: Commit**

```bash
git add model/export_web.py
git commit -m "feat: export_web writes per-date data files + index.json manifest"
```

---

### Task 4: Backfill script for the last N days

**Files:**
- Create: `model/backfill.py`

- [ ] **Step 1: Create `model/backfill.py`:**

```python
"""Regenerate the last N days of data files (default 7).

Usage:
    uv run python -m model.backfill 2026-06-10 7 [max_games]
First arg is the most-recent date to include; it walks backwards N days.
Past games are included (finished games still have boxscore starters), and
player Statcast pulls are cached so repeated days are fast.
"""

import datetime as dt
import sys

from model import export_web


def main(end_date: str, days: int = 7, max_games: int | None = None) -> None:
    end = dt.date.fromisoformat(end_date)
    for i in range(days):
        d = (end - dt.timedelta(days=i)).isoformat()
        print(f"=== backfilling {d} ===")
        try:
            export_web.main(d, max_games=max_games, include_started=True)
        except Exception as e:  # one bad day shouldn't abort the whole backfill
            print(f"  skipped {d}: {e}")


if __name__ == "__main__":
    end = sys.argv[1] if len(sys.argv) > 1 else dt.date.today().isoformat()
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 7
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else None
    main(end, n, limit)
```

- [ ] **Step 2: Verify it imports and runs one day** (cached, fast):

Run: `uv run python -m model.backfill 2026-06-10 1 1`
Expected: prints `=== backfilling 2026-06-10 ===` then the per-date write line. (A full multi-day backfill is run later in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add model/backfill.py
git commit -m "feat: add backfill script for the last N days"
```

---

### Task 5: Repo sample data as per-date files

**Files:**
- Rename: `web/public/data/latest.json` → `web/public/data/2026-06-10.json`
- Create: `web/public/data/index.json`
- Modify: `.gitignore`

- [ ] **Step 1: Restore the handcrafted sample, then set up the sample per-date files.** (The working copy of `latest.json` currently holds a real backfill; restore the committed sample first.)

```bash
cd /Users/issiakadiawara/Projects/prop-predict
git checkout web/public/data/latest.json   # restore the committed handcrafted sample
cp web/public/data/latest.json web/public/data/2026-06-10.json
printf '{\n  "dates": ["2026-06-10"]\n}\n' > web/public/data/index.json
```

- [ ] **Step 2: Update `.gitignore`** so generated per-date files aren't committed, but the two samples are. Append:

```
# generated per-date data (keep only the committed samples)
web/public/data/*.json
!web/public/data/index.json
!web/public/data/2026-06-10.json
!web/public/data/latest.json
```

- [ ] **Step 3: Verify the samples are tracked and others are ignored**

```bash
git add -A web/public/data .gitignore
git status --porcelain web/public/data
```
Expected: `index.json`, `2026-06-10.json`, `latest.json` show as tracked/added; no other date files appear.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: per-date sample data files + index.json; ignore generated dates"
```

---

### Task 6: Web data loader supports dates + index

**Files:**
- Modify: `web/lib/data.ts`

- [ ] **Step 1: Replace `web/lib/data.ts`** with:

```ts
import type { Projections } from "./types";

export async function loadIndex(): Promise<string[]> {
  const res = await fetch("/data/index.json", { cache: "no-store" });
  if (!res.ok) return [];
  const json = (await res.json()) as { dates?: string[] };
  return json.dates ?? [];
}

export async function loadProjections(date?: string): Promise<Projections> {
  const url = date ? `/data/${date}.json` : "/data/latest.json";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load projections: ${res.status}`);
  return (await res.json()) as Projections;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/issiakadiawara/Projects/prop-predict/web && npx tsc --noEmit`
Expected: no errors (the page still calls `loadProjections()` with no arg until Task 7).

- [ ] **Step 3: Commit**

```bash
cd /Users/issiakadiawara/Projects/prop-predict
git add web/lib/data.ts
git commit -m "feat: web data loader supports per-date files + index"
```

---

### Task 7: Date picker on the board page

**Files:**
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Add date state + the picker.** In `web/app/page.tsx`, add two state hooks alongside the existing ones (`data`, `mode`, `prop`):

```tsx
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
```

Replace the existing `useEffect` (the one that calls `loadProjections().then(setData)`) with two effects:

```tsx
  useEffect(() => {
    loadIndex().then((ds) => {
      setDates(ds);
      setSelectedDate(ds[0] ?? "");
    });
  }, []);

  useEffect(() => {
    loadProjections(selectedDate || undefined).then(setData).catch(console.error);
  }, [selectedDate]);
```

Update the import line for the data module to bring in `loadIndex`:
```tsx
import { loadProjections, loadIndex } from "../lib/data";
```

- [ ] **Step 2: Render the picker** in the header. Replace the date line in the `<header>` (the `<p className="mt-3 ...">` that shows `data.date` + live dot) with:

```tsx
        <div className="mt-3 flex items-center gap-2" style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
          <span className="live-dot" />
          {dates.length > 1 ? (
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="num"
              style={{
                background: "var(--bg-2)", color: "var(--text)",
                border: "1px solid var(--line)", borderRadius: 8, padding: "0.25rem 0.5rem",
              }}
            >
              {dates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          ) : (
            <span className="num">{data.date}</span>
          )}
          <span style={{ opacity: 0.6 }}>· browse the last 7 days</span>
        </div>
```

- [ ] **Step 3: Run dev server and verify**

```bash
cd /Users/issiakadiawara/Projects/prop-predict/web
pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null; sleep 1; rm -rf .next
npm run build 2>&1 | grep -iE "Compiled|error" | head -3
(npm run dev &) ; sleep 12
curl -s -o /dev/null -w "site: %{http_code}\n" http://localhost:3000
pkill -f "next dev" || true
```
Expected: build compiles; site returns 200. (With only one sample date committed, the picker shows the single date as plain text; after a multi-day backfill it becomes a dropdown.)

- [ ] **Step 4: Commit**

```bash
cd /Users/issiakadiawara/Projects/prop-predict
git add web/app/page.tsx
git commit -m "feat: date picker to browse the last 7 days"
```

---

### Task 8: Run the 7-day backfill + verify the picker (live, slow first time)

**Files:** none (generates ignored data files + verification)

- [ ] **Step 1: Backfill the last 7 days, a few games each** (bounded so it's not hours; cached players make later days fast):

Run: `cd /Users/issiakadiawara/Projects/prop-predict && export PATH="$HOME/.local/bin:$PATH" && uv run python -m model.backfill 2026-06-10 7 3`
Expected: prints a `=== backfilling <date> ===` + write line for each of the 7 days. Some days may have 0 K rows if a game's boxscore lacks starters; that's acceptable. (Run in the background if it is slow on the first uncached day.)

- [ ] **Step 2: Confirm the index lists multiple dates**

```bash
node -e "console.log(require('./web/public/data/index.json'))"
```
Expected: `{ dates: [ ...7 dates newest-first... ] }`.

- [ ] **Step 3: Verify the picker in the browser.** Start the dev server (`cd web && npm run dev`), open `http://localhost:3000`, confirm the header now shows a **date dropdown** with the last 7 days, and switching dates reloads the board with that day's real players. Stop the server when done.

- [ ] **Step 4: Restore the committed sample default** so the repo's tracked `2026-06-10.json` / `latest.json` stay the handcrafted sample (the real backfilled files for other dates are gitignored and remain locally):

```bash
git checkout web/public/data/2026-06-10.json web/public/data/latest.json 2>/dev/null || true
git status --porcelain web/public/data   # only index.json may differ
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Python tests**

Run: `cd /Users/issiakadiawara/Projects/prop-predict && export PATH="$HOME/.local/bin:$PATH" && uv run pytest -q`
Expected: all unit tests pass; smoke deselected.

- [ ] **Step 2: Smoke tests (live)**

Run: `uv run pytest -m smoke -q`
Expected: pass (including the new `get_starters` smoke).

- [ ] **Step 3: Web build**

Run: `cd web && npm test && npm run build`
Expected: vitest passes; production build succeeds with the date picker.

---

## Notes for the implementer

- **The starters fix (Tasks 1-2) is the key unlock** — it's why a past date can show strikeouts + batter-vs-pitcher matchups, not just home runs.
- **Caching matters:** the first uncached day of a backfill is slow (hundreds of player pulls); every day after reuses cached players and is fast. Use the `max_games` arg to bound it.
- **Committed vs generated data:** only `index.json`, `2026-06-10.json`, and `latest.json` are tracked (the demo sample). Real backfilled `<date>.json` files are gitignored — they're generated locally (and, later, by the deploy automation).
- **Deploy interaction (future):** when we deploy, the scheduled job will run the backfill so the live site always has the last 7 days. That's the separate deploy plan.
- **Today vs past:** for today's not-yet-started games, `--include-started` is a no-op and the normal probable-pitcher path applies once MLB posts them; the backfill uses `include_started=True` which safely covers both.
