/**
 * BoardView.tsx — The Prop Board surface in the Mock 7 "Spatial Depth" skin.
 *
 * Four views, ported 1:1 (behaviour) from web/components/PropBoard.tsx, reskinned
 * with the spatial kit (GlassCard tilt, ProbabilityOrb, chips, LiveChip):
 *
 *   cards     — tilt cards + 64px orb + full meta stack
 *   split     — top-3 rows as cards under "★ Top plays", the rest in the table
 *   table     — table.sp-board, orb (42px) in the probability column
 *   matchups  — rows grouped per game (first-pitch order):
 *                 K prop     → flat two-pitcher list per game
 *                 hitters    → collapsible away|home split, lit opposing pitcher
 *
 * Data seam: consumes BoardRow[] (from PropBoard.tsx) unchanged; live-chip state
 * comes from useLiveFor() (LiveProvider). Nothing here recomputes probabilities.
 */
"use client";

import "../spatial.css";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { PropKind } from "../../../lib/format";
import { strengthTier, strengthLabel, platoonAdvantage, arrowColor } from "../../../lib/format";
import type { Source, SpatialRow } from "../../../lib/weighting";
import { useLiveFor } from "../../LiveProvider";
import type { LiveKind } from "../../../lib/live";
import { WindIcon, TempIcon, RainIcon, ClockIcon } from "../../Icons";

import { GlassCard } from "../GlassCard";
import { ProbabilityOrb } from "../ProbabilityOrb";
import { Badge, TagChip, HandChip, FormChip, FBox, Bvp } from "../chips";
import { LiveChip } from "../LiveChipSpatial";

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export type BoardViewMode = "cards" | "split" | "table" | "matchups";

