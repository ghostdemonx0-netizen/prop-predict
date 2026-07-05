/**
 * LogosBoltLockMix.tsx — "Bolt Lock Iris × Glass" mixes.
 *
 * Four marks that BLEND the two well-liked Bolt Lock takes from LogosBoltLockB.tsx:
 *
 *   • "Bolt Lock Glass" — a glassy, gradient-FILLED diamond (orb-like, with a top
 *     sheen highlight fading to a dark bottom edge for real depth) holding a bright
 *     knockout bolt.
 *   • "Bolt Lock Iris" — the full iris gradient language (violet → cyan → mint) +
 *     neon glow, framed by corner-bracket "locks" with lit tips.
 *
 * The mix keeps the GLASS DEPTH (dimensional gradient diamond, top sheen, dark
 * bottom edge, bright bolt) AND the IRIS GRADIENT + corner-bracket lock with lit
 * tips: a premium, glassy, iris-gradient bolt-in-diamond framed by a glowing
 * precision lock. Each of the four is a genuinely distinct execution, varying
 * glass tint depth, iris gradient direction/stops, glow intensity, bolt weight,
 * and lock-frame style — all tuned to read crisp at ~34px on the dark Mock 7
 * "Spatial Depth" command bar and sit on-brand beside the ProbabilityOrb glass.
 *
 *   1) Iris Glass         — diagonal iris fill, knockout bolt lit from behind, brackets
 *   2) Iris Glass Deep    — deeper/darker glass tint, vertical iris, heavier bolt
 *   3) Iris Glass Glow    — max neon bloom, filled bright iris bolt, reversed iris
 *   4) Iris Glass Bracket — lighter glass, bracket + inward crosshair ticks lock
 *
 * Palette (spatial.css): iris-cyan hsl(188 92% 62%) · iris-violet hsl(264 88% 70%)
 *                        iris-mint hsl(150 82% 60%) · iris-mag hsl(322 86% 68%)
 *
 * Every gradient/filter id is prefixed per-mark (blm1-, blm2-, blm3-, blm4-) so
 * they never collide when all four render on one page.
 */
import React from "react";

