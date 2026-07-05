/**
 * LogoMark.tsx — the finalized Prop Predict brand mark: "Aperture".
 *
 * A faceted glass IRIS APERTURE — six swirled glass blades closing onto a
 * brilliant violet→cyan→mint core ("the model opening to let insight
 * through"). Chosen by the user from the logo exploration (formerly
 * LogosAperture.tsx → LOGOS_APERTURE[0] "Aperture"). This is the exact same
 * markup, self-contained, with all gradient/filter ids under a clean
 * `pplogo-` prefix so it never collides with other SVGs.
 *
 * Keeps the Mock 7 "Spatial Depth" finish language (deep-glass fill, neon iris
 * rim, top specular gloss, bright inner core, soft glow) shared with
 * ProbabilityOrb. Renders as a self-contained inline SVG at `size`, viewBox
 * 0 0 32 32 — crisp on the dark command bar and legible as an app icon.
 *
 * Palette (spatial.css):
 *   iris-cyan hsl(188 92% 62%) · iris-violet hsl(264 88% 70%)
 *   iris-mint hsl(150 82% 60%) · deep glass hsl(244 46% 6%) → hsl(240 40% 16%)
 */
import React from "react";

// ── geometry helpers (pure, module-scope; keep the SVG exact + clean) ────────
const CX = 16;
const CY = 16;

/** Point on a circle. Angle in degrees, 0° = east, CCW positive (screen y-down). */
const P = (r: number, deg: number, cx = CX, cy = CY): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
};
const f = (n: number) => n.toFixed(2);
/** N evenly-spaced points on a circle, first vertex at `rot` degrees. */
const poly = (r: number, n: number, rot = 90): [number, number][] =>
  Array.from({ length: n }, (_, i) => P(r, rot + (i * 360) / n));
/** Closed polygon path from a list of points. */
const pathOf = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join(" ") + " Z";
const quad = (a: [number, number], c: [number, number], b: [number, number]) =>
  `M${f(a[0])} ${f(a[1])} Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`;

/**
 * The Prop Predict brand mark. Default size matches the command-bar mark (40px)
 * so it drops in without shifting layout; pass `size` to render it anywhere.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  const hex = poly(7.0, 6, 90); // wider iris opening than the original 5.4
  const blades = hex.map((v, i) => {
    const ang = 90 + i * 60;
    return quad(v, P(10.3, ang + 12), P(13.0, ang + 20)); // swirl out to the rim
  });
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="pplogo-glass" cx="42%" cy="34%" r="74%">
          <stop offset="0" stopColor="hsl(240 42% 17% / .74)" />
          <stop offset="58%" stopColor="hsl(244 46% 10% / .86)" />
          <stop offset="100%" stopColor="hsl(246 50% 6% / .95)" />
        </radialGradient>
        <linearGradient id="pplogo-rim" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(264 88% 74%)" />
          <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
          <stop offset="1" stopColor="hsl(150 84% 62%)" />
        </linearGradient>
        <radialGradient id="pplogo-core" cx="50%" cy="46%" r="62%">
          <stop offset="0" stopColor="hsl(150 96% 92%)" />
          <stop offset="34%" stopColor="hsl(172 92% 72%)" />
          <stop offset="70%" stopColor="hsl(200 90% 62%)" />
          <stop offset="100%" stopColor="hsl(258 86% 52%)" />
        </radialGradient>
        <filter id="pplogo-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.75" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="16" cy="16" r="14.6" fill="url(#pplogo-rim)" opacity="0.14" />
      <circle cx="16" cy="16" r="13.6" fill="url(#pplogo-glass)" />
      <circle cx="16" cy="16" r="13.6" fill="none" stroke="url(#pplogo-rim)" strokeWidth="1.7" />
      <path d="M7.4 8 C 11.2 4.8, 20.8 4.8, 24.6 8" stroke="hsl(0 0% 100% / .3)" strokeWidth="1" strokeLinecap="round" />

      {/* six swirled glass blade edges */}
      <g stroke="url(#pplogo-rim)" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.92" filter="url(#pplogo-glow)">
        {blades.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* inner bloom + the hexagonal iris opening */}
      <circle cx="16" cy="16" r="8.2" fill="url(#pplogo-core)" opacity="0.3" filter="url(#pplogo-glow)" />
      <path d={pathOf(hex)} fill="url(#pplogo-core)" stroke="hsl(0 0% 100% / .55)" strokeWidth="0.95" strokeLinejoin="round" filter="url(#pplogo-glow)" />
      <circle cx="14.9" cy="14.9" r="1.25" fill="hsl(0 0% 100% / .92)" />
    </svg>
  );
}

export default LogoMark;
