"use client";

import { useEffect, useState } from "react";
import { loadProjections, loadIndex } from "../lib/data";
import type { Projections } from "../lib/types";
import { ViewSwitcher, type ViewMode } from "../components/ViewSwitcher";
import { PropBoard, type BoardRow } from "../components/PropBoard";
import { gameTimeLabel } from "../lib/format";
import { ParksBoard } from "../components/ParksBoard";
import { FlamingBall, ElectricBat } from "../components/Marks";
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

export default function Home() {
  const [data, setData] = useState<Projections | null>(null);
  const [mode, setMode] = useState<ViewMode>("hybrid");
  const [prop, setProp] = useState<"hr" | "k">("hr");
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const want = params.get("date");
    if (params.get("prop") === "k") setProp("k"); // back-link from a strikeout player page
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

  const dateQ = selectedDate ? `?date=${selectedDate}` : "";

  const hrRows: BoardRow[] = data.hr.map((r) => ({
    id: `${r.player_id ?? r.player}-${r.game_id ?? ""}`,
    player: r.player,
    team: r.team,
    prob: r.probability,
    detail: gameLabel(r.matchup, r.team) ?? `@ ${r.park}`,
    href: `/player/hr/${r.player_id ?? encodeURIComponent(r.player)}${dateQ}`,
    time: gameTimeLabel(r.game_time),
    timeSort: r.game_time,
    matchup: r.matchup,
    hand: r.bats ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}` : undefined,
    playerHand: batHand(r.bats),
    opponent: r.vs ? { name: r.vs.name, hand: pitchHand(r.vs.throws) } : undefined,
    bvp: r.vs?.bvp,
    lean: r.vs ? { lean: r.vs.lean, prob: r.vs.prob } : null,
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
    prob: r.over_prob,
    detail: `line ${r.line.toFixed(1)}`,
    projection: r.expected_ks.toFixed(1),
    line: r.line.toFixed(1),
    href: `/player/k/${r.player_id ?? encodeURIComponent(r.player)}${dateQ}`,
    time: gameTimeLabel(r.game_time),
    timeSort: r.game_time,
    matchup: r.matchup,
    hand: pitchHand(r.throws),
    playerHand: pitchHand(r.throws),
    opponent: oppTeam(r.matchup, r.team) ? { name: oppTeam(r.matchup, r.team)! } : undefined,
    windOut: r.wind_out_mph,
    windMph: r.wind_mph,
    windDir: r.wind_dir,
    tempF: r.temp_f,
    precipPct: r.precip_pct,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <header className="mb-9 rise">
        <p className="eyebrow mb-2">MLB player props · model-driven</p>
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <ElectricBat />
          <h1 className="wordmark">
            <span className="lo">Prop </span><span className="hi">Predict</span>
          </h1>
          <FlamingBall />
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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rise" style={{ animationDelay: "60ms" }}>
        {mode === "parks" || mode === "hub" ? (
          <span />
        ) : (
          <div className="pillbar">
            {(["hr", "k"] as const).map((p) => (
              <button key={p} onClick={() => setProp(p)} data-active={prop === p} className="pill">
                {p === "hr" ? "Home Runs" : "Strikeouts"}
              </button>
            ))}
          </div>
        )}
        <ViewSwitcher mode={mode} onChange={setMode} />
      </div>

      {mode === "parks" || mode === "hub" ? (
        <ParksBoard games={data.games ?? []} hrRows={hrRows} kRows={kRows} expandable={mode === "hub"} />
      ) : (
        <PropBoard rows={prop === "hr" ? hrRows : kRows} mode={mode} kind={prop === "hr" ? "hr" : "k"} />
      )}

      <footer className="mt-12" style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
        Projections are model estimates, not guarantees · Built on Historical and Current Data
      </footer>
    </main>
  );
}
