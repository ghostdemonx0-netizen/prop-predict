# Projected Lineups + Status Chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the board populated all day by projecting each team's lineup from their most-recent completed game until the official posts, and tag every row with a status the UI renders as a chip — yellow **PROJ**/probable → green **CONF**/confirmed — per `docs/superpowers/specs/2026-06-17-projected-lineups-design.md`.

**Architecture:** Engine: a new `fetch.get_recent_lineup` provides a team's last batting order; `export_web` resolves official-vs-projected per side, swaps in the projection when official is absent, and stamps statuses onto the data already flowing to the pipeline (batter profiles carry `lineup_status`, pitcher profiles carry `pitcher_status`, game dicts carry `home_/away_lineup_status`); the pure pipeline just copies those onto rows. Frontend: a `StatusChip` component (single chip on cards, PROJ/CONF pair on Matchups & Game Hub team lines). No projection-math change.

**Tech Stack:** Python 3 (pytest, MLB-StatsAPI), Next.js 16 + React (vitest). venv `.venv/bin/python`; web tests `cd web && npx vitest run` + `npx tsc --noEmit`.

**Baseline:** branch `projected-lineups`; Python suite 111 passed, 9 deselected; web vitest 9 passed. NEVER commit `web/public/data/*` or `.env.local`. Status defaults to `"confirmed"`/`"probable"` when a field is absent, so committed sample data without the new fields still renders.

---

## File map

| File | Change |
|---|---|
| `model/fetch.py` | `get_schedule` adds `home_id`/`away_id`; new `get_recent_lineup(team_id, before_date, ...)` |
| `model/pipeline.py` | `build_hr_rows`/`build_strikeout_rows`/`build_games` copy status fields onto rows |
| `model/export_web.py` | `make_profile_fns` resolves projected-vs-official + statuses; `main` stamps game-dict statuses |
| `tests/fixtures.py` | sample batters/pitchers/slate gain status fields |
| `tests/test_fetch_*.py`, `tests/test_pipeline.py`, `tests/test_export_web.py` | new cases |
| `web/lib/types.ts` | `lineup_status`/`pitcher_status` on HrRow, KRow, Matchup, Game |
| `web/components/StatusChip.tsx` | **new** — the chip (single + pair modes) |
| `web/app/globals.css` | `.chip-proj` (amber) / `.chip-conf` (green) + dim inactive |
| `web/app/page.tsx`, `web/components/PropBoard.tsx`, `web/components/ParksBoard.tsx` | map + place chips |

---

### Task 1: `fetch` — team ids on the schedule + recent-lineup lookup

**Files:** Modify `model/fetch.py`; Test: `tests/test_fetch_recent.py` (create) + a smoke in `tests/test_fetch_smoke.py`.

- [ ] **Step 1: Write the failing unit tests** — create `tests/test_fetch_recent.py`:

```python
def test_get_recent_lineup_returns_newest_nonempty_order():
    from model.fetch import get_recent_lineup
    # team 147 played 06-09 (home) and 06-11 (away); 06-11 is newest with a lineup
    sched = [
        {"game_id": 1, "game_date": "2026-06-09", "home_id": 147, "away_id": 110},
        {"game_id": 2, "game_date": "2026-06-11", "home_id": 121, "away_id": 147},
    ]
    lineups = {1: {"home": [10, 11], "away": [20]}, 2: {"home": [30], "away": [40, 41, 42]}}
    out = get_recent_lineup(147, "2026-06-12",
                            schedule_fn=lambda s, e: sched,
                            get_lineups_fn=lambda gid: lineups[gid])
    assert out == [40, 41, 42]  # team 147 was AWAY on 06-11


def test_get_recent_lineup_skips_games_without_a_posted_lineup():
    from model.fetch import get_recent_lineup
    sched = [
        {"game_id": 1, "game_date": "2026-06-09", "home_id": 147, "away_id": 110},
        {"game_id": 2, "game_date": "2026-06-11", "home_id": 147, "away_id": 121},
    ]
    lineups = {1: {"home": [10, 11, 12], "away": []}, 2: {"home": [], "away": []}}  # newest has none
    out = get_recent_lineup(147, "2026-06-12",
                            schedule_fn=lambda s, e: sched,
                            get_lineups_fn=lambda gid: lineups[gid])
    assert out == [10, 11, 12]  # falls back to the 06-09 game's home order


def test_get_recent_lineup_empty_when_nothing_found():
    from model.fetch import get_recent_lineup
    out = get_recent_lineup(147, "2026-06-12",
                            schedule_fn=lambda s, e: [],
                            get_lineups_fn=lambda gid: {"home": [], "away": []})
    assert out == []
```

