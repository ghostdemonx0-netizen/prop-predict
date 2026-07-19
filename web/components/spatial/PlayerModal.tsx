/**
 * PlayerModal.tsx — URL-addressable player/pitcher detail modal for the Mock 7
 * "Spatial Depth" skin.
 *
 * This is the pop-up equivalent of the current full-page player breakdown at
 * app/player/[prop]/[id]/page.tsx.  Every per-prop factor set, note, and baseline
 * key is reproduced verbatim from that page (the functional source of truth) so
 * the modal shows exactly the same "what's driving it" breakdown, just inside the
 * blurred-scrim glass modal from mock7.html (.overlay / .modal / .mtop / .mpanel).
 *
 * URL-addressability
 * ------------------
 *   • usePlayerModalUrl() reads `?player=<id>&prop=<kind>[&threshold=<n>]` from the
 *     address bar on mount (so a shared link / refresh re-opens the same modal),
 *     writes those params on open (history.pushState → browser Back closes it),
 *     and clears only `?player=` on close.
 *   • <PlayerModal> itself is a controlled presentational component: the page (or
 *     the demo hook) owns the URL and passes open/playerId/prop/threshold/source.
 *
 * The kit is reused throughout: ProbabilityOrb (86px headline), FactorBar (the
 * deviation meter), LeanPair (K/C matchup dots), FBox + thin-line Icons (conditions).
 */
"use client";

import "./spatial.css";
import { useCallback, useEffect, useState } from "react";

import { loadProjections } from "../../lib/data";
import type {
  Projections,
  Matchup,
  HrRow,
  KRow,
  HitsRow,
  TbRow,
  RunsRow,
  HrrRow,
} from "../../lib/types";
import {
  pct,
  strengthLabel,
  windText,
  arrowColor,
  gameTimeLabel,
} from "../../lib/format";
import type { PropKind } from "../../lib/format";
import { paceText } from "../../lib/pace";
import { platoonEdge } from "../../lib/platoon";
import { pickN, leanFor } from "../../lib/weighting";
import type { Source, SpatialRow } from "../../lib/weighting";

import { ProbabilityOrb } from "./ProbabilityOrb";
import KSpherePair from "./KSpherePair";
import { FactorBar } from "./FactorBar";
import { LeanPair } from "./GlassDot";
import { FBox } from "./chips";
import { ClockIcon, WindIcon, TempIcon, RainIcon } from "../Icons";
import {
  SprayIcon,
  HardHitIcon,
  ProductionIcon,
  PlatoonIcon,
  HistoryIcon,
  LineupIcon,
  BaselineIcon,
  FlameIcon,
  PitcherIcon,
  ParkIcon,
  ParkWeatherIcon,
  BarrelIcon,
} from "./factorIcons";

// Shared inline-icon sizing for factor rows + inline notes.
const FI = 14;
const noteIconStyle = { verticalAlign: "-2px", marginRight: 5 } as const;

// ─────────────────────────────────────────────────────────────────────────────
//  Public types
// ─────────────────────────────────────────────────────────────────────────────

export type ModalProp = "hr" | "k" | "hits" | "tb" | "runs" | "rbi" | "hrr";

