/**
 * DepthField.tsx — Volumetric / iridescent depth-field background for the
 * Mock 7 "Spatial Depth" skin.
 *
 * Renders the 5 fixed background layers from mock7.html:
 *   sp-field  — primary violet + cyan + magenta radial blobs
 *   sp-field2 — secondary softer blobs (parallax-driven, opposite direction)
 *   sp-spot   — top-edge spotlight vignette
 *   sp-mesh   — subtle 62 px grid with mask
 *   sp-grain  — film-grain noise overlay
 *
 * Also mounts useParallax() so sp-field and sp-field2 gently track the
 * pointer on desktop, creating the "spatial" depth illusion.
 *
 * Render this component once from layout.tsx — it is a client component because
 * useParallax touches the DOM and pointer events.
 */
"use client";

import { useParallax } from "./hooks";

export function DepthField() {
  const [field1Ref, field2Ref] = useParallax();

  return (
    <>
      {/* Primary gradient blobs — parallax layer 1 (moves away from pointer) */}
      <div ref={field1Ref} className="sp-field" aria-hidden="true" />

      {/* Secondary softer blobs — parallax layer 2 (moves toward pointer) */}
      <div ref={field2Ref} className="sp-field2" aria-hidden="true" />

      {/* Static layers — no parallax */}
      <div className="sp-spot"  aria-hidden="true" />
      <div className="sp-mesh"  aria-hidden="true" />
      <div className="sp-grain" aria-hidden="true" />
    </>
  );
}

export default DepthField;
