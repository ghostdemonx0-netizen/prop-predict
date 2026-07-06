# Barrel Edge — Bridge (real data on the Boards) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Surface the real Phase-0 barrel data + the Prop Score onto the Boards page — a per-game `boards` payload in the export, and the frontend `BoardsView` reading it (with the mock as fallback). After this, the **Barrel Weight** lens on the board shows real Savant-accurate barrel columns + a real Prop Score per player.

**Architecture:** Backend adds `build_boards_payload(slate, lineups_fn, pitcher_fn)` (reusing the profiles that already carry barrel stats + `prop_score` + `hr_platoon_mult`) → added to the export payload as `"boards"`. Frontend `BoardsView` reads `data.boards` when present, else the mock fixture; columns without real data render `"—"` (honest, not a fake 0). Display only — no probability touched.

**Tech Stack:** Python 3 (backend export), Next.js/React/TypeScript (frontend), pytest + vitest.

## Global Constraints

- **Display only, ZERO probability change.** Do NOT touch `projections.py`, `pipeline.py` prob math, `run_props.py`, `matchup.py`, `profiles.py`. The backend change is additive in `export_web.py`; it *reads* profiles + calls `prop_score`.
- **Real values available** (per hitter profile, Phase-0): `barrel_rate, pulled_barrel_rate, sweetspot_rate, fb_rate, hardhit_rate, la_mean, xwobacon, hrfb_rate`; per pitcher profile: the `*_allowed` versions. Prop Score via `model.prop_score.prop_score(hitter, pitcher, platoon_mult=hr_platoon_mult(bats, throws))`.
- **Units:** the frontend columns are in **percent** for rates (e.g. Brl/BIP anchors 3–20). Phase-0 emits **fractions** (0.13). So multiply rate fields by 100 for the payload; `la_mean` and `xwobacon` pass through as-is.
- **Not-yet-real columns** (matchup, park, weather, platoon, pitcher, form, zonefit, iso, xwoba, swstr, hrform on hitters; pscore/kscore/xwoba/csw/swstr/ball on pitchers) are simply **omitted** from the payload `stats` dict — the frontend renders absent keys as `"—"`.
- **Slate/game shape** (from `pipeline.build_hr_rows`): each `game` has `home`, `away` (team abbrevs), `home_pitcher_id`, `away_pitcher_id`, `park_team`, optional `park_name`, `started`. `lineups_fn(game) -> {"home": [profiles], "away": [profiles]}`. `pitcher_fn(pid) -> pitcher profile`. **Away batters face the HOME pitcher; home batters face the AWAY pitcher.**
- **Testing:** pytest via `.venv/bin/python -m pytest`; frontend via `npx tsc --noEmit` + `npm run lint` (known pre-existing lint baseline in other files — introduce none new). Run backend cmds from repo root, frontend from `web/`.

---

### Task 1: Backend — `build_boards_payload` + add to export

**Files:**
- Modify: `model/export_web.py` (add the builder + helpers near the other `build_*`; add `"boards"` to the payload dict in `main`)
- Create: `tests/test_boards_payload.py`

**Interfaces:**
- Produces: `build_boards_payload(slate, lineups_fn, pitcher_fn) -> dict` with shape `{"games": [...], "pitchers": [...]}`. Frontend Task 2 consumes it.

- [ ] **Step 1: Write the failing test**

Create `tests/test_boards_payload.py`:

