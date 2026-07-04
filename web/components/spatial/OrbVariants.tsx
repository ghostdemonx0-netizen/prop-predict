/**
 * OrbVariants.tsx — ROUND 2 sphere-finish comparison for the probability orb.
 *
 * Round 1 (Current/Flat/Matte/Glossy/Ring-forward) is decided: the user liked the
 * GLOSSY sphere but wants to compare MORE distinct spherical finishes before
 * committing. This round keeps Glossy for reference and adds five more genuinely
 * different sphere styles. Every variant still stays a round orb.
 *
 * Every variant KEEPS the same SVG progress ring (encodes raw %), the centered
 * % number, and the same heatColor(prob, kind) base color. Only the SPHERE
 * FINISH/STYLE changes.
 *
 *   Glossy   — translucent liquid-glass bubble with a gloss highlight (round-1 pick)
 *   Chrome   — polished metal: sharp specular top-left + dark reflected band lower
 *   Neon rim — dark near-black core, bright glowing rim/edge in the heat color
 *   Gel      — glossy translucent candy/jelly bead with soft gloss + subsurface glow
 *   Gradient — clean sphere, soft directional light→deep gradient, single highlight
 *   Pearl    — pearlescent/satin sphere, broad diffuse sheen, slight iridescent shift
 *
 * This component does NOT reuse the real .orb* CSS classes. All structure lives in
 * .sp-orbv-* classes so the real ProbabilityOrb is untouched.
 */
"use client";

import "./spatial.css";
import type { PropKind } from "../../lib/format";
import { heatColor } from "../../lib/format";
import { ORB_RING_C } from "./orbMath";

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
  brightL: number;
  darkL: number;
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
    brightL,
    darkL,
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
  strokeWidth?: number;
  glow?: number;
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
export type OrbVariant = "glossy" | "chrome" | "neon" | "gel" | "gradient" | "pearl";

interface VariantOrbProps {
  variant: OrbVariant;
  prob: number;
  kind: PropKind;
  size?: number;
  label?: string;
}

