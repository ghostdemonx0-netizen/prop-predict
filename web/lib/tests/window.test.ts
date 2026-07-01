import { describe, it, expect } from "vitest";
import { isActiveWindow } from "../live";
const now = 1_000_000_000_000;
describe("isActiveWindow", () => {
  it("false before start", () => { expect(isActiveWindow([{ id: "1", startMs: now + 1000 }], {}, now)).toBe(false); });
  it("true started+not final", () => { expect(isActiveWindow([{ id: "1", startMs: now - 1000 }], { "1": "Live" }, now)).toBe(true); });
  it("false all final", () => { expect(isActiveWindow([{ id: "1", startMs: now - 1000 }], { "1": "Final" }, now)).toBe(false); });
  it("false no games", () => { expect(isActiveWindow([], {}, now)).toBe(false); });
});
