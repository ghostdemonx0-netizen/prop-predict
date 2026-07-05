/**
 * LogosBallpark.tsx — Logo-mark options in the "Ballpark / heritage" art
 * direction for the Prop Predict command-bar brand mark.
 *
 * Each mark renders small (~34px) on the dark "Spatial Depth" background,
 * left of the gradient "Prop Predict" wordmark. All are self-contained inline
 * SVGs (viewBox 0 0 32 32) with NO external assets.
 *
 * Palette (from spatial.css):
 *   iris-cyan   hsl(188 92% 62%)
 *   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)
 *   iris-mag    hsl(322 86% 68%)
 *
 * IMPORTANT: every gradient/filter/clip id is prefixed per-mark (bpk1- …
 * bpk4-) so ids never collide when all four render on one page.
 */
import React from "react";

/* ── 1 · Seamball — a baseball with dynamic, curved iris seams ───────────── */
const Seamball: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="bpk1-ball" cx="36%" cy="30%" r="82%">
        <stop offset="0" stopColor="hsl(232 40% 20%)" />
        <stop offset="58%" stopColor="hsl(244 44% 11%)" />
        <stop offset="100%" stopColor="hsl(248 52% 6%)" />
      </radialGradient>
      <linearGradient id="bpk1-seam" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="hsl(188 92% 64%)" />
        <stop offset="52%" stopColor="hsl(264 88% 72%)" />
        <stop offset="100%" stopColor="hsl(150 82% 62%)" />
      </linearGradient>
      <filter id="bpk1-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation=".7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ball body */}
    <circle cx="16" cy="16" r="12.5" fill="url(#bpk1-ball)" />
    <circle
      cx="16"
      cy="16"
      r="12.5"
      fill="none"
      stroke="hsl(0 0% 100% / .14)"
      strokeWidth="1"
    />
    {/* top-left specular highlight */}
    <ellipse cx="11.5" cy="10.5" rx="4.2" ry="3" fill="hsl(0 0% 100% / .10)" />
    {/* two curved seams sweeping the ball */}
    <g filter="url(#bpk1-glow)">
      <path
        d="M6.2 8.4 Q13 16 6.6 23.4"
        fill="none"
        stroke="url(#bpk1-seam)"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M25.8 8.4 Q19 16 25.4 23.4"
        fill="none"
        stroke="url(#bpk1-seam)"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </g>
    {/* seam stitches */}
    <g stroke="hsl(0 0% 100% / .82)" strokeWidth="1" strokeLinecap="round">
      <path d="M8.4 10.1 l1.9 -1.1" />
      <path d="M9.4 13.2 l2 -.8" />
      <path d="M9.7 16.4 l2.1 0" />
      <path d="M9.4 19.6 l2 .8" />
      <path d="M8.4 22.6 l1.9 1.1" />
      <path d="M23.6 10.1 l-1.9 -1.1" />
      <path d="M22.6 13.2 l-2 -.8" />
      <path d="M22.3 16.4 l-2.1 0" />
      <path d="M22.6 19.6 l-2 .8" />
      <path d="M23.6 22.6 l-1.9 1.1" />
    </g>
  </svg>
);

/* ── 2 · Home Plate — pentagon plate with a rising spark ─────────────────── */
const HomePlate: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="bpk2-plate" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="hsl(188 92% 66%)" />
        <stop offset="100%" stopColor="hsl(264 88% 70%)" />
      </linearGradient>
      <linearGradient id="bpk2-spark" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="100%" stopColor="hsl(188 96% 70%)" />
      </linearGradient>
      <filter id="bpk2-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation=".9" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* soft aura */}
    <path
      d="M8 5 h16 v10 l-8 12 l-8 -12 Z"
      fill="url(#bpk2-plate)"
      opacity=".16"
    />
    {/* plate outline */}
    <path
      d="M8.5 6 h15 v9.4 l-7.5 11 l-7.5 -11 Z"
      fill="hsl(244 44% 10% / .85)"
      stroke="url(#bpk2-plate)"
      strokeWidth="2"
      strokeLinejoin="round"
      filter="url(#bpk2-glow)"
    />
    {/* inner bevel line */}
    <path
      d="M11 8.4 h10 v6.4 l-5 7.4 l-5 -7.4 Z"
      fill="none"
      stroke="hsl(0 0% 100% / .12)"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    {/* rising spark / motion mark */}
    <path
      d="M16 9.5 L14 15 h1.6 l-1.1 4.6 L18 13.6 h-1.6 l1.2 -4.1 Z"
      fill="url(#bpk2-spark)"
      filter="url(#bpk2-glow)"
    />
  </svg>
);

