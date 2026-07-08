/**
 * BarrelFlag.tsx — small grayed Aperture logo badge shown next to standout-barrel hitters.
 * Rendered when a hitter's Prop Score (trueScore) >= BARREL_FLAG_MIN (see BoardsView.tsx).
 */
import React from "react";
import { LogoMark } from "./LogoMark";

export function BarrelFlag() {
  return (
    <span
      title="Oracle — the model's standout barrel call"
      aria-label="Oracle — the model's standout barrel call"
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
