"use client";

import type { Game } from "../lib/types";
import { GameBreakdown, type BoardRow } from "./PropBoard";
import { heatColor, arrowColor, windText, gameTimeLabel } from "../lib/format";

function signed(mult: number) {
  const v = Math.round((mult - 1) * 100);
  return `${v >= 0 ? "+" : ""}${v}%`;
}

function EnvSphere({ env }: { env: number }) {
  const boost = env - 1;
  const c = heatColor(0.05 + Math.max(-0.03, boost));
  return (
    <span
      className="sphere"
      title="combined park + weather boost"
      style={{
        width: 54,
        height: 54,
        fontSize: "0.82rem",
        background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,0.12), ${c} 60%, rgba(8,14,10,0.65))`,
        borderColor: c,
        color: "#eef3f0",
        textShadow: "0 1px 2px rgba(0,0,0,0.6)",
      }}
    >
      {signed(env)}
    </span>
  );
}

/** The card face: headline, env sphere, park/weather chips (shared by both variants). */
function Face({ g, variant }: { g: Game; variant: "parks" | "hub" }) {
  const time = gameTimeLabel(g.game_time);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {variant === "parks" ? (
          <span>
            <span className="display" style={{ fontWeight: 700, fontSize: "1.02rem", display: "block" }}>
              {g.park_name ?? g.park}
            </span>
            <span className="num" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{g.matchup}</span>
          </span>
        ) : (
          <span>
            <span className="display" style={{ fontWeight: 700, fontSize: "1.02rem", display: "block" }}>
              {g.matchup}
            </span>
            {time && <span className="num" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>🕐 {time}</span>}
          </span>
        )}
        <EnvSphere env={g.env} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-4" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
        <span>🏟️ Park <b style={{ color: "var(--text)" }}>{signed(g.park_mult)}</b></span>
        <span>🌬️ Weather <b style={{ color: "var(--text)" }}>{signed(g.weather_mult)}</b></span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3" style={{ fontSize: "0.74rem", color: "var(--muted)" }}>
        {typeof g.wind_dir === "number" && typeof g.wind_mph === "number" && (
          <span className="inline-flex items-center gap-1">
            <span style={{ display: "inline-block", fontWeight: 800, transform: `rotate(${g.wind_dir}deg)`, color: arrowColor(g.wind_dir) }}>↑</span>
            {Math.round(g.wind_mph)}mph <span style={{ color: "var(--muted)" }}>{windText(g.wind_dir)}</span>
          </span>
        )}
        {typeof g.temp_f === "number" && <span>🌡️ {Math.round(g.temp_f)}°</span>}
        {(g.precip_pct ?? 0) >= 20 && <span style={{ color: "#7cc7ff" }}>💧 {g.precip_pct}%</span>}
      </div>
    </>
  );
}

export function ParksBoard({ games, hrRows = [], kRows = [], expandable = false }: { games: Game[]; hrRows?: BoardRow[]; kRows?: BoardRow[]; expandable?: boolean }) {
  if (!games || games.length === 0) {
    return (
      <div className="panel" style={{ color: "var(--muted)", textAlign: "center" }}>
        No games on the board yet.
      </div>
    );
  }
  const ordered = expandable
    ? [...games].sort((a, b) => (a.game_time ?? "9999").localeCompare(b.game_time ?? "9999"))
    : games; // parks: keep best-environment-first as delivered
  return (
    <div>
      {expandable ? (
        <>
          <div className="eyebrow" style={{ marginBottom: "0.3rem" }}>Tonight&apos;s games · first pitch order</div>
          <p className="factor-note" style={{ marginTop: 0, marginBottom: "0.8rem" }}>
            Every game on the slate — click one for the full breakdown: starters, lineups, and edges.
          </p>
        </>
      ) : (
        <>
          <div className="eyebrow" style={{ marginBottom: "0.3rem" }}>Park factors · best hitting environments</div>
          <p className="factor-note" style={{ marginTop: 0, marginBottom: "0.8rem" }}>
            Park + weather combined — higher means the ball carries (good for hitters), lower favors
            pitchers. Ranked best first.
          </p>
        </>
      )}
      <div className="grid gap-2.5">
        {ordered.map((g, i) => {
          const boost = g.env - 1;
          const edge = boost > 0.05 ? "var(--green)" : boost < -0.05 ? "var(--red)" : "var(--amber)";
          return (
            expandable ? (
            <details key={g.game_id} className="card rise" style={{ borderLeftColor: edge, animationDelay: `${i * 45}ms` }}>
              <summary style={{ cursor: "pointer" }}>
                <Face g={g} variant="hub" />
              </summary>
              <GameBreakdown matchup={g.matchup} hrRows={hrRows} kRows={kRows} />
            </details>
            ) : (
            <div key={g.game_id} className="card rise" style={{ borderLeftColor: edge, animationDelay: `${i * 45}ms` }}>
              <Face g={g} variant="parks" />
            </div>
            )
          );
        })}
      </div>
    </div>
  );
}
