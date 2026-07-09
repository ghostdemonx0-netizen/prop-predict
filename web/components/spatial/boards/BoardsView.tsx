/**
 * BoardsView.tsx — the "Boards" section: competitor-style heatmap boards.
 * Phase 1 = MOCK DATA prototype (web/lib/barrelMock.ts).
 * Phase 2 = REAL barrel data from the export (mock fallback when absent).
 * Columns follow the active lens (normal | effect | barrel).
 */
"use client";

import { useState } from "react";
import "../spatial.css";
import type { BoardsLens } from "../../../lib/barrelLens";
import { boardsColumnsFor, heatColor, PITCHER_COLUMNS, type ColumnDef } from "../../../lib/barrelColumns";
import { MOCK_GAMES, MOCK_PITCHER_BOARD } from "../../../lib/barrelMock";
import type { BoardsData, BoardHitter, BoardPitcher, BoardsGame } from "../../../lib/types";
import type { Source } from "../../../lib/weighting";
import { GlassCard } from "../GlassCard";
import { HandChip } from "../chips";
import { BarrelFlag } from "../BarrelFlag";
import { EnvDot } from "../GlassDot";
import { gameTimeLabel } from "../../../lib/format";

export interface BoardsViewProps {
  lens: BoardsLens;
  boards?: BoardsData;
  /** timeframe: current · blend (50/50) · hist — selects the board's data window */
  source?: Source;
}

/** Format a stat for display (small decimals stay decimal, else integer). */
function fmt(v: number): string {
  if (Math.abs(v) < 1 && v !== 0) return v.toFixed(3).replace(/^0/, "");
  return String(Math.round(v * 10) / 10);
}

/** Stats that are a CURRENT-season concept only — a 3-yr baseline (History/Blend)
 *  has no "recent form", so these read "—" outside Current instead of a
 *  misleading uniform neutral value. */
const CURRENT_ONLY_STATS = new Set(["form", "hrform"]);

/**
 * Timeframe-aware stat read. current → the raw stat; hist → its `_hist` twin;
 * blend → 50/50 of the two. Falls back to current when a twin is absent
 * (e.g. park/weather driver cols, which are timeframe-invariant).
 */
function statVal(
  stats: Record<string, number>, key: string, source: Source = "current",
): number | undefined {
  // Form is "—" ONLY in pure History (a 3-yr baseline has no recent form). In
  // Blend it flows through the 50/50 below → a muted (dampened) form, since the
  // history twin is neutral: blend = (current + neutral) / 2.
  if (source === "hist" && CURRENT_ONLY_STATS.has(key)) return undefined;
  const cur = stats[key];
  if (source === "current") return cur;
  const hist = stats[`${key}_hist`];
  if (hist === undefined || hist === null) return cur;
  if (source === "hist") return hist;
  if (cur === undefined || cur === null) return hist;
  return (cur + hist) / 2;
}

/** Legend explaining which columns move your number vs. context-only. */
function ColumnLegend() {
  return (
    <div className="sp-board-legend">
      <span style={{ color: "var(--iris-cyan)" }}>●</span>{" moves your number · "}
      <span style={{ fontStyle: "italic", opacity: 0.65 }}>○</span>{" context (reading only)"}
    </div>
  );
}

/** Click-to-sort state for a board table (default = a stat key, desc).
 *  Re-defaults when `defaultKey` changes (e.g. switching Normal↔Barrel mode
 *  flips the ranking from Matchup to Prop Score) — the set-during-render reset
 *  pattern. Manual clicks still win until the next mode change. */
function useColumnSort(defaultKey: string) {
  const [sortKey, setSortKey] = useState<string>(defaultKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [prevDefault, setPrevDefault] = useState<string>(defaultKey);
  if (defaultKey !== prevDefault) {
    setPrevDefault(defaultKey);
    setSortKey(defaultKey);
    setSortDir("desc");
  }
  const click = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };
  const arrow = (key: string) => (sortKey === key ? (sortDir === "desc" ? " ▼" : " ▲") : "");
  return { sortKey, sortDir, click, arrow };
}

