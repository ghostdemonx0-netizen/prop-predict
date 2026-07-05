/**
 * LogosBoltLockA.tsx — Refined "Bolt Lock" marks (clean / minimal / premium).
 *
 * Four IMPROVED takes on the well-liked "Bolt Lock" mark (a lightning bolt inside
 * a diamond, framed by a precision crosshair + corner-bracket lock). These keep
 * the CORE IDEA but push toward restraint, optical balance, and legibility at the
 * ~34px command-bar size, on the Mock 7 "Spatial Depth" skin (iris gradient
 * violet → cyan → mint, soft neon glow, dark-glass core).
 *
 *   A1) Bolt Lock Minimal   — bolt-diamond + subtle corner brackets, max restraint
 *   A2) Bolt Lock Crosshair — crosshair arms emerge cleanly from the 4 diamond pts
 *   A3) Bolt Lock Balanced  — refined bolt weight / diamond proportion; reads tiny
 *   A4) Bolt Lock Mono      — single cyan→mint, no violet, ultra-clean linework
 *
 * Palette (from spatial.css):
 *   iris-cyan   hsl(188 92% 62%)   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)   iris-mag    hsl(322 86% 68%)
 *
 * IDs are prefixed per-mark (bla1-, bla2-, bla3-, bla4-) so gradients/filters/
 * clips never collide when all four render together in a picker.
 */
import React from "react";

// ── A1) Bolt Lock Minimal — the quietest of the set: a clean glass diamond with a
//        single iris edge and a centered bolt, "locked" by four small, low-key
//        corner ticks. No crosshair arms, no facet clutter — pure restraint.
const BoltLockMinimal: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bla1-dia" x1="7" y1="7" x2="25" y2="25" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.55" stopColor="hsl(206 88% 58%)" />
        <stop offset="1" stopColor="hsl(188 92% 62%)" />
      </linearGradient>
      <linearGradient id="bla1-bolt" x1="13" y1="8" x2="19" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="1" stopColor="hsl(180 92% 62%)" />
      </linearGradient>
      <radialGradient id="bla1-glass" cx="50%" cy="40%" r="72%">
        <stop offset="0" stopColor="hsl(240 42% 17% / .5)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .9)" />
      </radialGradient>
      <filter id="bla1-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* four minimal corner ticks — a whisper of the "lock" frame */}
    <g stroke="hsl(188 92% 66% / .8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M4 6.6 L4 4 L6.6 4" />
      <path d="M25.4 4 L28 4 L28 6.6" />
      <path d="M28 25.4 L28 28 L25.4 28" />
      <path d="M6.6 28 L4 28 L4 25.4" />
    </g>
    {/* glass diamond + single iris edge */}
    <path
      d="M16 5.4 L26.6 16 L16 26.6 L5.4 16 Z"
      fill="url(#bla1-glass)"
      stroke="url(#bla1-dia)"
      strokeWidth="2"
      strokeLinejoin="round"
      filter="url(#bla1-glow)"
    />
    {/* centered lightning bolt */}
    <path
      d="M17.9 9.2 L11.6 16.6 L15.1 16.6 L14 22.8 L20.4 15.4 L16.9 15.4 Z"
      fill="url(#bla1-bolt)"
      filter="url(#bla1-glow)"
    />
  </svg>
);

// ── A2) Bolt Lock Crosshair — the crosshair reading, cleaned up: four gradient
//        arms grow straight out of the diamond's four points to the edge (no
//        corner brackets competing for attention). Aim + spark, nothing else.
const BoltLockCrosshair: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bla2-dia" x1="7" y1="7" x2="25" y2="25" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.55" stopColor="hsl(206 88% 58%)" />
        <stop offset="1" stopColor="hsl(188 92% 62%)" />
      </linearGradient>
      <linearGradient id="bla2-arms" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <linearGradient id="bla2-bolt" x1="13" y1="8" x2="19" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="1" stopColor="hsl(180 92% 62%)" />
      </linearGradient>
      <radialGradient id="bla2-glass" cx="50%" cy="40%" r="72%">
        <stop offset="0" stopColor="hsl(240 42% 17% / .5)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .9)" />
      </radialGradient>
      <filter id="bla2-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* crosshair arms emerging cleanly from the diamond's four points */}
    <g stroke="url(#bla2-arms)" strokeWidth="1.9" strokeLinecap="round" filter="url(#bla2-glow)">
      <path d="M16 2.2 L16 6" />
      <path d="M16 26 L16 29.8" />
      <path d="M2.2 16 L6 16" />
      <path d="M26 16 L29.8 16" />
    </g>
    {/* glass diamond core */}
    <path
      d="M16 6 L26 16 L16 26 L6 16 Z"
      fill="url(#bla2-glass)"
      stroke="url(#bla2-dia)"
      strokeWidth="2"
      strokeLinejoin="round"
      filter="url(#bla2-glow)"
    />
    {/* centered lightning bolt */}
    <path
      d="M17.9 9.6 L11.8 16.6 L15.2 16.6 L14.1 22.6 L20.2 15.6 L16.8 15.6 Z"
      fill="url(#bla2-bolt)"
      filter="url(#bla2-glow)"
    />
  </svg>
);

