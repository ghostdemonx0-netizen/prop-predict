/**
 * KitDemo.tsx — Visual QA harness for all Mock 7 "Spatial Depth" kit components.
 *
 * Renders every component from the spatial design system so the full kit can be
 * inspected on the /next route.  This is the placeholder body for page.tsx until
 * the real board view is wired up.
 */
"use client";

import "./spatial.css";
import { useState } from "react";

import { CommandBar }       from "./CommandBar";
import { NavDock }          from "./NavDock";
import { HeroTiles }        from "./HeroTiles";
import { ProbabilityOrb }   from "./ProbabilityOrb";
import { CatDot, EnvDot, LeanPair } from "./GlassDot";
import { Badge, TagChip, HandChip, FormChip, FBox, Bvp } from "./chips";
import { SegmentedControl } from "./SegmentedControl";
import { FactorBar }        from "./FactorBar";
import { GlassCard }        from "./GlassCard";
import { LiveChip }         from "./LiveChipSpatial";
import { BoardView, type BoardViewMode } from "./board/BoardView";
import { TopPlays, type TopPlaysThresholds } from "./TopPlays";
import { Parks } from "./Parks";
import { PlayerModal, usePlayerModalUrl } from "./PlayerModal";
import type { NavSection }  from "./NavDock";
import type { BoardRow }    from "../PropBoard";
import type { Game, Projections } from "../../lib/types";

// ── Section heading ──────────────────────────────────────────────────────────

function QaHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: "32px 0 12px", display: "flex", alignItems: "center", gap: 12 }}>
      <span className="sp-eyebrow" style={{ whiteSpace: "nowrap" }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
    </div>
  );
}

// ── Demo KPI tiles ───────────────────────────────────────────────────────────

const DEMO_TILES = [
  { label: "Strong edges", value: "12",  sub: "props"  },
  { label: "Avg edge",     value: "+8",  sub: "%"      },
  { label: "Games today",  value: "9",   sub: "slates" },
  { label: "Model conf.",  value: "84",  sub: "%"      },
];

const DEMO_DATES = ["2026-07-02", "2026-07-01", "2026-06-30"];

// ── Demo board rows (HR prop, two games so split/matchups render fully) ───────
const DEMO_ROWS: BoardRow[] = [
  { id: "1", player: "Aaron Judge", team: "NYY", prob: 0.41, detail: "vs BOS", href: "#",
    matchup: "BOS @ NYY", gameId: "g1", time: "7:05 PM EDT", timeSort: "2026-07-02T19:05",
    playerHand: "RHB", opponent: { name: "B. Bello", hand: "RHP" },
    bvp: { pa: 9, ab: 8, hits: 2, hr: 1, k: 2, avg: ".250" }, status: "confirmed", bat_order: 3,
    player_id: 592450, windDir: 30, windMph: 11, tempF: 78, precipPct: 0 },
  { id: "2", player: "Juan Soto", team: "NYY", prob: 0.29, detail: "vs BOS", href: "#",
    matchup: "BOS @ NYY", gameId: "g1", time: "7:05 PM EDT", timeSort: "2026-07-02T19:05",
    playerHand: "LHB", opponent: { name: "B. Bello", hand: "RHP" }, status: "confirmed", bat_order: 2,
    player_id: 665742, windDir: 30, windMph: 11, tempF: 78, precipPct: 0 },
  { id: "3", player: "Rafael Devers", team: "BOS", prob: 0.24, detail: "@ NYY", href: "#",
    matchup: "BOS @ NYY", gameId: "g1", time: "7:05 PM EDT", timeSort: "2026-07-02T19:05",
    playerHand: "LHB", opponent: { name: "G. Cole", hand: "RHP" }, status: "projected", bat_order: 3,
    player_id: 646240, windDir: 30, windMph: 11, tempF: 78, precipPct: 0 },
  { id: "4", player: "Shohei Ohtani", team: "LAD", prob: 0.38, detail: "@ SF", href: "#",
    matchup: "LAD @ SF", gameId: "g2", time: "9:45 PM EDT", timeSort: "2026-07-02T21:45",
    playerHand: "LHB", opponent: { name: "L. Webb", hand: "RHP" },
    bvp: { pa: 11, ab: 10, hits: 3, hr: 1, k: 3, avg: ".300" }, status: "confirmed", bat_order: 3,
    player_id: 660271, windDir: 200, windMph: 8, tempF: 64, precipPct: 0 },
  { id: "5", player: "Mookie Betts", team: "LAD", prob: 0.24, detail: "@ SF", href: "#",
    matchup: "LAD @ SF", gameId: "g2", time: "9:45 PM EDT", timeSort: "2026-07-02T21:45",
    playerHand: "RHB", opponent: { name: "L. Webb", hand: "RHP" }, status: "confirmed", bat_order: 1,
    player_id: 605141, windDir: 200, windMph: 8, tempF: 64, precipPct: 40 },
  { id: "6", player: "Matt Chapman", team: "SF", prob: 0.19, detail: "vs LAD", href: "#",
    matchup: "LAD @ SF", gameId: "g2", time: "9:45 PM EDT", timeSort: "2026-07-02T21:45",
    playerHand: "RHB", opponent: { name: "Y. Yamamoto", hand: "RHP" }, status: "confirmed", bat_order: 4,
    player_id: 656305, windDir: 200, windMph: 8, tempF: 64, precipPct: 0 },
];

