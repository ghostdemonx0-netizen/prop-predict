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
 *            shows the top 9 in THREE balanced columns — ranks 1–3 | 4–6 | 7–9 —
 *            each cell being rank + name + hand chip on line 1 and the small team
 *            chip STACKED underneath, no % — the composite isn't a meaningful
 *            displayable number).
 *   Box 4  — Top pitchers (two-step rank: top 6 by PROJECTED strikeouts, then
 *            those 6 ORDERED by over-line probability %); shows a hand chip +
 *            team chip after the name + the proj K as the headline value
 *            ("X.X K") + the over-line probability as a smaller secondary %. On
 *            mobile (≤640px) this box collapses to ONE tight column showing all
 *            5–6 rows; on desktop it shows the full 6 in two columns.
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
import { HandChip, TeamChip } from "./chips";
import { LiveChip } from "./LiveChipSpatial";
import { useLiveFor } from "../LiveProvider";

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
  /** Optional team abbreviation ("SF", "NYY") shown as a muted chip after the
   *  hand chip — rendered on BOTH batter and pitcher leaderboard rows. */
  team?: string;
  /** When true, the hand chip lights up (cyan platoon-advantage glow) — batters
   *  who bat opposite their matchup pitcher's throwing hand. Mirrors the board. */
  adv?: boolean;
  /** MLB person id — set on Top Pitchers rows so the live K tracker can look the
   *  pitcher up via useLiveFor (same hook the board/Top Plays use). */
  playerId?: number;
  /** Unique game key for the live status lookup (Top Pitchers rows). */
  gameId?: string;
  /** The pitcher's model book K line (e.g. "4.5") — feeds the live tracker's
   *  need (Top Pitchers rows). Its presence marks a row as live-K-trackable. */
  line?: string;
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

/** One numbered leaderboard row (rank + full name + optional hand/team chip +
 *  value). Layout:
 *    line 1 — rank + name + hand chip (platoon-advantage glow preserved)
 *    team   — the small team chip sits INLINE after the name (games/pitchers) or
 *             STACKED under it (`stackTeam`, used by Top Batters).
 *  Pitchers additionally carry a proj-K headline value + a `sub` ("%") AND — when
 *  the row is live-K-trackable (`playerId` + `line` present) — the same LiveChip
 *  the board uses for a pitcher's Ks, positioned to the LEFT of the value and fed
 *  by useLiveFor(row, "k"). Names always render in FULL (ellipsise if too long). */
function LeaderRow({
  rank,
  r,
  stackTeam,
}: {
  rank: number;
  r: DashRow;
  /** Drop the team chip onto its own line UNDER the name (Top Batters). */
  stackTeam?: boolean;
}) {
  // Live K tracker — only pitcher rows carry playerId + line; the board's exact
  // hook + chip, reused unchanged (small variant).
  const liveFor = useLiveFor();
  const lv =
    r.playerId != null && r.line != null
      ? liveFor({ player_id: r.playerId, gameId: r.gameId, line: r.line }, "k")
      : null;

  return (
    <li className={`sp-drow${stackTeam ? " sp-drow--stack" : ""}`}>
      <span className="sp-drank">{rank}</span>
      <span className="sp-dnamewrap">
        <span className="sp-dnameline">
          <span className="sp-dname">{r.name}</span>
          {r.hand && <HandChip hand={r.hand} adv={r.adv} />}
        </span>
        {r.team && <TeamChip team={r.team} />}
      </span>
      {r.value && (
        <span className="sp-dval" style={r.color ? { color: r.color } : undefined}>
          {lv && <LiveChip state={lv.state} have={lv.have} need={lv.need} sm />}
          {r.value}
          {r.sub && <small>{r.sub}</small>}
        </span>
      )}
    </li>
  );
}

/**
 * A numbered leaderboard box (Boxes 2–4): header label + ranked rows split into
 * `cols` balanced, column-major columns (each `ceil(rows/cols)` tall):
 *   • 2 columns (default, Top games / Top pitchers) — ranks 1–3 | 4–6.
 *   • 3 columns (Top batters, `cols={3}` + 9 rows) — ranks 1–3 | 4–6 | 7–9.
 *
 * `stackTeam` (Top batters) drops each row's team chip onto its own line UNDER
 * the name (line 1 = rank + name + hand chip; line 2 = team chip).
 *
 * When `mobileStack` is set (Top Pitchers), mobile (≤640px) collapses the two
 * columns into a SINGLE tight column via CSS — both <ol>s stack (ranks 1–3 then
 * 4–6), so all 5–6 pitchers show as one clean full-name column, while desktop
 * still shows all 6 in two columns.
 */
function LeaderBox({
  label,
  rows,
  mobileStack,
  cols = 2,
  stackTeam,
}: {
  label: string;
  rows: DashRow[];
  /** Collapse to a single tight column on mobile (all 5–6 rows visible); keeps
   *  two columns on desktop. Used for Top Pitchers. */
  mobileStack?: boolean;
  /** Number of balanced columns (2 = games/pitchers, 3 = batters). */
  cols?: 2 | 3;
  /** Drop each row's team chip onto its own line UNDER the name (Top Batters). */
  stackTeam?: boolean;
}) {
  // Column-major split: fill column 1 top-to-bottom, then column 2, … so ranks
  // read down each column (1–3 | 4–6 | 7–9). Each column is ceil(rows/cols) tall.
  const perCol = Math.ceil(rows.length / cols) || 1;
  const columns: DashRow[][] = [];
  for (let c = 0; c < cols; c++) {
    columns.push(rows.slice(c * perCol, (c + 1) * perCol));
  }
  return (
    <GlassCard
      className={`sp-dbox sp-dbox--lead${mobileStack ? " sp-dbox--mstack" : ""}${
        stackTeam ? " sp-dbox--stackteam" : ""
      }`}
    >
      <div className="sp-dlabel">{label}</div>
      {rows.length === 0 ? (
        <div className="sp-drow-empty">—</div>
      ) : (
        <div className={`sp-dcols${cols === 3 ? " sp-dcols--3" : ""}`}>
          {columns.map(
            (col, c) =>
              col.length > 0 && (
                <ol className="sp-dlist" key={c}>
                  {col.map((r, i) => (
                    <LeaderRow
                      key={i}
                      rank={c * perCol + i + 1}
                      r={r}
                      stackTeam={stackTeam}
                    />
                  ))}
                </ol>
              ),
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

        {/* Box 3 — top 9 batters across all batter props, THREE balanced
            columns (1–3 | 4–6 | 7–9) with the team chip stacked UNDER each name */}
        <LeaderBox label="Top batters" rows={batters} cols={3} stackTeam />

        {/* Box 4 — top pitchers (top-6-proj pool, ordered by over %); single
            tight column on mobile (5–6 rows), two columns on desktop */}
        <LeaderBox label="Top pitchers" rows={pitchers} mobileStack />
      </div>
    </section>
  );
}

/** Back-compat alias so existing `HeroTiles` imports keep resolving. */
export const HeroTiles = HeaderDash;

export default HeaderDash;
