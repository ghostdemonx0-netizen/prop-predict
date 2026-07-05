/**
 * app/page.tsx — The Mock 7 "Spatial Depth" app shell (site ROOT).
 *
 * Promoted from app/next/page.tsx. The fully-navigable app shell wired to
 * live data. It mirrors the state model + URL-sync of the previous production
 * shell exactly:
 *
 *   • state: section, prop, per-prop threshold object, source (weighting),
 *     selectedDate, board view, and the modal's player/prop (via the URL).
 *   • URL params: ?date=&prop=&threshold=&source= (board state, read on load /
 *     written on change) + ?player= (modal, owned by usePlayerModalUrl).
 *   • data: loadIndex / loadProjections; the same liveGames list feeds
 *     <LiveProvider>.
 *
 * The spatial layout wrapper (previously app/next/layout.tsx) is folded in
 * here: the app is wrapped in <div className="sp-root"> with <DepthField/>,
 * and spatial.css is imported at the top. No viewport override — the root
 * layout (app/layout.tsx) still owns the phone-fit viewport + orientation
 * script, which this app inherits.
 *
 * Surfaces (NavDock sections):
 *   board → BoardView   (prop selector + threshold + view switch sub-controls)
 *   hub   → GameHub      (5 column-threshold pickers as sub-controls)
 *   top   → TopPlays     (inline threshold pillbars, no sub-controls)
 *   parks → Parks
 */
"use client";

import "../components/spatial/spatial.css";
import { useEffect, useState } from "react";
import { loadIndex, loadProjections } from "../lib/data";
import { LiveProvider } from "../components/LiveProvider";
import type { LiveGame } from "../lib/live";
import type { Projections } from "../lib/types";
import type { PropKind } from "../lib/format";
import { pct, platoonAdvantage } from "../lib/format";
import { toBoardRows, type Source } from "../lib/weighting";
import { envImpactColor } from "../components/spatial/chips";

import { DepthField } from "../components/spatial/DepthField";
import { CommandBar } from "../components/spatial/CommandBar";
import { HeaderDash, type DashRow } from "../components/spatial/HeroTiles";
import { NavDock, type NavSection } from "../components/spatial/NavDock";
import { SegmentedControl } from "../components/spatial/SegmentedControl";
import { BoardView, type BoardViewMode } from "../components/spatial/board/BoardView";
import { GameHub } from "../components/spatial/GameHub";
import { TopPlays, type TopPlaysThresholds } from "../components/spatial/TopPlays";
import { Parks } from "../components/spatial/Parks";
import {
  PlayerModal,
  usePlayerModalUrl,
  type ModalProp,
} from "../components/spatial/PlayerModal";

// ─────────────────────────────────────────────────────────────────────────────
//  Local types + static config
// ─────────────────────────────────────────────────────────────────────────────

/** Base prop names (the props-section selector), matching app/page.tsx. */
type BoardProp = "hr" | "k" | "hits" | "tb" | "runs" | "rbi" | "hrr";

/** Threshold-carrying prop names (exclude hr/k). */
type ThresholdKey = "hits" | "tb" | "runs" | "rbi" | "hrr";

/** Shared per-prop threshold object — the shape GameHub/TopPlays consume. */
type Thresholds = { hits: 1 | 2 | 3; tb: 2 | 3 | 4; runs: 1 | 2; rbi: 1 | 2; hrr: 2 | 3 | 4 };

const PROP_OPTIONS = [
  { value: "hr", label: "Home Runs" },
  { value: "k", label: "Strikeouts" },
  { value: "hits", label: "Hits" },
  { value: "tb", label: "Total Bases" },
  { value: "runs", label: "Runs" },
  { value: "rbi", label: "RBI" },
  { value: "hrr", label: "H+R+RBI" },
];

const VIEW_OPTIONS: { value: BoardViewMode; label: string }[] = [
  { value: "cards", label: "Cards" },
  { value: "split", label: "Split" },
  { value: "table", label: "Table" },
  { value: "matchups", label: "Matchups" },
];

/** Threshold pill values per prop (mirrors app/page.tsx setThreshold ranges). */
const THRESHOLD_OPTIONS: Record<ThresholdKey, number[]> = {
  hits: [1, 2, 3],
  tb: [2, 3, 4],
  runs: [1, 2],
  rbi: [1, 2],
  hrr: [2, 3, 4],
};

/** The 5 Game-Hub column pickers. */
const COLUMN_PICKERS: { key: ThresholdKey; label: string }[] = [
  { key: "hits", label: "Hits column" },
  { key: "tb", label: "Bases column" },
  { key: "runs", label: "Runs column" },
  { key: "rbi", label: "RBI column" },
  { key: "hrr", label: "HRR column" },
];

