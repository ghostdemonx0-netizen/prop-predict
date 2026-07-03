/**
 * HeroTiles.tsx — KPI tile row for the Mock 7 "Spatial Depth" skin.
 *
 * Renders only the 4 KPI tiles (Slate / Plays scored / Lineups / Model version).
 * The hero headline + intro prose have been removed. The date picker has moved
 * to CommandBar (which now owns `dates` / `selectedDate` / `onDate`).
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
  tiles: KpiTile[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function HeroTiles({ tiles }: HeroTilesProps) {
  if (tiles.length === 0) return null;

  return (
    <section className="sp-hero">
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
    </section>
  );
}

export default HeroTiles;
