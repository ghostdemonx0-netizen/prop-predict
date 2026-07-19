import { describe, it, expect } from "vitest";
import { computeTB, parseBoxscore, buildPayload, statFor, propNeed } from "../live";

const BOX = {
  teams: {
    away: { players: {
      ID111: { person: { id: 111 }, stats: { batting: { hits: 2, doubles: 1, triples: 0, homeRuns: 1, runs: 1, rbi: 3, strikeOuts: 1 } } },
    } },
    home: { players: {
      ID222: { person: { id: 222 }, stats: { pitching: { strikeOuts: 7 } } },
      ID333: { person: { id: 333 }, stats: { batting: {} } },
    } },
  },
};
const SCHED = { dates: [{ games: [
  { gamePk: 900, status: { abstractGameState: "Live" } },
  { gamePk: 901, status: { abstractGameState: "Preview" } },
] }] };

describe("computeTB", () => {
  it("h+d+2t+3hr", () => { expect(computeTB(2, 1, 0, 1)).toBe(6); });
});
describe("parseBoxscore", () => {
  it("extracts batter + pitcher, skips no-PA", () => {
    const p = parseBoxscore("900", BOX);
    expect(p["111"]).toEqual({ game: "900", h: 2, tb: 6, hr: 1, r: 1, rbi: 3, bk: 1 });
    expect(p["222"]).toEqual({ game: "900", pk: 7 });
    expect(p["333"]).toBeUndefined();
  });
});
describe("buildPayload", () => {
  it("maps statuses + merges players", () => {
    const pay = buildPayload(SCHED, { "900": BOX }, "2026-07-01T23:00:00Z");
    expect(pay.games).toEqual({ "900": "Live", "901": "Preview" });
    expect(statFor(pay, "111", "900")?.h).toBe(2);
    expect(pay.updated).toBe("2026-07-01T23:00:00Z");
  });

  it("keeps each game's stats SEPARATE for a doubleheader player", () => {
    // Same player id (42) in two games of a doubleheader: homered in game 1
    // (111), did NOT in game 2 (222). The tracker must not bleed game 1's HR
    // onto the game-2 row.
    const g1 = { teams: {
      away: { players: { ID42: { person: { id: 42 }, stats: { batting: { hits: 1, homeRuns: 1, atBats: 3 } } } } },
      home: { players: {} },
    } };
    const g2 = { teams: {
      away: { players: { ID42: { person: { id: 42 }, stats: { batting: { hits: 0, homeRuns: 0, atBats: 2 } } } } },
      home: { players: {} },
    } };
    const sched = { dates: [{ games: [
      { gamePk: 111, status: { abstractGameState: "Final" } },
      { gamePk: 222, status: { abstractGameState: "Live" } },
    ] }] };
    const pay = buildPayload(sched, { "111": g1, "222": g2 }, "t");
    expect(statFor(pay, "42", "111")?.hr).toBe(1); // homered in game 1
    expect(statFor(pay, "42", "222")?.hr).toBe(0); // NOT in game 2
    // no gameId → no stat (row falls back to pregame, unchanged behavior)
    expect(statFor(pay, "42")).toBeUndefined();
  });
});
describe("propNeed", () => {
  // Top Pitchers box feeds `String(projLine - 0.5)` as the tracker line so the
  // K need lands on the rounded projection itself, not floor(raw proj)+1.
  it("proj-line half-line yields tracker need === round(proj)", () => {
    const projLine = 6; // e.g. proj 6.4 -> round 6
    const lineStr = String(projLine - 0.5); // "5.5"
    expect(propNeed("k", lineStr)).toBe(6); // NOT 7
    const projLine2 = 7; // proj 6.7 -> 7
    expect(propNeed("k", String(projLine2 - 0.5))).toBe(7);
  });
});