const BOARD_VIEWS: { value: BoardViewMode; label: string }[] = [
  { value: "cards",    label: "Cards"    },
  { value: "split",    label: "Split"    },
  { value: "table",    label: "Table"    },
  { value: "matchups", label: "Matchups" },
];

// ── Demo Projections (drives the TopPlays leaderboards) ───────────────────────
const DEMO_PROJECTIONS: Projections = {
  date: DEMO_DATES[0],
  updated: DEMO_DATES[0],
  hr: [
    { player: "Aaron Judge", team: "NYY", park: "Yankee Stadium", matchup: "BOS @ NYY",
      game_id: 1, game_time: "2026-07-02T19:05", player_id: 592450, bats: "R", bat_order: 3,
      probability: 0.41, wind_out_mph: 8, weather_mult: 1.05, park_mult: 1.08, recent_form_mult: 1.1,
      lineup_status: "confirmed",
      vs: { name: "B. Bello", throws: "R", lean: "H", prob: 0.31, k_prob: 0.24, hit_prob: 0.31,
        bvp: { pa: 9, ab: 8, hits: 2, hr: 1, k: 2, avg: ".250" } } },
    { player: "Shohei Ohtani", team: "LAD", park: "Oracle Park", matchup: "LAD @ SF",
      game_id: 2, game_time: "2026-07-02T21:45", player_id: 660271, bats: "L", bat_order: 3,
      probability: 0.34, wind_out_mph: -6, weather_mult: 0.94, park_mult: 0.92, recent_form_mult: 1.05,
      lineup_status: "confirmed",
      vs: { name: "L. Webb", throws: "R", lean: "K", prob: 0.29, k_prob: 0.29, hit_prob: 0.22 } },
    { player: "Rafael Devers", team: "BOS", park: "Yankee Stadium", matchup: "BOS @ NYY",
      game_id: 1, game_time: "2026-07-02T19:05", player_id: 646240, bats: "L", bat_order: 3,
      probability: 0.24, wind_out_mph: 8, weather_mult: 1.05, park_mult: 1.08, recent_form_mult: 0.98,
      lineup_status: "projected",
      vs: { name: "G. Cole", throws: "R", lean: "NEU", prob: 0.26, k_prob: 0.27, hit_prob: 0.26 } },
  ],
  strikeouts: [
    { player: "Gerrit Cole", team: "NYY", matchup: "BOS @ NYY", game_id: 1, game_time: "2026-07-02T19:05",
      player_id: 543037, throws: "R", pitcher_status: "confirmed", expected_ks: 6.8, line: 5.5, over_prob: 0.62,
      temp_f: 78, wind_mph: 11, wind_dir: 30, precip_pct: 0,
      matchups: [
        { name: "Jarren Duran", bats: "L", lean: "H", prob: 0.30, k_prob: 0.22, hit_prob: 0.30, player_id: 680776,
          bvp: { pa: 6, ab: 6, hits: 2, hr: 0, k: 1, avg: ".333" } },
        { name: "Rafael Devers", bats: "L", lean: "NEU", prob: 0.27, k_prob: 0.26, hit_prob: 0.27, player_id: 646240,
          bvp: { pa: 14, ab: 12, hits: 3, hr: 1, k: 4, avg: ".250" } },
        { name: "Trevor Story", bats: "R", lean: "K", prob: 0.31, k_prob: 0.31, hit_prob: 0.21, player_id: 596115 },
      ] },
    { player: "Logan Webb", team: "SF", matchup: "LAD @ SF", game_id: 2, game_time: "2026-07-02T21:45",
      player_id: 657277, throws: "R", pitcher_status: "confirmed", expected_ks: 5.4, line: 5.5, over_prob: 0.48 },
  ],
  hits: [
    { player: "Aaron Judge", team: "NYY", matchup: "BOS @ NYY", game_id: 1, game_time: "2026-07-02T19:05",
      player_id: 592450, bats: "R", bat_order: 3, lineup_status: "confirmed", p_ge1: 0.72, p_ge2: 0.34, p_ge3: 0.08,
      vs: { name: "B. Bello", throws: "R", lean: "H", prob: 0.31, k_prob: 0.24, hit_prob: 0.31 } },
    { player: "Mookie Betts", team: "LAD", matchup: "LAD @ SF", game_id: 2, game_time: "2026-07-02T21:45",
      player_id: 605141, bats: "R", bat_order: 1, lineup_status: "confirmed", p_ge1: 0.66, p_ge2: 0.28, p_ge3: 0.06,
      vs: { name: "L. Webb", throws: "R", lean: "NEU", prob: 0.28, k_prob: 0.22, hit_prob: 0.28 } },
  ],
  total_bases: [
    { player: "Aaron Judge", team: "NYY", matchup: "BOS @ NYY", game_id: 1, game_time: "2026-07-02T19:05",
      player_id: 592450, bats: "R", bat_order: 3, lineup_status: "confirmed", p_ge2: 0.52, p_ge3: 0.31, p_ge4: 0.19 },
  ],
  runs: [
    { player: "Aaron Judge", team: "NYY", matchup: "BOS @ NYY", game_id: 1, game_time: "2026-07-02T19:05",
      player_id: 592450, bats: "R", bat_order: 3, lineup_status: "confirmed", p_ge1: 0.58, p_ge2: 0.19 },
  ],
  rbi: [
    { player: "Aaron Judge", team: "NYY", matchup: "BOS @ NYY", game_id: 1, game_time: "2026-07-02T19:05",
      player_id: 592450, bats: "R", bat_order: 3, lineup_status: "confirmed", p_ge1: 0.55, p_ge2: 0.21 },
  ],
  hrr: [
    { player: "Aaron Judge", team: "NYY", matchup: "BOS @ NYY", game_id: 1, game_time: "2026-07-02T19:05",
      player_id: 592450, bats: "R", bat_order: 3, lineup_status: "confirmed", p_ge2: 0.63, p_ge3: 0.38, p_ge4: 0.2 },
  ],
};

