"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { loadProjections } from "../../../../lib/data";
import type { Projections } from "../../../../lib/types";
import { pct, strengthLabel, windText, arrowColor, gameTimeLabel } from "../../../../lib/format";
import { MatchupSphere } from "../../../../components/PropBoard";

function batLabel(b?: string) {
  return b === "L" ? "LHB" : b === "S" ? "Switch" : b ? "RHB" : "";
}
function pitLabel(t?: string) {
  return t === "L" ? "LHP" : t ? "RHP" : "";
}

function Back({ prop, date, hist, threshold }: { prop?: string; date?: string; hist?: boolean; threshold?: string }) {
  const q = new URLSearchParams();
  if (prop === "k") q.set("prop", "k"); // return to the strikeout board, not the default HR view
  if (prop === "hits") q.set("prop", "hits");
  if (prop === "tb") q.set("prop", "tb");
  if (date) q.set("date", date);
  if (hist) q.set("source", "hist");
  if (threshold && (prop === "hits" || prop === "tb")) q.set("threshold", threshold);
  const qs = q.toString();
  return (
    <Link href={qs ? `/?${qs}` : "/"} className="eyebrow" style={{ textDecoration: "none" }}>
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
  searchParams: Promise<{ date?: string; source?: string; threshold?: string }>;
}) {
  const { prop, id } = use(params);
  const { date, source, threshold: thresholdParam } = use(searchParams);
  const name = decodeURIComponent(id);
  const [data, setData] = useState<Projections | null>(null);

  const hist = source === "hist";
  const pick = <T,>(cur: T, h: T | undefined | null): T => (hist && h != null ? h : cur);
  const navQ = `${date ? `?date=${date}` : ""}${hist ? `${date ? "&" : "?"}source=hist` : ""}`;

  // Parse threshold from query param (for hits: 1|2|3, for tb: 2|3|4)
  const hitsThreshold: 1 | 2 | 3 = (thresholdParam === "2" ? 2 : thresholdParam === "3" ? 3 : 1);
  const tbThreshold: 2 | 3 | 4 = (thresholdParam === "3" ? 3 : thresholdParam === "4" ? 4 : 2);

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
      <Back prop={prop} date={date} hist={hist} />
      <p className="panel" style={{ color: "var(--muted)" }}>No data for {name}.</p>
    </main>
  );

  if (prop === "hr") {
    const r = data.hr.find((x) => String(x.player_id) === id) ?? data.hr.find((x) => x.player === name);
    if (!r) return notFound;
    const parkFriendly = r.park_mult >= 1;
    return (
      <main className="mx-auto max-w-2xl px-5 py-14 space-y-6">
        <Back prop={prop} date={date} hist={hist} />
        <div className="rise">
          <p className="eyebrow mb-1">{r.team}{r.bats ? ` · ${batLabel(r.bats)}` : ""} · Home Run{gameTimeLabel(r.game_time) ? ` · 🕐 ${gameTimeLabel(r.game_time)}` : ""}</p>
          <h1 className="wordmark" style={{ fontSize: "clamp(1.8rem,5vw,2.6rem)" }}>
            <span className="lo">{r.player}</span>
          </h1>
        </div>

        <div className="panel rise flex flex-wrap gap-10" style={{ animationDelay: "60ms" }}>
          <Stat value={pct(pick(r.probability, r.probability_hist))} label="our HR probability" glow />
          <Stat value={strengthLabel(pick(r.probability, r.probability_hist))} label="our read" />
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
          {r.vs && r.vs.bvp && r.vs.bvp.pa > 0 && r.bvp_mult !== undefined && (
            <Factor
              icon="📜"
              label={`History · vs ${r.vs.name}`}
              mult={r.bvp_mult}
              note={`${r.vs.bvp.hits}-for-${r.vs.bvp.ab} career${r.vs.bvp.hr > 0 ? ` with ${r.vs.bvp.hr} HR` : ""}.`}
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
              <strong style={{ color: "#ffd9d6" }}>K</strong> = likely strikeout ·{" "}
              <strong style={{ color: "#bff3d2" }}>C</strong> = likely hit (contact) ·{" "}
              <strong style={{ color: "#c5d6e8" }}>N</strong> = neutral
            </p>
            <div className="lineup-row" style={{ borderBottom: 0, padding: 0 }}>
              <span className="bname">
                <Link
                  href={`/player/k/${r.vs.player_id ?? encodeURIComponent(r.vs.name)}${navQ}`}
                  className="linklike"
                >
                  {r.vs.name}
                </Link>{" "}
                <span className="hand">{pitLabel(r.vs.throws)}</span>
              </span>
              <MatchupSphere lean={pick(r.vs.lean, r.vs.lean_hist)} prob={pick(r.vs.prob, r.vs.prob_hist)} />
            </div>
            {r.vs.bvp && r.vs.bvp.pa > 0 ? (
              <p className="factor-note" style={{ marginBottom: 0 }}>
                Career vs {r.vs.name}: <strong style={{ color: "var(--text)" }}>{r.vs.bvp.hits}-for-{r.vs.bvp.ab}</strong>
                {r.vs.bvp.hr > 0 && <> · <strong style={{ color: "var(--text)" }}>{r.vs.bvp.hr} HR</strong></>}
                {" "}· {r.vs.bvp.k} K
              </p>
            ) : (
              <p className="factor-note" style={{ marginBottom: 0 }}>No career history against him yet.</p>
            )}
          </div>
        )}
      </main>
    );
  }

  if (prop === "hits") {
    const r = (data.hits ?? []).find((x) => String(x.player_id) === id) ?? (data.hits ?? []).find((x) => x.player === name);
    if (!r) return notFound;
    const p1 = pick(r.p_ge1, r.p_ge1_hist);
    const p2 = pick(r.p_ge2, r.p_ge2_hist);
    const p3 = pick(r.p_ge3, r.p_ge3_hist);
    const activeProb = hitsThreshold === 1 ? p1 : hitsThreshold === 2 ? p2 : p3;
    return (
      <main className="mx-auto max-w-2xl px-5 py-14 space-y-6">
        <Back prop={prop} date={date} hist={hist} threshold={thresholdParam} />
        <div className="rise">
          <p className="eyebrow mb-1">{r.team}{r.bats ? ` · ${batLabel(r.bats)}` : ""} · Hits{gameTimeLabel(r.game_time) ? ` · 🕐 ${gameTimeLabel(r.game_time)}` : ""}</p>
          <h1 className="wordmark" style={{ fontSize: "clamp(1.8rem,5vw,2.6rem)" }}>
            <span className="lo">{r.player}</span>
          </h1>
        </div>

        <div className="panel rise flex flex-wrap gap-10" style={{ animationDelay: "60ms" }}>
          <Stat value={pct(p1)} label="1+ hit" glow={hitsThreshold === 1} />
          <Stat value={pct(p2)} label="2+ hits" glow={hitsThreshold === 2} />
          <Stat value={pct(p3)} label="3+ hits" glow={hitsThreshold === 3} />
        </div>

        <div className="panel rise" style={{ animationDelay: "120ms" }}>
          <div className="eyebrow mb-1">Our read</div>
          <p className="factor-note" style={{ marginTop: 0 }}>
            At the selected threshold ({hitsThreshold}+), we give him a{" "}
            <strong style={{ color: "var(--text)" }}>{pct(activeProb)}</strong> chance.{" "}
            {strengthLabel(activeProb)}
          </p>
        </div>

        <div className="panel rise" style={{ animationDelay: "180ms" }}>
          <div className="eyebrow mb-3">Conditions</div>
          <WeatherStrip tempF={r.temp_f} windMph={r.wind_mph} windDir={r.wind_dir} precipPct={r.precip_pct} />
        </div>

        {r.vs && (
          <div className="panel rise" style={{ animationDelay: "240ms" }}>
            <div className="eyebrow mb-1">Pitcher matchup</div>
            <p className="factor-note" style={{ marginTop: 0, marginBottom: "0.6rem" }}>
              <strong style={{ color: "#ffd9d6" }}>K</strong> = likely strikeout ·{" "}
              <strong style={{ color: "#bff3d2" }}>C</strong> = likely hit (contact) ·{" "}
              <strong style={{ color: "#c5d6e8" }}>N</strong> = neutral
            </p>
            <div className="lineup-row" style={{ borderBottom: 0, padding: 0 }}>
              <span className="bname">
                <Link
                  href={`/player/k/${r.vs.player_id ?? encodeURIComponent(r.vs.name)}${navQ}`}
                  className="linklike"
                >
                  {r.vs.name}
                </Link>{" "}
                <span className="hand">{pitLabel(r.vs.throws)}</span>
              </span>
              <MatchupSphere lean={pick(r.vs.lean, r.vs.lean_hist)} prob={pick(r.vs.prob, r.vs.prob_hist)} />
            </div>
            {r.vs.bvp && r.vs.bvp.pa > 0 ? (
              <p className="factor-note" style={{ marginBottom: 0 }}>
                Career vs {r.vs.name}: <strong style={{ color: "var(--text)" }}>{r.vs.bvp.hits}-for-{r.vs.bvp.ab}</strong>
                {r.vs.bvp.hr > 0 && <> · <strong style={{ color: "var(--text)" }}>{r.vs.bvp.hr} HR</strong></>}
                {" "}· {r.vs.bvp.k} K
              </p>
            ) : (
              <p className="factor-note" style={{ marginBottom: 0 }}>No career history against him yet.</p>
            )}
          </div>
        )}
      </main>
    );
  }

  if (prop === "tb") {
    const r = (data.total_bases ?? []).find((x) => String(x.player_id) === id) ?? (data.total_bases ?? []).find((x) => x.player === name);
    if (!r) return notFound;
    const p2 = pick(r.p_ge2, r.p_ge2_hist);
    const p3 = pick(r.p_ge3, r.p_ge3_hist);
    const p4 = pick(r.p_ge4, r.p_ge4_hist);
    const activeProb = tbThreshold === 2 ? p2 : tbThreshold === 3 ? p3 : p4;
    return (
      <main className="mx-auto max-w-2xl px-5 py-14 space-y-6">
        <Back prop={prop} date={date} hist={hist} threshold={thresholdParam} />
        <div className="rise">
          <p className="eyebrow mb-1">{r.team}{r.bats ? ` · ${batLabel(r.bats)}` : ""} · Total Bases{gameTimeLabel(r.game_time) ? ` · 🕐 ${gameTimeLabel(r.game_time)}` : ""}</p>
          <h1 className="wordmark" style={{ fontSize: "clamp(1.8rem,5vw,2.6rem)" }}>
            <span className="lo">{r.player}</span>
          </h1>
        </div>

        <div className="panel rise flex flex-wrap gap-10" style={{ animationDelay: "60ms" }}>
          <Stat value={pct(p2)} label="2+ bases" glow={tbThreshold === 2} />
          <Stat value={pct(p3)} label="3+ bases" glow={tbThreshold === 3} />
          <Stat value={pct(p4)} label="4+ bases" glow={tbThreshold === 4} />
        </div>

        <div className="panel rise" style={{ animationDelay: "120ms" }}>
          <div className="eyebrow mb-1">Our read</div>
          <p className="factor-note" style={{ marginTop: 0 }}>
            At the selected threshold ({tbThreshold}+), we give him a{" "}
            <strong style={{ color: "var(--text)" }}>{pct(activeProb)}</strong> chance.{" "}
            {strengthLabel(activeProb)}
          </p>
        </div>

        <div className="panel rise" style={{ animationDelay: "180ms" }}>
          <div className="eyebrow mb-3">Conditions</div>
          <WeatherStrip tempF={r.temp_f} windMph={r.wind_mph} windDir={r.wind_dir} precipPct={r.precip_pct} />
        </div>

        {r.vs && (
          <div className="panel rise" style={{ animationDelay: "240ms" }}>
            <div className="eyebrow mb-1">Pitcher matchup</div>
            <p className="factor-note" style={{ marginTop: 0, marginBottom: "0.6rem" }}>
              <strong style={{ color: "#ffd9d6" }}>K</strong> = likely strikeout ·{" "}
              <strong style={{ color: "#bff3d2" }}>C</strong> = likely hit (contact) ·{" "}
              <strong style={{ color: "#c5d6e8" }}>N</strong> = neutral
            </p>
            <div className="lineup-row" style={{ borderBottom: 0, padding: 0 }}>
              <span className="bname">
                <Link
                  href={`/player/k/${r.vs.player_id ?? encodeURIComponent(r.vs.name)}${navQ}`}
                  className="linklike"
                >
                  {r.vs.name}
                </Link>{" "}
                <span className="hand">{pitLabel(r.vs.throws)}</span>
              </span>
              <MatchupSphere lean={pick(r.vs.lean, r.vs.lean_hist)} prob={pick(r.vs.prob, r.vs.prob_hist)} />
            </div>
            {r.vs.bvp && r.vs.bvp.pa > 0 ? (
              <p className="factor-note" style={{ marginBottom: 0 }}>
                Career vs {r.vs.name}: <strong style={{ color: "var(--text)" }}>{r.vs.bvp.hits}-for-{r.vs.bvp.ab}</strong>
                {r.vs.bvp.hr > 0 && <> · <strong style={{ color: "var(--text)" }}>{r.vs.bvp.hr} HR</strong></>}
                {" "}· {r.vs.bvp.k} K
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
  const displayKs = pick(r.expected_ks, r.expected_ks_hist);
  const displayOverProb = pick(r.over_prob, r.over_prob_hist);
  const scale = Math.max(r.line + 3, displayKs + 1);
  const over = displayKs > r.line;
  return (
    <main className="mx-auto max-w-2xl px-5 py-14 space-y-6">
      <Back prop={prop} date={date} hist={hist} />
      <div className="rise">
        <p className="eyebrow mb-1">{r.team}{r.throws ? ` · ${pitLabel(r.throws)}` : ""} · Strikeouts{gameTimeLabel(r.game_time) ? ` · 🕐 ${gameTimeLabel(r.game_time)}` : ""}</p>
        <h1 className="wordmark" style={{ fontSize: "clamp(1.8rem,5vw,2.6rem)" }}>
          <span className="lo">{r.player}</span>
        </h1>
      </div>

      <div className="panel rise flex flex-wrap gap-10" style={{ animationDelay: "60ms" }}>
        <Stat value={pct(displayOverProb)} label={`over ${r.line} Ks`} glow />
        <Stat value={displayKs.toFixed(1)} label="projected Ks" />
      </div>

      <div className="panel rise" style={{ animationDelay: "120ms" }}>
        <div className="eyebrow mb-3">Projection vs the line</div>
        <div style={{ position: "relative", height: "12px", background: "rgba(120,200,150,0.08)", borderRadius: 999 }}>
          <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(displayKs / scale) * 100}%`, background: over ? "var(--green)" : "var(--red)", borderRadius: 999 }} />
          <span style={{ position: "absolute", left: `${(r.line / scale) * 100}%`, top: -4, bottom: -4, width: "2px", background: "var(--text)" }} title="the line" />
        </div>
        <p className="factor-note">
          We project <strong style={{ color: "var(--text)" }}>{displayKs.toFixed(1)} Ks</strong>; the line is{" "}
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
            <strong style={{ color: "#bff3d2" }}>C</strong> = likely hit (contact) ·{" "}
              <strong style={{ color: "#c5d6e8" }}>N</strong> = neutral
          </p>
          <div className="lineup">
            {r.matchups.map((m, i) => (
              <div className="lineup-row" key={m.player_id ?? m.name}>
                <span className="ord">{i + 1}</span>
                <span className="bname">
                  <Link
                    href={`/player/hr/${m.player_id ?? encodeURIComponent(m.name)}${navQ}`}
                    className="linklike"
                  >
                    {m.name}
                  </Link>{" "}
                  <span className="hand">{batLabel(m.bats)}</span>
                  {m.bvp && m.bvp.pa > 0 && (
                    <span className="hand" title="career vs this pitcher">{m.bvp.hits}-{m.bvp.ab}{m.bvp.hr > 0 ? ` · ${m.bvp.hr} HR` : ""}</span>
                  )}
                </span>
                <MatchupSphere lean={pick(m.lean, m.lean_hist)} prob={pick(m.prob, m.prob_hist)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
