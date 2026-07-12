/**
 * KSpherePair.tsx — a pitcher-K row's two probability orbs, side by side.
 *
 * Left: the existing model-line orb (chance of clearing the book line, e.g.
 * "O 5.5K"). Right: the new projected-line orb (chance of reaching the
 * rounded projection, e.g. "O 7K") — hidden gracefully during rollout if the
 * row hasn't been backfilled with `projProb`/`projLine` yet. Pure display:
 * no math, no data fetching. Reused by Game Hub and the Props board (Task 8).
 */
import ProbabilityOrb from "./ProbabilityOrb";
import type { SpatialRow } from "../../lib/weighting";
import type { ReactNode } from "react";

export function KSpherePair({
  row,
  size = 44,
  tracker,
}: {
  row: SpatialRow;
  size?: number;
  tracker?: ReactNode;
}) {
  const hasProj = typeof row.projProb === "number" && typeof row.projLine === "number";
  return (
    <span className="sp-ksphere-pair">
      {tracker}
      <span className="sp-ksphere">
        <ProbabilityOrb prob={row.prob} kind="k" size={size} />
        <small className="sp-ksphere-cap">
          O {row.line}K <em>(model)</em>
        </small>
      </span>
      {hasProj && (
        <span className="sp-ksphere">
          <ProbabilityOrb prob={row.projProb as number} kind="k" size={size} />
          <small className="sp-ksphere-cap">
            {row.projection ?? row.projLine} K <em>(proj)</em>
          </small>
        </span>
      )}
    </span>
  );
}

export default KSpherePair;