// ── 1) Iris Glass — the clean baseline mix: a diagonal iris-gradient glass diamond
//        (violet → cyan → mint, top-left to bottom-right) with a top sheen + dark
//        bottom edge for orb depth, a bright bolt shining THROUGH a knockout, and
//        four glowing corner-bracket locks with lit tips.
const IrisGlass: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="blm1-fill" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 66%)" />
        <stop offset="0.5" stopColor="hsl(200 90% 56%)" />
        <stop offset="1" stopColor="hsl(158 84% 54%)" />
      </linearGradient>
      <linearGradient id="blm1-edge" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 88% 74%)" />
        <stop offset="1" stopColor="hsl(264 90% 84%)" />
      </linearGradient>
      <linearGradient id="blm1-frame" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 74%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <linearGradient id="blm1-bolt" x1="12" y1="9" x2="20" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 88%)" />
        <stop offset="1" stopColor="hsl(186 96% 74%)" />
      </linearGradient>
      {/* glass depth: bright top sheen fading to a dark bottom edge (orb-like) */}
      <radialGradient id="blm1-glass" cx="50%" cy="32%" r="74%">
        <stop offset="0" stopColor="hsl(0 0% 100% / .4)" />
        <stop offset="44%" stopColor="hsl(0 0% 100% / 0)" />
        <stop offset="100%" stopColor="hsl(244 48% 6% / .52)" />
      </radialGradient>
      <filter id="blm1-glow" x="-55%" y="-55%" width="210%" height="210%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient bloom */}
    <path d="M16 2.4 L29.6 16 L16 29.6 L2.4 16 Z" fill="url(#blm1-fill)" opacity="0.16" />
    {/* four glowing corner-bracket locks */}
    <g stroke="url(#blm1-frame)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#blm1-glow)">
      <path d="M3.4 7.6 L3.4 3.4 L7.6 3.4" />
      <path d="M24.4 3.4 L28.6 3.4 L28.6 7.6" />
      <path d="M28.6 24.4 L28.6 28.6 L24.4 28.6" />
      <path d="M7.6 28.6 L3.4 28.6 L3.4 24.4" />
    </g>
    {/* lit bracket tips */}
    <g fill="hsl(150 92% 84%)" filter="url(#blm1-glow)">
      <circle cx="3.4" cy="3.4" r="1" />
      <circle cx="28.6" cy="3.4" r="1" />
      <circle cx="28.6" cy="28.6" r="1" />
      <circle cx="3.4" cy="28.6" r="1" />
    </g>
    {/* bright bolt UNDER the diamond — it shines through the knockout */}
    <path d="M18 9.4 L11.4 16.4 L14.8 16.4 L13.7 22.6 L20.6 15.6 L17 15.6 Z" fill="url(#blm1-bolt)" filter="url(#blm1-glow)" />
    {/* iris-gradient glass diamond with the bolt knocked out */}
    <path
      d="M16 5 L27 16 L16 27 L5 16 Z
         M18 9.4 L11.4 16.4 L14.8 16.4 L13.7 22.6 L20.6 15.6 L17 15.6 Z"
      fill="url(#blm1-fill)"
      fillRule="evenodd"
      filter="url(#blm1-glow)"
    />
    {/* glass depth overlay (top sheen → dark bottom) — same knockout so the bolt stays lit */}
    <path
      d="M16 5 L27 16 L16 27 L5 16 Z
         M18 9.4 L11.4 16.4 L14.8 16.4 L13.7 22.6 L20.6 15.6 L17 15.6 Z"
      fill="url(#blm1-glass)"
      fillRule="evenodd"
    />
    {/* crisp bright iris edge */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="none" stroke="url(#blm1-edge)" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

// ── 2) Iris Glass Deep — the most dimensional/orb-like take: a DEEP glass tint
//        (darker, heavier bottom shadow + an inner facet line), a VERTICAL iris
//        gradient (violet up top → mint at the base), and a HEAVIER knockout bolt.
const IrisGlassDeep: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="blm2-fill" x1="16" y1="5" x2="16" y2="27" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(266 86% 62%)" />
        <stop offset="0.52" stopColor="hsl(206 86% 50%)" />
        <stop offset="1" stopColor="hsl(156 82% 48%)" />
      </linearGradient>
      <linearGradient id="blm2-edge" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 86% 70%)" />
        <stop offset="1" stopColor="hsl(268 90% 80%)" />
      </linearGradient>
      <linearGradient id="blm2-frame" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <linearGradient id="blm2-bolt" x1="12" y1="9" x2="20" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 94% 88%)" />
        <stop offset="1" stopColor="hsl(180 94% 66%)" />
      </linearGradient>
      {/* deeper glass: smaller/softer top sheen, stronger dark sink toward the base */}
      <radialGradient id="blm2-glass" cx="50%" cy="28%" r="78%">
        <stop offset="0" stopColor="hsl(0 0% 100% / .34)" />
        <stop offset="38%" stopColor="hsl(0 0% 100% / 0)" />
        <stop offset="72%" stopColor="hsl(244 48% 8% / .28)" />
        <stop offset="100%" stopColor="hsl(246 50% 5% / .74)" />
      </radialGradient>
      <filter id="blm2-glow" x="-55%" y="-55%" width="210%" height="210%">
        <feGaussianBlur stdDeviation="0.85" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient bloom */}
    <path d="M16 2.6 L29.4 16 L16 29.4 L2.6 16 Z" fill="url(#blm2-fill)" opacity="0.18" />
    {/* corner-bracket locks (slightly inset) */}
    <g stroke="url(#blm2-frame)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#blm2-glow)">
      <path d="M3.6 7.8 L3.6 3.6 L7.8 3.6" />
      <path d="M24.2 3.6 L28.4 3.6 L28.4 7.8" />
      <path d="M28.4 24.2 L28.4 28.4 L24.2 28.4" />
      <path d="M7.8 28.4 L3.6 28.4 L3.6 24.2" />
    </g>
    {/* lit bracket tips */}
    <g fill="hsl(188 94% 82%)" filter="url(#blm2-glow)">
      <circle cx="3.6" cy="3.6" r="1" />
      <circle cx="28.4" cy="3.6" r="1" />
      <circle cx="28.4" cy="28.4" r="1" />
      <circle cx="3.6" cy="28.4" r="1" />
    </g>
    {/* bright heavier bolt under the diamond */}
    <path d="M18.4 9 L11 16.6 L15 16.6 L13.6 23 L21 15.4 L17 15.4 Z" fill="url(#blm2-bolt)" filter="url(#blm2-glow)" />
    {/* deep-glass iris diamond, heavier bolt knocked out */}
    <path
      d="M16 5.4 L26.6 16 L16 26.6 L5.4 16 Z
         M18.4 9 L11 16.6 L15 16.6 L13.6 23 L21 15.4 L17 15.4 Z"
      fill="url(#blm2-fill)"
      fillRule="evenodd"
      filter="url(#blm2-glow)"
    />
    {/* deep glass depth overlay */}
    <path
      d="M16 5.4 L26.6 16 L16 26.6 L5.4 16 Z
         M18.4 9 L11 16.6 L15 16.6 L13.6 23 L21 15.4 L17 15.4 Z"
      fill="url(#blm2-glass)"
      fillRule="evenodd"
    />
    {/* inner facet line for extra glass depth */}
    <path d="M16 8.4 L23.6 16 L16 23.6 L8.4 16 Z" fill="none" stroke="hsl(0 0% 100% / .13)" strokeWidth="0.8" strokeLinejoin="round" />
    {/* crisp bright iris edge */}
    <path d="M16 5.4 L26.6 16 L16 26.6 L5.4 16 Z" fill="none" stroke="url(#blm2-edge)" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

