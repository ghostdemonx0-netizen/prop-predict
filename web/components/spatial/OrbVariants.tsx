/**
 * OrbVariants.tsx — TEMPORARY sphere-fill comparison for the mock 7 orb reskin.
 *
 * The user rejected the bright "tinted glass" fill (too bright) and wants DARKER
 * / subtler glass fills — especially one that looks like the app's CARDS' glass —
 * while keeping the NEON RING they liked. This grid explores five dark/glass
 * fills so the user can pick.
 *
 * EVERY variant keeps the same three things, unchanged:
 *   • the neon glowing rim (in the heatColor hue)
 *   • the SVG progress ring (encodes the raw %)
 *   • the centered % in IBM Plex Mono (WHITE, with a subtle dark halo so it stays
 *     legible on the dark fills)
 *
 * Only the CENTER FILL changes:
 *   Cards glass          — the SAME glass material as GlassCard / .sp-float
 *                          (dark translucent gradient + card border + inset top
 *                          highlight) → the orb reads like a little round card.
 *   Cards glass frosted  — Cards glass + the card's frosted backdrop-filter blur
 *                          (desktop). This is the ONLY variant that uses blur.
 *   Deep glass           — a darker, deeper translucent glass (dark center).
 *   Smoked glass         — a dark, smoky, very subtle translucent fill.
 *   Neon glass (near-clear) — the reverted-to reference (almost fully clear).
 *
 * This component does NOT reuse the real .orb* CSS classes. All structure lives
 * in .sp-orbv-* classes (appended to spatial.css) so the real ProbabilityOrb is
 * untouched. Delete this file + app/next/orbs/page.tsx once a fill is chosen.
 */
"use client";

import "./spatial.css";
import type { PropKind } from "../../lib/format";
import { heatColor } from "../../lib/format";
import { ORB_RING_C } from "./orbMath";
import { orbMono } from "./orbFont";

