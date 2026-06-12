"use client";

import Link from "next/link";
import type { ViewMode } from "./ViewSwitcher";
import { pct, strengthLabel, strengthTier, heatColor, arrowColor, type PropKind } from "../lib/format";

export type BoardRow = {
  id: string; // stable key: player_id when available, else name
  player: string;
  team: string;
  prob: number; // probability or over_prob
  detail: string; // e.g. "@ COL" or "5.5 Ks"
  href: string;
  matchup?: string; // "AWAY @ HOME" — game grouping for the List view
  projection?: string; // K board: projected strikeouts, e.g. "6.8"
  line?: string; // K board: our book-style line, e.g. "4.5"
  time?: string; // local game start time, e.g. "7:10 PM EDT"
  timeSort?: string; // raw ISO start time, for first-pitch ordering
  hand?: string; // combined card chip, e.g. "RHB vs LHP"
  playerHand?: string; // this player's own handedness (RHB/LHB/SW or RHP/LHP)
  opponent?: { name: string; hand?: string }; // opposing pitcher (+hand) for hitters, or opposing team for pitchers
  windOut?: number; // mph toward center field (+out / -in) — fallback if no direction
  windMph?: number; // true wind speed
  windDir?: number; // direction of travel rel. to CF: 0=out to CF, 90=to RF, 180=in, 270=to LF
  tempF?: number;
  precipPct?: number;
  bvp?: { pa: number; ab: number; hits: number; hr: number; k: number; avg: string } | null;
};

function WeatherChips({ r }: { r: BoardRow }) {
  // Prefer a true directional arrow; fall back to simple out/in if only windOut is known.
  const dir = typeof r.windDir === "number" ? r.windDir : r.windOut !== undefined ? (r.windOut >= 0 ? 0 : 180) : undefined;
  const mph = typeof r.windMph === "number" ? r.windMph : typeof r.windOut === "number" ? Math.abs(r.windOut) : undefined;
  const hasWind = typeof dir === "number" && typeof mph === "number";
  const hasTemp = typeof r.tempF === "number";
  const showRain = (r.precipPct ?? 0) >= 20;
  if (!hasWind && !hasTemp && !showRain) return null;

  const windColor = hasWind ? arrowColor(dir as number) : "var(--amber)";

  return (
    <div className="mt-1.5 flex items-center gap-3" style={{ fontSize: "0.74rem", color: "var(--muted)" }}>
      {hasWind && (
        <span className="inline-flex items-center gap-1" title="wind direction relative to the field (up = out to center)">
          <span
            style={{
              display: "inline-block",
              lineHeight: 1,
              fontWeight: 800,
              transform: `rotate(${dir}deg)`,
              color: windColor,
            }}
          >
            ↑
          </span>
          {Math.round(mph as number)}<span style={{ opacity: 0.6 }}>mph</span>
        </span>
      )}
      {hasTemp && <span>🌡️ {Math.round(r.tempF as number)}°</span>}
      {showRain && <span style={{ color: "#7cc7ff" }}>💧 {r.precipPct}%</span>}
    </div>
  );
}

