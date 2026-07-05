/**
 * LogosBoltLockB.tsx — refinements of the well-liked "Bolt Lock" mark.
 *
 * Four BOLDER / richer / more dimensional takes on the "Bolt Lock" mark from
 * LogosBoltDiamond.tsx (a lightning bolt inside a diamond, framed by a precision
 * crosshair + corner-bracket lock). The core idea is kept — bolt-in-diamond +
 * a lock/crosshair frame — but each is pushed toward premium polish: glass depth,
 * full iris gradients, target rings, tick marks, lit bracket tips, and stronger
 * neon glow. Tuned to the Mock 7 "Spatial Depth" skin and read crisply at ~34px
 * on the dark command-bar beside the gradient wordmark.
 *
 *   1) Bolt Lock Ring    — diamond framed by a concentric target RING + tick marks
 *   2) Bolt Lock Glass   — glassy gradient diamond, bright knockout bolt, lit lock
 *   3) Bolt Lock Iris    — full iris-gradient fill + neon glow, lit-tip brackets
 *   4) Bolt Lock Reticle — bolt-diamond centered in a refined scope reticle
 *
 * Palette (from spatial.css):
 *   iris-cyan   hsl(188 92% 62%)
 *   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)
 *   iris-mag    hsl(322 86% 68%)
 *
 * IDs are prefixed per-mark (blb1-, blb2-, blb3-, blb4-) so gradients/filters/
 * clips never collide when all four render together on one page.
 */
import React from "react";

// ── 1) Bolt Lock Ring — the glass bolt-diamond framed by a concentric iris target
//        RING with graduated tick marks and four lit crosshair arms punching
//        through the ring: "locked & ranged."
const BoltLockRing: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="blb1-ring" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <linearGradient id="blb1-dia" x1="7" y1="7" x2="25" y2="25" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.55" stopColor="hsl(206 88% 58%)" />
        <stop offset="1" stopColor="hsl(188 92% 62%)" />
      </linearGradient>
      <linearGradient id="blb1-bolt" x1="12" y1="8" x2="20" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="1" stopColor="hsl(180 92% 60%)" />
      </linearGradient>
      <radialGradient id="blb1-glass" cx="50%" cy="40%" r="72%">
        <stop offset="0" stopColor="hsl(240 42% 17% / .55)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .92)" />
      </radialGradient>
      <filter id="blb1-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.75" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient bloom */}
    <circle cx="16" cy="16" r="13" fill="url(#blb1-ring)" opacity="0.12" />
    {/* faint full track under the ring */}
    <circle cx="16" cy="16" r="12.4" fill="none" stroke="hsl(0 0% 100% / .1)" strokeWidth="1.1" />
    {/* concentric iris target ring */}
    <circle
      cx="16"
      cy="16"
      r="12.4"
      fill="none"
      stroke="url(#blb1-ring)"
      strokeWidth="1.9"
      filter="url(#blb1-glow)"
    />
    {/* graduated range tick marks around the ring */}
    <g stroke="hsl(188 92% 70%)" strokeWidth="1.4" strokeLinecap="round" opacity="0.85">
      <path d="M16 1.4 L16 4.2" />
      <path d="M16 27.8 L16 30.6" />
      <path d="M1.4 16 L4.2 16" />
      <path d="M27.8 16 L30.6 16" />
    </g>
    {/* short diagonal ticks (finer graduations) */}
    <g stroke="hsl(150 84% 66%)" strokeWidth="1" strokeLinecap="round" opacity="0.6">
      <path d="M6.6 6.6 L8.1 8.1" />
      <path d="M25.4 6.6 L23.9 8.1" />
      <path d="M25.4 25.4 L23.9 23.9" />
      <path d="M6.6 25.4 L8.1 23.9" />
    </g>
    {/* glass bolt-diamond core */}
    <path
      d="M16 6.6 L25.4 16 L16 25.4 L6.6 16 Z"
      fill="url(#blb1-glass)"
      stroke="url(#blb1-dia)"
      strokeWidth="2"
      strokeLinejoin="round"
      filter="url(#blb1-glow)"
    />
    {/* inner facet line for glass depth */}
    <path d="M16 9.4 L22.6 16 L16 22.6 L9.4 16 Z" fill="none" stroke="hsl(0 0% 100% / .12)" strokeWidth="0.8" strokeLinejoin="round" />
    {/* lightning bolt */}
    <path
      d="M18 9.8 L11.8 16.4 L15 16.4 L13.9 22.2 L20.2 15.6 L17 15.6 Z"
      fill="url(#blb1-bolt)"
      filter="url(#blb1-glow)"
    />
  </svg>
);

