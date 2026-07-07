import { describe, it, expect } from "vitest";
import { pickN, formTier, toBoardRows } from "../weighting";
import type { Projections } from "../types";
describe("pickN", () => {
  it("current returns cur", () => expect(pickN(0.3, 0.5, "current")).toBe(0.3));
  it("hist returns hist, falls back to cur", () => { expect(pickN(0.3, 0.5, "hist")).toBe(0.5); expect(pickN(0.3, undefined, "hist")).toBe(0.3); });
  it("blend averages when both numbers", () => expect(pickN(0.3, 0.5, "blend")).toBeCloseTo(0.4));
  it("blend falls back to cur when hist missing", () => expect(pickN(0.3, undefined, "blend")).toBe(0.3));
});
describe("formTier", () => {
  it("hot when mult clears 1.03", () => expect(formTier(1.04)).toBe("hot"));
  it("cold when mult below 0.97", () => expect(formTier(0.9)).toBe("cold"));
  it("steady between 0.97 and 1.03", () => { expect(formTier(1.0)).toBe("steady"); expect(formTier(0.97)).toBe("steady"); expect(formTier(1.03)).toBe("steady"); });
  it("undefined when the mult is missing", () => expect(formTier(undefined)).toBeUndefined());
});
describe("toBoardRows", () => {
  it("barrelEffect picks the _beff HR probability", () => {
    const data = { hr: [{ player: "X", team: "BOS", player_id: 1, game_id: 1,
      probability: 0.15, probability_beff: 0.18,
      probability_hist: 0.18, probability_hist_beff: 0.216 }] } as unknown as Projections;
    const off = toBoardRows(data, "hr", 0, "current", false)[0].prob;
    const on  = toBoardRows(data, "hr", 0, "current", true)[0].prob;
    expect(off).toBeCloseTo(0.15);
    expect(on).toBeCloseTo(0.18);
  });

  it("barrelEffect picks the _beff twin for a hits threshold prop", () => {
    const hitsRow = {
      player: "A", team: "NYY", player_id: 10, game_id: 2,
      p_ge2: 0.40, p_ge2_hist: 0.42,
      p_ge2_beff: 0.50, p_ge2_beff_hist: 0.52,
      // other required fields with defaults
      p_ge1: 0.70, p_ge3: 0.15,
    };
    const data = { hr: [], strikeouts: [], hits: [hitsRow] } as unknown as Projections;

    const off = toBoardRows(data, "hits2", 2, "current", false)[0].prob;
    const on  = toBoardRows(data, "hits2", 2, "current", true)[0].prob;
    expect(off).toBeCloseTo(0.40);
    expect(on).toBeCloseTo(0.50);

    // blend source: averages the _beff twins when barrelEffect=true
    const onBlend = toBoardRows(data, "hits2", 2, "blend", true)[0].prob;
    expect(onBlend).toBeCloseTo((0.50 + 0.52) / 2);
  });

  it("barrelEffect picks the _beff twin for a run prop (runs1)", () => {
    const runsRow = {
      player: "B", team: "LAD", player_id: 20, game_id: 3,
      p_ge1: 0.35, p_ge1_hist: 0.38,
      p_ge1_beff: 0.45, p_ge1_beff_hist: 0.48,
      p_ge2: 0.10,
    };
    const data = { hr: [], strikeouts: [], runs: [runsRow] } as unknown as Projections;

    const off = toBoardRows(data, "runs1", 1, "current", false)[0].prob;
    const on  = toBoardRows(data, "runs1", 1, "current", true)[0].prob;
    expect(off).toBeCloseTo(0.35);
    expect(on).toBeCloseTo(0.45);
  });
});
