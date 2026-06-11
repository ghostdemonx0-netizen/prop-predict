import { describe, it, expect } from "vitest";
import { pct, strengthLabel, strengthTier, heatColor, windText, arrowColor } from "../../lib/format";

describe("pct", () => {
  it("formats a 0-1 number as a percent string", () => {
    expect(pct(0.31)).toBe("31%");
    expect(pct(0.045)).toBe("5%");
  });
});

describe("strengthLabel / strengthTier", () => {
  it("uses HR thresholds by default", () => {
    expect(strengthLabel(0.3)).toBe("STRONG");
    expect(strengthLabel(0.18)).toBe("Lean");
    expect(strengthLabel(0.05)).toBe("Pass");
  });
  it("uses K-specific thresholds for over-probabilities", () => {
    expect(strengthLabel(0.65, "k")).toBe("STRONG");
    expect(strengthLabel(0.55, "k")).toBe("Lean");
    expect(strengthLabel(0.45, "k")).toBe("Pass");
  });
  it("tier matches label buckets", () => {
    expect(strengthTier(0.3, "hr")).toBe("strong");
    expect(strengthTier(0.45, "k")).toBe("pass");
  });
});

describe("heatColor", () => {
  it("spans the same blue->red range on each prop's own scale", () => {
    expect(heatColor(0.05)).toBe(heatColor(0.35, "k"));  // both bottom of scale
    expect(heatColor(0.45)).toBe(heatColor(0.75, "k"));  // both top of scale
  });
});

describe("wind helpers", () => {
  it("describes the wind direction relative to center field", () => {
    expect(windText(0)).toBe("out to center");
    expect(windText(180)).toBe("blowing in");
  });
  it("colors out-wind green, in-wind red, crosswind amber", () => {
    expect(arrowColor(0)).toBe("var(--green)");
    expect(arrowColor(180)).toBe("var(--red)");
    expect(arrowColor(90)).toBe("var(--amber)");
  });
});
