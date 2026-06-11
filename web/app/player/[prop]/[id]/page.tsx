"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { loadProjections } from "../../../../lib/data";
import type { Projections } from "../../../../lib/types";
import { pct, windLabel, strengthLabel } from "../../../../lib/format";

export default function PlayerPage({
  params,
}: {
  params: Promise<{ prop: string; id: string }>;
}) {
  const { prop, id } = use(params);
  const name = decodeURIComponent(id);
  const [data, setData] = useState<Projections | null>(null);

  useEffect(() => {
    loadProjections().then(setData).catch(console.error);
  }, []);

  if (!data) return <main className="p-6">Loading…</main>;

  const back = (
    <Link href="/" className="text-blue-700 hover:underline text-sm">← back to board</Link>
  );

  if (prop === "hr") {
    const r = data.hr.find((x) => x.player === name);
    if (!r) return <main className="p-6">{back}<p className="mt-4">No data for {name}.</p></main>;
    return (
      <main className="mx-auto max-w-2xl p-6 space-y-4">
        {back}
        <h1 className="text-2xl font-bold">{r.player} — Home Run</h1>
        <div className="flex gap-6">
          <div><div className="text-3xl font-bold text-green-700">{pct(r.probability)}</div><div className="text-sm text-gray-500">our HR chance</div></div>
          <div><div className="text-3xl font-bold">{strengthLabel(r.probability)}</div><div className="text-sm text-gray-500">our read</div></div>
        </div>
        <div>
          <h2 className="font-semibold mb-2">Why</h2>
          <ul className="space-y-1 text-sm">
            <li>🏟️ Park ({r.park}): ×{r.park_mult.toFixed(2)} {r.park_mult > 1 ? "(boost)" : r.park_mult < 1 ? "(suppress)" : ""}</li>
            <li>🌬️ Weather: {windLabel(r.wind_out_mph)} → ×{r.weather_mult.toFixed(2)}</li>
            <li>🔥 Recent form: ×{r.recent_form_mult.toFixed(2)} {r.recent_form_mult > 1 ? "(hot)" : r.recent_form_mult < 1 ? "(cold)" : "(neutral)"}</li>
          </ul>
        </div>
      </main>
    );
  }

  const r = data.strikeouts.find((x) => x.player === name);
  if (!r) return <main className="p-6">{back}<p className="mt-4">No data for {name}.</p></main>;
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      {back}
      <h1 className="text-2xl font-bold">{r.player} — Strikeouts</h1>
      <div className="flex gap-6">
        <div><div className="text-3xl font-bold text-green-700">{pct(r.over_prob)}</div><div className="text-sm text-gray-500">over {r.line}</div></div>
        <div><div className="text-3xl font-bold">{r.expected_ks.toFixed(1)}</div><div className="text-sm text-gray-500">projected Ks</div></div>
      </div>
    </main>
  );
}
