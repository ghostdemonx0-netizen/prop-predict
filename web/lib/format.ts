export type PropKind = "hr" | "k";

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

// HR probabilities live around 0.05-0.45; K over-probabilities around 0.35-0.75.
// Each prop gets its own thresholds so labels mean the same thing on both boards.
const TIERS: Record<PropKind, { strong: number; lean: number }> = {
  hr: { strong: 0.25, lean: 0.12 },
  k: { strong: 0.6, lean: 0.52 },
};

export function strengthTier(prob: number, kind: PropKind = "hr"): "strong" | "lean" | "pass" {
  const t = TIERS[kind];
  return prob >= t.strong ? "strong" : prob >= t.lean ? "lean" : "pass";
}

export function strengthLabel(prob: number, kind: PropKind = "hr"): string {
  const tier = strengthTier(prob, kind);
  return tier === "strong" ? "STRONG" : tier === "lean" ? "Lean" : "Pass";
}

// Heat-map: cool blue (low) -> warm red-orange (high) across each prop's own range.
const HEAT: Record<PropKind, { lo: number; span: number }> = {
  hr: { lo: 0.05, span: 0.4 },
  k: { lo: 0.35, span: 0.4 },
};

export function heatColor(p: number, kind: PropKind = "hr"): string {
  const { lo, span } = HEAT[kind];
  const t = Math.max(0, Math.min(1, (p - lo) / span));
  return `hsl(${210 - t * 210}, 52%, 40%)`;
}

// Wind direction-of-travel relative to center field: 0 = out to CF,
// 90 = out to RF, 180 = blowing in, 270 = out to LF.
const DIRS = [
  "out to center", "out to right-center", "out to right field", "blowing in (right)",
  "blowing in", "blowing in (left)", "out to left field", "out to left-center",
];

export function windText(dir: number): string {
  return DIRS[Math.round((((dir % 360) + 360) % 360) / 45) % 8];
}

export function arrowColor(dir: number): string {
  const c = Math.cos((dir * Math.PI) / 180);
  return c > 0.2 ? "var(--green)" : c < -0.2 ? "var(--red)" : "var(--amber)";
}

export function gameTimeLabel(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? undefined
    : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

// A batter has the platoon edge facing the opposite hand, or as a switch hitter.
// Hands look like "RHB"/"LHB"/"SW" (batter) and "RHP"/"LHP" (pitcher); we compare
// the leading R/L/S. Returns false when either side is unknown.
export function platoonAdvantage(playerHand?: string, oppHand?: string): boolean {
  if (!playerHand || !oppHand) return false;
  return playerHand === "SW" || playerHand[0] !== oppHand[0];
}