```python
from model.export_web import build_boards_payload

_H = {"barrel_rate": 0.15, "pulled_barrel_rate": 0.08, "sweetspot_rate": 0.40,
      "fb_rate": 0.30, "hardhit_rate": 0.55, "la_mean": 18.0, "xwobacon": 0.42,
      "hrfb_rate": 0.25, "player_id": 1, "name": "Big Bat", "bats": "R"}
_P = {"barrel_rate_allowed": 0.10, "pulled_barrel_rate_allowed": 0.06,
      "fb_rate_allowed": 0.40, "hardhit_rate_allowed": 0.48,
      "player_id": 9, "name": "Hittable Arm", "throws": "L"}

def _slate():
    return [{"away": "NYY", "home": "BOS", "away_pitcher_id": 9, "home_pitcher_id": 9,
             "park_name": "Fenway Park", "started": False}]

def test_boards_payload_shape_and_real_values():
    boards = build_boards_payload(
        _slate(),
        lineups_fn=lambda g: {"home": [dict(_H)], "away": [dict(_H)]},
        pitcher_fn=lambda pid: dict(_P),
    )
    assert set(boards) == {"games", "pitchers"}
    g = boards["games"][0]
    assert g["away"] == "NYY" and g["home"] == "BOS" and g["venue"] == "Fenway Park"
    h = g["awayHitters"][0]
    assert h["name"] == "Big Bat" and h["order"] == 1 and h["hand"] == "R"
    # rates converted to percent; Prop Score present and 0-100
    assert h["stats"]["brl"] == 15.0            # 0.15 * 100
    assert h["stats"]["hh"] == 55.0
    assert round(h["stats"]["xwobacon"], 2) == 0.42   # passthrough (not *100)
    assert 0.0 <= h["stats"]["trueScore"] <= 100.0
    # a not-yet-real column is absent (frontend shows "—")
    assert "zonefit" not in h["stats"]
    # pitcher board carries allowed barrels as percent
    p = boards["pitchers"][0]
    assert p["stats"]["brlbip"] == 10.0 and p["stats"]["pbrl"] == 6.0

def test_started_games_skipped():
    slate = [{"away": "NYY", "home": "BOS", "away_pitcher_id": 9, "home_pitcher_id": 9,
              "park_name": "Fenway", "started": True}]
    boards = build_boards_payload(slate, lambda g: {"home": [], "away": []}, lambda pid: dict(_P))
    assert boards["games"] == []
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_boards_payload.py -q`
Expected: FAIL — `ImportError: cannot import name 'build_boards_payload'`.

- [ ] **Step 3: Implement the builder**

In `model/export_web.py`, add these imports near the top (with the other `from model...` imports):

```python
from model.prop_score import prop_score
from model.matchup import hr_platoon_mult
```

Add this builder (place it near the other module-level `build_*` functions, e.g. just above `def main`):

```python
def _pct(x) -> float:
    return round((x or 0.0) * 100.0, 1)


def _hand(bats: str) -> str:
    if bats == "S":
        return "SW"
    return bats if bats in ("R", "L") else "R"


def _hitter_board(b: dict, opp: dict | None, order: int, team: str) -> dict:
    pmult = hr_platoon_mult(b.get("bats", "R"), opp.get("throws", "R")) if opp else 1.0
    score = prop_score(b, opp, platoon_mult=pmult) if opp else 0.0
    return {
        "id": b.get("player_id"),
        "name": b.get("name", ""),
        "hand": _hand(b.get("bats", "R")),
        "team": team,
        "order": order,
        "stats": {
            "trueScore": score,
            "brl": _pct(b.get("barrel_rate")),
            "pbrl": _pct(b.get("pulled_barrel_rate")),
            "sweet": _pct(b.get("sweetspot_rate")),
            "fb": _pct(b.get("fb_rate")),
            "hh": _pct(b.get("hardhit_rate")),
            "hardhit": _pct(b.get("hardhit_rate")),
            "la": round(b.get("la_mean") or 0.0, 1),
            "xwobacon": round(b.get("xwobacon") or 0.0, 3),
            "hrfb": _pct(b.get("hrfb_rate")),
        },
    }


def _pitcher_board(p: dict, opp_team: str) -> dict:
    return {
        "name": p.get("name", ""),
        "team": "",
        "throws": p.get("throws", "R"),
        "opp": opp_team,
        "stats": {
            "pbrl": _pct(p.get("pulled_barrel_rate_allowed")),
            "brlbip": _pct(p.get("barrel_rate_allowed")),
            "fb": _pct(p.get("fb_rate_allowed")),
            "hh": _pct(p.get("hardhit_rate_allowed")),
        },
    }


def build_boards_payload(slate: list[dict], lineups_fn, pitcher_fn) -> dict:
    """Per-game barrel boards (display only): each team's hitters (real barrel
    stats + Prop Score) vs the pitcher they face, plus a slate-pitchers list of
    barrel-allowed rows. Not-yet-real columns are omitted (frontend shows "—")."""
    games, pitchers, seen_p = [], [], set()
    for game in slate:
        if game.get("started"):
            continue
        away, home = game.get("away", "?"), game.get("home", "?")
        home_p = pitcher_fn(game["home_pitcher_id"]) if game.get("home_pitcher_id") else None
        away_p = pitcher_fn(game["away_pitcher_id"]) if game.get("away_pitcher_id") else None
        lns = lineups_fn(game)
        # away batters face the HOME pitcher; home batters face the AWAY pitcher
        away_hitters = [_hitter_board(b, home_p, i + 1, away) for i, b in enumerate(lns.get("away", []))]
        home_hitters = [_hitter_board(b, away_p, i + 1, home) for i, b in enumerate(lns.get("home", []))]
        games.append({
            "id": f"{away}-{home}",
            "away": away, "home": home,
            "venue": game.get("park_name", ""),
            "note": "",
            "awayPitcher": home_p.get("name", "") if home_p else "",
            "homePitcher": away_p.get("name", "") if away_p else "",
            "awayHitters": away_hitters,
            "homeHitters": home_hitters,
        })
        for p, opp in ((home_p, away), (away_p, home)):
            if p and p.get("player_id") not in seen_p:
                seen_p.add(p.get("player_id"))
                pitchers.append(_pitcher_board(p, opp))
    return {"games": games, "pitchers": pitchers}
```