- [ ] **Step 2: Run to verify failure**

Run: `.venv/bin/python -m pytest tests/test_fetch_recent.py -q`
Expected: FAIL — `cannot import name 'get_recent_lineup'`.

- [ ] **Step 3: Implement in `model/fetch.py`.** First, in `get_schedule`, add the raw team ids to each emitted dict (the function already reads `g["home_id"]`/`g["away_id"]` to map abbreviations). In the `out.append({...})` dict add:

```python
            "home_id": g["home_id"],
            "away_id": g["away_id"],
```

Then add this function (near `get_lineups`):

```python
def get_recent_lineup(team_id: int, before_date: str, *, lookback: int = 7,
                      schedule_fn=None, get_lineups_fn=None) -> list[int]:
    """The given team's most recent posted batting order before ``before_date``.

    Walks that team's games newest-first over the trailing ``lookback`` days and
    returns the first non-empty batting order found (their side of that game) —
    used to PROJECT today's lineup until the official one posts. Empty list when
    nothing is found in the window. schedule_fn/get_lineups_fn are injectable for
    tests; defaults hit the MLB Stats API.
    """
    if get_lineups_fn is None:
        get_lineups_fn = get_lineups
    if schedule_fn is None:
        def schedule_fn(s, e):
            return statsapi.schedule(start_date=s, end_date=e, team=team_id)
    end = dt.date.fromisoformat(before_date) - dt.timedelta(days=1)
    start = end - dt.timedelta(days=lookback - 1)
    games = schedule_fn(start.isoformat(), end.isoformat())
    for g in sorted(games, key=lambda g: g["game_date"], reverse=True):
        side = "home" if g.get("home_id") == team_id else "away"
        order = get_lineups_fn(g["game_id"]).get(side, [])
        if order:
            return order
    return []
```

(`dt` and `statsapi` are already imported in fetch.py.)

- [ ] **Step 4: Run to verify pass** — `.venv/bin/python -m pytest tests/test_fetch_recent.py -q` → 3 passed.

- [ ] **Step 5: Add a live smoke** to `tests/test_fetch_smoke.py`:

```python
def test_get_recent_lineup_smoke():
    from model.fetch import get_recent_lineup
    order = get_recent_lineup(147, "2026-06-12")  # Yankees, mid-season
    assert isinstance(order, list)
    assert all(isinstance(pid, int) for pid in order)
```

- [ ] **Step 6: Run full suite + the new smoke**

Run: `.venv/bin/python -m pytest -q` → expect 114 passed (111 + 3), 10 deselected.
Run (network): `.venv/bin/python -m pytest tests/test_fetch_smoke.py -q -m smoke -k recent_lineup --override-ini "addopts="` → 1 passed (a mid-season team should have a recent order; if the window is genuinely empty it returns [] and the assert on a list still holds).

- [ ] **Step 7: Commit**

```bash
git add model/fetch.py tests/test_fetch_recent.py tests/test_fetch_smoke.py
git commit -m "feat: get_recent_lineup + team ids on schedule (projected-lineup source)"
```

---

### Task 2: `pipeline` — copy status fields onto rows

**Files:** Modify `model/pipeline.py`, `tests/fixtures.py`; Test: `tests/test_pipeline.py`.

