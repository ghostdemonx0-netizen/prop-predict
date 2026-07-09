/**
 * TopPlays.tsx — The Top Plays surface in the Mock 7 "Spatial Depth" skin.
 *
 * Ported 1:1 (behaviour) from web/components/TopPlays.tsx, reskinned with the
 * spatial kit (GlassCard glass, ProbabilityOrb, CatDot, HandChip, LiveChip,
 * SegmentedControl).
 *
 *   • A show-count SegmentedControl (10 / 25 / 50 / All) at the top.
 *   • Nine collapsible leaderboards rendered as mock7 `details.lb` accordions:
 *       Top Home Runs · Top Pitcher Strikeouts (showPitcher=false) ·
 *       Top Contact (per-AB hit rate, CatDot "C") ·
 *       Top Batter Strikeouts (per-AB K rate, CatDot "K") ·
 *       Top Hits (1/2/3+) · Top Total Bases (2/3/4+) · Top Runs (1/2+) ·
 *       Top RBI (1/2+) · Top H+R+RBI (2/3/4+).
 *     Each accordion has a colour-shifting chevron that rotates on open and
 *     ranked rows with a big display rank (rank #1 gets the iris gradient).
 *   • Rows are source-aware: built via toBoardRows(…, source) so current /
 *     blend / history weighting flows through pickN + leanFor.
 *   • Contact / Batter-K leaderboards are DERIVED from the HR rows' vs-pitcher
 *     matchup: each HR BoardRow carries a source-weighted `hitProb` (per-AB
 *     contact) and `kProb` (per-AB strikeout) computed from `r.vs` inside
 *     toBoardRows. We filter to rows that have that value and sort by it — an
 *     exact port of the original TopPlays derivation.
 *   • The inline threshold pillbars (Hits/TB/Runs/RBI/HRR) call the shared
 *     onThreshold; their wrapper stops click propagation so tapping a pill does
 *     NOT toggle the surrounding <details>.
 *   • Empty per-section state: "Nothing to show yet — lineups may not be posted."
 */
"use client";

import "./spatial.css";
import { useMemo, useState, type ReactNode } from "react";
import type { Projections } from "../../lib/types";
import type { PropKind } from "../../lib/format";
import { platoonAdvantage } from "../../lib/format";
import { toBoardRows, type Source, type SpatialRow } from "../../lib/weighting";
import type { BoardRow } from "../PropBoard";
import type { LiveKind } from "../../lib/live";
import { useLiveFor } from "../LiveProvider";
import { ClockIcon } from "../Icons";

import { GlassCard } from "./GlassCard";
import { ProbabilityOrb } from "./ProbabilityOrb";
import { CatDot } from "./GlassDot";
import { HandChip, FormChip } from "./chips";
import { LiveChip } from "./LiveChipSpatial";
import { SegmentedControl } from "./SegmentedControl";
import { BarrelFlag } from "./BarrelFlag";

// ─────────────────────────────────────────────────────────────────────────────
//  Public types
// ─────────────────────────────────────────────────────────────────────────────

/** Shared per-prop threshold state (same shape as GameHub's thresholds). */
export interface TopPlaysThresholds {
  hits: number;
  tb: number;
  runs: number;
  rbi: number;
  hrr: number;
}

type ThresholdProp = keyof TopPlaysThresholds;

