import { describe, it, expect } from "vitest";
import { deriveLive } from "../live";
const S = (o: any) => ({ game: "1", ...o });
describe("deriveLive need", () => {
  it("from kind/line", () => {
    expect(deriveLive(S({ h: 0 }), "hits2", "Live").need).toBe(2);
    expect(deriveLive(S({ tb: 0 }), "tb4", "Live").need).toBe(4);
    expect(deriveLive(S({ hr: 0 }), "hr", "Live").need).toBe(1);
    expect(deriveLive(S({ pk: 0 }), "k", "Live", "5.5").need).toBe(6);
  });
});
describe("deriveLive have+state", () => {
  it("pregame", () => {
    expect(deriveLive(undefined, "hr", "Preview").state).toBe("pregame");
    expect(deriveLive(undefined, "hr", undefined).state).toBe("pregame");
  });
  it("live short", () => { expect(deriveLive(S({ h: 1 }), "hits2", "Live")).toEqual({ state: "live", have: 1, need: 2 }); });
  it("cleared over, not clamped", () => {
    expect(deriveLive(S({ h: 2 }), "hits1", "Live")).toEqual({ state: "cleared", have: 2, need: 1 });
    expect(deriveLive(S({ pk: 8 }), "k", "Final", "5.5")).toEqual({ state: "cleared", have: 8, need: 6 });
  });
  it("missed only Final+short", () => { expect(deriveLive(S({ h: 1 }), "hits2", "Final")).toEqual({ state: "missed", have: 1, need: 2 }); });
  it("hrr sum, contact=h, batterK=bk", () => {
    expect(deriveLive(S({ h: 1, r: 1, rbi: 1 }), "hrr2", "Live").have).toBe(3);
    expect(deriveLive(S({ h: 2 }), "contact", "Live")).toEqual({ state: "cleared", have: 2, need: 1 });
    expect(deriveLive(S({ bk: 1 }), "batterK", "Final")).toEqual({ state: "cleared", have: 1, need: 1 });
  });
});
