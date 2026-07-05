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
 *   Box 4  — Top pitchers (ranked by PROJECTED strikeouts — most Ks first);
 *            shows a hand chip after the name + the proj K as the headline
 *            value ("X.X K") + the over-line probability as a smaller secondary
 *            %. On mobile (≤640px) this box shows only the TOP 3 (single column,
 *            full names); on desktop it shows the full 6 in two columns.
 *
 * Player names render in FULL on every viewport (mobile + desktop) — long names
 * ellipsise inside the row rather than being abbreviated.
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
  /** Primary/headline value shown at the right ("+22%", "6.3 K"). Omitted for
   *  batters, who show a hand chip instead of a (not-meaningful) composite %. */
  value?: string;
  /** Optional smaller secondary value shown to the RIGHT of the primary — e.g.
   *  a pitcher's over-line probability "%" next to the headline proj-K value. */
  sub?: string;
  /** Optional CSS colour for the primary value (env green/amber/red scale). */
  color?: string;
  /** Optional L / R / SW hand chip shown right after the name (batters/pitchers). */
  hand?: "R" | "L" | "SW";
  /** When true, the hand chip lights up (cyan platoon-advantage glow) — batters
   *  who bat opposite their matchup pitcher's throwing hand. Mirrors the board. */
  adv?: boolean;
}

export interface HeaderDashProps {
  stats: DashStats;
  /** Top games by park+weather env boost. */
  games: DashRow[];
  /** Top batters by composite probability across all batter props. */
  batters: DashRow[];
  /** Top pitchers by projected strikeouts (most Ks first). */
  pitchers: DashRow[];
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** One numbered leaderboard row (rank + full name + optional hand chip + value).
 *  Batters carry a hand chip and no value; pitchers carry a hand chip, a proj-K
 *  headline value, and a `sub` (over-line "%") shown to the right of it. Names
 *  always render in FULL (they ellipsise if too long — never abbreviated). */
function LeaderRow({ rank, r }: { rank: number; r: DashRow }) {
  return (
    <li className="sp-drow">
      <span className="sp-drank">{rank}</span>
      <span className="sp-dnamewrap">
        <span className="sp-dname">{r.name}</span>
        {r.hand && <HandChip hand={r.hand} adv={r.adv} />}
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
 *
 * When `mobileTop3` is set (Top Pitchers), mobile (≤640px) hides the right
 * column and collapses to a single column via CSS — so only the top 3 show, as
 * one clean full-name column, while desktop still shows all 6 in two columns.
 */
function LeaderBox({
  label,
  rows,
  mobileTop3,
}: {
  label: string;
  rows: DashRow[];
  /** Show only the top 3 (single column) on mobile; full 6 on desktop. */
  mobileTop3?: boolean;
}) {
  const left = rows.slice(0, 3);
  const right = rows.slice(3, 6);
  return (
    <GlassCard
      className={`sp-dbox sp-dbox--lead${mobileTop3 ? " sp-dbox--mtop3" : ""}`}
    >
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

        {/* Box 3 — top batters across all batter props (full 6 on both) */}
        <LeaderBox label="Top batters" rows={batters} />

        {/* Box 4 — top pitchers by projected Ks (top 3 on mobile, 6 on desktop) */}
        <LeaderBox label="Top pitchers" rows={pitchers} mobileTop3 />
      </div>
    </section>
  );
}

/** Back-compat alias so existing `HeroTiles` imports keep resolving. */
export const HeroTiles = HeaderDash;

export default HeaderDash;
