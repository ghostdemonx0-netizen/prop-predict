/**
 * LogosBoltLockGlass.tsx — UPGRADED "Bolt Lock Glass" mark, 5 deep-glass takes.
 *
 * The original "Bolt Lock Glass" (LogosBoltLockB.tsx #2) was a glassy gradient-
 * FILLED diamond with a knockout bolt + lit L-brackets. These five push it toward
 * the site's chosen orb finish — the DEEP GLASS look from ProbabilityOrb / .orbCore:
 * a DARK translucent glass body (radial fill darkening toward the bottom edge for
 * real depth), a bright NEON rim on the edge, a thin top specular highlight, a
 * subtle inner shadow, and a bright glowing BOLT as the focal point. Every mark
 * keeps the core idea — bolt inside a glassy diamond + a precision corner-bracket
 * lock frame — and reads crisp at ~34px on the dark command bar beside the
 * gradient wordmark. Iris palette + neon glow throughout.
 *
 *   1) Deep Glass   — dark translucent body + bright neon rim (closest to the orb)
 *   2) Liquid Glass — strong glossy top reflection sweep + crisp bright edge
 *   3) Frosted      — soft matte translucent body, gentle diffuse glow, soft rim
 *   4) Inner-Lit    — the bolt blooms outward, lighting the glass from within
 *   5) Faceted      — a cut-gem bevel line splits the glass into two tinted facets
 *
 * Palette (from spatial.css):
 *   iris-cyan   hsl(188 92% 62%)
 *   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)
 *   iris-mag    hsl(322 86% 68%)
 *
 * IDs are prefixed per-mark (blg1-, blg2-, blg3-, blg4-, blg5-) so gradients/
 * filters/clips never collide when all five render together on one page.
 */
import React from "react";

