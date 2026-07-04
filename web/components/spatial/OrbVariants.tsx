/**
 * OrbVariants.tsx — TEMP light-fill + number-font comparison for the probability orb.
 *
 * The user picked the neon-glass orb but the near-CLEAR center makes the % hard to
 * read. This page explores two things (options-only — the real ProbabilityOrb is
 * NOT touched):
 *
 *   Section 1 — Fill options (bigger ~88px, LIGHT fill behind the number, no gloss)
 *     Every fill KEEPS the neon glowing rim (heatColor hue), the SVG progress ring,
 *     and the centered %. Only the CENTER FILL changes to a LIGHT backing so the
 *     digits sit on something bright and legible. Because the backing is light, the
 *     number is rendered DARK (ink) on the light-fill options for max contrast; the
 *     reference "Current (neon glass)" keeps its original white number.
 *       · Light chrome (subtle)  — light metallic sheen, low-but-visible opacity
 *       · Light chrome (medium)  — brighter/more present light chrome + soft sheen
 *       · Frosted light          — soft even satin light fill (calm, high contrast)
 *       · Tinted glass           — heat-color light wash (hue tint behind number)
 *       · Current (neon glass)   — the existing near-clear one, for reference
 *     All fills are CHEAP: no backdrop-filter, no big blur, just gradients + a few
 *     box-shadows (the orb renders many times per page).
 *
 *   Section 2 — Number-font options (one fill: Light chrome medium)
 *     Same orb, % number swapped across four fonts so the user can judge which makes
 *     the digits crispest/cleanest at small size. Tabular + lining figures where
 *     available so digits align. Shown at the orb's real number size AND ~65% scaled
 *     (phone "zoomed-out" size). Fonts loaded via next/font/google (ADDITIVE — this
 *     does NOT touch app/layout.tsx's real app fonts).
 *
 * Structure lives in .sp-orbv-* classes (scoped to .sp-root); the real .orb* CSS and
 * ProbabilityOrb are untouched. Delete this component + app/next/orbs/page.tsx once a
 * fill + font is chosen.
 */
"use client";

