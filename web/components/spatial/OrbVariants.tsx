/**
 * OrbVariants.tsx — ROUND 3 chrome/neon-mix comparison for the probability orb.
 *
 * Round 2 narrowed the field to CHROME (polished metal) and NEON RIM (dark core,
 * glowing colored edge). Round 3 keeps both originals for reference and adds three
 * MIXES so the user can pick a chrome/neon blend — with a hard eye on phone
 * performance (bright glows + heavy blur cost GPU/refresh-rate, so the mixes are
 * tuned CHEAP: no backdrop-filter, no big blur, minimal box-shadows).
 *
 * Every variant KEEPS the same SVG progress ring (encodes raw %), the centered
 * % number, and the same heatColor(prob, kind) base color. Only the finish changes.
 *
 *   Chrome              — round-2 polished metal (bright), kept as reference
 *   Neon rim            — round-2 dark-core glowing colored rim, kept as reference
 *   Neon + light chrome — neon rim + a DIM, quiet chrome fill (cheapest: no sub-el)
 *   Neon + medium chrome— neon rim + a fuller/brighter chrome fill (middle ground)
 *   Chrome + neon edge  — round-2 bright chrome fill + a thin neon rim accent
 *
 * The older round-1/2 finishes (glossy/gel/gradient/pearl) remain in the switch for
 * reference but are no longer shown in the grid (see COLUMNS).
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
export type OrbVariant =
  | "glossy"
  | "chrome"
  | "neon"
  | "gel"
  | "gradient"
  | "pearl"
  | "neonLightChrome"
  | "neonMedChrome"
  | "chromeNeonEdge"
  | "neonTransChrome"
  | "neonGlass";

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

    // ── Neon + light chrome — glowing rim + a DIM, quiet chrome fill inside ──────
    // Round 3, the "light" pick. The rim carries the color; the interior is a
    // low-brightness metallic sheen (muted linear gradient, top highlight capped
    // ~56% so it never gets bright). Cheapest of the set: NO sub-elements, NO
    // blur/backdrop-filter, only 3 box-shadows (thin rim line + small inner + small
    // outer glow). Nothing expensive to composite.
    case "neonLightChrome":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-nlc"
          style={{
            background: `linear-gradient(158deg, hsl(${H} ${S}% 56%) 0%, hsl(${H} ${S}% 38%) 26%, hsl(${H} ${S}% 22%) 50%, hsl(${H} ${S}% 14%) 62%, hsl(${H} ${S}% 30%) 84%, hsl(${H} ${S}% 18%) 100%)`,
            boxShadow: [
              `inset 0 0 0 1.5px hsl(${H} ${S}% ${brightL}% / .9)`,
              `inset 0 0 6px hsl(${H} ${S}% ${brightL}% / .3)`,
              `0 0 7px hsl(${H} ${S}% ${brightL}% / .38)`,
            ].join(", "),
          }}
        />,
        <RingAndNum prob={prob} col={bright} size={size} glow={4} label={label} />,
      );

    // ── Neon + medium chrome — glowing rim + a fuller/slightly brighter chrome ──
    // Middle ground: top highlight ~74%, a single cheap (unblurred) soft specular
    // dot, and a slightly stronger rim glow. Still no blur/backdrop-filter.
    case "neonMedChrome":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-nmc"
          style={{
            background: `linear-gradient(158deg, hsl(${H} ${S}% 74%) 0%, hsl(${H} ${S}% 52%) 22%, hsl(${H} ${S}% 28%) 48%, hsl(${H} ${S}% 16%) 60%, hsl(${H} ${S}% 44%) 84%, hsl(${H} ${S}% 22%) 100%)`,
            boxShadow: [
              `inset 0 1px 2px hsl(${H} 30% 96% / .35)`,
              `inset 0 0 0 1.5px hsl(${H} ${S}% ${Math.min(brightL + 4, 82)}% / .95)`,
              `inset 0 0 9px hsl(${H} ${S}% ${brightL}% / .4)`,
              `0 0 10px hsl(${H} ${S}% ${brightL}% / .42)`,
            ].join(", "),
          }}
        >
          <span className="sp-orbv-softspec" />
        </span>,
        <RingAndNum prob={prob} col={bright} size={size} glow={5} label={label} />,
      );

    // ── Chrome + neon edge — round-2 bright chrome fill with a thin neon accent ──
    // Chrome-dominant: keeps the round-2 metal gradient + hard specular + top light
    // lip + dark base. The round-2 metallic edge + black cast are swapped for a thin
    // neon rim line + one small neon outer glow. One sub-element, no blur/backdrop.
    case "chromeNeonEdge":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-cne"
          style={{
            background: `linear-gradient(158deg, hsl(${H} ${Math.min(S + 6, 96)}% 92%) 0%, hsl(${H} ${S}% 66%) 20%, hsl(${H} ${S}% 30%) 46%, hsl(${H} ${S}% 15%) 58%, hsl(${H} ${S}% 52%) 82%, hsl(${H} ${S}% 24%) 100%)`,
            boxShadow: [
              `inset 0 2px 3px hsl(${H} 30% 98% / .6)`,
              `inset 0 -9px 12px hsl(${H} 60% 6% / .5)`,
              `inset 0 0 0 1.25px hsl(${H} ${S}% ${brightL}% / .95)`,
              `0 0 10px hsl(${H} ${S}% ${brightL}% / .5)`,
            ].join(", "),
          }}
        >
          <span className="sp-orbv-chrome-spec" />
        </span>,
        <RingAndNum prob={prob} col={bright} size={size} glow={5} label={label} />,
      );

    // ── Neon + transparent chrome — glowing rim + a SEE-THROUGH metal sheen ─────
    // Readability pick. The fill is a LOW-OPACITY metallic gradient (alpha ~.10–.24)
    // so the dark background shows through faintly and the centered % keeps strong
    // contrast. Same cheap recipe as the round-3 mixes: NO backdrop-filter, NO blur,
    // only a thin neon rim line + small inner sheen + one small outer glow.
    case "neonTransChrome":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-ntc"
          style={{
            background: `linear-gradient(158deg, hsl(${H} ${S}% 62% / .24) 0%, hsl(${H} ${S}% 42% / .16) 30%, hsl(${H} ${S}% 22% / .10) 52%, hsl(${H} ${S}% 16% / .12) 64%, hsl(${H} ${S}% 34% / .20) 86%, hsl(${H} ${S}% 20% / .14) 100%)`,
            boxShadow: [
              `inset 0 1px 2px hsl(${H} 30% 96% / .22)`,
              `inset 0 0 0 1.5px hsl(${H} ${S}% ${brightL}% / .9)`,
              `inset 0 0 7px hsl(${H} ${S}% ${brightL}% / .28)`,
              `0 0 8px hsl(${H} ${S}% ${brightL}% / .4)`,
            ].join(", "),
          }}
        />,
        <RingAndNum prob={prob} col={bright} size={size} glow={4} label={label} />,
      );

    // ── Neon + glass — glowing rim + a NEARLY-CLEAR glassy center ────────────────
    // Maximum % legibility. The fill is almost fully transparent (just a faint hue
    // tint, alpha ~.06–.12) so the number reads on the dark background; a single
    // thin top gloss line (.sp-orbv-glass-gloss) sells the glass. Neon rim carries
    // the color. Cheapest possible fill — no blur/backdrop-filter.
    case "neonGlass":
      return wrap(
        <span
          className="sp-orbv-fill sp-orbv-glass"
          style={{
            background: `linear-gradient(160deg, hsl(${H} ${S}% 60% / .12) 0%, hsl(${H} ${S}% 40% / .06) 46%, hsl(${H} ${S}% 24% / .08) 100%)`,
            boxShadow: [
              `inset 0 0 0 1.5px hsl(${H} ${S}% ${Math.min(brightL + 4, 82)}% / .92)`,
              `inset 0 0 6px hsl(${H} ${S}% ${brightL}% / .22)`,
              `0 0 8px hsl(${H} ${S}% ${brightL}% / .4)`,
            ].join(", "),
          }}
        >
          <span className="sp-orbv-glass-gloss" />
        </span>,
        <RingAndNum prob={prob} col={bright} size={size} glow={4} label={label} />,
      );

    default:
      return wrap(<span className="sp-orbv-fill" style={{ background: col }} />);
  }
}

// ── comparison grid ───────────────────────────────────────────────────────────
const COLUMNS: { key: OrbVariant; label: string }[] = [
  { key: "chrome", label: "Chrome" },
  { key: "neon", label: "Neon rim" },
  { key: "neonLightChrome", label: "Neon + light chrome" },
  { key: "neonMedChrome", label: "Neon + medium chrome" },
  { key: "chromeNeonEdge", label: "Chrome + neon edge" },
  { key: "neonTransChrome", label: "Neon + transparent chrome" },
  { key: "neonGlass", label: "Neon + glass" },
];

// Sample probabilities chosen to sweep heatColor's blue→green→amber→red range.
const SAMPLES = [0.12, 0.24, 0.4, 0.65];
const KIND: PropKind = "hr";
const SIZE = 72;

export function OrbVariants() {
  return (
    <div className="sp-orbv-page">
      <div className="sp-orbv-head">
        <h1>Orb sphere designs — round 3 (chrome / neon mixes)</h1>
        <p>
          Narrowed to <strong>Chrome</strong> and <strong>Neon rim</strong> from round 2, now mixed.{" "}
          <strong>Chrome</strong> and <strong>Neon rim</strong> are the round-2 originals, kept for
          reference. The three mixes add a chrome fill inside a neon rim at rising brightness (
          <strong>light → medium</strong>), then a chrome-dominant orb with a neon edge accent. All
          new mixes are tuned to render CHEAP — no blur/backdrop-filter, minimal box-shadows. Two
          added readability picks — <strong>Neon + transparent chrome</strong> (see-through metal
          sheen) and <strong>Neon + glass</strong> (near-clear center) — keep the neon rim but let the
          dark background show through so the centered % stays crisp. Same progress ring + centered %
          + <code>heatColor()</code> base color across all; samples sweep the color range (kind:{" "}
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