// ── 1) Deep Glass — closest echo of the site's deep-glass orb: a DARK translucent
//        diamond whose radial fill darkens toward the bottom edge, wrapped in a
//        bright neon iris rim, with a thin top specular highlight and a bright
//        knockout bolt. Locked by four tasteful glowing corner brackets.
const DeepGlass: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      {/* deep-glass body: light near top, darkening to near-black at the bottom */}
      <radialGradient id="blg1-body" cx="50%" cy="34%" r="76%">
        <stop offset="0" stopColor="hsl(214 60% 22% / .62)" />
        <stop offset="58%" stopColor="hsl(238 52% 11% / .78)" />
        <stop offset="100%" stopColor="hsl(246 54% 6% / .92)" />
      </radialGradient>
      {/* bright neon iris rim */}
      <linearGradient id="blg1-rim" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 64%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 68%)" />
        <stop offset="1" stopColor="hsl(264 88% 76%)" />
      </linearGradient>
      <linearGradient id="blg1-frame" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 74%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <linearGradient id="blg1-bolt" x1="12" y1="9" x2="20" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 96% 88%)" />
        <stop offset="1" stopColor="hsl(184 94% 64%)" />
      </linearGradient>
      {/* top specular highlight */}
      <linearGradient id="blg1-spec" x1="16" y1="5" x2="16" y2="16" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(0 0% 100% / .5)" />
        <stop offset="1" stopColor="hsl(0 0% 100% / 0)" />
      </linearGradient>
      <filter id="blg1-glow" x="-55%" y="-55%" width="210%" height="210%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient bloom */}
    <path d="M16 2.6 L29.4 16 L16 29.4 L2.6 16 Z" fill="url(#blg1-rim)" opacity="0.13" />
    {/* corner-bracket lock frame */}
    <g stroke="url(#blg1-frame)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#blg1-glow)">
      <path d="M3.8 8.2 L3.8 3.8 L8.2 3.8" />
      <path d="M23.8 3.8 L28.2 3.8 L28.2 8.2" />
      <path d="M28.2 23.8 L28.2 28.2 L23.8 28.2" />
      <path d="M8.2 28.2 L3.8 28.2 L3.8 23.8" />
    </g>
    <g fill="hsl(150 94% 84%)" filter="url(#blg1-glow)">
      <circle cx="3.8" cy="3.8" r="0.95" />
      <circle cx="28.2" cy="3.8" r="0.95" />
      <circle cx="28.2" cy="28.2" r="0.95" />
      <circle cx="3.8" cy="28.2" r="0.95" />
    </g>
    {/* deep-glass diamond body */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="url(#blg1-body)" />
    {/* subtle inner shadow for depth (lower half) */}
    <path d="M16 27 L5 16 L16 16 L27 16 Z" fill="hsl(246 54% 4% / .35)" />
    {/* top specular highlight */}
    <path d="M16 6 L25.4 15.4 L16 15.4 L6.6 15.4 Z" fill="url(#blg1-spec)" opacity="0.55" />
    {/* bright neon rim edge */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="none" stroke="url(#blg1-rim)" strokeWidth="1.7" strokeLinejoin="round" filter="url(#blg1-glow)" />
    {/* bright glowing bolt */}
    <path d="M18 9.6 L11.4 16.4 L14.8 16.4 L13.7 22.8 L20.6 15.6 L17 15.6 Z" fill="url(#blg1-bolt)" filter="url(#blg1-glow)" />
  </svg>
);

// ── 2) Liquid Glass — a wet, poured-glass look: dark body under a strong glossy
//        top REFLECTION that sweeps across the upper facets, plus a crisp bright
//        edge. The bolt reads like it's under a clear coat.
const LiquidGlass: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="blg2-body" cx="50%" cy="32%" r="78%">
        <stop offset="0" stopColor="hsl(206 66% 24% / .6)" />
        <stop offset="55%" stopColor="hsl(232 56% 12% / .8)" />
        <stop offset="100%" stopColor="hsl(246 56% 6% / .94)" />
      </radialGradient>
      <linearGradient id="blg2-edge" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 90% 74%)" />
        <stop offset="0.5" stopColor="hsl(188 94% 72%)" />
        <stop offset="1" stopColor="hsl(264 90% 82%)" />
      </linearGradient>
      <linearGradient id="blg2-frame" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <linearGradient id="blg2-bolt" x1="12" y1="9" x2="20" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(0 0% 100%)" />
        <stop offset="1" stopColor="hsl(174 94% 66%)" />
      </linearGradient>
      {/* strong glossy reflection */}
      <linearGradient id="blg2-gloss" x1="10" y1="6" x2="20" y2="17" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(0 0% 100% / .82)" />
        <stop offset="0.55" stopColor="hsl(0 0% 100% / .18)" />
        <stop offset="1" stopColor="hsl(0 0% 100% / 0)" />
      </linearGradient>
      <filter id="blg2-glow" x="-55%" y="-55%" width="210%" height="210%">
        <feGaussianBlur stdDeviation="0.85" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <clipPath id="blg2-clip">
        <path d="M16 5 L27 16 L16 27 L5 16 Z" />
      </clipPath>
    </defs>
    <path d="M16 2.6 L29.4 16 L16 29.4 L2.6 16 Z" fill="url(#blg2-frame)" opacity="0.13" />
    {/* lock frame */}
    <g stroke="url(#blg2-frame)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#blg2-glow)">
      <path d="M3.8 8.2 L3.8 3.8 L8.2 3.8" />
      <path d="M23.8 3.8 L28.2 3.8 L28.2 8.2" />
      <path d="M28.2 23.8 L28.2 28.2 L23.8 28.2" />
      <path d="M8.2 28.2 L3.8 28.2 L3.8 23.8" />
    </g>
    <g fill="hsl(150 94% 84%)" filter="url(#blg2-glow)">
      <circle cx="3.8" cy="3.8" r="0.95" />
      <circle cx="28.2" cy="3.8" r="0.95" />
      <circle cx="28.2" cy="28.2" r="0.95" />
      <circle cx="3.8" cy="28.2" r="0.95" />
    </g>
    {/* glass body */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="url(#blg2-body)" />
    {/* strong liquid gloss on the upper half, clipped to the diamond */}
    <g clipPath="url(#blg2-clip)">
      <path d="M16 5 L27 16 L16 15 L5 16 Z" fill="url(#blg2-gloss)" />
      <path d="M8.4 12.6 Q16 8.2 23.6 12.6 Q16 11 8.4 12.6 Z" fill="hsl(0 0% 100% / .35)" />
    </g>
    {/* crisp bright edge */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="none" stroke="url(#blg2-edge)" strokeWidth="1.6" strokeLinejoin="round" filter="url(#blg2-glow)" />
    {/* bolt under the clear coat */}
    <path d="M18 9.6 L11.4 16.4 L14.8 16.4 L13.7 22.8 L20.6 15.6 L17 15.6 Z" fill="url(#blg2-bolt)" filter="url(#blg2-glow)" />
  </svg>
);

// ── 3) Frosted — soft matte translucent glass: a diffused, low-contrast body with
//        a gentle overall glow and a soft (not razor) rim. The bolt glows softly
//        rather than punching hard. Calmest, most premium-subtle take.
const Frosted: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="blg3-body" cx="50%" cy="38%" r="80%">
        <stop offset="0" stopColor="hsl(210 40% 30% / .5)" />
        <stop offset="60%" stopColor="hsl(232 40% 16% / .62)" />
        <stop offset="100%" stopColor="hsl(244 44% 10% / .74)" />
      </radialGradient>
      <linearGradient id="blg3-rim" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 70% 70%)" />
        <stop offset="0.5" stopColor="hsl(188 78% 74%)" />
        <stop offset="1" stopColor="hsl(264 74% 80%)" />
      </linearGradient>
      <linearGradient id="blg3-frame" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 78% 78%)" />
        <stop offset="0.5" stopColor="hsl(188 82% 72%)" />
        <stop offset="1" stopColor="hsl(150 74% 68%)" />
      </linearGradient>
      <linearGradient id="blg3-bolt" x1="12" y1="9" x2="20" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(160 82% 86%)" />
        <stop offset="1" stopColor="hsl(190 78% 74%)" />
      </linearGradient>
      {/* soft frost highlight */}
      <radialGradient id="blg3-frost" cx="50%" cy="28%" r="66%">
        <stop offset="0" stopColor="hsl(0 0% 100% / .28)" />
        <stop offset="70%" stopColor="hsl(0 0% 100% / 0)" />
      </radialGradient>
      {/* wide, soft diffuse glow */}
      <filter id="blg3-soft" x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="1.5" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <path d="M16 2.6 L29.4 16 L16 29.4 L2.6 16 Z" fill="url(#blg3-rim)" opacity="0.1" />
    {/* softly glowing lock frame */}
    <g stroke="url(#blg3-frame)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.92" filter="url(#blg3-soft)">
      <path d="M3.8 8.2 L3.8 3.8 L8.2 3.8" />
      <path d="M23.8 3.8 L28.2 3.8 L28.2 8.2" />
      <path d="M28.2 23.8 L28.2 28.2 L23.8 28.2" />
      <path d="M8.2 28.2 L3.8 28.2 L3.8 23.8" />
    </g>
    <g fill="hsl(160 82% 84%)" opacity="0.85" filter="url(#blg3-soft)">
      <circle cx="3.8" cy="3.8" r="0.9" />
      <circle cx="28.2" cy="3.8" r="0.9" />
      <circle cx="28.2" cy="28.2" r="0.9" />
      <circle cx="3.8" cy="28.2" r="0.9" />
    </g>
    {/* frosted body */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="url(#blg3-body)" />
    {/* soft frost bloom on top */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="url(#blg3-frost)" />
    {/* soft rim (no glow — diffuse) */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="none" stroke="url(#blg3-rim)" strokeWidth="1.4" strokeLinejoin="round" opacity="0.85" />
    {/* softly glowing bolt */}
    <path d="M18 9.6 L11.4 16.4 L14.8 16.4 L13.7 22.8 L20.6 15.6 L17 15.6 Z" fill="url(#blg3-bolt)" opacity="0.96" filter="url(#blg3-soft)" />
  </svg>
);

// ── 4) Inner-Lit — the bolt is a light SOURCE: a radial bloom behind it lights the
//        dark glass from within, brightest at the core and falling off toward the
//        edges, so the whole diamond glows from inside. Dark rim keeps it contained.
const InnerLit: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      {/* dark glass body */}
      <radialGradient id="blg4-body" cx="50%" cy="50%" r="72%">
        <stop offset="0" stopColor="hsl(232 50% 14% / .72)" />
        <stop offset="100%" stopColor="hsl(246 56% 6% / .95)" />
      </radialGradient>
      {/* inner light bloom from the bolt outward */}
      <radialGradient id="blg4-lit" cx="50%" cy="50%" r="52%">
        <stop offset="0" stopColor="hsl(174 96% 78% / .95)" />
        <stop offset="42%" stopColor="hsl(186 92% 62% / .5)" />
        <stop offset="100%" stopColor="hsl(200 90% 56% / 0)" />
      </radialGradient>
      <linearGradient id="blg4-rim" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <linearGradient id="blg4-frame" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <linearGradient id="blg4-bolt" x1="12" y1="9" x2="20" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(0 0% 100%)" />
        <stop offset="1" stopColor="hsl(166 96% 82%)" />
      </linearGradient>
      <filter id="blg4-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="1" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <clipPath id="blg4-clip">
        <path d="M16 5 L27 16 L16 27 L5 16 Z" />
      </clipPath>
    </defs>
    <path d="M16 2.6 L29.4 16 L16 29.4 L2.6 16 Z" fill="url(#blg4-rim)" opacity="0.12" />
    {/* lock frame */}
    <g stroke="url(#blg4-frame)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#blg4-glow)">
      <path d="M3.8 8.2 L3.8 3.8 L8.2 3.8" />
      <path d="M23.8 3.8 L28.2 3.8 L28.2 8.2" />
      <path d="M28.2 23.8 L28.2 28.2 L23.8 28.2" />
      <path d="M8.2 28.2 L3.8 28.2 L3.8 23.8" />
    </g>
    <g fill="hsl(160 94% 84%)" filter="url(#blg4-glow)">
      <circle cx="3.8" cy="3.8" r="0.95" />
      <circle cx="28.2" cy="3.8" r="0.95" />
      <circle cx="28.2" cy="28.2" r="0.95" />
      <circle cx="3.8" cy="28.2" r="0.95" />
    </g>
    {/* dark glass body */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="url(#blg4-body)" />
    {/* inner light lighting the glass from within (clipped to the diamond) */}
    <g clipPath="url(#blg4-clip)">
      <rect x="4" y="4" width="24" height="24" fill="url(#blg4-lit)" />
    </g>
    {/* neon rim edge */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="none" stroke="url(#blg4-rim)" strokeWidth="1.6" strokeLinejoin="round" filter="url(#blg4-glow)" />
    {/* the light-source bolt */}
    <path d="M18 9.6 L11.4 16.4 L14.8 16.4 L13.7 22.8 L20.6 15.6 L17 15.6 Z" fill="url(#blg4-bolt)" filter="url(#blg4-glow)" />
  </svg>
);

// ── 5) Faceted — cut-gem depth: a diagonal BEVEL line splits the dark glass into
//        two facets catching light differently (one brighter, one deeper), with a
//        crisp neon rim + a bright bevel edge and the knockout bolt across both.
const Faceted: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      {/* upper-left facet: brighter glass */}
      <linearGradient id="blg5-fa" x1="8" y1="8" x2="16" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(210 58% 26% / .74)" />
        <stop offset="1" stopColor="hsl(236 52% 12% / .84)" />
      </linearGradient>
      {/* lower-right facet: deeper glass */}
      <linearGradient id="blg5-fb" x1="16" y1="12" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(240 52% 12% / .82)" />
        <stop offset="1" stopColor="hsl(248 56% 5% / .95)" />
      </linearGradient>
      <linearGradient id="blg5-rim" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 64%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 68%)" />
        <stop offset="1" stopColor="hsl(264 88% 76%)" />
      </linearGradient>
      <linearGradient id="blg5-frame" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 74%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <linearGradient id="blg5-bevel" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(0 0% 100% / .55)" />
        <stop offset="1" stopColor="hsl(188 92% 72% / .2)" />
      </linearGradient>
      <linearGradient id="blg5-bolt" x1="12" y1="9" x2="20" y2="23" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 96% 88%)" />
        <stop offset="1" stopColor="hsl(184 94% 64%)" />
      </linearGradient>
      <filter id="blg5-glow" x="-55%" y="-55%" width="210%" height="210%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <path d="M16 2.6 L29.4 16 L16 29.4 L2.6 16 Z" fill="url(#blg5-rim)" opacity="0.13" />
    {/* lock frame */}
    <g stroke="url(#blg5-frame)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#blg5-glow)">
      <path d="M3.8 8.2 L3.8 3.8 L8.2 3.8" />
      <path d="M23.8 3.8 L28.2 3.8 L28.2 8.2" />
      <path d="M28.2 23.8 L28.2 28.2 L23.8 28.2" />
      <path d="M8.2 28.2 L3.8 28.2 L3.8 23.8" />
    </g>
    <g fill="hsl(150 94% 84%)" filter="url(#blg5-glow)">
      <circle cx="3.8" cy="3.8" r="0.95" />
      <circle cx="28.2" cy="3.8" r="0.95" />
      <circle cx="28.2" cy="28.2" r="0.95" />
      <circle cx="3.8" cy="28.2" r="0.95" />
    </g>
    {/* two facets split by the top-left → bottom-right bevel */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="url(#blg5-fb)" />
    <path d="M16 5 L27 16 L5 16 Z" fill="url(#blg5-fa)" />
    {/* the cut-gem bevel line across the middle */}
    <path d="M5 16 L27 16" stroke="url(#blg5-bevel)" strokeWidth="1" strokeLinecap="round" />
    {/* crisp neon rim */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="none" stroke="url(#blg5-rim)" strokeWidth="1.7" strokeLinejoin="round" filter="url(#blg5-glow)" />
    {/* knockout bolt across both facets */}
    <path d="M18 9.6 L11.4 16.4 L14.8 16.4 L13.7 22.8 L20.6 15.6 L17 15.6 Z" fill="url(#blg5-bolt)" filter="url(#blg5-glow)" />
  </svg>
);

export const LOGOS_BOLTLOCK_GLASS: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Deep Glass", El: DeepGlass },
  { name: "Liquid Glass", El: LiquidGlass },
  { name: "Frosted", El: Frosted },
  { name: "Inner-Lit", El: InnerLit },
  { name: "Faceted", El: Faceted },
];

export default LOGOS_BOLTLOCK_GLASS;