import "./spatial.css";
import type { PropKind } from "../../lib/format";
import { heatColor } from "../../lib/format";
import { ORB_RING_C } from "./orbMath";
import { Spline_Sans_Mono, Inter, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

// ── font loads (module scope — required by next/font) ─────────────────────────
const splineMono = Spline_Sans_Mono({ subsets: ["latin"], weight: ["500", "600", "700"] });
const inter = Inter({ subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600", "700"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });

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
  col: string;
  bright: string;
}

function heatCols(prob: number, kind: PropKind): HeatCols {
  const base = parseHsl(heatColor(prob, kind));
  const H = Math.round(base.h);
  const S = Math.min(Math.round(base.s) + 16, 92); // match ProbabilityOrb's lift
  const light = Math.round(base.l);
  const brightL = Math.min(light + 24, 88);
  return {
    H,
    S,
    light,
    brightL,
    col: `hsl(${H} ${S}% ${light}%)`,
    bright: `hsl(${H} ${S}% ${brightL}%)`,
  };
}

// The neon rim, shared by every fill: a bright inset rim line in the heat hue +
// a small inner rim glow + a small outer bloom. Cheap (3 box-shadows, no blur).
function neonRim(H: number, S: number, brightL: number): string {
  return [
    `inset 0 0 0 1.5px hsl(${H} ${S}% ${Math.min(brightL + 4, 82)}% / .92)`,
    `inset 0 0 6px hsl(${H} ${S}% ${brightL}% / .24)`,
    `0 0 8px hsl(${H} ${S}% ${brightL}% / .4)`,
  ].join(", ");
}

// ── shared progress ring + number ─────────────────────────────────────────────
interface RingNumProps {
  prob: number;
  col: string;
  size: number;
  glow?: number;
  /** Dark ink number (for light fills). Default false = white number. */
  dark?: boolean;
  /** Optional font-family override (Section 2). */
  numFont?: string;
  label?: string;
}

function RingAndNum({ prob, col, size, glow = 4, dark = false, numFont, label }: RingNumProps) {
  const off = (ORB_RING_C * (1 - Math.max(0, Math.min(1, prob)))).toFixed(2);
  const numFsPx = (size * 0.27).toFixed(1);
  const numStyle: React.CSSProperties = { fontSize: `${numFsPx}px` };
  if (numFont) numStyle.fontFamily = numFont;
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
      <span className={`sp-orbv-num${dark ? " sp-orbv-num--dark" : ""}`} style={numStyle}>
        {Math.round(prob * 100)}
        <i>%</i>
        {label && <b>{label}</b>}
      </span>
    </>
  );
}

// ── fill kinds ────────────────────────────────────────────────────────────────
export type OrbFill =
  | "lightChromeSubtle"
  | "lightChromeMedium"
  | "frostedLight"
  | "tintedGlass"
  | "neonGlass";

interface VariantOrbProps {
  fill: OrbFill;
  prob: number;
  kind: PropKind;
  size?: number;
  numFont?: string;
  label?: string;
}

export function VariantOrb({ fill, prob, kind, size = 88, numFont, label }: VariantOrbProps) {
  const { H, S, light, brightL, bright } = heatCols(prob, kind);

  const wrap = (fillNode: React.ReactNode, ringNode: React.ReactNode) => (
    <span className="sp-orbv" style={{ width: size, height: size }}>
      {fillNode}
      {ringNode}
    </span>
  );

  // light-fill options share a dark number for contrast on the bright backing
  const darkNum = (
    <RingAndNum prob={prob} col={bright} size={size} glow={4} dark numFont={numFont} label={label} />
  );

  switch (fill) {
    // ── Light chrome (subtle) — light metallic sheen, low-but-visible opacity ──
    // Cheapest of the light set: NO sub-element. A light-gray, hue-tinted vertical
    // chrome gradient at moderate opacity (~.62–.72) so it reads as a light backing
    // while still feeling glassy. Neon rim carries the color.
    case "lightChromeSubtle":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-lcs"
          style={{
            background: `linear-gradient(157deg, hsl(${H} 22% 91% / .72) 0%, hsl(${H} 14% 81% / .64) 42%, hsl(${H} 16% 75% / .62) 60%, hsl(${H} 20% 86% / .70) 100%)`,
            boxShadow: neonRim(H, S, brightL),
          }}
        />,
        darkNum,
      );

    // ── Light chrome (medium) — brighter/more present light chrome + soft sheen ──
    // Fuller (near-opaque) light chrome gradient + ONE cheap unblurred top specular
    // sheen. Same neon rim. This is the fill reused in Section 2.
    case "lightChromeMedium":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-lcm"
          style={{
            background: `linear-gradient(157deg, hsl(${H} 28% 96%) 0%, hsl(${H} 20% 87%) 32%, hsl(${H} 16% 78%) 58%, hsl(${H} 22% 84%) 78%, hsl(${H} 24% 90%) 100%)`,
            boxShadow: [
              `inset 0 1px 2px hsl(0 0% 100% / .7)`,
              neonRim(H, S, brightL),
            ].join(", "),
          }}
        >
          <span className="sp-orbv-sheen" />
        </span>,
        darkNum,
      );

    // ── Frosted light — soft even satin light fill (calm, high contrast) ─────────
    // A gentle radial from near-white center to light edge — even and calm, no hard
    // gradient or specular. Highest, flattest number contrast.
    case "frostedLight":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-frost"
          style={{
            background: `radial-gradient(120% 120% at 50% 42%, hsl(${H} 16% 94%) 0%, hsl(${H} 14% 86% / .96) 58%, hsl(${H} 16% 80% / .95) 100%)`,
            boxShadow: [
              `inset 0 0 10px hsl(0 0% 100% / .35)`,
              neonRim(H, S, brightL),
            ].join(", "),
          }}
        />,
        darkNum,
      );

    // ── Tinted glass — heat-color light wash behind the number ───────────────────
    // The heat color itself, at a LIGHT lightness (~66–82%) and translucent, so the
    // hue softly tints the backing while staying bright enough for a dark number.
    case "tintedGlass":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-tint"
          style={{
            background: `radial-gradient(120% 120% at 50% 40%, hsl(${H} ${Math.min(S, 70)}% 84% / .78) 0%, hsl(${H} ${Math.min(S, 70)}% 70% / .68) 56%, hsl(${H} ${Math.min(S, 70)}% 60% / .66) 100%)`,
            boxShadow: [
              `inset 0 1px 2px hsl(0 0% 100% / .45)`,
              neonRim(H, S, brightL),
            ].join(", "),
          }}
        />,
        darkNum,
      );

    // ── Current (neon glass) — the existing near-clear center, white number ──────
    // Verbatim from the real ProbabilityOrb, for reference/comparison.
    case "neonGlass":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-glass"
          style={{
            background: `linear-gradient(160deg, hsl(${H} ${S}% 60% / .12) 0%, hsl(${H} ${S}% 40% / .06) 46%, hsl(${H} ${S}% 24% / .08) 100%)`,
            boxShadow: neonRim(H, S, brightL),
          }}
        >
          <span className="sp-orbv-glass-gloss" />
        </span>,
        <RingAndNum prob={prob} col={bright} size={size} glow={4} numFont={numFont} label={label} />,
      );

    default:
      return wrap(<span className="sp-orbv-fill" style={{ background: `hsl(${H} ${S}% ${light}%)` }} />, darkNum);
  }
}

// ── Section 1 — fill comparison grid ─────────────────────────────────────────
const FILL_COLUMNS: { key: OrbFill; label: string }[] = [
  { key: "lightChromeSubtle", label: "Light chrome (subtle)" },
  { key: "lightChromeMedium", label: "Light chrome (medium)" },
  { key: "frostedLight", label: "Frosted light" },
  { key: "tintedGlass", label: "Tinted glass" },
  { key: "neonGlass", label: "Current (neon glass)" },
];

