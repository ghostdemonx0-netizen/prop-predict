/**
 * LogosFrostB.tsx — "Frosted" mark, INVERTED-L BRACKET EVOLUTIONS (5 marks).
 *
 * The winning "Frosted" logo (LogosBoltLockGlass.tsx #3) is a soft matte
 * translucent glass DIAMOND — an iris-gradient rim + gentle diffuse glow, a
 * BLACK bolt with a hairline light edge, a top glass glint — locked by four
 * INVERTED corner brackets (L-shaped, elbows pointing INWARD, with small lit
 * dots). These five keep that frosted diamond + black bolt as the HERO and put
 * all the creativity into the corner-bracket / framing treatment:
 *
 *   1) Extended Arms  — long, elegant L arms reaching toward the edge midpoints
 *   2) Connected Frame— brackets extend + connect into a near-complete rounded
 *                       frame with small gaps at the diamond's four points
 *   3) Crosshair Lock — inverted corner L's PLUS crosshair ticks reaching in
 *                       toward the diamond's 4 points (lock + crosshair fused)
 *   4) Hooked         — the L tips curl into hooks/chevrons for a motion feel
 *   5) Double Bracket — twin thin inner + outer L at each corner, refined layers
 *
 * Palette (from spatial.css):
 *   iris-cyan hsl(188 92% 62%) · iris-violet hsl(264 88% 70%)
 *   iris-mint hsl(150 82% 60%) · iris-mag hsl(322 86% 68%)
 *
 * Every gradient/filter id is prefixed per-mark (frb1-, frb2-, frb3-, frb4-,
 * frb5-) so they never collide when several logos render on one page. Legible
 * + balanced at 34px on the dark command bar. No imports beyond React.
 */
import React from "react";

/* ── Shared frosted-diamond + black-bolt core ───────────────────────────────
 * Renders the full 32×32 SVG: prefixed defs, ambient bloom, the mark-specific
 * `brackets`/`dots` (drawn BEHIND the glass so the diamond reads on top), then
 * the frosted body, frost bloom, specular glint, soft rim and the black bolt.
 * `p` is the per-mark id prefix; every gradient/filter id below is derived from
 * it so no ids ever collide across marks. */
const Core: React.FC<{
  p: string;
  size: number;
  brackets: React.ReactNode;
  dots?: React.ReactNode;
}> = ({ p, size, brackets, dots }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      {/* frosted matte translucent body */}
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
      {/* iris bracket/frame gradient */}
      <linearGradient id={`${p}-frame`} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 78% 78%)" />
        <stop offset="0.5" stopColor="hsl(188 82% 72%)" />
        <stop offset="1" stopColor="hsl(150 74% 68%)" />
      </linearGradient>
      {/* soft frost highlight bloom */}
      <radialGradient id={`${p}-frost`} cx="50%" cy="28%" r="66%">
        <stop offset="0" stopColor="hsl(0 0% 100% / .28)" />
        <stop offset="70%" stopColor="hsl(0 0% 100% / 0)" />
      </radialGradient>
      {/* wide, soft diffuse glow */}
      <filter id={`${p}-soft`} x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="1.4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* ambient bloom */}
    <path d="M16 2.6 L29.4 16 L16 29.4 L2.6 16 Z" fill={`url(#${p}-rim)`} opacity="0.1" />

    {/* mark-specific framing (behind the glass) */}
    {brackets}
    {dots}

    {/* frosted body */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill={`url(#${p}-body)`} />
    {/* soft frost bloom on top */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill={`url(#${p}-frost)`} />
    {/* specular glint along the top-left facet — sells the glass depth */}
    <path d="M15 6 L7.2 13.8" stroke="hsl(0 0% 100% / .6)" strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
    {/* soft rim (diffuse, no glow) */}
    <path d="M16 5 L27 16 L16 27 L5 16 Z" fill="none" stroke={`url(#${p}-rim)`} strokeWidth="1.4" strokeLinejoin="round" opacity="0.85" />
    {/* black bolt with a hairline light edge — reads as etched into the glass */}
    <path
      d="M18 9.6 L11.4 16.4 L14.8 16.4 L13.7 22.8 L20.6 15.6 L17 15.6 Z"
      fill="hsl(232 32% 6%)"
      stroke="hsl(188 64% 82% / .5)"
      strokeWidth="0.5"
      strokeLinejoin="round"
      transform="translate(16 16) scale(0.84) translate(-16 -16)"
    />
  </svg>
);

// ── 1) Extended Arms — the inverted-L corners open up into long, elegant arms
//        that sweep along the edges toward the four midpoints, framing the
//        diamond in a slim elongated lock. Lit dots anchor the outer elbows.
const ExtendedArms: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <Core
    p="frb1"
    size={size}
    brackets={
      <g
        stroke="url(#frb1-frame)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.92"
        filter="url(#frb1-soft)"
      >
        <path d="M4 15 L4 5.6 Q4 4 5.6 4 L15 4" />
        <path d="M17 4 L26.4 4 Q28 4 28 5.6 L28 15" />
        <path d="M28 17 L28 26.4 Q28 28 26.4 28 L17 28" />
        <path d="M15 28 L5.6 28 Q4 28 4 26.4 L4 17" />
      </g>
    }
    dots={
      <g fill="hsl(160 82% 84%)" opacity="0.85" filter="url(#frb1-soft)">
        <circle cx="4" cy="4" r="0.9" />
        <circle cx="28" cy="4" r="0.9" />
        <circle cx="28" cy="28" r="0.9" />
        <circle cx="4" cy="28" r="0.9" />
      </g>
    }
  />
);

