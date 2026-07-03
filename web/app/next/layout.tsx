import "../../components/spatial/spatial.css";
import { DepthField } from "../../components/spatial/DepthField";

// No viewport override here on purpose: /next inherits the root layout's
// phone-fit viewport (width=600, maximum-scale=1 + the orientation script), so
// mobile shows the same consistent zoomed-out fit as the live site — instead of
// flip-flopping between that and a device-width canvas on refresh.

export default function NextLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sp-root">
      {/* Volumetric depth-field layers + parallax — handled by DepthField */}
      <DepthField />
      {children}
    </div>
  );
}
