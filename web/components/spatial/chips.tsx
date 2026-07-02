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
  hot:    "↑ hot",
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