const DEMO_THRESHOLDS: TopPlaysThresholds = { hits: 1, tb: 2, runs: 1, rbi: 1, hrr: 2 };

// ── Demo games for Parks ledger (sorted best-env-first, as the API delivers) ──
const DEMO_GAMES: Game[] = [
  { game_id: 1, game_time: "2026-07-02T19:05", matchup: "BOS @ NYY",
    park: "yankee_stadium", park_name: "Yankee Stadium",
    park_mult: 1.08, weather_mult: 1.05, env: 1.134,
    wind_dir: 30, wind_mph: 11, temp_f: 78, precip_pct: 0 },
  { game_id: 3, game_time: "2026-07-02T20:10", matchup: "ATL @ PHI",
    park: "citizens_bank", park_name: "Citizens Bank Park",
    park_mult: 1.05, weather_mult: 1.02, env: 1.071,
    wind_dir: 0, wind_mph: 14, temp_f: 81, precip_pct: 10 },
  { game_id: 4, game_time: "2026-07-02T20:40", matchup: "NYM @ MIA",
    park: "loandepot", park_name: "loanDepot park",
    park_mult: 0.96, weather_mult: 1.01, env: 0.970,
    wind_dir: 180, wind_mph: 5, temp_f: 86, precip_pct: 40 },
  { game_id: 2, game_time: "2026-07-02T21:45", matchup: "LAD @ SF",
    park: "oracle_park", park_name: "Oracle Park",
    park_mult: 0.92, weather_mult: 0.94, env: 0.865,
    wind_dir: 200, wind_mph: 8, temp_f: 64, precip_pct: 0 },
];

// ── Main component ───────────────────────────────────────────────────────────

