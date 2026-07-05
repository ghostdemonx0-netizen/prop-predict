/**
 * LogosNew2.tsx — Round 2 of fresh logo-mark concepts for the Mock 7
 * "Spatial Depth" skin.
 *
 * Five GENUINELY NEW brand marks that do NOT repeat ANY earlier exploration
 * (orb ring, radar sweep, signal peak, target/crosshair, baseball seams, home
 * plate, crossed bats, flight arc, PP monogram, depth stack, orbital, gem,
 * crosshair, bullseye, reticle, lock-on, seam target, comet trail, iris lens,
 * compass needle, bolt diamond, neural node):
 *
 *   1) Prism Split — a beam refracting through a prism into an iris spectrum
 *                    (turning raw data into a read-out edge)
 *   2) Edge Delta  — an upward delta/triangle with a rising spark at its apex
 *                    (the model's edge, trending up)
 *   3) Seam Rocket — a baseball-seam curve sweeping up into an arrowhead
 *                    (baseball + upward momentum in one stroke)
 *   4) Odds Die    — a glowing glass die showing a five, dots in iris hues
 *                    (odds / probability)
 *   5) Pulse Peak  — a heartbeat/pulse line spiking to a bright peak node
 *                    (live signal finding its edge)
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
 * IDs are prefixed per-mark (nw2a-, nw2b-, nw2c-, nw2d-, nw2e-) so gradients /
 * filters / clips never collide when all five render together on one page.
 */
import React from "react";

// ── 1) Prism Split — a single white beam strikes a glass prism and fans out
//        into a violet→cyan→mint spectrum: raw input refracted into an edge.
const PrismSplit: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="nw2a-glass" x1="10" y1="6" x2="20" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(240 40% 18% / .6)" />
        <stop offset="1" stopColor="hsl(244 46% 6% / .9)" />
      </linearGradient>
      <linearGradient id="nw2a-edge" x1="9" y1="6" x2="18" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="1" stopColor="hsl(188 92% 64%)" />
      </linearGradient>
      <filter id="nw2a-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* incoming white beam from the left */}
    <path d="M2 15.5 L11 15.5" stroke="hsl(0 0% 100% / .85)" strokeWidth="2.1" strokeLinecap="round" filter="url(#nw2a-glow)" />
    {/* refracted spectrum fanning up-right out of the prism */}
    <g strokeWidth="1.9" strokeLinecap="round" filter="url(#nw2a-glow)">
      <path d="M18 15 L29 8.5" stroke="hsl(264 88% 70%)" />
      <path d="M18.5 16 L30 14" stroke="hsl(188 92% 64%)" />
      <path d="M18.5 17 L29.5 19.5" stroke="hsl(150 84% 60%)" />
      <path d="M18 18 L28 24.5" stroke="hsl(322 86% 68%)" />
    </g>
    {/* the glass prism (triangle), apex up */}
    <path
      d="M13 6.5 L22 22 L5.5 22 Z"
      fill="url(#nw2a-glass)"
      stroke="url(#nw2a-edge)"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    {/* inner facet highlight */}
    <path d="M13 9 L18.6 19" stroke="hsl(0 0% 100% / .35)" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

// ── 2) Edge Delta — an upward-pointing delta (change) glyph, iris-gradient
//        stroke, with a bright spark lifting off the apex: the trending edge.
const EdgeDelta: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="nw2b-tri" x1="6" y1="26" x2="24" y2="8" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 70%)" />
        <stop offset="0.55" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="nw2b-glass" cx="50%" cy="60%" r="70%">
        <stop offset="0" stopColor="hsl(240 40% 16% / .5)" />
        <stop offset="100%" stopColor="hsl(244 46% 6% / .88)" />
      </radialGradient>
      <radialGradient id="nw2b-spark" cx="42%" cy="38%" r="70%">
        <stop offset="0" stopColor="hsl(150 92% 86%)" />
        <stop offset="55%" stopColor="hsl(180 90% 62%)" />
        <stop offset="100%" stopColor="hsl(255 84% 48%)" />
      </radialGradient>
      <filter id="nw2b-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* delta bloom */}
    <path d="M16 8 L26 27 L6 27 Z" fill="url(#nw2b-tri)" opacity="0.13" />
    {/* glass delta with iris edge (apex cut flat to seat the spark) */}
    <path
      d="M13.4 12 L25 26 L7 26 Z"
      fill="url(#nw2b-glass)"
      stroke="url(#nw2b-tri)"
      strokeWidth="2.1"
      strokeLinejoin="round"
    />
    {/* inner rising bar (measures the gap = the edge) */}
    <path d="M16 17.5 L16 23" stroke="hsl(0 0% 100% / .4)" strokeWidth="1.4" strokeLinecap="round" />
    {/* spark lifting off the apex */}
    <g filter="url(#nw2b-glow)">
      <circle cx="16" cy="8.4" r="3.4" fill="url(#nw2b-spark)" />
      <path d="M16 2.6 L16 4.6 M11.4 6 L12.9 7 M20.6 6 L19.1 7" stroke="hsl(150 90% 78%)" strokeWidth="1.2" strokeLinecap="round" />
    </g>
    <circle cx="14.9" cy="7.4" r="0.95" fill="hsl(0 0% 100% / .85)" />
  </svg>
);

