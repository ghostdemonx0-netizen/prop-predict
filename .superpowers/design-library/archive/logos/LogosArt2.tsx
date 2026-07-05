/**
 * LogosArt2.tsx — Logo marks in the "Dynamic Motion / Trajectory / Energy" art
 * direction for the "Prop Predict" wordmark in the Spatial Depth command bar.
 *
 * Three genuinely distinct, kinetic brand marks. Each renders one self-contained
 * inline SVG at `size` (default 34), viewBox 0 0 32 32, tuned to read cleanly at
 * ~34px on the dark iris theme and to hold up as an app icon. The iris gradient
 * (violet → cyan → mint) and neon glow carry the "energy" — the motion trails,
 * swing arc, and velocity streaks are where the light lives.
 *
 * Palette pulled from spatial.css:
 *   iris-cyan   hsl(188 92% 62%)
 *   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)
 *   iris-mag    hsl(322 86% 68%)
 *
 * Concepts (each distinct from the existing marks — orb, radar, crosshair,
 * seams, plate, bats, monogram, bolt-in-diamond, comet-trail, prism, dice,
 * pulse, rocket, ballpark, frost, precision, signal):
 *   a · Curveball Break — a breaking-pitch trajectory that hooks into a live ball
 *   b · Swing Arc       — the sweeping arc of a swing meeting the ball at contact
 *   c · Slipstream      — rising velocity streaks resolving into a comet-lit ball
 *
 * Every gradient / filter id is prefixed uniquely (art2a-, art2b-, art2c-) so
 * IDs never collide when all marks render together on one page.
 */
import React from "react";

/* ── a · Curveball Break ──────────────────────────────────────────────────
   A pitched ball breaking along its trajectory: a hooking gradient trail that
   enters top-left, bends through the strike zone, and resolves into a glowing
   ball. Trailing ticks sell the velocity; the widening second stroke fakes the
   comet-like taper into the release point. ── */
const CurveballBreak: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="art2a-trail" x1="7" y1="6" x2="21" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.55" stopColor="hsl(188 92% 62%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="art2a-ball" cx="38%" cy="34%" r="72%">
        <stop offset="0" stopColor="hsl(150 92% 84%)" />
        <stop offset="46%" stopColor="hsl(168 88% 60%)" />
        <stop offset="100%" stopColor="hsl(255 82% 46%)" />
      </radialGradient>
      <radialGradient id="art2a-halo" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="hsl(200 90% 60%)" />
        <stop offset="100%" stopColor="hsl(255 80% 44%)" />
      </radialGradient>
      <filter id="art2a-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* ambient depth halo */}
    <circle cx="16" cy="16" r="13" fill="url(#art2a-halo)" opacity="0.14" />

    {/* faint underlay ghost of the break for depth */}
    <path
      d="M8 6 C 7.5 13, 11 19, 20.5 20.5"
      stroke="hsl(0 0% 100% / .08)"
      strokeWidth="4.2"
      strokeLinecap="round"
      fill="none"
    />

    {/* trailing velocity ticks fading into the pitch */}
    <g stroke="url(#art2a-trail)" strokeLinecap="round" fill="none">
      <path d="M4.5 6.5 C 5 8, 5.2 9.4, 5.2 10.8" strokeWidth="1.5" opacity="0.35" />
      <path d="M6 5 C 6.6 6.4, 6.9 7.8, 7 9.2" strokeWidth="1.7" opacity="0.55" />
    </g>

    {/* main breaking trajectory */}
    <path
      d="M8 6 C 7.5 13, 11 19, 20.5 20.5"
      stroke="url(#art2a-trail)"
      strokeWidth="2.3"
      strokeLinecap="round"
      fill="none"
      filter="url(#art2a-glow)"
    />
    {/* widening release-point segment (comet taper toward the ball) */}
    <path
      d="M13.5 18.4 C 16 19.8, 18.6 20.3, 20.6 20.5"
      stroke="url(#art2a-trail)"
      strokeWidth="3.4"
      strokeLinecap="round"
      fill="none"
      filter="url(#art2a-glow)"
    />

    {/* live ball at the terminus */}
    <circle cx="22.4" cy="20.6" r="3.5" fill="url(#art2a-ball)" filter="url(#art2a-glow)" />
    <circle cx="21.2" cy="19.4" r="1.15" fill="hsl(0 0% 100% / .9)" />
  </svg>
);

/* ── b · Swing Arc ────────────────────────────────────────────────────────
   The energy of a swing rendered as a bold gradient arc sweeping up from the
   load into the point of contact, where the ball ignites in a burst of sparks.
   A lighter follow-through echo behind sells the rotational motion. ── */
