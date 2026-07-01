import { describe, it, expect } from "vitest";
import { paceText } from "../pace";

describe("paceText", () => {
  it("runs/hits/bases per game", () => {
    expect(paceText("runs1", 0.55)).toBe("0.55 runs/game");
    expect(paceText("hits2", 1.12)).toBe("1.1 hits/game");
    expect(paceText("tb3", 1.63)).toBe("1.6 bases/game");
  });
  it("HR phrased as 'every N games'", () => {
    expect(paceText("hr", 0.045)).toBe("~1 HR every 22 games");
  });
  it("K per start", () => {
    expect(paceText("k", 5.8)).toBe("5.8 Ks/start");
  });
  it("zero pace is graceful", () => {
    expect(paceText("hr", 0)).toBe("—");
  });
});
