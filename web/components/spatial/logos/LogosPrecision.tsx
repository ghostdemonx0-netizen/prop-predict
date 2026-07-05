/**
 * LogosPrecision.tsx — Logo-mark options in the "Precision" art direction.
 *
 * Five distinct brand marks on the target / crosshair / scope / lock theme,
 * expanding on the well-liked "Precision" mark from LogosSignal.tsx. Tuned to the
 * Mock 7 "Spatial Depth" skin: the iris gradient (violet → cyan → mint), a soft
 * neon glow, and dark-glass cores. Each renders as a self-contained inline SVG at
 * `size` (default 34), viewBox 0 0 32 32, and reads crisply at ~34px on the dark
 * command-bar background beside the gradient wordmark.
 *
 * Palette (from spatial.css):
 *   iris-cyan   hsl(188 92% 62%)
 *   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)
 *   iris-mag    hsl(322 86% 68%)
 *
 * IDs are prefixed per-mark (prc1-, prc2-, prc3-, prc4-, prc5-) so gradients/
 * filters/clips never collide when several marks render together in a picker.
 */
import React from "react";

// ── 1) Crosshair — clean four-arm crosshair with a gap around a lit center dot;
//        iris-gradient arms, a thin dark-glass ring, and a bright neon core.
const Crosshair: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="prc1-arms" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(264 88% 72%)" />
      </linearGradient>
      <radialGradient id="prc1-core" cx="42%" cy="36%" r="70%">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="48%" stopColor="hsl(184 88% 60%)" />
        <stop offset="100%" stopColor="hsl(258 82% 48%)" />
      </radialGradient>
      <filter id="prc1-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* faint dark-glass containment ring */}
    <circle cx="16" cy="16" r="12" fill="hsl(244 46% 9% / .5)" stroke="hsl(230 60% 80% / .16)" strokeWidth="1" />
    {/* four crosshair arms, gapped around the core */}
    <g stroke="url(#prc1-arms)" strokeWidth="2.2" strokeLinecap="round" filter="url(#prc1-glow)">
      <path d="M16 2.4 L16 10.4" />
      <path d="M16 21.6 L16 29.6" />
      <path d="M2.4 16 L10.4 16" />
      <path d="M21.6 16 L29.6 16" />
    </g>
    {/* neon center dot */}
    <circle cx="16" cy="16" r="3.4" fill="url(#prc1-core)" filter="url(#prc1-glow)" />
    <circle cx="14.9" cy="14.9" r="0.95" fill="hsl(0 0% 100% / .82)" />
  </svg>
);

// ── 2) Bullseye — three concentric rings that shift violet → cyan → mint outward,
//        over a dark-glass field, with a bright mint bullseye core.
const Bullseye: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="prc2-core" cx="42%" cy="36%" r="72%">
        <stop offset="0" stopColor="hsl(150 92% 86%)" />
        <stop offset="55%" stopColor="hsl(160 86% 60%)" />
        <stop offset="100%" stopColor="hsl(172 84% 46%)" />
      </radialGradient>
      <filter id="prc2-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* dark-glass field */}
    <circle cx="16" cy="16" r="13" fill="hsl(244 46% 8% / .55)" />
    {/* outer ring — violet */}
    <circle cx="16" cy="16" r="12" fill="none" stroke="hsl(264 88% 72%)" strokeWidth="2" filter="url(#prc2-glow)" />
    {/* mid ring — cyan */}
    <circle cx="16" cy="16" r="8" fill="none" stroke="hsl(188 92% 64%)" strokeWidth="2" filter="url(#prc2-glow)" />
    {/* inner ring — mint */}
    <circle cx="16" cy="16" r="4.2" fill="none" stroke="hsl(150 84% 62%)" strokeWidth="2" filter="url(#prc2-glow)" />
    {/* lit bullseye core */}
    <circle cx="16" cy="16" r="2.1" fill="url(#prc2-core)" filter="url(#prc2-glow)" />
  </svg>
);

// ── 3) Reticle — a rifle-scope reticle: outer scope ring, long fine crosshairs to
//        the edge with graduated tick marks, in a single cyan neon color.
const Reticle: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="prc3-core" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="hsl(188 96% 82%)" />
        <stop offset="100%" stopColor="hsl(194 90% 58%)" />
      </radialGradient>
      <filter id="prc3-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <clipPath id="prc3-clip">
        <circle cx="16" cy="16" r="11.4" />
      </clipPath>
    </defs>
    {/* scope body */}
    <circle cx="16" cy="16" r="12.4" fill="hsl(244 46% 8% / .55)" stroke="hsl(188 90% 62% / .55)" strokeWidth="1.4" filter="url(#prc3-glow)" />
    <g clipPath="url(#prc3-clip)" stroke="hsl(188 92% 66%)" strokeLinecap="round">
      {/* full-length fine crosshairs */}
      <line x1="16" y1="4.6" x2="16" y2="27.4" strokeWidth="1.1" />
      <line x1="4.6" y1="16" x2="27.4" y2="16" strokeWidth="1.1" />
      {/* graduated tick marks along the vertical + horizontal axes */}
      <g strokeWidth="1.3">
        <line x1="13.6" y1="9" x2="18.4" y2="9" />
        <line x1="14.2" y1="12" x2="17.8" y2="12" />
        <line x1="14.2" y1="20" x2="17.8" y2="20" />
        <line x1="13.6" y1="23" x2="18.4" y2="23" />
        <line x1="9" y1="13.6" x2="9" y2="18.4" />
        <line x1="12" y1="14.2" x2="12" y2="17.8" />
        <line x1="20" y1="14.2" x2="20" y2="17.8" />
        <line x1="23" y1="13.6" x2="23" y2="18.4" />
      </g>
    </g>
    {/* aim dot */}
    <circle cx="16" cy="16" r="1.8" fill="url(#prc3-core)" filter="url(#prc3-glow)" />
  </svg>
);

