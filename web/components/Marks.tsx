/* Decorative logo marks for the Prop Predict wordmark.
   FlamingBall: a baseball with red flames. ElectricBat: a wood bat with yellow lightning. */

export function FlamingBall({ size = 50 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="mark mark-ball"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="ballg" cx="40%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#fffdf7" />
          <stop offset="100%" stopColor="#e4d8bf" />
        </radialGradient>
        <linearGradient id="flameg" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#a51111" />
          <stop offset="55%" stopColor="#ff3b25" />
          <stop offset="100%" stopColor="#ff7a3c" />
        </linearGradient>
      </defs>

      {/* flames rising off the ball */}
      <g className="flame">
        <path d="M32 1 C 21 14 24 24 32 27 C 42 23 42 12 32 1 Z" fill="url(#flameg)" />
        <path d="M19 9 C 13 19 17 27 24 27 C 28 22 26 16 19 9 Z" fill="url(#flameg)" opacity="0.82" />
        <path d="M45 9 C 51 19 47 27 40 27 C 36 22 38 16 45 9 Z" fill="url(#flameg)" opacity="0.82" />
      </g>

      {/* baseball */}
      <circle cx="32" cy="40" r="17" fill="url(#ballg)" stroke="#cdbf9e" strokeWidth="1" />
      <path d="M21 31 Q32 40 21 49" fill="none" stroke="#d62828" strokeWidth="1.7" strokeLinecap="round" strokeDasharray="0.5 3.2" />
      <path d="M43 31 Q32 40 43 49" fill="none" stroke="#d62828" strokeWidth="1.7" strokeLinecap="round" strokeDasharray="0.5 3.2" />
    </svg>
  );
}

export function ElectricBat({ size = 50 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="mark mark-bat"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="woodg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0a96b" />
          <stop offset="50%" stopColor="#b5763c" />
          <stop offset="100%" stopColor="#7c4a22" />
        </linearGradient>
      </defs>

      {/* wood bat, angled */}
      <g transform="rotate(-38 32 32)">
        <path d="M27 6 Q32 2 37 6 L35 44 Q32 47 29 44 Z" fill="url(#woodg)" stroke="#5e3a18" strokeWidth="1" />
        <circle cx="32" cy="49" r="4.6" fill="url(#woodg)" stroke="#5e3a18" strokeWidth="1" />
        <path d="M30 9 L29 40" stroke="#ffe3bf" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      </g>

      {/* yellow lightning */}
      <polyline className="bolt" points="45,7 52,15 47,17 55,27" fill="none" stroke="#ffe14d" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <polyline className="bolt b2" points="13,20 8,28 13,29 7,39" fill="none" stroke="#ffe14d" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ---- PP monogram logo concepts (brand refresh) ---- */

/** Interlocking "PP" in a rounded-square badge with a green glow — app-icon / profile-pic ready. */
export function PPBadge({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="mark" aria-hidden="true">
      <defs>
        <linearGradient id="ppbadgeg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#13211a" />
          <stop offset="100%" stopColor="#0a120e" />
        </linearGradient>
        <filter id="ppglow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#ppbadgeg)" stroke="#3ee07f" strokeOpacity="0.45" strokeWidth="1.5" />
      <g fill="none" stroke="#3ee07f" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#ppglow)">
        <path d="M15 16 V48" />
        <path d="M15 16 H23 a8 8 0 0 1 0 16 H15" />
        <path d="M31 16 V48" />
        <path d="M31 16 H39 a8 8 0 0 1 0 16 H31" />
      </g>
    </svg>
  );
}

/** Monoline "PP" inside a circle — minimal, premium. */
export function PPCircle({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="mark" aria-hidden="true">
      <defs>
        <filter id="ppglow2" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="32" cy="32" r="29" fill="#0a120e" stroke="#3ee07f" strokeOpacity="0.4" strokeWidth="1.4" />
      <g fill="none" stroke="#3ee07f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#ppglow2)">
        <path d="M19 20 V44" />
        <path d="M19 20 H26 a7 7 0 0 1 0 14 H19" />
        <path d="M33 20 V44" />
        <path d="M33 20 H40 a7 7 0 0 1 0 14 H33" />
      </g>
    </svg>
  );
}
