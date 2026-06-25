"use client";

import { useEffect, useState } from "react";
import { loadProjections, loadIndex } from "../lib/data";
import type { Projections, HitsRow, TbRow, RunsRow, RbiRow, HrrRow, Matchup } from "../lib/types";
import { ViewSwitcher, type ViewMode } from "../components/ViewSwitcher";
import { PropBoard, type BoardRow } from "../components/PropBoard";
import { TopPlays } from "../components/TopPlays";
import { gameTimeLabel } from "../lib/format";
import { ParksBoard } from "../components/ParksBoard";
import { PPHex } from "../components/Marks";
import { UserButton } from "@clerk/nextjs";

function batHand(b?: string) {
  return b === "L" ? "LHB" : b === "S" ? "SW" : b ? "RHB" : undefined;
}
function pitchHand(t?: string) {
  return t === "L" ? "LHP" : t ? "RHP" : undefined;
}
function oppTeam(matchup?: string, team?: string) {
  const parts = matchup?.split(" @ ");
  if (!parts || parts.length !== 2) return undefined;
  const [away, home] = parts;
  return team === home ? away : home;
}
// Standard notation: home batters read "vs AWAY", away batters read "@ HOME".
function gameLabel(matchup?: string, team?: string) {
  const parts = matchup?.split(" @ ");
  if (!parts || parts.length !== 2) return undefined;
  const [away, home] = parts;
  return team === home ? `vs ${away}` : `@ ${home}`;
}

// Top-level sections. "props" carries the HR/K (and future) prop boards with
// their own view switcher; the rest are standalone views.
type Section = "props" | "parks" | "hub" | "topplays";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "props", label: "Props" },
  { id: "parks", label: "Parks" },
  { id: "hub", label: "Game Hub" },
  { id: "topplays", label: "Top Plays" },
];

