/**
 * LogosArt4.tsx — "Luminous Glass Emblem" logo exploration for the Mock 7
 * "Spatial Depth" skin.
 *
 * Three premium, ownable brand marks that live in the site's glass + iris + glow
 * world (deep-glass fill, neon rim, top specular, bright inner core — same finish
 * language as ProbabilityOrb) but each carries a DISTINCT, memorable silhouette,
 * intentionally different from every earlier mark (plain orb, bolt-diamond, gem,
 * depth-stack, iris-lens, prism-split, radar, signal peak, seams, monogram, die,
 * pulse, frost, ballpark, precision):
 *
 *   a) Aperture of Foresight — a faceted glass IRIS APERTURE, six swirled blades
 *      closing around a brilliant iris-lit core. Foresight = the model opening to
 *      let insight through. Polygonal, mechanical-glass silhouette.
 *
 *   b) Luminous Droplet — a liquid-glass TEARDROP with a caustic light focus
 *      pooling at its base and a crisp specular highlight up top: one distilled
 *      drop of edge. Pointed-top, round-bottom silhouette.
 *
 *   c) Faceted Prism Sphere — a brilliant-CUT crystal sphere whose crown facets
 *      refract a violet→cyan→mint spectrum with a bright spark of insight at the
 *      table. Round silhouette, but faceted + spectral (not a plain orb).
 *
 * Each renders as a self-contained inline SVG at `size` (default 34), viewBox
 * 0 0 32 32, and stays crisp at ~34px on the dark command-bar background while
 * also working as an app icon.
 *
 * Palette (from spatial.css):
 *   iris-cyan   hsl(188 92% 62%)
 *   iris-violet hsl(264 88% 70%)
 *   iris-mint   hsl(150 82% 60%)
 *   iris-mag    hsl(322 86% 68%)
 *   deep glass  hsl(244 46% 6%)  →  hsl(240 40% 16%)
 *
 * Every gradient / filter / clip id is prefixed per-mark (art4a-, art4b-,
 * art4c-) so nothing collides when all three render together on one page.
 */
import React from "react";

// ── a) Aperture of Foresight ────────────────────────────────────────────────
//    A six-blade glass iris. A dark deep-glass disc holds a swirl of translucent
//    blades whose edges catch the iris gradient; they close down to a hexagonal
//    opening that glows from a bright violet→cyan→mint core — the model opening
//    to let a read-out of insight through.
const ApertureForesight: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="art4a-glass" cx="42%" cy="34%" r="72%">
        <stop offset="0" stopColor="hsl(240 42% 17% / .74)" />
        <stop offset="58%" stopColor="hsl(244 46% 10% / .86)" />
        <stop offset="100%" stopColor="hsl(246 50% 6% / .95)" />
      </radialGradient>
      <linearGradient id="art4a-rim" x1="5" y1="4" x2="27" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 74%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="art4a-core" cx="50%" cy="46%" r="60%">
        <stop offset="0" stopColor="hsl(150 96% 90%)" />
        <stop offset="34%" stopColor="hsl(172 92% 70%)" />
        <stop offset="70%" stopColor="hsl(200 90% 62%)" />
        <stop offset="100%" stopColor="hsl(258 86% 52%)" />
      </radialGradient>
      <filter id="art4a-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.75" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* outer bloom */}
    <circle cx="16" cy="16" r="13.4" fill="url(#art4a-rim)" opacity="0.14" />

    {/* deep-glass disc */}
    <circle cx="16" cy="16" r="12.6" fill="url(#art4a-glass)" />
    {/* neon rim line */}
    <circle cx="16" cy="16" r="12.6" fill="none" stroke="url(#art4a-rim)" strokeWidth="1.7" />
    {/* top gloss arc — sells the glass */}
    <path d="M8 8.5 C 11.5 5.6, 20.5 5.6, 24 8.5" stroke="hsl(0 0% 100% / .3)" strokeWidth="1" strokeLinecap="round" />

    {/* six swirled blade edges (iris gradient), from the hexagon opening out to the rim */}
    <g stroke="url(#art4a-rim)" strokeWidth="1.35" strokeLinecap="round" opacity="0.9" filter="url(#art4a-glow)">
      <path d="M16 10.6 L19.55 5.06" />
      <path d="M20.68 13.3 L27.25 13.61" />
      <path d="M20.68 18.7 L23.69 24.54" />
      <path d="M16 21.4 L12.45 26.94" />
      <path d="M11.32 18.7 L4.75 18.39" />
      <path d="M11.32 13.3 L8.31 7.46" />
    </g>

    {/* inner glow behind the opening */}
    <circle cx="16" cy="16" r="7" fill="url(#art4a-core)" opacity="0.28" filter="url(#art4a-glow)" />

    {/* the hexagonal aperture opening — bright iris-lit core */}
    <path
      d="M16 10.6 L20.68 13.3 L20.68 18.7 L16 21.4 L11.32 18.7 L11.32 13.3 Z"
      fill="url(#art4a-core)"
      stroke="hsl(0 0% 100% / .55)"
      strokeWidth="0.9"
      strokeLinejoin="round"
      filter="url(#art4a-glow)"
    />
    {/* center spark */}
    <circle cx="15.1" cy="15" r="1.15" fill="hsl(0 0% 100% / .92)" />
  </svg>
);

