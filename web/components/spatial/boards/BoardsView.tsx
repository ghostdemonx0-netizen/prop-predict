/**
 * BoardsView.tsx — the "Boards" section: competitor-style heatmap boards.
 * Phase 1 = MOCK DATA prototype (web/lib/barrelMock.ts).
 * Phase 2 = REAL barrel data from the export (mock fallback when absent).
 * Columns follow the active lens (normal | effect | barrel).
 */
"use client";

import "../spatial.css";
import type { BoardsLens } from "../../../lib/barrelLens";
import { boardsColumnsFor, heatColor, PITCHER_COLUMNS, type ColumnDef } from "../../../lib/barrelColumns";
import { MOCK_GAMES, MOCK_PITCHER_BOARD } from "../../../lib/barrelMock";
import type { BoardsData, BoardHitter, BoardPitcher, BoardsGame } from "../../../lib/types";
import { GlassCard } from "../GlassCard";
import { HandChip } from "../chips";

export interface BoardsViewProps {
  lens: BoardsLens;
  boards?: BoardsData;
}

/** Format a stat for display (small decimals stay decimal, else integer). */
function fmt(v: number): string {
  if (Math.abs(v) < 1 && v !== 0) return v.toFixed(3).replace(/^0/, "");
  return String(Math.round(v * 10) / 10);
}

function HeatTable({
  title, hitters, columns,
}: {
  title: string;
  hitters: BoardHitter[];
  columns: ColumnDef[];
}) {
  const rows = [...hitters].sort(
    (a, b) => (b.stats.trueScore ?? 0) - (a.stats.trueScore ?? 0),
  );
  return (
    <div style={{ marginBottom: 22 }}>
      <h4 style={{ fontSize: 15, margin: "0 0 8px", fontWeight: 700 }}>{title}</h4>
      <div style={{ overflowX: "auto" }} className="sp-float" >
        <table className="sp-boardstable" style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 10px", position: "sticky", left: 0 }}>Player</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{
                    padding: "6px 8px",
                    textAlign: "center",
                    opacity: c.context ? 0.55 : (c.highlight ? 1 : 0.85),
                    color: c.context ? undefined : (c.highlight ? "var(--iris-cyan)" : undefined),
                    fontStyle: c.context ? "italic" : undefined,
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: "5px 10px", whiteSpace: "nowrap", position: "sticky", left: 0 }}>
                  <span style={{ opacity: 0.5, marginRight: 6 }}>#{r.order}</span>
                  {r.name} <HandChip hand={r.hand} />
                </td>
                {columns.map((c) => {
                  const raw = r.stats[c.key];
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
      {columns.some((c) => c.context) && (
        <div className="sp-board-legend">
          <span style={{ color: "var(--iris-cyan)" }}>●</span>{" moves your number · "}
          <span style={{ fontStyle: "italic", opacity: 0.65 }}>○</span>{" context (reading only)"}
        </div>
      )}
    </div>
  );
}

function PitcherBoard({ pitchers }: { pitchers: BoardPitcher[] }) {
  const rows = [...pitchers].sort((a, b) => (b.stats.brlbip ?? 0) - (a.stats.brlbip ?? 0));
  return (
    <details open className="sp-boardsec" style={{ marginBottom: 24 }}>
      <summary className="sp-boardsec-head">Slate Pitchers</summary>
      <div style={{ overflowX: "auto", marginTop: 10 }} className="sp-float">
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 10px" }}>Pitcher</th>
              <th style={{ padding: "6px 8px" }}>Opp</th>
              {PITCHER_COLUMNS.map((c) => (
                <th key={c.key} style={{ padding: "6px 8px", textAlign: "center", opacity: c.context ? 0.55 : 0.85, fontStyle: c.context ? "italic" : undefined }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.name}>
                <td style={{ padding: "5px 10px", whiteSpace: "nowrap" }}>{p.name} <span style={{ opacity: 0.5 }}>({p.throws})</span></td>
                <td style={{ padding: "5px 8px", textAlign: "center", opacity: 0.7 }}>{p.opp}</td>
                {PITCHER_COLUMNS.map((c) => {
                  const raw = p.stats[c.key];
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
    </details>
  );
}

const pnum = (v: number) =>
  v < 1 && v !== 0 ? v.toFixed(2).replace(/^0/, "") : String(Math.round(v * 10) / 10);

/** The opposing pitcher's slate row, shown on top of the hitters who face them. */
function PitcherStatRow({ name, pitchers }: { name: string; pitchers: BoardPitcher[] }) {
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
              const raw = p.stats[c.key];
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

function TopReads({ games, lens }: { games: BoardsGame[]; lens: BoardsLens }) {
  const all = games.flatMap((g) => [
    ...g.awayHitters.map((h) => ({ h, vs: `${g.away} vs ${g.home}` })),
    ...g.homeHitters.map((h) => ({ h, vs: `${g.home} vs ${g.away}` })),
  ]);
  // OFF = rank by your current-model score (mock: matchup); ON/Barrel = barrel score.
  const scoreOf = (h: BoardHitter) => (lens === "normal" ? (h.stats.matchup ?? 0) : (h.stats.trueScore ?? 0));
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
              const raw = h.stats[key];
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

export function BoardsView({ lens, boards }: BoardsViewProps) {
  const columns = boardsColumnsFor(lens);
  const games: BoardsGame[] = boards?.games ?? MOCK_GAMES;
  const slatePitchers: BoardPitcher[] = boards?.pitchers ?? MOCK_PITCHER_BOARD;
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
      <PitcherBoard pitchers={slatePitchers} />

      <TopReads games={games} lens={lens} />

      {games.map((g) => (
        <details key={g.id} open className="sp-boardsec" style={{ marginBottom: 24 }}>
          <summary className="sp-boardsec-head">
            {g.away} @ {g.home}
            <span style={{ opacity: 0.55, fontSize: 13, fontWeight: 400, marginLeft: 10 }}>
              {g.venue} · {g.note}
            </span>
          </summary>
          <div style={{ marginTop: 12 }}>
            {/* Opposing pitcher's slate row sits on top of the lineup facing them */}
            <PitcherStatRow name={g.homePitcher} pitchers={slatePitchers} />
            <HeatTable title={`${g.away} hitters vs ${g.homePitcher}`} hitters={g.awayHitters} columns={columns} />
            <div style={{ height: 16 }} />
            <PitcherStatRow name={g.awayPitcher} pitchers={slatePitchers} />
            <HeatTable title={`${g.home} hitters vs ${g.awayPitcher}`} hitters={g.homeHitters} columns={columns} />
          </div>
        </details>
      ))}
    </div>
  );
}

export default BoardsView;
