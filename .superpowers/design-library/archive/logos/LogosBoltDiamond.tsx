/**
 * LogosBoltDiamond.tsx — Logo-mark options in the "Bolt Diamond" family.
 *
 * Five GENUINELY DISTINCT variations on the well-liked "Bolt Diamond" mark from
 * LogosNew.tsx (a lightning bolt inside a diamond — edge / spark on the ball
 * field). Tuned to the Mock 7 "Spatial Depth" skin: the iris gradient (violet →
 * cyan → mint), a soft neon glow, and dark-glass cores. One mark FUSES the
 * bolt-diamond with the "Precision" crosshair/target language (LogosSignal.tsx +
 * LogosPrecision.tsx). Each renders as a self-contained inline SVG at `size`
 * (default 34), viewBox 0 0 32 32, and reads crisply at ~34px on the dark
 * command-bar background beside the gradient wordmark.
 *
 *   1) Bolt Diamond  — refined, polished bolt-in-diamond (iris edge, glass core)
 *   2) Neon Outline  — bolt in a thin neon-outlined glassy diamond (glowing edge)
 *   3) Ballpark Bolt — bolt inside a home-plate / ballpark-diamond shape (MLB tie)
 *   4) Bolt Lock ★   — bolt-diamond FRAMED by a crosshair + corner-bracket lock
 *                      (the Bolt Diamond × Precision mix)
 *   5) Twin Bolt     — a gradient-filled diamond with a knockout bolt forming the
 *                      diagonal, mirrored by a faint second bolt
 *
 * Palette (from spatial.css):
 *   iris-cyan   hsl(188 92% 62%)
 *   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)
 *   iris-mag    hsl(322 86% 68%)
 *
 * IDs are prefixed per-mark (bld1-, bld2-, bld3-, bld4-, bld5-) so gradients/
 * filters/clips never collide when all five render together in a picker.
 */
import React from "react";

// ── 1) Bolt Diamond — a refined, polished take on the original: a glass diamond
//        with a bright iris edge, an inner facet line for depth, and a cleaner,
//        centered mint-cyan lightning bolt with a soft glow.
const BoltDiamond: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bld1-dia" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.55" stopColor="hsl(206 88% 58%)" />
        <stop offset="1" stopColor="hsl(188 92% 62%)" />
      </linearGradient>
      <linearGradient id="bld1-bolt" x1="12" y1="5" x2="20" y2="27" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="1" stopColor="hsl(180 92% 60%)" />
      </linearGradient>
      <radialGradient id="bld1-glass" cx="50%" cy="38%" r="72%">
        <stop offset="0" stopColor="hsl(240 42% 17% / .55)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .9)" />
      </radialGradient>
      <filter id="bld1-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient diamond bloom */}
    <path d="M16 2.6 L29.4 16 L16 29.4 L2.6 16 Z" fill="url(#bld1-dia)" opacity="0.14" />
    {/* glass diamond + iris edge */}
    <path
      d="M16 4 L28 16 L16 28 L4 16 Z"
      fill="url(#bld1-glass)"
      stroke="url(#bld1-dia)"
      strokeWidth="2.2"
      strokeLinejoin="round"
      filter="url(#bld1-glow)"
    />
    {/* inner facet line for glass depth */}
    <path d="M16 7.4 L24.6 16 L16 24.6 L7.4 16 Z" fill="none" stroke="hsl(0 0% 100% / .12)" strokeWidth="0.9" strokeLinejoin="round" />
    {/* centered lightning bolt */}
    <path
      d="M18.4 8 L10.8 16.6 L15 16.6 L13.6 24 L21.2 15.4 L17 15.4 Z"
      fill="url(#bld1-bolt)"
      filter="url(#bld1-glow)"
    />
  </svg>
);