// ── 3) Seam Rocket — one continuous baseball-seam curve that sweeps upward and
//        resolves into an arrowhead: the ball + upward momentum, single gesture.
const SeamRocket: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="nw2c-arc" x1="6" y1="27" x2="25" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 70%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(150 86% 64%)" />
      </linearGradient>
      <linearGradient id="nw2c-head" x1="18" y1="12" x2="27" y2="4" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(188 92% 68%)" />
        <stop offset="1" stopColor="hsl(150 88% 66%)" />
      </linearGradient>
      <filter id="nw2c-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient bloom under the sweep */}
    <path d="M6 26 C 11 22, 15 12, 24.5 6.5" stroke="url(#nw2c-arc)" strokeWidth="6.5" strokeLinecap="round" opacity="0.12" />
    {/* main seam arc, curving up-right */}
    <path
      d="M6 26 C 11 22, 15 12, 24.5 6.5"
      stroke="url(#nw2c-arc)"
      strokeWidth="3"
      strokeLinecap="round"
      filter="url(#nw2c-glow)"
    />
    {/* seam stitches straddling the arc */}
    <g stroke="hsl(0 0% 100% / .7)" strokeWidth="1.05" strokeLinecap="round">
      <path d="M8.4 22.8 L11 24.2" />
      <path d="M11 18.6 L13.7 19.7" />
      <path d="M13.7 14.6 L16.5 15.4" />
      <path d="M16.9 11 L19.6 11.6" />
    </g>
    {/* arrowhead at the top tip */}
    <path
      d="M24.5 6.5 L17.8 8.4 L22 12.9 Z"
      fill="url(#nw2c-head)"
      filter="url(#nw2c-glow)"
    />
  </svg>
);

// ── 4) Odds Die — a glass gaming die (rounded square) showing a five, its pips
//        picked out in iris hues: the odds / probability mark.
const OddsDie: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="nw2d-edge" x1="5" y1="5" x2="27" y2="27" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <linearGradient id="nw2d-face" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(240 42% 15% / .78)" />
        <stop offset="1" stopColor="hsl(244 48% 6% / .92)" />
      </linearGradient>
      <filter id="nw2d-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.55" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* die bloom */}
    <rect x="4.5" y="4.5" width="23" height="23" rx="6" fill="url(#nw2d-edge)" opacity="0.13" />
    {/* glass die body + iris edge */}
    <rect x="5.5" y="5.5" width="21" height="21" rx="5.5" fill="url(#nw2d-face)" stroke="url(#nw2d-edge)" strokeWidth="2" />
    {/* top gloss */}
    <path d="M9 8.5 C 13 6.6, 19 6.6, 23 8.5" stroke="hsl(0 0% 100% / .28)" strokeWidth="1" strokeLinecap="round" />
    {/* five pips, iris hues, corners + center */}
    <g filter="url(#nw2d-glow)">
      <circle cx="11" cy="11" r="2.05" fill="hsl(264 86% 70%)" />
      <circle cx="21" cy="11" r="2.05" fill="hsl(188 92% 64%)" />
      <circle cx="16" cy="16" r="2.25" fill="hsl(150 86% 64%)" />
      <circle cx="11" cy="21" r="2.05" fill="hsl(322 86% 68%)" />
      <circle cx="21" cy="21" r="2.05" fill="hsl(200 90% 66%)" />
    </g>
    {/* center pip glint */}
    <circle cx="15.2" cy="15.2" r="0.75" fill="hsl(0 0% 100% / .8)" />
  </svg>
);

// ── 5) Pulse Peak — a live heartbeat/pulse line running flat, then spiking to a
//        bright glowing peak node: the live signal locating its edge.
const PulsePeak: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="nw2e-line" x1="3" y1="18" x2="29" y2="14" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 70%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(150 86% 64%)" />
      </linearGradient>
      <radialGradient id="nw2e-node" cx="42%" cy="38%" r="70%">
        <stop offset="0" stopColor="hsl(150 92% 86%)" />
        <stop offset="50%" stopColor="hsl(180 90% 62%)" />
        <stop offset="100%" stopColor="hsl(255 84% 48%)" />
      </radialGradient>
      <filter id="nw2e-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* faint baseline rule */}
    <path d="M3 20 L29 20" stroke="hsl(230 50% 60% / .16)" strokeWidth="1" strokeLinecap="round" />
    {/* pulse waveform: flat, dip, tall spike to the peak, settle */}
    <path
      d="M3 20 L9 20 L11.5 22.5 L14.5 9 L17.5 25.5 L20 20 L29 20"
      stroke="url(#nw2e-line)"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      filter="url(#nw2e-glow)"
    />
    {/* glowing peak node at the top of the spike */}
    <g filter="url(#nw2e-glow)">
      <circle cx="14.5" cy="9" r="3.1" fill="url(#nw2e-node)" />
    </g>
    <circle cx="13.5" cy="8" r="0.95" fill="hsl(0 0% 100% / .85)" />
  </svg>
);

export const LOGOS_NEW2: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Prism Split", El: PrismSplit },
  { name: "Edge Delta", El: EdgeDelta },
  { name: "Seam Rocket", El: SeamRocket },
  { name: "Odds Die", El: OddsDie },
  { name: "Pulse Peak", El: PulsePeak },
];

export default LOGOS_NEW2;