/** Weighting options (mirrors CommandBar's previous SOURCE_OPTIONS). */
const SOURCE_OPTIONS = [
  { value: "current", label: "Current szn" },
  { value: "blend",   label: "Blend" },
  { value: "hist",    label: "History 3yr" },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Threshold reconciliation helpers
//
//  ONE threshold object drives the Board's active-prop threshold, TopPlays'
//  inline pillbars, AND GameHub's column pickers.  These map the base prop name +
//  the shared object down to the single (kind, number) the Board needs.
// ─────────────────────────────────────────────────────────────────────────────

/** Active board PropKind (threshold-encoded), e.g. hits + {hits:2} → "hits2". */
function activePropKind(prop: BoardProp, t: Thresholds): PropKind {
  switch (prop) {
    case "hr":
      return "hr";
    case "k":
      return "k";
    case "hits":
      return `hits${t.hits}` as PropKind;
    case "tb":
      return `tb${t.tb}` as PropKind;
    case "runs":
      return `runs${t.runs}` as PropKind;
    case "rbi":
      return `rbi${t.rbi}` as PropKind;
    case "hrr":
      return `hrr${t.hrr}` as PropKind;
  }
}

/** Numeric threshold for toBoardRows (hr/k ignore it → 0). */
function activeThresholdNum(prop: BoardProp, t: Thresholds): number {
  switch (prop) {
    case "hits":
      return t.hits;
    case "tb":
      return t.tb;
    case "runs":
      return t.runs;
    case "rbi":
      return t.rbi;
    case "hrr":
      return t.hrr;
    default:
      return 0;
  }
}

/** URL ?threshold= value for the active board prop (null for hr/k). */
function urlThreshold(prop: BoardProp, t: Thresholds): number | null {
  switch (prop) {
    case "hits":
      return t.hits;
    case "tb":
      return t.tb;
    case "runs":
      return t.runs;
    case "rbi":
      return t.rbi;
    case "hrr":
      return t.hrr;
    default:
      return null;
  }
}

/** Batter/pitcher hand string ("RHB"/"LHB"/"SW"/"RHP"/"LHP") → HandChip glyph.
 *  Mirrors BoardView's handGlyph so the header leaderboards render the same
 *  L / R / SW chip as the board. */
function handGlyph(h?: string): "R" | "L" | "SW" | undefined {
  if (!h) return undefined;
  if (h === "SW" || h[0] === "S") return "SW";
  if (h[0] === "L") return "L";
  if (h[0] === "R") return "R";
  return undefined;
}

/** Board onOpenPlayer PropKind → the modal's (ModalProp, threshold?). */
function toModalTarget(kind: PropKind): { prop: ModalProp; threshold?: number } {
  if (kind === "hr") return { prop: "hr" };
  if (kind === "k") return { prop: "k" };
  if (kind.startsWith("hits")) return { prop: "hits", threshold: Number(kind.slice(4)) };
  if (kind.startsWith("tb")) return { prop: "tb", threshold: Number(kind.slice(2)) };
  if (kind.startsWith("runs")) return { prop: "runs", threshold: Number(kind.slice(4)) };
  if (kind.startsWith("rbi")) return { prop: "rbi", threshold: Number(kind.slice(3)) };
  return { prop: "hrr", threshold: Number(kind.slice(3)) };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [data, setData] = useState<Projections | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [source, setSource] = useState<Source>("current");
  const [section, setSection] = useState<NavSection>("board");
  const [prop, setProp] = useState<BoardProp>("hr");
  const [view, setView] = useState<BoardViewMode>("cards");
  const [threshold, setThreshold] = useState<Thresholds>({
    hits: 1,
    tb: 2,
    runs: 1,
    rbi: 1,
    hrr: 2,
  });

  // URL-addressable player/pitcher modal (?player=&prop=&threshold=).
  const { selection, openPlayer, closePlayer } = usePlayerModalUrl();

  // ── Read URL params + load the date index once on mount (mirror page.tsx). ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const want = params.get("date");

    const propParam = params.get("prop");
    if (propParam === "k") setProp("k");
    else if (propParam === "hits") setProp("hits");
    else if (propParam === "tb") setProp("tb");
    else if (propParam === "runs") setProp("runs");
    else if (propParam === "rbi") setProp("rbi");
    else if (propParam === "hrr") setProp("hrr");

    const tp = params.get("threshold");
    if (propParam === "hits" && (tp === "1" || tp === "2" || tp === "3")) {
      setThreshold((t) => ({ ...t, hits: Number(tp) as 1 | 2 | 3 }));
    }
    if (propParam === "tb" && (tp === "2" || tp === "3" || tp === "4")) {
      setThreshold((t) => ({ ...t, tb: Number(tp) as 2 | 3 | 4 }));
    }
    if (propParam === "runs" && (tp === "1" || tp === "2")) {
      setThreshold((t) => ({ ...t, runs: Number(tp) as 1 | 2 }));
    }
    if (propParam === "rbi" && (tp === "1" || tp === "2")) {
      setThreshold((t) => ({ ...t, rbi: Number(tp) as 1 | 2 }));
    }
    if (propParam === "hrr" && (tp === "2" || tp === "3" || tp === "4")) {
      setThreshold((t) => ({ ...t, hrr: Number(tp) as 2 | 3 | 4 }));
    }

    const src = params.get("source");
    if (src === "hist") setSource("hist");
    else if (src === "blend") setSource("blend");

    const sectionParam = params.get("section");
    if (
      sectionParam === "board" ||
      sectionParam === "hub" ||
      sectionParam === "top" ||
      sectionParam === "parks"
    ) {
      setSection(sectionParam);
    }

    const viewParam = params.get("view");
    if (
      viewParam === "cards" ||
      viewParam === "split" ||
      viewParam === "table" ||
      viewParam === "matchups"
    ) {
      setView(viewParam);
    }

    loadIndex().then((ds) => {
      setDates(ds);
      setSelectedDate(want && ds.includes(want) ? want : ds[0] ?? "");
    });
  }, []);

  // ── Reload projections whenever the selected date changes. ──
  useEffect(() => {
    loadProjections(selectedDate || undefined)
      .then(setData)
      .catch(console.error);
  }, [selectedDate]);

  // ── Write board state to the URL on change (shareable / refresh-safe). ──
  // The modal owns ?player=&prop=&threshold= while it is open, so we skip the
  // board write whenever a ?player= param is present to avoid clobbering it.
  // Depending on `selection` re-asserts the board URL right after the modal
  // closes (?player= gone), restoring the board's own prop/threshold.
  useEffect(() => {
    if (!selectedDate) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("player")) return;
    params.set("date", selectedDate);
    params.set("prop", prop);
    const t = urlThreshold(prop, threshold);
    if (t != null) params.set("threshold", String(t));
    else params.delete("threshold");
    if (source === "current") params.delete("source");
    else params.set("source", source);
    params.set("section", section);
    params.set("view", view);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [selectedDate, prop, threshold, source, section, view, selection]);

  // ── Handlers ──
  const handleOpenPlayer = (playerId: number, kind: PropKind) => {
    const { prop: mp, threshold: mt } = toModalTarget(kind);
    openPlayer(String(playerId), mp, mt);
  };

  const onThreshold = (p: keyof TopPlaysThresholds, n: number) =>
    setThreshold((t) => ({ ...t, [p]: n }) as Thresholds);

  if (!data) {
    return (
      <div className="sp-root">
        <DepthField />
        <main className="mx-auto max-w-3xl px-5 py-16">
          <p>loading the board…</p>
        </main>
      </div>
    );
  }

  // ── Derived data ──
  const activeKind = activePropKind(prop, threshold);
  const boardRows = toBoardRows(
    data,
    activeKind,
    activeThresholdNum(prop, threshold),
    source,
  );

  // Unique games (id + first-pitch ms) for the live poller's active-window gate.
  const liveGames: LiveGame[] = Array.from(
    new Map(
      [...data.hr, ...data.strikeouts]
        .filter((r) => r.game_id != null)
        .map((r) => [
          String(r.game_id),
          {
            id: String(r.game_id),
            startMs: r.game_time ? Date.parse(r.game_time) : undefined,
          },
        ]),
    ).values(),
  );

  // ── Header dashboard: Box 1 stats (unchanged values from the old KPI tiles) ──
  const gameCount = data.games?.length ?? 0;
  const totalPlays =
    data.hr.length +
    data.strikeouts.length +
    (data.hits?.length ?? 0) +
    (data.total_bases?.length ?? 0) +
    (data.runs?.length ?? 0) +
    (data.rbi?.length ?? 0) +
    (data.hrr?.length ?? 0);
  // Lineups stat = COUNT OF TEAMS whose lineup is confirmed, out of every team on
  // the slate. Each game has TWO sides (home + away), counted independently, so
  // the denominator is 2 × game count and a 15-game slate reads e.g. "18/30".
  const confirmedTeams = (data.games ?? []).reduce(
    (acc, g) =>
      acc +
      (g.home_lineup_status === "confirmed" ? 1 : 0) +
      (g.away_lineup_status === "confirmed" ? 1 : 0),
    0,
  );

  // ── Box 2 — Top 6 games by combined park+weather env boost ──
  // Reuses the same `env` multiplier Parks ranks by (park_mult × weather_mult,
  // 1.0 = neutral), sorted best-first, and the shared envImpactColor scale.
  const signedPct = (mult: number): string => {
    const v = Math.round((mult - 1) * 100);
    return (v >= 0 ? "+" : "") + v + "%";
  };
  const topGames: DashRow[] = [...(data.games ?? [])]
    .sort((a, b) => b.env - a.env)
    .slice(0, 6)
    .map((g) => ({
      name: g.matchup,
      value: signedPct(g.env),
      color: envImpactColor(g.env),
    }));

  // ── Box 3 — Top 10 batters across ALL batter props ──
  // METRIC: for each unique batter (keyed by player_id), average their
  // source-weighted probability across every batter prop they appear in, taken
  // at that prop's base/lowest threshold, then rank descending and take 10.
  // The header shows 3 columns of 3 (top 9) on desktop/landscape and 2 columns
  // of 5 (top 10) on phone portrait — the 10th is portrait-only (CSS-hidden >640).
  // Base thresholds per prop — edit this list to re-tune the composite metric:
  const BATTER_BASES: [PropKind, number][] = [
    ["hr", 1],
    ["hits1", 1],
    ["tb2", 2],
    ["runs1", 1],
    ["rbi1", 1],
    ["hrr2", 2],
  ];
  // Rank internally by the avg-across-props metric, but DON'T display it — an
  // average across mixed props isn't a meaningful %. Show the batter's hand
  // chip instead (carried from the first row seen for that batter).
  // `adv` = batter has the platoon edge over their matchup pitcher (bats
  // opposite the pitcher's throwing hand). Computed EXACTLY as the board does —
  // platoonAdvantage(playerHand, opponent.hand) — captured from the first row
  // seen for the batter (same game/pitcher across every prop), then passed to
  // the header HandChip so it lights up (cyan glow) just like on the board.
  const batterAcc = new Map<
    number,
    { name: string; hand?: "R" | "L" | "SW"; team?: string; adv: boolean; sum: number; n: number }
  >();
  for (const [kind, thr] of BATTER_BASES) {
    for (const r of toBoardRows(data, kind, thr, source)) {
      if (r.player_id == null) continue;
      const e =
        batterAcc.get(r.player_id) ??
        {
          name: r.player,
          hand: handGlyph(r.playerHand),
          team: r.team,
          adv: platoonAdvantage(r.playerHand, r.opponent?.hand),
          sum: 0,
          n: 0,
        };
      e.sum += r.prob;
      e.n += 1;
      batterAcc.set(r.player_id, e);
    }
  }
  const topBatters: DashRow[] = [...batterAcc.values()]
    .map((e) => ({ name: e.name, hand: e.hand, team: e.team, adv: e.adv, avg: e.sum / e.n }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10)
    .map((e) => ({ name: e.name, hand: e.hand, team: e.team, adv: e.adv }));

  // ── Box 4 — Top pitchers: TWO-STEP rank (top-6-proj pool, ordered by over %) ──
  // STEP 1 — candidate pool: take the top 6 pitchers by PROJECTED strikeouts
  //   (KRow.expected_ks, source-weighted → the board row's `projection`, the same
  //   "proj X.X K" the Game Hub shows), highest proj K first.
  // STEP 2 — within that 6-pitcher pool, ORDER by the K over-line probability
  //   (`prob`, i.e. over_prob) DESCENDING — so the pitcher most likely to hit
  //   their (already-high) projection lands at #1.
  // Display is unchanged: proj K is the HEADLINE value ("X.X K"); the over-line
  // probability rides along as a smaller secondary %. Only the ORDER changed.
  // playerId/gameId/line are threaded through so each row can render the SAME
  // live K tracker the board uses (LiveChip fed by useLiveFor(row, "k")), shown
  // to the LEFT of the proj-K value.
  // TRACKER TARGET: the header box HEADLINES the PROJECTED strikeouts ("X.X K"),
  // so the tracker's `need` must derive from that PROJ — not the book line. We
  // feed `r.projection` (the same value shown) into the `line` slot useLiveFor
  // reads; propNeed("k", …) → floor(proj)+1 (e.g. 5.7 → 6). Only the HEADER
  // tracker changes; the board / Top Plays / Game Hub still track the book line.
  const topPitchers: DashRow[] = toBoardRows(data, "k", 0, source)
    .sort((a, b) => Number(b.projection ?? 0) - Number(a.projection ?? 0)) // step 1
    .slice(0, 6)
    .sort((a, b) => Number(b.prob) - Number(a.prob)) // step 2: order pool by over %
    .map((r) => ({
      name: r.player,
      value: r.projection ? `${r.projection} K` : pct(r.prob),
      sub: pct(r.prob),
      hand: handGlyph(r.playerHand),
      team: r.team,
      playerId: r.player_id,
      gameId: r.gameId,
      line: r.projection ?? r.line,
    }));

  return (
    <div className="sp-root">
      {/* Volumetric depth-field layers + parallax — handled by DepthField */}
      <DepthField />

      {/* ── Sticky command bar (owns the date selector) ── */}
      <CommandBar dates={dates} selectedDate={selectedDate} onDate={setSelectedDate} />

      {/* ONE LiveProvider wraps the header AND the board so the header's Top
          Pitchers live-K trackers share the same live context as the board /
          Top Plays (single provider, no duplication). */}
      <LiveProvider date={selectedDate} games={liveGames}>
      <main className="sp-wrap" style={{ paddingBottom: 80 }}>
        {/* ── Header dashboard (stats box + game/batter/pitcher leaderboards) ── */}
        <HeaderDash
          stats={{ games: gameCount, confirmed: confirmedTeams, plays: totalPlays }}
          games={topGames}
          batters={topBatters}
          pitchers={topPitchers}
        />

        {/* ── Weighting row — centered between KPI tiles and NavDock ── */}
        <div className="sp-weighting-row">
          <span className="sp-eyebrow">WEIGHTING</span>
          <SegmentedControl
            options={SOURCE_OPTIONS}
            value={source}
            onChange={(v) => setSource(v as Source)}
            variant="ghost"
          />
        </div>

        {/* ── Nav dock ── */}
        <NavDock section={section} onSection={setSection} />

        {/* ── Per-section sub-controls ── */}
        {section === "board" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              alignItems: "center",
              margin: "18px 0",
            }}
          >
            <SegmentedControl
              options={PROP_OPTIONS}
              value={prop}
              onChange={(v) => setProp(v as BoardProp)}
              scroll
            />
            {prop !== "hr" && prop !== "k" && (
              <SegmentedControl
                options={THRESHOLD_OPTIONS[prop].map((n) => ({
                  value: String(n),
                  label: `${n}+`,
                }))}
                value={String(threshold[prop])}
                onChange={(v) =>
                  setThreshold((t) => ({ ...t, [prop]: Number(v) }) as Thresholds)
                }
                variant="sm"
              />
            )}
            <SegmentedControl
              options={VIEW_OPTIONS}
              value={view}
              onChange={(v) => setView(v as BoardViewMode)}
              variant="ghost"
            />
          </div>
        )}

        {section === "hub" && (
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              justifyContent: "center",
              margin: "18px 0",
            }}
          >
            {COLUMN_PICKERS.map(({ key, label }) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span className="sp-eyebrow">{label}</span>
                <SegmentedControl
                  options={THRESHOLD_OPTIONS[key].map((n) => ({
                    value: String(n),
                    label: `${n}+`,
                  }))}
                  value={String(threshold[key])}
                  onChange={(v) =>
                    setThreshold((t) => ({ ...t, [key]: Number(v) }) as Thresholds)
                  }
                  variant="sm"
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Active surface ── */}
          {section === "board" && (
            <BoardView
              rows={boardRows}
              view={view}
              prop={activeKind}
              threshold={activeThresholdNum(prop, threshold)}
              source={source}
              onOpenPlayer={handleOpenPlayer}
            />
          )}
          {section === "hub" && (
            <GameHub
              games={data.games ?? []}
              projections={data}
              thresholds={threshold}
              source={source}
              onOpenPlayer={handleOpenPlayer}
            />
          )}
          {section === "top" && (
            <TopPlays
              projections={data}
              source={source}
              threshold={threshold}
              onThreshold={onThreshold}
              onOpenPlayer={handleOpenPlayer}
            />
          )}
          {section === "parks" && <Parks games={data.games ?? []} />}
      </main>
      </LiveProvider>

      {/* Modal lives outside <main> so its fixed overlay covers the viewport. */}
      <PlayerModal
        open={selection != null}
        playerId={selection?.playerId ?? null}
        prop={selection?.prop ?? "hr"}
        threshold={selection?.threshold}
        date={selectedDate}
        source={source}
        onClose={closePlayer}
        onOpenPlayer={(id, p) => openPlayer(id, p)}
        projections={data}
      />
    </div>
  );
}