export interface PlayerModalProps {
  open: boolean;
  /** MLBAM player id (or the URL-encoded name fallback the board hrefs use). */
  playerId: string | number | null;
  prop: ModalProp;
  /** Active threshold for threshold-props (hits 1-3, tb 2-4, runs/rbi 1-2, hrr 2-4). */
  threshold?: number;
  date?: string;
  source: Source;
  /** When true the 🛢️ Barrel row is shown in each factor component. */
  barrelEffect?: boolean;
  /** Barrel Weight mode: number is barrel-dominant, sauce (park/wx/pitcher) is off. */
  barrelWeight?: boolean;
  onClose: () => void;
  /** Cross-navigation: clicking a linked player opens their modal. */
  onOpenPlayer?: (playerId: string, prop: ModalProp) => void;
  /** Optional pre-loaded projections payload; when omitted the modal fetches its own. */
  projections?: Projections;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Small copy helpers — copied verbatim from the current player page
// ─────────────────────────────────────────────────────────────────────────────

function batLabel(b?: string) {
  return b === "L" ? "LHB" : b === "S" ? "Switch" : b ? "RHB" : "";
}
function pitLabel(t?: string) {
  return t === "L" ? "LHP" : t ? "RHP" : "";
}
function pullField(bats?: string) {
  return bats === "L" ? "right field" : "left field";
}
/** Spray-row note: pull tendency + how tonight's wind interacts with it. */
function sprayNote(
  sprayPull?: number,
  sprayMult?: number,
  bats?: string,
  windMph?: number,
  windDir?: number,
) {
  const pullPct = typeof sprayPull === "number" ? `${Math.round(sprayPull * 100)}% to ` : "";
  const lead = `Pulls ${pullPct}${pullField(bats)}.`;
  const mph = typeof windMph === "number" ? Math.round(windMph) : 0;
  if (mph < 5) return `${lead} Calm wind tonight — little spray effect.`;
  const dirTxt = typeof windDir === "number" ? windText(windDir) : "across the field";
  const delta = Math.round(((sprayMult ?? 1) - 1) * 100);
  const interaction =
    delta > 0 ? "working with his pull"
    : delta < 0 ? "working against his pull"
    : "carrying all fields about equally";
  return `${lead} ${mph}mph wind ${dirTxt} — ${interaction}.`;
}

const PROP_NAME: Record<ModalProp, string> = {
  hr: "Home Run",
  k: "Strikeouts",
  hits: "Hits",
  tb: "Total Bases",
  runs: "Run",
  rbi: "RBI",
  hrr: "Hits+Runs+RBI",
};

/** Source-aware numeric picker, matching the current page's `pick` semantics:
 *  blend averages two numbers; hist prefers hist when present; else current. */
function makePick(source: Source) {
  const hist = source === "hist";
  const blend = source === "blend";
  return function pick<T>(cur: T, h: T | undefined | null): T {
    return blend && typeof cur === "number" && typeof h === "number"
      ? (((cur + h) / 2) as unknown as T)
      : hist && h != null
      ? h
      : cur;
  };
}

/** Convert a K/H/NEU lean code to the LeanPair tag text (matches mock7 output). */
function leanTag(code: "K" | "H" | "NEU"): string {
  return code === "K" ? "◀ leans K" : code === "H" ? "leans C ▶" : "● neutral";
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared presentational atoms
// ─────────────────────────────────────────────────────────────────────────────

function MStat({ value, label, glow }: { value: string; label: string; glow?: boolean }) {
  return (
    <div>
      <div className={`sp-mstat ${glow ? "sp-mstat--glow" : "sp-mstat--dim"}`}>{value}</div>
      <div className="sp-mstat-lab">{label}</div>
    </div>
  );
}

function HeadlinePanel({
  children,
  prob,
  kind,
  sphere,
}: {
  children: React.ReactNode;
  prob: number;
  kind: PropKind;
  /** Optional custom sphere replacing the single headline orb (K uses the
   *  model+proj twin pair). */
  sphere?: React.ReactNode;
}) {
  return (
    <div className="sp-mpanel">
      <div className="sp-mhead-row">
        <div className="sp-mstats">{children}</div>
        {sphere ?? <ProbabilityOrb prob={prob} kind={kind} size={96} />}
      </div>
    </div>
  );
}

/** "His base level" — neutral baseline chance + plain season pace, source-aware. */
function BaselineBlock({
  baseline,
  baselineHist,
  pace,
  paceHist,
  kind,
  source,
}: {
  baseline?: number;
  baselineHist?: number;
  pace?: number;
  paceHist?: number;
  kind: PropKind;
  source: Source;
}) {
  const blend = source === "blend";
  const hist = source === "hist";
  const b =
    blend && typeof baseline === "number" && typeof baselineHist === "number"
      ? (baseline + baselineHist) / 2
      : hist && baselineHist != null
      ? baselineHist
      : baseline;
  const p =
    blend && typeof pace === "number" && typeof paceHist === "number"
      ? (pace + paceHist) / 2
      : hist && paceHist != null
      ? paceHist
      : pace;
  if (typeof b !== "number" && typeof p !== "number") return null;
  return (
    <div className="sp-mpanel">
      <div className="sp-bd-eye" style={{ marginTop: 0 }}>His base level</div>
      {typeof b === "number" && (
        <div className="sp-drv-top" style={{ fontSize: ".9rem" }}>
          <span className="sp-drv-l"><BaselineIcon size={FI} /><span>Baseline chance</span></span>
          <span className="sp-delta sp-delta--flat">{pct(b)}</span>
        </div>
      )}
      {typeof p === "number" && p > 0 && (
        <div className="sp-drv-note" style={{ marginTop: 4 }}><ProductionIcon size={13} style={noteIconStyle} />Season pace · {paceText(kind, p)}</div>
      )}
    </div>
  );
}

function DriversPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="sp-mpanel">
      <div className="sp-bd-eye" style={{ marginTop: 0 }}>What&apos;s driving it</div>
      <div className="sp-drv-note" style={{ margin: "0 0 4px" }}>
        How much each factor raises (green) or lowers (red) his normal probability — the center line is his usual rate.
      </div>
      {children}
    </div>
  );
}

function ConditionsPanel({
  tempF,
  windMph,
  windDir,
  precipPct,
  note,
}: {
  tempF?: number;
  windMph?: number;
  windDir?: number;
  precipPct?: number;
  note?: string;
}) {
  return (
    <div className="sp-mpanel">
      <div className="sp-bd-eye" style={{ marginTop: 0 }}>Conditions</div>
      <div className="sp-mconds">
        {typeof tempF === "number" && (
          <FBox icon={<TempIcon size={13} />} value={`${Math.round(tempF)}°`} />
        )}
        {typeof windMph === "number" && typeof windDir === "number" && (
          <FBox
            icon={<WindIcon deg={windDir} size={13} style={{ color: arrowColor(windDir) }} />}
            value={`${Math.round(windMph)}mph`}
            label={windText(windDir)}
          />
        )}
        {typeof precipPct === "number" && precipPct >= 20 && (
          <FBox
            icon={<RainIcon size={13} style={{ color: "var(--iris-cyan)" }} />}
            value={`${precipPct}%`}
            label="rain"
          />
        )}
      </div>
      {note && <div className="sp-drv-note" style={{ marginTop: 8 }}>{note}</div>}
    </div>
  );
}

/** Both-sides pitcher matchup lean + BvP line (for batter props). */
function PitcherMatchupPanel({
  vs,
  source,
  onOpenPlayer,
}: {
  vs: Matchup;
  source: Source;
  onOpenPlayer?: (playerId: string, prop: ModalProp) => void;
}) {
  const lean = leanFor(vs, source);
  const kProb = pickN(vs.k_prob, vs.k_prob_hist, source) ?? 0;
  const hitProb = pickN(vs.hit_prob, vs.hit_prob_hist, source) ?? 0;
  const id = String(vs.player_id ?? vs.name);
  return (
    <div className="sp-mpanel">
      <div className="sp-bd-eye" style={{ marginTop: 0 }}>Pitcher matchup</div>
      <div className="sp-mlegend">
        Both sides, per at-bat vs this pitcher — <span className="sp-lk">K = strikeout chance</span> ·{" "}
        <span className="sp-lc">C = hit (contact) chance</span>
      </div>
      <div className="sp-mline">
        <button type="button" className="sp-linklike" onClick={() => onOpenPlayer?.(id, "k")}>
          {vs.name}
        </button>
        <span className="sp-hand">{pitLabel(vs.throws)}</span>
        <span style={{ marginLeft: "auto" }}>
          <LeanPair k={kProb} h={hitProb} lean={lean ? leanTag(lean.lean) : undefined} />
        </span>
      </div>
      {vs.bvp && vs.bvp.pa > 0 ? (
        <div className="sp-drv-note" style={{ marginBottom: 0 }}>
          Career vs {vs.name}: <b>{vs.bvp.hits}-for-{vs.bvp.ab}</b>
          {vs.bvp.hr > 0 && <> · <b>{vs.bvp.hr} HR</b></>} · {vs.bvp.k} K
        </div>
      ) : (
        <div className="sp-drv-note" style={{ marginBottom: 0 }}>No career history against him yet.</div>
      )}
    </div>
  );
}