export interface BoardViewProps {
  rows: SpatialRow[];
  view: BoardViewMode;
  prop: PropKind;
  /** Numeric threshold (encoded already in `prop`); kept for API symmetry. */
  threshold?: number;
  /** Weighting source (rows are already computed with it); kept for symmetry. */
  source?: Source;
  onOpenPlayer: (playerId: number, prop: PropKind) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Small shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Map a lineup/pitcher status string to the kit TagChip's conf|proj. */
function tagStatus(status: string): "conf" | "proj" {
  return status === "confirmed" ? "conf" : "proj";
}

/** Batter/pitcher hand string ("RHB"/"LHB"/"SW"/"RHP"/"LHP") → HandChip glyph. */
function handGlyph(h?: string): "R" | "L" | "SW" | null {
  if (!h) return null;
  if (h === "SW" || h[0] === "S") return "SW";
  if (h[0] === "L") return "L";
  if (h[0] === "R") return "R";
  return null;
}

/** Progressive weather-heat colour for the temperature pill.
 *  cold (<60°) = blue · mild (60–78°) = green · warm (79–88°) = amber · hot (>88°) = red. */
function tempColor(t: number): string {
  if (t < 60) return "var(--iris-cyan)";
  if (t <= 78) return "var(--green)";
  if (t <= 88) return "var(--amber)";
  return "var(--red)";
}

/** Weather condition pills (ported from PropBoard.WeatherChips). */
function ConditionPills({ r }: { r: SpatialRow }) {
  const dir =
    typeof r.windDir === "number"
      ? r.windDir
      : r.windOut !== undefined
      ? r.windOut >= 0
        ? 0
        : 180
      : undefined;
  const mph =
    typeof r.windMph === "number"
      ? r.windMph
      : typeof r.windOut === "number"
      ? Math.abs(r.windOut)
      : undefined;
  const hasWind = typeof dir === "number" && typeof mph === "number";
  const hasTemp = typeof r.tempF === "number";
  const showRain = (r.precipPct ?? 0) >= 20;
  if (!hasWind && !hasTemp && !showRain) return null;

  const windColor = hasWind ? arrowColor(dir as number) : "var(--warn)";

  return (
    <div className="sp-conds">
      {hasWind && (
        <FBox
          icon={<WindIcon deg={dir as number} size={13} style={{ color: windColor }} />}
          value={`${Math.round(mph as number)}mph`}
        />
      )}
      {hasTemp && (() => {
        const tc = tempColor(r.tempF as number);
        return (
          <FBox
            icon={<TempIcon size={13} style={{ color: tc }} />}
            value={<span style={{ color: tc }}>{Math.round(r.tempF as number)}°</span>}
          />
        );
      })()}
      {showRain && (
        <FBox
          icon={<RainIcon size={13} style={{ color: "var(--iris-cyan)" }} />}
          value={`${r.precipPct}%`}
        />
      )}
    </div>
  );
}

/** The "vs {pitcher}{hand}" fragment used on cards + table. */
function OppFragment({
  opponent,
  lit = false,
}: {
  opponent: { name: string; hand?: string };
  lit?: boolean;
}) {
  return (
    <span className="sp-vs">
      vs <span className={lit ? "sp-vs-lit" : undefined}>{opponent.name}</span>
      {opponent.hand && <HandChip hand={(handGlyph(opponent.hand) ?? "R") as "R" | "L" | "SW"} />}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Cards
// ─────────────────────────────────────────────────────────────────────────────

/** A clickable wrapper that hosts the tilt GlassCard as the grid cell. */
function ClickableCard({
  onOpen,
  children,
}: {
  onOpen: () => void;
  children: ReactNode;
}) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };
  return (
    <div className="sp-pcard-click" role="button" tabIndex={0} onClick={onOpen} onKeyDown={onKey}>
      <GlassCard tilt className="sp-pcard">
        {children}
      </GlassCard>
    </div>
  );
}

function PropCard({
  r,
  prop,
  index,
  onOpenPlayer,
}: {
  r: SpatialRow;
  prop: PropKind;
  index: number;
  onOpenPlayer: (id: number, prop: PropKind) => void;
}) {
  const liveFor = useLiveFor();
  const lv = liveFor(r, prop as LiveKind);
  const tier = strengthTier(r.prob, prop);
  const pHand = handGlyph(r.playerHand);
  const adv = platoonAdvantage(r.playerHand, r.opponent?.hand);
  const isK = prop === "k";

  return (
    <ClickableCard onOpen={() => r.player_id != null && onOpenPlayer(r.player_id, prop)}>
      <div className="sp-topr" style={{ animationDelay: `${index * 45}ms` }}>
        <div className="sp-topr-l">
          <div className="sp-pname">{r.player}</div>
          <div className="sp-psub">
            {r.team} · {r.detail}
          </div>
        </div>
        <div className="sp-orb-live">
          <ProbabilityOrb prob={r.prob} kind={prop} size={64} />
          {lv && <LiveChip state={lv.state} have={lv.have} need={lv.need} />}
        </div>
      </div>

      <div className="sp-pmeta">
        <div className="sp-prow">
          <Badge kind={tier}>{strengthLabel(r.prob, prop)}</Badge>
          {r.status && <TagChip status={tagStatus(r.status)} order={r.bat_order} />}
          {!isK && r.form && <FormChip kind={r.form} />}
        </div>

        <div className="sp-prow">
          {pHand && <HandChip hand={pHand} adv={adv} />}
          {r.matchup && (
            <span className="sp-matchup" title="game">
              {r.matchup}
            </span>
          )}
          {isK
            ? r.projection && <span>proj {r.projection} K</span>
            : r.opponent && <OppFragment opponent={r.opponent} />}
          {!isK && r.bvp && r.bvp.pa > 0 && (
            <Bvp hits={r.bvp.hits} ab={r.bvp.ab} hr={r.bvp.hr} />
          )}
          {r.time && (
            <span className="sp-clock">
              <ClockIcon size={12} /> {r.time}
            </span>
          )}
        </div>

        <ConditionPills r={r} />
      </div>
    </ClickableCard>
  );
}

function CardsGrid({
  rows,
  prop,
  onOpenPlayer,
}: {
  rows: SpatialRow[];
  prop: PropKind;
  onOpenPlayer: (id: number, prop: PropKind) => void;
}) {
  return (
    <div className="sp-board-grid">
      {rows.map((r, i) => (
        <PropCard key={r.id} r={r} prop={prop} index={i} onOpenPlayer={onOpenPlayer} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Table
// ─────────────────────────────────────────────────────────────────────────────

function BoardTable({
  rows,
  prop,
  onOpenPlayer,
}: {
  rows: SpatialRow[];
  prop: PropKind;
  onOpenPlayer: (id: number, prop: PropKind) => void;
}) {
  const liveFor = useLiveFor();
  const isK = prop === "k";

  return (
    <div className="sp-board-tablewrap sp-float">
      <table className="sp-board">
        <thead>
          <tr>
            <th style={{ whiteSpace: "nowrap" }}>Player</th>
            <th style={{ whiteSpace: "nowrap" }}>Team</th>
            <th style={{ width: "100%" }}>{isK ? "Opponent" : "Matchup"}</th>
            <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Time</th>
            {isK && (
              <th
                style={{ textAlign: "center" }}
                title="not a sportsbook line — the model sets it from his typical start"
              >
                Model Book Line
              </th>
            )}
            {isK && <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Proj Ks</th>}
            <th style={{ textAlign: "right" }}>Probability</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const lv = liveFor(r, prop as LiveKind);
            const pHand = handGlyph(r.playerHand);
            const adv = platoonAdvantage(r.playerHand, r.opponent?.hand);
            return (
              <tr
                key={r.id}
                onClick={() => r.player_id != null && onOpenPlayer(r.player_id, prop)}
              >
                <td className="sp-pl-cell">
                  <span className="sp-tp">{r.player}</span>
                  {(pHand || r.status || (!isK && r.form)) && (
                    <span className="sp-pl-chips">
                      {pHand && <HandChip hand={pHand} adv={adv} />}
                      {r.status && (
                        <TagChip status={tagStatus(r.status)} order={r.bat_order} />
                      )}
                      {!isK && r.form && <FormChip kind={r.form} />}
                    </span>
                  )}
                </td>
                <td className="sp-mono" style={{ color: "var(--ink-dim)", whiteSpace: "nowrap" }}>
                  {r.team}
                </td>
                <td style={{ color: "var(--ink-dim)" }}>
                  {isK ? (
                    r.opponent && <span>vs {r.opponent.name}</span>
                  ) : (
                    <>
                      <span style={{ whiteSpace: "nowrap" }}>{r.detail}</span>
                      {r.opponent && (
                        <>
                          <span style={{ opacity: 0.45 }}> · </span>
                          <OppFragment opponent={r.opponent} />
                        </>
                      )}
                    </>
                  )}
                </td>
                <td
                  className="sp-mono"
                  style={{ textAlign: "center", whiteSpace: "nowrap", color: "var(--ink-dim)" }}
                >
                  {r.time}
                </td>
                {isK && (
                  <td className="sp-mono" style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                    {r.line}
                  </td>
                )}
                {isK && (
                  <td className="sp-mono" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {r.projection}
                  </td>
                )}
                <td>
                  <div className="sp-prob-cell">
                    {lv && <LiveChip state={lv.state} have={lv.have} need={lv.need} />}
                    <ProbabilityOrb prob={r.prob} kind={prop} size={42} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Split
// ─────────────────────────────────────────────────────────────────────────────

function SplitView({
  rows,
  prop,
  onOpenPlayer,
}: {
  rows: SpatialRow[];
  prop: PropKind;
  onOpenPlayer: (id: number, prop: PropKind) => void;
}) {
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <div className="sp-board-split">
      <div>
        <div className="sp-eyebrow" style={{ marginBottom: "0.6rem" }}>
          ★ Top plays
        </div>
        <CardsGrid rows={top} prop={prop} onOpenPlayer={onOpenPlayer} />
      </div>
      {rest.length > 0 && (
        <div>
          <div className="sp-eyebrow" style={{ margin: "1.25rem 0 0.4rem" }}>
            Full board
          </div>
          <BoardTable rows={rest} prop={prop} onOpenPlayer={onOpenPlayer} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Matchups (per-game grouping; K = pitcher list, hitters = away|home split)
// ─────────────────────────────────────────────────────────────────────────────

/** One player line: name + (advantage-lit) hand chip + LiveChip + orb. */
function BoardRowLine({
  r,
  prop,
  onOpenPlayer,
}: {
  r: SpatialRow;
  prop: PropKind;
  onOpenPlayer: (id: number, prop: PropKind) => void;
}) {
  const liveFor = useLiveFor();
  const lv = liveFor(r, prop as LiveKind);
  const pHand = handGlyph(r.playerHand);
  const adv = platoonAdvantage(r.playerHand, r.opponent?.hand);
  const isK = prop === "k";
  return (
    <div
      className="sp-mrow"
      role="button"
      tabIndex={0}
      onClick={() => r.player_id != null && onOpenPlayer(r.player_id, prop)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (r.player_id != null) onOpenPlayer(r.player_id, prop);
        }
      }}
    >
      <span className="sp-mrow-name">
        <span className="sp-mrow-nm">{r.player}</span>
        {pHand && <HandChip hand={pHand} adv={adv} />}
        {!isK && r.form && <FormChip kind={r.form} />}
      </span>
      <span className="sp-mrow-right">
        {lv && <LiveChip state={lv.state} have={lv.have} need={lv.need} sm />}
        <ProbabilityOrb prob={r.prob} kind={prop} size={42} />
      </span>
    </div>
  );
}

/** Hitters split away|home (matching "AWAY @ HOME"), lit pitcher per side. */
function TeamSplit({
  matchup,
  rows,
  prop,
  onOpenPlayer,
}: {
  matchup: string;
  rows: SpatialRow[];
  prop: PropKind;
  onOpenPlayer: (id: number, prop: PropKind) => void;
}) {
  const [away, home] = matchup.split(" @ ");
  const awayRows = rows.filter((r) => r.team === away);
  const homeRows = rows.filter((r) => r.team === home);
  const split = home !== undefined && awayRows.length + homeRows.length === rows.length;

  if (!split) {
    return (
      <>
        {rows.map((r) => (
          <BoardRowLine key={r.id} r={r} prop={prop} onOpenPlayer={onOpenPlayer} />
        ))}
      </>
    );
  }

  const sides: { label: string; rs: SpatialRow[]; cls: string }[] = [
    { label: `${away} · away`, rs: awayRows, cls: "sp-mside sp-mside--away" },
    { label: `${home} · home`, rs: homeRows, cls: "sp-mside sp-mside--home" },
  ];

  return (
    <div className="sp-msplit">
      {sides.map(({ label, rs, cls }) => {
        const opp = rs.find((r) => r.opponent)?.opponent;
        return (
          <div key={label} className={cls}>
            <div className="sp-mside-hdr">
              <span style={{ flexShrink: 0 }}>{label}</span>
              {opp && (
                <span className="sp-mside-opp">
                  vs <b>{opp.name}</b>
                  {opp.hand && <> <HandChip hand={(handGlyph(opp.hand) ?? "R") as "R" | "L" | "SW"} /></>}
                </span>
              )}
            </div>
            {rs.map((r) => (
              <BoardRowLine key={r.id} r={r} prop={prop} onOpenPlayer={onOpenPlayer} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function GroupHead({ label, time }: { label: string; time?: string }) {
  return (
    <div className="sp-mhead">
      <span>{label}</span>
      {time && (
        <span className="sp-mtime">
          <ClockIcon size={12} /> {time}
        </span>
      )}
    </div>
  );
}

function MatchupsView({
  rows,
  prop,
  onOpenPlayer,
}: {
  rows: SpatialRow[];
  prop: PropKind;
  onOpenPlayer: (id: number, prop: PropKind) => void;
}) {
  const isK = prop === "k";

  // Group by unique game (gameId), keeping in-game prob order; order games by
  // first pitch. Keyed by game id so doubleheaders stay separate.
  const groups: { key: string; label: string; rows: SpatialRow[] }[] = [];
  const seen = new Map<string, number>();
  for (const r of rows) {
    const key = r.gameId ?? r.matchup ?? "Other";
    if (!seen.has(key)) {
      seen.set(key, groups.length);
      groups.push({ key, label: r.matchup ?? "Other", rows: [] });
    }
    groups[seen.get(key)!].rows.push(r);
  }
  groups.sort((a, b) => (a.rows[0].timeSort ?? "9999").localeCompare(b.rows[0].timeSort ?? "9999"));

  if (isK) {
    // Two pitchers per game — flat list stays readable.
    return (
      <div>
        <div className="sp-eyebrow" style={{ marginBottom: "0.6rem" }}>
          Matchups · first pitch order
        </div>
        {groups.map((g) => (
          <div key={g.key} className="sp-mgroup">
            <GroupHead label={g.label} time={g.rows[0].time} />
            {g.rows.map((r) => (
              <BoardRowLine key={r.id} r={r} prop={prop} onOpenPlayer={onOpenPlayer} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Hitters: many per game — collapse each game behind a <details>.
  return (
    <div>
      <div className="sp-eyebrow" style={{ marginBottom: "0.6rem" }}>
        Matchups · first pitch order
      </div>
      {groups.map((g) => {
        // Game-level lineup status: confirmed only when nothing is still projected.
        const groupStatus = g.rows.some((r) => r.status && r.status !== "confirmed")
          ? "projected"
          : g.rows.some((r) => r.status)
          ? "confirmed"
          : undefined;
        return (
          <details key={g.key} className="sp-mdetails">
            <summary>
              <GroupHead label={g.label} time={g.rows[0].time} />
              {groupStatus && <TagChip status={tagStatus(groupStatus)} />}
              <span className="sp-mcount">{g.rows.length} hitters</span>
            </summary>
            <TeamSplit matchup={g.label} rows={g.rows} prop={prop} onOpenPlayer={onOpenPlayer} />
          </details>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  const style: CSSProperties = { textAlign: "center", color: "var(--ink-dim)", padding: "26px 20px" };
  return (
    <div className="sp-float" style={style}>
      No plays on the board yet — lineups may not be posted.
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Root dispatch
// ─────────────────────────────────────────────────────────────────────────────

export function BoardView({ rows, view, prop, onOpenPlayer }: BoardViewProps) {
  if (rows.length === 0) return <EmptyState />;

  if (view === "table") return <BoardTable rows={rows} prop={prop} onOpenPlayer={onOpenPlayer} />;
  if (view === "matchups")
    return <MatchupsView rows={rows} prop={prop} onOpenPlayer={onOpenPlayer} />;
  if (view === "split") return <SplitView rows={rows} prop={prop} onOpenPlayer={onOpenPlayer} />;
  return <CardsGrid rows={rows} prop={prop} onOpenPlayer={onOpenPlayer} />;
}

export default BoardView;
