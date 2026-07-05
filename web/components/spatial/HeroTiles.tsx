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
 *            one flat ranked list that CSS grid reflows column-major: 3 columns
 *            × 3 (top 9 — ranks 1–3 | 4–6 | 7–9) on desktop/landscape, 2 columns
 *            × 5 (top 10 — ranks 1–5 | 6–10) on phone portrait, the 10th row
 *            hidden above 640px. Each cell is rank + name + hand chip on line 1
 *            and the small team chip STACKED underneath, no % — the composite
 *            isn't a meaningful displayable number).
 *   Box 4  — Top pitchers (two-step rank: top 6 by PROJECTED strikeouts, then
 *            those 6 ORDERED by over-line probability %); each row is TWO lines
 *            on every viewport — line 1: rank + name + hand chip + team chip;
 *            line 2 (indented under the name): the live K tracker + the proj K
 *            headline ("X.X K") + the over-line probability as a smaller % — so
 *            the stats never run off the half-width box. Phone portrait (≤640px)
 *            stacks all 6 in ONE column; desktop/landscape shows 2 columns of 3.
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
  /** Today's game count (the "Slate" value). The Lineups denominator is 2× this
   *  (one per team side), so the Lineups stat is distinct from the Slate. */
  games: number;
  /** Number of TEAM lineups confirmed (home + away counted independently), shown
   *  as "confirmed / 2×games" — full slate reads e.g. "30/30". */
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
  /** Target line for this row's header live K tracker — the PROJECTED strikeouts
   *  shown in the box (e.g. "5.7"), so `need` = floor(proj)+1 stays consistent
   *  with the headline. NOT the book line (the board keeps tracking that). Its
   *  presence marks a Top Pitchers row as live-K-trackable. */
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
 * A numbered leaderboard box (Boxes 2–4): header label + ranked rows.
 *
 * Two rendering paths:
 *   • Games / pitchers — rows are pre-split in JS into `cols` balanced,
 *     column-major <ol>s (each `ceil(rows/cols)` tall) — ranks 1–3 | 4–6.
 *   • Top batters (`stackTeam`) — a SINGLE flat ranked <ol.sp-dgrid>; CSS grid
 *     lays it out column-major and reflows by breakpoint (3×3 = top 9 on
 *     desktop/landscape, 2×5 = top 10 on portrait; the 10th is CSS-hidden >640).
 *
 * `stackTeam` (Top batters) also drops each row's team chip onto its own line
 * UNDER the name (line 1 = rank + name + hand chip; line 2 = team chip).
 *
 * When `mobileStack` is set (Top Pitchers), phone portrait (≤640px) collapses
 * the two columns into a SINGLE tight column via CSS — both <ol>s stack (ranks
 * 1–3 then 4–6), so all 5–6 pitchers show as one clean full-name column, while
 * desktop/landscape shows all 6 in two columns.
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
  /** Number of balanced columns for the multi-<ol> games/pitchers path (2). */
  cols?: 2 | 3;
  /** Drop each row's team chip onto its own line UNDER the name (Top Batters). */
  stackTeam?: boolean;
}) {
  // Top Batters (stackTeam): render ONE flat, ranked list and let CSS grid lay
  // it out column-major — 3 cols × 3 (top 9) on desktop/landscape, 2 cols × 5
  // (top 10) on phone portrait, with the 10th row hidden above 640px via CSS.
  // Ranks are 1..N in order; column-major grid flow makes them read down each
  // column, so no per-column JS offset is needed.
  if (stackTeam) {
    return (
      <GlassCard className="sp-dbox sp-dbox--lead sp-dbox--stackteam">
        <div className="sp-dlabel">{label}</div>
        {rows.length === 0 ? (
          <div className="sp-drow-empty">—</div>
        ) : (
          <ol className="sp-dlist sp-dgrid">
            {rows.map((r, i) => (
              <LeaderRow key={i} rank={i + 1} r={r} stackTeam />
            ))}
          </ol>
        )}
      </GlassCard>
    );
  }
  // Column-major split: fill column 1 top-to-bottom, then column 2, … so ranks
  // read down each column (1–3 | 4–6 | 7–9). Each column is ceil(rows/cols) tall.
  const perCol = Math.ceil(rows.length / cols) || 1;
  const columns: DashRow[][] = [];
  for (let c = 0; c < cols; c++) {
    columns.push(rows.slice(c * perCol, (c + 1) * perCol));
  }
  // Games / pitchers path: pre-split multi-<ol> columns (always 2 columns).
  return (
    <GlassCard
      className={`sp-dbox sp-dbox--lead${mobileStack ? " sp-dbox--mstack" : ""}`}
    >
      <div className="sp-dlabel">{label}</div>
      {rows.length === 0 ? (
        <div className="sp-drow-empty">—</div>
      ) : (
        <div className="sp-dcols">
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
              {stats.confirmed}/{stats.games * 2}
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

        {/* Box 3 — top batters across all batter props, team chip stacked UNDER
            each name. CSS grid reflows the single ranked list column-major:
            3 cols × 3 (top 9) on desktop/landscape, 2 cols × 5 (top 10) portrait. */}
        <LeaderBox label="Top batters" rows={batters} stackTeam />

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
