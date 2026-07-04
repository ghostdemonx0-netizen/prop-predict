/**
 * GameHub.tsx — The Game Hub surface in the Mock 7 "Spatial Depth" skin.
 *
 * Ported 1:1 (behaviour) from the `expandable` ParksBoard cards +
 * GameBreakdown block in web/components/{ParksBoard,PropBoard}.tsx, reskinned
 * with the spatial kit (GlassCard glass, EnvDot, chips, ProbabilityOrb, LiveChip,
 * BatterGrid).
 *
 *   • One collapsible <details> card per game (mock7 .hubcard look): env-coloured
 *     left border, summary with matchup + first-pitch clock + park name + EnvDot +
 *     park / weather / wind / temp / rain chips. Games ordered by first pitch.
 *   • First game open by default; open/closed state is preserved across
 *     re-renders (controlled <details> keyed by game id) so flipping the source
 *     or a threshold does not slam every card shut.
 *   • Expanded: Starting Pitchers rows (hand chip, status, line/proj, LiveChip,
 *     orb) then the <BatterGrid> (sortable 7-column batter breakdown).
 *   • Batters are source-aware: rows are built via toBoardRows(…, source) so the
 *     current / blend / history weighting flows through pickN + leanFor.
 *   • Empty per-game state: "No player projections yet — lineups may not be posted."
 */
"use client";

import "./spatial.css";
import { useMemo, useState } from "react";
import type { Game, Projections } from "../../lib/types";
import type { PropKind } from "../../lib/format";
import { gameTimeLabel, windText, arrowColor } from "../../lib/format";
import { toBoardRows, type Source } from "../../lib/weighting";
import type { BoardRow } from "../PropBoard";
import { useLiveFor } from "../LiveProvider";
import { WindIcon, TempIcon, RainIcon, ClockIcon } from "../Icons";

import { GlassCard } from "./GlassCard";
import { EnvDot } from "./GlassDot";
import { HandChip, TagChip, FBox, envImpactColor, tempColor } from "./chips";
import { ProbabilityOrb } from "./ProbabilityOrb";
import { LiveChip } from "./LiveChipSpatial";
import { BatterGrid } from "./BatterGrid";

// ─────────────────────────────────────────────────────────────────────────────
//  Small helpers
// ─────────────────────────────────────────────────────────────────────────────

function signed(mult: number): string {
  const v = Math.round((mult - 1) * 100);
  return `${v >= 0 ? "+" : ""}${v}%`;
}

function handGlyph(h?: string): "R" | "L" | "SW" | null {
  if (!h) return null;
  if (h === "SW" || h[0] === "S") return "SW";
  if (h[0] === "L") return "L";
  if (h[0] === "R") return "R";
  return null;
}

function tagStatus(status: string): "conf" | "proj" {
  return status === "confirmed" ? "conf" : "proj";
}

/** Env boost → left-border colour (matches ParksBoard expandable). */
function edgeColor(env: number): string {
  const boost = env - 1;
  return boost > 0.05 ? "var(--good)" : boost < -0.05 ? "var(--bad)" : "var(--warn)";
}

export interface GameHubThresholds {
  hits: number;
  tb: number;
  runs: number;
  rbi: number;
  hrr: number;
}

