/**
 * LogosFrostA.tsx — "Frosted" mark, five OUTER-ENCLOSURE variations.
 *
 * The winner mark ("Frosted", from LogosBoltLockGlass.tsx #3) is kept intact as
 * the HERO of every variation: a frosted deep-glass DIAMOND (soft matte body +
 * gentle diffuse bloom) with an iris-gradient neon rim, a BLACK bolt carrying a
 * hairline light edge (etched-into-glass look), INVERTED corner brackets (elbows
 * pointing inward) with small lit dots, and a top-left specular glint.
 *
 * These five ADD SOMETHING AROUND THE WHOLE MARK — a distinct outer enclosure —
 * while keeping the diamond + bolt + brackets as the center. The core is scaled
 * down slightly so the enclosure has breathing room; the enclosure stays subtle
 * and supporting so the mark reads crisp at ~34px on the dark command bar.
 *
 *   1) Orbit Ring  — a thin glowing iris ring encircling the mark (echoes the
 *                    site's probability orb) + one small lit orbit node.
 *   2) Badge       — the mark inside a subtle rounded-square glass panel with a
 *                    neon iris edge + a soft top gloss.
 *   3) Hexagon     — the mark framed by a neon hexagon outline (tech / gem feel).
 *   4) Reticle Ring— a target-style DUAL outer ring with tick marks + N/E/S/W
 *                    lit reticle ticks (ties to the lock / precision theme).
 *   5) Glass Disc  — the mark sitting on a faint circular glass disc with a soft
 *                    radial body + a neon rim (a mini deep-glass orb behind it).
 *
 * Palette (spatial.css): iris-cyan hsl(188 92% 62%), iris-violet hsl(264 88% 70%),
 *   iris-mint hsl(150 82% 60%), iris-mag hsl(322 86% 68%).
 *
 * Every gradient / filter / clip id is prefixed per-mark (fra1-… fra5-) so they
 * never collide when all five (or the other logo sets) render on one page.
 */
import React from "react";

/**
 * FrostedCore — the winner mark's diamond + black bolt + inverted brackets.
 * Rendered scaled toward the center (scale ~0.8) so each enclosure has room.
 * `p` uniquely prefixes every id so multiple cores can coexist on one page.
 */