// ── 2) Connected Frame — the arms grow until they almost meet: a near-complete
//        rounded-square frame broken by four small gaps right where the diamond's
//        points poke through. Tiny lit dots stud every arm tip.
const ConnectedFrame: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <Core
    p="frb2"
    size={size}
    brackets={
      <g
        stroke="url(#frb2-frame)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.9"
        filter="url(#frb2-soft)"
      >
        <path d="M4 13.4 L4 6 Q4 4 6 4 L13.4 4" />
        <path d="M18.6 4 L26 4 Q28 4 28 6 L28 13.4" />
        <path d="M28 18.6 L28 26 Q28 28 26 28 L18.6 28" />
        <path d="M13.4 28 L6 28 Q4 28 4 26 L4 18.6" />
      </g>
    }
    dots={
      <g fill="hsl(160 82% 84%)" opacity="0.8" filter="url(#frb2-soft)">
        <circle cx="13.4" cy="4" r="0.62" />
        <circle cx="18.6" cy="4" r="0.62" />
        <circle cx="28" cy="13.4" r="0.62" />
        <circle cx="28" cy="18.6" r="0.62" />
        <circle cx="18.6" cy="28" r="0.62" />
        <circle cx="13.4" cy="28" r="0.62" />
        <circle cx="4" cy="18.6" r="0.62" />
        <circle cx="4" cy="13.4" r="0.62" />
      </g>
    }
  />
);

// ── 3) Crosshair Lock — the original inverted corner L's (elbows pointing IN)
//        stay, but four crosshair ticks reach inward toward the diamond's points,
//        fusing the lock with a precision-crosshair read. Lit dots at the tips.
const CrosshairLock: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <Core
    p="frb3"
    size={size}
    brackets={
      <>
        {/* inverted corner L's — elbows point inward toward the mark */}
        <g
          stroke="url(#frb3-frame)"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.92"
          filter="url(#frb3-soft)"
        >
          <path d="M8.2 3.8 L8.2 8.2 L3.8 8.2" />
          <path d="M23.8 3.8 L23.8 8.2 L28.2 8.2" />
          <path d="M23.8 28.2 L23.8 23.8 L28.2 23.8" />
          <path d="M8.2 28.2 L8.2 23.8 L3.8 23.8" />
        </g>
        {/* crosshair ticks reaching inward toward the four diamond points */}
        <g
          stroke="url(#frb3-frame)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
          filter="url(#frb3-soft)"
        >
          <path d="M16 1.4 L16 3.6" />
          <path d="M30.6 16 L28.4 16" />
          <path d="M16 30.6 L16 28.4" />
          <path d="M1.4 16 L3.6 16" />
        </g>
      </>
    }
    dots={
      <g fill="hsl(160 82% 84%)" opacity="0.85" filter="url(#frb3-soft)">
        <circle cx="16" cy="1.4" r="0.72" />
        <circle cx="30.6" cy="16" r="0.72" />
        <circle cx="16" cy="30.6" r="0.72" />
        <circle cx="1.4" cy="16" r="0.72" />
      </g>
    }
  />
);

