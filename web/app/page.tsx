"use client";

import { useEffect, useState } from "react";
import { loadProjections } from "../lib/data";
import type { Projections } from "../lib/types";
import { ViewSwitcher, type ViewMode } from "../components/ViewSwitcher";
import { PropBoard, type BoardRow } from "../components/PropBoard";
import { windLabel } from "../lib/format";

export default function Home() {
  const [data, setData] = useState<Projections | null>(null);
  const [mode, setMode] = useState<ViewMode>("hybrid");
  const [prop, setProp] = useState<"hr" | "k">("hr");

  useEffect(() => {
    loadProjections().then(setData).catch(console.error);
  }, []);

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="eyebrow">
          <span className="live-dot" /> &nbsp;loading the board…
        </p>
      </main>
    );
  }

  const hrRows: BoardRow[] = data.hr.map((r) => ({
    player: r.player,
    team: r.team,
    prob: r.probability,
    detail: `@ ${r.park}`,
    context: windLabel(r.wind_out_mph),
    href: `/player/hr/${encodeURIComponent(r.player)}`,
  }));
  const kRows: BoardRow[] = data.strikeouts.map((r) => ({
    player: r.player,
    team: r.team,
    prob: r.over_prob,
    detail: `${r.line} Ks`,
    href: `/player/k/${encodeURIComponent(r.player)}`,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <header className="mb-9 rise">
        <p className="eyebrow mb-2">MLB player props · model-driven</p>
        <h1 className="wordmark">
          <span className="lo">Prop </span><span className="hi">Predict</span>
        </h1>
        <p className="mt-3 flex items-center gap-2" style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
          <span className="live-dot" />
          <span className="num">{data.date}</span>
          <span>·</span>
          <span>updated {new Date(data.updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rise" style={{ animationDelay: "60ms" }}>
        <div className="pillbar">
          {(["hr", "k"] as const).map((p) => (
            <button key={p} onClick={() => setProp(p)} data-active={prop === p} className="pill">
              {p === "hr" ? "Home Runs" : "Strikeouts"}
            </button>
          ))}
        </div>
        <ViewSwitcher mode={mode} onChange={setMode} />
      </div>

      <PropBoard rows={prop === "hr" ? hrRows : kRows} mode={mode} />

      <footer className="mt-12" style={{ color: "var(--muted)", fontSize: "0.72rem" }}>
        Projections are model estimates, not guarantees · built on free public data
      </footer>
    </main>
  );
}
