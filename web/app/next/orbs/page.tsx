/**
 * TEMPORARY route — probability-orb sphere-FILL comparison.
 *
 * Renders OrbVariants: five DARK/GLASS center fills (Cards glass, Cards glass
 * frosted, Deep glass, Smoked glass, Neon glass near-clear) across three sample
 * probabilities. Every variant keeps the neon ring + SVG progress ring +
 * centered % (IBM Plex Mono). Wrapped in .sp-root so spatial.css tokens + the
 * sp-orbv-* styles apply.
 *
 * Delete this route + components/spatial/OrbVariants.tsx once a fill is chosen.
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
