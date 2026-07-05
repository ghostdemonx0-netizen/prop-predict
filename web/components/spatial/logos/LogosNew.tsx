/**
 * LogosNew.tsx — Fresh logo-mark concepts for the Mock 7 "Spatial Depth" skin.
 *
 * Five GENUINELY DISTINCT brand marks that do NOT repeat the earlier explorations
 * (orb ring, radar sweep, signal peak, target/crosshair, baseball seams, home
 * plate, crossed bats, flight arc, PP monogram, depth stack, orbital, gem):
 *
 *   1) Comet        — a shooting-star trail (the prediction trajectory / edge in motion)
 *   2) Iris Lens    — an eye / lens iris (foresight; ties to the site's "iris" gradient)
 *   3) Compass      — a compass needle pointing the play (direction / conviction)
 *   4) Bolt Diamond — a lightning bolt inside a diamond (edge / spark on the ball field)
 *   5) Neural Node  — a small node network (the model / connected data)
 *
 * Each renders as a self-contained inline SVG at `size` (default 34), viewBox
 * 0 0 32 32, and reads clearly at ~34px on the dark command-bar background.
 *
 * Palette (from spatial.css):
 *   iris-cyan   hsl(188 92% 62%)
 *   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)
 *   iris-mag    hsl(322 86% 68%)
 *
 * IDs are prefixed per-mark (new1-, new2-, new3-, new4-, new5-) so gradients /
 * filters / clips never collide when all five render together on one page.
 */
import React from "react";

// ── 1) Comet — a bright iris head trailing a tapering spark tail, angling up-right
//        like a prediction trajectory arcing toward the edge.
const Comet: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="new1-tail" x1="5" y1="27" x2="23" y2="9" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 70%)" stopOpacity="0" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" stopOpacity="0.65" />
        <stop offset="1" stopColor="hsl(150 84% 64%)" />
      </linearGradient>
      <radialGradient id="new1-head" cx="42%" cy="36%" r="70%">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="45%" stopColor="hsl(180 90% 60%)" />
        <stop offset="100%" stopColor="hsl(255 84% 46%)" />
      </radialGradient>
      <filter id="new1-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient bloom under the flight path */}
    <path d="M6 26 L21 11" stroke="url(#new1-tail)" strokeWidth="7" strokeLinecap="round" opacity="0.14" />
    {/* tapering comet tail */}
    <path
      d="M5.5 26.5 C 11 22, 15 18, 21.5 10.5"
      stroke="url(#new1-tail)"
      strokeWidth="3.4"
      strokeLinecap="round"
      filter="url(#new1-glow)"
    />
    {/* two spark streaks flanking the tail */}
    <path d="M8 22 C 12 20, 14 17, 18 13" stroke="hsl(188 92% 74%)" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
    <path d="M10 25 C 13 23, 15 21, 19 17" stroke="hsl(150 84% 70%)" strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
    {/* comet head */}
    <circle cx="22.5" cy="9.5" r="5.2" fill="url(#new1-head)" filter="url(#new1-glow)" />
    {/* glint */}
    <circle cx="20.9" cy="7.9" r="1.5" fill="hsl(0 0% 100% / .82)" />
  </svg>
);

// ── 2) Iris Lens — a lens iris/eye: an iris-gradient ring, a deep-glass eye,
//        and a bright pupil catch-light. Foresight, and a literal "iris".
const IrisLens: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="new2-ring" x1="4" y1="8" x2="28" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="new2-iris" cx="42%" cy="38%" r="70%">
        <stop offset="0" stopColor="hsl(188 92% 74%)" />
        <stop offset="55%" stopColor="hsl(230 80% 46%)" />
        <stop offset="100%" stopColor="hsl(262 84% 32%)" />
      </radialGradient>
      <radialGradient id="new2-glass" cx="50%" cy="40%" r="72%">
        <stop offset="0" stopColor="hsl(240 40% 16% / .5)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .9)" />
      </radialGradient>
      <filter id="new2-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* almond eye outline (two arcs) in the iris gradient */}
    <path
      d="M2.5 16 C 7 8.5, 25 8.5, 29.5 16 C 25 23.5, 7 23.5, 2.5 16 Z"
      fill="url(#new2-glass)"
      stroke="url(#new2-ring)"
      strokeWidth="2.1"
      strokeLinejoin="round"
      filter="url(#new2-glow)"
    />
    {/* iris disc */}
    <circle cx="16" cy="16" r="6.4" fill="url(#new2-iris)" />
    {/* iris fibre ring */}
    <circle cx="16" cy="16" r="6.4" fill="none" stroke="hsl(188 92% 78% / .5)" strokeWidth="0.8" />
    {/* pupil */}
    <circle cx="16" cy="16" r="2.7" fill="hsl(244 60% 5%)" />
    {/* catch-light */}
    <circle cx="14.3" cy="14.1" r="1.25" fill="hsl(0 0% 100% / .9)" />
  </svg>
);