// ── 3) Iris Glass Glow — the richest colour + heaviest neon bloom. A REVERSED iris
//        gradient (mint → cyan → violet, bottom-left to top-right), a bright FILLED
//        iris bolt sitting on the glass (not knocked out), and brackets with an
//        extra outer glow halo.
const IrisGlassGlow: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="blm3-fill" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(156 84% 56%)" />
        <stop offset="0.5" stopColor="hsl(192 90% 58%)" />
        <stop offset="1" stopColor="hsl(266 88% 70%)" />
      </linearGradient>
      <linearGradient id="blm3-edge" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 92% 84%)" />
        <stop offset="1" stopColor="hsl(150 90% 74%)" />
      </linearGradient>
      <linearGradient id="blm3-frame" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 90% 76%)" />
        <stop offset="0.5" stopColor="hsl(188 94% 68%)" />
        <stop offset="1" stopColor="hsl(150 86% 64%)" />
      </linearGradient>
      <linearGradient id="blm3-bolt" x1="12" y1="9" x2="20" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(0 0% 100%)" />
        <stop offset="0.5" stopColor="hsl(178 96% 84%)" />
        <stop offset="1" stopColor="hsl(150 94% 78%)" />
      </linearGradient>
      <radialGradient id="blm3-glass" cx="50%" cy="34%" r="74%">
        <stop offset="0" stopColor="hsl(0 0% 100% / .44)" />
        <stop offset="46%" stopColor="hsl(0 0% 100% / 0)" />
        <stop offset="100%" stopColor="hsl(244 48% 7% / .46)" />
      </radialGradient>
      <filter id="blm3-glow" x="-65%" y="-65%" width="230%" height="230%">
        <feGaussianBlur stdDeviation="1.15" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* stronger ambient bloom */}
    <path d="M16 1.8 L30.2 16 L16 30.2 L1.8 16 Z" fill="url(#blm3-fill)" opacity="0.22" />
    {/* corner-bracket locks with heavy glow */}
    <g stroke="url(#blm3-frame)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#blm3-glow)">
      <path d="M3.4 7.6 L3.4 3.4 L7.6 3.4" />
      <path d="M24.4 3.4 L28.6 3.4 L28.6 7.6" />
      <path d="M28.6 24.4 L28.6 28.6 L24.4 28.6" />
      <path d="M7.6 28.6 L3.4 28.6 L3.4 24.4" />
    </g>
    {/* lit bracket tips with a soft outer halo */}
    <g filter="url(#blm3-glow)">
      <g fill="hsl(150 94% 72%)" opacity="0.55">
        <circle cx="3.4" cy="3.4" r="1.7" />
        <circle cx="28.6" cy="3.4" r="1.7" />
        <circle cx="28.6" cy="28.6" r="1.7" />
        <circle cx="3.4" cy="28.6" r="1.7" />
      </g>
      <g fill="hsl(0 0% 100%)">
        <circle cx="3.4" cy="3.4" r="0.95" />
        <circle cx="28.6" cy="3.4" r="0.95" />
        <circle cx="28.6" cy="28.6" r="0.95" />
        <circle cx="3.4" cy="28.6" r="0.95" />
      </g>
    </g>
    {/* solid iris-gradient glass diamond (no knockout) */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="url(#blm3-fill)" filter="url(#blm3-glow)" />
    {/* glass depth overlay */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="url(#blm3-glass)" />
    {/* bright FILLED iris bolt on top */}
    <path d="M18 9.2 L11.2 16.4 L14.7 16.4 L13.6 22.8 L20.8 15.6 L17 15.6 Z" fill="url(#blm3-bolt)" filter="url(#blm3-glow)" />
    {/* crisp bright iris edge */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="none" stroke="url(#blm3-edge)" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

// ── 4) Iris Glass Bracket — a LIGHTER, airier glass tint with a distinct lock
//        frame: short corner brackets PLUS four inward crosshair ticks aimed at the
//        diamond's points ("bracket + tick"). Horizontal iris gradient, crisper
//        lighter knockout bolt.
const IrisGlassBracket: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="blm4-fill" x1="5" y1="16" x2="27" y2="16" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(188 92% 60%)" />
        <stop offset="0.5" stopColor="hsl(232 84% 64%)" />
        <stop offset="1" stopColor="hsl(150 82% 56%)" />
      </linearGradient>
      <linearGradient id="blm4-edge" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(188 92% 76%)" />
        <stop offset="1" stopColor="hsl(264 90% 82%)" />
      </linearGradient>
      <linearGradient id="blm4-frame" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <linearGradient id="blm4-bolt" x1="12" y1="9" x2="20" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 94% 90%)" />
        <stop offset="1" stopColor="hsl(190 96% 78%)" />
      </linearGradient>
      {/* lighter/airier glass: brighter sheen, gentler bottom edge */}
      <radialGradient id="blm4-glass" cx="50%" cy="34%" r="72%">
        <stop offset="0" stopColor="hsl(0 0% 100% / .46)" />
        <stop offset="50%" stopColor="hsl(0 0% 100% / 0)" />
        <stop offset="100%" stopColor="hsl(244 46% 8% / .38)" />
      </radialGradient>
      <filter id="blm4-glow" x="-55%" y="-55%" width="210%" height="210%">
        <feGaussianBlur stdDeviation="0.72" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient bloom */}
    <path d="M16 2.4 L29.6 16 L16 29.6 L2.4 16 Z" fill="url(#blm4-fill)" opacity="0.15" />
    {/* inward crosshair ticks aimed at the diamond points */}
    <g stroke="url(#blm4-frame)" strokeWidth="1.8" strokeLinecap="round" filter="url(#blm4-glow)">
      <path d="M16 2 L16 5" />
      <path d="M16 27 L16 30" />
      <path d="M2 16 L5 16" />
      <path d="M27 16 L30 16" />
    </g>
    {/* short corner-bracket locks */}
    <g stroke="url(#blm4-frame)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#blm4-glow)">
      <path d="M3.6 6.8 L3.6 3.6 L6.8 3.6" />
      <path d="M25.2 3.6 L28.4 3.6 L28.4 6.8" />
      <path d="M28.4 25.2 L28.4 28.4 L25.2 28.4" />
      <path d="M6.8 28.4 L3.6 28.4 L3.6 25.2" />
    </g>
    {/* lit bracket tips */}
    <g fill="hsl(150 92% 84%)" filter="url(#blm4-glow)">
      <circle cx="3.6" cy="3.6" r="0.95" />
      <circle cx="28.4" cy="3.6" r="0.95" />
      <circle cx="28.4" cy="28.4" r="0.95" />
      <circle cx="3.6" cy="28.4" r="0.95" />
    </g>
    {/* bright lighter bolt under the diamond (shines through knockout) */}
    <path d="M17.6 10 L12 16.4 L15 16.4 L14.2 22 L20 15.6 L17 15.6 Z" fill="url(#blm4-bolt)" filter="url(#blm4-glow)" />
    {/* iris glass diamond, lighter bolt knocked out */}
    <path
      d="M16 5.5 L26.5 16 L16 26.5 L5.5 16 Z
         M17.6 10 L12 16.4 L15 16.4 L14.2 22 L20 15.6 L17 15.6 Z"
      fill="url(#blm4-fill)"
      fillRule="evenodd"
      filter="url(#blm4-glow)"
    />
    {/* airy glass depth overlay */}
    <path
      d="M16 5.5 L26.5 16 L16 26.5 L5.5 16 Z
         M17.6 10 L12 16.4 L15 16.4 L14.2 22 L20 15.6 L17 15.6 Z"
      fill="url(#blm4-glass)"
      fillRule="evenodd"
    />
    {/* crisp bright iris edge */}
    <path d="M16 5.5 L26.5 16 L16 26.5 L5.5 16 Z" fill="none" stroke="url(#blm4-edge)" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export const LOGOS_BOLTLOCK_MIX: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Iris Glass", El: IrisGlass },
  { name: "Iris Glass Deep", El: IrisGlassDeep },
  { name: "Iris Glass Glow", El: IrisGlassGlow },
  { name: "Iris Glass Bracket", El: IrisGlassBracket },
];

export default LOGOS_BOLTLOCK_MIX;