export default function Home() {
  const [data, setData] = useState<Projections | null>(null);
  const [section, setSection] = useState<Section>("props");
  const [view, setView] = useState<ViewMode>("hybrid");
  const [prop, setProp] = useState<"hr" | "k" | "hits" | "tb" | "runs" | "rbi" | "hrr">("hr");
  const [threshold, setThreshold] = useState<{ hits: 1 | 2 | 3; tb: 2 | 3 | 4; runs: 1 | 2; rbi: 1 | 2; hrr: 2 | 3 | 4 }>({ hits: 1, tb: 2, runs: 1, rbi: 1, hrr: 2 });
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [source, setSource] = useState<"current" | "blend" | "hist">("current");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const want = params.get("date");
    const propParam = params.get("prop");
    if (propParam === "k") setProp("k");
    else if (propParam === "hits") setProp("hits");
    else if (propParam === "tb") setProp("tb");
    else if (propParam === "runs") setProp("runs");
    else if (propParam === "rbi") setProp("rbi");
    else if (propParam === "hrr") setProp("hrr");
    // back-link from player pages: restore threshold
    const tp = params.get("threshold");
    if (propParam === "hits" && (tp === "1" || tp === "2" || tp === "3")) {
      setThreshold((t) => ({ ...t, hits: Number(tp) as 1 | 2 | 3 }));
    }
    if (propParam === "tb" && (tp === "2" || tp === "3" || tp === "4")) {
      setThreshold((t) => ({ ...t, tb: Number(tp) as 2 | 3 | 4 }));
    }
    if (propParam === "runs" && (tp === "1" || tp === "2")) setThreshold((t) => ({ ...t, runs: Number(tp) as 1 | 2 }));
    if (propParam === "rbi" && (tp === "1" || tp === "2")) setThreshold((t) => ({ ...t, rbi: Number(tp) as 1 | 2 }));
    if (propParam === "hrr" && (tp === "2" || tp === "3" || tp === "4")) setThreshold((t) => ({ ...t, hrr: Number(tp) as 2 | 3 | 4 }));
    // back-link from player pages
    const src = params.get("source");
    if (src === "hist") setSource("hist");
    else if (src === "blend") setSource("blend");
    loadIndex().then((ds) => {
      setDates(ds);
      setSelectedDate(want && ds.includes(want) ? want : ds[0] ?? "");
    });
  }, []);

  useEffect(() => {
    loadProjections(selectedDate || undefined).then(setData).catch(console.error);
  }, [selectedDate]);

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="eyebrow">
          <span className="live-dot" /> &nbsp;loading the board…
        </p>
      </main>
    );
  }

  const updatedAt = data.updated ? new Date(data.updated) : null;
  const updatedLabel = updatedAt
    ? (updatedAt.toDateString() === new Date().toDateString()
        ? updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
        : updatedAt.toLocaleDateString([], { month: "short", day: "numeric" }) +
          " " +
          updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" }))
    : null;

  // weighting: current = this season · hist = 3yr Marcel blend · blend = equal 50/50
  // average of the two (computed here from the numbers the board already ships).
  const srcParam = source === "current" ? "" : `source=${source}`;
  const pickN = (cur?: number, hist?: number): number =>
    source === "current" ? (cur as number)
    : source === "hist" ? (hist ?? (cur as number))
    : (typeof cur === "number" && typeof hist === "number" ? (cur + hist) / 2 : (cur as number));
  const leanFor = (vs: Matchup | undefined) => {
    if (!vs) return null;
    if (source === "current") return { lean: vs.lean, prob: vs.prob };
    if (source === "hist") return vs.lean_hist != null && vs.prob_hist != null ? { lean: vs.lean_hist, prob: vs.prob_hist } : { lean: vs.lean, prob: vs.prob };
    const kb = pickN(vs.k_prob, vs.k_prob_hist);
    const hb = pickN(vs.hit_prob, vs.hit_prob_hist);
    const lean = Math.abs(kb - hb) < 0.04 ? "NEU" : kb > hb ? "K" : "H";
    return { lean, prob: Math.max(kb, hb) };
  };

  const dateQ = `${selectedDate ? `?date=${selectedDate}` : ""}${srcParam ? `${selectedDate ? "&" : "?"}${srcParam}` : ""}`;

  const hrRows: BoardRow[] = data.hr.map((r) => ({
    id: `${r.player_id ?? r.player}-${r.game_id ?? ""}`,
    player: r.player,
    team: r.team,
    prob: pickN(r.probability, r.probability_hist),
    detail: gameLabel(r.matchup, r.team) ?? `@ ${r.park}`,
    href: `/player/hr/${r.player_id ?? encodeURIComponent(r.player)}${dateQ}`,
    time: gameTimeLabel(r.game_time),
    timeSort: r.game_time,
    matchup: r.matchup,
    gameId: r.game_id != null ? String(r.game_id) : undefined,
    hand: r.bats ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}` : undefined,
    playerHand: batHand(r.bats),
    opponent: r.vs ? { name: r.vs.name, hand: pitchHand(r.vs.throws) } : undefined,
    bvp: r.vs?.bvp,
    lean: leanFor(r.vs),
    hitProb: r.vs ? pickN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
    kProb: r.vs ? pickN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
    status: r.lineup_status,
    windOut: r.wind_out_mph,
    windMph: r.wind_mph,
    windDir: r.wind_dir,
    tempF: r.temp_f,
    precipPct: r.precip_pct,
  }));
  const kRows: BoardRow[] = data.strikeouts.map((r) => ({
    id: `${r.player_id ?? r.player}-${r.game_id ?? ""}`,
    player: r.player,
    team: r.team,
    prob: pickN(r.over_prob, r.over_prob_hist),
    detail: `line ${r.line.toFixed(1)}`,
    projection: pickN(r.expected_ks, r.expected_ks_hist).toFixed(1),
    line: r.line.toFixed(1),
    href: `/player/k/${r.player_id ?? encodeURIComponent(r.player)}${dateQ}`,
    time: gameTimeLabel(r.game_time),
    timeSort: r.game_time,
    matchup: r.matchup,
    gameId: r.game_id != null ? String(r.game_id) : undefined,
    hand: pitchHand(r.throws),
    playerHand: pitchHand(r.throws),
    opponent: oppTeam(r.matchup, r.team) ? { name: oppTeam(r.matchup, r.team)! } : undefined,
    status: r.pitcher_status,
    windOut: r.wind_out_mph,
    windMph: r.wind_mph,
    windDir: r.wind_dir,
    tempF: r.temp_f,
    precipPct: r.precip_pct,
  }));

  // Helper: pick p_geN source-aware (hist fallback to current)
  function hitsProb(r: HitsRow, n: 1 | 2 | 3): number {
    const base = n === 1 ? r.p_ge1 : n === 2 ? r.p_ge2 : r.p_ge3;
    const hist = n === 1 ? r.p_ge1_hist : n === 2 ? r.p_ge2_hist : r.p_ge3_hist;
    return pickN(base, hist);
  }
  function tbProb(r: TbRow, n: 2 | 3 | 4): number {
    const base = n === 2 ? r.p_ge2 : n === 3 ? r.p_ge3 : r.p_ge4;
    const hist = n === 2 ? r.p_ge2_hist : n === 3 ? r.p_ge3_hist : r.p_ge4_hist;
    return pickN(base, hist);
  }

  const hitsDateQ = `${selectedDate ? `?date=${selectedDate}&` : "?"}prop=hits&threshold=${threshold.hits}${srcParam ? `&${srcParam}` : ""}`;
  const tbDateQ = `${selectedDate ? `?date=${selectedDate}&` : "?"}prop=tb&threshold=${threshold.tb}${srcParam ? `&${srcParam}` : ""}`;

  function runsProb(r: RunsRow, n: 1 | 2): number {
    return pickN(n === 1 ? r.p_ge1 : r.p_ge2, n === 1 ? r.p_ge1_hist : r.p_ge2_hist);
  }
  function rbiProb(r: RbiRow, n: 1 | 2): number {
    return pickN(n === 1 ? r.p_ge1 : r.p_ge2, n === 1 ? r.p_ge1_hist : r.p_ge2_hist);
  }
  function hrrProb(r: HrrRow, n: 2 | 3 | 4): number {
    const base = n === 2 ? r.p_ge2 : n === 3 ? r.p_ge3 : r.p_ge4;
    const hist = n === 2 ? r.p_ge2_hist : n === 3 ? r.p_ge3_hist : r.p_ge4_hist;
    return pickN(base, hist);
  }
  const runsDateQ = `${selectedDate ? `?date=${selectedDate}&` : "?"}prop=runs&threshold=${threshold.runs}${srcParam ? `&${srcParam}` : ""}`;
  const rbiDateQ = `${selectedDate ? `?date=${selectedDate}&` : "?"}prop=rbi&threshold=${threshold.rbi}${srcParam ? `&${srcParam}` : ""}`;
  const hrrDateQ = `${selectedDate ? `?date=${selectedDate}&` : "?"}prop=hrr&threshold=${threshold.hrr}${srcParam ? `&${srcParam}` : ""}`;

  const hitsRows: BoardRow[] = (data.hits ?? []).map((r) => ({
    id: `hits-${r.player_id ?? r.player}-${r.game_id ?? ""}`,
    player: r.player,
    team: r.team,
    prob: hitsProb(r, threshold.hits),
    detail: `${threshold.hits}+ hits`,
    href: `/player/hits/${r.player_id ?? encodeURIComponent(r.player)}${hitsDateQ}`,
    time: gameTimeLabel(r.game_time),
    timeSort: r.game_time,
    matchup: r.matchup,
    gameId: r.game_id != null ? String(r.game_id) : undefined,
    hand: r.bats ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}` : undefined,
    playerHand: batHand(r.bats),
    opponent: r.vs ? { name: r.vs.name, hand: pitchHand(r.vs.throws) } : undefined,
    bvp: r.vs?.bvp,
    lean: leanFor(r.vs),
    hitProb: r.vs ? pickN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
    kProb: r.vs ? pickN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
    status: r.lineup_status,
    windOut: r.wind_out_mph,
    windMph: r.wind_mph,
    windDir: r.wind_dir,
    tempF: r.temp_f,
    precipPct: r.precip_pct,
  }));

  const tbRows: BoardRow[] = (data.total_bases ?? []).map((r) => ({
    id: `tb-${r.player_id ?? r.player}-${r.game_id ?? ""}`,
    player: r.player,
    team: r.team,
    prob: tbProb(r, threshold.tb),
    detail: `${threshold.tb}+ bases`,
    href: `/player/tb/${r.player_id ?? encodeURIComponent(r.player)}${tbDateQ}`,
    time: gameTimeLabel(r.game_time),
    timeSort: r.game_time,
    matchup: r.matchup,
    gameId: r.game_id != null ? String(r.game_id) : undefined,
    hand: r.bats ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}` : undefined,
    playerHand: batHand(r.bats),
    opponent: r.vs ? { name: r.vs.name, hand: pitchHand(r.vs.throws) } : undefined,
    bvp: r.vs?.bvp,
    lean: leanFor(r.vs),
    hitProb: r.vs ? pickN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
    kProb: r.vs ? pickN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
    status: r.lineup_status,
    windOut: r.wind_out_mph,
    windMph: r.wind_mph,
    windDir: r.wind_dir,
    tempF: r.temp_f,
    precipPct: r.precip_pct,
  }));

  const runsRows: BoardRow[] = (data.runs ?? []).map((r) => ({
    id: `runs-${r.player_id ?? r.player}-${r.game_id ?? ""}`,
    player: r.player,
    team: r.team,
    prob: runsProb(r, threshold.runs),
    detail: `${threshold.runs}+ runs`,
    href: `/player/runs/${r.player_id ?? encodeURIComponent(r.player)}${runsDateQ}`,
    time: gameTimeLabel(r.game_time),
    timeSort: r.game_time,
    matchup: r.matchup,
    gameId: r.game_id != null ? String(r.game_id) : undefined,
    hand: r.bats ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}` : undefined,
    playerHand: batHand(r.bats),
    opponent: r.vs ? { name: r.vs.name, hand: pitchHand(r.vs.throws) } : undefined,
    bvp: r.vs?.bvp,
    lean: leanFor(r.vs),
    hitProb: r.vs ? pickN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
    kProb: r.vs ? pickN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
    status: r.lineup_status,
    windOut: r.wind_out_mph,
    windMph: r.wind_mph,
    windDir: r.wind_dir,
    tempF: r.temp_f,
    precipPct: r.precip_pct,
  }));

  const rbiRows: BoardRow[] = (data.rbi ?? []).map((r) => ({
    id: `rbi-${r.player_id ?? r.player}-${r.game_id ?? ""}`,
    player: r.player,
    team: r.team,
    prob: rbiProb(r, threshold.rbi),
    detail: `${threshold.rbi}+ RBI`,
    href: `/player/rbi/${r.player_id ?? encodeURIComponent(r.player)}${rbiDateQ}`,
    time: gameTimeLabel(r.game_time),
    timeSort: r.game_time,
    matchup: r.matchup,
    gameId: r.game_id != null ? String(r.game_id) : undefined,
    hand: r.bats ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}` : undefined,
    playerHand: batHand(r.bats),
    opponent: r.vs ? { name: r.vs.name, hand: pitchHand(r.vs.throws) } : undefined,
    bvp: r.vs?.bvp,
    lean: leanFor(r.vs),
    hitProb: r.vs ? pickN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
    kProb: r.vs ? pickN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
    status: r.lineup_status,
    windOut: r.wind_out_mph,
    windMph: r.wind_mph,
    windDir: r.wind_dir,
    tempF: r.temp_f,
    precipPct: r.precip_pct,
  }));

  const hrrRows: BoardRow[] = (data.hrr ?? []).map((r) => ({
    id: `hrr-${r.player_id ?? r.player}-${r.game_id ?? ""}`,
    player: r.player,
    team: r.team,
    prob: hrrProb(r, threshold.hrr),
    detail: `${threshold.hrr}+ H+R+RBI`,
    href: `/player/hrr/${r.player_id ?? encodeURIComponent(r.player)}${hrrDateQ}`,
    time: gameTimeLabel(r.game_time),
    timeSort: r.game_time,
    matchup: r.matchup,
    gameId: r.game_id != null ? String(r.game_id) : undefined,
    hand: r.bats ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}` : undefined,
    playerHand: batHand(r.bats),
    opponent: r.vs ? { name: r.vs.name, hand: pitchHand(r.vs.throws) } : undefined,
    bvp: r.vs?.bvp,
    lean: leanFor(r.vs),
    hitProb: r.vs ? pickN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
    kProb: r.vs ? pickN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
    status: r.lineup_status,
    windOut: r.wind_out_mph,
    windMph: r.wind_mph,
    windDir: r.wind_dir,
    tempF: r.temp_f,
    precipPct: r.precip_pct,
  }));

  // Re-sort by the displayed probability so History mode reorders the list to
  // match its numbers (current mode is already in this order, so it's unchanged).
  hrRows.sort((a, b) => b.prob - a.prob);
  kRows.sort((a, b) => b.prob - a.prob);
  hitsRows.sort((a, b) => b.prob - a.prob);
  tbRows.sort((a, b) => b.prob - a.prob);
  runsRows.sort((a, b) => b.prob - a.prob);
  rbiRows.sort((a, b) => b.prob - a.prob);
  hrrRows.sort((a, b) => b.prob - a.prob);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <header className="mb-9 rise">
        <p className="eyebrow mb-2">MLB player props · model-driven</p>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <PPHex size={52} />
          <h1 className="wordmark" style={{ fontFamily: "var(--font-orb), sans-serif", fontStyle: "italic", fontSize: "clamp(1.6rem, 4.5vw, 2.3rem)", letterSpacing: "-0.02em" }}>
            <span className="lo">Prop </span><span className="hi">Predict</span>
          </h1>
          <span style={{ marginLeft: "auto" }}>
            <UserButton />
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2" style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
          <span className="live-dot" />
          {dates.length > 1 ? (
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="num"
              style={{
                background: "var(--bg-2)", color: "var(--text)",
                border: "1px solid var(--line)", borderRadius: 8, padding: "0.25rem 0.5rem",
              }}
            >
              {dates.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          ) : (
            <span className="num">{data.date}</span>
          )}
          {dates.length > 1 && <span style={{ opacity: 0.6 }}>· last {dates.length} days</span>}
          {updatedLabel && <span style={{ opacity: 0.6 }}>· updated {updatedLabel}</span>}
        </div>
      </header>

      <div className="mb-6 rise" style={{ animationDelay: "60ms" }}>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem" }}>
          {/* compact weighting toggle: stacked+centered on phones, pinned far-left on wider screens */}
          <div
            className="weighting-toggle"
            title="Current = this season only. Blend = an equal 50/50 average of Current and History. History = the last 3 seasons blended 5/4/3 for a steadier baseline. Park, weather, matchup and recent form stay live either way."
          >
            <span className="eyebrow" style={{ fontSize: "0.5rem", letterSpacing: "0.12em" }}>Weighting</span>
            <div className="pillbar">
              {([["current", "Current szn"], ["blend", "Blend"], ["hist", "History 3yr"]] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setSource(v)}
                  data-active={source === v}
                  className="pill"
                  style={{ padding: "0.16rem 0.4rem", fontSize: "0.58rem" }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* top level: Props · Parks · Game Hub · Top Plays (centered) */}
          <div className="pillbar">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setSection(s.id)} data-active={section === s.id} className="pill">
                {s.label}
              </button>
            ))}
          </div>
          {/* under Props: which prop, then which view */}
          {section === "props" && (
            <>
              <div className="pillbar">
                {([
                  ["hr", "Home Runs"],
                  ["k", "Strikeouts"],
                  ["hits", "Hits"],
                  ["tb", "Total Bases"],
                  ["runs", "Runs"],
                  ["rbi", "RBI"],
                  ["hrr", "H+R+RBI"],
                ] as const).map(([p, label]) => (
                  <button key={p} onClick={() => setProp(p)} data-active={prop === p} className="pill">
                    {label}
                  </button>
                ))}
              </div>
              {prop === "hits" && (
                <div className="pillbar">
                  {([1, 2, 3] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setThreshold((t) => ({ ...t, hits: n }))}
                      data-active={threshold.hits === n}
                      className="pill"
                    >
                      {n}+
                    </button>
                  ))}
                </div>
              )}
              {prop === "tb" && (
                <div className="pillbar">
                  {([2, 3, 4] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setThreshold((t) => ({ ...t, tb: n }))}
                      data-active={threshold.tb === n}
                      className="pill"
                    >
                      {n}+
                    </button>
                  ))}
                </div>
              )}
              {prop === "runs" && (
                <div className="pillbar">
                  {([1, 2] as const).map((n) => (
                    <button key={n} onClick={() => setThreshold((t) => ({ ...t, runs: n }))} data-active={threshold.runs === n} className="pill">
                      {n}+
                    </button>
                  ))}
                </div>
              )}
              {prop === "rbi" && (
                <div className="pillbar">
                  {([1, 2] as const).map((n) => (
                    <button key={n} onClick={() => setThreshold((t) => ({ ...t, rbi: n }))} data-active={threshold.rbi === n} className="pill">
                      {n}+
                    </button>
                  ))}
                </div>
              )}
              {prop === "hrr" && (
                <div className="pillbar">
                  {([2, 3, 4] as const).map((n) => (
                    <button key={n} onClick={() => setThreshold((t) => ({ ...t, hrr: n }))} data-active={threshold.hrr === n} className="pill">
                      {n}+
                    </button>
                  ))}
                </div>
              )}
              <ViewSwitcher mode={view} onChange={setView} />
            </>
          )}
          {/* Game Hub: choose which Hits / Total Bases threshold the breakdown columns show */}
          {section === "hub" && (
            <div style={{ display: "flex", gap: "1.4rem", flexWrap: "wrap", justifyContent: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
                <span className="eyebrow" style={{ fontSize: "0.5rem", letterSpacing: "0.12em" }}>Hits column</span>
                <div className="pillbar">
                  {([1, 2, 3] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setThreshold((t) => ({ ...t, hits: n }))}
                      data-active={threshold.hits === n}
                      className="pill"
                      style={{ padding: "0.16rem 0.5rem", fontSize: "0.62rem" }}
                    >
                      {n}+
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
                <span className="eyebrow" style={{ fontSize: "0.5rem", letterSpacing: "0.12em" }}>Bases column</span>
                <div className="pillbar">
                  {([2, 3, 4] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setThreshold((t) => ({ ...t, tb: n }))}
                      data-active={threshold.tb === n}
                      className="pill"
                      style={{ padding: "0.16rem 0.5rem", fontSize: "0.62rem" }}
                    >
                      {n}+
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {section === "parks" || section === "hub" ? (
        <ParksBoard
          games={data.games ?? []}
          hrRows={hrRows}
          kRows={kRows}
          hitsRows={hitsRows}
          tbRows={tbRows}
          hitsKind={`hits${threshold.hits}` as "hits1" | "hits2" | "hits3"}
          tbKind={`tb${threshold.tb}` as "tb2" | "tb3" | "tb4"}
          expandable={section === "hub"}
        />
      ) : section === "topplays" ? (
        <TopPlays
          hrRows={hrRows}
          kRows={kRows}
          hitsRows={hitsRows}
          tbRows={tbRows}
          hitsKind={`hits${threshold.hits}` as "hits1" | "hits2" | "hits3"}
          tbKind={`tb${threshold.tb}` as "tb2" | "tb3" | "tb4"}
          threshold={threshold}
          setThreshold={setThreshold}
        />
      ) : (
        <PropBoard
          rows={prop === "hr" ? hrRows : prop === "k" ? kRows : prop === "hits" ? hitsRows : prop === "tb" ? tbRows
                : prop === "runs" ? runsRows : prop === "rbi" ? rbiRows : hrrRows}
          mode={view}
          kind={
            prop === "k" ? "k"
            : prop === "hits" ? (`hits${threshold.hits}` as "hits1" | "hits2" | "hits3")
            : prop === "tb"   ? (`tb${threshold.tb}`   as "tb2"   | "tb3"   | "tb4")
            : prop === "runs" ? (`runs${threshold.runs}` as "runs1" | "runs2")
            : prop === "rbi"  ? (`rbi${threshold.rbi}`  as "rbi1"  | "rbi2")
            : prop === "hrr"  ? (`hrr${threshold.hrr}`  as "hrr2"  | "hrr3"  | "hrr4")
            : "hr"
          }
        />
      )}

      <footer className="mt-12" style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
        Projections are model estimates, not guarantees · Built on Historical and Current Data
      </footer>
    </main>
  );
}
