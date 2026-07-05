/**
 * chips.tsx — Reusable UI atoms for the Mock 7 "Spatial Depth" skin.
 *
 * Exports: Badge, TagChip, HandChip, FormChip, FBox, Bvp.
 * All styles live in spatial.css under .sp-root (prefixed sp-*).
 *
 * HandChip .adv = cyan glow — visually distinct from the green
 * conf TagChip (different hue: cyan hsl-188 vs mint hsl-150).
 */
"use client";

import "./spatial.css";
import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
//  Shared environment-chip colour helpers
//
//  These give EVERY env chip (Park %, Wx %, Temp) one consistent colour scale
//  across every surface (board Cards, Game Hub, Parks ledger, …), so the same
//  chip is never coloured on one surface and plain on another.
// ─────────────────────────────────────────────────────────────────────────────

/** Colour for a signed offense-impact multiplier (park, weather, or combined
 *  env). Mirrors EnvDot's green / amber / red sign logic (GlassDot.tsx) so the
 *  flat env chips match the env spheres: favors offense → green, suppresses →
 *  red, neutral → amber. `mult` is a multiplier around 1 (e.g. 1.08 = +8%). */
export function envImpactColor(mult: number): string {
  const b = mult - 1;
  if (b >= 0.02) return "var(--green)";
  if (b <= -0.02) return "var(--red)";
  return "var(--amber)";
}

/** Progressive weather-heat colour for a temperature pill (unchanged scale,
 *  now shared so every surface colours temp identically):
 *  cold (<60°) blue · mild (60–78°) green · warm (79–88°) amber · hot (>88°) red. */
export function tempColor(t: number): string {
  if (t < 60) return "var(--iris-cyan)";
  if (t <= 78) return "var(--green)";
  if (t <= 88) return "var(--amber)";
  return "var(--red)";
}

// ─────────────────────────────────────────────────────────────────────────────
//  Badge — Strong / Lean / Pass tier label
// ─────────────────────────────────────────────────────────────────────────────

export type BadgeKind = "strong" | "lean" | "pass";

const BADGE_DEFAULTS: Record<BadgeKind, string> = {
  strong: "Strong",
  lean:   "Lean",
  pass:   "Pass",
};

export function Badge({
  kind,
  children,
}: {
  kind: BadgeKind;
  children?: ReactNode;
}) {
  return (
    <span className={`sp-badge sp-badge--${kind}`}>
      {children ?? BADGE_DEFAULTS[kind]}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TagChip — "conf" | "proj" status + optional batting-order suffix  ·#N
// ─────────────────────────────────────────────────────────────────────────────

export type TagStatus = "conf" | "proj";

export function TagChip({
  status,
  order,
}: {
  status: TagStatus;
  order?: number;
}) {
  return (
    <span className={`sp-tagchip sp-tagchip--${status}`}>
      {status}
      {order != null ? ` ·#${order}` : ""}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TeamChip — compact muted team-abbreviation pill (e.g. "SF", "NYY", "LAD")
//  A mini TagChip variant: small mono uppercase on a subtle background. Used in
//  the header leaderboard rows (batters + pitchers) right after the hand chip.
// ─────────────────────────────────────────────────────────────────────────────

export function TeamChip({ team }: { team: string }) {
  return <span className="sp-teamchip">{team}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  HandChip — R / L / SW  (adv = platoon-advantage cyan glow)
//  MUST stay visually distinct from the green conf TagChip:
//    conf TagChip = mint  hsl(150 82% 60%)
//    adv HandChip = cyan  hsl(188 92% 62%)  — different hue + explicit glow
// ─────────────────────────────────────────────────────────────────────────────

export function HandChip({
  hand,
  adv,
}: {
  hand: "R" | "L" | "SW";
  adv?: boolean;
}) {
  return (
    <span
      className={`sp-hand${adv ? " sp-hand--adv" : ""}`}
      title={adv ? "platoon advantage" : undefined}
    >
      {hand}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FormChip — hot / cold / steady recent-form indicator
// ─────────────────────────────────────────────────────────────────────────────

export type FormKind = "hot" | "cold" | "steady";

const FORM_DEFAULTS: Record<FormKind, string> = {
  hot:    "▲ hot",   // same solid-triangle style as cold, mirrored up
  cold:   "▼ cold",
  steady: "— steady",
};

export function FormChip({
  kind,
  children,
}: {
  kind: FormKind;
  children?: ReactNode;
}) {
  return (
    <span className={`sp-formchip sp-formchip--${kind}`}>
      {children ?? FORM_DEFAULTS[kind]}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FBox — condition / stat pill  (icon + optional dim label + bold value)
// ─────────────────────────────────────────────────────────────────────────────

export function FBox({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label?: string;
  value: ReactNode;
}) {
  return (
    <span className="sp-fbox">
      {icon}
      {label ? <span className="sp-fbox-lbl">{label}</span> : null}
      <b>{value}</b>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bvp — career batter-vs-pitcher mini-chip
//  Transcribed from mock7 bvp template: `${h}-${ab}[ · ${hr} HR]`
// ─────────────────────────────────────────────────────────────────────────────

export function Bvp({
  hits,
  ab,
  hr,
}: {
  hits: number;
  ab:   number;
  hr?:  number;
}) {
  return (
    <span className="sp-bvp" title="career vs this pitcher">
      {hits}-{ab}
      {hr != null && hr > 0 ? ` · ${hr} HR` : ""}
    </span>
  );
}
