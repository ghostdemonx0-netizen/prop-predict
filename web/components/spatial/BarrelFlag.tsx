/**
 * BarrelFlag.tsx — small grayed Aperture logo badge shown next to standout-barrel hitters.
 * Rendered when a hitter's Prop Score (trueScore) >= BARREL_FLAG_MIN (see BoardsView.tsx).
 */
import React from "react";
import { LogoMark } from "./LogoMark";

export function BarrelFlag() {
  return (
    <span
      title="Barrel Edge — standout barrel play"
      aria-label="Barrel Edge — standout barrel play"
      style={{
        display: "inline-flex",
        verticalAlign: "middle",
        filter: "grayscale(1)",
        opacity: 0.72,
      }}
    >
      <LogoMark size={14} />
    </span>
  );
}