The pipeline stays pure: statuses arrive on the data it already receives. Contract:
- each **batter profile** dict may carry `lineup_status` (`"projected"|"confirmed"`)
- each **pitcher profile** dict may carry `pitcher_status` (`"probable"|"confirmed"`)
- each **game** dict may carry `home_lineup_status` / `away_lineup_status`
- absent → default `"confirmed"` (batter/game) or `"probable"` is NOT defaulted for pitchers; pitcher default is `"confirmed"` so old data reads as confirmed. (Projected/probable is only ever set explicitly by the resolver.)

- [ ] **Step 1: Update fixtures.** In `tests/fixtures.py`, add a status to the sample batter and pitcher so tests can assert propagation. In `_batter(...)` add `"lineup_status": "projected",` to the returned dict. In both `SAMPLE_PITCHERS` entries add `"pitcher_status": "probable",`. In `SAMPLE_SLATE[0]` add `"home_lineup_status": "projected", "away_lineup_status": "confirmed",`.

- [ ] **Step 2: Write the failing tests** — append to `tests/test_pipeline.py`:

```python
def test_hr_rows_carry_lineup_and_pitcher_status():
    rows = build_hr_rows(SAMPLE_SLATE, fake_lineups_fn, fake_pitcher_fn, fake_weather_fn)
    home = next(r for r in rows if r["team"] == "COL")
    assert home["lineup_status"] == "projected"          # from the batter profile
    assert home["vs"]["pitcher_status"] == "probable"     # from the opposing pitcher profile


def test_k_rows_carry_status():
    rows = build_strikeout_rows(SAMPLE_SLATE, fake_pitcher_fn, fake_lineups_fn, fake_weather_fn)
    ace = next(r for r in rows if r["player"] == "Ace Coors")
    assert ace["pitcher_status"] == "probable"
    assert ace["matchups"][0]["lineup_status"] == "projected"  # opposing batter's side


def test_games_carry_side_statuses():
    games = build_games(SAMPLE_SLATE, fake_weather_fn)
    g = games[0]
    assert g["home_lineup_status"] == "projected"
    assert g["away_lineup_status"] == "confirmed"
```

- [ ] **Step 3: Run to verify failure** — `.venv/bin/python -m pytest tests/test_pipeline.py -q` → 3 new FAIL (KeyError).

- [ ] **Step 4: Implement in `model/pipeline.py`.**
In `build_hr_rows`, where the row dict is appended, add `"lineup_status": b.get("lineup_status", "confirmed"),` to the row, and in the `vs = {...}` dict add `"pitcher_status": opp.get("pitcher_status", "confirmed"),`.
In `build_strikeout_rows`, add `"pitcher_status": p.get("pitcher_status", "confirmed"),` to the row dict, and in each `matchups.append({...})` add `"lineup_status": b.get("lineup_status", "confirmed"),`.
In `build_games`, add to the per-game dict: `"home_lineup_status": game.get("home_lineup_status", "confirmed"), "away_lineup_status": game.get("away_lineup_status", "confirmed"),`.

- [ ] **Step 5: Run the full suite** — `.venv/bin/python -m pytest -q` → expect 117 passed, 10 deselected. (Existing pipeline tests must still pass; the new fields are additive.)

- [ ] **Step 6: Commit**

```bash
git add model/pipeline.py tests/fixtures.py tests/test_pipeline.py
git commit -m "feat: pipeline copies lineup/pitcher status onto HR, K, and game rows"
```

---

### Task 3: `export_web` — resolve projected lineups + assign statuses

**Files:** Modify `model/export_web.py`; Test: `tests/test_export_web.py`.

- [ ] **Step 1: Write the failing test** — append to `tests/test_export_web.py`:

```python
def test_make_profile_fns_projects_and_tags_status(monkeypatch):
    from model import export_web, fetch
    # one game, away lineup official, home lineup NOT posted (-> projected)
    slate = [{"game_id": 5, "home": "COL", "away": "LAD", "park_team": "COL",
              "home_id": 115, "away_id": 119, "game_time": "2026-06-10T20:00:00Z",
              "started": False, "home_pitcher_id": 201, "away_pitcher_id": 202}]
    monkeypatch.setattr(fetch, "get_lineups", lambda gid: {"home": [], "away": [111]})
    monkeypatch.setattr(fetch, "get_recent_lineup", lambda tid, d, **k: [101, 102] if tid == 115 else [])
    monkeypatch.setattr(fetch, "get_player_meta", lambda ids: {})
    monkeypatch.setattr(export_web, "get_or_compute", lambda key, prod: {"events_stub": True})
    monkeypatch.setattr(export_web.profiles, "batter_profile_from_events",
                        lambda ev, **k: {"player_id": k["player_id"], "name": str(k["player_id"]), "bats": "R", "season_hr": 1, "season_pa": 100, "recent_form_mult": 1.0, "k_rate": 0.2, "hit_rate": 0.2})
    monkeypatch.setattr(export_web.profiles, "pitcher_profile_from_events",
                        lambda ev, **k: {"player_id": k["player_id"], "name": str(k["player_id"]), "throws": "R", "k_per_bf": 0.2, "expected_bf": 24, "hit_allowed_rate": 0.2, "hr_allowed_rate": 0.03, "bf": 400, "k_line": 5.5})
    lineups_fn, pitcher_fn = export_web.make_profile_fns(slate, 2026, "2026-06-10")
    g = slate[0]
    assert g["home_lineup_status"] == "projected" and g["away_lineup_status"] == "confirmed"
    # home pitcher's team lineup is NOT posted -> probable; away pitcher's IS -> confirmed
    assert g["home_pitcher_status"] == "probable" and g["away_pitcher_status"] == "confirmed"
    lns = lineups_fn(g)
    assert [b["player_id"] for b in lns["home"]] == [101, 102]  # projected order used
    assert all(b["lineup_status"] == "projected" for b in lns["home"])
    assert all(b["lineup_status"] == "confirmed" for b in lns["away"])
    assert pitcher_fn(201)["pitcher_status"] == "probable"   # home pitcher
    assert pitcher_fn(202)["pitcher_status"] == "confirmed"  # away pitcher
```

- [ ] **Step 2: Run to verify failure** — `.venv/bin/python -m pytest tests/test_export_web.py -q` → new test FAILS.

- [ ] **Step 3: Implement.** Replace the `make_profile_fns` lineup/status resolution. The new version resolves each side to official-or-projected ids, records per-side `lineup_status`, derives each side's `pitcher_status` (confirmed iff that side's official lineup posted OR game started, else probable), writes the four status fields onto the game dict, and tags profiles. Full new `make_profile_fns`:

```python
def make_profile_fns(slate: list[dict], season: int, as_of: str) -> tuple:
    """(lineups_fn, pitcher_fn) backed by the on-disk events cache.

    Resolves each lineup side to the official batting order when posted, else a
    PROJECTED order from that team's most recent game (fetch.get_recent_lineup).
    Stamps status onto the data the pipeline reads: batter profiles get
    ``lineup_status``, pitcher profiles get ``pitcher_status`` (via a pid map),
    and each game dict gets home_/away_lineup_status + home_/away_pitcher_status.
    A side/pitcher is confirmed once the official lineup is posted (the card
    includes the starter) or the game has started; otherwise projected/probable.
    """
    pids: set[int] = set()
    lineup_cache: dict[int, dict] = {}        # game_id -> {"home": [ids], "away": [ids]}
    pitcher_status: dict[int, str] = {}       # pid -> "probable"|"confirmed"
    for g in slate:
        official = fetch.get_lineups(g["game_id"])
        sides: dict[str, list[int]] = {}
        for side, team_key in (("home", "home_id"), ("away", "away_id")):
            confirmed = bool(official.get(side)) or bool(g.get("started"))
            if official.get(side):
                sides[side] = official[side]
            elif g.get("started"):
                sides[side] = official.get(side, [])
            else:
                sides[side] = fetch.get_recent_lineup(g.get(team_key), as_of) if g.get(team_key) else []
            g[f"{side}_lineup_status"] = "confirmed" if confirmed else "projected"
            g[f"{side}_pitcher_status"] = "confirmed" if confirmed else "probable"
        lineup_cache[g["game_id"]] = sides
        pids.update(sides["home"] + sides["away"])
        for pid_key, side in (("home_pitcher_id", "home"), ("away_pitcher_id", "away")):
            if g.get(pid_key):
                pids.add(g[pid_key])
                pitcher_status[g[pid_key]] = g[f"{side}_pitcher_status"]
    meta = fetch.get_player_meta(list(pids))

    def batter_fn(pid: int, status: str) -> dict:
        m = meta.get(pid, {})
        events = get_or_compute(f"bat-events-{pid}-{season}", lambda: fetch.batter_events(pid, season))
        prof = profiles.batter_profile_from_events(
            events, as_of=as_of, player_id=pid, name=m.get("name", str(pid)), bats=m.get("bats", "R"))
        prof["lineup_status"] = status
        return prof

    def pitcher_fn(pid: int) -> dict:
        m = meta.get(pid, {})
        events = get_or_compute(f"pit-events-{pid}-{season}", lambda: fetch.pitcher_events(pid, season))
        prof = profiles.pitcher_profile_from_events(
            events, as_of=as_of, player_id=pid, name=m.get("name", str(pid)), throws=m.get("throws", "R"))
        prof["pitcher_status"] = pitcher_status.get(pid, "confirmed")
        return prof

    def lineups_fn(game: dict) -> dict:
        lns = lineup_cache[game["game_id"]]
        return {
            "home": [batter_fn(pid, game.get("home_lineup_status", "confirmed")) for pid in lns["home"]],
            "away": [batter_fn(pid, game.get("away_lineup_status", "confirmed")) for pid in lns["away"]],
        }

    return lineups_fn, pitcher_fn
```

(`make_bvp_fn`, `_ensure_starters`, `main` unchanged. `main` already calls `make_profile_fns(slate, ...)` before `build_*`, so the game-dict status fields are set before `build_games(slate, ...)` reads them — order is correct.)

- [ ] **Step 4: Run to verify pass** — `.venv/bin/python -m pytest tests/test_export_web.py -q` → passes. Then `.venv/bin/python -m pytest -q` → expect 117 passed, 10 deselected.

- [ ] **Step 5: Live one-game verification** (network):

