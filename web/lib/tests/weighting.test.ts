import { describe, it, expect } from "vitest";
import { pickN } from "../weighting";
describe("pickN", () => {
  it("current returns cur", () => expect(pickN(0.3, 0.5, "current")).toBe(0.3));
  it("hist returns hist, falls back to cur", () => { expect(pickN(0.3, 0.5, "hist")).toBe(0.5); expect(pickN(0.3, undefined, "hist")).toBe(0.3); });
  it("blend averages when both numbers", () => expect(pickN(0.3, 0.5, "blend")).toBeCloseTo(0.4));
  it("blend falls back to cur when hist missing", () => expect(pickN(0.3, undefined, "blend")).toBe(0.3));
});
