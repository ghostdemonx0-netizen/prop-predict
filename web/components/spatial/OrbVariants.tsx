/**
 * OrbVariants.tsx — TEMPORARY fill-structure comparison for the probability orb.
 *
 * The user likes the orb's PROGRESS RING and its heatColor() COLOR mapping, but
 * not the current glassy 3D sphere FILL. This file renders 5 clearly-distinct
 * fill treatments side by side so a single one can be picked and applied to the
 * real ProbabilityOrb later.
 *
 * Every variant KEEPS the same SVG progress ring (encodes raw %), the centered
 * % number, and the same heatColor(prob, kind) base color. Each variant CHANGES
 * only the core fill treatment.
 *
 *   V0 Current      — reuses the real ProbabilityOrb (glassy sphere + halo + rim)
 *   V1 Flat         — solid flat disc, subtle 1px inner border, no glow
 *   V2 Matte        — soft matte sphere, gentle top→bottom shade, tiny highlight
 *   V3 Glossy       — translucent liquid-glass bubble, strong specular gloss
 *   V4 Ring-forward — near-hollow faint fill, thick bright glowing ring is the star
 *
 * This component intentionally does NOT reuse the real .orb* CSS classes (except
 * inside ProbabilityOrb for V0). All structure lives in .sp-orbv-* classes so the
 * real orb is untouched.
 */
"use client";

import "./spatial.css";
import type { PropKind } from "../../lib/format";
import { heatColor } from "../../lib/format";
import { ORB_RING_C } from "./orbMath";
import { ProbabilityOrb } from "./ProbabilityOrb";

// ── shared color derivation (same source as the real orb: heatColor) ──────────
function parseHsl(str: string): { h: number; s: number; l: number } {
  const m = str.match(/hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/);
  if (!m) return { h: 255, s: 80, l: 46 };
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

interface HeatCols {
  H: number;
  S: number;
  light: number;
  col: string;
  bright: string;
  dark: string;
}

function heatCols(prob: number, kind: PropKind): HeatCols {
  const base = parseHsl(heatColor(prob, kind));
  const H = Math.round(base.h);
  const S = Math.min(Math.round(base.s) + 16, 92); // match ProbabilityOrb's lift
  const light = Math.round(base.l);
  const brightL = Math.min(light + 24, 88);
  const darkL = Math.max(light - 26, 8);
  return {
    H,
    S,
    light,
    col: `hsl(${H} ${S}% ${light}%)`,
    bright: `hsl(${H} ${S}% ${brightL}%)`,
    dark: `hsl(${H} ${S}% ${darkL}%)`,
  };
}

// ── shared progress ring + number (identical across variants) ────────────────
interface RingNumProps {
  prob: number;
  col: string;
  size: number;
  /** ring stroke width in the 100×100 viewBox (default 6; V4 uses a fat ring) */
  strokeWidth?: number;
  /** ring drop-shadow glow px */
  glow?: number;
  /** track stroke color */
  track?: string;
  label?: string;
}

function RingAndNum({
  prob,
  col,
  size,
  strokeWidth = 6,
  glow = 4,
  track = "hsl(0 0% 100% / .07)",
  label,
}: RingNumProps) {
  const off = (ORB_RING_C * (1 - Math.max(0, Math.min(1, prob)))).toFixed(2);
  const numFsPx = (size * 0.27).toFixed(1);
  return (
    <>
      <svg className="sp-orbv-ring" viewBox="0 0 100 100">
        <g transform="rotate(-90 50 50)">
          <circle cx="50" cy="50" r="42" fill="none" stroke={track} strokeWidth={strokeWidth} />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={col}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={ORB_RING_C.toFixed(2)}
            strokeDashoffset={off}
            style={{ filter: `drop-shadow(0 0 ${glow.toFixed(1)}px ${col})` }}
          />
        </g>
      </svg>
      <span className="sp-orbv-num" style={{ fontSize: `${numFsPx}px` }}>
        {Math.round(prob * 100)}
        <i>%</i>
        {label && <b>{label}</b>}
      </span>
    </>
  );
}

// ── one variant orb ──────────────────────────────────────────────────────────
export type OrbVariant = "current" | "flat" | "matte" | "glossy" | "hollow";

interface VariantOrbProps {
  variant: OrbVariant;
  prob: number;
  kind: PropKind;
  size?: number;
  label?: string;
}

export function VariantOrb({ variant, prob, kind, size = 72, label }: VariantOrbProps) {
  // V0 reuses the untouched real component for a faithful reference.
  if (variant === "current") {
    return <ProbabilityOrb prob={prob} kind={kind} size={size} label={label} />;
  }

  const c = heatCols(prob, kind);
  const { H, S, col, bright, dark } = c;

  const wrap = (
    fill: React.ReactNode,
    ring: React.ReactNode = <RingAndNum prob={prob} col={col} size={size} label={label} />,
  ) => (
    <span className="sp-orbv" style={{ width: size, height: size }}>
      {fill}
      {ring}
    </span>
  );

  switch (variant) {
    // V1 — Flat/minimal: single flat disc + subtle 1px inner border. No 3D.
    case "flat":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-flat"
          style={{
            background: col,
            boxShadow: `inset 0 0 0 1px hsl(${H} ${S}% 96% / .18)`,
          }}
        />,
      );

    // V2 — Matte/soft: gentle top→bottom inner shade + small soft highlight.
    case "matte":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-matte"
          style={{
            background: `linear-gradient(180deg, ${bright} 0%, ${col} 46%, ${dark} 100%)`,
            boxShadow: `inset 0 1px 2px hsl(${H} 60% 96% / .22), inset 0 -3px 8px hsl(${H} 80% 8% / .32)`,
          }}
        >
          <span className="sp-orbv-matte-hi" />
        </span>,
      );

    // V3 — Glossy bubble: translucent liquid glass, strong specular, crisp edge.
    case "glossy":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-glossy"
          style={{
            background: `radial-gradient(120% 120% at 32% 24%, hsl(${H} ${S}% 78% / .55), hsl(${H} ${S}% ${c.light}% / .42) 44%, hsl(${H} ${S}% 12% / .55) 100%)`,
            boxShadow: [
              `inset 0 0 0 1px hsl(${H} ${S}% 92% / .5)`,
              `inset 0 2px 6px hsl(${H} 40% 98% / .35)`,
              `inset 0 -6px 14px hsl(${H} 80% 10% / .4)`,
              `0 2px 10px hsl(${H} 70% 8% / .35)`,
            ].join(", "),
          }}
        >
          <span className="sp-orbv-gloss-spec" />
          <span className="sp-orbv-gloss-band" />
        </span>,
      );

    // V4 — Ring-forward / hollow: near-transparent fill, fat bright glowing ring.
    case "hollow":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-hollow"
          style={{
            background: `radial-gradient(closest-side, hsl(${H} ${S}% 50% / .14), hsl(${H} ${S}% 50% / .04) 70%, transparent 100%)`,
            boxShadow: `inset 0 0 0 1px hsl(${H} ${S}% 70% / .12)`,
          }}
        />,
        <RingAndNum
          prob={prob}
          col={bright}
          size={size}
          strokeWidth={9}
          glow={9}
          track={`hsl(${H} ${S}% 60% / .12)`}
          label={label}
        />,
      );

    default:
      return wrap(<span className="sp-orbv-fill" style={{ background: col }} />);
  }
}

