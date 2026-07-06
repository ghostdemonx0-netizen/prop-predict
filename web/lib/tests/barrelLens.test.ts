import { describe, it, expect } from "vitest";
import { boardsLens } from "../barrelLens";

describe("boardsLens", () => {
  it("normal philosophy with effect off → normal", () => {
    expect(boardsLens("normal", false)).toBe("normal");
  });
  it("normal philosophy with effect on → effect", () => {
    expect(boardsLens("normal", true)).toBe("effect");
  });
  it("barrel philosophy → barrel regardless of effect", () => {
    expect(boardsLens("barrel", false)).toBe("barrel");
    expect(boardsLens("barrel", true)).toBe("barrel");
  });
});
