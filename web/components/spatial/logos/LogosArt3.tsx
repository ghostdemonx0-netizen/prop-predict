/**
 * LogosArt3.tsx — Artistic logo marks in the "Geometric Modernist / Premium
 * Minimal" art direction for Prop Predict.
 *
 * Three ultra-refined, timeless geometric marks in the spirit of top tech brands
 * (Stripe / Linear / Vercel). The form does the work: perfect geometry, generous
 * negative space, restraint. The iris gradient (violet → cyan → mint) is used
 * sparingly — a single gradient fill or edge per mark — over dark-glass surfaces
 * with a soft neon bloom, so each reads crisply at ~34px on the command bar and
 * holds up as a square app icon.
 *
 * Concepts:
 *   a) Vantage  — a solid geometric "P" monogram (stem + semi-annulus bowl) whose
 *                 bowl frames a single lit prediction node. Reads P + ball + edge.
 *   b) Lattice  — a grid-constructed diamond-and-node mark: a precise infield
 *                 diamond with a data/model node network and one lit apex node.
 *   c) Meridian — a single elegant continuous line: an open ball arc that flicks
 *                 upward into a rising prediction trajectory, ending in a node.
 *
 * Palette (from spatial.css):
 *   iris-cyan   hsl(188 92% 62%)   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)   iris-mag    hsl(322 86% 68%)
 *
 * All ids are prefixed per-mark (art3a-, art3b-, art3c-) so gradients/filters
 * never collide when several marks render together in a picker.
 */
import React from "react";

// ── a) Vantage — a solid modernist "P": a clean vertical stem fused to a
//        semi-annulus bowl, cut from a single iris-gradient plane. The bowl
//        cradles one bright node — the "prediction" the edge is built around.
const Vantage: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="art3a-plane" x1="9.5" y1="4" x2="21.3" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(150 84% 60%)" />
      </linearGradient>
      <radialGradient id="art3a-node" cx="40%" cy="34%" r="72%">
        <stop offset="0" stopColor="hsl(0 0% 100%)" />
        <stop offset="46%" stopColor="hsl(160 90% 78%)" />
        <stop offset="100%" stopColor="hsl(172 84% 50%)" />
      </radialGradient>
      <filter id="art3a-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* the P plane — stem + right-side semi-annulus bowl, one shared iris fill */}
    <g fill="url(#art3a-plane)" filter="url(#art3a-glow)">
      <rect x="9.5" y="4" width="4.8" height="24" rx="1.7" />
      <path d="M 14.3 3.6 A 7 7 0 0 1 14.3 17.6 L 14.3 14.0 A 3.4 3.4 0 0 0 14.3 7.2 Z" />
    </g>
    {/* thin bright top-edge accent — sells the crisp plane / light catch */}
    <path
      d="M 14.3 3.6 A 7 7 0 0 1 20.9 8.3"
      fill="none"
      stroke="hsl(0 0% 100% / .5)"
      strokeWidth="0.9"
      strokeLinecap="round"
    />
    {/* the lit prediction node cradled inside the bowl counter */}
    <circle cx="16.4" cy="10.6" r="1.75" fill="url(#art3a-node)" filter="url(#art3a-glow)" />
  </svg>
);

// ── b) Lattice — a grid-constructed diamond (the infield) drawn as a precise
//        iris edge, overlaid with a faint construction crosshair and a spoke
//        network of data nodes; the apex node lights up (the model's read).
const Lattice: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="art3b-edge" x1="16" y1="3" x2="16" y2="29" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(264 88% 72%)" />
      </linearGradient>
      <radialGradient id="art3b-apex" cx="42%" cy="34%" r="72%">
        <stop offset="0" stopColor="hsl(0 0% 100%)" />
        <stop offset="46%" stopColor="hsl(160 90% 80%)" />
        <stop offset="100%" stopColor="hsl(168 84% 52%)" />
      </radialGradient>
      <filter id="art3b-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* faint golden-ratio construction grid — signals the precise geometry */}
    <g stroke="hsl(230 60% 80% / .16)" strokeWidth="0.7">
      <line x1="16" y1="4.4" x2="16" y2="27.6" />
      <line x1="4.4" y1="16" x2="27.6" y2="16" />
    </g>
    {/* faint model network — spokes from center to each vertex */}
    <g stroke="hsl(188 88% 66% / .3)" strokeWidth="0.8">
      <line x1="16" y1="16" x2="16" y2="3.4" />
      <line x1="16" y1="16" x2="28.6" y2="16" />
      <line x1="16" y1="16" x2="16" y2="28.6" />
      <line x1="16" y1="16" x2="3.4" y2="16" />
    </g>
    {/* the diamond edge — a single crisp iris stroke */}
    <path
      d="M 16 3.4 L 28.6 16 L 16 28.6 L 3.4 16 Z"
      fill="hsl(244 46% 9% / .28)"
      stroke="url(#art3b-edge)"
      strokeWidth="1.7"
      strokeLinejoin="round"
      filter="url(#art3b-glow)"
    />
    {/* vertex data nodes */}
    <g fill="hsl(188 92% 70%)">
      <circle cx="28.6" cy="16" r="1.25" />
      <circle cx="16" cy="28.6" r="1.25" />
      <circle cx="3.4" cy="16" r="1.25" />
    </g>
    {/* center node */}
    <circle cx="16" cy="16" r="1.5" fill="hsl(264 86% 74%)" />
    {/* lit apex node — the model's highlighted read */}
    <circle cx="16" cy="3.4" r="1.95" fill="url(#art3b-apex)" filter="url(#art3b-glow)" />
  </svg>
);

// ── c) Meridian — one unbroken line: an open circle (the ball) whose free end
//        flicks upward into a rising trajectory, tipped by a single lit node.
//        Maximum restraint — the whole mark is a single graceful iris stroke.
const Meridian: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="art3c-line" x1="5" y1="27" x2="27" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.55" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="art3c-node" cx="40%" cy="34%" r="72%">
        <stop offset="0" stopColor="hsl(0 0% 100%)" />
        <stop offset="46%" stopColor="hsl(160 90% 80%)" />
        <stop offset="100%" stopColor="hsl(168 84% 52%)" />
      </radialGradient>
      <filter id="art3c-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* the single continuous line: open ball arc → rising trajectory flick */}
    <path
      d="M 8.63 11.54 A 8.5 8.5 0 1 1 21.49 15.59 C 24.4 12.4, 25.4 9.2, 27 6"
      fill="none"
      stroke="url(#art3c-line)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      filter="url(#art3c-glow)"
    />
    {/* lit node at the trajectory tip — the prediction */}
    <circle cx="27" cy="6" r="2" fill="url(#art3c-node)" filter="url(#art3c-glow)" />
  </svg>
);

export const LOGOS_ART3: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Vantage", El: Vantage },
  { name: "Lattice", El: Lattice },
  { name: "Meridian", El: Meridian },
];

export default LOGOS_ART3;
