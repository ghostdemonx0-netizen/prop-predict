/**
 * HeroTiles.tsx — Header dashboard for the Mock 7 "Spatial Depth" skin.
 *
 * Replaces the old 4 KPI tiles (Slate / Plays / Lineups / Top Edge) with a
 * 4-box header dashboard:
 *
 *   Box 1  — combined stats: Slate | Lineups | Plays scored
 *            (three SIDE-BY-SIDE sections split by two faint VERTICAL --line
 *            dividers, centred → a short/wide box that balances the grid).
 *   Box 2  — Top games (ranked by combined park+weather env boost).
 *   Box 3  — Top batters (ranked by best composite across all batter props;
 *            shows a hand chip after each name, no % — the composite isn't a
 *            meaningful displayable number).
 *   Box 4  — Top pitchers (highest strikeout over-line probability); shows a
 *            hand chip after the name + the K % + the model book K-line
 *            ("O X.XK") to the right of the %.
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
import { HandChip } from "./chips";

// ── Types ────────────────────────────────────────────────────────────────────

/** The three numbers shown in Box 1. */
export interface DashStats {
  /** Today's game count (the old "Slate" value); also the Lineups denominator. */
  games: number;
  /** Number of GAMES whose lineups are confirmed (shown as "confirmed/games"). */
  confirmed: number;
  /** Total props scored across every board (the old "Plays scored" value). */
  plays: number;
}

/** One numbered leaderboard row (Boxes 2–4). */
export interface DashRow {
  /** Matchup ("PIT @ WSH") or player name. */
  name: string;
  /** Primary value shown at the right ("+22%", "63%"). Omitted for batters,
   *  who show a hand chip instead of a (not-meaningful) composite %. */
  value?: string;
  /** Optional secondary value shown to the RIGHT of the primary ("O 4.5K"). */
  sub?: string;
  /** Optional CSS colour for the primary value (env green/amber/red scale). */
  color?: string;
  /** Optional L / R / SW hand chip shown right after the name (batters/pitchers). */
  hand?: "R" | "L" | "SW";
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

/** One numbered leaderboard row (rank + name + optional hand chip + value).
 *  Batters carry a hand chip and no value; pitchers carry a hand chip, a K %
 *  value, and a `sub` ("O X.XK") shown to the right of the %. */
function LeaderRow({ rank, r }: { rank: number; r: DashRow }) {
  return (
    <li className="sp-drow">
      <span className="sp-drank">{rank}</span>
      <span className="sp-dnamewrap">
        <span className="sp-dname">{r.name}</span>
        {r.hand && <HandChip hand={r.hand} />}
      </span>
      {r.value && (
        <span className="sp-dval" style={r.color ? { color: r.color } : undefined}>
          {r.value}
          {r.sub && <small>{r.sub}</small>}
        </span>
      )}
    </li>
  );
}

/**
 * A numbered leaderboard box (Boxes 2–4): header label + up to 6 ranked rows,
 * laid out in TWO columns — ranks 1–3 on the left, ranks 4–6 on the right — so
 * each box is 3 rows tall and 2 wide (balanced).
 */
function LeaderBox({ label, rows }: { label: string; rows: DashRow[] }) {
  const left = rows.slice(0, 3);
  const right = rows.slice(3, 6);
  return (
    <GlassCard className="sp-dbox sp-dbox--lead">
      <div className="sp-dlabel">{label}</div>
      {rows.length === 0 ? (
        <div className="sp-drow-empty">—</div>
      ) : (
        <div className="sp-dcols">
          <ol className="sp-dlist">
            {left.map((r, i) => (
              <LeaderRow key={i} rank={i + 1} r={r} />
            ))}
          </ol>
          {right.length > 0 && (
            <ol className="sp-dlist">
              {right.map((r, i) => (
                <LeaderRow key={i} rank={i + 4} r={r} />
              ))}
            </ol>
          )}
        </div>
      )}
    </GlassCard>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function HeaderDash({ stats, games, batters, pitchers }: HeaderDashProps) {
  return (
    <section className="sp-hero">
      <div className="sp-dash">
        {/* Box 1 — combined stats: three SIDE-BY-SIDE sections split by two
            VERTICAL dividers (short/wide box), centred in its cell. */}
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
              {stats.confirmed}/{stats.games}
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