export interface GameHubProps {
  games: Game[];
  projections: Projections;
  thresholds: GameHubThresholds;
  source: Source;
  onOpenPlayer: (playerId: number, prop: PropKind) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Card summary face (matchup + clock + park + EnvDot + condition chips)
// ─────────────────────────────────────────────────────────────────────────────

function CardFace({ g }: { g: Game }) {
  const time = gameTimeLabel(g.game_time);
  const hasWind = typeof g.wind_dir === "number" && typeof g.wind_mph === "number";
  const showRain = (g.precip_pct ?? 0) >= 20;

  return (
    <>
      <div className="sp-hubtop">
        <div>
          <div className="sp-gtitle">{g.matchup}</div>
          <div className="sp-gtime">
            <ClockIcon size={12} />
            {time ? `${time} · ` : ""}
            {g.park_name ?? g.park}
          </div>
        </div>
        <EnvDot pct={g.env} size={60} />
      </div>

      <div className="sp-hubchips">
        <FBox
          label="Park"
          value={<span style={{ color: envImpactColor(g.park_mult) }}>{signed(g.park_mult)}</span>}
        />
        <FBox
          label="Wx"
          value={<span style={{ color: envImpactColor(g.weather_mult) }}>{signed(g.weather_mult)}</span>}
        />
        {hasWind && (
          <FBox
            icon={<WindIcon deg={g.wind_dir as number} size={13} style={{ color: arrowColor(g.wind_dir as number) }} />}
            label={windText(g.wind_dir as number)}
            value={`${Math.round(g.wind_mph as number)}mph`}
          />
        )}
        {typeof g.temp_f === "number" && (() => {
          const tc = tempColor(g.temp_f);
          return (
            <FBox
              icon={<TempIcon size={13} style={{ color: tc }} />}
              value={<span style={{ color: tc }}>{Math.round(g.temp_f)}°</span>}
            />
          );
        })()}
        {showRain && (
          <FBox icon={<RainIcon size={13} style={{ color: "var(--iris-cyan)" }} />} value={`${g.precip_pct}%`} />
        )}
      </div>

      <span className="sp-tap">
        <span className="sp-tap-chev">▾</span>
        full breakdown — starters · lineups · edges
      </span>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Starting pitchers (one row per starter)
// ─────────────────────────────────────────────────────────────────────────────

function PitcherRow({
  r,
  onOpenPlayer,
}: {
  r: BoardRow;
  onOpenPlayer: (id: number, prop: PropKind) => void;
}) {
  const liveFor = useLiveFor();
  const lv = liveFor(r, "k");
  const pHand = handGlyph(r.playerHand);
  const onOpen = () => {
    if (r.player_id != null) onOpenPlayer(r.player_id, "k");
  };
  return (
    <div
      className="sp-pitrow"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <span className="sp-pit-main">
        <span className="sp-pit-nmrow">
          <span className="sp-pit-nm">{r.player}</span>
          {pHand && <HandChip hand={pHand} />}
        </span>
        {r.status && (
          <span className="sp-pit-sub">
            <TagChip status={tagStatus(r.status)} />
          </span>
        )}
      </span>
      <span className="sp-pit-line">
        line {r.line} · proj {r.projection} K
      </span>
      <span className="sp-pit-right">
        {lv && <LiveChip state={lv.state} have={lv.have} need={lv.need} />}
        <ProbabilityOrb prob={r.prob} kind="k" size={44} />
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  One game's expanded breakdown (pitchers + batter grid)
// ─────────────────────────────────────────────────────────────────────────────

function GameBreakdown({
  g,
  rows,
  thresholds,
  hitsKind,
  tbKind,
  runsKind,
  rbiKind,
  hrrKind,
  onOpenPlayer,
}: {
  g: Game;
  rows: {
    hr: BoardRow[];
    k: BoardRow[];
    hits: BoardRow[];
    tb: BoardRow[];
    runs: BoardRow[];
    rbi: BoardRow[];
    hrr: BoardRow[];
  };
  thresholds: GameHubThresholds;
  hitsKind: PropKind;
  tbKind: PropKind;
  runsKind: PropKind;
  rbiKind: PropKind;
  hrrKind: PropKind;
  onOpenPlayer: (id: number, prop: PropKind) => void;
}) {
  const gameId = g.game_id != null ? String(g.game_id) : undefined;
  const inGame = (r: BoardRow) => (gameId != null ? r.gameId === gameId : r.matchup === g.matchup);

  const hr = rows.hr.filter(inGame);
  const ks = rows.k.filter(inGame);
  const hits = rows.hits.filter(inGame);
  const tb = rows.tb.filter(inGame);
  const runs = rows.runs.filter(inGame);
  const rbi = rows.rbi.filter(inGame);
  const hrr = rows.hrr.filter(inGame);

  if (
    hr.length === 0 &&
    ks.length === 0 &&
    hits.length === 0 &&
    tb.length === 0 &&
    runs.length === 0 &&
    rbi.length === 0 &&
    hrr.length === 0
  ) {
    return <p className="sp-hub-empty">No player projections yet — lineups may not be posted.</p>;
  }

  return (
    <div className="sp-bd">
      {ks.length > 0 && (
        <>
          <div className="sp-bd-eye">Starting pitchers · over Model Book Line</div>
          {ks.map((r) => (
            <PitcherRow key={r.id} r={r} onOpenPlayer={onOpenPlayer} />
          ))}
        </>
      )}
      {hr.length > 0 && (
        <>
          <div className="sp-bd-eye">Batter breakdown</div>
          <BatterGrid
            matchup={g.matchup}
            hrRows={hr}
            hitsRows={hits}
            tbRows={tb}
            runsRows={runs}
            rbiRows={rbi}
            hrrRows={hrr}
            hitsKind={hitsKind}
            tbKind={tbKind}
            runsKind={runsKind}
            rbiKind={rbiKind}
            hrrKind={hrrKind}
            onOpenPlayer={onOpenPlayer}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Root
// ─────────────────────────────────────────────────────────────────────────────

export function GameHub({ games, projections, thresholds, source, onOpenPlayer }: GameHubProps) {
  // Column PropKinds derived from the per-column threshold pickers.
  const hitsKind = `hits${thresholds.hits}` as PropKind;
  const tbKind = `tb${thresholds.tb}` as PropKind;
  const runsKind = `runs${thresholds.runs}` as PropKind;
  const rbiKind = `rbi${thresholds.rbi}` as PropKind;
  const hrrKind = `hrr${thresholds.hrr}` as PropKind;

  // Build source-weighted BoardRow arrays once per (projections, source, threshold).
  const rows = useMemo(
    () => ({
      hr: toBoardRows(projections, "hr", 1, source),
      k: toBoardRows(projections, "k", 0, source),
      hits: toBoardRows(projections, hitsKind, thresholds.hits, source),
      tb: toBoardRows(projections, tbKind, thresholds.tb, source),
      runs: toBoardRows(projections, runsKind, thresholds.runs, source),
      rbi: toBoardRows(projections, rbiKind, thresholds.rbi, source),
      hrr: toBoardRows(projections, hrrKind, thresholds.hrr, source),
    }),
    [projections, source, hitsKind, tbKind, runsKind, rbiKind, hrrKind, thresholds],
  );

  // Games in first-pitch order (matches ParksBoard expandable).
  const ordered = useMemo(
    () => [...games].sort((a, b) => (a.game_time ?? "9999").localeCompare(b.game_time ?? "9999")),
    [games],
  );

  // Open/closed state, preserved across re-renders. First game open by default.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const first = ordered[0]?.game_id;
    return first != null ? { [String(first)]: true } : {};
  });

  if (!games || games.length === 0) {
    return <div className="sp-float sp-hub-nogames">No games on the board yet.</div>;
  }

  return (
    <div>
      <div className="sp-eyebrow" style={{ marginBottom: "0.3rem" }}>
        Tonight&apos;s games · first pitch order
      </div>
      <div className="sp-hub-intro">
        <p>Every game on the slate — open one for the full breakdown: starters, lineups, and edges.</p>
        <span>spheres = park + weather boost</span>
      </div>

      <div className="sp-hub-cards">
        {ordered.map((g) => {
          const key = String(g.game_id);
          return (
            <GlassCard key={g.game_id} className="sp-hubcard" style={{ borderLeftColor: edgeColor(g.env) }}>
              <details
                open={!!open[key]}
                onToggle={(e) =>
                  setOpen((o) => ({ ...o, [key]: (e.target as HTMLDetailsElement).open }))
                }
              >
                <summary className="sp-hub-summary">
                  <CardFace g={g} />
                </summary>
                <GameBreakdown
                  g={g}
                  rows={rows}
                  thresholds={thresholds}
                  hitsKind={hitsKind}
                  tbKind={tbKind}
                  runsKind={runsKind}
                  rbiKind={rbiKind}
                  hrrKind={hrrKind}
                  onOpenPlayer={onOpenPlayer}
                />
              </details>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

export default GameHub;