// ── shared color derivation (same source as the real orb: heatColor) ──────────
function parseHsl(str: string): { h: number; s: number; l: number } {
  const m = str.match(/hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/);
  if (!m) return { h: 255, s: 80, l: 46 };
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

interface HeatCols {
  H: number;
  S: number;
  brightL: number;
  rim: number;
  col: string;
  bright: string;
}

function heatCols(prob: number, kind: PropKind): HeatCols {
  const base = parseHsl(heatColor(prob, kind));
  const H = Math.round(base.h);
  const S = Math.min(Math.round(base.s) + 16, 92); // match ProbabilityOrb's lift
  const light = Math.round(base.l);
  const brightL = Math.min(light + 24, 88);
  const rim = Math.min(brightL + 4, 82);
  return {
    H,
    S,
    brightL,
    rim,
    col: `hsl(${H} ${S}% ${light}%)`,
    bright: `hsl(${H} ${S}% ${brightL}%)`,
  };
}

// ── shared progress ring + number (identical across variants) ────────────────
interface RingNumProps {
  prob: number;
  col: string;
  size: number;
  glow?: number;
}

function RingAndNum({ prob, col, size, glow = 4 }: RingNumProps) {
  const off = (ORB_RING_C * (1 - Math.max(0, Math.min(1, prob)))).toFixed(2);
  const numFsPx = (size * 0.27).toFixed(1);
  return (
    <>
      <svg className="sp-orbv-ring" viewBox="0 0 100 100">
        <g transform="rotate(-90 50 50)">
          <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(0 0% 100% / .07)" strokeWidth={6} />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={col}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={ORB_RING_C.toFixed(2)}
            strokeDashoffset={off}
            style={{ filter: `drop-shadow(0 0 ${glow.toFixed(1)}px ${col})` }}
          />
        </g>
      </svg>
      <span
        className="sp-orbv-num"
        style={{ fontSize: `${numFsPx}px`, fontFamily: orbMono.style.fontFamily }}
      >
        {Math.round(prob * 100)}
        <i>%</i>
      </span>
    </>
  );
}

// ── one variant orb ──────────────────────────────────────────────────────────
export type OrbVariant =
  | "cardsGlass"
  | "cardsGlassFrosted"
  | "deepGlass"
  | "smokedGlass"
  | "neonGlass";

interface VariantOrbProps {
  variant: OrbVariant;
  prob: number;
  kind: PropKind;
  size?: number;
}

export function VariantOrb({ variant, prob, kind, size = 88 }: VariantOrbProps) {
  const { H, S, brightL, rim, bright } = heatCols(prob, kind);

  // Neon rim shared by every variant (thin bright rim line + small inner + outer
  // glow) — this is the "neon ring" look the user wants to keep.
  const neonRim = [
    `inset 0 0 0 1.5px hsl(${H} ${S}% ${rim}% / .92)`,
    `inset 0 0 6px hsl(${H} ${S}% ${brightL}% / .22)`,
    `0 0 8px hsl(${H} ${S}% ${brightL}% / .4)`,
  ];

  const wrap = (fill: React.ReactNode) => (
    <span className="sp-orbv" style={{ width: size, height: size }}>
      {fill}
      <RingAndNum prob={prob} col={bright} size={size} />
    </span>
  );

  switch (variant) {
    // ── Cards glass — the SAME material as GlassCard / .sp-float ────────────────
    // Card fill = linear-gradient(168deg, var(--glass), var(--glass-2)); card
    // border ≈ var(--line-2); card inset top highlight = inset 0 1px 0 var(--hi).
    // Plus the shared neon rim. → a little round card.
    case "cardsGlass":
      return wrap(
        <span
          className="sp-orbv-fill"
          style={{
            background: `linear-gradient(168deg, var(--glass), var(--glass-2))`,
            boxShadow: [
              `inset 0 1px 0 var(--hi)`, // card top highlight
              `inset 0 0 0 1px var(--line-2)`, // card border line
              ...neonRim,
            ].join(", "),
          }}
        >
          <span className="sp-orbv-cardgloss" />
        </span>,
      );

    // ── Cards glass frosted — Cards glass + the card's backdrop-filter blur ─────
    // The ONLY variant that uses blur; it mimics the real cards on desktop.
    case "cardsGlassFrosted":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-frost"
          style={{
            background: `linear-gradient(168deg, var(--glass), var(--glass-2))`,
            boxShadow: [
              `inset 0 1px 0 var(--hi)`,
              `inset 0 0 0 1px var(--line-2)`,
              ...neonRim,
            ].join(", "),
          }}
        >
          <span className="sp-orbv-cardgloss" />
        </span>,
      );

    // ── Deep glass — a darker, deeper translucent glass (dark center, depth) ────
    case "deepGlass":
      return wrap(
        <span
          className="sp-orbv-fill"
          style={{
            background: `radial-gradient(120% 120% at 50% 36%, hsl(${H} ${S}% 20% / .5) 0%, hsl(${H} ${S}% 11% / .68) 58%, hsl(${H} ${S}% 7% / .82) 100%)`,
            boxShadow: [
              `inset 0 1px 1px hsl(0 0% 100% / .1)`,
              ...neonRim,
            ].join(", "),
          }}
        >
          <span className="sp-orbv-cardgloss" />
        </span>,
      );

    // ── Smoked glass — dark, smoky, very subtle translucent fill ────────────────
    case "smokedGlass":
      return wrap(
        <span
          className="sp-orbv-fill"
          style={{
            background: `radial-gradient(120% 120% at 50% 40%, hsl(${H} 18% 22% / .34) 0%, hsl(${H} 20% 12% / .46) 60%, hsl(${H} 22% 8% / .55) 100%)`,
            boxShadow: [
              `inset 0 1px 1px hsl(0 0% 100% / .08)`,
              ...neonRim,
            ].join(", "),
          }}
        >
          <span className="sp-orbv-cardgloss" />
        </span>,
      );

    // ── Neon glass (near-clear) — the reverted-to reference (almost clear) ──────
    case "neonGlass":
    default:
      return wrap(
        <span
          className="sp-orbv-fill"
          style={{
            background: `linear-gradient(160deg, hsl(${H} ${S}% 60% / .12) 0%, hsl(${H} ${S}% 40% / .06) 46%, hsl(${H} ${S}% 24% / .08) 100%)`,
            boxShadow: neonRim.join(", "),
          }}
        >
          <span className="sp-orbv-glass-gloss" />
        </span>,
      );
  }
}

// ── comparison grid ───────────────────────────────────────────────────────────
const COLUMNS: { key: OrbVariant; label: string }[] = [
  { key: "cardsGlass", label: "Cards glass" },
  { key: "cardsGlassFrosted", label: "Cards glass frosted" },
  { key: "deepGlass", label: "Deep glass" },
  { key: "smokedGlass", label: "Smoked glass" },
  { key: "neonGlass", label: "Neon glass (near-clear)" },
];

// Sample probabilities requested by the user (sweep low → high).
const SAMPLES = [0.18, 0.4, 0.65];
const KIND: PropKind = "hr";
const SIZE = 88;

export function OrbVariants() {
  return (
    <div className="sp-orbv-page">
      <div className="sp-orbv-head">
        <h1>Orb sphere fills — dark / glass options</h1>
        <p>
          Reverted the too-bright tinted fill. Every option below keeps the{" "}
          <strong>neon ring</strong>, the SVG progress ring, and the centered %
          in IBM Plex Mono (white). Only the darker/subtler CENTER FILL changes.{" "}
          <strong>Cards glass</strong> uses the exact same glass material as the
          app&apos;s cards — so the orb reads like a little round card (the one
          you asked for). <strong>Cards glass frosted</strong> adds the card&apos;s
          backdrop blur. Same <code>heatColor()</code> base color across all;
          samples sweep the range (kind: <code>hr</code>).
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
