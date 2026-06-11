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
      </div>
      <WeatherChips r={r} />
    </Link>
  );

  const Table = () => (
    <table className="board">
      <thead>
        <tr>
          <th>Player</th>
          <th>Team</th>
          <th>Detail</th>
          <th style={{ textAlign: "right" }}>Chance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.player}>
            <td>
              <Link href={r.href} className="linklike">{r.player}</Link>
            </td>
            <td style={{ color: "var(--muted)" }}>{r.team}</td>
            <td style={{ color: "var(--muted)" }}>{r.detail}</td>
            <td style={{ textAlign: "right" }}>
              <span className="sphere">{pct(r.prob)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const List = () => (
    <div>
      {rows.map((r, i) => (
        <Link
          key={r.player}
          href={r.href}
          className="rise"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.7rem 0.25rem",
            borderBottom: "1px solid var(--line)",
            color: "var(--text)",
            textDecoration: "none",
            animationDelay: `${i * 35}ms`,
          }}
        >
          <span style={{ fontWeight: 600 }}>
            {r.player} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{r.detail}</span>
          </span>
          <span className="stat">{pct(r.prob)}</span>
        </Link>
      ))}
    </div>
  );

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
