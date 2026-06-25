"use client";

import Link from "next/link";
import type React from "react";
import { useState } from "react";
import type { ViewMode } from "./ViewSwitcher";
import { pct, strengthLabel, strengthTier, heatColor, arrowColor, platoonAdvantage, type PropKind } from "../lib/format";
import { StatusChip } from "./StatusChip";
import { ClockIcon, WindIcon, TempIcon, RainIcon } from "./Icons";

export type BoardRow = {
  id: string; // stable key: player_id when available, else name
  player: string;
  team: string;
  prob: number; // probability or over_prob
  detail: string; // e.g. "@ COL" or "5.5 Ks"
  href: string;
  matchup?: string; // "AWAY @ HOME" — display label (NOT a unique game key: doubleheaders share it)
  gameId?: string; // unique game key — use this to group/filter so doubleheaders stay separate
  projection?: string; // K board: projected strikeouts, e.g. "6.8"
  line?: string; // K board: our book-style line, e.g. "4.5"
  time?: string; // local game start time, e.g. "7:10 PM EDT"
  timeSort?: string; // raw ISO start time, for first-pitch ordering
  hand?: string; // combined card chip, e.g. "RHB vs LHP"
  playerHand?: string; // this player's own handedness (RHB/LHB/SW or RHP/LHP)
  opponent?: { name: string; hand?: string }; // opposing pitcher (+hand) for hitters, or opposing team for pitchers
  windOut?: number; // mph toward center field (+out / -in) — fallback if no direction
  windMph?: number; // true wind speed
  windDir?: number; // direction of travel rel. to CF: 0=out to CF, 90=to RF, 180=in, 270=to LF
  tempF?: number;
  precipPct?: number;
  bvp?: { pa: number; ab: number; hits: number; hr: number; k: number; avg: string } | null;
  lean?: { lean: string; prob: number } | null; // batter-vs-pitcher matchup read (K/C/N sphere)
  hitProb?: number; // raw per-AB hit (contact) probability vs this pitcher — Top Plays "Top Contact"
  kProb?: number; // raw per-AB strikeout probability vs this pitcher — Top Plays "Top Batter Strikeouts"
  status?: string; // lineup_status (hitters) or pitcher_status (pitchers)
};

/** K/H/N matchup sphere (shared with the player pages). */
export function MatchupSphere({ lean, prob, size }: { lean: string; prob: number; size?: number }) {
  const cls = lean === "K" ? "k" : lean === "H" ? "h" : "neu";
  const letter = lean === "H" ? "C" : lean; // hit shown as C (contact) across the board
  const tip =
    lean === "K"
      ? "Strikeout chance for one at-bat vs this pitcher (matchup + handedness, history-nudged ±10%). Not the pitcher's strikeout prop."
      : lean === "H"
      ? "Hit chance for one at-bat vs this pitcher (matchup + handedness, history-nudged ±10%). Not the same as a '1+ hit' game prop."
      : "No strong strikeout or contact edge in this matchup";
  return (
    <span
      className={`msphere ${cls}`}
      title={tip}
      style={size ? { width: size, height: size } : undefined}
    >
      {lean === "NEU" ? (
        <span className="mp">N</span>
      ) : (
        <>
          <span className="mp">{Math.round(prob * 100)}%</span>
          <span className="ml">{letter}</span>
        </>
      )}
    </span>
  );
}

