/**
 * BatterGrid.tsx — The Game Hub batter breakdown grid, Mock 7 "Spatial Depth" skin.
 *
 * Ported 1:1 (behaviour) from the ColSplit / ColTeam / ColHeaders / ColBatterRow
 * block in web/components/PropBoard.tsx, reskinned with the spatial kit
 * (LeanPair for K/C/N, ProbabilityOrb for the 6 prop columns, LiveChip, chips).
 *
 *   • One row per batter across a 7-sphere grid: K/C/N · HR · Hits · TB · Runs ·
 *     RBI · HRR (thresholds picked per column by the parent).
 *   • Sortable column headers + a BATTERS sort button (sorts by batting order).
 *   • Away / home split; EACH side keeps its OWN sort state (default HR desc), so
 *     the two lineups sort independently.
 *   • Per-column threshold-aware labels (1H+ / 2TB+ / 1R+ / 1RBI+ / 2HRR+).
 *   • K/C/N sphere: dominant-vs-faint-vs-neutral logic (delegated to LeanPair
 *     compact — same |k−h|<0.04 neutral threshold + dominant-side caption).
 *   • `#= batting order` legend row under the headers.
 *   • Batter name row links via onOpenPlayer(player_id, "hr").
 *
 * Data seam: consumes BoardRow[] (from PropBoard.tsx) unchanged — rows are
 * already source-weighted by the caller (toBoardRows). Live-chip state comes
 * from useLiveFor(); nothing here recomputes probabilities.
 */
"use client";

import "./spatial.css";
import { useState, type ReactNode } from "react";
import type { PropKind } from "../../lib/format";
import { platoonAdvantage } from "../../lib/format";
import type { BoardRow } from "../PropBoard";
import type { SpatialRow } from "../../lib/weighting";
import { useLiveFor } from "../LiveProvider";
import type { LiveKind } from "../../lib/live";

import { ProbabilityOrb } from "./ProbabilityOrb";
import { BarrelFlag } from "./BarrelFlag";
import { CatDot, LeanPair } from "./GlassDot";
import { HandChip, TagChip, FormChip } from "./chips";
import { LiveChip } from "./LiveChipSpatial";

// ─────────────────────────────────────────────────────────────────────────────
//  Small shared helpers (kept local — mirror BoardView's private helpers)
// ─────────────────────────────────────────────────────────────────────────────

/** Lineup/pitcher status string → kit TagChip's conf|proj. */
function tagStatus(status: string): "conf" | "proj" {
  return status === "confirmed" ? "conf" : "proj";
}