function HeatSphere({ prob, kind }: { prob: number; kind: PropKind }) {
  const c = heatColor(prob, kind);
  return (
    <span
      className="sphere"
      title="model probability"
      style={{
        background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,0.12), ${c} 60%, rgba(8,14,10,0.65))`,
        borderColor: c,
        color: "#eef3f0",
        textShadow: "0 1px 2px rgba(0,0,0,0.6)",
      }}
    >
      {pct(prob)}
    </span>
  );
}

export function PropBoard({ rows, mode, kind }: { rows: BoardRow[]; mode: ViewMode; kind: PropKind }) {
  if (rows.length === 0) {
    return (
      <div className="panel rise" style={{ textAlign: "center", color: "var(--muted)" }}>
        No plays on the board yet — lineups may not be posted.
      </div>
    );
  }

  const Card = (r: BoardRow, i: number) => (
    <Link
      href={r.href}
      key={r.id}
      className={`card rise s-${strengthTier(r.prob, kind)}`}
      style={{ animationDelay: `${i * 45}ms` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="display" style={{ fontWeight: 700, fontSize: "1.02rem" }}>
          {r.player}
        </span>
        <span className="stat glow" style={{ fontSize: "1.35rem" }}>
          {pct(r.prob)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
        <span className={`badge ${strengthTier(r.prob, kind)}`}>{strengthLabel(r.prob, kind)}</span>
        <span>{r.detail}</span>
        {r.time && <span style={{ opacity: 0.75 }}>🕐 {r.time}</span>}
      </div>
      {(r.playerHand || r.opponent) && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          {r.playerHand && <span className="hand">{r.playerHand}</span>}
          {r.opponent && (
            <span className="inline-flex items-center gap-1.5">
              vs {r.opponent.name}
              {r.opponent.hand && <span className="hand">{r.opponent.hand}</span>}
            </span>
          )}
          {r.bvp && r.bvp.pa > 0 && (
            <span className="hand" title="career history vs this pitcher">
              {r.bvp.hits}-{r.bvp.ab}{r.bvp.hr > 0 ? ` · ${r.bvp.hr} HR` : ""}
            </span>
          )}
        </div>
      )}
      <WeatherChips r={r} />
    </Link>
  );

  const Table = () => (
    <table className="board">
      <thead>
        <tr>
          <th style={{ whiteSpace: "nowrap" }}>Player</th>
          <th style={{ whiteSpace: "nowrap", paddingLeft: 0 }}>Team</th>
          <th style={{ width: "100%" }}>Opponent</th>
          <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Time</th>
          {kind === "k" && (
            <th style={{ textAlign: "center", whiteSpace: "nowrap" }} title="not a sportsbook line — the model sets it from his typical start">
              Model Book Line
            </th>
          )}
          {kind === "k" && <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Proj Ks</th>}
          <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            Probability
            {kind === "k" && (
              <div style={{ fontWeight: 400, opacity: 0.55, fontSize: "0.58rem", letterSpacing: "0.02em", marginTop: 1 }}>
                (over Model Book Line)
              </div>
            )}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td style={{ whiteSpace: "nowrap" }}>
              <Link href={r.href} className="linklike">{r.player}</Link>
              {r.playerHand && <span className="hand" style={{ marginLeft: 6 }}>{r.playerHand}</span>}
            </td>
            <td style={{ color: "var(--muted)", whiteSpace: "nowrap", paddingLeft: 0 }}>{r.team}</td>
            <td style={{ color: "var(--muted)" }}>
              {kind === "k" ? (
                r.opponent && <span>vs {r.opponent.name}</span>
              ) : (
                <>
                  <span>{r.detail}</span>
                  {r.opponent && (
                    <>
                      <span style={{ opacity: 0.45 }}> · </span>
                      {r.opponent.name}
                      {r.opponent.hand && <span className="hand" style={{ marginLeft: 6 }}>{r.opponent.hand}</span>}
                    </>
                  )}
                </>
              )}
            </td>
            <td className="num" style={{ textAlign: "center", whiteSpace: "nowrap", color: "var(--muted)" }}>{r.time}</td>
            {kind === "k" && (
              <td className="num" style={{ textAlign: "center", whiteSpace: "nowrap" }}>{r.line}</td>
            )}
            {kind === "k" && (
              <td className="num" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{r.projection}</td>
            )}
            <td style={{ textAlign: "right" }}>
              <HeatSphere prob={r.prob} kind={kind} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const Row = (r: BoardRow) => {
    // platoon advantage: opposite hands, and switch hitters always have it
    const advantage =
      !!r.playerHand &&
      !!r.opponent?.hand &&
      (r.playerHand === "SW" || r.playerHand[0] !== r.opponent.hand[0]);
    return (
      <Link
        key={r.id}
        href={r.href}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.6rem 0.25rem",
          borderBottom: "1px solid var(--line)",
          color: "var(--text)",
          textDecoration: "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, flexWrap: "wrap" }}>
          {r.player}
          {r.playerHand && (
            <span
              className="hand"
              title={advantage ? "platoon advantage vs this pitcher" : undefined}
              style={
                advantage
                  ? { color: "var(--green)", borderColor: "rgba(62, 224, 127, 0.5)", background: "rgba(62, 224, 127, 0.1)" }
                  : undefined
              }
            >
              {r.playerHand}
            </span>
          )}
        </span>
        <HeatSphere prob={r.prob} kind={kind} />
      </Link>
    );
  };

  const List = () => {
    // Group rows by matchup (rows within a game keep high->low probability
    // order), then order the games by first pitch.
    const groups: { key: string; rows: BoardRow[] }[] = [];
    const seen = new Map<string, number>();
    for (const r of rows) {
      const key = r.matchup ?? "Other";
      if (!seen.has(key)) {
        seen.set(key, groups.length);
        groups.push({ key, rows: [] });
      }
      groups[seen.get(key)!].rows.push(r);
    }
    groups.sort((a, b) => (a.rows[0].timeSort ?? "9999").localeCompare(b.rows[0].timeSort ?? "9999"));

    const Head = (g: { key: string; rows: BoardRow[] }) => (
      <>
        {g.rows[0].time && (
          <span className="num" style={{ float: "right", color: "var(--muted)", fontWeight: 400, fontSize: "0.78rem" }}>
            🕐 {g.rows[0].time}
          </span>
        )}
        {g.key}
      </>
    );

    if (kind === "k") {
      // two pitchers per game — flat list stays readable
      return (
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.6rem" }}>Matchups · first pitch order</div>
          {groups.map((g) => (
            <div key={g.key} className="rise" style={{ marginBottom: "1.1rem" }}>
              <div className="matchup-head">{Head(g)}</div>
              {g.rows.map(Row)}
            </div>
          ))}
        </div>
      );
    }
    // HR side: ~18 hitters per game — collapse each game behind a dropdown
    return (
      <div>
        <div className="eyebrow" style={{ marginBottom: "0.6rem" }}>Matchups · first pitch order</div>
        {groups.map((g) => {
          // split the hitters by side, matching the title's AWAY @ HOME order
          const [away, home] = g.key.split(" @ ");
          const awayRows = g.rows.filter((r) => r.team === away);
          const homeRows = g.rows.filter((r) => r.team === home);
          const split = home !== undefined && awayRows.length + homeRows.length === g.rows.length;
          return (
            <details key={g.key} className="rise" style={{ marginBottom: "0.55rem" }}>
              <summary className="matchup-head" style={{ cursor: "pointer" }}>
                {Head(g)}
                <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "0.78rem", marginLeft: "0.7rem" }}>
                  {g.rows.length} hitters
                </span>
              </summary>
              {split ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  {[
                    { label: `${away} · away`, rs: awayRows, style: { borderRight: "1px solid var(--line-strong)", paddingRight: "0.8rem" } },
                    { label: `${home} · home`, rs: homeRows, style: { paddingLeft: "0.8rem" } },
                  ].map(({ label, rs, style }) => {
                    const opp = rs.find((r) => r.opponent)?.opponent;
                    return (
                      <div key={label} style={style}>
                        <div className="eyebrow" style={{ margin: "0.5rem 0 0.2rem", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
                          <span>{label}</span>
                          {opp && (
                            <span>
                              vs{" "}
                              <span style={{ color: "var(--text)", textShadow: "0 0 8px rgba(62, 224, 127, 0.45)" }}>
                                {opp.name}
                              </span>
                              {opp.hand && <> <span className="hand">{opp.hand}</span></>}
                            </span>
                          )}
                        </div>
                        {rs.map(Row)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                g.rows.map(Row)
              )}
            </details>
          );
        })}
      </div>
    );
  };

  if (mode === "table") return <Table />;
  if (mode === "list") return <List />;
  if (mode === "cards") return <div className="grid gap-2.5 sm:grid-cols-2">{rows.map(Card)}</div>;

  // hybrid: top 3 as glowing cards, the rest in a table
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow" style={{ marginBottom: "0.6rem" }}>★ Top plays</div>
        <div className="grid gap-2.5 sm:grid-cols-3">{top.map(Card)}</div>
      </div>
      {rest.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: "0.4rem" }}>Full board</div>
          <Table />
        </div>
      )}
    </div>
  );
}