function WeatherChips({ r }: { r: BoardRow }) {
  // Prefer a true directional arrow; fall back to simple out/in if only windOut is known.
  const dir = typeof r.windDir === "number" ? r.windDir : r.windOut !== undefined ? (r.windOut >= 0 ? 0 : 180) : undefined;
  const mph = typeof r.windMph === "number" ? r.windMph : typeof r.windOut === "number" ? Math.abs(r.windOut) : undefined;
  const hasWind = typeof dir === "number" && typeof mph === "number";
  const hasTemp = typeof r.tempF === "number";
  const showRain = (r.precipPct ?? 0) >= 20;
  if (!hasWind && !hasTemp && !showRain) return null;

  const windColor = hasWind ? arrowColor(dir as number) : "var(--amber)";

  return (
    <div className="mt-1.5 flex items-center gap-3" style={{ fontSize: "0.74rem", color: "var(--muted)" }}>
      {hasWind && (
        <span className="inline-flex items-center gap-1" title="wind direction relative to the field (up = out to center)">
          <WindIcon deg={dir as number} size={13} style={{ color: windColor }} />
          {Math.round(mph as number)}<span style={{ opacity: 0.6 }}>mph</span>
        </span>
      )}
      {hasTemp && <span className="inline-flex items-center gap-1"><TempIcon size={13} /> {Math.round(r.tempF as number)}°</span>}
      {showRain && <span className="inline-flex items-center gap-1" style={{ color: "#7cc7ff" }}><RainIcon size={13} /> {r.precipPct}%</span>}
    </div>
  );
}

// one size for every sphere column in the hub breakdown (headers + future stats too)
export const HUB_SPHERE = 46;
export const HUB_SLOT = 52;

// smaller spheres for the 4-column "Columns" layout
const COL_SPHERE = 34;
const COL_SLOT = 40;

// platoon-advantage highlight — cyan (distinct from the green CONF status chip)
export const ADV_CHIP = {
  color: "#34dfe8",
  borderColor: "rgba(52, 223, 232, 0.55)",
  background: "rgba(52, 223, 232, 0.12)",
  boxShadow: "0 0 8px rgba(52, 223, 232, 0.45)",
};

