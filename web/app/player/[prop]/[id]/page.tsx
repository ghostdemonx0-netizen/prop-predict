"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { loadProjections } from "../../../../lib/data";
import type { Projections } from "../../../../lib/types";
import { pct, strengthLabel, windText, arrowColor } from "../../../../lib/format";

function batLabel(b?: string) {
  return b === "L" ? "LHB" : b === "S" ? "Switch" : b ? "RHB" : "";
}
function pitLabel(t?: string) {
  return t === "L" ? "LHP" : t ? "RHP" : "";
}

function MatchupSphere({ lean, prob }: { lean: string; prob: number }) {
  const cls = lean === "K" ? "k" : lean === "H" ? "h" : "neu";
  return (
    <span className={`msphere ${cls}`} title="model matchup read (not head-to-head history)">
      <span className="mp">{Math.round(prob * 100)}%</span>
      <span className="ml">{lean === "NEU" ? "—" : lean}</span>
    </span>
  );
}

function Back({ date }: { date?: string }) {
  return (
    <Link href={date ? `/?date=${date}` : "/"} className="eyebrow" style={{ textDecoration: "none" }}>
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

/** Renders a factor as a +/-% impact with a centered bar, instead of a raw multiplier. */
function Factor({ icon, label, mult, note }: { icon: string; label: string; mult: number; note: string }) {
  const delta = Math.round((mult - 1) * 100);
  const pos = delta > 0;
  const neg = delta < 0;
  const mag = Math.min(Math.abs(delta), 40) / 40; // scaled to ±40%
  return (
    <div className="factor">
      <div className="factor-head">
        <span>{icon} {label}</span>
        <span className={`delta ${pos ? "up" : neg ? "down" : "flat"}`}>
          {pos ? `+${delta}%` : neg ? `${delta}%` : "neutral"}
        </span>
      </div>
      <div className="impact-track">
        <span className="impact-mid" />
        <span
          className="impact-fill"
          style={{
            left: pos ? "50%" : `${50 - mag * 50}%`,
            width: `${mag * 50}%`,
            background: pos ? "var(--green)" : "var(--red)",
          }}
        />
      </div>
      <div className="factor-note">{note}</div>
    </div>
  );
}

function WeatherStrip({
  tempF,
  windMph,
  windDir,
  precipPct,
}: {
  tempF?: number;
  windMph?: number;
  windDir?: number;
  precipPct?: number;
}) {
  return (
    <div className="wx-strip">
      {typeof tempF === "number" && (
        <span className="wx-chip">🌡️ <span className="num">{Math.round(tempF)}°</span></span>
      )}
      {typeof windMph === "number" && typeof windDir === "number" && (
        <span className="wx-chip" title="wind direction relative to the field">
          <span style={{ display: "inline-block", fontWeight: 800, transform: `rotate(${windDir}deg)`, color: arrowColor(windDir) }}>↑</span>
          <span className="num">{Math.round(windMph)}mph</span>
          <span style={{ color: "var(--muted)" }}>{windText(windDir)}</span>
        </span>
      )}
      {typeof precipPct === "number" && (
        <span className="wx-chip">
          💧 <span className="num" style={{ color: precipPct >= 20 ? "#7cc7ff" : "inherit" }}>{precipPct}%</span>
          <span style={{ color: "var(--muted)" }}>rain</span>
        </span>
      )}
    </div>
  );
}

export default function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ prop: string; id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { prop, id } = use(params);
  const { date } = use(searchParams);
  const name = decodeURIComponent(id);
  const [data, setData] = useState<Projections | null>(null);

  useEffect(() => {
    loadProjections(date).then(setData).catch(console.error);
  }, [date]);

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <p className="eyebrow"><span className="live-dot" /> &nbsp;loading…</p>
      </main>
    );
  }

  const notFound = (
    <main className="mx-auto max-w-2xl px-5 py-14 space-y-5">
      <Back date={date} />
      <p className="panel" style={{ color: "var(--muted)" }}>No data for {name}.</p>
    </main>
  );

  if (prop === "hr") {
    const r = data.hr.find((x) => String(x.player_id) === id) ?? data.hr.find((x) => x.player === name);
    if (!r) return notFound;
    const parkFriendly = r.park_mult >= 1;
    return (
      <main className="mx-auto max-w-2xl px-5 py-14 space-y-6">
        <Back date={date} />
        <div className="rise">
          <p className="eyebrow mb-1">{r.team}{r.bats ? ` · ${batLabel(r.bats)}` : ""} · Home Run</p>
          <h1 className="wordmark" style={{ fontSize: "clamp(1.8rem,5vw,2.6rem)" }}>
            <span className="lo">{r.player}</span>
          </h1>
        </div>

        <div className="panel rise flex flex-wrap gap-10" style={{ animationDelay: "60ms" }}>
          <Stat value={pct(r.probability)} label="our HR probability" glow />
          <Stat value={strengthLabel(r.probability)} label="our read" />
        </div>

        <div className="panel rise" style={{ animationDelay: "120ms" }}>
          <div className="eyebrow mb-1">What&apos;s driving it</div>
          <p className="factor-note" style={{ marginTop: 0, marginBottom: "0.5rem" }}>
            How much each factor raises (green) or lowers (red) his normal probability.
          </p>
          <Factor
            icon="🏟️"
            label={`Park · ${r.park}`}
            mult={r.park_mult}
            note={`${r.park} plays ${parkFriendly ? "hitter-friendly" : "pitcher-friendly"} for home runs.`}
          />
          <Factor
            icon="🌬️"
            label="Weather"
            mult={r.weather_mult}
            note={`${typeof r.wind_mph === "number" ? Math.round(r.wind_mph) + "mph wind " : ""}${typeof r.wind_dir === "number" ? windText(r.wind_dir) : ""}${typeof r.temp_f === "number" ? `, ${Math.round(r.temp_f)}°` : ""}.`}
          />
          <Factor
            icon="🔥"
            label="Recent form"
            mult={r.recent_form_mult}
            note={r.recent_form_mult > 1 ? "Hot lately — hitting the ball harder than his season norm." : r.recent_form_mult < 1 ? "Cooled off — below his season norm recently." : "Right around his season norm."}
          />
          {r.vs && (r.pitcher_mult !== undefined || r.matchup_mult !== undefined) && (
            <Factor
              icon="⚾"
              label={`Pitcher · ${r.vs.name}`}
              mult={(r.pitcher_mult ?? 1) * (r.matchup_mult ?? 1)}
              note={`Combines ${r.vs.name}'s home-run quality with the ${
                (r.matchup_mult ?? 1) > 1 ? "favorable" : "unfavorable"
              } ${batLabel(r.bats)}-vs-${pitLabel(r.vs.throws)} platoon matchup.`}
            />
          )}
        </div>

        <div className="panel rise" style={{ animationDelay: "180ms" }}>
          <div className="eyebrow mb-3">Conditions</div>
          <WeatherStrip tempF={r.temp_f} windMph={r.wind_mph} windDir={r.wind_dir} precipPct={r.precip_pct} />
        </div>

        {r.vs && (
          <div className="panel rise" style={{ animationDelay: "240ms" }}>
            <div className="eyebrow mb-1">Pitcher matchup</div>
            <p className="factor-note" style={{ marginTop: 0, marginBottom: "0.6rem" }}>
              Model read from both players&apos; rates + handedness — not head-to-head history.
            </p>
            <div className="lineup-row" style={{ borderBottom: 0, padding: 0 }}>
              <span className="bname">
                {r.vs.name} <span className="hand">{pitLabel(r.vs.throws)}</span>
              </span>
              <MatchupSphere lean={r.vs.lean} prob={r.vs.prob} />
            </div>
            {r.vs.bvp && r.vs.bvp.pa > 0 ? (
              <p className="factor-note" style={{ marginBottom: 0 }}>
                Career vs {r.vs.name}: <strong style={{ color: "var(--text)" }}>{r.vs.bvp.hits}-for-{r.vs.bvp.ab}</strong>
                {r.vs.bvp.hr > 0 && <> · <strong style={{ color: "var(--text)" }}>{r.vs.bvp.hr} HR</strong></>}
                {" "}· {r.vs.bvp.k} K{r.vs.bvp.pa < 10 ? " · small sample — context only" : ""}
              </p>
            ) : (
              <p className="factor-note" style={{ marginBottom: 0 }}>No career history against him yet.</p>
            )}
          </div>
        )}
      </main>
    );
  }

  const r = data.strikeouts.find((x) => String(x.player_id) === id) ?? data.strikeouts.find((x) => x.player === name);
  if (!r) return notFound;
  const scale = Math.max(r.line + 3, r.expected_ks + 1);
  const over = r.expected_ks > r.line;
  return (
    <main className="mx-auto max-w-2xl px-5 py-14 space-y-6">
      <Back date={date} />
      <div className="rise">
        <p className="eyebrow mb-1">{r.team}{r.throws ? ` · ${pitLabel(r.throws)}` : ""} · Strikeouts</p>
        <h1 className="wordmark" style={{ fontSize: "clamp(1.8rem,5vw,2.6rem)" }}>
          <span className="lo">{r.player}</span>
        </h1>
      </div>

      <div className="panel rise flex flex-wrap gap-10" style={{ animationDelay: "60ms" }}>
        <Stat value={pct(r.over_prob)} label={`over ${r.line} Ks`} glow />
        <Stat value={r.expected_ks.toFixed(1)} label="projected Ks" />
      </div>

      <div className="panel rise" style={{ animationDelay: "120ms" }}>
        <div className="eyebrow mb-3">Projection vs the line</div>
        <div style={{ position: "relative", height: "12px", background: "rgba(120,200,150,0.08)", borderRadius: 999 }}>
          <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(r.expected_ks / scale) * 100}%`, background: over ? "var(--green)" : "var(--red)", borderRadius: 999 }} />
          <span style={{ position: "absolute", left: `${(r.line / scale) * 100}%`, top: -4, bottom: -4, width: "2px", background: "var(--text)" }} title="the line" />
        </div>
        <p className="factor-note">
          We project <strong style={{ color: "var(--text)" }}>{r.expected_ks.toFixed(1)} Ks</strong>; the line is{" "}
          <strong style={{ color: "var(--text)" }}>{r.line}</strong> (the white marker) — so we lean{" "}
          <strong style={{ color: over ? "var(--green)" : "var(--red)" }}>{over ? "OVER" : "UNDER"}</strong>.
        </p>
      </div>

      <div className="panel rise" style={{ animationDelay: "180ms" }}>
        <div className="eyebrow mb-3">Conditions</div>
        <WeatherStrip tempF={r.temp_f} windMph={r.wind_mph} windDir={r.wind_dir} precipPct={r.precip_pct} />
        <p className="factor-note">Weather barely affects strikeouts — shown for game context.</p>
      </div>

      {r.matchups && r.matchups.length > 0 && (
        <div className="panel rise" style={{ animationDelay: "240ms" }}>
          <div className="eyebrow mb-1">Opposing lineup — matchup read</div>
          <p className="factor-note" style={{ marginTop: 0, marginBottom: "0.6rem" }}>
            <strong style={{ color: "#ffd9d6" }}>K</strong> = likely strikeout ·{" "}
            <strong style={{ color: "#bff3d2" }}>H</strong> = likely hit · — = no edge. Model-derived
            from rates + handedness, not head-to-head history.
          </p>
          <div className="lineup">
            {r.matchups.map((m, i) => (
              <div className="lineup-row" key={m.name}>
                <span className="ord">{i + 1}</span>
                <span className="bname">
                  {m.name} <span className="hand">{batLabel(m.bats)}</span>
                  {m.bvp && m.bvp.pa > 0 && (
                    <span className="hand" title="career vs this pitcher">{m.bvp.hits}-{m.bvp.ab}{m.bvp.hr > 0 ? ` · ${m.bvp.hr} HR` : ""}</span>
                  )}
                </span>
                <MatchupSphere lean={m.lean} prob={m.prob} />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