NOTE on the board's "vs Pitcher" labels: `awayPitcher`/`homePitcher` are set to the pitcher each hitter group **faces** (away hitters vs the home pitcher → stored under `awayPitcher`), matching the mock/frontend convention where `awayHitters` are labeled "vs {homePitcher}".

- [ ] **Step 4: Add `"boards"` to the export payload**

In `main`, add one key to the `payload` dict (alongside `"hr"`, `"games"`, etc.):

```python
        "boards": build_boards_payload(slate, lineups_fn, pitcher_fn),
```

- [ ] **Step 5: Run tests + confirm no breakage**

Run: `.venv/bin/python -m pytest tests/test_boards_payload.py -q`
Expected: PASS (2 tests).
Then: `.venv/bin/python -m pytest -q`
Expected: full suite still green (additive change).

- [ ] **Step 6: Commit**

```bash
git add model/export_web.py tests/test_boards_payload.py
git commit -m "feat(barrel): boards payload (real barrel stats + Prop Score per matchup) in export"
```

---

### Task 2: Frontend — BoardsView reads real data

**Files:**
- Modify: `web/lib/types.ts` (add `BoardsData` + `boards?` on `Projections`)
- Modify: `web/components/spatial/boards/BoardsView.tsx` (accept `boards`, fall back to mock, render `"—"` for absent stats)
- Modify: `web/app/page.tsx` (pass `data.boards` to `BoardsView`)

**Interfaces:**
- Consumes: the export's `boards` payload shape from Task 1.

- [ ] **Step 1: Add the `BoardsData` type**

In `web/lib/types.ts`, add before `export type Projections`:

```ts
export type BoardHitter = { id: number; name: string; hand: "R" | "L" | "SW"; team: string; order: number; stats: Record<string, number> };
export type BoardPitcher = { name: string; team: string; throws: string; opp: string; stats: Record<string, number> };
export type BoardsGame = { id: string; away: string; home: string; venue: string; note: string; awayPitcher: string; homePitcher: string; awayHitters: BoardHitter[]; homeHitters: BoardHitter[] };
export type BoardsData = { games: BoardsGame[]; pitchers: BoardPitcher[] };
```

And add to `Projections`:

```ts
  boards?: BoardsData;
```

- [ ] **Step 2: BoardsView accepts real data with mock fallback + "—" for missing**

In `web/components/spatial/boards/BoardsView.tsx`:

(a) Update the props + imports at the top:

```tsx
import type { BoardsData } from "../../../lib/types";
import { MOCK_GAMES, MOCK_PITCHER_BOARD } from "../../../lib/barrelMock";
// ...existing imports...

export interface BoardsViewProps {
  lens: BoardsLens;
  boards?: BoardsData;
}
```