export function HeatSphere({ prob, kind, size }: { prob: number; kind: PropKind; size?: number }) {
  const c = heatColor(prob, kind);
  return (
    <span
      className="sphere"
      title="model probability"
      style={{
        ...(size ? { width: size, height: size } : {}),
        background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,0.12), ${c} 60%, rgba(8,14,10,0.65))`,
        borderColor: c,
        color: "#eef3f0",
        textShadow: "0 1px 2px rgba(0,0,0,0.6)",
      }}
    >
      {pct(prob)}
    </span>
  );
}

export function PropBoard({ rows, mode, kind }: { rows: BoardRow[]; mode: ViewMode; kind: PropKind }) {
  if (rows.length === 0) {
    return (
      <div className="panel rise" style={{ textAlign: "center", color: "var(--muted)" }}>
        No plays on the board yet — lineups may not be posted.
      </div>
    );
  }

  const Card = (r: BoardRow, i: number) => (
    <Link
      href={r.href}
      key={r.id}
      className={`card rise s-${strengthTier(r.prob, kind)}`}
      style={{ animationDelay: `${i * 45}ms` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="display" style={{ fontWeight: 700, fontSize: "1.02rem" }}>
          {r.player}
        </span>
        <span className="stat glow" style={{ fontSize: "1.35rem" }}>
          {pct(r.prob)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
        <span className={`badge ${strengthTier(r.prob, kind)}`}>{strengthLabel(r.prob, kind)}</span>
        <span>{r.detail}</span>
        {r.time && <span className="inline-flex items-center gap-1" style={{ opacity: 0.75 }}><ClockIcon size={12} /> {r.time}</span>}
        <StatusChip status={r.status} />
      </div>
      {(r.playerHand || r.opponent || r.matchup) && (
        <div className="mt-1 flex flex-wrap items-center gap-2" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          {r.playerHand && (() => {
            const adv = platoonAdvantage(r.playerHand, r.opponent?.hand);
            return (
              <span
                className="hand"
                title={adv ? "platoon advantage vs this pitcher" : undefined}
                style={adv ? ADV_CHIP : undefined}
              >
                {r.playerHand}
              </span>
            );
          })()}
          {r.matchup && (
            <span style={{ fontWeight: 600, color: "var(--text)", opacity: 0.8 }} title="game">
              {r.matchup}
            </span>
          )}
          {r.opponent && (
            <span className="inline-flex items-center gap-1.5">
              vs {r.opponent.name}
              {r.opponent.hand && <span className="hand">{r.opponent.hand}</span>}
            </span>
          )}
          {r.bvp && r.bvp.pa > 0 && (
            <span className="hand" title="career history vs this pitcher">
              {r.bvp.hits}-{r.bvp.ab}{r.bvp.hr > 0 ? ` · ${r.bvp.hr} HR` : ""}
            </span>
          )}
        </div>
      )}
      <WeatherChips r={r} />
    </Link>
  );

  const Table = () => (
    <table className="board">
      <thead>
        <tr>
          <th style={{ whiteSpace: "nowrap" }}>Player</th>
          <th style={{ whiteSpace: "nowrap", paddingLeft: 0 }}>Team</th>
          <th style={{ width: "100%" }}>Opponent</th>
          <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Time</th>
          {kind === "k" && (
            <th style={{ textAlign: "center" }} title="not a sportsbook line — the model sets it from his typical start">
              Model Book Line
            </th>
          )}
          {kind === "k" && <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Proj Ks</th>}
          <th style={{ textAlign: "right" }}>
            Probability
            {kind === "k" && (
              <div style={{ fontWeight: 400, opacity: 0.55, fontSize: "0.5rem", letterSpacing: "0.02em", marginTop: 1 }}>
                (over Model Book Line)
              </div>
            )}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td style={{ whiteSpace: "nowrap" }}>
              <Link href={r.href} className="linklike">{r.player}</Link>
              {r.playerHand && (() => {
                const adv = platoonAdvantage(r.playerHand, r.opponent?.hand);
                return (
                  <span
                    className="hand"
                    title={adv ? "platoon advantage vs this pitcher" : undefined}
                    style={{ marginLeft: 6, ...(adv ? ADV_CHIP : {}) }}
                  >
                    {r.playerHand}
                  </span>
                );
              })()}
              {r.status && (
                <span style={{ marginLeft: 6 }}>
                  <StatusChip status={r.status} />
                </span>
              )}
            </td>
            <td style={{ color: "var(--muted)", whiteSpace: "nowrap", paddingLeft: 0 }}>{r.team}</td>
            <td style={{ color: "var(--muted)" }}>
              {kind === "k" ? (
                r.opponent && <span>vs {r.opponent.name}</span>
              ) : (
                <>
                  <span>{r.detail}</span>
                  {r.opponent && (
                    <>
                      <span style={{ opacity: 0.45 }}> · </span>
                      {r.opponent.name}
                      {r.opponent.hand && <span className="hand" style={{ marginLeft: 6 }}>{r.opponent.hand}</span>}
                    </>
                  )}
                </>
              )}
            </td>
            <td className="num" style={{ textAlign: "center", whiteSpace: "nowrap", color: "var(--muted)" }}>{r.time}</td>
            {kind === "k" && (
              <td className="num" style={{ textAlign: "center", whiteSpace: "nowrap" }}>{r.line}</td>
            )}
            {kind === "k" && (
              <td className="num" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{r.projection}</td>
            )}
            <td style={{ textAlign: "right" }}>
              <HeatSphere prob={r.prob} kind={kind} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const Row = (r: BoardRow) => <BoardRowLine key={r.id} r={r} kind={kind} />;

  const List = () => {
    // Group rows by GAME (rows within a game keep high->low probability order),
    // then order the games by first pitch. Keyed by game id so a doubleheader
    // splits into two groups even though both share one matchup name.
    const groups: { key: string; label: string; rows: BoardRow[] }[] = [];
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

    const Head = (g: { key: string; label: string; rows: BoardRow[] }) => (
      <>
        {g.rows[0].time && (
          <span className="num" style={{ float: "right", color: "var(--muted)", fontWeight: 400, fontSize: "0.78rem" }}>
            🕐 {g.rows[0].time}
          </span>
        )}
        {g.label}
      </>
    );

    if (kind === "k") {
      // two pitchers per game — flat list stays readable
      return (
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.6rem" }}>Matchups · first pitch order</div>
          {groups.map((g) => (
            <div key={g.key} className="rise" style={{ marginBottom: "1.1rem" }}>
              <div className="matchup-head">{Head(g)}</div>
              {g.rows.map(Row)}
            </div>
          ))}
        </div>
      );
    }
    // HR side: ~18 hitters per game — collapse each game behind a dropdown
    return (
      <div>
        <div className="eyebrow" style={{ marginBottom: "0.6rem" }}>Matchups · first pitch order</div>
        {groups.map((g) => {
          // game-level lineup status for the collapsed row: confirmed only when
          // nothing is still projected; per-side detail lives in the Game Hub.
          const groupStatus = g.rows.some((r) => r.status && r.status !== "confirmed")
            ? "projected"
            : g.rows.some((r) => r.status)
            ? "confirmed"
            : undefined;
          return (
            <details key={g.key} className="rise" style={{ marginBottom: "0.55rem" }}>
              <summary className="matchup-head" style={{ cursor: "pointer" }}>
                {Head(g)}
                {groupStatus && (
                  <span style={{ marginLeft: "0.6rem" }}>
                    <StatusChip status={groupStatus} mode="pair" />
                  </span>
                )}
                <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "0.78rem", marginLeft: "0.7rem" }}>
                  {g.rows.length} hitters
                </span>
              </summary>
              <TeamSplit matchup={g.label} rows={g.rows} kind={kind} />
            </details>
          );
        })}
      </div>
    );
  };

  if (mode === "table") return <Table />;
  if (mode === "list") return <List />;
  if (mode === "cards") return <div className="grid gap-2.5 sm:grid-cols-2">{rows.map(Card)}</div>;

  // hybrid: top 3 as glowing cards, the rest in a table
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow" style={{ marginBottom: "0.6rem" }}>★ Top plays</div>
        <div className="grid gap-2.5 sm:grid-cols-3">{top.map(Card)}</div>
      </div>
      {rest.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.4rem" }}>Full board</div>
          <Table />
        </div>
      )}
    </div>
  );
}


/** One player line: name + (advantage-lit) hand chip + probability sphere. */
export function BoardRowLine({ r, kind, withLean = false }: { r: BoardRow; kind: PropKind; withLean?: boolean }) {
  const advantage = platoonAdvantage(r.playerHand, r.opponent?.hand);
  return (
    <Link
      href={r.href}
      className="rowlink"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.6rem 0.25rem",
        borderBottom: "1px solid var(--line)",
        color: "var(--text)",
        textDecoration: "none",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, flexWrap: "wrap" }}>
        <span className="rl-name">{r.player}</span>
        {r.playerHand && (
          <span
            className="hand"
            title={advantage ? "platoon advantage vs this pitcher" : undefined}
            style={advantage ? ADV_CHIP : undefined}
          >
            {r.playerHand}
          </span>
        )}
      </span>
      {withLean ? (
        <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <span style={{ width: HUB_SLOT, display: "flex", justifyContent: "center" }}>
            {r.lean ? <MatchupSphere lean={r.lean.lean} prob={r.lean.prob} size={HUB_SPHERE} /> : null}
          </span>
          <span style={{ width: HUB_SLOT, display: "flex", justifyContent: "center" }}>
            <HeatSphere prob={r.prob} kind={kind} size={HUB_SPHERE} />
          </span>
        </span>
      ) : (
        <HeatSphere prob={r.prob} kind={kind} />
      )}
    </Link>
  );
}

/** Hitters split away|home (matching the AWAY @ HOME title), lit pitcher per side. */
/** Column headers sitting on a line with small upward ticks, over the sphere columns. */
function SphereHeaders() {
  const cell = (label: React.ReactNode, key: string) => (
    <div key={key} style={{ width: HUB_SLOT, textAlign: "center" }}>
      <div style={{ fontSize: "0.6rem", letterSpacing: "0.08em", fontWeight: 700, color: "var(--muted)" }}>{label}</div>
      <div style={{ width: 1, height: 5, background: "var(--line-strong)", margin: "2px auto 0" }} />
    </div>
  );
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem", borderBottom: "1px solid var(--line-strong)" }}>
      {cell(
        <>
          <span style={{ color: "#ffd9d6" }}>K</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: "#bff3d2" }}>C</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: "#c5d6e8" }}>N</span>
        </>,
        "knh"
      )}
      {cell("HR", "hr")}
    </div>
  );
}

export function TeamSplit({ matchup, rows, kind, withLean = false }: { matchup: string; rows: BoardRow[]; kind: PropKind; withLean?: boolean }) {
  const [away, home] = matchup.split(" @ ");
  const awayRows = rows.filter((r) => r.team === away);
  const homeRows = rows.filter((r) => r.team === home);
  const split = home !== undefined && awayRows.length + homeRows.length === rows.length;
  if (!split) return <>{rows.map((r) => <BoardRowLine key={r.id} r={r} kind={kind} withLean={withLean} />)}</>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      {[
        { label: `${away} · away`, rs: awayRows, style: { borderRight: "1px solid var(--line-strong)", paddingRight: "0.8rem" } as const },
        { label: `${home} · home`, rs: homeRows, style: { paddingLeft: "0.8rem" } as const },
      ].map(({ label, rs, style }) => {
        const opp = rs.find((r) => r.opponent)?.opponent;
        return (
          <div key={label} style={style}>
            <div className="eyebrow" style={{ margin: "0.5rem 0 0.2rem", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
              <span style={{ flexShrink: 0 }}>{label}</span>
              {opp && (
                <span style={{ letterSpacing: "normal", textTransform: "none", fontSize: "0.82rem" }}>
                  vs{" "}
                  <span style={{ color: "var(--text)", textShadow: "0 0 8px rgba(62, 224, 127, 0.45)" }}>{opp.name}</span>
                  {opp.hand && <> <span className="hand">{opp.hand}</span></>}
                </span>
              )}
            </div>
            {withLean && (
              <div style={{ margin: "0 0 0.35rem" }}>
                <StatusChip status={rs.find((r) => r.status)?.status} mode="pair" />
              </div>
            )}
            {withLean && <SphereHeaders />}
            {rs.map((r) => <BoardRowLine key={r.id} r={r} kind={kind} withLean={withLean} />)}
          </div>
        );
      })}
    </div>
  );
}

// Shared grid track for the Columns layout: a flexible name column + 7 fixed
// sphere columns. Header and every batter row use this SAME template + gap +
// horizontal padding, so the columns line up exactly regardless of name length.
const COL_GRID = `minmax(0, 1fr) repeat(7, ${COL_SLOT}px)`;
const COL_GAP = "0.3rem";
const COL_PAD = "0 0.25rem";

type SortCol = "lean" | "hr" | "hits" | "tb" | "runs" | "rbi" | "hrr";
type SortState = { col: SortCol; dir: 1 | -1 };

/** Column headers for the 7-column layout: K/C/N · HR · Hits · TB · Runs · RBI · HRR. Click to sort. */
function ColHeaders({ hitsKind, tbKind, runsKind, rbiKind, hrrKind, sort, onSort }: { hitsKind: PropKind; tbKind: PropKind; runsKind: PropKind; rbiKind: PropKind; hrrKind: PropKind; sort: SortState; onSort: (col: SortCol) => void }) {
  const hitsLabel = hitsKind === "hits1" ? "1H+" : hitsKind === "hits2" ? "2H+" : "3H+";
  const tbLabel = tbKind === "tb2" ? "2TB+" : tbKind === "tb3" ? "3TB+" : "4TB+";
  const runsLabel = runsKind === "runs1" ? "1R+" : "2R+";
  const rbiLabel = rbiKind === "rbi1" ? "1RBI+" : "2RBI+";
  const hrrLabel = hrrKind === "hrr2" ? "2HRR+" : hrrKind === "hrr3" ? "3HRR+" : "4HRR+";
  const arrow = (col: SortCol) => (sort.col === col ? (sort.dir < 0 ? " ▾" : " ▴") : "");
  const cell = (label: React.ReactNode, col: SortCol) => (
    <button
      key={col}
      type="button"
      onClick={() => onSort(col)}
      title="sort by this column"
      style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "center", font: "inherit" }}
    >
      <div style={{ fontSize: "0.55rem", letterSpacing: "0.07em", fontWeight: 700, color: sort.col === col ? "var(--text)" : "var(--muted)" }}>
        {label}<span style={{ color: "var(--green)" }}>{arrow(col)}</span>
      </div>
      <div style={{ width: 1, height: 4, background: "var(--line-strong)", margin: "2px auto 0" }} />
    </button>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: COL_GRID, gap: COL_GAP, padding: COL_PAD, alignItems: "end", borderBottom: "1px solid var(--line-strong)" }}>
      <div />
      {cell(
        <>
          <span style={{ color: "#ffd9d6" }}>K</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: "#bff3d2" }}>C</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={{ color: "#c5d6e8" }}>N</span>
        </>,
        "lean"
      )}
      {cell("HR", "hr")}
      {cell(hitsLabel, "hits")}
      {cell(tbLabel, "tb")}
      {cell(runsLabel, "runs")}
      {cell(rbiLabel, "rbi")}
      {cell(hrrLabel, "hrr")}
    </div>
  );
}

/** One batter row in the Columns layout: name + hand chip + 7 spheres (K/C/N, HR, Hits, TB, Runs, RBI, HRR). */
function ColBatterRow({
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
}: {
  hrRow: BoardRow;
  hitsRow: BoardRow | undefined;
  tbRow: BoardRow | undefined;
  runsRow: BoardRow | undefined;
  rbiRow: BoardRow | undefined;
  hrrRow: BoardRow | undefined;
  hitsKind: PropKind;
  tbKind: PropKind;
  runsKind: PropKind;
  rbiKind: PropKind;
  hrrKind: PropKind;
}) {
  const adv = platoonAdvantage(hrRow.playerHand, hrRow.opponent?.hand);
  // the matchup read can sit on any of the prop rows — use whichever has it so
  // the K/C/N sphere never goes missing when one prop's row lacks `lean`.
  const lean = hrRow.lean ?? hitsRow?.lean ?? tbRow?.lean ?? null;
  // K/C/N column (idea C): a clear lean shows the dominant side's sphere with the
  // other side's % faint underneath. A NEUTRAL matchup just writes BOTH K and C.
  const kp = hrRow.kProb ?? hitsRow?.kProb ?? tbRow?.kProb;
  const hp = hrRow.hitProb ?? hitsRow?.hitProb ?? tbRow?.hitProb;
  const isNeutral = lean ? lean.lean === "NEU" : (typeof kp === "number" && typeof hp === "number" && Math.abs(kp - hp) < 0.04);
  let leanCell: React.ReactNode = lean ? <MatchupSphere lean={lean.lean} prob={lean.prob} size={COL_SPHERE} /> : null;
  if (typeof kp === "number" && typeof hp === "number") {
    if (isNeutral) {
      // N sphere back, with BOTH K and C written on one line underneath it
      leanCell = (
        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <MatchupSphere lean="NEU" prob={0} size={COL_SPHERE} />
          <span style={{ display: "flex", gap: "0.25rem", fontFamily: "var(--font-mono)", fontSize: "0.46rem", fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap" }}>
            <span style={{ color: "#ffd9d6" }}>K{pct(kp)}</span>
            <span style={{ color: "#bff3d2" }}>C{pct(hp)}</span>
          </span>
        </span>
      );
    } else {
      const kDom = kp >= hp;
      leanCell = (
        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <MatchupSphere lean={kDom ? "K" : "H"} prob={kDom ? kp : hp} size={COL_SPHERE} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.5rem", fontWeight: 700, color: kDom ? "#bff3d2" : "#ffd9d6", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
            {kDom ? "C" : "K"} {pct(kDom ? hp : kp)}
          </span>
        </span>
      );
    }
  }
  const sphereCell = (node: React.ReactNode, key: string) => (
    <span key={key} style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>{node}</span>
  );
  return (
    <Link
      href={hrRow.href}
      className="rowlink"
      style={{
        display: "grid",
        gridTemplateColumns: COL_GRID,
        gap: COL_GAP,
        alignItems: "center",
        padding: "0.5rem 0.25rem",
        borderBottom: "1px solid var(--line)",
        color: "var(--text)",
        textDecoration: "none",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, flexWrap: "wrap", minWidth: 0 }}>
        <span className="rl-name">{hrRow.player}</span>
        {hrRow.playerHand && (
          <span
            className="hand"
            title={adv ? "platoon advantage vs this pitcher" : undefined}
            style={adv ? ADV_CHIP : undefined}
          >
            {hrRow.playerHand}
          </span>
        )}
        {hrRow.status && <StatusChip status={hrRow.status} />}
      </span>
      {sphereCell(leanCell, "kcn")}
      {sphereCell(<HeatSphere prob={hrRow.prob} kind="hr" size={COL_SPHERE} />, "hr")}
      {sphereCell(hitsRow ? <HeatSphere prob={hitsRow.prob} kind={hitsKind} size={COL_SPHERE} /> : null, "hits")}
      {sphereCell(tbRow ? <HeatSphere prob={tbRow.prob} kind={tbKind} size={COL_SPHERE} /> : null, "tb")}
      {sphereCell(runsRow ? <HeatSphere prob={runsRow.prob} kind={runsKind} size={COL_SPHERE} /> : null, "runs")}
      {sphereCell(rbiRow ? <HeatSphere prob={rbiRow.prob} kind={rbiKind} size={COL_SPHERE} /> : null, "rbi")}
      {sphereCell(hrrRow ? <HeatSphere prob={hrrRow.prob} kind={hrrKind} size={COL_SPHERE} /> : null, "hrr")}
    </Link>
  );
}

/** One team's sortable column table inside the Game Hub breakdown. Each team holds
    its own sort state, so away and home sort independently. */
function ColTeam({ team, side, rs, hitsByPlayer, tbByPlayer, runsByPlayer, rbiByPlayer, hrrByPlayer, hitsKind, tbKind, runsKind, rbiKind, hrrKind }: {
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
}) {
  const [sort, setSort] = useState<SortState>({ col: "hr", dir: -1 });
  const onSort = (col: SortCol) => setSort((s) => (s.col === col ? { col, dir: s.dir === -1 ? 1 : -1 } : { col, dir: -1 }));
  const metric = (r: BoardRow) => {
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
        <div
          className="eyebrow"
          style={{ margin: "0.6rem 0 0.15rem", padding: "0 0.25rem", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}
        >
          <span style={{ flexShrink: 0 }}>{team} · {side}</span>
          {opp && (
            <span style={{ letterSpacing: "normal", textTransform: "none", fontSize: "0.82rem" }}>
              vs{" "}
              <span style={{ color: "var(--text)", textShadow: "0 0 8px rgba(62, 224, 127, 0.45)" }}>{opp.name}</span>
              {opp.hand && <> <span className="hand">{opp.hand}</span></>}
            </span>
          )}
        </div>
      )}
      {/* headers repeat per team and are click-to-sort (high<->low) */}
      <ColHeaders hitsKind={hitsKind} tbKind={tbKind} runsKind={runsKind} rbiKind={rbiKind} hrrKind={hrrKind} sort={sort} onSort={onSort} />
      {sorted.map((r) => (
        <ColBatterRow
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
        />
      ))}
    </div>
  );
}

/** Columns layout: one row per batter with 7 sphere columns (K/C/N, HR, Hits, TB, Runs, RBI, HRR). */
function ColSplit({
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
}: {
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
}) {
  const [away, home] = matchup.split(" @ ");
  const hitsByPlayer = new Map(hitsRows.map((r) => [r.player, r]));
  const tbByPlayer = new Map(tbRows.map((r) => [r.player, r]));
  const runsByPlayer = new Map(runsRows.map((r) => [r.player, r]));
  const rbiByPlayer = new Map(rbiRows.map((r) => [r.player, r]));
  const hrrByPlayer = new Map(hrrRows.map((r) => [r.player, r]));

  const awayHr = hrRows.filter((r) => r.team === away);
  const homeHr = hrRows.filter((r) => r.team === home);
  const split = home !== undefined && awayHr.length + homeHr.length === hrRows.length;
  // ONE full-width list (not two narrow side-by-side columns) so the name has
  // room and all 7 sphere columns fit + stay aligned. Away/home shown as
  // labeled divider rows instead of side-by-side columns.
  const sections = split
    ? [{ team: away, side: "away", rs: awayHr }, { team: home, side: "home", rs: homeHr }]
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
        />
      ))}
    </div>
  );
}

/** Full game drilldown: both starting pitchers, then the hitters split by side. */
export function GameBreakdown({
  matchup,
  gameId,
  hrRows,
  kRows,
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
}: {
  matchup: string;
  gameId?: string; // when set, filter by this exact game so doubleheaders don't merge
  hrRows: BoardRow[];
  kRows: BoardRow[];
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
}) {
  // Match by game id when we have it (doubleheaders share a matchup name but not
  // a game id); fall back to the name only for older data without ids.
  const inGame = (r: BoardRow) => (gameId != null ? r.gameId === gameId : r.matchup === matchup);
  const hr = hrRows.filter(inGame);
  const ks = kRows.filter(inGame);
  const hits = hitsRows.filter(inGame);
  const tb = tbRows.filter(inGame);
  const runs = runsRows.filter(inGame);
  const rbi = rbiRows.filter(inGame);
  const hrr = hrrRows.filter(inGame);
  if (hr.length === 0 && ks.length === 0 && hits.length === 0 && tb.length === 0 && runs.length === 0 && rbi.length === 0 && hrr.length === 0) {
    return <p className="factor-note" style={{ marginBottom: 0 }}>No player projections yet — lineups may not be posted.</p>;
  }
  return (
    <div style={{ marginTop: "0.4rem" }}>
      {ks.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: "0.4rem 0 0.1rem" }}>Starting pitchers · over Model Book Line</div>
          {ks.map((r) => (
            <Link
              key={r.id}
              href={r.href}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "0.6rem 0.25rem", borderBottom: "1px solid var(--line)",
                color: "var(--text)", textDecoration: "none",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, flexWrap: "wrap" }}>
                {r.player}
                {r.playerHand && <span className="hand">{r.playerHand}</span>}
                <StatusChip status={r.status} />
                <span className="num" style={{ color: "var(--muted)", fontWeight: 400, fontSize: "0.78rem" }}>
                  line {r.line} · proj {r.projection}
                </span>
              </span>
              <HeatSphere prob={r.prob} kind="k" />
            </Link>
          ))}
        </>
      )}
      {hr.length > 0 && (
        <>
          <div className="eyebrow" style={{ margin: "0.7rem 0 0.1rem" }}>Batter breakdown</div>
          {/* overflowX allows the 7-column grid to scroll on narrow screens */}
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: `calc(9rem + 7 * ${COL_SLOT}px + 7 * 0.3rem)` }}>
              <ColSplit
                matchup={matchup}
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
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
