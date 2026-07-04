/**
 * ProbabilityOrb.tsx — "Deep glass" probability orb, mock 7 "Spatial Depth" skin.
 *
 * The finish: a neon glowing rim (in the heatColor hue) around a DARK, DEEP
 * translucent glass center — a radial gradient that reads darkest at the bottom
 * edge, giving the sphere real depth — with a thin inset top highlight. The
 * centered % is drawn in WHITE with a subtle dark halo (see .orbNum) so it stays
 * high-contrast on the dark fill. The number uses IBM Plex Mono (orbFont.ts).
 * Kept deliberately CHEAP to render (it appears many times per page): no
 * backdrop-filter, no blurred halo/shadow layers — just a radial glass gradient
 * + a small neon rim box-shadow + one subtle top gloss (.orbSpec).
 *
 * Structure:  orbCore (deep-glass fill + neon rim) + orbSpec (top gloss)
 *             → orbRing (SVG progress, neon color) → orbNum (centered %, IBM Plex Mono)
 *
 * KEEPS: the SVG progress ring (raw %), the centered % number, and heatColor().
 * orbMath.orbParams() still drives the ring offset + heat-scaled ring glow.
 */
"use client";

import "./spatial.css";
import type { PropKind } from "../../lib/format";
import { heatColor } from "../../lib/format";
import { orbParams, ORB_RING_C } from "./orbMath";
import { orbMono } from "./orbFont";

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

// ── sphere base colour, derived from the live site's heatColor() scale ───────
// heatColor(prob, kind) returns an `hsl(H, S%, L%)` string that sweeps
// blue → cyan → green → amber → red across each prop's realistic range, so two
// different probabilities read as visibly different hues. The neon rim + ring
// carry that colour; the glassy center is near-transparent.
function parseHsl(str: string): { h: number; s: number; l: number } {
  const m = str.match(/hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/);
  if (!m) return { h: 255, s: 80, l: 46 };
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
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

  const numFsPx = (size * 0.27).toFixed(1);

  // ── colour strings (hue/sat/light from heatColor) ──────────────────────────
  const base   = parseHsl(heatColor(prob, kind));
  const H = Math.round(base.h);
  // Lift saturation a touch so the neon rim stays vivid at heatColor's ~52%.
  const S = Math.min(Math.round(base.s) + 16, 92);
  const light   = Math.round(base.l);
  const brightL = Math.min(light + 24, 88);
  const bright  = `hsl(${H} ${S}% ${brightL}%)`;
  const rim     = Math.min(brightL + 4, 82);

  // ── SVG ring ───────────────────────────────────────────────────────────────
  const off = p.ringOffset.toFixed(2);

  return (
    <span className="orb" style={{ width: size, height: size }}>

      {/* Deep-glass sphere: dark, deep translucent glass center + neon glowing rim.
          The radial fill darkens toward the bottom edge for real depth; the vivid
          neon colour lives on the rim box-shadow + the ring. A thin inset top
          highlight + the .orbSpec gloss sell the glass. */}
      <span
        className="orbCore"
        style={{
          background: `radial-gradient(120% 120% at 50% 36%, hsl(${H} ${S}% 20% / .5) 0%, hsl(${H} ${S}% 11% / .68) 58%, hsl(${H} ${S}% 7% / .82) 100%)`,
          boxShadow: [
            `inset 0 1px 1px hsl(0 0% 100% / .1)`,               // thin top highlight
            `inset 0 0 0 1.5px hsl(${H} ${S}% ${rim}% / .92)`,   // bright neon rim line
            `inset 0 0 6px hsl(${H} ${S}% ${brightL}% / .22)`,   // small inner rim glow
            `0 0 8px hsl(${H} ${S}% ${brightL}% / .4)`,          // small outer bloom
          ].join(", "),
        }}
      >
        {/* thin top gloss line — sells the glass (styled via .orbSpec) */}
        <span className="orbSpec" />
      </span>

      {/* SVG progress ring — neon colour, heat-scaled drop-shadow glow */}
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
            stroke={bright}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={ORB_RING_C.toFixed(2)}
            strokeDashoffset={off}
            style={{ filter: `drop-shadow(0 0 ${p.glow.toFixed(1)}px ${bright})` }}
          />
        </g>
      </svg>

      {/* Numeric label — IBM Plex Mono (white with a dark halo on the deep glass) */}
      <span className="orbNum" style={{ fontSize: `${numFsPx}px`, fontFamily: orbMono.style.fontFamily }}>
        {Math.round(prob * 100)}<i>%</i>
        {label && <b>{label}</b>}
      </span>

    </span>
  );
}

export default ProbabilityOrb;