(b) In `BoardsView`, resolve real-or-mock at the top of the component and pass down. Replace the component signature + the two data sources:

```tsx
export function BoardsView({ lens, boards }: BoardsViewProps) {
  const columns = boardsColumnsFor(lens);
  const games = boards?.games ?? MOCK_GAMES;
  const slatePitchers = boards?.pitchers ?? MOCK_PITCHER_BOARD;
  // ...rest uses `games` instead of MOCK_GAMES and passes `slatePitchers` to PitcherBoard/TopReads
```

Thread `games` into the `games.map(...)`, `<TopReads games={games} lens={lens} />`, `<PitcherBoard pitchers={slatePitchers} />`, and `<PitcherStatRow ... pitchers={slatePitchers} />` (make `PitcherBoard`, `PitcherStatRow`, and `TopReads` take their data as a prop instead of importing the mock directly).

(c) Render `"—"` for an absent stat. In `HeatTable`'s cell map and `PitcherStatRow`/`PitcherBoard`, change the cell from `const v = r.stats[c.key] ?? 0;` to:

```tsx
                {columns.map((c) => {
                  const raw = r.stats[c.key];
                  const has = raw !== undefined && raw !== null;
                  const v = has ? raw : 0;
                  return (
                    <td key={c.key} style={{ padding: "5px 8px", textAlign: "center",
                        background: has ? heatColor(v, c.min, c.max, c.higherBetter ?? true) : "transparent",
                        outline: c.highlight ? "1px solid var(--iris-cyan)" : undefined }}>
                      {has ? fmt(v) : "—"}
                    </td>
                  );
                })}
```

Apply the same `has ? … : "—"` guard in `PitcherStatRow` and `PitcherBoard` cells, and make `PitcherBoard` sort by a real field: `[...pitchers].sort((a, b) => (b.stats.brlbip ?? 0) - (a.stats.brlbip ?? 0))` (barrel-allowed desc — most hittable first, since `pscore` isn't real yet).

- [ ] **Step 3: Pass `data.boards` from the page**

In `web/app/page.tsx`, the boards render becomes:

```tsx
          {section === "boards" && (
            <BoardsView lens={boardsLens(philosophy, barrelEffect)} boards={data.boards} />
          )}
```

- [ ] **Step 4: Verify**

Run (from `web/`): `npx tsc --noEmit && npm run lint`
Expected: no type errors; no NEW lint errors in the changed files (pre-existing baseline unchanged). Do NOT run `npm run dev` (the controller previews).

- [ ] **Step 5: Commit**

```bash
git add web/lib/types.ts web/components/spatial/boards/BoardsView.tsx web/app/page.tsx
git commit -m "feat(barrel): BoardsView reads real boards data (mock fallback, '—' for not-yet-real cols)"
```

---

## Self-Review

**Spec coverage (Bridge task on the tracker):**
- Surface Phase-0 barrel fields + Prop Score on the board JSON → Task 1 `build_boards_payload` + payload key. ✅
- Wire frontend to real data → Task 2 (mock fallback preserved so localhost never breaks). ✅
- Honest about partial data → absent columns render `"—"`, pitcher board sorts by a real field. ✅
- Display only, zero prob change → constraints forbid touching prob math; backend change reads profiles + calls prop_score; full suite stays green (Task 1 Step 5). ✅
- The controller then runs a small local board build (`main(date, max_games=2)`) to populate real `boards` and previews — that's an execution step, not a code task.

**Placeholder scan:** none — real code/commands throughout. ✅

**Type consistency:** `build_boards_payload -> {"games","pitchers"}`; the frontend `BoardsData` mirrors it field-for-field (games/pitchers, hitter `{id,name,hand,team,order,stats}`, pitcher `{name,team,throws,opp,stats}`). Stat keys emitted by the backend (`trueScore,brl,pbrl,sweet,fb,hh,hardhit,la,xwobacon,hrfb` / `pbrl,brlbip,fb,hh`) match the frontend column keys. ✅