export function VariantOrb({ variant, prob, kind, size = 72, label }: VariantOrbProps) {
  const c = heatCols(prob, kind);
  const { H, S, light, brightL, darkL, col, bright } = c;

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
    // ── Glossy — round-1 favorite: translucent liquid glass + specular gloss ──
    case "glossy":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-glossy"
          style={{
            background: `radial-gradient(120% 120% at 32% 24%, hsl(${H} ${S}% 78% / .55), hsl(${H} ${S}% ${light}% / .42) 44%, hsl(${H} ${S}% 12% / .55) 100%)`,
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

    // ── Chrome — polished metal: sharp specular + dark reflected horizon band ──
    // A vertical environment-reflection gradient (bright sky → dark horizon →
    // reflected floor lightens) tinted with the heat hue, plus one hard specular.
    case "chrome":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-chrome"
          style={{
            background: `linear-gradient(158deg, hsl(${H} ${Math.min(S + 6, 96)}% 92%) 0%, hsl(${H} ${S}% 66%) 20%, hsl(${H} ${S}% 30%) 46%, hsl(${H} ${S}% 15%) 58%, hsl(${H} ${S}% 52%) 82%, hsl(${H} ${S}% 24%) 100%)`,
            boxShadow: [
              `inset 0 2px 3px hsl(${H} 30% 98% / .6)`,
              `inset 0 -9px 12px hsl(${H} 60% 6% / .5)`,
              `inset 0 0 0 1px hsl(${H} ${S}% 82% / .45)`,
              `0 3px 10px hsl(0 0% 0% / .45)`,
            ].join(", "),
          }}
        >
          <span className="sp-orbv-chrome-spec" />
        </span>,
      );

    // ── Neon rim — dark core, bright glowing rim + ring carry the heat color ──
    case "neon":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-neon"
          style={{
            background: `radial-gradient(88% 88% at 50% 46%, hsl(${H} ${S}% 9%), hsl(${H} ${S}% 5%) 62%, hsl(${H} ${S}% 4%) 100%)`,
            boxShadow: [
              `inset 0 0 0 1.5px hsl(${H} ${S}% ${Math.min(brightL + 4, 82)}%)`,
              `inset 0 0 12px hsl(${H} ${S}% ${brightL}% / .6)`,
              `inset 0 0 3px hsl(${H} ${S}% ${brightL}% / .9)`,
              `0 0 16px hsl(${H} ${S}% ${brightL}% / .5)`,
            ].join(", "),
          }}
        >
          <span
            className="sp-orbv-neon-arc"
            style={{
              background: `radial-gradient(closest-side, transparent 66%, hsl(${H} ${S}% ${brightL}% / .55) 88%, transparent 100%)`,
            }}
          />
        </span>,
        <RingAndNum prob={prob} col={bright} size={size} glow={6} label={label} />,
      );

    // ── Gel — translucent candy/jelly bead: soft gloss + subsurface bottom glow ──
    case "gel":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-gel"
          style={{
            background: `radial-gradient(115% 130% at 38% 22%, hsl(${H} ${S}% 84% / .68), hsl(${H} ${S}% ${light}% / .8) 42%, hsl(${H} ${S}% ${darkL}% / .86) 100%)`,
            boxShadow: [
              `inset 0 3px 8px hsl(${H} 40% 98% / .5)`,
              `inset 0 -11px 16px hsl(${H} 92% 62% / .42)`,
              `inset 0 0 0 1px hsl(${H} ${S}% 88% / .42)`,
              `0 3px 12px hsl(${H} 80% 10% / .42)`,
            ].join(", "),
          }}
        >
          <span className="sp-orbv-gel-gloss" />
          <span
            className="sp-orbv-gel-core"
            style={{
              background: `radial-gradient(closest-side, hsl(${H} ${S}% 74% / .55), hsl(${H} ${S}% ${light}% / 0) 72%)`,
            }}
          />
        </span>,
      );

    // ── Gradient — clean directional light→deep gradient, one soft highlight ──
    case "gradient":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-grad"
          style={{
            background: `linear-gradient(176deg, hsl(${H} ${S}% ${brightL}%) 0%, hsl(${H} ${S}% ${light}%) 46%, hsl(${H} ${S}% ${darkL}%) 100%)`,
            boxShadow: [
              `inset 0 1px 1px hsl(${H} 30% 96% / .4)`,
              `inset 0 -2px 5px hsl(${H} 70% 10% / .28)`,
              `inset 0 0 0 1px hsl(${H} ${S}% 22% / .32)`,
            ].join(", "),
          }}
        >
          <span className="sp-orbv-grad-hi" />
        </span>,
      );

    // ── Pearl — satin/pearlescent: broad diffuse sheen + slight iridescent shift ──
    case "pearl": {
      const Ssoft = Math.round(S * 0.55);
      const H2 = (H + 38) % 360; // warm iridescent shift
      const H3 = (H + 336) % 360; // cool iridescent shift (H-24)
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-pearl"
          style={{
            background: `radial-gradient(120% 120% at 40% 30%, hsl(${H} ${Ssoft}% 90%), hsl(${H} ${Math.round(S * 0.6)}% 72%) 44%, hsl(${H2} ${Ssoft}% 60%) 78%, hsl(${H3} ${Math.round(S * 0.45)}% 50%) 100%)`,
            boxShadow: [
              `inset 0 2px 6px hsl(${H} 20% 98% / .55)`,
              `inset 0 -6px 12px hsl(${H} 30% 40% / .3)`,
              `inset 0 0 0 1px hsl(${H} 30% 90% / .38)`,
              `0 2px 8px hsl(${H} 40% 20% / .3)`,
            ].join(", "),
          }}
        >
          <span
            className="sp-orbv-pearl-iris"
            style={{
              background: `radial-gradient(closest-side at 62% 70%, hsl(${H2} 60% 74% / .5), hsl(${H2} 60% 74% / 0) 70%)`,
            }}
          />
          <span className="sp-orbv-pearl-hi" />
        </span>,
      );
    }

    default:
      return wrap(<span className="sp-orbv-fill" style={{ background: col }} />);
  }
}

// ── comparison grid ───────────────────────────────────────────────────────────
const COLUMNS: { key: OrbVariant; label: string }[] = [
  { key: "glossy", label: "Glossy" },
  { key: "chrome", label: "Chrome" },
  { key: "neon", label: "Neon rim" },
  { key: "gel", label: "Gel" },
  { key: "gradient", label: "Gradient" },
  { key: "pearl", label: "Pearl" },
];

// Sample probabilities chosen to sweep heatColor's blue→green→amber→red range.
const SAMPLES = [0.12, 0.24, 0.4, 0.65];
const KIND: PropKind = "hr";
const SIZE = 72;

export function OrbVariants() {
  return (
    <div className="sp-orbv-page">
      <div className="sp-orbv-head">
        <h1>Orb sphere designs — round 2</h1>
        <p>
          Six spherical finishes. Same progress ring + centered % + <code>heatColor()</code> base
          color across all of them — only the sphere FINISH changes. <strong>Glossy</strong> is the
          round-1 pick, kept here for comparison. Sample probabilities sweep the color range (kind:{" "}
          <code>hr</code>).
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
