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

/* ---- edgier / techy PP concepts (round 2) ---- */

const _GRAD = (id: string) => (
  <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stopColor="#5cff9d" />
    <stop offset="55%" stopColor="#3ee07f" />
    <stop offset="100%" stopColor="#34dfe8" />
  </linearGradient>
);

/** Hex "chip" — PP in a beveled hexagon w/ gradient, glow + chip pins. Advanced/data vibe. */
export function PPChip({ size = 44, font = "var(--font-display)" }: { size?: number; font?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="mark" aria-hidden="true">
      <defs>{_GRAD("chipg")}<filter id="chipglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      {/* chip pins */}
      <g stroke="#3ee07f" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round">
        <path d="M4 24 H10 M4 40 H10 M54 24 H60 M54 40 H60" />
      </g>
      {/* flat-top hexagon */}
      <path d="M20 8 H44 L58 32 L44 56 H20 L6 32 Z" fill="#0a120e" stroke="url(#chipg)" strokeWidth="2.2" filter="url(#chipglow)" />
      {/* first P white (Prop), second P green/gradient (Predict) — matches the wordmark */}
      <text x="32" y="42" textAnchor="middle" fontFamily={font} fontWeight="700" fontSize="25" letterSpacing="-2">
        <tspan fill="#e9f1ec">P</tspan><tspan fill="url(#chipg)">P</tspan>
      </text>
    </svg>
  );
}

/** Terminal — monospace PP on a "screen" with a blinking cursor. Hacker/edgy. */
export function PPTerminal({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="mark" aria-hidden="true">
      <defs><filter id="termglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <rect x="3" y="6" width="58" height="52" rx="11" fill="#0a120e" stroke="#3ee07f" strokeOpacity="0.5" strokeWidth="1.6" />
      <path d="M11 18 H53" stroke="#3ee07f" strokeOpacity="0.25" strokeWidth="1.4" strokeLinecap="round" />
      <g filter="url(#termglow)">
        <text x="13" y="46" fontFamily="ui-monospace, 'SF Mono', Menlo, monospace" fontWeight="700" fontSize="26" letterSpacing="-1" fill="#3ee07f">PP</text>
        <rect className="bolt" x="45" y="30" width="9" height="16" fill="#34dfe8" />
      </g>
    </svg>
  );
}

/** Edge — bold italic gradient PP with a speed-slash. Aggressive/cool. */
export function PPEdge({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="mark" aria-hidden="true">
      <defs>{_GRAD("edgeg")}<filter id="edgeglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#0a120e" stroke="#34dfe8" strokeOpacity="0.25" strokeWidth="1.4" />
      {/* speed slashes */}
      <g stroke="url(#edgeg)" strokeWidth="2.4" strokeLinecap="round" opacity="0.55">
        <path d="M8 50 L20 38 M14 54 L24 44" />
      </g>
      <g filter="url(#edgeglow)" transform="skewX(-10)">
        <text x="20" y="44" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" fontStyle="italic" fontWeight="900" fontSize="34" letterSpacing="-4" fill="url(#edgeg)">PP</text>
      </g>
    </svg>
  );
}

/* ---- round 3: bold italic sporty "PP" (mix of the user's 3 refs) ---- */

/** Bold italic esports PP — first P white, second P green→cyan gradient. No lightning. */
export function PPSport({ size = 56, font = "var(--font-cp)" }: { size?: number; font?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="mark" aria-hidden="true">
      <defs>{_GRAD("sportg")}<filter id="sportglow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g transform="skewX(-9)" filter="url(#sportglow)">
        <text x="33" y="45" textAnchor="middle" fontFamily={font} fontWeight="700" fontSize="29" letterSpacing="1.5">
          <tspan fill="#e9f1ec">P</tspan><tspan fill="url(#sportg)">P</tspan>
        </text>
      </g>
    </svg>
  );
}

/** Same sporty PP with a lightning bolt struck through the middle (gradient + glow). */
export function PPSportBolt({ size = 56, font = "var(--font-cp)" }: { size?: number; font?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="mark" aria-hidden="true">
      <defs>{_GRAD("sportbg")}<filter id="sportbglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g transform="skewX(-9)">
        <text x="33" y="45" textAnchor="middle" fontFamily={font} fontWeight="700" fontSize="29" letterSpacing="1.5">
          <tspan fill="#e9f1ec">P</tspan><tspan fill="url(#sportbg)">P</tspan>
        </text>
        {/* bolt INSIDE the skew (tracks the slant) + centered at the gap (x≈33), touching both P's */}
        <path d="M36 12 L30 31 L34 31 L30 53 L36 32 L32 32 Z" fill="url(#sportbg)" stroke="#0a120e" strokeWidth="1.2" strokeLinejoin="round" filter="url(#sportbglow)" />
      </g>
    </svg>
  );
}
