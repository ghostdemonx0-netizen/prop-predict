/**
 * BoardsView.tsx — the "Boards" section: competitor-style heatmap boards.
 * Phase 1 = MOCK DATA prototype (web/lib/barrelMock.ts).
 * Columns follow the active lens (normal | effect | barrel).
 */
"use client";

import "../spatial.css";
import type { BoardsLens } from "../../../lib/barrelLens";
import { boardsColumnsFor, heatColor, type ColumnDef } from "../../../lib/barrelColumns";
import { MOCK_GAMES, type MockHitter } from "../../../lib/barrelMock";
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

      {MOCK_GAMES.map((g) => (
        <section key={g.id} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 17, margin: "0 0 4px" }}>
            {g.away} @ {g.home}
          </h3>
          <p style={{ opacity: 0.6, margin: "0 0 12px", fontSize: 13 }}>
            {g.venue} · {g.note}
          </p>
          <HeatTable title={`${g.away} hitters vs ${g.homePitcher}`} hitters={g.awayHitters} columns={columns} />
          <HeatTable title={`${g.home} hitters vs ${g.awayPitcher}`} hitters={g.homeHitters} columns={columns} />
        </section>
      ))}
    </div>
  );
}

export default BoardsView;
