/**
 * LogosAperture.tsx — "Aperture of Foresight", refined + scaled up + explored.
 *
 * The user picked the "Aperture of Foresight" mark (a faceted glass IRIS
 * APERTURE — swirled iris-gradient blades closing onto a brilliant
 * violet→cyan→mint core: "the model opening to let insight through"). They
 * asked for it a bit BIGGER within the 32×32 mark (more prominent / confident)
 * and explored into five genuinely distinct executions of the same idea.
 *
 * All five keep the Mock 7 "Spatial Depth" finish language (deep-glass fill,
 * neon iris rim, top specular gloss, bright inner core, soft glow) shared with
 * ProbabilityOrb, and each renders as a self-contained inline SVG at `size`
 * (default 34), viewBox 0 0 32 32 — crisp on the dark command bar and legible
 * as an app icon. The aperture graphic is sized noticeably larger than the
 * original (disc r ≈ 13.6 vs 12.6; wider openings) so it fills more of the frame.
 *
 *   1) Aperture   — the original concept, cleaned up + enlarged, best-in-class
 *                   polish: six swirled glass blades onto a hexagonal iris core.
 *   2) Shutter    — precise mechanical camera-shutter leaves (crisp straight
 *                   spiral blades) stopping down to a bright iris core.
 *   3) Iris Eye   — an organic iris: dozens of fine radial striations converging
 *                   on a luminous pupil-core (foresight / vision).
 *   4) Aperture Ball — the aperture opens to reveal a seamed baseball at the
 *                   core (ties the lens metaphor to MLB).
 *   5) Refractor  — concentric iris rings refracting light inward to a single
 *                   focused spark (the lens / model bringing the read to a point).
 *
 * Palette (spatial.css):
 *   iris-cyan hsl(188 92% 62%) · iris-violet hsl(264 88% 70%)
 *   iris-mint hsl(150 82% 60%) · iris-mag hsl(322 86% 68%)
 *   deep glass hsl(244 46% 6%) → hsl(240 40% 16%)
 *
 * Every gradient / filter / clip id is prefixed per-mark (apt1-…apt5-) so
 * nothing collides when all five render together on one page.
 */
import React from "react";

// ── geometry helpers (pure, module-scope; keep the SVGs exact + clean) ───────
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
const line = (a: [number, number], b: [number, number]) =>
  `M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])}`;
const quad = (a: [number, number], c: [number, number], b: [number, number]) =>
  `M${f(a[0])} ${f(a[1])} Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`;

