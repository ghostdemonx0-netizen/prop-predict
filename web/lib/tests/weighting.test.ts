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
});
