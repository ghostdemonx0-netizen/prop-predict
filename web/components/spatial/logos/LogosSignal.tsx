/**
 * LogosSignal.tsx — Logo-mark options in the "Signal / model" art direction.
 *
 * Four abstract brand marks about data + prediction + probability, tuned to the
 * Mock 7 "Spatial Depth" skin: the iris gradient (violet → cyan → mint), a soft
 * neon glow, and echoes of the site's signature ProbabilityOrb (glowing ring).
 * Each renders as a self-contained inline SVG at `size` (default 34), viewBox
 * 0 0 32 32, and reads clearly at ~34px on the dark command-bar background.
 *
 * Palette (from spatial.css):
 *   iris-cyan   hsl(188 92% 62%)
 *   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)
 *
 * IDs are prefixed per-mark (sig1-, sig2-, sig3-, sig4-) so gradients/filters/
 * clips never collide when all four render together in a picker.
 */
import React from "react";

// ── 1) Orb Ring — glowing progress ring echoing the site's ProbabilityOrb, with
//        an iris-gradient arc, a soft dark-glass core, and a bright bolt/dot core.
const OrbRing: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sig1-arc" x1="4" y1="26" x2="28" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 82% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(264 88% 72%)" />
      </linearGradient>
      <radialGradient id="sig1-core" cx="40%" cy="34%" r="72%">
        <stop offset="0" stopColor="hsl(150 90% 80%)" />
        <stop offset="46%" stopColor="hsl(180 88% 58%)" />
        <stop offset="100%" stopColor="hsl(255 82% 44%)" />
      </radialGradient>
      <radialGradient id="sig1-glass" cx="50%" cy="38%" r="70%">
        <stop offset="0" stopColor="hsl(240 40% 16% / .55)" />
        <stop offset="100%" stopColor="hsl(244 46% 7% / .85)" />
      </radialGradient>
      <filter id="sig1-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* soft ambient bloom */}
    <circle cx="16" cy="16" r="13" fill="url(#sig1-arc)" opacity="0.16" />
    {/* deep-glass core */}
    <circle cx="16" cy="16" r="8.5" fill="url(#sig1-glass)" />
    {/* faint full track */}
    <circle
      cx="16"
      cy="16"
      r="11"
      fill="none"
      stroke="hsl(0 0% 100% / .12)"
      strokeWidth="2.4"
    />
    {/* iris progress arc (~76% sweep), rounded ends, neon glow */}
    <circle
      cx="16"
      cy="16"
      r="11"
      fill="none"
      stroke="url(#sig1-arc)"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeDasharray="69.1"
      strokeDashoffset="16.6"
      transform="rotate(-90 16 16)"
      filter="url(#sig1-glow)"
    />
    {/* bright dot/bolt core */}
    <circle cx="16" cy="16" r="4" fill="url(#sig1-core)" filter="url(#sig1-glow)" />
    <circle cx="14.4" cy="14.4" r="1.15" fill="hsl(0 0% 100% / .8)" />
  </svg>
);

// ── 2) Radar Sweep — concentric range rings + a rotating iris-gradient wedge
//        sweeping the field, with a glowing target blip (prediction) lit up.
const RadarSweep: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sig2-sweep" x1="16" y1="16" x2="28" y2="7" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 70%)" stopOpacity="0" />
        <stop offset="0.55" stopColor="hsl(200 90% 64%)" stopOpacity="0.35" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" stopOpacity="0.9" />
      </linearGradient>
      <linearGradient id="sig2-edge" x1="16" y1="16" x2="28" y2="7" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(150 84% 66%)" />
      </linearGradient>
      <radialGradient id="sig2-blip" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="hsl(150 92% 82%)" />
        <stop offset="100%" stopColor="hsl(150 84% 56%)" />
      </radialGradient>
      <filter id="sig2-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <clipPath id="sig2-clip">
        <circle cx="16" cy="16" r="12.6" />
      </clipPath>
    </defs>
    {/* range rings */}
    <circle cx="16" cy="16" r="12.6" fill="hsl(244 46% 9% / .6)" stroke="hsl(230 60% 80% / .16)" strokeWidth="1.2" />
    <circle cx="16" cy="16" r="8.4" fill="none" stroke="hsl(230 60% 80% / .14)" strokeWidth="1" />
    <circle cx="16" cy="16" r="4.2" fill="none" stroke="hsl(230 60% 80% / .14)" strokeWidth="1" />
    {/* cross graticule */}
    <g clipPath="url(#sig2-clip)" stroke="hsl(230 60% 80% / .12)" strokeWidth="1">
      <line x1="16" y1="3" x2="16" y2="29" />
      <line x1="3" y1="16" x2="29" y2="16" />
    </g>
    {/* sweeping wedge */}
    <g clipPath="url(#sig2-clip)">
      <path d="M16 16 L16 3 A13 13 0 0 1 28.6 10.2 Z" fill="url(#sig2-sweep)" />
      <line x1="16" y1="16" x2="16" y2="3.4" stroke="url(#sig2-edge)" strokeWidth="1.6" strokeLinecap="round" filter="url(#sig2-glow)" />
    </g>
    {/* glowing target blip */}
    <circle cx="21.2" cy="10.8" r="2" fill="url(#sig2-blip)" filter="url(#sig2-glow)" />
    {/* center hub */}
    <circle cx="16" cy="16" r="1.5" fill="hsl(188 92% 66%)" />
  </svg>
);