// ═══════════════════════════════════════════════════════════════════════════
// 1) Aperture — refined + enlarged original
// ═══════════════════════════════════════════════════════════════════════════
const Aperture: React.FC<{ size?: number }> = ({ size = 34 }) => {
  const hex = poly(7.0, 6, 90); // wider iris opening than the original 5.4
  const blades = hex.map((v, i) => {
    const ang = 90 + i * 60;
    return quad(v, P(10.3, ang + 12), P(13.0, ang + 20)); // swirl out to the rim
  });
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="apt1-glass" cx="42%" cy="34%" r="74%">
          <stop offset="0" stopColor="hsl(240 42% 17% / .74)" />
          <stop offset="58%" stopColor="hsl(244 46% 10% / .86)" />
          <stop offset="100%" stopColor="hsl(246 50% 6% / .95)" />
        </radialGradient>
        <linearGradient id="apt1-rim" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(264 88% 74%)" />
          <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
          <stop offset="1" stopColor="hsl(150 84% 62%)" />
        </linearGradient>
        <radialGradient id="apt1-core" cx="50%" cy="46%" r="62%">
          <stop offset="0" stopColor="hsl(150 96% 92%)" />
          <stop offset="34%" stopColor="hsl(172 92% 72%)" />
          <stop offset="70%" stopColor="hsl(200 90% 62%)" />
          <stop offset="100%" stopColor="hsl(258 86% 52%)" />
        </radialGradient>
        <filter id="apt1-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.75" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="16" cy="16" r="14.6" fill="url(#apt1-rim)" opacity="0.14" />
      <circle cx="16" cy="16" r="13.6" fill="url(#apt1-glass)" />
      <circle cx="16" cy="16" r="13.6" fill="none" stroke="url(#apt1-rim)" strokeWidth="1.7" />
      <path d="M7.4 8 C 11.2 4.8, 20.8 4.8, 24.6 8" stroke="hsl(0 0% 100% / .3)" strokeWidth="1" strokeLinecap="round" />

      {/* six swirled glass blade edges */}
      <g stroke="url(#apt1-rim)" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.92" filter="url(#apt1-glow)">
        {blades.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* inner bloom + the hexagonal iris opening */}
      <circle cx="16" cy="16" r="8.2" fill="url(#apt1-core)" opacity="0.3" filter="url(#apt1-glow)" />
      <path d={pathOf(hex)} fill="url(#apt1-core)" stroke="hsl(0 0% 100% / .55)" strokeWidth="0.95" strokeLinejoin="round" filter="url(#apt1-glow)" />
      <circle cx="14.9" cy="14.9" r="1.25" fill="hsl(0 0% 100% / .92)" />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 2) Shutter — mechanical camera-shutter leaves
// ═══════════════════════════════════════════════════════════════════════════
const Shutter: React.FC<{ size?: number }> = ({ size = 34 }) => {
  const N = 6;
  const a = 6.0; // tighter, stopped-down opening
  const hex = poly(a, N, 90);
  const twist = 18; // spiral of each leaf's leading edge
  const blades = hex.map((v1, i) => {
    const v2 = hex[(i + 1) % N];
    const ang1 = 90 + i * 60;
    const ang2 = 90 + (i + 1) * 60;
    const r1 = P(15.5, ang1 + twist); // out past the rim; clipped to the disc
    const r2 = P(15.5, ang2 + twist);
    return { fill: pathOf([v1, v2, r2, r1]), edge: line(v1, r1), even: i % 2 === 0 };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="apt2-glass" cx="42%" cy="32%" r="74%">
          <stop offset="0" stopColor="hsl(240 44% 16% / .78)" />
          <stop offset="60%" stopColor="hsl(244 48% 9% / .9)" />
          <stop offset="100%" stopColor="hsl(246 52% 5% / .96)" />
        </radialGradient>
        <linearGradient id="apt2-rim" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(264 88% 74%)" />
          <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
          <stop offset="1" stopColor="hsl(150 84% 62%)" />
        </linearGradient>
        <radialGradient id="apt2-core" cx="50%" cy="47%" r="60%">
          <stop offset="0" stopColor="hsl(160 98% 94%)" />
          <stop offset="36%" stopColor="hsl(178 92% 74%)" />
          <stop offset="74%" stopColor="hsl(202 90% 62%)" />
          <stop offset="100%" stopColor="hsl(258 86% 54%)" />
        </radialGradient>
        <filter id="apt2-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="apt2-clip">
          <circle cx="16" cy="16" r="13.6" />
        </clipPath>
      </defs>

      <circle cx="16" cy="16" r="14.6" fill="url(#apt2-rim)" opacity="0.14" />
      <circle cx="16" cy="16" r="13.6" fill="url(#apt2-glass)" />

      {/* core glow that spills through the stopped-down opening */}
      <circle cx="16" cy="16" r="8.4" fill="url(#apt2-core)" opacity="0.26" filter="url(#apt2-glow)" />

      {/* the six overlapping shutter leaves (glass), clipped to the disc */}
      <g clipPath="url(#apt2-clip)">
        {blades.map((b, i) => (
          <path key={i} d={b.fill} fill="url(#apt2-glass)" opacity={b.even ? 0.96 : 0.82} />
        ))}
        {/* crisp iris leading edges — the mechanical blade lines */}
        <g stroke="url(#apt2-rim)" strokeWidth="1.15" strokeLinecap="round" fill="none" opacity="0.95">
          {blades.map((b, i) => (
            <path key={i} d={b.edge} />
          ))}
        </g>
      </g>

      <circle cx="16" cy="16" r="13.6" fill="none" stroke="url(#apt2-rim)" strokeWidth="1.7" />
      <path d="M7.4 8 C 11.2 4.8, 20.8 4.8, 24.6 8" stroke="hsl(0 0% 100% / .3)" strokeWidth="1" strokeLinecap="round" />

      {/* bright hexagon aperture core + spark */}
      <path d={pathOf(hex)} fill="url(#apt2-core)" stroke="hsl(0 0% 100% / .58)" strokeWidth="0.9" strokeLinejoin="round" filter="url(#apt2-glow)" />
      <circle cx="15" cy="15" r="1.1" fill="hsl(0 0% 100% / .95)" />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 3) Iris Eye — organic radial striations onto a luminous pupil
// ═══════════════════════════════════════════════════════════════════════════
const IrisEye: React.FC<{ size?: number }> = ({ size = 34 }) => {
  const COUNT = 44;
  const striae = Array.from({ length: COUNT }, (_, i) => {
    const ang = (i * 360) / COUNT;
    const outer = 12.7 - (i % 3) * 0.55; // subtle length variation → organic
    return { d: line(P(4.7, ang), P(outer, ang)), o: 0.32 + (i % 5) * 0.13 };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="apt3-glass" cx="46%" cy="40%" r="70%">
          <stop offset="0" stopColor="hsl(240 42% 15% / .7)" />
          <stop offset="58%" stopColor="hsl(244 46% 9% / .88)" />
          <stop offset="100%" stopColor="hsl(246 52% 5% / .96)" />
        </radialGradient>
        <linearGradient id="apt3-rim" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(264 88% 74%)" />
          <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
          <stop offset="1" stopColor="hsl(150 84% 62%)" />
        </linearGradient>
        <radialGradient id="apt3-stria" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="hsl(160 92% 78%)" />
          <stop offset="55%" stopColor="hsl(190 90% 64%)" />
          <stop offset="100%" stopColor="hsl(266 86% 66%)" />
        </radialGradient>
        <radialGradient id="apt3-pupil" cx="46%" cy="42%" r="60%">
          <stop offset="0" stopColor="hsl(0 0% 100%)" />
          <stop offset="26%" stopColor="hsl(160 96% 90%)" />
          <stop offset="58%" stopColor="hsl(186 92% 68%)" />
          <stop offset="100%" stopColor="hsl(262 88% 54%)" />
        </radialGradient>
        <filter id="apt3-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.75" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="apt3-clip">
          <circle cx="16" cy="16" r="13.2" />
        </clipPath>
      </defs>

      <circle cx="16" cy="16" r="14.6" fill="url(#apt3-rim)" opacity="0.14" />
      <circle cx="16" cy="16" r="13.6" fill="url(#apt3-glass)" />

      {/* fine iris striations converging on the pupil */}
      <g clipPath="url(#apt3-clip)" stroke="url(#apt3-stria)" strokeWidth="0.55" strokeLinecap="round" filter="url(#apt3-glow)">
        {striae.map((s, i) => (
          <path key={i} d={s.d} opacity={s.o} />
        ))}
      </g>

      {/* limbal ring (organic dark outer band) + neon iris rim */}
      <circle cx="16" cy="16" r="12.6" fill="none" stroke="hsl(246 50% 5% / .55)" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="13.6" fill="none" stroke="url(#apt3-rim)" strokeWidth="1.7" />
      <path d="M7.6 8 C 11.3 5, 20.7 5, 24.4 8" stroke="hsl(0 0% 100% / .3)" strokeWidth="1" strokeLinecap="round" />

      {/* luminous pupil-core + catchlight */}
      <circle cx="16" cy="16" r="5.6" fill="url(#apt3-pupil)" stroke="hsl(0 0% 100% / .5)" strokeWidth="0.9" filter="url(#apt3-glow)" />
      <circle cx="14.2" cy="14.2" r="1.35" fill="hsl(0 0% 100% / .95)" />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 4) Aperture Ball — the iris opens onto a seamed baseball
// ═══════════════════════════════════════════════════════════════════════════
const ApertureBall: React.FC<{ size?: number }> = ({ size = 34 }) => {
  const pent = poly(7.6, 5, 90); // 5 leaves cracked open around the ball
  const blades = pent.map((v, i) => {
    const ang = 90 + i * 72;
    return quad(v, P(10.6, ang + 8), P(13.0, ang + 15));
  });
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="apt4-glass" cx="42%" cy="34%" r="74%">
          <stop offset="0" stopColor="hsl(240 42% 17% / .74)" />
          <stop offset="58%" stopColor="hsl(244 46% 10% / .86)" />
          <stop offset="100%" stopColor="hsl(246 50% 6% / .95)" />
        </radialGradient>
        <linearGradient id="apt4-rim" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(264 88% 74%)" />
          <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
          <stop offset="1" stopColor="hsl(150 84% 62%)" />
        </linearGradient>
        <radialGradient id="apt4-ball" cx="42%" cy="36%" r="70%">
          <stop offset="0" stopColor="hsl(0 0% 100%)" />
          <stop offset="55%" stopColor="hsl(210 30% 94%)" />
          <stop offset="100%" stopColor="hsl(220 34% 74%)" />
        </radialGradient>
        <radialGradient id="apt4-halo" cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor="hsl(170 92% 78%)" />
          <stop offset="100%" stopColor="hsl(200 90% 60% / 0)" />
        </radialGradient>
        <filter id="apt4-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.75" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="16" cy="16" r="14.6" fill="url(#apt4-rim)" opacity="0.14" />
      <circle cx="16" cy="16" r="13.6" fill="url(#apt4-glass)" />
      <circle cx="16" cy="16" r="13.6" fill="none" stroke="url(#apt4-rim)" strokeWidth="1.7" />
      <path d="M7.4 8 C 11.2 4.8, 20.8 4.8, 24.6 8" stroke="hsl(0 0% 100% / .3)" strokeWidth="1" strokeLinecap="round" />

      {/* five iris leaves cracked open around the reveal */}
      <g stroke="url(#apt4-rim)" strokeWidth="1.35" strokeLinecap="round" fill="none" opacity="0.9" filter="url(#apt4-glow)">
        {blades.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <path d={pathOf(pent)} fill="none" stroke="hsl(0 0% 100% / .32)" strokeWidth="0.7" strokeLinejoin="round" />

      {/* iris-lit halo behind the ball */}
      <circle cx="16" cy="16" r="7" fill="url(#apt4-halo)" opacity="0.5" filter="url(#apt4-glow)" />

      {/* the baseball at the core */}
      <circle cx="16" cy="16" r="5.5" fill="url(#apt4-ball)" stroke="hsl(0 0% 100% / .6)" strokeWidth="0.7" filter="url(#apt4-glow)" />
      {/* two curved red seams — stitches via a dashed stroke */}
      <g stroke="hsl(2 82% 58%)" strokeWidth="0.62" strokeLinecap="round" fill="none" strokeDasharray="0.5 1.15">
        <path d="M12.35 12.4 Q 14.2 16, 12.35 19.6" />
        <path d="M19.65 12.4 Q 17.8 16, 19.65 19.6" />
      </g>
      {/* specular glint on the ball */}
      <circle cx="14" cy="14" r="1.15" fill="hsl(0 0% 100% / .95)" />
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 5) Refractor — concentric iris rings focusing light to a spark
// ═══════════════════════════════════════════════════════════════════════════
const Refractor: React.FC<{ size?: number }> = ({ size = 34 }) => {
  const spokes = Array.from({ length: 12 }, (_, i) => {
    const ang = i * 30;
    return line(P(3.4, ang), P(12.4, ang));
  });
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="apt5-glass" cx="44%" cy="34%" r="74%">
          <stop offset="0" stopColor="hsl(240 42% 16% / .72)" />
          <stop offset="60%" stopColor="hsl(244 46% 9% / .88)" />
          <stop offset="100%" stopColor="hsl(246 50% 5% / .96)" />
        </radialGradient>
        <linearGradient id="apt5-rim" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(264 88% 74%)" />
          <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
          <stop offset="1" stopColor="hsl(150 84% 62%)" />
        </linearGradient>
        <linearGradient id="apt5-ring" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(150 84% 62%)" />
          <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
          <stop offset="1" stopColor="hsl(264 88% 74%)" />
        </linearGradient>
        <radialGradient id="apt5-core" cx="50%" cy="48%" r="60%">
          <stop offset="0" stopColor="hsl(0 0% 100%)" />
          <stop offset="34%" stopColor="hsl(164 96% 90%)" />
          <stop offset="72%" stopColor="hsl(196 92% 64%)" />
          <stop offset="100%" stopColor="hsl(260 88% 54%)" />
        </radialGradient>
        <filter id="apt5-glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="0.85" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="16" cy="16" r="14.6" fill="url(#apt5-rim)" opacity="0.14" />
      <circle cx="16" cy="16" r="13.6" fill="url(#apt5-glass)" />
      <circle cx="16" cy="16" r="13.6" fill="none" stroke="url(#apt5-rim)" strokeWidth="1.7" />
      <path d="M7.4 8 C 11.2 4.8, 20.8 4.8, 24.6 8" stroke="hsl(0 0% 100% / .3)" strokeWidth="1" strokeLinecap="round" />

      {/* thin refractive spokes drawing light inward */}
      <g stroke="url(#apt5-ring)" strokeWidth="0.55" strokeLinecap="round" fill="none" opacity="0.5">
        {spokes.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* concentric refractor rings, brighter as they close in */}
      <g fill="none" filter="url(#apt5-glow)">
        <circle cx="16" cy="16" r="11.0" stroke="url(#apt5-ring)" strokeWidth="1.15" opacity="0.68" />
        <circle cx="16" cy="16" r="8.2" stroke="url(#apt5-ring)" strokeWidth="1.3" opacity="0.82" />
        <circle cx="16" cy="16" r="5.4" stroke="url(#apt5-ring)" strokeWidth="1.5" opacity="0.95" />
      </g>

      {/* focused spark at the point of convergence */}
      <circle cx="16" cy="16" r="3.4" fill="url(#apt5-core)" filter="url(#apt5-glow)" />
      <circle cx="16" cy="16" r="3.4" fill="none" stroke="hsl(0 0% 100% / .5)" strokeWidth="0.8" />
      <circle cx="16" cy="16" r="1.15" fill="hsl(0 0% 100% / .96)" />
    </svg>
  );
};

export const LOGOS_APERTURE: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Aperture", El: Aperture },
  { name: "Shutter", El: Shutter },
  { name: "Iris Eye", El: IrisEye },
  { name: "Aperture Ball", El: ApertureBall },
  { name: "Refractor", El: Refractor },
];

export default LOGOS_APERTURE;
