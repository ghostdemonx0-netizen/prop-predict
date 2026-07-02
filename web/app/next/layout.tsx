import type { Viewport } from "next";
import "../../components/spatial/spatial.css";
import { DepthField } from "../../components/spatial/DepthField";

// Override the root layout's phone-fit viewport for the /next segment.
// Nested segment viewport exports take precedence over parent segments.
// This gives the new skin a native device-width canvas on all form factors.
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function NextLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sp-root">
      {/* Volumetric depth-field layers + parallax — handled by DepthField */}
      <DepthField />
      {children}
    </div>
  );
}
