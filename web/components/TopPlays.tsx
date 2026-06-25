"use client";

import { useState } from "react";
import type React from "react";
import Link from "next/link";
import { HeatSphere, MatchupSphere, ADV_CHIP, type BoardRow } from "./PropBoard";
import { platoonAdvantage, type PropKind } from "../lib/format";
import { ClockIcon } from "./Icons";

const COUNTS = [10, 25, 50, "All"] as const;
type Count = (typeof COUNTS)[number];

const rowlinkStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.6rem 0.25rem",
  borderBottom: "1px solid var(--line)",
  color: "var(--text)",
  textDecoration: "none",
} as const;

/** A Top-Plays row: name + hand + (opposing pitcher) + game matchup + start time + a sphere on the right.
    showPitcher=false for the pitcher's own K prop (a pitcher doesn't face one pitcher). */
function TopPlayRow({ r, sphere, showPitcher = true }: { r: BoardRow; sphere: React.ReactNode; showPitcher?: boolean }) {
  const adv = platoonAdvantage(r.playerHand, r.opponent?.hand);
  return (
    <Link href={r.href} className="rowlink" style={rowlinkStyle}>
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, flexWrap: "wrap", minWidth: 0 }}>
        <span className="rl-name">{r.player}</span>
        {r.playerHand && (
          <span className="hand" style={adv ? ADV_CHIP : undefined} title={adv ? "platoon advantage vs this pitcher" : undefined}>
            {r.playerHand}
          </span>
        )}
        <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "0.76rem", display: "inline-flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
          {showPitcher && r.opponent && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              vs {r.opponent.name}
              {r.opponent.hand && <span className="hand">{r.opponent.hand}</span>}
            </span>
          )}
          {r.matchup && <span style={{ opacity: 0.85 }}>{r.matchup}</span>}
          {r.time && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", opacity: 0.8 }}>
              <ClockIcon size={11} /> {r.time}
            </span>
          )}
        </span>
      </span>
      {sphere}
    </Link>
  );
}

/** A collapsible category leaderboard — click the name to drop down its players. */
function LeaderSection({
  title,
  sub,
  tip,
  rows,
  count,
  render,
  controls,
}: {
  title: string;
  sub: string;
  tip?: string;
  rows: BoardRow[];
  count: Count;
  render: (r: BoardRow) => React.ReactNode;
  controls?: React.ReactNode;
}) {
  const shown = count === "All" ? rows : rows.slice(0, count as number);
  return (
    <details className="rise" style={{ marginBottom: "0.55rem" }}>
      <summary
        className="matchup-head"
        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}
        title={tip}
      >
        <span>
          {title}
          <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "0.78rem", marginLeft: "0.6rem" }}>
            · {sub}
            {rows.length > 0 ? ` · ${rows.length}` : ""}
          </span>
        </span>
        {controls}
      </summary>
      {rows.length === 0 ? (
        <p className="factor-note" style={{ margin: "0.4rem 0 0" }}>Nothing to show yet — lineups may not be posted.</p>
      ) : (
        <div style={{ marginTop: "0.2rem" }}>{shown.map(render)}</div>
      )}
    </details>
  );
}

