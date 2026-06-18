export type PropKind = "hr" | "k" | "hits1" | "hits2" | "hits3" | "tb2" | "tb3" | "tb4";

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

// HR probabilities live around 0.05-0.45; K over-probabilities around 0.35-0.75.
// Hits/TB thresholds have their own ranges so labels mean the same thing on each board.
const TIERS: Record<PropKind, { strong: number; lean: number }> = {
  hr:    { strong: 0.25, lean: 0.12 },
  k:     { strong: 0.60, lean: 0.52 },
  hits1: { strong: 0.70, lean: 0.65 },
  hits2: { strong: 0.40, lean: 0.30 },
  hits3: { strong: 0.15, lean: 0.10 },
  tb2:   { strong: 0.50, lean: 0.45 },
  tb3:   { strong: 0.30, lean: 0.25 },
  tb4:   { strong: 0.20, lean: 0.10 },
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
// Range: lo ≈ lean − margin, hi = lo + span ≈ strong + comparable margin.
// hr: lean=0.12, strong=0.25, margin≈0.07 → lo=0.05, span=0.40 (strong+0.15)
// Mirror pattern for each new kind.
const HEAT: Record<PropKind, { lo: number; span: number }> = {
  hr:    { lo: 0.05, span: 0.40 },
  k:     { lo: 0.35, span: 0.40 },
  hits1: { lo: 0.58, span: 0.22 }, // lean=0.65 → lo=0.58; strong=0.70 → hi=0.80
  hits2: { lo: 0.23, span: 0.24 }, // lean=0.30 → lo=0.23; strong=0.40 → hi=0.47
  hits3: { lo: 0.03, span: 0.19 }, // lean=0.10 → lo=0.03; strong=0.15 → hi=0.22
  tb2:   { lo: 0.38, span: 0.19 }, // lean=0.45 → lo=0.38; strong=0.50 → hi=0.57
  tb3:   { lo: 0.18, span: 0.19 }, // lean=0.25 → lo=0.18; strong=0.30 → hi=0.37
  tb4:   { lo: 0.03, span: 0.24 }, // lean=0.10 → lo=0.03; strong=0.20 → hi=0.27
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