/** Numeric comparator; missing/null values always sort last. */
function cmpStat(a: number | null | undefined, b: number | null | undefined, dir: "asc" | "desc"): number {
  const an = a === undefined || a === null, bn = b === undefined || b === null;
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  return dir === "desc" ? (b as number) - (a as number) : (a as number) - (b as number);
}

function HeatTable({
  title, hitters, columns, source, defaultSortKey,
}: {
  title: string;
  hitters: BoardHitter[];
  columns: ColumnDef[];
  source: Source;
  defaultSortKey: string;
}) {
  const sort = useColumnSort(defaultSortKey);
  const rows = [...hitters].sort((a, b) =>
    sort.sortKey === "__name"
      ? (sort.sortDir === "desc" ? -1 : 1) * a.name.localeCompare(b.name)
      : cmpStat(statVal(a.stats, sort.sortKey, source), statVal(b.stats, sort.sortKey, source), sort.sortDir),
  );
  return (
    <div style={{ marginBottom: 22 }}>
      <h4 style={{ fontSize: 15, margin: "0 0 8px", fontWeight: 700 }}>{title}</h4>
      <div style={{ overflowX: "auto" }} className="sp-float" >
        <table className="sp-boardstable" style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th onClick={() => sort.click("__name")} style={{ textAlign: "left", padding: "6px 10px", position: "sticky", left: 0, cursor: "pointer" }}>Player{sort.arrow("__name")}</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => sort.click(c.key)}
                  style={{
                    padding: "6px 8px",
                    textAlign: "center",
                    cursor: "pointer",
                    opacity: c.context ? 0.55 : (c.highlight ? 1 : 0.85),
                    color: c.context ? undefined : (c.highlight ? "var(--iris-cyan)" : undefined),
                    fontStyle: c.context ? "italic" : undefined,
                  }}
                >
                  {c.label}{sort.arrow(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: "5px 10px", whiteSpace: "nowrap", position: "sticky", left: 0 }}>
                  <span style={{ opacity: 0.5, marginRight: 6 }}>#{r.order}</span>
                  {r.name} <HandChip hand={r.hand} adv={(r.stats.platoon ?? 0) > 0} />{r.stats.oracle === 1 && <span style={{ marginLeft: 6 }}><BarrelFlag /></span>}
                </td>
                {columns.map((c) => {
                  const raw = statVal(r.stats, c.key, source);
                  const has = raw !== undefined && raw !== null;
                  const v = has ? raw : 0;
                  return (
                    <td key={c.key} style={{
                      padding: "5px 8px",
                      textAlign: "center",
                      background: has ? heatColor(v, c.min, c.max, c.higherBetter ?? true) : "transparent",
                      outline: (!c.context && c.highlight) ? "1px solid var(--iris-cyan)" : undefined,
                      opacity: c.context ? 0.55 : undefined,
                    }}>
                      {has ? fmt(v) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {columns.some((c) => c.context) && <ColumnLegend />}
    </div>
  );
}

function PitcherBoard({ pitchers, source }: { pitchers: BoardPitcher[]; source: Source }) {
  const sort = useColumnSort("brlbip");
  const rows = [...pitchers].sort((a, b) =>
    sort.sortKey === "__name"
      ? (sort.sortDir === "desc" ? -1 : 1) * a.name.localeCompare(b.name)
      : cmpStat(statVal(a.stats, sort.sortKey, source), statVal(b.stats, sort.sortKey, source), sort.sortDir),
  );
  return (
    <details className="sp-boardsec" style={{ marginBottom: 24 }}>
      <summary className="sp-boardsec-head">Slate Pitchers</summary>
      <div style={{ overflowX: "auto", marginTop: 10 }} className="sp-float">
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th onClick={() => sort.click("__name")} style={{ textAlign: "left", padding: "6px 10px", cursor: "pointer" }}>Pitcher{sort.arrow("__name")}</th>
              <th style={{ padding: "6px 8px" }}>Opp</th>
              {PITCHER_COLUMNS.map((c) => (
                <th key={c.key} onClick={() => sort.click(c.key)} style={{ padding: "6px 8px", textAlign: "center", cursor: "pointer", opacity: c.context ? 0.55 : 0.85, fontStyle: c.context ? "italic" : undefined }}>{c.label}{sort.arrow(c.key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.name}>
                <td style={{ padding: "5px 10px", whiteSpace: "nowrap" }}>{p.name} <span style={{ opacity: 0.5 }}>({p.throws})</span></td>
                <td style={{ padding: "5px 8px", textAlign: "center", opacity: 0.7 }}>{p.opp}</td>
                {PITCHER_COLUMNS.map((c) => {
                  const raw = statVal(p.stats, c.key, source);
                  const has = raw !== undefined && raw !== null;
                  const v = has ? raw : 0;
                  return (
                    <td key={c.key} style={{ padding: "5px 8px", textAlign: "center", background: has ? heatColor(v, c.min, c.max, c.higherBetter ?? true) : "transparent", opacity: c.context ? 0.55 : undefined }}>
                      {has ? (v < 1 && v !== 0 ? v.toFixed(2).replace(/^0/, "") : String(Math.round(v * 10) / 10)) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {PITCHER_COLUMNS.some((c) => c.context) && <ColumnLegend />}
    </details>
  );
}

const pnum = (v: number) =>
  v < 1 && v !== 0 ? v.toFixed(2).replace(/^0/, "") : String(Math.round(v * 10) / 10);

/** The opposing pitcher's slate row, shown on top of the hitters who face them. */
function PitcherStatRow({ name, pitchers, source }: { name: string; pitchers: BoardPitcher[]; source: Source }) {
  const p = pitchers.find((x) => x.name === name);
  if (!p) return null;
  return (
    <div style={{ overflowX: "auto", marginBottom: 6 }} className="sp-float">
      <table className="sp-boardstable" style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "6px 10px", position: "sticky", left: 0, color: "var(--iris-cyan)" }}>vs Pitcher</th>
            {PITCHER_COLUMNS.map((c) => (
              <th key={c.key} style={{ padding: "6px 8px", textAlign: "center", opacity: c.context ? 0.55 : 0.85, fontStyle: c.context ? "italic" : undefined }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: "5px 10px", whiteSpace: "nowrap", position: "sticky", left: 0 }}>
              <span style={{ color: "var(--iris-cyan)", fontWeight: 700 }}>vs</span> {p.name} <span style={{ opacity: 0.5 }}>({p.throws})</span>
            </td>
            {PITCHER_COLUMNS.map((c) => {
              const raw = statVal(p.stats, c.key, source);
              const has = raw !== undefined && raw !== null;
              const v = has ? raw : 0;
              return (
                <td key={c.key} style={{ padding: "5px 8px", textAlign: "center", background: has ? heatColor(v, c.min, c.max, c.higherBetter ?? true) : "transparent", opacity: c.context ? 0.55 : undefined }}>
                  {has ? pnum(v) : "—"}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Card factor-cells follow the lens: current drivers when barrel is OFF,
// the barrel recipe when Effect is ON or in Barrel Weight.
const DRIVER_CELLS: [string, string][] = [
  ["Matchup", "matchup"], ["Park", "park"], ["Wx", "weather"],
  ["Pitcher", "pitcher"], ["Form", "form"], ["HH%", "hardhit"],
];
const BARREL_CELLS: [string, string][] = [
  ["Matchup", "matchup"], ["ZoneFit", "zonefit"], ["HR Form", "hrform"],
  ["PullBrl", "pbrl"], ["Brl/BIP", "brl"], ["ISO", "iso"],
];

function TopReads({ games, lens, source }: { games: BoardsGame[]; lens: BoardsLens; source: Source }) {
  const all = games.flatMap((g) => [
    ...g.awayHitters.map((h) => ({ h, vs: `${g.away} vs ${g.home}` })),
    ...g.homeHitters.map((h) => ({ h, vs: `${g.home} vs ${g.away}` })),
  ]);
  // OFF = rank by your current-model score (matchup); ON/Barrel = barrel score.
  const scoreOf = (h: BoardHitter) => (lens === "normal" ? (statVal(h.stats, "matchup", source) ?? 0) : (statVal(h.stats, "trueScore", source) ?? 0));
  const top = [...all].sort((a, b) => scoreOf(b.h) - scoreOf(a.h)).slice(0, 4);
  const cells = lens === "normal" ? DRIVER_CELLS : BARREL_CELLS;
  const tag = lens === "barrel" ? "prop score · barrel" : lens === "effect" ? "prop score · +barrel" : "prop score · current";
  const cell = (v: number) =>
    Math.abs(v) < 1 && v !== 0 ? v.toFixed(3).replace(/^0/, "") : String(Math.round(v * 10) / 10);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 22 }}>
      {top.map(({ h, vs }) => (
        <GlassCard key={h.id} style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <b style={{ fontSize: 14 }}>{h.name}</b>
            <span className="sp-iristext" style={{ fontSize: 22, fontWeight: 800 }}>
              {Math.round(scoreOf(h))}
            </span>
          </div>
          <div style={{ opacity: 0.55, fontSize: 11, marginBottom: 8 }}>
            {vs} · <span className="sp-eyebrow">{tag}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {cells.map(([label, key]) => {
              const raw = statVal(h.stats, key, source);
              const has = raw !== undefined && raw !== null;
              return (
                <div key={key} style={{ textAlign: "center", background: "rgba(255,255,255,.05)", borderRadius: 6, padding: "4px 2px" }}>
                  <div style={{ fontSize: 9, opacity: 0.6 }}>{label}</div>
                  <b style={{ fontSize: 12 }}>{has ? cell(raw) : "—"}</b>
                </div>
              );
            })}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

export function BoardsView({ lens, boards, source = "current" }: BoardsViewProps) {
  const columns = boardsColumnsFor(lens);
  const games: BoardsGame[] = boards?.games ?? MOCK_GAMES;
  const slatePitchers: BoardPitcher[] = boards?.pitchers ?? MOCK_PITCHER_BOARD;
  // Mode-aware default ranking: Normal ranks by Matchup, barrel modes by Prop Score.
  const defaultSortKey = lens === "normal" ? "matchup" : "trueScore";
  const lensLabel =
    lens === "barrel" ? "Barrel Weight — replica" :
    lens === "effect" ? "Barrel Effect ON — barrel columns lit" :
    "Current drivers";

  return (
    <div className="sp-wrap" style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <h2 className="sp-iristext" style={{ fontSize: 22, margin: 0 }}>Boards</h2>
        <span className="sp-eyebrow">{lensLabel}</span>
      </div>

      {/* Slate pitchers up top */}
      <PitcherBoard pitchers={slatePitchers} source={source} />

      <TopReads games={games} lens={lens} source={source} />

      {games.map((g) => (
        <details key={g.id} className="sp-boardsec" style={{ marginBottom: 24 }}>
          <summary className="sp-boardsec-head" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>
              {g.away} @ {g.home}
              {g.game_time && (
                <span style={{ opacity: 0.7, fontWeight: 400 }}> · {gameTimeLabel(g.game_time)}</span>
              )}
            </span>
            <span style={{ opacity: 0.55, fontSize: 13, fontWeight: 400 }}>
              {g.venue}{g.note ? ` · ${g.note}` : ""}
            </span>
            {typeof g.env === "number" && (
              <span style={{ marginLeft: "auto", display: "inline-flex" }} title="park + weather">
                <EnvDot pct={g.env} size={26} />
              </span>
            )}
          </summary>
          <div style={{ marginTop: 12 }}>
            {/* awayPitcher = the pitcher the AWAY team FACES (the opponent);
                homePitcher = the pitcher the HOME team faces. Each lineup sits
                under the pitcher it BATS AGAINST — do NOT swap these. */}
            <PitcherStatRow name={g.awayPitcher} pitchers={slatePitchers} source={source} />
            <HeatTable title={`${g.away} hitters vs ${g.awayPitcher}`} hitters={g.awayHitters} columns={columns} source={source} defaultSortKey={defaultSortKey} />
            <div style={{ height: 16 }} />
            <PitcherStatRow name={g.homePitcher} pitchers={slatePitchers} source={source} />
            <HeatTable title={`${g.home} hitters vs ${g.homePitcher}`} hitters={g.homeHitters} columns={columns} source={source} defaultSortKey={defaultSortKey} />
          </div>
        </details>
      ))}
    </div>
  );
}

export default BoardsView;
