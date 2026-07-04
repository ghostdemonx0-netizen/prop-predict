/**
 * TEMPORARY route — font-legibility comparison.
 *
 * Renders the same UI sample in four font sets (see FontVariants.tsx) so the user
 * can compare small-size readability at the phone "zoomed-out" scale. Wrapped in
 * .sp-root so the spatial.css sample styles + font vars apply.
 *
 * Delete this route + FontVariants.tsx once a font set is chosen.
 */
"use client";

import FontVariants from "../../../components/spatial/FontVariants";

export default function FontsPage() {
  return (
    <div className="sp-root">
      <FontVariants />
    </div>
  );
}