// ── 3) Signal Peak — a rising iris-gradient chart line sparking to a peak, over a
//        faint grid, with a glowing node at the crest (the prediction).
const SignalPeak: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sig3-line" x1="4" y1="24" x2="28" y2="7" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(150 84% 64%)" />
      </linearGradient>
      <linearGradient id="sig3-fill" x1="16" y1="7" x2="16" y2="27" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(188 92% 62%)" stopOpacity="0.34" />
        <stop offset="1" stopColor="hsl(188 92% 62%)" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="sig3-node" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="100%" stopColor="hsl(160 86% 58%)" />
      </radialGradient>
      <filter id="sig3-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* rounded plot frame */}
    <rect x="3.5" y="3.5" width="25" height="25" rx="7" fill="hsl(244 46% 9% / .5)" stroke="hsl(230 60% 80% / .14)" strokeWidth="1.1" />
    {/* faint grid */}
    <g stroke="hsl(230 60% 80% / .1)" strokeWidth="0.9">
      <line x1="7" y1="12" x2="25" y2="12" />
      <line x1="7" y1="17" x2="25" y2="17" />
      <line x1="7" y1="22" x2="25" y2="22" />
    </g>
    {/* area under the spark */}
    <path d="M6.5 23 L12 18.5 L16.5 21 L25 8.5 L25 25 L6.5 25 Z" fill="url(#sig3-fill)" />
    {/* rising spark line peaking */}
    <path
      d="M6.5 23 L12 18.5 L16.5 21 L25 8.5"
      fill="none"
      stroke="url(#sig3-line)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      filter="url(#sig3-glow)"
    />
    {/* glowing crest node */}
    <circle cx="25" cy="8.5" r="2.4" fill="url(#sig3-node)" filter="url(#sig3-glow)" />
    <circle cx="24.3" cy="7.8" r="0.7" fill="hsl(0 0% 100% / .85)" />
  </svg>
);

// ── 4) Precision — a concentric crosshair / target lock: iris-gradient outer ring,
//        precision ticks, corner brackets, and a lit bullseye core.
const Precision: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sig4-ring" x1="5" y1="27" x2="27" y2="5" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 64%)" />
        <stop offset="1" stopColor="hsl(264 88% 72%)" />
      </linearGradient>
      <radialGradient id="sig4-core" cx="42%" cy="36%" r="70%">
        <stop offset="0" stopColor="hsl(150 92% 82%)" />
        <stop offset="48%" stopColor="hsl(184 88% 60%)" />
        <stop offset="100%" stopColor="hsl(258 82% 48%)" />
      </radialGradient>
      <filter id="sig4-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    {/* ambient bloom */}
    <circle cx="16" cy="16" r="12.5" fill="url(#sig4-ring)" opacity="0.12" />
    {/* outer precision ring */}
    <circle
      cx="16"
      cy="16"
      r="11"
      fill="none"
      stroke="url(#sig4-ring)"
      strokeWidth="2"
      filter="url(#sig4-glow)"
    />
    {/* corner lock brackets */}
    <g stroke="hsl(188 92% 66%)" strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
      <path d="M16 2.6 L16 6" />
      <path d="M16 26 L16 29.4" />
      <path d="M2.6 16 L6 16" />
      <path d="M26 16 L29.4 16" />
    </g>
    {/* inner ring */}
    <circle cx="16" cy="16" r="6.6" fill="hsl(244 46% 9% / .55)" stroke="hsl(230 60% 80% / .2)" strokeWidth="1" />
    {/* bullseye core */}
    <circle cx="16" cy="16" r="3.4" fill="url(#sig4-core)" filter="url(#sig4-glow)" />
    <circle cx="14.9" cy="14.9" r="0.95" fill="hsl(0 0% 100% / .82)" />
  </svg>
);

export const LOGOS_SIGNAL: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Orb Ring", El: OrbRing },
  { name: "Radar Sweep", El: RadarSweep },
  { name: "Signal Peak", El: SignalPeak },
  { name: "Precision", El: Precision },
];

export default LOGOS_SIGNAL;