/** A leaderboard tab: best plays grouped into collapsible categories. Pure display. */
export function TopPlays({ hrRows, kRows, hitsRows, tbRows, runsRows, rbiRows, hrrRows, hitsKind, tbKind, runsKind, rbiKind, hrrKind, threshold, setThreshold }: {
  hrRows: BoardRow[];
  kRows: BoardRow[];
  hitsRows: BoardRow[];
  tbRows: BoardRow[];
  runsRows: BoardRow[];
  rbiRows: BoardRow[];
  hrrRows: BoardRow[];
  hitsKind: PropKind;
  tbKind: PropKind;
  runsKind: PropKind;
  rbiKind: PropKind;
  hrrKind: PropKind;
  threshold: { hits: 1 | 2 | 3; tb: 2 | 3 | 4; runs: 1 | 2; rbi: 1 | 2; hrr: 2 | 3 | 4 };
  setThreshold: React.Dispatch<React.SetStateAction<{ hits: 1 | 2 | 3; tb: 2 | 3 | 4; runs: 1 | 2; rbi: 1 | 2; hrr: 2 | 3 | 4 }>>;
}) {
  const [count, setCount] = useState<Count>(10);
  const topContact = hrRows
    .filter((r) => typeof r.hitProb === "number")
    .slice()
    .sort((a, b) => (b.hitProb ?? 0) - (a.hitProb ?? 0));
  const topBatterK = hrRows
    .filter((r) => typeof r.kProb === "number")
    .slice()
    .sort((a, b) => (b.kProb ?? 0) - (a.kProb ?? 0));
  // active thresholds, parsed from the prop kind (e.g. "hits2" -> 2, "tb3" -> 3)
  const hitsThresh = hitsKind.replace("hits", "");
  const tbThresh = tbKind.replace("tb", "");
  const runsThresh = runsKind.replace("runs", "");
  const rbiThresh = rbiKind.replace("rbi", "");
  const hrrThresh = hrrKind.replace("hrr", "");

  return (
    <div>
      <div className="flex items-center justify-center gap-2.5 rise" style={{ marginBottom: "1rem" }}>
        <span className="eyebrow">Show</span>
        <div className="pillbar">
          {COUNTS.map((c) => (
            <button key={String(c)} onClick={() => setCount(c)} data-active={count === c} className="pill">
              {c}
            </button>
          ))}
        </div>
      </div>

      <LeaderSection
        title="Top Home Runs"
        sub="chance at 1+ HR this game"
        tip="The batter's chance to hit at least one home run in this game."
        rows={hrRows}
        count={count}
        render={(r) => <TopPlayRow key={r.id} r={r} sphere={<HeatSphere prob={r.prob} kind="hr" />} />}
      />
      <LeaderSection
        title="Top Pitcher Strikeouts"
        sub="chance to clear the model K line"
        tip="The starting pitcher's chance to finish above the model's strikeout line for the game."
        rows={kRows}
        count={count}
        render={(r) => <TopPlayRow key={r.id} r={r} showPitcher={false} sphere={<HeatSphere prob={r.prob} kind="k" />} />}
      />
      <LeaderSection
        title="Top Contact"
        sub="per at-bat hit rate vs the pitcher"
        tip="The model's hit chance for a single at-bat vs this pitcher (matchup + handedness, history-nudged). NOT the upcoming '1+ hit' game prop."
        rows={topContact}
        count={count}
        render={(r) => <TopPlayRow key={r.id} r={r} sphere={<MatchupSphere lean="H" prob={r.hitProb ?? 0} />} />}
      />
      <LeaderSection
        title="Top Batter Strikeouts"
        sub="per at-bat strikeout rate vs the pitcher"
        tip="The model's strikeout chance for a single at-bat vs this pitcher — the hitters most likely to strike out. Separate from the pitcher's strikeout prop above."
        rows={topBatterK}
        count={count}
        render={(r) => <TopPlayRow key={r.id} r={r} sphere={<MatchupSphere lean="K" prob={r.kProb ?? 0} />} />}
      />
      <LeaderSection
        title="Top Hits"
        sub={`chance to reach ${hitsThresh}+ hits`}
        tip="Batters most likely to reach the selected hits threshold (1+, 2+, or 3+). Ranked by the threshold probability shown on the board."
        rows={hitsRows}
        count={count}
        render={(r) => <TopPlayRow key={r.id} r={r} sphere={<HeatSphere prob={r.prob} kind={hitsKind} />} />}
        controls={
          <div className="pillbar" onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                className="pill"
                data-active={threshold.hits === n}
                style={{ padding: "0.16rem 0.45rem", fontSize: "0.62rem" }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setThreshold((t) => ({ ...t, hits: n }));
                }}
              >
                {n}+
              </button>
            ))}
          </div>
        }
      />
      <LeaderSection
        title="Top Total Bases"
        sub={`chance to reach ${tbThresh}+ total bases`}
        tip="Batters most likely to reach the selected total bases threshold (2+, 3+, or 4+). Ranked by the threshold probability shown on the board."
        rows={tbRows}
        count={count}
        render={(r) => <TopPlayRow key={r.id} r={r} sphere={<HeatSphere prob={r.prob} kind={tbKind} />} />}
        controls={
          <div className="pillbar" onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                className="pill"
                data-active={threshold.tb === n}
                style={{ padding: "0.16rem 0.45rem", fontSize: "0.62rem" }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setThreshold((t) => ({ ...t, tb: n }));
                }}
              >
                {n}+
              </button>
            ))}
          </div>
        }
      />
      <LeaderSection
        title="Top Runs"
        sub={`chance to score ${runsThresh}+ runs`}
        tip="Batters most likely to score the selected number of runs."
        rows={runsRows}
        count={count}
        render={(r) => <TopPlayRow key={r.id} r={r} sphere={<HeatSphere prob={r.prob} kind={runsKind} />} />}
        controls={
          <div className="pillbar" onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
            {([1, 2] as const).map((n) => (
              <button
                key={n}
                className="pill"
                data-active={threshold.runs === n}
                style={{ padding: "0.16rem 0.45rem", fontSize: "0.62rem" }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setThreshold((t) => ({ ...t, runs: n }));
                }}
              >
                {n}+
              </button>
            ))}
          </div>
        }
      />
      <LeaderSection
        title="Top RBI"
        sub={`reach ${rbiThresh}+ RBI`}
        tip="Batters most likely to reach the selected RBI threshold."
        rows={rbiRows}
        count={count}
        render={(r) => <TopPlayRow key={r.id} r={r} sphere={<HeatSphere prob={r.prob} kind={rbiKind} />} />}
        controls={
          <div className="pillbar" onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
            {([1, 2] as const).map((n) => (
              <button
                key={n}
                className="pill"
                data-active={threshold.rbi === n}
                style={{ padding: "0.16rem 0.45rem", fontSize: "0.62rem" }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setThreshold((t) => ({ ...t, rbi: n }));
                }}
              >
                {n}+
              </button>
            ))}
          </div>
        }
      />
      <LeaderSection
        title="Top HRR"
        sub={`reach ${hrrThresh}+ hits+runs+RBI`}
        tip="Batters most likely to reach the selected hits+runs+RBI combined threshold."
        rows={hrrRows}
        count={count}
        render={(r) => <TopPlayRow key={r.id} r={r} sphere={<HeatSphere prob={r.prob} kind={hrrKind} />} />}
        controls={
          <div className="pillbar" onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
            {([2, 3, 4] as const).map((n) => (
              <button
                key={n}
                className="pill"
                data-active={threshold.hrr === n}
                style={{ padding: "0.16rem 0.45rem", fontSize: "0.62rem" }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setThreshold((t) => ({ ...t, hrr: n }));
                }}
              >
                {n}+
              </button>
            ))}
          </div>
        }
      />
    </div>
  );
}