```bash
rm -rf .cache && .venv/bin/python -m model.export_web 2026-06-10 2 --include-started
.venv/bin/python -c "
import json
d = json.load(open('web/public/data/2026-06-10.json'))
r = d['hr'][0]
print('HR row status:', r.get('lineup_status'), '| vs pitcher:', (r.get('vs') or {}).get('pitcher_status'))
print('K row status:', d['strikeouts'][0].get('pitcher_status'))
print('game statuses:', {k: d['games'][0].get(k) for k in ('home_lineup_status','away_lineup_status')})
assert r.get('lineup_status') in ('projected','confirmed')
"
git checkout -- web/public/data/2026-06-10.json web/public/data/latest.json 2>/dev/null || true
```
Expected: statuses print as `projected`/`confirmed`/`probable`. (A past finished date is all `confirmed` — that's correct; the projected path is exercised by the unit test. Restore tracked samples after.)

- [ ] **Step 6: Commit**

```bash
git add model/export_web.py tests/test_export_web.py
git commit -m "feat: export resolves projected lineups and assigns proj/confirmed statuses"
```

---

### Task 4: web types + `StatusChip` component + CSS

**Files:** Modify `web/lib/types.ts`, `web/app/globals.css`; Create `web/components/StatusChip.tsx`.

- [ ] **Step 1: Extend types** in `web/lib/types.ts`:
- `Matchup` gains `lineup_status?: string;` and `pitcher_status?: string;`
- `HrRow` gains `lineup_status?: string;` (and `vs` already typed as `Matchup`, which now has `pitcher_status`)
- `KRow` gains `pitcher_status?: string;`
- `Game` gains `home_lineup_status?: string;` and `away_lineup_status?: string;`

- [ ] **Step 2: Create `web/components/StatusChip.tsx`:**

```tsx
// Status chips: yellow PROJ (projected/probable) -> green CONF (confirmed).
// `single` shows just the active chip (cards); `pair` shows both with the
// inactive one dimmed (Matchups + Game Hub team lines).
const CONFIRMED = new Set(["confirmed"]);

export function StatusChip({ status, mode = "single" }: { status?: string; mode?: "single" | "pair" }) {
  const confirmed = !!status && CONFIRMED.has(status);
  if (mode === "single") {
    if (!status) return null;
    return (
      <span className={confirmed ? "chip-conf" : "chip-proj"} title={confirmed ? "official lineup confirmed" : "projected from the team's last game — not yet official"}>
        {confirmed ? "CONF" : "PROJ"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`chip-proj ${confirmed ? "chip-off" : ""}`}>PROJ</span>
      <span className={`chip-conf ${confirmed ? "" : "chip-off"}`}>CONF</span>
    </span>
  );
}
```

- [ ] **Step 3: Add CSS** to the end of `web/app/globals.css`:

```css
/* proj/confirmed status chips (same family as .hand) */
.chip-proj, .chip-conf {
  font-size: 0.58rem; letter-spacing: 0.08em; font-weight: 800;
  padding: 0.05rem 0.34rem; border-radius: 5px; border: 1px solid; line-height: 1.4;
}
.chip-proj { color: var(--amber); border-color: rgba(245, 185, 66, 0.5); background: rgba(245, 185, 66, 0.12); }
.chip-conf { color: var(--green); border-color: rgba(62, 224, 127, 0.5); background: rgba(62, 224, 127, 0.12); }
.chip-off  { color: var(--muted); border-color: var(--line); background: transparent; opacity: 0.5; }
```

- [ ] **Step 4: Verify** — `cd web && npx tsc --noEmit` clean; `npx vitest run` still 9 passed (no logic tests for the chip — it's presentational).

- [ ] **Step 5: Commit**

```bash
git add web/lib/types.ts web/components/StatusChip.tsx web/app/globals.css
git commit -m "feat: StatusChip component (PROJ/CONF) + types + chip styles"
```

---

### Task 5: place the chips across the views

**Files:** Modify `web/app/page.tsx`, `web/components/PropBoard.tsx`, `web/components/ParksBoard.tsx`.

- [ ] **Step 1: Carry status onto BoardRow.** In `web/components/PropBoard.tsx`, add to the `BoardRow` type: `status?: string;` (the row's own status — hitter lineup_status or pitcher pitcher_status). Import the chip at top: `import { StatusChip } from "./StatusChip";`.

- [ ] **Step 2: Map status in `web/app/page.tsx`.** In the `hrRows` map add `status: r.lineup_status,`. In the `kRows` map add `status: r.pitcher_status,`.

- [ ] **Step 3: Cards — one chip.** In `PropBoard.tsx` `Card`, in the badge/detail row (the `<div className="mt-1.5 flex items-center gap-2" ...>` that holds the strength badge, detail, time), append after the time span:

```tsx
        <StatusChip status={r.status} />
```

- [ ] **Step 4: Table — one chip.** In the `Table` player cell, after the `playerHand` chip, add `<StatusChip status={r.status} />` (wrap the cell contents so it sits inline; keep existing markup).

- [ ] **Step 5: Matchups/Game Hub team line — the PROJ/CONF pair.** In `TeamSplit`, the per-column header currently renders `<span>{label}</span>` (e.g. "CHC · away") and the opposing pitcher. The column's lineup status is the status of any row in that column — use `rs.find(Boolean)?.status`. Render the pair next to the label:

```tsx
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                {label}
                <StatusChip status={rs.find((r) => r.status)?.status} mode="pair" />
              </span>
```

(Import `StatusChip` in PropBoard if `TeamSplit` lives there — it does.)

- [ ] **Step 6: Game Hub pitcher rows — one chip.** In `GameBreakdown`, the "Starting pitchers" `kRows` rows: append `<StatusChip status={r.status} />` after the pitcher's hand chip in that row.

- [ ] **Step 7: Verify** — `cd web && npx tsc --noEmit` clean; `npx vitest run` 9 passed; `npm run build` compiles.

- [ ] **Step 8: Commit**

```bash
git add web/app/page.tsx web/components/PropBoard.tsx web/components/ParksBoard.tsx
git commit -m "feat: place PROJ/CONF chips on cards, table, matchups, and game hub"
```

---

### Task 6: local preview, regenerate, verify, gated deploy

- [ ] **Step 1: Full suites** — `.venv/bin/python -m pytest -q` (117 passed, 10 deselected) + smoke `.venv/bin/python -m pytest -q -m smoke --override-ini "addopts="` (network; report) + `cd web && npx vitest run && npm run build` (green).

- [ ] **Step 2: Regenerate today's board locally with the new fields** (network — confirm the user is on wifi):

```bash
.venv/bin/python -m model.export_web $(TZ=America/New_York date +%F) || .venv/bin/python -m model.export_web 2026-06-17
```
(Today's slate will have a mix of projected + confirmed depending on the hour — exactly the state to preview. If empty/too early, regenerate a recent date with `--include-started` to see confirmed chips, and trust the unit test for the projected path.)

- [ ] **Step 3: Local preview for the user.**

```bash
pkill -f "next dev" || true; rm -rf web/.next
cd web && npm run dev
```
Sign in at localhost:3000, walk the user through: PROJ (yellow) on a not-yet-posted game flipping to CONF (green) where official lineups exist; cards show one chip; Matchups & Game Hub show the PROJ/CONF pair on team lines; platoon glow still works. **Stop for user approval before deploy (standing preview-before-production rule).**

- [ ] **Step 4: Restore tracked samples, then merge + deploy via the robot.** After approval:
```bash
git checkout -- web/public/data/2026-06-10.json web/public/data/latest.json web/public/data/index.json 2>/dev/null || true
git checkout main && git merge projected-lineups --no-edit && git push origin main
gh workflow run board-refresh.yml -f force_deploy=true
```
Then confirm the run is green and the live site (logged in) shows the chips. Update project memory (feature live; projected-lineup source = recent-game; status rules).

---

## Self-review notes

- **Spec coverage:** projected source (T1 `get_recent_lineup`), official-vs-projected resolution + status rules incl. pitcher-confirmed-on-official-lineup A1 (T3), row tagging (T2), types+chip+CSS (T4), placement cards/table/matchups/hub (T5), preview+gated deploy (T6). No math change anywhere. Started/frozen → confirmed handled in T3 (`bool(g.get("started"))`).
- **Type/field consistency:** statuses are strings `"projected"|"confirmed"` (lineup) and `"probable"|"confirmed"` (pitcher); pipeline reads `b.get("lineup_status")`, `opp.get("pitcher_status")`, `p.get("pitcher_status")`, `game.get("{side}_lineup_status")`; export_web sets exactly those keys; web `StatusChip` treats only `"confirmed"` as green, everything else as PROJ/yellow (so both "projected" and "probable" render yellow — intended). Defaults to confirmed so committed sample data (no fields) renders green, not broken.
- **Placeholder scan:** none — every code step is complete; the one judgement spot (column status via `rs.find`) is given as concrete code.
- **Known acceptance:** committed sample `2026-06-10.json` predates the fields → renders all-CONF (fine; it's a finished day). Live data carries real statuses after T6.