export function KitDemo() {
  const [source, setSource]   = useState<"current" | "blend" | "hist">("current");
  const [section, setSection] = useState<NavSection>("board");
  const [date, setDate]       = useState(DEMO_DATES[0]);
  const [segDemo, setSegDemo] = useState("a");
  const [segGhost, setSegGhost] = useState("x");
  const [segSm, setSegSm]     = useState("p");
  const [segScroll, setSegScroll] = useState("hr");
  const [boardView, setBoardView] = useState<BoardViewMode>("cards");
  const [topThr, setTopThr]   = useState<TopPlaysThresholds>(DEMO_THRESHOLDS);

  // URL-addressable player/pitcher modal (?player=&prop=&threshold=)
  const { selection, openPlayer, closePlayer } = usePlayerModalUrl();

  return (
    <>
      {/* ── Sticky command bar (now owns the date picker) ───────── */}
      <CommandBar
        source={source}
        onSourceChange={setSource}
        dates={DEMO_DATES}
        selectedDate={date}
        onDate={setDate}
      />

      <main className="sp-wrap" style={{ paddingBottom: 80 }}>

        {/* ── KPI tiles (no headline, no date picker) ───────────── */}
        <HeroTiles tiles={DEMO_TILES} />

        {/* ── Nav dock ──────────────────────────────────────────── */}
        <NavDock section={section} onSection={setSection} />

        {/* ══════════════════════════════════════════════════════════
            Kit Components – Visual QA
            ══════════════════════════════════════════════════════ */}

        {/* ── Probability Orbs ──────────────────────────────────── */}
        <QaHeading>ProbabilityOrb — sizes 80 / 64 / 48, multiple kinds</QaHeading>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <ProbabilityOrb prob={0.34} kind="hr"    size={80} label="HR" />
          <ProbabilityOrb prob={0.55} kind="k"     size={80} label="K"  />
          <ProbabilityOrb prob={0.72} kind="hits1"  size={64} label="H1" />
          <ProbabilityOrb prob={0.44} kind="hits2"  size={64} label="H2" />
          <ProbabilityOrb prob={0.61} kind="tb2"   size={48} label="TB" />
          <ProbabilityOrb prob={0.18} kind="hr"    size={48} />
        </div>

        {/* ── Glass Dots ────────────────────────────────────────── */}
        <QaHeading>CatDot / EnvDot / LeanPair</QaHeading>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <CatDot kind="K" prob={0.42} size={48} />
          <CatDot kind="C" prob={0.31} size={48} />
          <CatDot kind="N" prob={0}    size={48} />
          <EnvDot pct={1.09} size={56} />
          <EnvDot pct={0.93} size={56} />
          <EnvDot pct={1.01} size={56} />
          <LeanPair k={0.42} h={0.28} size={46} />
          <LeanPair k={0.22} h={0.39} size={46} />
          <LeanPair k={0.30} h={0.31} compact />
          <LeanPair k={0.42} h={0.18} compact />
        </div>

        {/* ── Chips ────────────────────────────────────────────── */}
        <QaHeading>Chips — Badge, TagChip, HandChip, FormChip, FBox, Bvp</QaHeading>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Badge kind="strong" />
          <Badge kind="lean"   />
          <Badge kind="pass"   />
          <TagChip status="conf" />
          <TagChip status="proj" />
          <TagChip status="conf" order={3} />
          <HandChip hand="R" />
          <HandChip hand="L" adv />
          <HandChip hand="SW" />
          <FormChip kind="hot"    />
          <FormChip kind="cold"   />
          <FormChip kind="steady" />
          <FBox label="PA" value="4" />
          <FBox icon={<span>⚡</span>} label="K%" value="38%" />
          <Bvp hits={3} ab={8} hr={1} />
          <Bvp hits={0} ab={4} />
        </div>

        {/* ── Segmented Controls ────────────────────────────────── */}
        <QaHeading>SegmentedControl — default / ghost / sm / scroll</QaHeading>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <SegmentedControl
            options={[{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }, { value: "c", label: "Gamma" }]}
            value={segDemo}
            onChange={setSegDemo}
            variant="default"
          />
          <SegmentedControl
            options={[{ value: "x", label: "Current" }, { value: "y", label: "Blend" }, { value: "z", label: "History 3yr" }]}
            value={segGhost}
            onChange={setSegGhost}
            variant="ghost"
          />
          <SegmentedControl
            options={[{ value: "p", label: "1+" }, { value: "q", label: "2+" }, { value: "r", label: "3+" }]}
            value={segSm}
            onChange={setSegSm}
            variant="sm"
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <SegmentedControl
            options={[
              { value: "hr",   label: "Home Run"   },
              { value: "k",    label: "Strikeout"  },
              { value: "hits", label: "Hits"        },
              { value: "tb",   label: "Total Bases" },
              { value: "runs", label: "Runs"        },
              { value: "rbi",  label: "RBI"         },
              { value: "hrr",  label: "H+R+RBI"     },
            ]}
            value={segScroll}
            onChange={setSegScroll}
            scroll
          />
        </div>

        {/* ── Factor Bars ───────────────────────────────────────── */}
        <QaHeading>FactorBar — positive / negative / neutral</QaHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
          <FactorBar label="Park factor"      mult={1.08} note="Coors is a hitter-friendly park" />
          <FactorBar label="Weather"          mult={0.93} note="Wind blowing in, −7% HR env" />
          <FactorBar label="Recent form"      mult={1.00} note="No significant form deviation" />
        </div>

        {/* ── Glass Cards ───────────────────────────────────────── */}
        <QaHeading>GlassCard — flat + tilt</QaHeading>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <GlassCard style={{ padding: 20, minWidth: 180 }}>
            <div className="sp-eyebrow" style={{ marginBottom: 8 }}>Flat card</div>
            <p style={{ fontSize: ".84rem", color: "var(--ink-dim)", margin: 0 }}>
              No interaction, static glass surface.
            </p>
          </GlassCard>
          <GlassCard tilt style={{ padding: 20, minWidth: 180 }}>
            <div className="sp-eyebrow" style={{ marginBottom: 8 }}>Tilt card</div>
            <p style={{ fontSize: ".84rem", color: "var(--ink-dim)", margin: 0 }}>
              Pointer-tracking 3-D tilt + gloss.
            </p>
          </GlassCard>
        </div>

        {/* ── Live Chips ────────────────────────────────────────── */}
        <QaHeading>LiveChip — pregame / live / cleared / missed + sm</QaHeading>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <LiveChip state="pregame" have={0} need={1} />
          <LiveChip state="live"    have={0} need={1} />
          <LiveChip state="cleared" have={1} need={1} />
          <LiveChip state="missed"  have={0} need={1} />
          <LiveChip state="cleared" have={2} need={1} />
          <LiveChip state="live"    have={3} need={6} sm />
          <LiveChip state="cleared" have={8} need={6} sm />
        </div>

        {/* ── Board views (task 1.1) ────────────────────────────── */}
        <QaHeading>BoardView — cards / split / table / matchups (HR demo)</QaHeading>
        <div style={{ marginBottom: 16 }}>
          <SegmentedControl
            options={BOARD_VIEWS}
            value={boardView}
            onChange={(v) => setBoardView(v as BoardViewMode)}
            variant="ghost"
          />
        </div>
        <BoardView
          rows={DEMO_ROWS}
          view={boardView}
          prop="hr"
          onOpenPlayer={(id) => console.log("open player", id)}
        />

        {/* ── Top Plays (task 1.3) ───────────────────────────────── */}
        <QaHeading>TopPlays — 9 leaderboards · show-count · inline thresholds</QaHeading>
        <TopPlays
          projections={DEMO_PROJECTIONS}
          source={source}
          threshold={topThr}
          onThreshold={(prop, n) => setTopThr((t) => ({ ...t, [prop]: n }))}
          onOpenPlayer={(id, prop) => console.log("open player", id, prop)}
        />

        {/* ── Parks ledger (task 1.4) ────────────────────────────── */}
        <QaHeading>Parks — ranked env ledger · best hitting environments first</QaHeading>
        <Parks games={DEMO_GAMES} />

        {/* ── Player / Pitcher modal (task 1.5) ──────────────────── */}
        <QaHeading>PlayerModal — URL-addressable pop-up detail (?player=&prop=)</QaHeading>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="sp-mclose" style={{ width: "auto", padding: "0 14px", height: 34 }}
            onClick={() => openPlayer("592450", "hr")}>Open batter (HR · Judge)</button>
          <button className="sp-mclose" style={{ width: "auto", padding: "0 14px", height: 34 }}
            onClick={() => openPlayer("592450", "hits", topThr.hits)}>Open batter (Hits · Judge)</button>
          <button className="sp-mclose" style={{ width: "auto", padding: "0 14px", height: 34 }}
            onClick={() => openPlayer("592450", "hrr", topThr.hrr)}>Open batter (H+R+RBI · Judge)</button>
          <button className="sp-mclose" style={{ width: "auto", padding: "0 14px", height: 34 }}
            onClick={() => openPlayer("543037", "k")}>Open pitcher (K · Cole)</button>
        </div>

      </main>

      {/* Modal lives outside <main> so its fixed overlay covers the viewport. */}
      <PlayerModal
        open={selection != null}
        playerId={selection?.playerId ?? null}
        prop={selection?.prop ?? "hr"}
        threshold={selection?.threshold}
        source={source}
        onClose={closePlayer}
        onOpenPlayer={(id, p) => openPlayer(id, p)}
        projections={DEMO_PROJECTIONS}
      />
    </>
  );
}

export default KitDemo;