// ── 3) Compass — a rounded compass rose with a two-tone needle pointing up-right;
//        the "pick a direction / conviction" mark. Iris north tip, glass body.
const Compass: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="new3-rim" x1="5" y1="6" x2="27" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(264 88% 72%)" />
      </linearGradient>
      <linearGradient id="new3-needle" x1="10" y1="22" x2="22" y2="10" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 84% 62%)" />
        <stop offset="1" stopColor="hsl(188 94% 70%)" />
      </linearGradient>
      <radialGradient id="new3-glass" cx="46%" cy="38%" r="70%">
        <stop offset="0" stopColor="hsl(240 40% 15% / .55)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .9)" />
      </radialGradient>
      <filter id="new3-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* bezel bloom */}
    <circle cx="16" cy="16" r="13" fill="url(#new3-rim)" opacity="0.14" />
    {/* glass body + iris rim */}
    <circle cx="16" cy="16" r="12" fill="url(#new3-glass)" stroke="url(#new3-rim)" strokeWidth="2.1" />
    {/* cardinal ticks */}
    <g stroke="hsl(0 0% 100% / .4)" strokeWidth="1.2" strokeLinecap="round">
      <path d="M16 5.4 L16 7.6" />
      <path d="M16 24.4 L16 26.6" />
      <path d="M5.4 16 L7.6 16" />
      <path d="M24.4 16 L26.6 16" />
    </g>
    {/* needle — bright north half (up-right), dim south half */}
    <path d="M22 10 L16.6 16.6 L13.5 13.5 Z" fill="url(#new3-needle)" filter="url(#new3-glow)" />
    <path d="M10 22 L15.4 15.4 L18.5 18.5 Z" fill="hsl(230 30% 70% / .5)" />
    {/* hub */}
    <circle cx="16" cy="16" r="1.9" fill="hsl(244 60% 5%)" stroke="hsl(0 0% 100% / .5)" strokeWidth="0.8" />
  </svg>
);

// ── 4) Bolt Diamond — a lightning bolt cut through a baseball-diamond rhombus;
//        the "edge / spark" mark. Iris-gradient diamond, bright mint-cyan bolt.
const BoltDiamond: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="new4-dia" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.55" stopColor="hsl(210 88% 58%)" />
        <stop offset="1" stopColor="hsl(188 92% 60%)" />
      </linearGradient>
      <linearGradient id="new4-bolt" x1="12" y1="4" x2="20" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 92% 82%)" />
        <stop offset="1" stopColor="hsl(180 92% 60%)" />
      </linearGradient>
      <radialGradient id="new4-glass" cx="50%" cy="40%" r="72%">
        <stop offset="0" stopColor="hsl(240 40% 15% / .5)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .88)" />
      </radialGradient>
      <filter id="new4-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.85" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* diamond bloom */}
    <path d="M16 3 L29 16 L16 29 L3 16 Z" fill="url(#new4-dia)" opacity="0.14" />
    {/* glass diamond + iris edge */}
    <path
      d="M16 4 L28 16 L16 28 L4 16 Z"
      fill="url(#new4-glass)"
      stroke="url(#new4-dia)"
      strokeWidth="2.1"
      strokeLinejoin="round"
    />
    {/* lightning bolt */}
    <path
      d="M18.6 7.5 L10.5 17 L15 17 L13.4 24.5 L21.5 15 L17 15 Z"
      fill="url(#new4-bolt)"
      filter="url(#new4-glow)"
    />
  </svg>
);

// ── 5) Neural Node — a compact node network (input nodes → hub → output), the
//        "model / connected data" mark. Iris-gradient links, glowing nodes.
const NeuralNode: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="new5-link" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="new5-hub" cx="42%" cy="36%" r="72%">
        <stop offset="0" stopColor="hsl(188 92% 82%)" />
        <stop offset="50%" stopColor="hsl(196 90% 58%)" />
        <stop offset="100%" stopColor="hsl(255 82% 44%)" />
      </radialGradient>
      <radialGradient id="new5-node" cx="42%" cy="38%" r="72%">
        <stop offset="0" stopColor="hsl(150 90% 82%)" />
        <stop offset="100%" stopColor="hsl(168 84% 48%)" />
      </radialGradient>
      <filter id="new5-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.75" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* links from the three left inputs → hub → output */}
    <g stroke="url(#new5-link)" strokeWidth="1.6" strokeLinecap="round">
      <path d="M6.5 7 L16 15.5" />
      <path d="M5.5 16 L16 15.5" />
      <path d="M6.5 25 L16 16.5" />
      <path d="M16 16 L26 22" />
      <path d="M16 15.5 L26 9.5" opacity="0.85" />
    </g>
    {/* input nodes (left) */}
    <circle cx="6.5" cy="7" r="2.5" fill="url(#new5-node)" />
    <circle cx="5.5" cy="16" r="2.5" fill="url(#new5-node)" />
    <circle cx="6.5" cy="25" r="2.5" fill="url(#new5-node)" />
    {/* output nodes (right) */}
    <circle cx="26" cy="9.5" r="2.4" fill="hsl(264 82% 66%)" />
    <circle cx="26" cy="22" r="2.4" fill="hsl(322 84% 66%)" />
    {/* central hub */}
    <circle cx="16" cy="16" r="4.6" fill="url(#new5-hub)" filter="url(#new5-glow)" />
    <circle cx="14.5" cy="14.4" r="1.2" fill="hsl(0 0% 100% / .82)" />
  </svg>
);

export const LOGOS_NEW: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Comet Trail", El: Comet },
  { name: "Iris Lens", El: IrisLens },
  { name: "Compass Needle", El: Compass },
  { name: "Bolt Diamond", El: BoltDiamond },
  { name: "Neural Node", El: NeuralNode },
];

export default LOGOS_NEW;
