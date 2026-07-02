/**
 * ProbabilityOrb.tsx — Depth-halo probability orb, mock 7 "Spatial Depth" skin.
 *
 * Renders the layered sphere structure from mock7.html's orb() function:
 *   orbShadow → orbHalo → orbCore + orbSpec → orbRing (SVG) → orbNum
 *
 * Visual parameters come entirely from orbMath.orbParams(); this component
 * only handles the per-kind heat computation and JSX markup.
 */
"use client";

import "./spatial.css";
import type { PropKind } from "../../lib/format";
import { orbParams, ORB_RING_C } from "./orbMath";

// ── heat map (transcribed from mock7.html HEAT table) ────────────────────────
// Format: [lo, span]  — heat = clamp((prob − lo) / span, 0, 1)
const HEAT_ORB: Record<PropKind, readonly [number, number]> = {
  hr:    [.05, .40],
  k:     [.35, .40],
  hits1: [.36, .48],
  hits2: [.16, .40],
  hits3: [.02, .26],
  tb2:   [.22, .44],
  tb3:   [.10, .34],
  tb4:   [.02, .26],
  runs1: [.38, .24],
  runs2: [.04, .20],
  rbi1:  [.38, .24],
  rbi2:  [.06, .20],
  hrr2:  [.45, .24],
  hrr3:  [.21, .24],
  hrr4:  [.05, .20],
};

function heatT(prob: number, kind: PropKind): number {
  const [lo, sp] = HEAT_ORB[kind] ?? HEAT_ORB.hr;
  return Math.max(0, Math.min(1, (prob - lo) / sp));
}

// ── component ─────────────────────────────────────────────────────────────────

interface ProbabilityOrbProps {
  /** Raw probability 0..1 (drives ring fill and numeric display). */
  prob: number;
  /** Prop kind used to compute the 0..1 heat from the per-kind HEAT table. */
  kind: PropKind;
  /** Diameter of the orb in px (default 64, same as mock7's default). */
  size?: number;
  /** Optional secondary label shown below the number (e.g. "K" / "C"). */
  label?: string;
}

export function ProbabilityOrb({
  prob,
  kind,
  size = 64,
  label,
}: ProbabilityOrbProps) {
  const heat = heatT(prob, kind);
  const p    = orbParams(prob, heat);

  // ── derived pixel values (size-dependent) ──────────────────────────────────
  const blurPx      = (size * p.blur).toFixed(1);
  const syPx        = (size * p.elevation).toFixed(1);
  const haloBlurPx  = (size * p.halo).toFixed(1);
  const numFsPx     = (size * 0.27).toFixed(1);

  // orbCore inner-shadow sizes (mock7: size*0.045 / size*0.11 / size*0.05 / size*0.12)
  const sh1Y  = (size * 0.045).toFixed(1);
  const sh1B  = (size * 0.11).toFixed(1);
  const sh2Y  = (size * 0.05).toFixed(1);
  const sh2B  = (size * 0.12).toFixed(1);

  // ── colour strings ─────────────────────────────────────────────────────────
  const H   = p.hue, S = p.sat;
  const col    = `hsl(${H} ${S}% ${p.light}%)`;
  const bright = `hsl(${H} ${S}% ${p.brightL}%)`;
  const dark   = `hsl(${H} ${S}% ${p.darkL}%)`;

  // ── SVG ring ───────────────────────────────────────────────────────────────
  const C   = ORB_RING_C;
  const off = p.ringOffset.toFixed(2);

  return (
    <span className="orb" style={{ width: size, height: size }}>

      {/* 1. Cast shadow */}
      <span
        className="orbShadow"
        style={{
          filter:     `blur(${blurPx}px)`,
          transform:  `translateY(${syPx}px) scale(.84)`,
          background: `radial-gradient(closest-side, hsla(${H} ${S}% 36% / ${p.shadowOpacity.toFixed(2)}), transparent 76%)`,
        }}
      />

      {/* 2. Coloured halo */}
      <span
        className="orbHalo"
        style={{
          filter:     `blur(${haloBlurPx}px)`,
          background: `radial-gradient(closest-side, hsla(${H} ${S}% 62% / ${p.haloOpacity.toFixed(2)}), transparent 72%)`,
        }}
      />

      {/* 3. Sphere core + specular highlight */}
      <span
        className="orbCore"
        style={{
          background: `radial-gradient(120% 120% at 32% 26%, ${bright}, ${col} 44%, ${dark} 98%)`,
          boxShadow: [
            `inset 0 ${sh1Y}px ${sh1B}px hsla(${H} 80% 10% / .55)`,
            `inset 0 -${sh2Y}px ${sh2B}px hsla(${H} 90% 72% / ${p.innerHiOpacity.toFixed(2)})`,
          ].join(", "),
        }}
      >
        <span className="orbSpec" />
      </span>

      {/* 4. SVG progress ring */}
      <svg className="orbRing" viewBox="0 0 100 100">
        <g transform="rotate(-90 50 50)">
          {/* track */}
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="hsl(0 0% 100% / .07)"
            strokeWidth="6"
          />
          {/* fill arc */}
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke={col}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C.toFixed(2)}
            strokeDashoffset={off}
            style={{ filter: `drop-shadow(0 0 ${p.glow.toFixed(1)}px ${col})` }}
          />
        </g>
      </svg>

      {/* 5. Numeric label */}
      <span className="orbNum" style={{ fontSize: `${numFsPx}px` }}>
        {Math.round(prob * 100)}<i>%</i>
        {label && <b>{label}</b>}
      </span>

    </span>
  );
}

export default ProbabilityOrb;
