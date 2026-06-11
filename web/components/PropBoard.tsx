"use client";

import Link from "next/link";
import type { ViewMode } from "./ViewSwitcher";
import { pct, strengthLabel } from "../lib/format";

export type BoardRow = {
  player: string;
  team: string;
  prob: number; // probability or over_prob
  detail: string; // e.g. "@ COL" or "5.5 Ks"
  href: string;
  matchup?: string; // "AWAY @ HOME" — game grouping for the List view
  hand?: string; // combined card chip, e.g. "RHB vs LHP"
  playerHand?: string; // this player's own handedness (RHB/LHB/SW or RHP/LHP)
  opponent?: { name: string; hand?: string }; // opposing pitcher (+hand) for hitters, or opposing team for pitchers
  windOut?: number; // mph toward center field (+out / -in) — fallback if no direction
  windMph?: number; // true wind speed
  windDir?: number; // direction of travel rel. to CF: 0=out to CF, 90=to RF, 180=in, 270=to LF
  tempF?: number;
  precipPct?: number;
};

function WeatherChips({ r }: { r: BoardRow }) {
  // Prefer a true directional arrow; fall back to simple out/in if only windOut is known.
  const dir = typeof r.windDir === "number" ? r.windDir : r.windOut !== undefined ? (r.windOut >= 0 ? 0 : 180) : undefined;
  const mph = typeof r.windMph === "number" ? r.windMph : typeof r.windOut === "number" ? Math.abs(r.windOut) : undefined;
  const hasWind = typeof dir === "number" && typeof mph === "number";
  const hasTemp = typeof r.tempF === "number";
  const showRain = (r.precipPct ?? 0) >= 20;
  if (!hasWind && !hasTemp && !showRain) return null;

  // helps when blowing out (cos near +1), hurts blowing in (cos near -1), crosswind in between
  const outComponent = hasWind ? Math.cos(((dir as number) * Math.PI) / 180) : 0;
  const windColor = outComponent > 0.2 ? "var(--green)" : outComponent < -0.2 ? "var(--red)" : "var(--amber)";

  return (
    <div className="mt-1.5 flex items-center gap-3" style={{ fontSize: "0.74rem", color: "var(--muted)" }}>
      {hasWind && (
        <span className="inline-flex items-center gap-1" title="wind direction relative to the field (up = out to center)">
          <span
            style={{
              display: "inline-block",
              lineHeight: 1,
              fontWeight: 800,
              transform: `rotate(${dir}deg)`,
              color: windColor,
            }}
          >
            ↑
          </span>
          {Math.round(mph as number)}<span style={{ opacity: 0.6 }}>mph</span>
        </span>
      )}
      {hasTemp && <span>🌡️ {Math.round(r.tempF as number)}°</span>}
      {showRain && <span style={{ color: "#7cc7ff" }}>💧 {r.precipPct}%</span>}
    </div>
  );
}

function strengthClass(prob: number): string {
  if (prob >= 0.25) return "s-strong";
  if (prob >= 0.12) return "s-lean";
  return "s-pass";
}

function badgeClass(prob: number): string {
  if (prob >= 0.25) return "badge strong";
  if (prob >= 0.12) return "badge lean";
  return "badge pass";
}

// Heat-map: cool blue (low probability) -> warm red-orange (high), over ~5%-45%.
// Muted saturation/lightness so it reads softly on the dark theme.
function heatColor(p: number): string {
  const t = Math.max(0, Math.min(1, (p - 0.05) / 0.4));
  const hue = 210 - t * 210; // 210 (blue) -> 0 (red)
  return `hsl(${hue}, 52%, 40%)`;
}

