/**
 * HeroTiles.tsx — Header dashboard for the Mock 7 "Spatial Depth" skin.
 *
 * Replaces the old 4 KPI tiles (Slate / Plays / Lineups / Top Edge) with a
 * 4-box header dashboard:
 *
 *   Box 1  — combined stats: Slate · Lineups · Plays scored
 *            (three stacked sections split by two faint --line dividers).
 *   Box 2  — Top games (ranked by combined park+weather env boost).
 *   Box 3  — Top batters (best composite across all batter props).
 *   Box 4  — Top pitchers (highest strikeout over-line probability).
 *
 * This component is PURELY presentational: every leaderboard + the stat values
 * are computed in app/next/page.tsx (a display aggregation of already-loaded
 * data — no probability/model math happens here) and passed in as props.
 *
 * The default export is kept named `HeaderDash`; `HeroTiles` remains exported as
 * an alias so existing imports keep resolving.
 */
"use client";

import "./spatial.css";
import { GlassCard } from "./GlassCard";

// ── Types ────────────────────────────────────────────────────────────────────

/** The three numbers shown in Box 1. */
export interface DashStats {
  /** Today's game count (the old "Slate" value). */
  games: number;
  /** Confirmed-lineups value (the old "Lineups … confirmed" number). */
  confirmed: number;
  /** Total props scored across every board (the old "Plays scored" value). */
  plays: number;
}

/** One numbered leaderboard row (Boxes 2–4). */
export interface DashRow {
  /** Matchup ("PIT @ WSH") or player name. */
  name: string;
  /** Primary value shown at the right ("+22%", "63%"). */
  value: string;
  /** Optional secondary value under/next to the primary ("6.5 K"). */
  sub?: string;
  /** Optional CSS colour for the primary value (env green/amber/red scale). */
  color?: string;
}

export interface HeaderDashProps {
  stats: DashStats;
  /** Top games by park+weather env boost. */
  games: DashRow[];
  /** Top batters by composite probability across all batter props. */
  batters: DashRow[];
  /** Top pitchers by strikeout over-line probability. */
  pitchers: DashRow[];
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** A numbered leaderboard box (Boxes 2–4): header label + up to 6 ranked rows. */
function LeaderBox({ label, rows }: { label: string; rows: DashRow[] }) {
  return (
    <GlassCard className="sp-dbox sp-dbox--lead">
      <div className="sp-dlabel">{label}</div>
      {rows.length === 0 ? (
        <div className="sp-drow-empty">—</div>
      ) : (
        <ol className="sp-dlist">
          {rows.map((r, i) => (
            <li key={i} className="sp-drow">
              <span className="sp-drank">{i + 1}</span>
              <span className="sp-dname">{r.name}</span>
              <span className="sp-dval" style={r.color ? { color: r.color } : undefined}>
                {r.value}
                {r.sub && <small>{r.sub}</small>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </GlassCard>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function HeaderDash({ stats, games, batters, pitchers }: HeaderDashProps) {
  return (
    <section className="sp-hero">
      <div className="sp-dash">
        {/* Box 1 — combined stats (three sections split by two faint dividers) */}
        <GlassCard className="sp-dbox sp-dbox--stats">
          <div className="sp-dstat">
            <div className="sp-dlabel">Slate</div>
            <div className="sp-dstat-v">
              {stats.games}
              <small>games</small>
            </div>
          </div>
          <div className="sp-dstat">
            <div className="sp-dlabel">Lineups</div>
            <div className="sp-dstat-v">
              {stats.confirmed}
              <small>confirmed</small>
            </div>
          </div>
          <div className="sp-dstat">
            <div className="sp-dlabel">Plays scored</div>
            <div className="sp-dstat-v">
              {stats.plays}
              <small>props</small>
            </div>
          </div>
        </GlassCard>

        {/* Box 2 — top games by park+weather boost */}
        <LeaderBox label="Top games" rows={games} />

        {/* Box 3 — top batters across all batter props */}
        <LeaderBox label="Top batters" rows={batters} />

        {/* Box 4 — top pitchers by strikeout chance */}
        <LeaderBox label="Top pitchers" rows={pitchers} />
      </div>
    </section>
  );
}

/** Back-compat alias so existing `HeroTiles` imports keep resolving. */
export const HeroTiles = HeaderDash;

export default HeaderDash;