// ── b) Luminous Droplet ──────────────────────────────────────────────────────
//    A liquid-glass teardrop: deep-glass body, iris neon rim, a crisp specular
//    highlight at the top-left, and a bright caustic focus pooling at the base —
//    a single distilled drop of the model's edge.
const LuminousDroplet: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="art4b-glass" cx="40%" cy="30%" r="80%">
        <stop offset="0" stopColor="hsl(238 46% 20% / .78)" />
        <stop offset="52%" stopColor="hsl(244 48% 11% / .88)" />
        <stop offset="100%" stopColor="hsl(248 52% 6% / .96)" />
      </radialGradient>
      <linearGradient id="art4b-rim" x1="9" y1="3" x2="24" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 74%)" />
        <stop offset="0.52" stopColor="hsl(190 92% 66%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="art4b-caustic" cx="50%" cy="50%" r="55%">
        <stop offset="0" stopColor="hsl(160 96% 88%)" />
        <stop offset="42%" stopColor="hsl(180 92% 66%)" />
        <stop offset="100%" stopColor="hsl(210 90% 54% / 0)" />
      </radialGradient>
      <filter id="art4b-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.8" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <clipPath id="art4b-clip">
        <path d="M16 3 C 21 11, 25 15.5, 25 20.2 A 9 9 0 1 1 7 20.2 C 7 15.5, 11 11, 16 3 Z" />
      </clipPath>
    </defs>

    {/* soft bloom around the drop */}
    <path d="M16 3 C 21 11, 25 15.5, 25 20.2 A 9 9 0 1 1 7 20.2 C 7 15.5, 11 11, 16 3 Z"
      fill="url(#art4b-rim)" opacity="0.16" filter="url(#art4b-glow)" />

    {/* teardrop body */}
    <g clipPath="url(#art4b-clip)">
      <path d="M16 3 C 21 11, 25 15.5, 25 20.2 A 9 9 0 1 1 7 20.2 C 7 15.5, 11 11, 16 3 Z" fill="url(#art4b-glass)" />
      {/* caustic focus pooling low in the drop */}
      <ellipse cx="16" cy="22" rx="7" ry="6" fill="url(#art4b-caustic)" opacity="0.85" filter="url(#art4b-glow)" />
      {/* inner refracted highlight sweep */}
      <path d="M12 8 C 9 12, 8 16, 9 20" stroke="hsl(0 0% 100% / .28)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </g>

    {/* neon iris rim */}
    <path
      d="M16 3 C 21 11, 25 15.5, 25 20.2 A 9 9 0 1 1 7 20.2 C 7 15.5, 11 11, 16 3 Z"
      fill="none"
      stroke="url(#art4b-rim)"
      strokeWidth="1.7"
      strokeLinejoin="round"
      filter="url(#art4b-glow)"
    />

    {/* crisp specular highlight, top-left */}
    <ellipse cx="12.6" cy="10.4" rx="1.7" ry="2.7" fill="hsl(0 0% 100% / .8)" transform="rotate(-24 12.6 10.4)" />
    {/* bright caustic spark at the base */}
    <circle cx="16" cy="21.6" r="1.25" fill="hsl(0 0% 100% / .92)" filter="url(#art4b-glow)" />
  </svg>
);

