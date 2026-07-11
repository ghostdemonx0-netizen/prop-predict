// @vitest-environment jsdom
/**
 * KSpherePair.test.tsx
 *
 * Render test for the model+proj K-probability orb pair. The repo's other
 * spatial tests (orbMath.test.ts) are pure-logic tests under the default
 * "node" vitest environment; this is the first *render* test in the repo, so
 * it opts into jsdom per-file (via the `@vitest-environment` docblock above)
 * rather than flipping the global environment for every existing test.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { KSpherePair } from "../KSpherePair";
import type { SpatialRow } from "../../../lib/weighting";

// ProbabilityOrb → orbFont.ts loads IBM Plex Mono via next/font/google, which
// requires the Next.js SWC font loader plugin — unavailable under plain
// vitest/Vite. Stub it so orbFont.ts's `IBM_Plex_Mono({...})` call resolves
// to a plain object (only `.style.fontFamily` is read by ProbabilityOrb).
vi.mock("next/font/google", () => ({
  IBM_Plex_Mono: () => ({ style: { fontFamily: "monospace" }, className: "" }),
}));

describe("KSpherePair", () => {
  it("renders two orbs with model + proj captions", () => {
    const row = { prob: 0.79, line: "5.5", projProb: 0.44, projLine: 7 } as SpatialRow;
    const { container, getByText } = render(<KSpherePair row={row} size={44} />);
    expect(getByText(/O 5.5K/)).toBeTruthy();
    expect(getByText(/\(model\)/)).toBeTruthy();
    expect(getByText(/O 7K/)).toBeTruthy();
    expect(getByText(/\(proj\)/)).toBeTruthy();
    // two orb SVGs
    expect(container.querySelectorAll("svg").length).toBe(2);
  });

  it("renders only the model orb when proj is missing", () => {
    const row = { prob: 0.79, line: "5.5" } as SpatialRow;
    const { container } = render(<KSpherePair row={row} size={44} />);
    expect(container.querySelectorAll("svg").length).toBe(1);
  });
});
