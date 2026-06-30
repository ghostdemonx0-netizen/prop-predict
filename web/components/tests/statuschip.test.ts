import { describe, it, expect } from "vitest";
import { chipLabel } from "../StatusChip";

describe("chipLabel", () => {
  it("appends batting order", () => {
    expect(chipLabel("confirmed", 3)).toBe("CONF·#3");
    expect(chipLabel("projected", 1)).toBe("PROJ·#1");
  });
  it("plain when no order", () => {
    expect(chipLabel("confirmed")).toBe("CONF");
    expect(chipLabel("projected")).toBe("PROJ");
  });
  it("null when no status", () => {
    expect(chipLabel(undefined, 3)).toBeNull();
  });
});
