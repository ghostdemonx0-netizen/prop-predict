/**
 * TEMPORARY route — orb fill-structure comparison.
 *
 * Lets the user compare 5 different core fill treatments for the probability orb
 * (see OrbVariants.tsx). The /next layout already wraps children in .sp-root and
 * renders the DepthField background, so this page just renders the grid.
 *
 * Delete this route + OrbVariants.tsx once a fill style is chosen.
 */
"use client";

import OrbVariants from "../../../components/spatial/OrbVariants";

export default function OrbsPage() {
  return <OrbVariants />;
}
