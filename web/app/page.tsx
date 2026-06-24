"use client";

import { useEffect, useState } from "react";
import { loadProjections, loadIndex } from "../lib/data";
import type { Projections, HitsRow, TbRow } from "../lib/types";
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
  const [prop, setProp] = useState<"hr" | "k" | "hits" | "tb">("hr");
  const [threshold, setThreshold] = useState<{ hits: 1 | 2 | 3; tb: 2 | 3 | 4 }>({ hits: 1, tb: 2 });
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [source, setSource] = useState<"current" | "hist">("current");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const want = params.get("date");
    const propParam = params.get("prop");
    if (propParam === "k") setProp("k");
    else if (propParam === "hits") setProp("hits");
    else if (propParam === "tb") setProp("tb");
    // back-link from player pages: restore threshold
    const tp = params.get("threshold");
    if (propParam === "hits" && (tp === "1" || tp === "2" || tp === "3")) {
      setThreshold((t) => ({ ...t, hits: Number(tp) as 1 | 2 | 3 }));
    }
    if (propParam === "tb" && (tp === "2" || tp === "3" || tp === "4")) {
      setThreshold((t) => ({ ...t, tb: Number(tp) as 2 | 3 | 4 }));
    }
    // back-link from player pages
    if (params.get("source") === "hist") setSource("hist");
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

  const dateQ = `${selectedDate ? `?date=${selectedDate}` : ""}${source === "hist" ? `${selectedDate ? "&" : "?"}source=hist` : ""}`;

  const hrRows: BoardRow[] = data.hr.map((r) => ({
    id: `${r.player_id ?? r.player}-${r.game_id ?? ""}`,
    player: r.player,
    team: r.team,
    prob: source === "hist" ? (r.probability_hist ?? r.probability) : r.probability,
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
    lean: r.vs
      ? (source === "hist" && r.vs.lean_hist != null && r.vs.prob_hist != null
          ? { lean: r.vs.lean_hist, prob: r.vs.prob_hist }
          : { lean: r.vs.lean, prob: r.vs.prob })
      : null,
    hitProb: source === "hist" ? (r.vs?.hit_prob_hist ?? r.vs?.hit_prob) : r.vs?.hit_prob,
    kProb: source === "hist" ? (r.vs?.k_prob_hist ?? r.vs?.k_prob) : r.vs?.k_prob,
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
    prob: source === "hist" ? (r.over_prob_hist ?? r.over_prob) : r.over_prob,
    detail: `line ${r.line.toFixed(1)}`,
    projection: (source === "hist" ? (r.expected_ks_hist ?? r.expected_ks) : r.expected_ks).toFixed(1),
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
    if (source !== "hist") return base;
    const hist = n === 1 ? r.p_ge1_hist : n === 2 ? r.p_ge2_hist : r.p_ge3_hist;
    return hist ?? base;
  }
  function tbProb(r: TbRow, n: 2 | 3 | 4): number {
    const base = n === 2 ? r.p_ge2 : n === 3 ? r.p_ge3 : r.p_ge4;
    if (source !== "hist") return base;
    const hist = n === 2 ? r.p_ge2_hist : n === 3 ? r.p_ge3_hist : r.p_ge4_hist;
    return hist ?? base;
  }

  const hitsDateQ = `${selectedDate ? `?date=${selectedDate}&` : "?"}prop=hits&threshold=${threshold.hits}${source === "hist" ? "&source=hist" : ""}`;
  const tbDateQ = `${selectedDate ? `?date=${selectedDate}&` : "?"}prop=tb&threshold=${threshold.tb}${source === "hist" ? "&source=hist" : ""}`;

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
    lean: r.vs
      ? (source === "hist" && r.vs.lean_hist != null && r.vs.prob_hist != null
          ? { lean: r.vs.lean_hist, prob: r.vs.prob_hist }
          : { lean: r.vs.lean, prob: r.vs.prob })
      : null,
    hitProb: source === "hist" ? (r.vs?.hit_prob_hist ?? r.vs?.hit_prob) : r.vs?.hit_prob,
    kProb: source === "hist" ? (r.vs?.k_prob_hist ?? r.vs?.k_prob) : r.vs?.k_prob,
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
    lean: r.vs
      ? (source === "hist" && r.vs.lean_hist != null && r.vs.prob_hist != null
          ? { lean: r.vs.lean_hist, prob: r.vs.prob_hist }
          : { lean: r.vs.lean, prob: r.vs.prob })
      : null,
    hitProb: source === "hist" ? (r.vs?.hit_prob_hist ?? r.vs?.hit_prob) : r.vs?.hit_prob,
    kProb: source === "hist" ? (r.vs?.k_prob_hist ?? r.vs?.k_prob) : r.vs?.k_prob,
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
            title="Current = this season only. History = the last 3 seasons blended 5/4/3 for a steadier baseline. Park, weather, matchup and recent form stay live either way."
          >
            <span className="eyebrow" style={{ fontSize: "0.5rem", letterSpacing: "0.12em" }}>Weighting</span>
            <div className="pillbar">
              {([["current", "Current szn"], ["hist", "History 3yr"]] as const).map(([v, label]) => (
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
              <ViewSwitcher mode={view} onChange={setView} />
            </>
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
          rows={prop === "hr" ? hrRows : prop === "k" ? kRows : prop === "hits" ? hitsRows : tbRows}
          mode={view}
          kind={
            prop === "k" ? "k"
            : prop === "hits" ? (`hits${threshold.hits}` as "hits1" | "hits2" | "hits3")
            : prop === "tb"   ? (`tb${threshold.tb}`   as "tb2"   | "tb3"   | "tb4")
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