/** Shared header (eyebrow + name + close / back). */
function ModalTop({
  eyebrow,
  name,
  onClose,
}: {
  eyebrow: React.ReactNode;
  name: string;
  onClose: () => void;
}) {
  return (
    <div className="sp-mtop">
      <button type="button" className="sp-mback" onClick={onClose}>← back to board</button>
      <button type="button" className="sp-mclose" onClick={onClose} aria-label="close">×</button>
      <span className="sp-eyebrow sp-meyebrow">{eyebrow}</span>
      <div className="sp-mname">{name}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Per-prop factor rows (reproduce the current player page exactly)
// ─────────────────────────────────────────────────────────────────────────────

/** Barrel Weight "what's driving it": barrel-dominant, sauce (park/wx/pitcher/BvP/form) off. */
function BweightFactors({ r }: { r: { barrel_mult?: number } }) {
  return (
    <>
      <div style={{ opacity: 0.75, fontSize: 12.5, lineHeight: 1.5, marginBottom: 10 }}>
        <b>Barrel Weight mode.</b> This number is driven by the <b>barrel matchup</b> on a long
        (±60%) leash. Park, weather, pitcher, BvP and recent form are intentionally <b>set aside</b>{" "}
        in this mode — flip to Normal to see those. The base production still anchors it.
      </div>
      {typeof r.barrel_mult === "number" && (
        <FactorBar icon={<BarrelIcon size={FI} />} label="🛢️ Barrel matchup" mult={r.barrel_mult}
                   note="The barrel signal driving Barrel Weight (displayed on the ±20% scale)." />
      )}
    </>
  );
}

function HrFactors({ r, barrelEffect }: { r: HrRow; source: Source; barrelEffect: boolean }) {
  const parkFriendly = r.park_mult >= 1;
  return (
    <>
      <FactorBar
        icon={<ParkIcon size={FI} />}
        label={`Park · ${r.park}`}
        mult={r.park_mult}
        note={`${r.park} plays ${parkFriendly ? "hitter-friendly" : "pitcher-friendly"} for home runs.`}
      />
      <FactorBar
        icon={<WindIcon size={FI} />}
        label="Weather"
        mult={r.spray_mult ? r.weather_mult / r.spray_mult : r.weather_mult}
        note={`${typeof r.wind_mph === "number" ? Math.round(r.wind_mph) + "mph wind " : ""}${typeof r.wind_dir === "number" ? windText(r.wind_dir) : ""}${typeof r.temp_f === "number" ? `, ${Math.round(r.temp_f)}°` : ""}.`}
      />
      {typeof r.spray_mult === "number" && (
        <FactorBar
          icon={<SprayIcon size={FI} />}
          label="Spray"
          mult={r.spray_mult}
          note={sprayNote(r.spray_pull, r.spray_mult, r.bats, r.wind_mph, r.wind_dir)}
        />
      )}
      {typeof r.hard_hit_form === "number" && (
        <FactorBar
          icon={<HardHitIcon size={FI} />}
          label="Hard-hit form"
          mult={r.hard_hit_form}
          note={r.hard_hit_form > 1 ? "Squaring the ball up harder than his season norm lately." : r.hard_hit_form < 1 ? "Softer contact than usual recently." : "Contact quality around his season norm."}
        />
      )}
      {typeof r.production_form === "number" && (
        <FactorBar
          icon={<ProductionIcon size={FI} />}
          label="Production form"
          mult={r.production_form}
          note={r.production_form > 1 ? "Homering at a higher rate than his season pace lately." : r.production_form < 1 ? "Below his HR pace recently." : "Around his season HR pace."}
        />
      )}
      <FactorBar icon={<FlameIcon size={FI} />} label="Recent form" mult={r.recent_form_mult} note="The blended net of hard-hit + production form." />
      {barrelEffect && typeof r.barrel_mult === "number" && (
        <FactorBar icon={<BarrelIcon size={FI} />} label="🛢️ Barrel" mult={r.barrel_mult}
                   note="barrel matchup vs this pitcher" />
      )}
      {r.vs && r.pitcher_mult !== undefined && (
        <FactorBar
          icon={<PitcherIcon size={FI} />}
          label={`Pitcher · ${r.vs.name}`}
          mult={r.pitcher_mult ?? 1}
          note={`${r.vs.name}'s home-run quality (how many he gives up).`}
        />
      )}
      {r.vs && r.matchup_mult !== undefined && (
        <FactorBar
          icon={<PlatoonIcon size={FI} />}
          label={`Platoon · ${batLabel(r.bats)} vs ${pitLabel(r.vs.throws)}`}
          mult={r.matchup_mult}
          note={`${platoonEdge(r.bats, r.vs.throws) ? "Favorable" : "Tough"} handedness matchup for him.`}
        />
      )}
      {r.vs && r.vs.bvp && r.vs.bvp.pa > 0 && r.bvp_mult !== undefined && (
        <FactorBar
          icon={<HistoryIcon size={FI} />}
          label={`History · vs ${r.vs.name}`}
          mult={r.bvp_mult}
          note={`${r.vs.bvp.hits}-for-${r.vs.bvp.ab} career${r.vs.bvp.hr > 0 ? ` with ${r.vs.bvp.hr} HR` : ""}.`}
        />
      )}
    </>
  );
}

function HitsFactors({ r, source, barrelEffect }: { r: HitsRow; source: Source; barrelEffect: boolean }) {
  const pick = makePick(source);
  const hh = pick(r.hard_hit_form ?? 1, r.hard_hit_form_hist);
  const prod = pick(r.production_form ?? 1, r.production_form_hist);
  return (
    <>
      {typeof (r.hard_hit_form ?? r.hard_hit_form_hist) === "number" && (
        <FactorBar
          icon={<HardHitIcon size={FI} />}
          label="Hard-hit form"
          mult={hh}
          note={hh > 1 ? "Squaring the ball up harder than his season norm lately." : hh < 1 ? "Softer contact than usual recently." : "Contact quality around his season norm."}
        />
      )}
      {typeof (r.production_form ?? r.production_form_hist) === "number" && (
        <FactorBar
          icon={<ProductionIcon size={FI} />}
          label="Production form"
          mult={prod}
          note={prod > 1 ? "Getting hits at a higher rate than his season pace lately." : prod < 1 ? "Below his hit pace recently." : "Around his season hit pace."}
        />
      )}
      <FactorBar icon={<FlameIcon size={FI} />} label="Recent form" mult={pick(r.recent_form_mult ?? 1, r.recent_form_mult_hist)} note="The blended net of hard-hit + production form." />
      {barrelEffect && typeof r.barrel_mult === "number" && (
        <FactorBar icon={<BarrelIcon size={FI} />} label="🛢️ Barrel" mult={r.barrel_mult}
                   note="barrel matchup vs this pitcher" />
      )}
      {r.vs && (
        <FactorBar
          icon={<PitcherIcon size={FI} />}
          label={`Pitcher · hit quality · ${r.vs.name}`}
          mult={pick(r.pitcher_factor ?? 1, r.pitcher_factor_hist)}
          note="How hittable this pitcher is, plus the L/R platoon."
        />
      )}
      {r.vs && (
        <div className="sp-drv-note" style={{ marginTop: "0.35rem" }}>
          <PlatoonIcon size={13} style={noteIconStyle} /><b>Platoon</b> · {batLabel(r.bats)} vs {pitLabel(r.vs.throws)} · {platoonEdge(r.bats, r.vs.throws) ? "favorable" : "tough"} — already reflected in the Pitcher factor above.
        </div>
      )}
      {r.vs && r.vs.bvp && r.vs.bvp.pa > 0 && typeof r.bvp_hit_mult === "number" && (
        <FactorBar
          icon={<HistoryIcon size={FI} />}
          label={`History · vs ${r.vs.name}`}
          mult={r.bvp_hit_mult}
          note={`${r.vs.bvp.hits}-for-${r.vs.bvp.ab} career — his contact history vs this pitcher.`}
        />
      )}
    </>
  );
}

function TbFactors({ r, source, barrelEffect }: { r: TbRow; source: Source; barrelEffect: boolean }) {
  const pick = makePick(source);
  const hh = pick(r.hard_hit_form ?? 1, r.hard_hit_form_hist);
  const prod = pick(r.production_form ?? 1, r.production_form_hist);
  return (
    <>
      {typeof (r.hard_hit_form ?? r.hard_hit_form_hist) === "number" && (
        <FactorBar
          icon={<HardHitIcon size={FI} />}
          label="Hard-hit form"
          mult={hh}
          note={hh > 1 ? "Squaring the ball up harder than his season norm lately." : hh < 1 ? "Softer contact than usual recently." : "Contact quality around his season norm."}
        />
      )}
      {typeof (r.production_form ?? r.production_form_hist) === "number" && (
        <FactorBar
          icon={<ProductionIcon size={FI} />}
          label="Production form"
          mult={prod}
          note={prod > 1 ? "Racking up bases at a higher rate than his season pace lately." : prod < 1 ? "Below his bases pace recently." : "Around his season bases pace."}
        />
      )}
      <FactorBar icon={<FlameIcon size={FI} />} label="Recent form" mult={pick(r.recent_form_mult ?? 1, r.recent_form_mult_hist)} note="The blended net of hard-hit + production form." />
      {barrelEffect && typeof r.barrel_mult === "number" && (
        <FactorBar icon={<BarrelIcon size={FI} />} label="🛢️ Barrel" mult={r.barrel_mult}
                   note="barrel matchup vs this pitcher" />
      )}
      {r.vs && (
        <FactorBar
          icon={<PitcherIcon size={FI} />}
          label={`Pitcher · contact + power · ${r.vs.name}`}
          mult={pick(r.pitcher_factor ?? 1, r.pitcher_factor_hist)}
          note="Combines how hittable he is with his power (extra-base/HR) suppression, plus platoon."
        />
      )}
      {r.vs && (
        <div className="sp-drv-note" style={{ marginTop: "0.35rem" }}>
          <PlatoonIcon size={13} style={noteIconStyle} /><b>Platoon</b> · {batLabel(r.bats)} vs {pitLabel(r.vs.throws)} · {platoonEdge(r.bats, r.vs.throws) ? "favorable" : "tough"} — already reflected in the Pitcher factor above.
        </div>
      )}
      {r.vs && r.vs.bvp && r.vs.bvp.pa > 0 && typeof r.bvp_hit_mult === "number" && (
        <FactorBar
          icon={<HistoryIcon size={FI} />}
          label={`History · vs ${r.vs.name}`}
          mult={r.bvp_hit_mult}
          note={`${r.vs.bvp.hits}-for-${r.vs.bvp.ab} career — his contact history vs this pitcher.`}
        />
      )}
      {typeof r.spray_mult === "number" && (
        <FactorBar
          icon={<SprayIcon size={FI} />}
          label="Spray"
          mult={r.spray_mult}
          note={sprayNote(r.spray_pull, r.spray_mult, r.bats, r.wind_mph, r.wind_dir)}
        />
      )}
      <FactorBar
        icon={<ParkWeatherIcon size={FI} />}
        label="Park & weather"
        mult={r.spray_mult ? pick(r.park_weather_factor ?? 1, r.park_weather_factor_hist) / r.spray_mult : pick(r.park_weather_factor ?? 1, r.park_weather_factor_hist)}
        note="The ballpark and conditions' net effect on his extra-base power (doubles, triples, homers). Singles barely move with the park, so the nudge stays modest."
      />
    </>
  );
}

function LineupFactors({
  r,
  source,
  prop,
  barrelEffect,
}: {
  r: RunsRow | HrrRow;
  source: Source;
  prop: "runs" | "rbi" | "hrr";
  barrelEffect: boolean;
}) {
  const pick = makePick(source);
  const eyebrow = prop === "runs" ? "Run" : prop === "rbi" ? "RBI" : "Hits+Runs+RBI";
  const lineupNote =
    prop === "runs"
      ? "The hitters batting behind him — better bats behind raise his chance to be driven in."
      : prop === "rbi"
      ? "The hitters batting ahead of him — more men on base raise his RBI chances."
      : "The hitters around him in the order — affects his combined hits, runs, and RBI chances (dampened, since the hits portion is lineup-neutral).";
  const parkNote =
    prop === "hrr"
      ? "The ballpark's net effect on combined hits, runs, and RBI production. Weather is not modeled for this prop in v1."
      : `The ballpark's net effect on ${eyebrow.toLowerCase()} scoring. Weather is not modeled for this prop in v1.`;
  const hh = pick(r.hard_hit_form ?? 1, r.hard_hit_form_hist);
  const prod = pick(r.production_form ?? 1, r.production_form_hist);
  return (
    <>
      {typeof (r.lineup_mult ?? r.lineup_mult_hist) === "number" && (
        <FactorBar icon={<LineupIcon size={FI} />} label="Lineup" mult={pick(r.lineup_mult ?? 1, r.lineup_mult_hist)} note={lineupNote} />
      )}
      <FactorBar
        icon={<HardHitIcon size={FI} />}
        label="Hard-hit form"
        mult={hh}
        note={hh > 1 ? "Squaring the ball up harder than his season norm lately." : hh < 1 ? "Softer contact than usual recently." : "Contact quality around his season norm."}
      />
      <FactorBar
        icon={<ProductionIcon size={FI} />}
        label="Production form"
        mult={prod}
        note={prod > 1 ? "Producing at a higher rate than his season pace lately." : prod < 1 ? "Producing below his season pace recently." : "Producing around his season pace."}
      />
      <FactorBar icon={<FlameIcon size={FI} />} label="Recent form" mult={pick(r.recent_form_mult ?? 1, r.recent_form_mult_hist)} note="The blended net of hard-hit + production form." />
      {barrelEffect && typeof r.barrel_mult === "number" && (
        <FactorBar icon={<BarrelIcon size={FI} />} label="🛢️ Barrel" mult={r.barrel_mult}
                   note="barrel matchup vs this pitcher" />
      )}
      {r.vs && (
        <FactorBar
          icon={<PitcherIcon size={FI} />}
          label={`Pitcher · ${r.vs.name}`}
          mult={pick(r.pitcher_factor ?? 1, r.pitcher_factor_hist)}
          note={prop === "hrr" ? "How hittable this pitcher is — affects both contact and scoring opportunity." : "How hittable this pitcher is, factoring in on-base opportunity."}
        />
      )}
      {r.vs && r.platoon_mult !== undefined && (
        <FactorBar
          icon={<PlatoonIcon size={FI} />}
          label={`Platoon · ${batLabel(r.bats)} vs ${pitLabel(r.vs.throws)}`}
          mult={r.platoon_mult}
          note={`${platoonEdge(r.bats, r.vs.throws) ? "Favorable" : "Tough"} handedness matchup for him.`}
        />
      )}
      <FactorBar icon={<ParkIcon size={FI} />} label={`Park · ${r.team}`} mult={pick(r.park_weather_factor ?? 1, r.park_weather_factor_hist)} note={parkNote} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Batter modal body
// ─────────────────────────────────────────────────────────────────────────────

function BatterBody({
  data,
  prop,
  id,
  threshold,
  source,
  barrelEffect,
  barrelWeight,
  onOpenPlayer,
  onClose,
}: {
  data: Projections;
  prop: Exclude<ModalProp, "k">;
  id: string;
  threshold: number;
  source: Source;
  barrelEffect: boolean;
  barrelWeight: boolean;
  onOpenPlayer?: (playerId: string, prop: ModalProp) => void;
  onClose: () => void;
}) {
  const pick = makePick(source);
  // Mode-aware headline prob: Barrel Weight → _bweight, Barrel Effect → _beff, else Normal.
  const probOf = (cur = 0, curB?: number, curBw?: number, hist?: number, histB?: number, histBw?: number): number =>
    barrelWeight ? pick(curBw ?? cur, histBw ?? hist)
    : barrelEffect ? pick(curB ?? cur, histB ?? hist)
    : pick(cur, hist);

  const findBy = <T extends { player_id?: number; player: string }>(arr: T[]): T | undefined =>
    arr.find((x) => String(x.player_id) === id) ?? arr.find((x) => x.player === decodeURIComponent(id));

  // Resolve the row + all per-prop specifics.
  let r: HrRow | HitsRow | TbRow | RunsRow | HrrRow | undefined;
  let stats: { value: string; label: string; glow: boolean }[] = [];
  let headlineProb = 0;
  let kind: PropKind = "hr";
  let read: React.ReactNode = null;
  let factors: React.ReactNode = null;
  let baseline: React.ReactNode = null;
  let vs: Matchup | undefined;
  let conditionsNote: string | undefined;

  if (prop === "hr") {
    const row = findBy(data.hr);
    r = row;
    if (row) {
      const p = probOf(row.probability, row.probability_beff, row.probability_bweight, row.probability_hist, row.probability_hist_beff, row.probability_bweight_hist);
      headlineProb = p;
      kind = "hr";
      vs = row.vs;
      stats = [{ value: pct(p), label: "1+ HR probability", glow: true }, { value: strengthLabel(p), label: "our read", glow: false }];
      baseline = <BaselineBlock baseline={row.baseline_prob} baselineHist={row.baseline_prob_hist} pace={row.pace} paceHist={row.pace_hist} kind="hr" source={source} />;
      factors = barrelWeight ? <BweightFactors r={row} /> : <HrFactors r={row} source={source} barrelEffect={barrelEffect} />;
    }
  } else if (prop === "hits") {
    const row = findBy(data.hits ?? []);
    r = row;
    if (row) {
      const n = (threshold === 2 ? 2 : threshold === 3 ? 3 : 1) as 1 | 2 | 3;
      kind = `hits${n}` as PropKind;
      vs = row.vs;
      const p1 = probOf(row.p_ge1, row.p_ge1_beff, row.p_ge1_bweight, row.p_ge1_hist, row.p_ge1_beff_hist, row.p_ge1_bweight_hist);
      const p2 = probOf(row.p_ge2, row.p_ge2_beff, row.p_ge2_bweight, row.p_ge2_hist, row.p_ge2_beff_hist, row.p_ge2_bweight_hist);
      const p3 = probOf(row.p_ge3, row.p_ge3_beff, row.p_ge3_bweight, row.p_ge3_hist, row.p_ge3_beff_hist, row.p_ge3_bweight_hist);
      headlineProb = n === 1 ? p1 : n === 2 ? p2 : p3;
      stats = [
        { value: pct(p1), label: "1+ hit", glow: n === 1 },
        { value: pct(p2), label: "2+ hits", glow: n === 2 },
        { value: pct(p3), label: "3+ hits", glow: n === 3 },
      ];
      read = <ReadCopy n={n} prob={headlineProb} kind={kind} />;
      baseline = <BaselineBlock baseline={baselineKey(row, n)} baselineHist={baselineKey(row, n, true)} pace={row.pace} paceHist={row.pace_hist} kind={kind} source={source} />;
      factors = barrelWeight ? <BweightFactors r={row} /> : <HitsFactors r={row} source={source} barrelEffect={barrelEffect} />;
    }
  } else if (prop === "tb") {
    const row = findBy(data.total_bases ?? []);
    r = row;
    if (row) {
      const n = (threshold === 3 ? 3 : threshold === 4 ? 4 : 2) as 2 | 3 | 4;
      kind = `tb${n}` as PropKind;
      vs = row.vs;
      const p2 = probOf(row.p_ge2, row.p_ge2_beff, row.p_ge2_bweight, row.p_ge2_hist, row.p_ge2_beff_hist, row.p_ge2_bweight_hist);
      const p3 = probOf(row.p_ge3, row.p_ge3_beff, row.p_ge3_bweight, row.p_ge3_hist, row.p_ge3_beff_hist, row.p_ge3_bweight_hist);
      const p4 = probOf(row.p_ge4, row.p_ge4_beff, row.p_ge4_bweight, row.p_ge4_hist, row.p_ge4_beff_hist, row.p_ge4_bweight_hist);
      headlineProb = n === 2 ? p2 : n === 3 ? p3 : p4;
      stats = [
        { value: pct(p2), label: "2+ bases", glow: n === 2 },
        { value: pct(p3), label: "3+ bases", glow: n === 3 },
        { value: pct(p4), label: "4+ bases", glow: n === 4 },
      ];
      read = <ReadCopy n={n} prob={headlineProb} kind={kind} />;
      baseline = <BaselineBlock baseline={baselineKey(row, n)} baselineHist={baselineKey(row, n, true)} pace={row.pace} paceHist={row.pace_hist} kind={kind} source={source} />;
      factors = barrelWeight ? <BweightFactors r={row} /> : <TbFactors r={row} source={source} barrelEffect={barrelEffect} />;
    }
  } else if (prop === "runs" || prop === "rbi") {
    const row = findBy((prop === "runs" ? data.runs : data.rbi) ?? []);
    r = row;
    if (row) {
      const n = (threshold === 2 ? 2 : 1) as 1 | 2;
      kind = `${prop}${n}` as PropKind;
      vs = row.vs;
      const label = prop === "runs" ? "Run" : "RBI";
      const p1 = probOf(row.p_ge1, row.p_ge1_beff, row.p_ge1_bweight, row.p_ge1_hist, row.p_ge1_beff_hist, row.p_ge1_bweight_hist);
      const p2 = probOf(row.p_ge2, row.p_ge2_beff, row.p_ge2_bweight, row.p_ge2_hist, row.p_ge2_beff_hist, row.p_ge2_bweight_hist);
      headlineProb = n === 1 ? p1 : p2;
      stats = [
        { value: pct(p1), label: `1+ ${label.toLowerCase()}`, glow: n === 1 },
        { value: pct(p2), label: `2+ ${label === "RBI" ? "RBI" : label.toLowerCase() + "s"}`, glow: n === 2 },
      ];
      read = <ReadCopy n={n} prob={headlineProb} kind={kind} noisyLabel={label} />;
      baseline = <BaselineBlock baseline={baselineKey(row, n)} baselineHist={baselineKey(row, n, true)} pace={row.pace} paceHist={row.pace_hist} kind={kind} source={source} />;
      factors = barrelWeight ? <BweightFactors r={row} /> : <LineupFactors r={row} source={source} prop={prop} barrelEffect={barrelEffect} />;
    }
  } else {
    // hrr
    const row = findBy(data.hrr ?? []);
    r = row;
    if (row) {
      const n = (threshold === 3 ? 3 : threshold === 4 ? 4 : 2) as 2 | 3 | 4;
      kind = `hrr${n}` as PropKind;
      vs = row.vs;
      const p2 = probOf(row.p_ge2, row.p_ge2_beff, row.p_ge2_bweight, row.p_ge2_hist, row.p_ge2_beff_hist, row.p_ge2_bweight_hist);
      const p3 = probOf(row.p_ge3, row.p_ge3_beff, row.p_ge3_bweight, row.p_ge3_hist, row.p_ge3_beff_hist, row.p_ge3_bweight_hist);
      const p4 = probOf(row.p_ge4, row.p_ge4_beff, row.p_ge4_bweight, row.p_ge4_hist, row.p_ge4_beff_hist, row.p_ge4_bweight_hist);
      headlineProb = n === 2 ? p2 : n === 3 ? p3 : p4;
      stats = [
        { value: pct(p2), label: "2+ combined", glow: n === 2 },
        { value: pct(p3), label: "3+ combined", glow: n === 3 },
        { value: pct(p4), label: "4+ combined", glow: n === 4 },
      ];
      read = <ReadCopy n={n} prob={headlineProb} kind={kind} noisyLabel="Hits+Runs+RBI" />;
      baseline = <BaselineBlock baseline={baselineKey(row, n)} baselineHist={baselineKey(row, n, true)} pace={row.pace} paceHist={row.pace_hist} kind={kind} source={source} />;
      factors = barrelWeight ? <BweightFactors r={row} /> : <LineupFactors r={row} source={source} prop="hrr" barrelEffect={barrelEffect} />;
    }
  }

  if (!r) return <NotFoundBody onClose={onClose} />;

  const time = gameTimeLabel(r.game_time);
  return (
    <>
      <ModalTop
        onClose={onClose}
        name={r.player}
        eyebrow={
          <>
            {r.team}{r.bats ? ` · ${batLabel(r.bats)}` : ""} · {PROP_NAME[prop]}
            {time ? <> · <ClockIcon size={12} /> {time}</> : null}
          </>
        }
      />
      <div className="sp-mbody">
        <HeadlinePanel prob={headlineProb} kind={kind}>
          {stats.map((s) => (
            <MStat key={s.label} value={s.value} label={s.label} glow={s.glow} />
          ))}
        </HeadlinePanel>
        {read}
        {baseline}
        <DriversPanel>{factors}</DriversPanel>
        <ConditionsPanel tempF={r.temp_f} windMph={r.wind_mph} windDir={r.wind_dir} precipPct={r.precip_pct} note={conditionsNote} />
        {vs && <PitcherMatchupPanel vs={vs} source={source} onOpenPlayer={onOpenPlayer} />}
      </div>
    </>
  );
}

/** "Our read" copy for threshold props (+ optional noisier-estimate caveat). */
function ReadCopy({ n, prob, kind, noisyLabel }: { n: number; prob: number; kind: PropKind; noisyLabel?: string }) {
  return (
    <div className="sp-mpanel">
      <div className="sp-bd-eye" style={{ marginTop: 0 }}>Our read</div>
      <div className="sp-drv-note" style={{ marginTop: 0 }}>
        At the selected threshold ({n}+), we give him a <b>{pct(prob)}</b> chance. {strengthLabel(prob, kind)}
      </div>
      {noisyLabel && (
        <div className="sp-drv-note" style={{ marginTop: "0.4rem", color: "var(--ink-faint)", fontSize: "0.72rem" }}>
          Note: {noisyLabel} is an inherently noisier estimate than HR or K — treat with a wider margin.
        </div>
      )}
    </div>
  );
}

/** Read `baseline_p_ge${n}` (and `_hist`) off a threshold-prop row. */
function baselineKey(row: object, n: number, histVariant = false): number | undefined {
  const key = `baseline_p_ge${n}${histVariant ? "_hist" : ""}`;
  return (row as Record<string, number | undefined>)[key];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Pitcher (Strikeouts) modal body
// ─────────────────────────────────────────────────────────────────────────────

function PitcherBody({
  data,
  id,
  source,
  onOpenPlayer,
  onClose,
}: {
  data: Projections;
  id: string;
  source: Source;
  onOpenPlayer?: (playerId: string, prop: ModalProp) => void;
  onClose: () => void;
}) {
  const pick = makePick(source);
  const r: KRow | undefined =
    data.strikeouts.find((x) => String(x.player_id) === id) ??
    data.strikeouts.find((x) => x.player === decodeURIComponent(id));
  if (!r) return <NotFoundBody onClose={onClose} />;

  const displayKs = pick(r.expected_ks, r.expected_ks_hist);
  const displayOverProb = pick(r.over_prob, r.over_prob_hist);
  const scale = Math.max(r.line + 3, displayKs + 1);
  const over = displayKs > r.line;
  const time = gameTimeLabel(r.game_time);

  // Source-aware twin-sphere row: model line (book line) + projected line
  // (raw projection shown, tracker-rounded reach line for its %). Same shape
  // KSpherePair reads on the board surfaces.
  const projLineDisp = pick(r.proj_line, r.proj_line_hist);
  const kPairRow = {
    prob: displayOverProb,
    line: r.line.toFixed(1),
    projection: displayKs.toFixed(1),
    projProb: pick(r.proj_over_prob, r.proj_over_prob_hist),
    projLine: projLineDisp == null ? undefined : Math.round(projLineDisp),
  } as SpatialRow;

  return (
    <>
      <ModalTop
        onClose={onClose}
        name={r.player}
        eyebrow={
          <>
            {r.team}{r.throws ? ` · ${pitLabel(r.throws)}` : ""} · Strikeouts
            {time ? <> · <ClockIcon size={12} /> {time}</> : null}
          </>
        }
      />
      <div className="sp-mbody">
        <HeadlinePanel prob={displayOverProb} kind="k" sphere={<KSpherePair row={kPairRow} size={72} />}>
          <MStat value={pct(displayOverProb)} label={`over ${r.line} Ks`} glow />
          <MStat value={displayKs.toFixed(1)} label="projected Ks" />
        </HeadlinePanel>

        <div className="sp-mpanel">
          <div className="sp-bd-eye" style={{ marginTop: 0 }}>Projection vs the line</div>
          <div className="sp-proj-track">
            <span
              className="sp-proj-fill"
              style={{ width: `${(displayKs / scale) * 100}%`, background: over ? "var(--good)" : "var(--bad)" }}
            />
            <span className="sp-proj-mid" style={{ left: `${(r.line / scale) * 100}%` }} title="the line" />
          </div>
          <div className="sp-drv-note">
            We project <b>{displayKs.toFixed(1)} Ks</b>; the line is <b>{r.line}</b> (the white marker) — so we lean{" "}
            <b style={{ color: over ? "var(--good)" : "var(--bad)" }}>{over ? "OVER" : "UNDER"}</b>.
          </div>
        </div>

        <BaselineBlock baseline={r.baseline_over_prob} baselineHist={r.baseline_over_prob_hist} pace={r.pace} paceHist={r.pace_hist} kind="k" source={source} />

        {r.matchups && r.matchups.length > 0 && (
          <div className="sp-mpanel">
            <div className="sp-bd-eye" style={{ marginTop: 0 }}>Opposing lineup — matchup read</div>
            <div className="sp-mlegend">
              Both sides per batter, per at-bat — <span className="sp-lk">K = strikeout chance</span> ·{" "}
              <span className="sp-lc">C = hit (contact) chance</span>
            </div>
            <div className="sp-mlineup">
              {r.matchups.map((m, i) => {
                const lean = leanFor(m, source);
                const kProb = pickN(m.k_prob, m.k_prob_hist, source) ?? 0;
                const hitProb = pickN(m.hit_prob, m.hit_prob_hist, source) ?? 0;
                const mid = String(m.player_id ?? m.name);
                return (
                  <div className="sp-mline sp-mline--num" key={m.player_id ?? m.name}>
                    <span className="sp-ord">{i + 1}</span>
                    <span className="sp-mline-name">
                      <button type="button" className="sp-linklike" onClick={() => onOpenPlayer?.(mid, "hr")}>
                        {m.name}
                      </button>{" "}
                      <span className="sp-hand">{batLabel(m.bats)}</span>
                      {m.bvp && m.bvp.pa > 0 && (
                        <span className="sp-hand" title="career vs this pitcher">
                          {m.bvp.hits}-{m.bvp.ab}{m.bvp.hr > 0 ? ` · ${m.bvp.hr} HR` : ""}
                        </span>
                      )}
                    </span>
                    <span style={{ marginLeft: "auto" }}>
                      <LeanPair k={kProb} h={hitProb} lean={lean ? leanTag(lean.lean) : undefined} size={40} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <ConditionsPanel
          tempF={r.temp_f}
          windMph={r.wind_mph}
          windDir={r.wind_dir}
          precipPct={r.precip_pct}
          note="Weather barely affects strikeouts — shown for game context."
        />
      </div>
    </>
  );
}

function NotFoundBody({ onClose }: { onClose: () => void }) {
  return (
    <>
      <ModalTop onClose={onClose} name="Not found" eyebrow="—" />
      <div className="sp-mbody">
        <div className="sp-mpanel sp-drv-note">No data for this player.</div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main modal
// ─────────────────────────────────────────────────────────────────────────────

export function PlayerModal({
  open,
  playerId,
  prop,
  threshold = prop === "tb" || prop === "hrr" ? 2 : 1,
  date,
  source,
  barrelEffect = false,
  barrelWeight = false,
  onClose,
  onOpenPlayer,
  projections,
}: PlayerModalProps) {
  // When a payload is injected use it directly; otherwise fetch it.
  const [fetched, setFetched] = useState<Projections | null>(null);
  const data = projections ?? fetched;

  // Escape + scroll-lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Load projections (only when no payload is injected). setState in the async
  // resolve callback, not synchronously in the effect body.
  useEffect(() => {
    if (!open || projections) return;
    loadProjections(date).then(setFetched).catch(console.error);
  }, [open, date, projections]);

  if (!open || playerId == null) return null;

  const id = String(playerId);

  return (
    <div className="sp-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sp-modal sp-float" role="dialog" aria-modal="true">
        {!data ? (
          <div className="sp-mbody">
            <div className="sp-mpanel sp-drv-note"><span className="sp-live-dot" /> loading…</div>
          </div>
        ) : prop === "k" ? (
          <PitcherBody data={data} id={id} source={source} onOpenPlayer={onOpenPlayer} onClose={onClose} />
        ) : (
          <BatterBody
            data={data}
            prop={prop}
            id={id}
            threshold={threshold}
            source={source}
            barrelEffect={barrelEffect}
            barrelWeight={barrelWeight}
            onOpenPlayer={onOpenPlayer}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  usePlayerModalUrl — URL-addressable open/close (?player=&prop=&threshold=)
// ─────────────────────────────────────────────────────────────────────────────

export interface ModalSelection {
  playerId: string;
  prop: ModalProp;
  threshold?: number;
}

const PROP_SLUGS: ModalProp[] = ["hr", "k", "hits", "tb", "runs", "rbi", "hrr"];

function readSelectionFromUrl(): ModalSelection | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const playerId = params.get("player");
  if (!playerId) return null;
  const rawProp = params.get("prop");
  const prop = (PROP_SLUGS.includes(rawProp as ModalProp) ? rawProp : "hr") as ModalProp;
  const t = params.get("threshold");
  const threshold = t ? Number(t) : undefined;
  return { playerId, prop, threshold: Number.isFinite(threshold) ? threshold : undefined };
}

/**
 * URL-drives the modal.  Reads the selection on mount (refresh-safe), keeps it in
 * sync with browser Back/Forward (popstate), and exposes open/close that write the
 * `?player=&prop=&threshold=` params.  Close clears only `?player=`.
 */
export function usePlayerModalUrl() {
  // Lazy initialiser reads the URL once. Safe from hydration mismatch: the /next
  // route only mounts this tree client-side (after its data-loading gate), so this
  // never runs during SSR.
  const [selection, setSelection] = useState<ModalSelection | null>(readSelectionFromUrl);

  useEffect(() => {
    // Browser Back/Forward → re-sync the selection from the URL (closes the modal
    // when `?player=` is gone). setState here is in an event callback, not the body.
    const onPop = () => setSelection(readSelectionFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openPlayer = useCallback((playerId: string, prop: ModalProp, threshold?: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("player", playerId);
    params.set("prop", prop);
    if (threshold != null) params.set("threshold", String(threshold));
    else params.delete("threshold");
    window.history.pushState({ spModal: true }, "", `?${params.toString()}`);
    setSelection({ playerId, prop, threshold });
  }, []);

  const closePlayer = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("player");
    const qs = params.toString();
    window.history.pushState({}, "", qs ? `?${qs}` : window.location.pathname);
    setSelection(null);
  }, []);

  return { selection, openPlayer, closePlayer };
}

export default PlayerModal;
