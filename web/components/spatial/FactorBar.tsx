/**
 * FactorBar.tsx — Center-anchored deviation meter for the "what's driving it"
 * section of the Mock 7 "Spatial Depth" skin.
 *
 * Ported from mock7.html's factorBar() function + .drv / .track / .delta rules.
 *
 * Visual anatomy:
 *   • Track: horizontal bar with a centre midline at 50%
 *   • Fill:  extends RIGHT from 50% (green gradient) for positive multipliers,
 *            extends LEFT  from 50% (red gradient)   for negative multipliers
 *   • Node:  glowing dot at the fill's outer end
 *   • Delta: (+N% / −N% / neutral) chip — up / down / flat
 *   • Note:  small explanation text below
 *
 * mult is a multiplier (e.g. 1.08 = +8%, 0.93 = -7%).
 * Deviation is capped at ±40% for the visual fill width.
 */
"use client";

import "./spatial.css";
import type { ReactNode } from "react";

export function FactorBar({
  icon,
  label,
  mult,
  note,
}: {
  icon?:  ReactNode;
  label:  string;
  mult:   number;
  note:   string;
}) {
  // Signed percent deviation: e.g. 1.08 → +8,  0.92 → -8
  const d   = Math.round((mult - 1) * 100);
  // Magnitude scaled to [0,1] with ±40% cap
  const mag = Math.min(Math.abs(d), 40) / 40;

  // Delta chip variant
  const cls = d > 0 ? "up" : d < 0 ? "down" : "flat";
  const txt = d > 0 ? `+${d}%` : d < 0 ? `${d}%` : "neutral";

  // Fill: right half for positive, left half for negative
  const fillStyle: React.CSSProperties =
    d >= 0
      ? {
          left:       "50%",
          width:      `${mag * 50}%`,
          background: "linear-gradient(90deg, transparent, var(--good))",
        }
      : {
          left:       `${50 - mag * 50}%`,
          width:      `${mag * 50}%`,
          background: "linear-gradient(90deg, var(--bad), transparent)",
        };

  // Glowing node at the outer end of the fill
  const nodeLeft  = 50 + (d >= 0 ? mag * 50 : -(mag * 50));
  const nodeColor = d > 0 ? "var(--good)" : d < 0 ? "var(--bad)" : "var(--ink-faint)";

  return (
    <div className="sp-drv">
      {/* Top row: label left, delta chip right */}
      <div className="sp-drv-top">
        <span className="sp-drv-l">
          {icon}
          <span>{label}</span>
        </span>
        <span className={`sp-delta sp-delta--${cls}`}>{txt}</span>
      </div>

      {/* Deviation track */}
      <div className="sp-track">
        <span className="sp-track-mid" />
        <span className="sp-track-fill" style={fillStyle} />
        <span
          className="sp-track-node"
          style={{ left: `${nodeLeft}%`, color: nodeColor, background: nodeColor }}
        />
      </div>

      {/* Explanation note */}
      <div className="sp-drv-note">{note}</div>
    </div>
  );
}
