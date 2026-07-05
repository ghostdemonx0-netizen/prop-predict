/**
 * LogosArt1.tsx — Artistic logo marks for "Prop Predict".
 *
 * Art direction: NEGATIVE SPACE / CLEVER DUAL-READ — marks where two ideas fuse
 * into one ownable symbol (FedEx-arrow level of craft). Three genuinely distinct
 * concepts, each tuned for the Spatial-Depth skin (dark ground, iris gradient
 * violet → cyan → mint, tasteful neon/glass) and legible at ~34px yet solid as
 * an app icon.
 *
 *  A. "Foresight" — an eye of prediction whose pupil is a baseball. The almond
 *     lids read as vision/foresight; the seamed sphere inside reads as the game.
 *     Two ideas (see-ahead + baseball) become one: a model that sees the play.
 *
 *  B. "Ascendant" — a rounded infield diamond (also a data node) with an
 *     upward arrow carved through its heart. Diamond + rising chart = the edge
 *     going up on the field.
 *
 *  C. "Verdict" — a baseball with a checkmark cut clean out of it in true
 *     negative space (mask, so it shows the ground through). Ball + verified
 *     check = "data, not picks": the call the model already graded correct.
 *
 * Every gradient / clip / mask id is prefixed art1a- / art1b- / art1c- so many
 * marks can render together without id collisions. No imports beyond React.
 */
import React from "react";

/* ============================================================
   A — "Foresight": eye of prediction, pupil is a baseball
   ============================================================ */
const Foresight: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        id="art1a-iris"
        x1="4"
        y1="8"
        x2="28"
        y2="24"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="hsl(188 92% 64%)" />
        <stop offset="0.5" stopColor="hsl(264 88% 70%)" />
        <stop offset="1" stopColor="hsl(150 82% 60%)" />
      </linearGradient>
      <radialGradient id="art1a-ball" cx="38%" cy="33%" r="74%">
        <stop offset="0" stopColor="hsl(150 90% 78%)" />
        <stop offset="0.5" stopColor="hsl(198 90% 60%)" />
        <stop offset="1" stopColor="hsl(266 82% 52%)" />
      </radialGradient>
      <clipPath id="art1a-eye">
        <path d="M4 16 Q16 6 28 16 Q16 26 4 16 Z" />
      </clipPath>
    </defs>

    {/* glass interior of the eye */}
    <path d="M4 16 Q16 6 28 16 Q16 26 4 16 Z" fill="hsl(243 40% 10% / 0.6)" />

    {/* faint iris ring, clipped to the eye so it never spills past the lids */}
    <g clipPath="url(#art1a-eye)">
      <circle
        cx="16"
        cy="16"
        r="8.4"
        fill="none"
        stroke="url(#art1a-iris)"
        strokeWidth="1"
        opacity="0.34"
      />
    </g>

    {/* eye outline — the negative-space almond */}
    <path
      d="M4 16 Q16 6 28 16 Q16 26 4 16 Z"
      fill="none"
      stroke="url(#art1a-iris)"
      strokeWidth="2"
      strokeLinejoin="round"
    />

    {/* baseball pupil */}
    <circle cx="16" cy="16" r="5.4" fill="url(#art1a-ball)" />

    {/* two seam arcs sell the ball */}
    <path
      d="M12.7 12.2 Q11.3 16 12.7 19.8"
      fill="none"
      stroke="hsl(0 0% 100% / 0.55)"
      strokeWidth="0.9"
      strokeLinecap="round"
    />
    <path
      d="M19.3 12.2 Q20.7 16 19.3 19.8"
      fill="none"
      stroke="hsl(0 0% 100% / 0.55)"
      strokeWidth="0.9"
      strokeLinecap="round"
    />

    {/* specular catchlight */}
    <circle cx="13.9" cy="13.9" r="1.35" fill="hsl(0 0% 100% / 0.82)" />
  </svg>
);

/* ============================================================
   B — "Ascendant": infield diamond / data node + rising arrow
   ============================================================ */
const Ascendant: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        id="art1b-frame"
        x1="6"
        y1="6"
        x2="26"
        y2="26"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="hsl(264 88% 72%)" />
        <stop offset="1" stopColor="hsl(188 92% 62%)" />
      </linearGradient>
      <linearGradient
        id="art1b-arrow"
        x1="16"
        y1="24"
        x2="16"
        y2="8"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0" stopColor="hsl(150 82% 58%)" />
        <stop offset="0.55" stopColor="hsl(188 92% 62%)" />
        <stop offset="1" stopColor="hsl(264 88% 74%)" />
      </linearGradient>
    </defs>

    {/* rounded diamond — reads as both a baseball infield and a data node */}
    <rect
      x="7.4"
      y="7.4"
      width="17.2"
      height="17.2"
      rx="4"
      transform="rotate(45 16 16)"
      fill="hsl(243 44% 10% / 0.55)"
      stroke="url(#art1b-frame)"
      strokeWidth="2"
      strokeLinejoin="round"
    />

    {/* upward arrow carved through the diamond — the rising edge */}
    <path
      d="M16 7.6 L22.4 15 L18.7 15 L18.7 23.2 L13.3 23.2 L13.3 15 L9.6 15 Z"
      fill="url(#art1b-arrow)"
      strokeLinejoin="round"
    />
  </svg>
);

/* ============================================================
   C — "Verdict": baseball with a checkmark in true negative space
   ============================================================ */
const Verdict: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="art1c-ball" cx="36%" cy="31%" r="80%">
        <stop offset="0" stopColor="hsl(150 88% 76%)" />
        <stop offset="0.45" stopColor="hsl(190 90% 60%)" />
        <stop offset="1" stopColor="hsl(278 84% 56%)" />
      </radialGradient>
      {/* white = keep, black = cut → the check shows the ground through */}
      <mask id="art1c-cut">
        <circle cx="16" cy="16" r="12" fill="white" />
        <path
          d="M10 16.4 L14.2 20.6 L22.4 11.2"
          fill="none"
          stroke="black"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
    </defs>

    {/* the ball, with the checkmark punched out of it */}
    <circle cx="16" cy="16" r="12" fill="url(#art1c-ball)" mask="url(#art1c-cut)" />

    {/* rim light */}
    <circle
      cx="16"
      cy="16"
      r="12"
      fill="none"
      stroke="hsl(0 0% 100% / 0.16)"
      strokeWidth="1"
    />

    {/* two faint seam stitches hug the rim so it always reads as a baseball */}
    <path
      d="M7.1 21 Q4.7 16 7.1 11"
      fill="none"
      stroke="hsl(0 0% 100% / 0.42)"
      strokeWidth="1"
      strokeLinecap="round"
      strokeDasharray="0.4 2"
    />
    <path
      d="M24.9 11 Q27.3 16 24.9 21"
      fill="none"
      stroke="hsl(0 0% 100% / 0.42)"
      strokeWidth="1"
      strokeLinecap="round"
      strokeDasharray="0.4 2"
    />
  </svg>
);

export const LOGOS_ART1: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Foresight", El: Foresight },
  { name: "Ascendant", El: Ascendant },
  { name: "Verdict", El: Verdict },
];