/* ── 3 · Crossed Bats — two bats forming an X behind a small ball ────────── */
const CrossedBats: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="bpk3-batA" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="hsl(188 92% 64%)" />
        <stop offset="100%" stopColor="hsl(150 82% 60%)" />
      </linearGradient>
      <linearGradient id="bpk3-batB" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="100%" stopColor="hsl(322 86% 68%)" />
      </linearGradient>
      <radialGradient id="bpk3-ball" cx="40%" cy="34%" r="72%">
        <stop offset="0" stopColor="hsl(0 0% 100%)" />
        <stop offset="100%" stopColor="hsl(210 30% 78%)" />
      </radialGradient>
      <filter id="bpk3-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation=".6" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* bat drawn as a tapered capsule: knob (small) -> handle -> barrel (fat) */}
    <g filter="url(#bpk3-glow)">
      {/* bat A: bottom-left knob to top-right barrel */}
      <g transform="rotate(45 16 16)">
        <rect x="3.4" y="14.4" width="4" height="3.2" rx="1.5" fill="url(#bpk3-batA)" />
        <path
          d="M7 14.9 Q13 14 22 13.2 Q27.4 13 27.6 16 Q27.4 19 22 18.8 Q13 18 7 17.1 Z"
          fill="url(#bpk3-batA)"
        />
      </g>
      {/* bat B: bottom-right knob to top-left barrel */}
      <g transform="rotate(-45 16 16)">
        <rect x="3.4" y="14.4" width="4" height="3.2" rx="1.5" fill="url(#bpk3-batB)" />
        <path
          d="M7 14.9 Q13 14 22 13.2 Q27.4 13 27.6 16 Q27.4 19 22 18.8 Q13 18 7 17.1 Z"
          fill="url(#bpk3-batB)"
        />
      </g>
    </g>
    {/* center ball over the cross */}
    <circle cx="16" cy="16" r="3.5" fill="url(#bpk3-ball)" />
    <g stroke="hsl(2 74% 56% / .85)" strokeWidth=".8" strokeLinecap="round">
      <path d="M14.1 14.3 q1.9 1.7 0 3.4" />
      <path d="M17.9 14.3 q-1.9 1.7 0 3.4" />
    </g>
  </svg>
);

/* ── 4 · Flight Arc — ball in flight, trajectory arc over home plate ─────── */
const FlightArc: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="bpk4-arc" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="55%" stopColor="hsl(188 92% 66%)" />
        <stop offset="100%" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="bpk4-ball" cx="36%" cy="32%" r="78%">
        <stop offset="0" stopColor="hsl(150 90% 82%)" />
        <stop offset="60%" stopColor="hsl(168 86% 58%)" />
        <stop offset="100%" stopColor="hsl(255 80% 46%)" />
      </radialGradient>
      <filter id="bpk4-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="1" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* home plate at the base */}
    <path
      d="M9 24.2 h9 v2.4 l-4.5 3 l-4.5 -3 Z"
      fill="hsl(244 44% 12% / .9)"
      stroke="hsl(0 0% 100% / .22)"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    {/* trajectory arc, tapering dashes for motion */}
    <path
      d="M6 26 Q15 3 28 9"
      fill="none"
      stroke="url(#bpk4-arc)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="1.5 3.4"
      opacity=".9"
      filter="url(#bpk4-glow)"
    />
    {/* launch point spark */}
    <circle cx="6" cy="26" r="1.4" fill="hsl(188 92% 70%)" />
    {/* ball at the crest / end of flight */}
    <g filter="url(#bpk4-glow)">
      <circle cx="27.6" cy="9" r="4" fill="url(#bpk4-ball)" />
    </g>
    <circle cx="26.4" cy="7.8" r="1.1" fill="hsl(0 0% 100% / .7)" />
    <g stroke="hsl(255 60% 22% / .6)" strokeWidth=".7" strokeLinecap="round">
      <path d="M25.6 9.4 q2 -0.4 4 0" />
      <path d="M25.9 11 q1.7 -0.3 3.4 0" />
    </g>
  </svg>
);

export const LOGOS_BALLPARK: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Seamball", El: Seamball },
  { name: "Home Plate", El: HomePlate },
  { name: "Crossed Bats", El: CrossedBats },
  { name: "Flight Arc", El: FlightArc },
];

export default LOGOS_BALLPARK;
