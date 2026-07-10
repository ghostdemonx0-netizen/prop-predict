/**
 * Chevron.tsx — the shared downward accordion chevron used by every collapsible
 * section (Top Plays leaderboards + Boards sections), so dropdowns look and
 * animate identically throughout. Rotates 180° on open via the `.sp-lb-chev`
 * rule in spatial.css.
 */
"use client";

export function Chevron() {
  return (
    <svg
      className="sp-lb-chev"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default Chevron;