const SwingArc: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="art2b-arc" x1="6" y1="26" x2="25" y2="7" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 62%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="art2b-ball" cx="40%" cy="34%" r="72%">
        <stop offset="0" stopColor="hsl(150 94% 86%)" />
        <stop offset="48%" stopColor="hsl(168 88% 62%)" />
        <stop offset="100%" stopColor="hsl(255 82% 48%)" />
      </radialGradient>
      <radialGradient id="art2b-halo" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="hsl(200 90% 60%)" />
        <stop offset="100%" stopColor="hsl(255 80% 44%)" />
      </radialGradient>
      <filter id="art2b-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.85" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* ambient depth halo */}
    <circle cx="16" cy="16" r="13" fill="url(#art2b-halo)" opacity="0.14" />

    {/* follow-through echo — a fainter, tighter arc trailing the swing */}
    <path
      d="M8 25.5 A 14 14 0 0 1 20.5 9.5"
      stroke="hsl(0 0% 100% / .1)"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />

    {/* main swing arc — thin at the load, blooming toward contact */}
    <path
      d="M6.5 24.5 A 16 16 0 0 1 22.5 8.5"
      stroke="url(#art2b-arc)"
      strokeWidth="2.4"
      strokeLinecap="round"
      fill="none"
      filter="url(#art2b-glow)"
    />
    <path
      d="M15 11.5 A 16 16 0 0 1 22.6 8.4"
      stroke="url(#art2b-arc)"
      strokeWidth="3.4"
      strokeLinecap="round"
      fill="none"
      filter="url(#art2b-glow)"
    />

    {/* contact spark burst */}
    <g stroke="hsl(0 0% 100% / .92)" strokeWidth="1.3" strokeLinecap="round" filter="url(#art2b-glow)">
      <path d="M24 5.5 L25.8 3.6" />
      <path d="M26.5 9.5 L29 8.7" />
      <path d="M22.8 4 L23.4 1.6" />
    </g>

    {/* the ball at the point of contact */}
    <circle cx="23.5" cy="8" r="3.5" fill="url(#art2b-ball)" filter="url(#art2b-glow)" />
    <circle cx="22.3" cy="6.8" r="1.15" fill="hsl(0 0% 100% / .9)" />
  </svg>
);

/* ── c · Slipstream ───────────────────────────────────────────────────────
   Velocity made visible: three iris-tinted speed streaks rising to the right,
   each fading in from nothing, resolving into a comet-lit ball at the leading
   edge. Pure forward momentum. ── */
const Slipstream: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="art2c-l1" x1="5" y1="9" x2="18" y2="10" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(150 84% 62%)" stopOpacity="0" />
        <stop offset="1" stopColor="hsl(150 84% 64%)" stopOpacity="1" />
      </linearGradient>
      <linearGradient id="art2c-l2" x1="3.5" y1="15" x2="19" y2="13" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(188 92% 62%)" stopOpacity="0" />
        <stop offset="1" stopColor="hsl(188 92% 64%)" stopOpacity="1" />
      </linearGradient>
      <linearGradient id="art2c-l3" x1="6" y1="21" x2="17" y2="17" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 72%)" stopOpacity="0" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" stopOpacity="1" />
      </linearGradient>
      <radialGradient id="art2c-ball" cx="40%" cy="34%" r="72%">
        <stop offset="0" stopColor="hsl(150 94% 86%)" />
        <stop offset="46%" stopColor="hsl(178 90% 62%)" />
        <stop offset="100%" stopColor="hsl(255 82% 48%)" />
      </radialGradient>
      <radialGradient id="art2c-halo" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="hsl(200 90% 60%)" />
        <stop offset="100%" stopColor="hsl(255 80% 44%)" />
      </radialGradient>
      <filter id="art2c-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.85" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* ambient depth halo, weighted toward the leading edge */}
    <circle cx="21" cy="12.5" r="12" fill="url(#art2c-halo)" opacity="0.14" />

    {/* three rising velocity streaks, converging on the ball */}
    <g strokeLinecap="round" fill="none" filter="url(#art2c-glow)">
      <path d="M5 9.3 L17.5 9.8" stroke="url(#art2c-l1)" strokeWidth="2.5" />
      <path d="M3.5 15 L18.5 12.7" stroke="url(#art2c-l2)" strokeWidth="2.7" />
      <path d="M6 20.6 L16.5 17.2" stroke="url(#art2c-l3)" strokeWidth="2.4" />
    </g>

    {/* two faint far-trailing ticks for extra speed texture */}
    <g strokeLinecap="round" fill="none" opacity="0.4">
      <path d="M4 11.8 L8.5 11.6" stroke="hsl(168 88% 64%)" strokeWidth="1.4" />
      <path d="M5 18 L9 17.4" stroke="hsl(220 88% 72%)" strokeWidth="1.4" />
    </g>

    {/* comet-lit ball at the leading edge */}
    <circle cx="22.6" cy="12.4" r="3.6" fill="url(#art2c-ball)" filter="url(#art2c-glow)" />
    <circle cx="21.4" cy="11.2" r="1.2" fill="hsl(0 0% 100% / .9)" />
  </svg>
);

export const LOGOS_ART2: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Curveball Break", El: CurveballBreak },
  { name: "Swing Arc", El: SwingArc },
  { name: "Slipstream", El: Slipstream },
];

export default LOGOS_ART2;
