import type { PropKind } from "./format";

// ── Live in-game data model ────────────────────────────────────────────────
export type LiveStat = { game: string; h?: number; tb?: number; hr?: number; r?: number; rbi?: number; bk?: number; pk?: number };
export type LivePayload = { updated: string; games: Record<string, string>; players: Record<string, LiveStat> };
export type LiveState = "pregame" | "live" | "cleared" | "missed";
export type LiveKind = PropKind | "contact" | "batterK";
export type LiveGame = { id: string; startMs?: number };

const n = (v: unknown): number => (typeof v === "number" ? v : parseInt(String(v ?? 0), 10) || 0);

/** Total bases = 1B + 2*2B + 3*3B + 4*HR, which equals h + d + 2t + 3hr. */
export function computeTB(h: number, d: number, t: number, hr: number): number {
  return h + d + 2 * t + 3 * hr;
}

/** Per-player live lines for ONE game's boxscore JSON. Players with no batting/pitching
 *  activity are skipped (undefined). */
export function parseBoxscore(gamePk: string, box: any): Record<string, LiveStat> {
  const out: Record<string, LiveStat> = {};
  for (const side of ["away", "home"] as const) {
    const players = box?.teams?.[side]?.players ?? {};
    for (const key of Object.keys(players)) {
      const pl = players[key];
      const pid = String(pl?.person?.id ?? key.replace(/^ID/, ""));
      const bat = pl?.stats?.batting;
      const pit = pl?.stats?.pitching;
      const stat: LiveStat = { game: gamePk };
      let has = false;
      if (bat && (bat.atBats != null || bat.plateAppearances != null || bat.hits != null)) {
        const h = n(bat.hits), d = n(bat.doubles), t = n(bat.triples), hr = n(bat.homeRuns);
        stat.h = h; stat.tb = computeTB(h, d, t, hr); stat.hr = hr; stat.r = n(bat.runs); stat.rbi = n(bat.rbi); stat.bk = n(bat.strikeOuts);
        has = has || h > 0 || d > 0 || t > 0 || hr > 0 || n(bat.runs) > 0 || n(bat.rbi) > 0 || n(bat.strikeOuts) > 0 || n(bat.atBats) > 0 || n(bat.plateAppearances) > 0;
      }
      if (pit && pit.strikeOuts != null) { stat.pk = n(pit.strikeOuts); has = true; }
      if (has) out[pid] = stat;
    }
  }
  return out;
}

/** Merge the schedule's game statuses + all fetched boxscores into the wire payload. */
export function buildPayload(schedule: any, boxes: Record<string, any>, updated: string): LivePayload {
  const games: Record<string, string> = {};
  for (const d of schedule?.dates ?? []) {
    for (const g of d?.games ?? []) {
      games[String(g.gamePk)] = g?.status?.abstractGameState ?? "Preview";
    }
  }
  // Key each stat by `${pid}:${gamePk}` — NOT by pid alone. On a doubleheader
  // the same player id appears in both games' boxscores; a pid-only key would
  // collapse them (Object.assign → last game wins) and bleed one game's stats
  // onto the other game's row. The composite key keeps each game separate.
  const players: Record<string, LiveStat> = {};
  for (const pk of Object.keys(boxes)) {
    const perGame = parseBoxscore(pk, boxes[pk]);
    for (const pid of Object.keys(perGame)) players[`${pid}:${pk}`] = perGame[pid];
  }
  return { updated, games, players };
}

/** Look up a player's live stat for a SPECIFIC game (doubleheader-safe). Stats
 *  are keyed `${pid}:${gameId}`; without a gameId there's no game to resolve, so
 *  the row falls back to pregame (unchanged behavior for rows lacking a game). */
export function statFor(payload: LivePayload, pid: string, gameId?: string): LiveStat | undefined {
  if (!gameId) return undefined;
  return payload.players[`${pid}:${gameId}`];
}

// ── Deriving a chip's state from a live line + the prop's line ──────────────
export function propNeed(kind: LiveKind, line?: string): number {
  if (kind === "k") return Math.floor(parseFloat(line ?? "5.5")) + 1;
  if (kind === "contact" || kind === "batterK" || kind === "hr") return 1;
  const m = kind.match(/(\d)$/);
  return m ? parseInt(m[1], 10) : 1;
}

function haveFor(stat: LiveStat | undefined, kind: LiveKind): number {
  if (!stat) return 0;
  switch (kind) {
    case "hr": return stat.hr ?? 0;
    case "k": return stat.pk ?? 0;
    case "contact": return stat.h ?? 0;
    case "batterK": return stat.bk ?? 0;
    default:
      if (kind.startsWith("hits")) return stat.h ?? 0;
      if (kind.startsWith("tb")) return stat.tb ?? 0;
      if (kind.startsWith("runs")) return stat.r ?? 0;
      if (kind.startsWith("rbi")) return stat.rbi ?? 0;
      if (kind.startsWith("hrr")) return (stat.h ?? 0) + (stat.r ?? 0) + (stat.rbi ?? 0);
      return 0;
  }
}

export function deriveLive(stat: LiveStat | undefined, kind: LiveKind, status: string | undefined, line?: string): { state: LiveState; have: number; need: number } {
  const need = propNeed(kind, line);
  const have = haveFor(stat, kind);
  let state: LiveState;
  if (!status || status === "Preview") state = "pregame";
  else if (have >= need) state = "cleared";
  else if (status === "Final") state = "missed";
  else state = "live";
  return { state, have, need };
}

// ── Polling gate ────────────────────────────────────────────────────────────
/** Poll only while at least one game has started and not every started game is Final. */
export function isActiveWindow(games: LiveGame[], statuses: Record<string, string>, nowMs: number): boolean {
  const started = games.filter((g) => typeof g.startMs === "number" && g.startMs <= nowMs);
  if (started.length === 0) return false;
  return started.some((g) => statuses[g.id] !== "Final");
}