// ── 4) Lock-On — camera-focus "target acquired" look: four L-shaped corner
//        brackets framing a lit center dot, with two short cyan aim ticks.
const LockOn: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="prc4-bracket" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="prc4-core" cx="42%" cy="36%" r="70%">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="50%" stopColor="hsl(184 88% 60%)" />
        <stop offset="100%" stopColor="hsl(258 82% 48%)" />
      </radialGradient>
      <filter id="prc4-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* four L-shaped corner brackets (target-lock frame) */}
    <g
      stroke="url(#prc4-bracket)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      filter="url(#prc4-glow)"
    >
      <path d="M4 10 L4 4 L10 4" />
      <path d="M22 4 L28 4 L28 10" />
      <path d="M28 22 L28 28 L22 28" />
      <path d="M10 28 L4 28 L4 22" />
    </g>
    {/* short aim ticks pointing inward */}
    <g stroke="hsl(188 92% 66%)" strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
      <path d="M16 8.6 L16 11" />
      <path d="M16 21 L16 23.4" />
      <path d="M8.6 16 L11 16" />
      <path d="M21 16 L23.4 16" />
    </g>
    {/* locked-on center dot */}
    <circle cx="16" cy="16" r="3.2" fill="url(#prc4-core)" filter="url(#prc4-glow)" />
    <circle cx="15" cy="15" r="0.9" fill="hsl(0 0% 100% / .82)" />
  </svg>
);

// ── 5) Seam Target — a crosshair fused with a curving baseball seam: iris ring,
//        two mint seam arcs with stitch ticks, and a lit core (precision + ball).
const SeamTarget: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="prc5-ring" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="prc5-core" cx="42%" cy="36%" r="70%">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="50%" stopColor="hsl(184 88% 60%)" />
        <stop offset="100%" stopColor="hsl(258 82% 48%)" />
      </radialGradient>
      <filter id="prc5-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* dark-glass field + iris precision ring */}
    <circle cx="16" cy="16" r="12" fill="hsl(244 46% 8% / .5)" />
    <circle cx="16" cy="16" r="12" fill="none" stroke="url(#prc5-ring)" strokeWidth="2" filter="url(#prc5-glow)" />
    {/* crosshair aim ticks (top/bottom) */}
    <g stroke="url(#prc5-ring)" strokeWidth="2" strokeLinecap="round">
      <path d="M16 3.2 L16 8.2" />
      <path d="M16 23.8 L16 28.8" />
    </g>
    {/* two curving baseball seams sweeping the sides */}
    <g stroke="hsl(150 84% 64%)" strokeWidth="1.7" strokeLinecap="round" fill="none" filter="url(#prc5-glow)">
      <path d="M7.4 6.6 C 11 11, 11 21, 7.4 25.4" />
      <path d="M24.6 6.6 C 21 11, 21 21, 24.6 25.4" />
    </g>
    {/* seam stitch ticks */}
    <g stroke="hsl(150 88% 74%)" strokeWidth="1.1" strokeLinecap="round" opacity="0.9">
      <path d="M8.6 10 L11.2 9.2" />
      <path d="M8.6 16 L11.6 16" />
      <path d="M8.6 22 L11.2 22.8" />
      <path d="M23.4 10 L20.8 9.2" />
      <path d="M23.4 16 L20.4 16" />
      <path d="M23.4 22 L20.8 22.8" />
    </g>
    {/* lit center core */}
    <circle cx="16" cy="16" r="3.1" fill="url(#prc5-core)" filter="url(#prc5-glow)" />
    <circle cx="15" cy="15" r="0.9" fill="hsl(0 0% 100% / .82)" />
  </svg>
);

export const LOGOS_PRECISION: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Crosshair", El: Crosshair },
  { name: "Bullseye", El: Bullseye },
  { name: "Reticle", El: Reticle },
  { name: "Lock-On", El: LockOn },
  { name: "Seam Target", El: SeamTarget },
];

export default LOGOS_PRECISION;
