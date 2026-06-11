import { describe, it, expect } from "vitest";
import { pct, windLabel, strengthLabel, sortByProb } from "../../lib/format";

describe("pct", () => {
  it("formats a 0-1 number as a percent string", () => {
    expect(pct(0.31)).toBe("31%");
    expect(pct(0.045)).toBe("5%");
  });
});

describe("windLabel", () => {
  it("describes wind out / in / calm", () => {
    expect(windLabel(10)).toBe("10mph wind out");
    expect(windLabel(-6)).toBe("6mph wind in");
    expect(windLabel(0)).toBe("calm");
  });
});

describe("strengthLabel", () => {
  it("buckets a probability into a label", () => {
    expect(strengthLabel(0.3)).toBe("STRONG");
    expect(strengthLabel(0.18)).toBe("Lean");
    expect(strengthLabel(0.05)).toBe("Pass");
  });
});

describe("sortByProb", () => {
  it("sorts descending by the given key without mutating input", () => {
    const rows = [{ p: 0.1 }, { p: 0.5 }, { p: 0.3 }];
    const out = sortByProb(rows, "p");
    expect(out.map((r) => r.p)).toEqual([0.5, 0.3, 0.1]);
    expect(rows.map((r) => r.p)).toEqual([0.1, 0.5, 0.3]);
  });
});