/** Batter/pitcher hand ("RHB"/"LHB"/"SW"/"RHP"/"LHP") → HandChip glyph. */
function handGlyph(h?: string): "R" | "L" | "SW" | null {
  if (!h) return null;
  if (h === "SW" || h[0] === "S") return "SW";
  if (h[0] === "L") return "L";
  if (h[0] === "R") return "R";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sort state
// ─────────────────────────────────────────────────────────────────────────────

type SortCol = "order" | "lean" | "hr" | "hits" | "tb" | "runs" | "rbi" | "hrr";
type SortState = { col: SortCol; dir: 1 | -1 };

/** hits1→"1H+" · tb2→"2TB+" · runs1→"1R+" · rbi1→"1RBI+" · hrr2→"2HRR+" */
function colLabel(kind: PropKind): string {
  if (kind.startsWith("hits")) return `${kind.slice(4)}H+`;
  if (kind.startsWith("tb")) return `${kind.slice(2)}TB+`;
  if (kind.startsWith("runs")) return `${kind.slice(4)}R+`;
  if (kind.startsWith("rbi")) return `${kind.slice(3)}RBI+`;
  if (kind.startsWith("hrr")) return `${kind.slice(3)}HRR+`;
  return kind.toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Column headers — click any to sort; BATTERS sorts by batting order
// ─────────────────────────────────────────────────────────────────────────────

function ColHeaders({
  hitsKind,
  tbKind,
  runsKind,
  rbiKind,
  hrrKind,
  sort,
  onSort,
}: {
  hitsKind: PropKind;
  tbKind: PropKind;
  runsKind: PropKind;
  rbiKind: PropKind;
  hrrKind: PropKind;
  sort: SortState;
  onSort: (col: SortCol) => void;
}) {
  const arrow = (col: SortCol) =>
    sort.col === col ? <span className="sp-bh-ar">{sort.dir < 0 ? "▾" : "▴"}</span> : null;

  const cell = (label: ReactNode, col: SortCol) => (
    <button
      key={col}
      type="button"
      onClick={() => onSort(col)}
      title="sort by this column"
      className={`sp-bh sp-bh--sortable${sort.col === col ? " sp-bh--on" : ""}`}
    >
      {label}
      {arrow(col)}
    </button>
  );

  return (
    <div className="sp-bhead">
      <button
        type="button"
        onClick={() => onSort("order")}
        title="sort by batting order"
        className={`sp-bh sp-bh--sortable sp-bh--batters${sort.col === "order" ? " sp-bh--on" : ""}`}
      >
        BATTERS
        {sort.col === "order" && <span className="sp-bh-ar">{sort.dir < 0 ? "▾" : "▴"}</span>}
      </button>
      {cell(
        <span className="sp-bh-kc">
          <span className="k">K</span>/<span className="c">C</span>/<span className="n">N</span>
        </span>,
        "lean",
      )}
      {cell("HR", "hr")}
      {cell(colLabel(hitsKind), "hits")}
      {cell(colLabel(tbKind), "tb")}
      {cell(colLabel(runsKind), "runs")}
      {cell(colLabel(rbiKind), "rbi")}
      {cell(colLabel(hrrKind), "hrr")}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  One batter row — name + hand + status, then 7 sphere columns
// ─────────────────────────────────────────────────────────────────────────────

function BatterRow({
  hrRow,
  hitsRow,
  tbRow,
  runsRow,
  rbiRow,
  hrrRow,
  hitsKind,
  tbKind,
  runsKind,
  rbiKind,
  hrrKind,
  onOpenPlayer,
  oraclePidMap,
}: {
  hrRow: BoardRow;
  hitsRow?: BoardRow;
  tbRow?: BoardRow;
  runsRow?: BoardRow;
  rbiRow?: BoardRow;
  hrrRow?: BoardRow;
  hitsKind: PropKind;
  tbKind: PropKind;
  runsKind: PropKind;
  rbiKind: PropKind;
  hrrKind: PropKind;
  onOpenPlayer: (id: number, prop: PropKind) => void;
  oraclePidMap?: Record<string, { oracle: number; oracle_score: number }>;
}) {
  const liveFor = useLiveFor();
  const pHand = handGlyph(hrRow.playerHand);
  const adv = platoonAdvantage(hrRow.playerHand, hrRow.opponent?.hand);
  // Rows arrive typed as BoardRow (GameHub annotates the toBoardRows output),
  // so the derived recent-form indicator is type-erased here — read it back off
  // the runtime SpatialRow. These are always batter rows, so a chip is apt.
  const form = (hrRow as SpatialRow).form;

  // The matchup read can sit on any prop row — use whichever has it so the K/C/N
  // sphere never goes missing when one prop's row lacks `lean` (mirrors PropBoard).
  const lean = hrRow.lean ?? hitsRow?.lean ?? tbRow?.lean ?? null;
  const kp = hrRow.kProb ?? hitsRow?.kProb ?? tbRow?.kProb;
  const hp = hrRow.hitProb ?? hitsRow?.hitProb ?? tbRow?.hitProb;

  // K/C/N cell: LeanPair(compact) reproduces the dominant/faint/neutral logic
  // exactly (|k−h|<0.04 neutral, dominant dot + faint other-side caption). Fall
  // back to a single lean dot only if the raw k/h probabilities are absent.
  let leanCell: ReactNode = null;
  if (typeof kp === "number" && typeof hp === "number") {
    leanCell = <LeanPair k={kp} h={hp} compact size={40} />;
  } else if (lean) {
    const kind = lean.lean === "K" ? "K" : lean.lean === "H" ? "C" : "N";
    leanCell = <CatDot kind={kind} prob={lean.prob} size={40} />;
  }

  const propCell = (row: BoardRow | undefined, kind: PropKind, key: string) => {
    if (!row) return <span key={key} className="sp-cell" />;
    const lv = liveFor(row, kind as LiveKind);
    return (
      <span key={key} className="sp-cell sp-bcell">
        <ProbabilityOrb prob={row.prob} kind={kind} size={40} />
        <span className="sp-bcell-live">
          {lv && <LiveChip state={lv.state} have={lv.have} need={lv.need} sm />}
        </span>
      </span>
    );
  };

  const onOpen = () => {
    if (hrRow.player_id != null) onOpenPlayer(hrRow.player_id, "hr");
  };

  return (
    <div
      className="sp-brow"
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
      <span className="sp-bn">
        <span className="sp-bn-nmrow">
          <span className="sp-bn-nm">{hrRow.player}</span>
          {pHand && <HandChip hand={pHand} adv={adv} />}
        </span>
        {(form || hrRow.status || oraclePidMap?.[String(hrRow.player_id)]?.oracle === 1) && (
          <span className="sp-bn-chips">
            {oraclePidMap?.[String(hrRow.player_id)]?.oracle === 1 && (
              <span style={{ display: "inline-flex", marginRight: 2 }}><BarrelFlag /></span>
            )}
            {form && <FormChip kind={form} />}
            {hrRow.status && <TagChip status={tagStatus(hrRow.status)} order={hrRow.bat_order} />}
          </span>
        )}
      </span>
      <span className="sp-cell">{leanCell}</span>
      {propCell(hrRow, "hr", "hr")}
      {propCell(hitsRow, hitsKind, "hits")}
      {propCell(tbRow, tbKind, "tb")}
      {propCell(runsRow, runsKind, "runs")}
      {propCell(rbiRow, rbiKind, "rbi")}
      {propCell(hrrRow, hrrKind, "hrr")}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  One team's sortable column table — holds its OWN sort state
// ─────────────────────────────────────────────────────────────────────────────

function ColTeam({
  team,
  side,
  rs,
  hitsByPlayer,
  tbByPlayer,
  runsByPlayer,
  rbiByPlayer,
  hrrByPlayer,
  hitsKind,
  tbKind,
  runsKind,
  rbiKind,
  hrrKind,
  onOpenPlayer,
  oraclePidMap,
}: {
  team: string;
  side: string;
  rs: BoardRow[];
  hitsByPlayer: Map<string, BoardRow>;
  tbByPlayer: Map<string, BoardRow>;
  runsByPlayer: Map<string, BoardRow>;
  rbiByPlayer: Map<string, BoardRow>;
  hrrByPlayer: Map<string, BoardRow>;
  hitsKind: PropKind;
  tbKind: PropKind;
  runsKind: PropKind;
  rbiKind: PropKind;
  hrrKind: PropKind;
  onOpenPlayer: (id: number, prop: PropKind) => void;
  oraclePidMap?: Record<string, { oracle: number; oracle_score: number }>;
}) {
  const [sort, setSort] = useState<SortState>({ col: "hr", dir: -1 });
  const onSort = (col: SortCol) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === -1 ? 1 : -1 } : { col, dir: col === "order" ? 1 : -1 }));

  const metric = (r: BoardRow): number => {
    if (sort.col === "order") return r.bat_order ?? 999; // unknown slots sort last
    if (sort.col === "lean") return r.lean?.prob ?? 0;
    if (sort.col === "hits") return hitsByPlayer.get(r.player)?.prob ?? 0;
    if (sort.col === "tb") return tbByPlayer.get(r.player)?.prob ?? 0;
    if (sort.col === "runs") return runsByPlayer.get(r.player)?.prob ?? 0;
    if (sort.col === "rbi") return rbiByPlayer.get(r.player)?.prob ?? 0;
    if (sort.col === "hrr") return hrrByPlayer.get(r.player)?.prob ?? 0;
    return r.prob; // hr
  };
  const sorted = [...rs].sort((a, b) => (metric(a) - metric(b)) * sort.dir);
  const opp = rs.find((r) => r.opponent)?.opponent;

  return (
    <div>
      {team && (
        <div className="sp-teamhdr">
          <span style={{ flexShrink: 0 }}>
            {team} · {side}
          </span>
          {opp && (
            <span className="sp-teamhdr-opp">
              vs <span className="sp-teamhdr-gn">{opp.name}</span>
              {opp.hand && <> <HandChip hand={(handGlyph(opp.hand) ?? "R") as "R" | "L" | "SW"} /></>}
            </span>
          )}
        </div>
      )}
      <div className="sp-bgridwrap">
        <ColHeaders
          hitsKind={hitsKind}
          tbKind={tbKind}
          runsKind={runsKind}
          rbiKind={rbiKind}
          hrrKind={hrrKind}
          sort={sort}
          onSort={onSort}
        />
        <div className="sp-bnote">#= batting order</div>
        {sorted.map((r) => (
          <BatterRow
            key={r.id}
            hrRow={r}
            hitsRow={hitsByPlayer.get(r.player)}
            tbRow={tbByPlayer.get(r.player)}
            runsRow={runsByPlayer.get(r.player)}
            rbiRow={rbiByPlayer.get(r.player)}
            hrrRow={hrrByPlayer.get(r.player)}
            hitsKind={hitsKind}
            tbKind={tbKind}
            runsKind={runsKind}
            rbiKind={rbiKind}
            hrrKind={hrrKind}
            onOpenPlayer={onOpenPlayer}
            oraclePidMap={oraclePidMap}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public: BatterGrid — away/home split, one ColTeam per side
// ─────────────────────────────────────────────────────────────────────────────

export interface BatterGridProps {
  matchup: string;
  hrRows: BoardRow[];
  hitsRows?: BoardRow[];
  tbRows?: BoardRow[];
  runsRows?: BoardRow[];
  rbiRows?: BoardRow[];
  hrrRows?: BoardRow[];
  hitsKind?: PropKind;
  tbKind?: PropKind;
  runsKind?: PropKind;
  rbiKind?: PropKind;
  hrrKind?: PropKind;
  onOpenPlayer: (id: number, prop: PropKind) => void;
  oraclePidMap?: Record<string, { oracle: number; oracle_score: number }>;
}

export function BatterGrid({
  matchup,
  hrRows,
  hitsRows = [],
  tbRows = [],
  runsRows = [],
  rbiRows = [],
  hrrRows = [],
  hitsKind = "hits1",
  tbKind = "tb2",
  runsKind = "runs1",
  rbiKind = "rbi1",
  hrrKind = "hrr2",
  onOpenPlayer,
  oraclePidMap,
}: BatterGridProps) {
  const [away, home] = matchup.split(" @ ");
  const hitsByPlayer = new Map(hitsRows.map((r) => [r.player, r]));
  const tbByPlayer = new Map(tbRows.map((r) => [r.player, r]));
  const runsByPlayer = new Map(runsRows.map((r) => [r.player, r]));
  const rbiByPlayer = new Map(rbiRows.map((r) => [r.player, r]));
  const hrrByPlayer = new Map(hrrRows.map((r) => [r.player, r]));

  const awayHr = hrRows.filter((r) => r.team === away);
  const homeHr = hrRows.filter((r) => r.team === home);
  const split = home !== undefined && awayHr.length + homeHr.length === hrRows.length;

  // ONE full-width list (not two narrow side-by-side columns) so the name has room
  // and all 7 sphere columns stay aligned. Away/home shown as labeled sections.
  const sections = split
    ? [
        { team: away, side: "away", rs: awayHr },
        { team: home, side: "home", rs: homeHr },
      ]
    : [{ team: "", side: "", rs: hrRows }];

  return (
    <div>
      {sections.map(({ team, side, rs }) => (
        <ColTeam
          key={`${team}-${side}`}
          team={team}
          side={side}
          rs={rs}
          hitsByPlayer={hitsByPlayer}
          tbByPlayer={tbByPlayer}
          runsByPlayer={runsByPlayer}
          rbiByPlayer={rbiByPlayer}
          hrrByPlayer={hrrByPlayer}
          hitsKind={hitsKind}
          tbKind={tbKind}
          runsKind={runsKind}
          rbiKind={rbiKind}
          hrrKind={hrrKind}
          onOpenPlayer={onOpenPlayer}
          oraclePidMap={oraclePidMap}
        />
      ))}
    </div>
  );
}

export default BatterGrid;