// ── 2) Neon Outline — a thin, glowing neon-outlined diamond (no heavy fill), the
//        glassiest of the set: double-stroke edge, faint glass wash, and a
//        stroked (outline) bolt so the whole mark reads as lit neon linework.
const NeonOutline: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bld2-edge" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <linearGradient id="bld2-bolt" x1="12" y1="6" x2="20" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="1" stopColor="hsl(186 94% 66%)" />
      </linearGradient>
      <filter id="bld2-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="1.05" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* faint glass wash inside the outline */}
    <path d="M16 4.5 L27.5 16 L16 27.5 L4.5 16 Z" fill="hsl(230 50% 60% / .07)" />
    {/* soft outer neon halo of the diamond */}
    <path d="M16 3.4 L28.6 16 L16 28.6 L3.4 16 Z" fill="none" stroke="url(#bld2-edge)" strokeWidth="1" strokeLinejoin="round" opacity="0.4" filter="url(#bld2-glow)" />
    {/* crisp neon-outlined diamond */}
    <path
      d="M16 4.5 L27.5 16 L16 27.5 L4.5 16 Z"
      fill="none"
      stroke="url(#bld2-edge)"
      strokeWidth="1.9"
      strokeLinejoin="round"
      filter="url(#bld2-glow)"
    />
    {/* outlined (knockout-feel) neon bolt */}
    <path
      d="M18.4 8.4 L11 16.4 L15.1 16.4 L13.7 23.6 L21 15.6 L16.9 15.6 Z"
      fill="hsl(188 60% 60% / .12)"
      stroke="url(#bld2-bolt)"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      filter="url(#bld2-glow)"
    />
  </svg>
);

// ── 3) Ballpark Bolt — the bolt seated inside a home-plate / ballpark-diamond
//        shape (pentagon home plate rotated to a field diamond), tying the mark
//        to MLB. Iris edge, dark-glass infield, mint-cyan bolt, faint base pips.
const BallparkBolt: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bld3-plate" x1="6" y1="5" x2="26" y2="27" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.5" stopColor="hsl(196 90% 60%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <linearGradient id="bld3-bolt" x1="12" y1="6" x2="20" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="1" stopColor="hsl(180 92% 60%)" />
      </linearGradient>
      <radialGradient id="bld3-glass" cx="50%" cy="40%" r="72%">
        <stop offset="0" stopColor="hsl(240 42% 17% / .55)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .9)" />
      </radialGradient>
      <filter id="bld3-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* home-plate / ballpark diamond: flat top shoulders down to a point (apex) */}
    {/* bloom */}
    <path d="M7 5.4 L25 5.4 L25 15 L16 29 L7 15 Z" fill="url(#bld3-plate)" opacity="0.13" />
    {/* glass plate + iris edge */}
    <path
      d="M7.5 6 L24.5 6 L24.5 15 L16 27.6 L7.5 15 Z"
      fill="url(#bld3-glass)"
      stroke="url(#bld3-plate)"
      strokeWidth="2.1"
      strokeLinejoin="round"
      filter="url(#bld3-glow)"
    />
    {/* faint base pips at the three infield corners */}
    <g fill="hsl(0 0% 100% / .32)">
      <rect x="8.7" y="7.2" width="1.7" height="1.7" rx="0.4" transform="rotate(45 9.55 8.05)" />
      <rect x="21.6" y="7.2" width="1.7" height="1.7" rx="0.4" transform="rotate(45 22.45 8.05)" />
    </g>
    {/* lightning bolt seated in the plate */}
    <path
      d="M18.3 8.4 L11 16.2 L15 16.2 L13.7 23.2 L21 15.2 L17 15.2 Z"
      fill="url(#bld3-bolt)"
      filter="url(#bld3-glow)"
    />
  </svg>
);

