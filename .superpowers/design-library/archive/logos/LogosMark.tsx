/**
 * LogosMark.tsx — Logo options in the "Mark / monogram" art direction.
 *
 * Four genuinely distinct brand marks for the "Prop Predict" wordmark in the
 * Spatial Depth command bar. Each renders one self-contained inline SVG at
 * `size` (default 34), viewBox 0 0 32 32, tuned to read clearly at ~34px on the
 * dark iris theme (violet → cyan → mint, neon glow, glass, layered depth).
 *
 * Palette pulled from spatial.css:
 *   iris-cyan   hsl(188 92% 62%)
 *   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)
 *   iris-mag    hsl(322 86% 68%)
 *
 * Every gradient / filter / clip id is prefixed uniquely (mrk1-, mrk2-, …) so
 * IDs never collide when all marks render together on one page.
 */
import React from "react";

/* ── 1 · PP Monogram — two mirrored P's interlocking around a shared spine ── */
const PPMonogram: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="mrk1-g" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 82% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 62%)" />
        <stop offset="1" stopColor="hsl(264 88% 72%)" />
      </linearGradient>
      <filter id="mrk1-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* soft depth halo */}
    <rect x="3" y="3" width="26" height="26" rx="8" fill="url(#mrk1-g)" opacity="0.12" />
    {/* shared central spine */}
    <rect x="14.5" y="6" width="3" height="20" rx="1.5" fill="url(#mrk1-g)" opacity="0.55" />
    {/* left P — bowl opens right off the spine */}
    <path
      d="M9 26 V6 H17 a5.5 5.5 0 0 1 0 11 H12"
      stroke="url(#mrk1-g)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      filter="url(#mrk1-glow)"
    />
    {/* right P — mirrored, bowl opens left; drawn lighter for interlock depth */}
    <path
      d="M23 26 V6 H15 a5.5 5.5 0 0 0 0 11 H20"
      stroke="hsl(0 0% 100% / .9)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity="0.85"
    />
  </svg>
);

/* ── 2 · Depth Stack — offset layered planes conveying spatial depth ── */
const DepthStack: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="mrk2-top" x1="6" y1="4" x2="26" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 66%)" />
        <stop offset="1" stopColor="hsl(188 92% 60%)" />
      </linearGradient>
      <linearGradient id="mrk2-mid" x1="6" y1="10" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(188 92% 60%)" />
        <stop offset="1" stopColor="hsl(264 88% 70%)" />
      </linearGradient>
      <linearGradient id="mrk2-bot" x1="6" y1="16" x2="26" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 68%)" />
        <stop offset="1" stopColor="hsl(322 86% 66%)" />
      </linearGradient>
      <filter id="mrk2-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* three stacked, offset diamond planes — back to front */}
    <g filter="url(#mrk2-glow)">
      <path d="M16 20 L26 25 L16 30 L6 25 Z" fill="url(#mrk2-bot)" opacity="0.5" />
      <path d="M16 13 L26 18 L16 23 L6 18 Z" fill="url(#mrk2-mid)" opacity="0.75" />
      <path d="M16 6 L26 11 L16 16 L6 11 Z" fill="url(#mrk2-top)" />
    </g>
    {/* top-plane sheen edge */}
    <path
      d="M16 6 L26 11 L16 16"
      stroke="hsl(0 0% 100% / .55)"
      strokeWidth="1"
      strokeLinejoin="round"
      fill="none"
    />
    {/* core spark */}
    <circle cx="16" cy="11" r="1.7" fill="hsl(0 0% 100% / .95)" />
  </svg>
);

/* ── 3 · Orbital — refined ring + core (evolution of the current mark) ── */
const Orbital: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="mrk3-core" cx="38%" cy="32%" r="80%">
        <stop offset="0" stopColor="hsl(150 90% 80%)" />
        <stop offset="45%" stopColor="hsl(168 86% 58%)" />
        <stop offset="100%" stopColor="hsl(255 80% 42%)" />
      </radialGradient>
      <linearGradient id="mrk3-ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(264 88% 72%)" />
      </linearGradient>
      <filter id="mrk3-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient halo */}
    <circle cx="16" cy="16" r="13" fill="url(#mrk3-core)" opacity="0.18" />
    {/* faint full orbit */}
    <circle cx="16" cy="16" r="10" fill="none" stroke="hsl(0 0% 100% / .1)" strokeWidth="2" />
    {/* neon orbit arc (~3/4) */}
    <circle
      cx="16"
      cy="16"
      r="10"
      fill="none"
      stroke="url(#mrk3-ring)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeDasharray="47 63"
      transform="rotate(-108 16 16)"
      filter="url(#mrk3-glow)"
    />
    {/* orbiting satellite */}
    <circle cx="26" cy="16" r="2.1" fill="hsl(188 96% 72%)" filter="url(#mrk3-glow)" />
    {/* glowing core */}
    <circle cx="16" cy="16" r="4.6" fill="url(#mrk3-core)" filter="url(#mrk3-glow)" />
    <circle cx="14.4" cy="14.4" r="1.4" fill="hsl(0 0% 100% / .8)" />
  </svg>
);

/* ── 4 · Gem — faceted hexagon holding an upward prediction spark ── */
const Gem: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="mrk4-face" x1="6" y1="3" x2="26" y2="29" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 82% 60%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 60%)" />
        <stop offset="1" stopColor="hsl(264 88% 70%)" />
      </linearGradient>
      <linearGradient id="mrk4-spark" x1="12" y1="9" x2="20" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(0 0% 100%)" />
        <stop offset="1" stopColor="hsl(150 90% 78%)" />
      </linearGradient>
      <filter id="mrk4-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <clipPath id="mrk4-clip">
        <path d="M16 2.5 L27 8.75 V23.25 L16 29.5 L5 23.25 V8.75 Z" />
      </clipPath>
    </defs>
    {/* hex body */}
    <path
      d="M16 2.5 L27 8.75 V23.25 L16 29.5 L5 23.25 V8.75 Z"
      fill="url(#mrk4-face)"
      opacity="0.16"
    />
    {/* internal facet lines (clipped to hex) */}
    <g clipPath="url(#mrk4-clip)" stroke="hsl(0 0% 100% / .16)" strokeWidth="0.9">
      <path d="M5 8.75 L16 16 L27 8.75" />
      <path d="M16 16 V29.5" />
    </g>
    {/* neon hex outline */}
    <path
      d="M16 2.5 L27 8.75 V23.25 L16 29.5 L5 23.25 V8.75 Z"
      fill="none"
      stroke="url(#mrk4-face)"
      strokeWidth="2"
      strokeLinejoin="round"
      filter="url(#mrk4-glow)"
    />
    {/* upward prediction spark / lightning inside */}
    <path
      d="M18 9 L12 17.5 H15.5 L14 23 L20.5 14 H16.8 Z"
      fill="url(#mrk4-spark)"
      filter="url(#mrk4-glow)"
    />
  </svg>
);

export const LOGOS_MARK: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "PP Monogram", El: PPMonogram },
  { name: "Depth Stack", El: DepthStack },
  { name: "Orbital", El: Orbital },
  { name: "Gem", El: Gem },
];

export default LOGOS_MARK;
