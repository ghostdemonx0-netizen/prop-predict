/**
 * LiveChipSpatial.tsx — Glass-reskin of the LiveChip for the Mock 7
 * "Spatial Depth" skin.
 *
 * Preserves ALL four states and the unclamped have/need display from
 * the original LiveChip.tsx.  Only the visual presentation changes;
 * state is computed elsewhere via useLiveFor().
 *
 * States:
 *   pregame — game not started (neutral glass)
 *   live    — in play, steady amber + pulsing dot (NO blink on label)
 *   cleared — hit the line (green glass); have may exceed need (e.g. 2/1, 8/6)
 *   missed  — game final and short (red glass)
 *
 * LiveState is re-exported from web/lib/live.ts for consumer convenience.
 */
"use client";

import "./spatial.css";
export type { LiveState } from "../../lib/live";
import type { LiveState } from "../../lib/live";

export function LiveChip({
  state,
  have,
  need,
  sm,
}: {
  state: LiveState;
  have:  number;
  need:  number;
  sm?:   boolean;
}) {
  // True count — never clamped; 2/1 and 8/6 are intentional
  const label    = `${have}/${need}`;
  const sizeClass = sm ? " sp-live-chip--sm" : "";

  if (state === "cleared") {
    return (
      <span className={`sp-live-chip sp-live-chip--cleared${sizeClass}`}>
        {label}
      </span>
    );
  }

  if (state === "missed") {
    return (
      <span className={`sp-live-chip sp-live-chip--missed${sizeClass}`}>
        {label}
      </span>
    );
  }

  if (state === "live") {
    return (
      <span className={`sp-live-chip sp-live-chip--live${sizeClass}`}>
        <span className="sp-live-chip-dot" />
        {label}
      </span>
    );
  }

  // pregame — neutral grey, no dot, no strike-through
  return (
    <span className={`sp-live-chip sp-live-chip--pregame${sizeClass}`}>
      {label}
    </span>
  );
}