const FrostedCore: React.FC<{ p: string; scale?: number }> = ({ p, scale = 0.8 }) => (
  <g transform={`translate(16 16) scale(${scale}) translate(-16 -16)`}>
    <defs>
      {/* frosted matte glass body — soft, low-contrast, darkening downward */}
      <radialGradient id={`${p}-body`} cx="50%" cy="38%" r="80%">
        <stop offset="0" stopColor="hsl(210 42% 34% / .74)" />
        <stop offset="60%" stopColor="hsl(232 42% 18% / .86)" />
        <stop offset="100%" stopColor="hsl(244 46% 11% / .95)" />
      </radialGradient>
      {/* soft iris rim */}
      <linearGradient id={`${p}-rim`} x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 70% 70%)" />
        <stop offset="0.5" stopColor="hsl(188 78% 74%)" />
        <stop offset="1" stopColor="hsl(264 74% 80%)" />
      </linearGradient>
      {/* inverted-bracket frame */}
      <linearGradient id={`${p}-frame`} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 78% 78%)" />
        <stop offset="0.5" stopColor="hsl(188 82% 72%)" />
        <stop offset="1" stopColor="hsl(150 74% 68%)" />
      </linearGradient>
      {/* soft frost bloom on top */}
      <radialGradient id={`${p}-frost`} cx="50%" cy="28%" r="66%">
        <stop offset="0" stopColor="hsl(0 0% 100% / .28)" />
        <stop offset="70%" stopColor="hsl(0 0% 100% / 0)" />
      </radialGradient>
      {/* wide soft diffuse glow */}
      <filter id={`${p}-soft`} x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="1.2" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* inverted lock brackets — corner elbows point INWARD toward the mark */}
    <g stroke={`url(#${p}-frame)`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.92" filter={`url(#${p}-soft)`}>
      <path d="M8.2 3.8 L8.2 8.2 L3.8 8.2" />
      <path d="M23.8 3.8 L23.8 8.2 L28.2 8.2" />
      <path d="M23.8 28.2 L23.8 23.8 L28.2 23.8" />
      <path d="M8.2 28.2 L8.2 23.8 L3.8 23.8" />
    </g>
    <g fill="hsl(160 82% 84%)" opacity="0.85" filter={`url(#${p}-soft)`}>
      <circle cx="8.2" cy="8.2" r="0.9" />
      <circle cx="23.8" cy="8.2" r="0.9" />
      <circle cx="23.8" cy="23.8" r="0.9" />
      <circle cx="8.2" cy="23.8" r="0.9" />
    </g>

    {/* frosted diamond body */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill={`url(#${p}-body)`} />
    {/* soft frost bloom */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill={`url(#${p}-frost)`} />
    {/* top-left specular glint — sells the glass depth */}
    <path d="M15 6 L7.2 13.8" stroke="hsl(0 0% 100% / .6)" strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
    {/* soft diffuse rim (no glow) */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="none" stroke={`url(#${p}-rim)`} strokeWidth="1.4" strokeLinejoin="round" opacity="0.85" />
    {/* black bolt with a hairline light edge — etched into the glass */}
    <path
      d="M18 9.6 L11.4 16.4 L14.8 16.4 L13.7 22.8 L20.6 15.6 L17 15.6 Z"
      fill="hsl(232 32% 6%)"
      stroke="hsl(188 64% 82% / .5)"
      strokeWidth="0.5"
      strokeLinejoin="round"
      transform="translate(16 16) scale(0.84) translate(-16 -16)"
    />
  </g>
);

// ── 1) Orbit Ring — a thin glowing iris ring around the whole mark, echoing the
//        probability orb, with a single small lit node riding the orbit.
const OrbitRing: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="fra1-ring" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 82% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <filter id="fra1-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* faint outer bloom */}
    <circle cx="16" cy="16" r="14.6" fill="url(#fra1-ring)" opacity="0.06" />
    {/* thin glowing orbit ring */}
    <circle cx="16" cy="16" r="14.4" fill="none" stroke="url(#fra1-ring)" strokeWidth="1.15" opacity="0.9" filter="url(#fra1-glow)" />
    {/* small lit orbit node */}
    <circle cx="16" cy="1.6" r="1.15" fill="hsl(150 90% 82%)" filter="url(#fra1-glow)" />
    <FrostedCore p="fra1" scale={0.78} />
  </svg>
);

// ── 2) Badge — the mark inside a subtle rounded-square glass panel with a neon
//        iris edge and a soft top gloss.
const Badge: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="fra2-panel" x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(232 42% 18% / .55)" />
        <stop offset="1" stopColor="hsl(244 46% 9% / .68)" />
      </linearGradient>
      <linearGradient id="fra2-edge" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 78% 64%)" />
        <stop offset="0.5" stopColor="hsl(188 88% 68%)" />
        <stop offset="1" stopColor="hsl(264 84% 76%)" />
      </linearGradient>
      <linearGradient id="fra2-gloss" x1="16" y1="3" x2="16" y2="14" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(0 0% 100% / .16)" />
        <stop offset="1" stopColor="hsl(0 0% 100% / 0)" />
      </linearGradient>
      <filter id="fra2-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* glass panel body */}
    <rect x="3.2" y="3.2" width="25.6" height="25.6" rx="7.2" fill="url(#fra2-panel)" />
    {/* soft top gloss */}
    <rect x="3.2" y="3.2" width="25.6" height="25.6" rx="7.2" fill="url(#fra2-gloss)" />
    {/* neon iris edge */}
    <rect x="3.2" y="3.2" width="25.6" height="25.6" rx="7.2" fill="none" stroke="url(#fra2-edge)" strokeWidth="1.2" opacity="0.9" filter="url(#fra2-glow)" />
    <FrostedCore p="fra2" scale={0.74} />
  </svg>
);

// ── 3) Hexagon — the mark framed by a neon hexagon outline (tech / gem feel).
const Hexagon: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="fra3-hex" x1="4" y1="27" x2="28" y2="5" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 80% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 90% 66%)" />
        <stop offset="1" stopColor="hsl(264 86% 74%)" />
      </linearGradient>
      <linearGradient id="fra3-fill" x1="16" y1="2.5" x2="16" y2="29.5" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(232 42% 16% / .4)" />
        <stop offset="1" stopColor="hsl(244 46% 8% / .5)" />
      </linearGradient>
      <filter id="fra3-glow" x="-45%" y="-45%" width="190%" height="190%">
        <feGaussianBlur stdDeviation="0.65" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* flat-top hexagon (points left/right) framing the mark */}
    <path d="M9 3.8 L23 3.8 L30 16 L23 28.2 L9 28.2 L2 16 Z" fill="url(#fra3-fill)" />
    <path d="M9 3.8 L23 3.8 L30 16 L23 28.2 L9 28.2 L2 16 Z" fill="none" stroke="url(#fra3-hex)" strokeWidth="1.2" strokeLinejoin="round" opacity="0.9" filter="url(#fra3-glow)" />
    {/* small lit vertex dots left + right */}
    <g fill="hsl(160 84% 82%)" opacity="0.85" filter="url(#fra3-glow)">
      <circle cx="30" cy="16" r="0.9" />
      <circle cx="2" cy="16" r="0.9" />
    </g>
    <FrostedCore p="fra3" scale={0.72} />
  </svg>
);