// ── 4) Bolt Lock ★ — the Bolt Diamond × Precision MIX: the glass bolt-diamond is
//        FRAMED by crosshair arms extending from its four points AND locked by
//        four L-shaped corner brackets — a "target acquired" bolt. Iris ring
//        language fused with the spark.
const BoltLock: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bld4-dia" x1="7" y1="7" x2="25" y2="25" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.55" stopColor="hsl(206 88% 58%)" />
        <stop offset="1" stopColor="hsl(188 92% 62%)" />
      </linearGradient>
      <linearGradient id="bld4-frame" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
      <linearGradient id="bld4-bolt" x1="12" y1="8" x2="20" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="1" stopColor="hsl(180 92% 60%)" />
      </linearGradient>
      <radialGradient id="bld4-glass" cx="50%" cy="40%" r="72%">
        <stop offset="0" stopColor="hsl(240 42% 17% / .5)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .9)" />
      </radialGradient>
      <filter id="bld4-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.75" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* crosshair arms extending from the diamond's four points to the edge */}
    <g stroke="url(#bld4-frame)" strokeWidth="1.7" strokeLinecap="round" filter="url(#bld4-glow)">
      <path d="M16 1.8 L16 6.4" />
      <path d="M16 25.6 L16 30.2" />
      <path d="M1.8 16 L6.4 16" />
      <path d="M25.6 16 L30.2 16" />
    </g>
    {/* four L-shaped corner lock brackets */}
    <g stroke="hsl(188 92% 68%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9">
      <path d="M3.4 8 L3.4 3.4 L8 3.4" />
      <path d="M24 3.4 L28.6 3.4 L28.6 8" />
      <path d="M28.6 24 L28.6 28.6 L24 28.6" />
      <path d="M8 28.6 L3.4 28.6 L3.4 24" />
    </g>
    {/* glass bolt-diamond core */}
    <path
      d="M16 6.4 L25.6 16 L16 25.6 L6.4 16 Z"
      fill="url(#bld4-glass)"
      stroke="url(#bld4-dia)"
      strokeWidth="2"
      strokeLinejoin="round"
      filter="url(#bld4-glow)"
    />
    {/* lightning bolt */}
    <path
      d="M18 9.6 L11.6 16.4 L15 16.4 L13.9 22.4 L20.4 15.6 L17 15.6 Z"
      fill="url(#bld4-bolt)"
      filter="url(#bld4-glow)"
    />
  </svg>
);

// ── 5) Twin Bolt — a fully iris-gradient-FILLED diamond with a knockout bolt cut
//        out of it (the bolt = the diamond's own diagonal light), shadowed by a
//        faint mirrored second bolt. The boldest, most solid mark of the set.
const TwinBolt: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="bld5-fill" x1="5" y1="6" x2="27" y2="27" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 66%)" />
        <stop offset="0.5" stopColor="hsl(206 88% 56%)" />
        <stop offset="1" stopColor="hsl(160 84% 54%)" />
      </linearGradient>
      <linearGradient id="bld5-edge" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 88% 70%)" />
        <stop offset="1" stopColor="hsl(264 90% 80%)" />
      </linearGradient>
      <filter id="bld5-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* knockout: fill the diamond, punch the bolt out via even-odd */}
      <clipPath id="bld5-dia">
        <path d="M16 4 L28 16 L16 28 L4 16 Z" />
      </clipPath>
    </defs>
    {/* ambient bloom */}
    <path d="M16 2.6 L29.4 16 L16 29.4 L2.6 16 Z" fill="url(#bld5-fill)" opacity="0.16" />
    {/* solid gradient-filled diamond with a bolt knocked out (even-odd rule) */}
    <path
      d="M16 4 L28 16 L16 28 L4 16 Z
         M18.6 8 L10.4 17.2 L14.8 17.2 L13.2 24.4 L21.6 15 L16.9 15 Z"
      fill="url(#bld5-fill)"
      fillRule="evenodd"
      filter="url(#bld5-glow)"
    />
    {/* faint mirrored twin bolt inside, for depth */}
    <g clipPath="url(#bld5-dia)">
      <path d="M13.4 8 L21.6 17.2 L17.2 17.2 L18.8 24.4 L10.4 15 L15.1 15 Z" fill="hsl(0 0% 100% / .1)" />
    </g>
    {/* crisp bright edge */}
    <path d="M16 4 L28 16 L16 28 L4 16 Z" fill="none" stroke="url(#bld5-edge)" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export const LOGOS_BOLTDIAMOND: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Bolt Diamond", El: BoltDiamond },
  { name: "Neon Outline", El: NeonOutline },
  { name: "Ballpark Bolt", El: BallparkBolt },
  { name: "Bolt Lock", El: BoltLock },
  { name: "Twin Bolt", El: TwinBolt },
];

export default LOGOS_BOLTDIAMOND;
