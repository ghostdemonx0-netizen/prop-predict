/** The weighting philosophy the user selects for the boards + math. */
export type Philosophy = "normal" | "barrel";

/** Which column set / tilt the Boards heatmap shows. */
export type BoardsLens = "normal" | "effect" | "barrel";

/**
 * Map the philosophy selector + Barrel Effect toggle to a single lens.
 * - Barrel Weight always wins → "barrel" (effect toggle is irrelevant there).
 * - Normal + effect on → "effect" (barrel columns light up on the current board).
 * - Normal + effect off → "normal" (your current drivers only).
 */
export function boardsLens(philosophy: Philosophy, barrelEffect: boolean): BoardsLens {
  if (philosophy === "barrel") return "barrel";
  return barrelEffect ? "effect" : "normal";
}
