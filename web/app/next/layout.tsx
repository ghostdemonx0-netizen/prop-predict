import type { Viewport } from "next";
import "../../components/spatial/spatial.css";

// Override the root layout's phone-fit viewport for the /next segment.
// Nested segment viewport exports take precedence over parent segments.
// This gives the new skin a native device-width canvas on all form factors.
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function NextLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sp-root">
      {/* Volumetric depth-field layers — spatial background */}
      <div className="field" aria-hidden="true" />
      <div className="field2" aria-hidden="true" />
      <div className="spot" aria-hidden="true" />
      <div className="mesh" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      {children}
    </div>
  );
}
