/**
 * TEMPORARY route — probability-orb light-fill + number-font comparison.
 *
 * Section 1 compares LIGHT center-fill options (bigger orb, no gloss) so the % is
 * easier to read than the near-clear neon-glass center. Section 2 fixes one fill and
 * compares the % number across four fonts. Wrapped in .sp-root so spatial.css tokens
 * + the sp-orbv-* styles apply.
 *
 * Delete this route + components/spatial/OrbVariants.tsx once a fill + font is chosen.
 */
"use client";

import OrbVariants from "../../../components/spatial/OrbVariants";

export default function OrbsPage() {
  return (
    <div className="sp-root">
      <OrbVariants />
    </div>
  );
}