// ── comparison grid ───────────────────────────────────────────────────────────
const COLUMNS: { key: OrbVariant; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "flat", label: "Flat" },
  { key: "matte", label: "Matte" },
  { key: "glossy", label: "Glossy" },
  { key: "hollow", label: "Ring-forward" },
];

// Sample probabilities chosen to sweep heatColor's blue→green→amber→red range.
const SAMPLES = [0.12, 0.24, 0.4, 0.65];
const KIND: PropKind = "hr";
const SIZE = 72;

export function OrbVariants() {
  return (
    <div className="sp-orbv-page">
      <div className="sp-orbv-head">
        <h1>Orb fill-structure options</h1>
        <p>
          Same progress ring + centered % + <code>heatColor()</code> base color across all five.
          Only the core FILL treatment differs. Sample probabilities sweep the color range
          (kind: <code>hr</code>).
        </p>
      </div>

      <div className="sp-orbv-grid">
        {/* header row */}
        <div className="sp-orbv-row">
          <div className="sp-orbv-cell sp-orbv-corner">prob</div>
          {COLUMNS.map((c) => (
            <div key={c.key} className="sp-orbv-cell sp-orbv-colhead">
              {c.label}
            </div>
          ))}
        </div>

        {/* one row per sample probability */}
        {SAMPLES.map((prob) => (
          <div key={prob} className="sp-orbv-row">
            <div className="sp-orbv-cell sp-orbv-rowhead">{Math.round(prob * 100)}%</div>
            {COLUMNS.map((c) => (
              <div key={c.key} className="sp-orbv-cell">
                <VariantOrb variant={c.key} prob={prob} kind={KIND} size={SIZE} />
                <span className="sp-orbv-caption">{c.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default OrbVariants;
