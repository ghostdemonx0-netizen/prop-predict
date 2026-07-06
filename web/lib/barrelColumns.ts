import type { BoardsLens } from "./barrelLens";

export interface ColumnDef {
  key: string;
  label: string;
  min: number;
  max: number;
  /** default true; false = lower is better (e.g. SwStr% for a hitter) */
  higherBetter?: boolean;
  /** effect lens: barrel columns that "light up" on the current board */
  highlight?: boolean;
}

/** Your current model's drivers (the "Normal" board). */
const DRIVER_COLUMNS: ColumnDef[] = [
  { key: "trueScore", label: "Score",   min: 20, max: 90 },
  { key: "matchup",   label: "Matchup", min: 30, max: 90 },
  { key: "park",      label: "Park",    min: -15, max: 15 },
  { key: "weather",   label: "Wx",      min: -15, max: 15 },
  { key: "platoon",   label: "Platoon", min: -6, max: 6 },
  { key: "pitcher",   label: "Pitcher", min: -20, max: 20 },
  { key: "form",      label: "Form",    min: -20, max: 20 },
  { key: "hardhit",   label: "HH%",     min: 25, max: 55 },
];

/** Barrel-recipe columns that light up when Barrel Effect is ON.
 *  (Matchup + HH already live in DRIVER_COLUMNS; these are the barrel adds.) */
const BARREL_HIGHLIGHTS: ColumnDef[] = [
  { key: "brl",      label: "Brl/BIP", min: 3, max: 20, highlight: true },
  { key: "pbrl",     label: "PullBrl", min: 1, max: 12, highlight: true },
  { key: "sweet",    label: "Sweet%",  min: 25, max: 45, highlight: true },
  { key: "zonefit",  label: "ZoneFit", min: 0.02, max: 0.16, highlight: true },
  { key: "iso",      label: "ISO",     min: 0.08, max: 0.30, highlight: true },
  { key: "hrform",   label: "HR Form", min: 20, max: 90, highlight: true },
  { key: "xwoba",    label: "xwOBA",   min: 0.26, max: 0.42, highlight: true },
  { key: "xwobacon", label: "xwOBAc",  min: 0.26, max: 0.46, highlight: true },
  { key: "fb",       label: "FB%",     min: 18, max: 45, highlight: true },
  { key: "la",       label: "LA",      min: 8, max: 24, highlight: true },
  { key: "hrfb",     label: "HR/FB%",  min: 5, max: 35, highlight: true },
];

/** The Kasper/Barrel-Lab replica column set (no park/weather). */
const REPLICA_COLUMNS: ColumnDef[] = [
  { key: "trueScore", label: "Score",   min: 20, max: 90 },
  { key: "matchup",   label: "Matchup", min: 30, max: 90 },
  { key: "zonefit",   label: "ZoneFit", min: 0.02, max: 0.16 },
  { key: "hrform",    label: "HR Form", min: 20, max: 90 },
  { key: "iso",       label: "ISO",     min: 0.08, max: 0.30 },
  { key: "xwoba",     label: "xwOBA",   min: 0.26, max: 0.42 },
  { key: "xwobacon",  label: "xwOBAc",  min: 0.26, max: 0.46 },
  { key: "swstr",     label: "SwStr",   min: 5, max: 18, higherBetter: false },
  { key: "pbrl",      label: "PullBrl", min: 1, max: 12 },
  { key: "brl",       label: "Brl/BIP", min: 3, max: 20 },
  { key: "sweet",     label: "Sweet%",  min: 25, max: 45 },
  { key: "fb",        label: "FB%",     min: 18, max: 45 },
  { key: "hh",        label: "HH%",     min: 25, max: 55 },
  { key: "la",        label: "LA",      min: 8, max: 24 },
  { key: "hrfb",      label: "HR/FB%",  min: 5, max: 35 },
];

export function boardsColumnsFor(lens: BoardsLens): ColumnDef[] {
  if (lens === "barrel") return REPLICA_COLUMNS;
  if (lens === "effect") return [...DRIVER_COLUMNS, ...BARREL_HIGHLIGHTS];
  return DRIVER_COLUMNS;
}

/** Pitcher board columns (barrel-allowed + whiff), Kasper "Top Slate Pitchers". */
export const PITCHER_COLUMNS: ColumnDef[] = [
  { key: "pscore", label: "P Score", min: 30, max: 60 },
  { key: "kscore", label: "K Score", min: 30, max: 60 },
  { key: "xwoba",  label: "xwOBA",   min: 0.26, max: 0.40, higherBetter: false },
  { key: "csw",    label: "CSW%",    min: 22, max: 34 },
  { key: "swstr",  label: "SwStr%",  min: 6, max: 18 },
  { key: "ball",   label: "Ball%",   min: 30, max: 42, higherBetter: false },
  { key: "pbrl",   label: "PBrl%",   min: 3, max: 8, higherBetter: false },
  { key: "brlbip", label: "Brl BIP", min: 4, max: 12, higherBetter: false },
  { key: "fb",     label: "FB%",     min: 18, max: 45, higherBetter: false },
  { key: "hh",     label: "HH%",     min: 35, max: 52, higherBetter: false },
];

/**
 * Heatmap cell background. t=0 → red (hue 4), t=1 → green (hue 140), amber mid.
 * higherBetter=false flips so low values read green.
 */
export function heatColor(value: number, min: number, max: number, higherBetter = true): string {
  const clamped = Math.max(min, Math.min(max, value));
  let t = max === min ? 0.5 : (clamped - min) / (max - min);
  if (!higherBetter) t = 1 - t;
  const hue = Math.round(4 + t * (140 - 4));
  return `hsl(${hue} 60% 42% / 0.55)`;
}
