import type { PropKind } from "./format";

/** Human "season pace" for a prop's raw per-game (or per-start) average. */
export function paceText(kind: PropKind, pace: number): string {
  if (!pace || pace <= 0) return "—";
  if (kind === "k") return `${pace.toFixed(1)} Ks/start`;
  if (kind === "hr") return `~1 HR every ${Math.round(1 / pace)} games`;
  if (kind.startsWith("hits")) return `${pace.toFixed(1)} hits/game`;
  if (kind.startsWith("tb")) return `${pace.toFixed(1)} bases/game`;
  if (kind.startsWith("runs")) return `${pace.toFixed(2)} runs/game`;
  if (kind.startsWith("rbi")) return `${pace.toFixed(2)} RBI/game`;
  if (kind.startsWith("hrr")) return `${pace.toFixed(1)} (H+R+RBI)/game`;
  return `${pace.toFixed(2)}/game`;
}