function HeatSphere({ prob }: { prob: number }) {
  const c = heatColor(prob);
  return (
    <span
      className="sphere"
      title="model probability"
      style={{
        background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,0.12), ${c} 60%, rgba(8,14,10,0.65))`,
        borderColor: c,
        color: "#eef3f0",
        textShadow: "0 1px 2px rgba(0,0,0,0.6)",
      }}
    >
      {pct(prob)}
    </span>
  );
}

export function PropBoard({ rows, mode }: { rows: BoardRow[]; mode: ViewMode }) {
  if (rows.length === 0) {
    return (
      <div className="panel rise" style={{ textAlign: "center", color: "var(--muted)" }}>
        No plays on the board yet — lineups may not be posted.
      </div>
    );
  }

  const Card = (r: BoardRow, i: number) => (
    <Link
      href={r.href}
      key={r.player}
      className={`card rise ${strengthClass(r.prob)}`}
      style={{ animationDelay: `${i * 45}ms` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="display" style={{ fontWeight: 700, fontSize: "1.02rem" }}>
          {r.player}
        </span>
        <span className="stat glow" style={{ fontSize: "1.35rem" }}>
          {pct(r.prob)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
        <span className={badgeClass(r.prob)}>{strengthLabel(r.prob)}</span>
        <span>{r.detail}</span>
        {r.hand && <span className="hand">{r.hand}</span>}
      </div>
      <WeatherChips r={r} />
    </Link>
  );

  const Table = () => (
    <table className="board">
      <thead>
        <tr>
          <th style={{ whiteSpace: "nowrap" }}>Player</th>
          <th style={{ whiteSpace: "nowrap", paddingLeft: 0 }}>Team</th>
          <th style={{ width: "100%" }}>Opponent</th>
          <th style={{ textAlign: "right" }}>Probability</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.player}>
            <td style={{ whiteSpace: "nowrap" }}>
              <Link href={r.href} className="linklike">{r.player}</Link>
              {r.playerHand && <span className="hand" style={{ marginLeft: 6 }}>{r.playerHand}</span>}
            </td>
            <td style={{ color: "var(--muted)", whiteSpace: "nowrap", paddingLeft: 0 }}>{r.team}</td>
            <td style={{ color: "var(--muted)" }}>
              <span>{r.detail}</span>
              {r.opponent && (
                <>
                  <span style={{ opacity: 0.45 }}> · </span>
                  {r.opponent.name}
                  {r.opponent.hand && <span className="hand" style={{ marginLeft: 6 }}>{r.opponent.hand}</span>}
                </>
              )}
            </td>
            <td style={{ textAlign: "right" }}>
              <HeatSphere prob={r.prob} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const Row = (r: BoardRow) => (
    <Link
      key={r.player}
      href={r.href}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.6rem 0.25rem",
        borderBottom: "1px solid var(--line)",
        color: "var(--text)",
        textDecoration: "none",
      }}
    >
      <span style={{ fontWeight: 600 }}>
        {r.player} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{r.detail}</span>
      </span>
      <HeatSphere prob={r.prob} />
    </Link>
  );

  const List = () => {
    // Group rows by matchup, preserving the global high->low order. Because
    // `rows` arrives sorted by probability, groups appear best-game first.
    const groups: { key: string; rows: BoardRow[] }[] = [];
    const seen = new Map<string, number>();
    for (const r of rows) {
      const key = r.matchup ?? "Other";
      if (!seen.has(key)) {
        seen.set(key, groups.length);
        groups.push({ key, rows: [] });
      }
      groups[seen.get(key)!].rows.push(r);
    }
    return (
      <div>
        <div className="eyebrow" style={{ marginBottom: "0.6rem" }}>Matchups</div>
        {groups.map((g) => (
          <div key={g.key} className="rise" style={{ marginBottom: "1.1rem" }}>
            <div className="matchup-head">{g.key}</div>
            {g.rows.map(Row)}
          </div>
        ))}
      </div>
    );
  };

  if (mode === "table") return <Table />;
  if (mode === "list") return <List />;
  if (mode === "cards") return <div className="grid gap-2.5 sm:grid-cols-2">{rows.map(Card)}</div>;

  // hybrid: top 3 as glowing cards, the rest in a table
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow" style={{ marginBottom: "0.6rem" }}>★ Top plays</div>
        <div className="grid gap-2.5 sm:grid-cols-3">{top.map(Card)}</div>
      </div>
      {rest.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.4rem" }}>Full board</div>
          <Table />
        </div>
      )}
    </div>
  );
}
