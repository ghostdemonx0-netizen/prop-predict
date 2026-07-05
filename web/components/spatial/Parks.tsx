/**
 * Parks.tsx — Ranked park & weather ledger for the Mock 7 "Spatial Depth" skin.
 *
 * Renders <Parks games /> where games: Game[] is already sorted best-env-first
 * by the data layer — render in the given order, do NOT re-sort.
 *
 * Visually distinct from GameHub cards: a flat glass ledger panel, no expand.
 * Ported from ParksBoard.tsx (expandable={false}) behaviour, reskinned to the
 * spatial kit (GlassCard, EnvDot, FBox, sp-* classes).
 *
 * Layout per row (left → right):
 *   rank | matchup + park name | Park FBox · Wx FBox · Wind FBox · Temp FBox | EnvDot
 */
"use client";

import type { Game } from "../../lib/types";
import { arrowColor } from "../../lib/format";
import { WindIcon, TempIcon, RainIcon, ParkIcon, ParkWeatherIcon } from "../Icons";
import { EnvDot } from "./GlassDot";
import { FBox, envImpactColor, tempColor } from "./chips";
import { GlassCard } from "./GlassCard";
import "./spatial.css";

// ── Helpers ───────────────────────────────────────────────────────────────────

function signed(mult: number): string {
  const v = Math.round((mult - 1) * 100);
  return (v >= 0 ? "+" : "") + v + "%";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Parks({ games }: { games: Game[] }) {
  // Empty state
  if (!games || games.length === 0) {
    return (
      <GlassCard
        style={{
          color:      "var(--ink-dim)",
          textAlign:  "center",
          padding:    "26px 20px",
          fontFamily: "var(--f-mono)",
          fontSize:   "0.8rem",
        }}
      >
        No games on the board yet.
      </GlassCard>
    );
  }

  return (
    <div>
      {/* ── Section heading ── */}
      <div className="sp-shead">
        <h2>Park &amp; weather</h2>
        <div className="sp-shead-rule" />
        <span className="sp-eyebrow">best hitting environments</span>
      </div>

      {/* ── Explainer + hint ── */}
      <div className="sp-parks-intro">
        <p className="sp-parks-note">
          Park and weather combined — higher means the ball carries (good for hitters),
          lower favors pitchers. Ranked best-first.
        </p>
        <span className="sp-parks-hint">spheres = park + weather boost</span>
      </div>

      {/* ── Ranked ledger panel ── */}
      <GlassCard className="sp-parks-ledger">
        {games.map((g, i) => (
          <div key={g.game_id} className="sp-parks-row">

            {/* Rank — #1 gets the iris gradient via sp-parks-row:first-child */}
            <span className="sp-parks-rk">{i + 1}</span>

            {/* Matchup name + park name */}
            <div className="sp-parks-info">
              <div className="sp-parks-name">{g.matchup}</div>
              <div className="sp-parks-sub">{g.park_name ?? g.park}</div>
            </div>

            {/* Condition pills (FBoxes) */}
            <div className="sp-parks-stats">

              {/* Park factor */}
              <FBox
                icon={<ParkIcon size={12} style={{ color: "var(--ink-faint)", flexShrink: 0 }} />}
                label="Park"
                value={<span style={{ color: envImpactColor(g.park_mult) }}>{signed(g.park_mult)}</span>}
              />

              {/* Weather factor */}
              <FBox
                icon={<ParkWeatherIcon size={12} style={{ color: "var(--ink-faint)", flexShrink: 0 }} />}
                label="Wx"
                value={<span style={{ color: envImpactColor(g.weather_mult) }}>{signed(g.weather_mult)}</span>}
              />

              {/* Wind direction + speed (optional) */}
              {typeof g.wind_dir === "number" && typeof g.wind_mph === "number" && (
                <FBox
                  icon={
                    <WindIcon
                      size={12}
                      deg={g.wind_dir}
                      style={{ color: arrowColor(g.wind_dir), flexShrink: 0 }}
                    />
                  }
                  value={`${Math.round(g.wind_mph)}mph`}
                />
              )}

              {/* Temperature (optional) */}
              {typeof g.temp_f === "number" && (() => {
                const tc = tempColor(g.temp_f);
                return (
                  <FBox
                    icon={<TempIcon size={12} style={{ color: tc, flexShrink: 0 }} />}
                    value={<span style={{ color: tc }}>{Math.round(g.temp_f)}°</span>}
                  />
                );
              })()}

              {/* Rain chance (optional) — same threshold/field/styling as the board cards */}
              {(g.precip_pct ?? 0) >= 20 && (
                <FBox
                  icon={<RainIcon size={12} style={{ color: "var(--iris-cyan)", flexShrink: 0 }} />}
                  value={`${g.precip_pct}%`}
                />
              )}

            </div>

            {/* EnvDot — combined park + weather boost */}
            <EnvDot pct={g.env} size={58} />

          </div>
        ))}
      </GlassCard>
    </div>
  );
}

export default Parks;
