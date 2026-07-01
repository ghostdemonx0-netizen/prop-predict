import { describe, it, expect } from "vitest";
import { platoonEdge } from "../platoon";

describe("platoonEdge", () => {
  it("opposite hands = advantage", () => {
    expect(platoonEdge("R", "L")).toBe(true);
    expect(platoonEdge("L", "R")).toBe(true);
  });
  it("same hand = no advantage", () => {
    expect(platoonEdge("R", "R")).toBe(false);
    expect(platoonEdge("L", "L")).toBe(false);
  });
  it("switch hitter always has the edge", () => {
    expect(platoonEdge("S", "R")).toBe(true);
    expect(platoonEdge("S", "L")).toBe(true);
  });
  it("defaults to R when missing", () => {
    expect(platoonEdge(undefined, undefined)).toBe(false);
  });
});