// ── 2) Bolt Lock Glass — the most dimensional take: a glossy gradient-FILLED
//        diamond (orb-like, with a top sheen highlight) holding a bright knockout
//        bolt, locked by four glowing L-brackets with lit tips.
const BoltLockGlass: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="blb2-fill" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 66%)" />
        <stop offset="0.5" stopColor="hsl(206 88% 56%)" />
        <stop offset="1" stopColor="hsl(160 84% 54%)" />
      </linearGradient>
      <linearGradient id="blb2-edge" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 88% 72%)" />
        <stop offset="1" stopColor="hsl(264 90% 82%)" />
      </linearGradient>
      <linearGradient id="blb2-frame" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 74%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="blb2-sheen" cx="50%" cy="30%" r="60%">
        <stop offset="0" stopColor="hsl(0 0% 100% / .5)" />
        <stop offset="60%" stopColor="hsl(0 0% 100% / 0)" />
      </radialGradient>
      <filter id="blb2-glow" x="-55%" y="-55%" width="210%" height="210%">
        <feGaussianBlur stdDeviation="0.85" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient bloom */}
    <path d="M16 2.4 L29.6 16 L16 29.6 L2.4 16 Z" fill="url(#blb2-fill)" opacity="0.18" />
    {/* four glowing L-brackets (the lock) */}
    <g
      stroke="url(#blb2-frame)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      filter="url(#blb2-glow)"
    >
      <path d="M3.6 8.4 L3.6 3.6 L8.4 3.6" />
      <path d="M23.6 3.6 L28.4 3.6 L28.4 8.4" />
      <path d="M28.4 23.6 L28.4 28.4 L23.6 28.4" />
      <path d="M8.4 28.4 L3.6 28.4 L3.6 23.6" />
    </g>
    {/* lit bracket tips */}
    <g fill="hsl(150 92% 82%)" filter="url(#blb2-glow)">
      <circle cx="3.6" cy="3.6" r="1" />
      <circle cx="28.4" cy="3.6" r="1" />
      <circle cx="28.4" cy="28.4" r="1" />
      <circle cx="3.6" cy="28.4" r="1" />
    </g>
    {/* solid gradient-filled diamond with the bolt knocked out (even-odd) */}
    <path
      d="M16 5 L27 16 L16 27 L5 16 Z
         M18 9.4 L11.4 16.4 L14.8 16.4 L13.7 22.6 L20.6 15.6 L17 15.6 Z"
      fill="url(#blb2-fill)"
      fillRule="evenodd"
      filter="url(#blb2-glow)"
    />
    {/* glossy top sheen for orb-like depth */}
    <path d="M16 5.6 L26 15.6 L16 15.6 L7 15.6 Z" fill="url(#blb2-sheen)" opacity="0.5" />
    {/* crisp bright edge */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="none" stroke="url(#blb2-edge)" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

// ── 3) Bolt Lock Iris — full iris-gradient language + heavy neon glow: gradient
//        crosshair arms from all four points, gradient corner brackets with lit
//        tips, and a glass bolt-diamond with an iris-edged bolt. The richest color.
const BoltLockIris: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="blb3-frame" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <linearGradient id="blb3-dia" x1="7" y1="7" x2="25" y2="25" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.5" stopColor="hsl(206 88% 58%)" />
        <stop offset="1" stopColor="hsl(188 92% 62%)" />
      </linearGradient>
      <linearGradient id="blb3-bolt" x1="12" y1="8" x2="20" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 86%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 68%)" />
        <stop offset="1" stopColor="hsl(264 88% 76%)" />
      </linearGradient>
      <radialGradient id="blb3-glass" cx="50%" cy="38%" r="72%">
        <stop offset="0" stopColor="hsl(240 44% 18% / .5)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .92)" />
      </radialGradient>
      <filter id="blb3-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="1" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient bloom */}
    <path d="M16 2.4 L29.6 16 L16 29.6 L2.4 16 Z" fill="url(#blb3-frame)" opacity="0.15" />
    {/* gradient crosshair arms from the four diamond points */}
    <g stroke="url(#blb3-frame)" strokeWidth="1.9" strokeLinecap="round" filter="url(#blb3-glow)">
      <path d="M16 1.6 L16 6.2" />
      <path d="M16 25.8 L16 30.4" />
      <path d="M1.6 16 L6.2 16" />
      <path d="M25.8 16 L30.4 16" />
    </g>
    {/* gradient corner lock brackets */}
    <g stroke="url(#blb3-frame)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#blb3-glow)">
      <path d="M3.4 7.6 L3.4 3.4 L7.6 3.4" />
      <path d="M24.4 3.4 L28.6 3.4 L28.6 7.6" />
      <path d="M28.6 24.4 L28.6 28.6 L24.4 28.6" />
      <path d="M7.6 28.6 L3.4 28.6 L3.4 24.4" />
    </g>
    {/* lit bracket tips */}
    <g fill="hsl(150 92% 84%)" filter="url(#blb3-glow)">
      <circle cx="3.4" cy="3.4" r="0.95" />
      <circle cx="28.6" cy="3.4" r="0.95" />
      <circle cx="28.6" cy="28.6" r="0.95" />
      <circle cx="3.4" cy="28.6" r="0.95" />
    </g>
    {/* glass bolt-diamond core */}
    <path
      d="M16 6.6 L25.4 16 L16 25.4 L6.6 16 Z"
      fill="url(#blb3-glass)"
      stroke="url(#blb3-dia)"
      strokeWidth="2.1"
      strokeLinejoin="round"
      filter="url(#blb3-glow)"
    />
    {/* iris-gradient lightning bolt */}
    <path
      d="M18 9.8 L11.8 16.4 L15 16.4 L13.9 22.2 L20.2 15.6 L17 15.6 Z"
      fill="url(#blb3-bolt)"
      filter="url(#blb3-glow)"
    />
  </svg>
);

