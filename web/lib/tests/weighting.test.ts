import { describe, it, expect } from "vitest";
import { pickN, formTier } from "../weighting";
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