// Sample probabilities per the brief — sweep heatColor's blue → green → amber range.
const SAMPLES = [0.18, 0.4, 0.65];
const KIND: PropKind = "hr";
const S1_SIZE = 88; // bigger than the current 64px orb

// ── Section 2 — number-font options ──────────────────────────────────────────
interface FontOpt {
  id: string;
  label: string;
  note: string;
  family: string;
}

const FONT_OPTIONS: FontOpt[] = [
  {
    id: "spline",
    label: "Spline Sans Mono",
    note: "current — monospace, even digit widths",
    family: splineMono.style.fontFamily,
  },
  {
    id: "inter",
    label: "Inter (tabular)",
    note: "proportional, very crisp small; tabular+lining figures",
    family: inter.style.fontFamily,
  },
  {
    id: "plex",
    label: "IBM Plex Mono",
    note: "monospace, humanist, clean",
    family: plexMono.style.fontFamily,
  },
  {
    id: "space",
    label: "Space Grotesk",
    note: "geometric, tight; tabular+lining figures",
    family: spaceGrotesk.style.fontFamily,
  },
];

// One font shown twice: real number size + ~65% phone-scaled copy.
function FontColumn({ opt }: { opt: FontOpt }) {
  return (
    <div className="sp-orbv-fontcol">
      <div className="sp-orbv-fonthead">
        <span className="sp-orbv-fontlabel">{opt.label}</span>
        <span className="sp-orbv-fontnote">{opt.note}</span>
      </div>
      <div className="sp-orbv-fontrow">
        {SAMPLES.map((prob) => (
          <div key={`real-${prob}`} className="sp-orbv-cell">
            <VariantOrb fill="lightChromeMedium" prob={prob} kind={KIND} size={S1_SIZE} numFont={opt.family} />
          </div>
        ))}
      </div>
      <span className="sp-orbv-sizetag">Real number size</span>
      <div className="sp-orbv-fontrow">
        <div className="sp-orbv-scaled">
          {SAMPLES.map((prob) => (
            <div key={`sm-${prob}`} className="sp-orbv-cell">
              <VariantOrb fill="lightChromeMedium" prob={prob} kind={KIND} size={S1_SIZE} numFont={opt.family} />
            </div>
          ))}
        </div>
      </div>
      <span className="sp-orbv-sizetag">Phone zoomed-out (~65%)</span>
    </div>
  );
}

export function OrbVariants() {
  return (
    <div className="sp-orbv-page">
      {/* ── Section 1 ── */}
      <div className="sp-orbv-head">
        <h1>Section 1 — Fill options (bigger, light fill, no gloss)</h1>
        <p>
          The chosen <strong>neon-glass</strong> orb kept a near-clear center that made the % hard to
          read. These options keep the neon rim + progress ring + centered %, render BIGGER (
          <code>{S1_SIZE}px</code>), and swap the center for a <strong>LIGHT fill</strong> that backs
          the number. Because the backing is light, the digits are drawn DARK on the light-fill
          options; the last column keeps the current white-on-clear treatment for reference. All fills
          are cheap (no backdrop-filter, minimal blur). Samples sweep the color range (kind{" "}
          <code>hr</code>).
        </p>
      </div>

      <div className="sp-orbv-grid">
        <div className="sp-orbv-row">
          <div className="sp-orbv-cell sp-orbv-corner">prob</div>
          {FILL_COLUMNS.map((c) => (
            <div key={c.key} className="sp-orbv-cell sp-orbv-colhead">
              {c.label}
            </div>
          ))}
        </div>
        {SAMPLES.map((prob) => (
          <div key={prob} className="sp-orbv-row">
            <div className="sp-orbv-cell sp-orbv-rowhead">{Math.round(prob * 100)}%</div>
            {FILL_COLUMNS.map((c) => (
              <div key={c.key} className="sp-orbv-cell">
                <VariantOrb fill={c.key} prob={prob} kind={KIND} size={S1_SIZE} />
                <span className="sp-orbv-caption">{c.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Section 2 ── */}
      <div className="sp-orbv-head sp-orbv-head--s2">
        <h1>Section 2 — Number-font options</h1>
        <p>
          Same orb (fill: <strong>Light chrome medium</strong>), % number swapped across four fonts to
          judge which digits look crispest/cleanest. Tabular + lining figures where available so digits
          align. Each font is shown at the orb&apos;s real number size and a ~65% scaled copy (phone
          &ldquo;zoomed-out&rdquo; size).
        </p>
      </div>

      <div className="sp-orbv-fonts">
        {FONT_OPTIONS.map((opt) => (
          <FontColumn key={opt.id} opt={opt} />
        ))}
      </div>
    </div>
  );
}

export default OrbVariants;