// ── 4) Bolt Lock Reticle — the bolt-diamond seated in a refined rifle-scope
//        reticle: a dark-glass scope body, fine full-length crosshairs with
//        graduated ticks clipped to the scope, and the glass bolt-diamond centered.
const BoltLockReticle: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="blb4-scope" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <linearGradient id="blb4-dia" x1="8" y1="8" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.55" stopColor="hsl(206 88% 58%)" />
        <stop offset="1" stopColor="hsl(188 92% 62%)" />
      </linearGradient>
      <linearGradient id="blb4-bolt" x1="12" y1="9" x2="20" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="1" stopColor="hsl(180 92% 60%)" />
      </linearGradient>
      <radialGradient id="blb4-glass" cx="50%" cy="40%" r="72%">
        <stop offset="0" stopColor="hsl(240 42% 17% / .5)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .9)" />
      </radialGradient>
      <filter id="blb4-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <clipPath id="blb4-clip">
        <circle cx="16" cy="16" r="12" />
      </clipPath>
    </defs>
    {/* ambient bloom */}
    <circle cx="16" cy="16" r="13" fill="url(#blb4-scope)" opacity="0.1" />
    {/* dark-glass scope body */}
    <circle cx="16" cy="16" r="13" fill="hsl(244 46% 8% / .58)" stroke="url(#blb4-scope)" strokeWidth="1.6" filter="url(#blb4-glow)" />
    {/* fine reticle crosshairs + graduated ticks, clipped to the scope */}
    <g clipPath="url(#blb4-clip)" stroke="hsl(188 92% 66%)" strokeLinecap="round">
      <line x1="16" y1="4.4" x2="16" y2="27.6" strokeWidth="0.9" opacity="0.7" />
      <line x1="4.4" y1="16" x2="27.6" y2="16" strokeWidth="0.9" opacity="0.7" />
      <g strokeWidth="1.2" opacity="0.85">
        <line x1="13.9" y1="7.4" x2="18.1" y2="7.4" />
        <line x1="13.9" y1="24.6" x2="18.1" y2="24.6" />
        <line x1="7.4" y1="13.9" x2="7.4" y2="18.1" />
        <line x1="24.6" y1="13.9" x2="24.6" y2="18.1" />
      </g>
    </g>
    {/* glass bolt-diamond centered in the scope */}
    <path
      d="M16 8 L24 16 L16 24 L8 16 Z"
      fill="url(#blb4-glass)"
      stroke="url(#blb4-dia)"
      strokeWidth="1.9"
      strokeLinejoin="round"
      filter="url(#blb4-glow)"
    />
    {/* lightning bolt */}
    <path
      d="M17.7 10.6 L12.2 16.4 L15 16.4 L14.1 21.4 L19.6 15.6 L16.8 15.6 Z"
      fill="url(#blb4-bolt)"
      filter="url(#blb4-glow)"
    />
  </svg>
);

export const LOGOS_BOLTLOCK_B: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Bolt Lock Ring", El: BoltLockRing },
  { name: "Bolt Lock Glass", El: BoltLockGlass },
  { name: "Bolt Lock Iris", El: BoltLockIris },
  { name: "Bolt Lock Reticle", El: BoltLockReticle },
];

export default LOGOS_BOLTLOCK_B;
