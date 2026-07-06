/**
 * BoardsView.tsx — the "Boards" section: competitor-style heatmap boards.
 * Phase 1 = MOCK DATA prototype (web/lib/barrelMock.ts).
 * Columns follow the active lens (normal | effect | barrel).
 */
"use client";

import "../spatial.css";
import type { BoardsLens } from "../../../lib/barrelLens";
import { boardsColumnsFor, heatColor, PITCHER_COLUMNS, type ColumnDef } from "../../../lib/barrelColumns";
import { MOCK_GAMES, MOCK_PITCHER_BOARD, type MockHitter } from "../../../lib/barrelMock";
import { GlassCard } from "../GlassCard";
import { HandChip } from "../chips";

export interface BoardsViewProps {
  lens: BoardsLens;
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
  hitters: MockHitter[];
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
                  style={{ padding: "6px 8px", textAlign: "center", opacity: c.highlight ? 1 : 0.85, color: c.highlight ? "var(--iris-cyan)" : undefined }}
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
                  const v = r.stats[c.key] ?? 0;
                  return (
                    <td
                      key={c.key}
                      style={{
                        padding: "5px 8px",
                        textAlign: "center",
                        background: heatColor(v, c.min, c.max, c.higherBetter ?? true),
                        outline: c.highlight ? "1px solid var(--iris-cyan)" : undefined,
                      }}
                    >
                      {fmt(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PitcherBoard() {
  const rows = [...MOCK_PITCHER_BOARD].sort((a, b) => b.stats.pscore - a.stats.pscore);
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
                <th key={c.key} style={{ padding: "6px 8px", textAlign: "center", opacity: 0.85 }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.name}>
                <td style={{ padding: "5px 10px", whiteSpace: "nowrap" }}>{p.name} <span style={{ opacity: 0.5 }}>({p.throws})</span></td>
                <td style={{ padding: "5px 8px", textAlign: "center", opacity: 0.7 }}>{p.opp}</td>
                {PITCHER_COLUMNS.map((c) => {
                  const v = p.stats[c.key] ?? 0;
                  return (
                    <td key={c.key} style={{ padding: "5px 8px", textAlign: "center", background: heatColor(v, c.min, c.max, c.higherBetter ?? true) }}>
                      {v < 1 && v !== 0 ? v.toFixed(2).replace(/^0/, "") : Math.round(v * 10) / 10}
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

function TopReads({ lens }: { lens: BoardsLens }) {
  const all = MOCK_GAMES.flatMap((g) => [
    ...g.awayHitters.map((h) => ({ h, vs: `${g.away} vs ${g.home}` })),
    ...g.homeHitters.map((h) => ({ h, vs: `${g.home} vs ${g.away}` })),
  ]);
  // OFF = rank by your current-model score (mock: matchup); ON/Barrel = barrel score.
  const scoreOf = (h: MockHitter) => (lens === "normal" ? h.stats.matchup : h.stats.trueScore);
  const top = [...all].sort((a, b) => scoreOf(b.h) - scoreOf(a.h)).slice(0, 4);
  const cells = lens === "normal" ? DRIVER_CELLS : BARREL_CELLS;
  const tag = lens === "barrel" ? "barrel score" : lens === "effect" ? "score · +barrel" : "current score";
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
            {cells.map(([label, key]) => (
              <div key={key} style={{ textAlign: "center", background: "rgba(255,255,255,.05)", borderRadius: 6, padding: "4px 2px" }}>
                <div style={{ fontSize: 9, opacity: 0.6 }}>{label}</div>
                <b style={{ fontSize: 12 }}>{cell(h.stats[key] ?? 0)}</b>
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

export function BoardsView({ lens }: BoardsViewProps) {
  const columns = boardsColumnsFor(lens);
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
      <PitcherBoard />

      <TopReads lens={lens} />

      {MOCK_GAMES.map((g) => (
        <details key={g.id} open className="sp-boardsec" style={{ marginBottom: 24 }}>
          <summary className="sp-boardsec-head">
            {g.away} @ {g.home}
            <span style={{ opacity: 0.55, fontSize: 13, fontWeight: 400, marginLeft: 10 }}>
              {g.venue} · {g.note}
            </span>
          </summary>
          <div style={{ marginTop: 12 }}>
            <HeatTable title={`${g.away} hitters vs ${g.homePitcher}`} hitters={g.awayHitters} columns={columns} />
            <HeatTable title={`${g.home} hitters vs ${g.awayPitcher}`} hitters={g.homeHitters} columns={columns} />
          </div>
        </details>
      ))}
    </div>
  );
}

export default BoardsView;