// ── A3) Bolt Lock Balanced — the "hero" refinement: optically tuned diamond
//        proportion + a slightly heftier, better-centered bolt so the mark reads
//        instantly at tiny sizes. Corner brackets kept but pulled tight & even.
const BoltLockBalanced: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bla3-dia" x1="6.5" y1="6.5" x2="25.5" y2="25.5" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.55" stopColor="hsl(200 88% 58%)" />
        <stop offset="1" stopColor="hsl(188 92% 62%)" />
      </linearGradient>
      <linearGradient id="bla3-bolt" x1="13" y1="8" x2="19" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 86%)" />
        <stop offset="1" stopColor="hsl(178 92% 60%)" />
      </linearGradient>
      <radialGradient id="bla3-glass" cx="50%" cy="38%" r="74%">
        <stop offset="0" stopColor="hsl(240 42% 18% / .55)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .92)" />
      </radialGradient>
      <filter id="bla3-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.72" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* tight, even corner-lock brackets */}
    <g stroke="hsl(188 92% 68%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.92">
      <path d="M4 7.4 L4 4 L7.4 4" />
      <path d="M24.6 4 L28 4 L28 7.4" />
      <path d="M28 24.6 L28 28 L24.6 28" />
      <path d="M7.4 28 L4 28 L4 24.6" />
    </g>
    {/* diamond bloom for depth */}
    <path d="M16 5.2 L26.8 16 L16 26.8 L5.2 16 Z" fill="url(#bla3-dia)" opacity="0.12" />
    {/* optically-tuned glass diamond */}
    <path
      d="M16 5.8 L26.2 16 L16 26.2 L5.8 16 Z"
      fill="url(#bla3-glass)"
      stroke="url(#bla3-dia)"
      strokeWidth="2.1"
      strokeLinejoin="round"
      filter="url(#bla3-glow)"
    />
    {/* heftier, well-centered bolt — reads at a glance */}
    <path
      d="M18.1 8.8 L11.2 16.7 L15 16.7 L13.9 23.2 L20.8 15.3 L17 15.3 Z"
      fill="url(#bla3-bolt)"
      filter="url(#bla3-glow)"
    />
  </svg>
);

// ── A4) Bolt Lock Mono — single-hue, no violet, no gradient shift: one clean
//        cyan→mint neon on dark glass. The most minimal / brand-safe variant,
//        crosshair arms + a thin diamond outline + a stroked bolt as pure linework.
const BoltLockMono: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bla4-neon" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="1" stopColor="hsl(188 92% 64%)" />
      </linearGradient>
      <filter id="bla4-glow" x="-55%" y="-55%" width="210%" height="210%">
        <feGaussianBlur stdDeviation="0.85" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* faint dark-glass diamond fill for grounding */}
    <path d="M16 6 L26 16 L16 26 L6 16 Z" fill="hsl(244 46% 8% / .5)" />
    {/* crosshair arms — single neon */}
    <g stroke="url(#bla4-neon)" strokeWidth="1.7" strokeLinecap="round" filter="url(#bla4-glow)">
      <path d="M16 2.4 L16 6" />
      <path d="M16 26 L16 29.6" />
      <path d="M2.4 16 L6 16" />
      <path d="M26 16 L29.6 16" />
    </g>
    {/* thin neon diamond outline */}
    <path
      d="M16 6 L26 16 L16 26 L6 16 Z"
      fill="none"
      stroke="url(#bla4-neon)"
      strokeWidth="1.8"
      strokeLinejoin="round"
      filter="url(#bla4-glow)"
    />
    {/* stroked (linework) lightning bolt — no fill, all outline */}
    <path
      d="M17.9 9.8 L12 16.5 L15.2 16.5 L14.1 22.4 L20 15.7 L16.8 15.7 Z"
      fill="hsl(170 80% 60% / .1)"
      stroke="url(#bla4-neon)"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      filter="url(#bla4-glow)"
    />
  </svg>
);

export const LOGOS_BOLTLOCK_A: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Bolt Lock Minimal", El: BoltLockMinimal },
  { name: "Bolt Lock Crosshair", El: BoltLockCrosshair },
  { name: "Bolt Lock Balanced", El: BoltLockBalanced },
  { name: "Bolt Lock Mono", El: BoltLockMono },
];

export default LOGOS_BOLTLOCK_A;