// ── 4) Hooked — each corner L curls at its tip into a small hook, all sweeping
//        the same rotational direction so the frame feels like it's in motion
//        around the diamond. Lit dots ride the hook tips.
const Hooked: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <Core
    p="frb4"
    size={size}
    brackets={
      <g
        stroke="url(#frb4-frame)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.92"
        filter="url(#frb4-soft)"
      >
        <path d="M5 13 L5 6 Q5 5 6 5 L12 5 Q14.4 5 13.8 7.4" />
        <path d="M19 5 L26 5 Q27 5 27 6 L27 12 Q27 14.4 24.6 13.8" />
        <path d="M27 19 L27 26 Q27 27 26 27 L20 27 Q17.6 27 18.2 24.6" />
        <path d="M13 27 L6 27 Q5 27 5 26 L5 20 Q5 17.6 7.4 18.2" />
      </g>
    }
    dots={
      <g fill="hsl(160 82% 84%)" opacity="0.85" filter="url(#frb4-soft)">
        <circle cx="13.8" cy="7.4" r="0.82" />
        <circle cx="24.6" cy="13.8" r="0.82" />
        <circle cx="18.2" cy="24.6" r="0.82" />
        <circle cx="7.4" cy="18.2" r="0.82" />
      </g>
    }
  />
);

// ── 5) Double Bracket — twin thin L's at every corner (an outer + a smaller
//        inner bracket) for a refined, layered lock. Hairline strokes keep it
//        precise; lit dots sit on the outer elbows.
const DoubleBracket: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <Core
    p="frb5"
    size={size}
    brackets={
      <>
        {/* outer L's */}
        <g
          stroke="url(#frb5-frame)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.92"
          filter="url(#frb5-soft)"
        >
          <path d="M4.4 12 L4.4 4.4 L12 4.4" />
          <path d="M20 4.4 L27.6 4.4 L27.6 12" />
          <path d="M27.6 20 L27.6 27.6 L20 27.6" />
          <path d="M12 27.6 L4.4 27.6 L4.4 20" />
        </g>
        {/* inner L's */}
        <g
          stroke="url(#frb5-frame)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.66"
        >
          <path d="M10.2 7.4 L10.2 10.2 L7.4 10.2" />
          <path d="M21.8 7.4 L21.8 10.2 L24.6 10.2" />
          <path d="M21.8 24.6 L21.8 21.8 L24.6 21.8" />
          <path d="M10.2 24.6 L10.2 21.8 L7.4 21.8" />
        </g>
      </>
    }
    dots={
      <g fill="hsl(160 82% 84%)" opacity="0.85" filter="url(#frb5-soft)">
        <circle cx="4.4" cy="4.4" r="0.85" />
        <circle cx="27.6" cy="4.4" r="0.85" />
        <circle cx="27.6" cy="27.6" r="0.85" />
        <circle cx="4.4" cy="27.6" r="0.85" />
      </g>
    }
  />
);

export const LOGOS_FROST_B: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Extended Arms", El: ExtendedArms },
  { name: "Connected Frame", El: ConnectedFrame },
  { name: "Crosshair Lock", El: CrosshairLock },
  { name: "Hooked", El: Hooked },
  { name: "Double Bracket", El: DoubleBracket },
];

export default LOGOS_FROST_B;