export interface TopPlaysProps {
  projections: Projections;
  source: Source;
  /** Shared per-prop threshold state (drives the inline pillbars + prop kinds). */
  threshold: TopPlaysThresholds;
  /** Shared threshold setter — one prop + its new value. */
  onThreshold: (prop: ThresholdProp, n: number) => void;
  onOpenPlayer: (playerId: number, prop: PropKind) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Small helpers
// ─────────────────────────────────────────────────────────────────────────────

/** "LHB"/"RHB"/"SW" | "LHP"/"RHP" → the HandChip glyph. */
function handGlyph(h?: string): "R" | "L" | "SW" | null {
  if (!h) return null;
  if (h === "SW" || h[0] === "S") return "SW";
  if (h[0] === "L") return "L";
  if (h[0] === "R") return "R";
  return null;
}

const COUNTS = ["10", "25", "50", "All"] as const;
const COUNT_OPTIONS = COUNTS.map((c) => ({ value: c, label: c }));

/** Threshold pill values per prop (mirrors the original setThreshold ranges). */
const THR_VALUES: Record<ThresholdProp, number[]> = {
  hits: [1, 2, 3],
  tb: [2, 3, 4],
  runs: [1, 2],
  rbi: [1, 2],
  hrr: [2, 3, 4],
};

// ─────────────────────────────────────────────────────────────────────────────
//  Downward chevron (rotates on open via CSS)
// ─────────────────────────────────────────────────────────────────────────────

function Chevron() {
  return (
    <svg
      className="sp-lb-chev"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Inline threshold pillbar — stops propagation so it never toggles <details>
// ─────────────────────────────────────────────────────────────────────────────

function ThresholdPills({
  prop,
  value,
  onThreshold,
}: {
  prop: ThresholdProp;
  value: number;
  onThreshold: (prop: ThresholdProp, n: number) => void;
}) {
  const options = THR_VALUES[prop].map((n) => ({ value: String(n), label: `${n}+` }));
  return (
    // stopPropagation on the wrapper keeps a pill-click from bubbling to the
    // <summary> and toggling the accordion open/closed.
    <span className="sp-lb-thr" onClick={(e) => e.stopPropagation()}>
      <SegmentedControl
        options={options}
        value={String(value)}
        onChange={(v) => onThreshold(prop, Number(v))}
        variant="sm"
      />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  One ranked leaderboard row (mock7 .lrow)
// ─────────────────────────────────────────────────────────────────────────────

function TopPlayRow({
  r,
  rank,
  prop,
  sphere,
  live,
  showPitcher = true,
  showForm = false,
  onOpenPlayer,
  oraclePidMap,
}: {
  r: SpatialRow;
  rank: number;
  prop: PropKind;
  sphere: ReactNode;
  live: ReactNode;
  showPitcher?: boolean;
  /** Batter-prop leaderboards render the recent-form chip; pitcher-oriented
   *  boards (Pitcher-K, Contact, Batter-K) pass false so no chip renders. */
  showForm?: boolean;
  onOpenPlayer: (playerId: number, prop: PropKind) => void;
  oraclePidMap?: Record<string, { oracle: number; oracle_score: number }>;
}) {
  const adv = platoonAdvantage(r.playerHand, r.opponent?.hand);
  const pHand = handGlyph(r.playerHand);
  const oppHand = handGlyph(r.opponent?.hand);
  const onOpen = () => {
    if (r.player_id != null) onOpenPlayer(r.player_id, prop);
  };
  return (
    <div
      className="sp-lrow"
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
      <div className="sp-lrank">{rank}</div>
      <div className="sp-linfo">
        <div className="sp-lname">
          <span>{r.player}</span>
          {pHand && <HandChip hand={pHand} adv={adv} />}
          {showForm && r.form && <FormChip kind={r.form} />}
        </div>
        <div className="sp-lsub">
          {(showPitcher && r.opponent) || r.matchup || oraclePidMap?.[String(r.player_id)]?.oracle === 1 ? (
            <span className="sp-lsub-line">
              {oraclePidMap?.[String(r.player_id)]?.oracle === 1 && (
                <span style={{ display: "inline-flex", marginRight: 4 }}><BarrelFlag /></span>
              )}
              {showPitcher && r.opponent && (
                <span className="sp-lsub-vs">
                  vs {r.opponent.name}
                  {oppHand && <HandChip hand={oppHand} />}
                </span>
              )}
              {r.matchup && <span className="sp-lsub-mu">{r.matchup}</span>}
            </span>
          ) : null}
          {r.time && (
            <span className="sp-lsub-time">
              <ClockIcon size={11} /> {r.time}
            </span>
          )}
        </div>
      </div>
      <span className="sp-lrow-right">
        {live}
        {sphere}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  One collapsible leaderboard (mock7 details.lb accordion)
// ─────────────────────────────────────────────────────────────────────────────

function LeaderSection({
  title,
  sub,
  rows,
  count,
  defaultOpen = false,
  controls,
  render,
}: {
  title: string;
  sub: string;
  rows: SpatialRow[];
  count: string;
  defaultOpen?: boolean;
  controls?: ReactNode;
  render: (r: SpatialRow, rank: number) => ReactNode;
}) {
  const shown = count === "All" ? rows : rows.slice(0, Number(count));
  return (
    <GlassCard className="sp-lb">
      <details open={defaultOpen}>
        <summary className="sp-lb-summary">
          <span className="sp-lb-ttl">{title}</span>
          <span className="sp-lb-sub">
            · {sub}
            {rows.length > 0 ? ` · ${rows.length}` : ""}
          </span>
          <span className="sp-lb-right">
            {controls}
            <Chevron />
          </span>
        </summary>
        {rows.length === 0 ? (
          <p className="sp-lb-empty">Nothing to show yet — lineups may not be posted.</p>
        ) : (
          <div className="sp-lead">{shown.map((r, i) => render(r, i + 1))}</div>
        )}
      </details>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Root
// ─────────────────────────────────────────────────────────────────────────────

export function TopPlays({ projections, source, threshold, onThreshold, onOpenPlayer }: TopPlaysProps) {
  const [count, setCount] = useState<string>("10");
  const liveFor = useLiveFor();
  const oracleMap = projections.oracle_by_pid;

  // Prop kinds derived from the shared per-prop thresholds.
  const hitsKind = `hits${threshold.hits}` as PropKind;
  const tbKind = `tb${threshold.tb}` as PropKind;
  const runsKind = `runs${threshold.runs}` as PropKind;
  const rbiKind = `rbi${threshold.rbi}` as PropKind;
  const hrrKind = `hrr${threshold.hrr}` as PropKind;

  // Source-weighted BoardRow arrays, rebuilt only when inputs change.
  const rows = useMemo(() => {
    const hr = toBoardRows(projections, "hr", 1, source);
    // Contact / Batter-K are derived from the HR rows' vs-pitcher matchup:
    // toBoardRows sets each row's source-weighted hitProb / kProb from r.vs.
    const topContact = hr
      .filter((r) => typeof r.hitProb === "number")
      .slice()
      .sort((a, b) => (b.hitProb ?? 0) - (a.hitProb ?? 0));
    const topBatterK = hr
      .filter((r) => typeof r.kProb === "number")
      .slice()
      .sort((a, b) => (b.kProb ?? 0) - (a.kProb ?? 0));
    return {
      hr,
      k: toBoardRows(projections, "k", 0, source),
      contact: topContact,
      batterK: topBatterK,
      hits: toBoardRows(projections, hitsKind, threshold.hits, source),
      tb: toBoardRows(projections, tbKind, threshold.tb, source),
      runs: toBoardRows(projections, runsKind, threshold.runs, source),
      rbi: toBoardRows(projections, rbiKind, threshold.rbi, source),
      hrr: toBoardRows(projections, hrrKind, threshold.hrr, source),
    };
  }, [projections, source, hitsKind, tbKind, runsKind, rbiKind, hrrKind, threshold]);

  const chip = (r: BoardRow, kind: LiveKind) => {
    const lv = liveFor(r, kind);
    return lv ? <LiveChip state={lv.state} have={lv.have} need={lv.need} /> : null;
  };

  return (
    <div>
      <div className="sp-shead">
        <h2>Top Plays</h2>
        <div className="sp-shead-rule" />
        <span className="sp-eyebrow">ranked by model edge</span>
      </div>

      <div className="sp-countbar">
        <span className="sp-eyebrow">Show</span>
        <SegmentedControl options={COUNT_OPTIONS} value={count} onChange={setCount} variant="ghost" />
      </div>

      <div className="sp-lb-stack">
        <LeaderSection
          title="Top Home Runs"
          sub="chance at 1+ HR this game"
          rows={rows.hr}
          count={count}
          defaultOpen
          render={(r, rank) => (
            <TopPlayRow
              key={r.id}
              r={r}
              rank={rank}
              prop="hr"
              showForm
              live={chip(r, "hr")}
              sphere={<ProbabilityOrb prob={r.prob} kind="hr" size={52} />}
              onOpenPlayer={onOpenPlayer}
              oraclePidMap={oracleMap}
            />
          )}
        />

        <LeaderSection
          title="Top Pitcher Strikeouts"
          sub="chance to clear the model K line"
          rows={rows.k}
          count={count}
          render={(r, rank) => (
            <TopPlayRow
              key={r.id}
              r={r}
              rank={rank}
              prop="k"
              showPitcher={false}
              live={chip(r, "k")}
              sphere={<ProbabilityOrb prob={r.prob} kind="k" size={52} />}
              onOpenPlayer={onOpenPlayer}
            />
          )}
        />

        <LeaderSection
          title="Top Contact"
          sub="per at-bat hit rate vs the pitcher"
          rows={rows.contact}
          count={count}
          render={(r, rank) => (
            <TopPlayRow
              key={r.id}
              r={r}
              rank={rank}
              prop="hr"
              live={chip(r, "contact")}
              sphere={<CatDot kind="C" prob={r.hitProb ?? 0} size={52} />}
              onOpenPlayer={onOpenPlayer}
              oraclePidMap={oracleMap}
            />
          )}
        />

        <LeaderSection
          title="Top Batter Strikeouts"
          sub="per at-bat strikeout rate vs the pitcher"
          rows={rows.batterK}
          count={count}
          render={(r, rank) => (
            <TopPlayRow
              key={r.id}
              r={r}
              rank={rank}
              prop="hr"
              live={chip(r, "batterK")}
              sphere={<CatDot kind="K" prob={r.kProb ?? 0} size={52} />}
              onOpenPlayer={onOpenPlayer}
              oraclePidMap={oracleMap}
            />
          )}
        />

        <LeaderSection
          title="Top Hits"
          sub={`chance to reach ${threshold.hits}+ hits`}
          rows={rows.hits}
          count={count}
          controls={<ThresholdPills prop="hits" value={threshold.hits} onThreshold={onThreshold} />}
          render={(r, rank) => (
            <TopPlayRow
              key={r.id}
              r={r}
              rank={rank}
              prop={hitsKind}
              showForm
              live={chip(r, hitsKind)}
              sphere={<ProbabilityOrb prob={r.prob} kind={hitsKind} size={52} />}
              onOpenPlayer={onOpenPlayer}
              oraclePidMap={oracleMap}
            />
          )}
        />

        <LeaderSection
          title="Top Total Bases"
          sub={`chance to reach ${threshold.tb}+ total bases`}
          rows={rows.tb}
          count={count}
          controls={<ThresholdPills prop="tb" value={threshold.tb} onThreshold={onThreshold} />}
          render={(r, rank) => (
            <TopPlayRow
              key={r.id}
              r={r}
              rank={rank}
              prop={tbKind}
              showForm
              live={chip(r, tbKind)}
              sphere={<ProbabilityOrb prob={r.prob} kind={tbKind} size={52} />}
              onOpenPlayer={onOpenPlayer}
              oraclePidMap={oracleMap}
            />
          )}
        />

        <LeaderSection
          title="Top Runs"
          sub={`chance to score ${threshold.runs}+ runs`}
          rows={rows.runs}
          count={count}
          controls={<ThresholdPills prop="runs" value={threshold.runs} onThreshold={onThreshold} />}
          render={(r, rank) => (
            <TopPlayRow
              key={r.id}
              r={r}
              rank={rank}
              prop={runsKind}
              showForm
              live={chip(r, runsKind)}
              sphere={<ProbabilityOrb prob={r.prob} kind={runsKind} size={52} />}
              onOpenPlayer={onOpenPlayer}
              oraclePidMap={oracleMap}
            />
          )}
        />

        <LeaderSection
          title="Top RBI"
          sub={`reach ${threshold.rbi}+ RBI`}
          rows={rows.rbi}
          count={count}
          controls={<ThresholdPills prop="rbi" value={threshold.rbi} onThreshold={onThreshold} />}
          render={(r, rank) => (
            <TopPlayRow
              key={r.id}
              r={r}
              rank={rank}
              prop={rbiKind}
              showForm
              live={chip(r, rbiKind)}
              sphere={<ProbabilityOrb prob={r.prob} kind={rbiKind} size={52} />}
              onOpenPlayer={onOpenPlayer}
              oraclePidMap={oracleMap}
            />
          )}
        />

        <LeaderSection
          title="Top HRR"
          sub={`reach ${threshold.hrr}+ hits+runs+RBI`}
          rows={rows.hrr}
          count={count}
          controls={<ThresholdPills prop="hrr" value={threshold.hrr} onThreshold={onThreshold} />}
          render={(r, rank) => (
            <TopPlayRow
              key={r.id}
              r={r}
              rank={rank}
              prop={hrrKind}
              showForm
              live={chip(r, hrrKind)}
              sphere={<ProbabilityOrb prob={r.prob} kind={hrrKind} size={52} />}
              onOpenPlayer={onOpenPlayer}
              oraclePidMap={oracleMap}
            />
          )}
        />
      </div>
    </div>
  );
}

export default TopPlays;