// ── c) Faceted Prism Sphere ──────────────────────────────────────────────────
//    A brilliant-cut crystal sphere. Deep-glass ball with a neon iris rim; its
//    crown facets refract a violet→cyan→mint spectrum, and a bright spark of
//    insight sits at the table — the model turning depth into a read edge.
const FacetPrismSphere: React.FC<{ size?: number }> = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <defs>
      <radialGradient id="art4c-glass" cx="42%" cy="32%" r="74%">
        <stop offset="0" stopColor="hsl(240 42% 18% / .72)" />
        <stop offset="60%" stopColor="hsl(244 46% 10% / .86)" />
        <stop offset="100%" stopColor="hsl(246 50% 6% / .96)" />
      </radialGradient>
      <linearGradient id="art4c-rim" x1="5" y1="4" x2="27" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="hsl(264 88% 74%)" />
        <stop offset="0.5" stopColor="hsl(188 92% 66%)" />
        <stop offset="1" stopColor="hsl(150 84% 62%)" />
      </linearGradient>
      <radialGradient id="art4c-core" cx="50%" cy="44%" r="60%">
        <stop offset="0" stopColor="hsl(150 96% 92%)" />
        <stop offset="40%" stopColor="hsl(174 92% 70%)" />
        <stop offset="78%" stopColor="hsl(202 90% 60%)" />
        <stop offset="100%" stopColor="hsl(258 86% 52%)" />
      </radialGradient>
      <filter id="art4c-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.7" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <clipPath id="art4c-clip">
        <circle cx="16" cy="16" r="12.6" />
      </clipPath>
    </defs>

    {/* outer bloom */}
    <circle cx="16" cy="16" r="13.4" fill="url(#art4c-rim)" opacity="0.14" />

    {/* deep-glass sphere */}
    <circle cx="16" cy="16" r="12.6" fill="url(#art4c-glass)" />

    {/* refracted crown facets — three alternating wedges tinted with the spectrum */}
    <g clipPath="url(#art4c-clip)" opacity="0.6">
      {/* top-right wedge → cyan */}
      <path d="M16 10 L20.33 12.5 L26.39 10 L16 4 Z" fill="hsl(188 92% 62%)" opacity="0.5" />
      {/* lower-right wedge → mint */}
      <path d="M20.33 17.5 L16 20 L16 28 L26.39 22 Z" fill="hsl(150 84% 60%)" opacity="0.45" />
      {/* left wedge → violet */}
      <path d="M11.67 17.5 L11.67 12.5 L5.61 10 L5.61 22 Z" fill="hsl(264 88% 70%)" opacity="0.5" />
    </g>

    {/* inner glow behind the table */}
    <circle cx="16" cy="15" r="5.6" fill="url(#art4c-core)" opacity="0.3" filter="url(#art4c-glow)" />

    {/* facet spokes — table vertices out to the girdle */}
    <g stroke="hsl(0 0% 100% / .32)" strokeWidth="0.7" strokeLinecap="round">
      <path d="M16 10 L16 4" />
      <path d="M20.33 12.5 L26.39 10" />
      <path d="M20.33 17.5 L26.39 22" />
      <path d="M16 20 L16 28" />
      <path d="M11.67 17.5 L5.61 22" />
      <path d="M11.67 12.5 L5.61 10" />
    </g>

    {/* the table facet — bright iris-lit hexagon (the spark of insight) */}
    <path
      d="M16 10 L20.33 12.5 L20.33 17.5 L16 20 L11.67 17.5 L11.67 12.5 Z"
      fill="url(#art4c-core)"
      stroke="hsl(0 0% 100% / .5)"
      strokeWidth="0.85"
      strokeLinejoin="round"
      filter="url(#art4c-glow)"
    />

    {/* neon iris rim + top gloss */}
    <circle cx="16" cy="16" r="12.6" fill="none" stroke="url(#art4c-rim)" strokeWidth="1.7" />
    <path d="M8 8.5 C 11.5 5.6, 20.5 5.6, 24 8.5" stroke="hsl(0 0% 100% / .3)" strokeWidth="1" strokeLinecap="round" />
    {/* table glint */}
    <circle cx="15" cy="14" r="1.05" fill="hsl(0 0% 100% / .92)" />
  </svg>
);

export const LOGOS_ART4: { name: string; El: React.FC<{ size?: number }> }[] = [
  { name: "Aperture of Foresight", El: ApertureForesight },
  { name: "Luminous Droplet", El: LuminousDroplet },
  { name: "Faceted Prism Sphere", El: FacetPrismSphere },
];

export default LOGOS_ART4;
