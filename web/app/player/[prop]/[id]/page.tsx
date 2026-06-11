"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { loadProjections } from "../../../../lib/data";
import type { Projections } from "../../../../lib/types";
import { pct, windLabel, strengthLabel } from "../../../../lib/format";

function Back() {
  return (
    <Link href="/" className="eyebrow" style={{ textDecoration: "none" }}>
      ← back to board
    </Link>
  );
}

function Stat({ value, label, glow }: { value: string; label: string; glow?: boolean }) {
  return (
    <div>
      <div className={`stat big ${glow ? "glow" : ""}`}>{value}</div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  );
}

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

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <p className="eyebrow"><span className="live-dot" /> &nbsp;loading…</p>
      </main>
    );
  }

  const notFound = (
    <main className="mx-auto max-w-2xl px-5 py-14 space-y-5">
      <Back />
      <p className="panel" style={{ color: "var(--muted)" }}>No data for {name}.</p>
    </main>
  );

  if (prop === "hr") {
    const r = data.hr.find((x) => x.player === name);
    if (!r) return notFound;
    return (
      <main className="mx-auto max-w-2xl px-5 py-14 space-y-6">
        <Back />
        <div className="rise">
          <p className="eyebrow mb-1">{r.team} · Home Run</p>
          <h1 className="wordmark" style={{ fontSize: "clamp(1.8rem,5vw,2.6rem)" }}>
            <span className="lo">{r.player}</span>
          </h1>
        </div>

        <div className="panel rise flex flex-wrap gap-10" style={{ animationDelay: "60ms" }}>
          <Stat value={pct(r.probability)} label="our HR chance" glow />
          <Stat value={strengthLabel(r.probability)} label="our read" />
        </div>

        <div className="panel rise" style={{ animationDelay: "120ms" }}>
          <div className="eyebrow mb-3">Why</div>
          <ul className="space-y-3" style={{ fontSize: "0.92rem" }}>
            <li className="flex justify-between gap-4">
              <span>🏟️ Park ({r.park})</span>
              <span className="num">×{r.park_mult.toFixed(2)} {r.park_mult > 1 ? "↑" : r.park_mult < 1 ? "↓" : ""}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>🌬️ Weather · {windLabel(r.wind_out_mph)}</span>
              <span className="num">×{r.weather_mult.toFixed(2)} {r.weather_mult > 1 ? "↑" : r.weather_mult < 1 ? "↓" : ""}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>🔥 Recent form {r.recent_form_mult > 1 ? "(hot)" : r.recent_form_mult < 1 ? "(cold)" : "(neutral)"}</span>
              <span className="num">×{r.recent_form_mult.toFixed(2)} {r.recent_form_mult > 1 ? "↑" : r.recent_form_mult < 1 ? "↓" : ""}</span>
            </li>
          </ul>
        </div>
      </main>
    );
  }

  const r = data.strikeouts.find((x) => x.player === name);
  if (!r) return notFound;
  return (
    <main className="mx-auto max-w-2xl px-5 py-14 space-y-6">
      <Back />
      <div className="rise">
        <p className="eyebrow mb-1">{r.team} · Strikeouts</p>
        <h1 className="wordmark" style={{ fontSize: "clamp(1.8rem,5vw,2.6rem)" }}>
          <span className="lo">{r.player}</span>
        </h1>
      </div>
      <div className="panel rise flex flex-wrap gap-10" style={{ animationDelay: "60ms" }}>
        <Stat value={pct(r.over_prob)} label={`over ${r.line} Ks`} glow />
        <Stat value={r.expected_ks.toFixed(1)} label="projected Ks" />
      </div>
    </main>
  );
}
