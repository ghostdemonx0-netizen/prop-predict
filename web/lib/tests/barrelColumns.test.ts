import { describe, it, expect } from "vitest";
import { boardsColumnsFor, heatColor } from "../barrelColumns";

describe("boardsColumnsFor", () => {
  it("normal lens shows current-driver columns, no barrel highlights", () => {
    const cols = boardsColumnsFor("normal");
    expect(cols.some((c) => c.key === "matchup")).toBe(true);
    expect(cols.some((c) => c.key === "park")).toBe(true);
    expect(cols.every((c) => !c.highlight)).toBe(true);
    expect(cols.some((c) => c.key === "brl")).toBe(false);
  });
  it("effect lens keeps drivers AND adds highlighted barrel columns", () => {
    const cols = boardsColumnsFor("effect");
    expect(cols.some((c) => c.key === "park")).toBe(true);
    const brl = cols.find((c) => c.key === "brl");
    expect(brl?.highlight).toBe(true);
  });
  it("barrel lens is the full replica column set (kHR + no park/weather)", () => {
    const cols = boardsColumnsFor("barrel");
    expect(cols.some((c) => c.key === "trueScore")).toBe(true);
    expect(cols.some((c) => c.key === "zonefit")).toBe(true);
    expect(cols.some((c) => c.key === "park")).toBe(false);
  });
});

describe("heatColor", () => {
  it("returns an hsl string", () => {
    expect(heatColor(50, 0, 100)).toMatch(/^hsl\(/);
  });
  it("higherBetter=false flips the scale (low value → green-ish, high hue)", () => {
    const lowValGreen = heatColor(0, 0, 100, false);
    const highValRed = heatColor(100, 0, 100, false);
    // green hue (~140) is a larger number than red hue (~4)
    const hue = (s: string) => Number(s.match(/hsl\((\d+)/)![1]);
    expect(hue(lowValGreen)).toBeGreaterThan(hue(highValRed));
  });
});
