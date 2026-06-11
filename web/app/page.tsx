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

  if (!data) return <main className="p-6">Loading…</main>;

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
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">⚾ prop-predict</h1>
        <p className="text-sm text-gray-500">
          {data.date} · updated {new Date(data.updated).toLocaleTimeString()}
        </p>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          {(["hr", "k"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProp(p)}
              className={`px-3 py-1.5 text-sm ${prop === p ? "bg-gray-800 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
            >
              {p === "hr" ? "Home Runs" : "Strikeouts"}
            </button>
          ))}
        </div>
        <ViewSwitcher mode={mode} onChange={setMode} />
      </div>

      <PropBoard rows={prop === "hr" ? hrRows : kRows} mode={mode} />
    </main>
  );
}
