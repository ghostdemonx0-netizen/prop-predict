/** MOCK data for the Barrel boards prototype (Phase 1). Not real projections. */

export interface MockHitter {
  id: number;
  name: string;
  hand: "R" | "L" | "SW";
  team: string;
  order: number;
  /** every column key → a plausible value */
  stats: Record<string, number>;
}

export interface MockPitcher {
  name: string;
  team: string;
  throws: "R" | "L";
  opp: string;
  stats: Record<string, number>;
}

export interface MockGame {
  id: string;
  away: string;
  home: string;
  venue: string;
  note: string;
  awayPitcher: string;
  homePitcher: string;
  awayHitters: MockHitter[];
  homeHitters: MockHitter[];
}

// Default stat block so each hitter only overrides what makes them interesting.
const BASE: Record<string, number> = {
  trueScore: 50, matchup: 55, park: 0, weather: 0, platoon: 0, pitcher: 0,
  form: 0, hardhit: 38, brl: 9, pbrl: 5, sweet: 34, zonefit: 0.08,
  hrform: 55, iso: 0.17, xwoba: 0.33, xwobacon: 0.36, swstr: 10,
  fb: 30, hh: 40, la: 15,
};

let _id = 100;
function h(
  name: string, hand: "R" | "L" | "SW", team: string, order: number,
  o: Record<string, number>,
): MockHitter {
  return { id: _id++, name, hand, team, order, stats: { ...BASE, ...o } };
}

export const MOCK_GAMES: MockGame[] = [
  {
    id: "CWS-BAL",
    away: "CWS", home: "BAL", venue: "Camden Yards",
    note: "Sneaky Value Spot",
    awayPitcher: "Sean Burke", homePitcher: "Shane Baz",
    awayHitters: [
      h("Colson Montgomery", "L", "CWS", 1, { trueScore: 75, matchup: 67, hrform: 62, pbrl: 9, brl: 14, iso: 0.26, xwoba: 0.33, xwobacon: 0.45, hh: 45, la: 19, zonefit: 0.105 }),
      h("Andrew Benintendi", "L", "CWS", 2, { trueScore: 60, matchup: 57, hrform: 66, pbrl: 10, brl: 10, iso: 0.20, hh: 42, la: 18 }),
      h("Miguel Vargas", "R", "CWS", 3, { trueScore: 67, matchup: 54, hrform: 80, pbrl: 9, brl: 12, iso: 0.24, hh: 42, la: 21 }),
      h("Luis Robert", "R", "CWS", 4, { trueScore: 44, matchup: 45, hrform: 40, pbrl: 5, brl: 5, iso: 0.16, swstr: 15, hh: 30, la: 12 }),
    ],
    homeHitters: [
      h("Gunnar Henderson", "L", "BAL", 1, { trueScore: 72, matchup: 64, hrform: 70, pbrl: 8, brl: 13, iso: 0.24, hh: 47, la: 17, zonefit: 0.12 }),
      h("Adley Rutschman", "SW", "BAL", 2, { trueScore: 58, matchup: 59, hrform: 55, pbrl: 6, brl: 9, iso: 0.18, swstr: 7, zonefit: 0.10 }),
      h("Ryan Mountcastle", "R", "BAL", 3, { trueScore: 61, matchup: 56, hrform: 58, pbrl: 7, brl: 11, iso: 0.21, hh: 44 }),
      h("Cedric Mullins", "L", "BAL", 4, { trueScore: 47, matchup: 48, hrform: 45, pbrl: 4, brl: 6, iso: 0.15, la: 13 }),
    ],
  },
  {
    id: "NYM-ATL",
    away: "NYM", home: "ATL", venue: "Truist Park",
    note: "Power Park",
    awayPitcher: "Grant Holmes", homePitcher: "Christian Scott",
    awayHitters: [
      h("Pete Alonso", "R", "NYM", 1, { trueScore: 77, matchup: 76, hrform: 62, pbrl: 6, brl: 15, iso: 0.22, hh: 46, la: 18, zonefit: 0.115 }),
      h("Francisco Lindor", "SW", "NYM", 2, { trueScore: 64, matchup: 60, hrform: 58, pbrl: 7, brl: 10, iso: 0.21, swstr: 8 }),
      h("Brandon Nimmo", "L", "NYM", 3, { trueScore: 55, matchup: 54, hrform: 52, pbrl: 5, brl: 8, iso: 0.18 }),
    ],
    homeHitters: [
      h("Matt Olson", "L", "ATL", 1, { trueScore: 70, matchup: 63, hrform: 60, pbrl: 9, brl: 13, iso: 0.25, hh: 48, la: 19 }),
      h("Ronald Acuña Jr.", "R", "ATL", 2, { trueScore: 73, matchup: 66, hrform: 68, pbrl: 8, brl: 12, iso: 0.23, hh: 45, zonefit: 0.13 }),
      h("Austin Riley", "R", "ATL", 3, { trueScore: 66, matchup: 58, hrform: 61, pbrl: 7, brl: 12, iso: 0.24, hh: 46 }),
    ],
  },
];

export const MOCK_PITCHER_BOARD: MockPitcher[] = [
  { name: "Shane Baz",       team: "BAL", throws: "R", opp: "CWS", stats: { pscore: 51, kscore: 47, xwoba: 0.30, csw: 29, swstr: 13, ball: 35, pbrl: 3.8, brlbip: 6.2, fb: 25, hh: 42 } },
  { name: "Sean Burke",      team: "CWS", throws: "R", opp: "BAL", stats: { pscore: 45, kscore: 43, xwoba: 0.33, csw: 27, swstr: 10, ball: 37, pbrl: 5.2, brlbip: 9.1, fb: 30, hh: 46 } },
  { name: "Christian Scott", team: "NYM", throws: "R", opp: "ATL", stats: { pscore: 48, kscore: 45, xwoba: 0.31, csw: 28, swstr: 12, ball: 34, pbrl: 4.1, brlbip: 7.0, fb: 27, hh: 43 } },
  { name: "Grant Holmes",    team: "ATL", throws: "R", opp: "NYM", stats: { pscore: 44, kscore: 41, xwoba: 0.34, csw: 25, swstr: 9,  ball: 38, pbrl: 5.6, brlbip: 9.8, fb: 31, hh: 47 } },
];