// ── 4) Reticle Ring — a target-style DUAL outer ring with fine tick marks and
//        four lit N/E/S/W reticle ticks (lock / precision theme).
const ReticleRing: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="fra4-ring" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 82% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <filter id="fra4-glow" x="-55%" y="-55%" width="210%" height="210%">
        <feGaussianBlur stdDeviation="0.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* outer thin ring */}
    <circle cx="16" cy="16" r="14.6" fill="none" stroke="url(#fra4-ring)" strokeWidth="0.9" opacity="0.85" filter="url(#fra4-glow)" />
    {/* inner ring */}
    <circle cx="16" cy="16" r="12.6" fill="none" stroke="url(#fra4-ring)" strokeWidth="0.7" opacity="0.5" />
    {/* fine tick marks between the two rings (12 ticks) */}
    <g stroke="url(#fra4-ring)" strokeWidth="0.8" strokeLinecap="round" opacity="0.7">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI) / 6;
        const r1 = 12.7, r2 = 14.4;
        const c = Math.cos(a), s = Math.sin(a);
        return (
          <line
            key={i}
            x1={16 + c * r1}
            y1={16 + s * r1}
            x2={16 + c * r2}
            y2={16 + s * r2}
          />
        );
      })}
    </g>
    {/* four lit N/E/S/W reticle ticks */}
    <g fill="hsl(150 90% 82%)" opacity="0.95" filter="url(#fra4-glow)">
      <circle cx="16" cy="1.4" r="1" />
      <circle cx="30.6" cy="16" r="1" />
      <circle cx="16" cy="30.6" r="1" />
      <circle cx="1.4" cy="16" r="1" />
    </g>
    <FrostedCore p="fra4" scale={0.7} />
  </svg>
);

// ── 5) Glass Disc — the mark sitting on a faint circular deep-glass disc with a
//        soft radial body and a neon rim (a mini probability-orb behind it).
const GlassDisc: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="fra5-disc" cx="50%" cy="36%" r="72%">
        <stop offset="0" stopColor="hsl(214 46% 22% / .5)" />
        <stop offset="58%" stopColor="hsl(238 46% 11% / .66)" />
        <stop offset="100%" stopColor="hsl(246 50% 7% / .82)" />
      </radialGradient>
      <linearGradient id="fra5-rim" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 80% 64%)" />
        <stop offset="0.5" stopColor="hsl(188 90% 68%)" />
        <stop offset="1" stopColor="hsl(264 86% 76%)" />
      </linearGradient>
      <linearGradient id="fra5-spec" x1="16" y1="2.6" x2="16" y2="15" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(0 0% 100% / .22)" />
        <stop offset="1" stopColor="hsl(0 0% 100% / 0)" />
      </linearGradient>
      <filter id="fra5-glow" x="-45%" y="-45%" width="190%" height="190%">
        <feGaussianBlur stdDeviation="0.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* deep-glass disc body */}
    <circle cx="16" cy="16" r="14.4" fill="url(#fra5-disc)" />
    {/* top specular gloss */}
    <circle cx="16" cy="16" r="14.4" fill="url(#fra5-spec)" />
    {/* neon rim */}
    <circle cx="16" cy="16" r="14.4" fill="none" stroke="url(#fra5-rim)" strokeWidth="1.1" opacity="0.88" filter="url(#fra5-glow)" />
    <FrostedCore p="fra5" scale={0.76} />
  </svg>
);

export const LOGOS_FROST_A: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Orbit Ring", El: OrbitRing },
  { name: "Badge", El: Badge },
  { name: "Hexagon", El: Hexagon },
  { name: "Reticle Ring", El: ReticleRing },
  { name: "Glass Disc", El: GlassDisc },
];

export default LOGOS_FROST_A;
