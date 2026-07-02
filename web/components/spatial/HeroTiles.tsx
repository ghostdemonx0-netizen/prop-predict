/**
 * HeroTiles.tsx — Hero section with headline, date picker, and KPI tiles
 * for the Mock 7 "Spatial Depth" skin.
 *
 * Transcribed from mock7.html's .hero / .heroline / .tiles / .tile / .datepick.
 */
"use client";

import "./spatial.css";
import { GlassCard } from "./GlassCard";

// ── Types ────────────────────────────────────────────────────────────────────

export interface KpiTile {
  label: string;
  value: string;
  sub?:  string;
}

export interface HeroTilesProps {
  dates:        string[];
  selectedDate: string;
  onDate:       (d: string) => void;
  tiles:        KpiTile[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function HeroTiles({ dates, selectedDate, onDate, tiles }: HeroTilesProps) {
  return (
    <section className="sp-hero">

      {/* ── Top row: headline + date picker ─────────────────────── */}
      <div className="sp-heroline">
        <div>
          <span className="sp-eyebrow">Slate intelligence · model-driven</span>
          <h1 className="sp-htitle">
            {"Tonight's "}
            <span className="sp-iristext">edges</span>,<br />
            rendered in depth.
          </h1>
          <p className="sp-hsub">
            Every prop backed by our multi-factor model — park, platoon,
            pitch-mix, form, and matchup lean, all layered into one number.
          </p>
        </div>

        {/* Date picker */}
        <div className="sp-datepick sp-float">
          <span className="sp-dot-live" />
          <select
            value={selectedDate}
            onChange={(e) => onDate(e.target.value)}
            aria-label="Select date"
          >
            {dates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── KPI tiles ────────────────────────────────────────────── */}
      {tiles.length > 0 && (
        <div className="sp-tiles">
          {tiles.map((tile, i) => (
            <GlassCard key={i} className="sp-tile">
              <div className="sp-tile-k">{tile.label}</div>
              <div className="sp-tile-v">
                {tile.value}
                {tile.sub && <small>{tile.sub}</small>}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

    </section>
  );
}

export default HeroTiles;
