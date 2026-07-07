/**
 * Source-aware weighting helpers shared across all prop boards.
 *
 * Extracted from app/page.tsx so the mock-7 reskin (and future pages) can
 * import the same logic without duplicating it.
 *
 * DO NOT add React or Next.js imports here — this file is intentionally
 * framework-neutral so it can be tested in a plain Node/vitest environment.
 */

import type { Projections, Matchup } from "./types";
import type { PropKind } from "./format";
import { gameTimeLabel } from "./format";
import type { BoardRow } from "../components/PropBoard";

export type Source = "current" | "blend" | "hist";

/**
 * Spatial-side row: BoardRow (from PropBoard, which we must not edit) plus a
 * derived recent-form indicator the mock-7 cards render as a FormChip.
 * Batter props carry it (from recent_form_mult); pitcher (K) rows leave it
 * undefined so no chip renders.
 */
export type SpatialRow = BoardRow & { form?: "hot" | "cold" | "steady" };

/**
 * Map a recent-form multiplier to a hot/cold/steady tier.
 *
 * Shared across every mock-7 surface so the FormChip is derived identically
 * everywhere: hot when the mult clears 1.03, cold when it drops below 0.97,
 * steady in between. Returns undefined when the mult is missing (no chip) —
 * pitcher (K) rows leave it undefined so no chip renders.
 */
export function formTier(
  recentFormMult?: number,
): "hot" | "cold" | "steady" | undefined {
  if (typeof recentFormMult !== "number") return undefined;
  return recentFormMult > 1.03 ? "hot" : recentFormMult < 0.97 ? "cold" : "steady";
}

// ---------------------------------------------------------------------------
// Private display helpers (copied verbatim from app/page.tsx top-level fns)
// ---------------------------------------------------------------------------

function batHand(b?: string) {
  return b === "L" ? "LHB" : b === "S" ? "SW" : b ? "RHB" : undefined;
}
function pitchHand(t?: string) {
  return t === "L" ? "LHP" : t ? "RHP" : undefined;
}
function oppTeam(matchup?: string, team?: string) {
  const parts = matchup?.split(" @ ");
  if (!parts || parts.length !== 2) return undefined;
  const [away, home] = parts;
  return team === home ? away : home;
}
function gameLabel(matchup?: string, team?: string) {
  const parts = matchup?.split(" @ ");
  if (!parts || parts.length !== 2) return undefined;
  const [away, home] = parts;
  return team === home ? `vs ${away}` : `@ ${home}`;
}

// ---------------------------------------------------------------------------
// Core exports
// ---------------------------------------------------------------------------

/**
 * Source-aware probability selector.
 *
 *   current → cur
 *   hist    → hist ?? cur  (falls back to current when hist is absent)
 *   blend   → (cur + hist) / 2 when both present, else cur
 */
export function pickN(
  cur: number | undefined,
  hist: number | undefined,
  source: Source,
): number | undefined {
  if (source === "current") return cur;
  if (source === "hist") return hist ?? cur;
  // blend
  return typeof cur === "number" && typeof hist === "number"
    ? (cur + hist) / 2
    : cur;
}

/**
 * Derive the K/H/NEU matchup lean for a batter's vs-pitcher matchup, applying
 * the selected source weighting.  Returns null when no matchup data is present.
 */
export function leanFor(
  vs: Matchup | undefined,
  source: Source,
): { lean: "K" | "H" | "NEU"; prob: number } | null {
  if (!vs) return null;
  if (source === "current") return { lean: vs.lean, prob: vs.prob };
  if (source === "hist") {
    return vs.lean_hist != null && vs.prob_hist != null
      ? { lean: vs.lean_hist, prob: vs.prob_hist }
      : { lean: vs.lean, prob: vs.prob };
  }
  // blend: recompute lean from blended k/hit probabilities
  const kb = (pickN(vs.k_prob, vs.k_prob_hist, source) ?? vs.k_prob);
  const hb = (pickN(vs.hit_prob, vs.hit_prob_hist, source) ?? vs.hit_prob);
  const lean: "K" | "H" | "NEU" =
    Math.abs(kb - hb) < 0.04 ? "NEU" : kb > hb ? "K" : "H";
  return { lean, prob: Math.max(kb, hb) };
}

/**
 * Map a Projections payload to a sorted array of BoardRow objects for the
 * given prop + threshold + source weighting.
 *
 * Replicates the per-prop mapping blocks in app/page.tsx exactly, including
 * the final sort by displayed probability (descending).
 *
 * Note: hrefs are generated without a date query-string; callers that need
 * date-aware hrefs should append their own dateQ string.
 */
export function toBoardRows(
  data: Projections,
  prop: PropKind,
  threshold: number,
  source: Source,
  barrelEffect: boolean = false,
): SpatialRow[] {
  // Convenience wrappers bound to the requested source.
  const pN = (cur?: number, hist?: number): number =>
    pickN(cur, hist, source) ?? 0;
  const lF = (vs: Matchup | undefined) => leanFor(vs, source);

  let rows: SpatialRow[];

  if (prop === "hr") {
    const curField  = barrelEffect ? "probability_beff" : "probability";
    const histField = barrelEffect ? "probability_hist_beff" : "probability_hist";
    rows = data.hr.map((r) => ({
      id: `${r.player_id ?? r.player}-${r.game_id ?? ""}`,
      player: r.player,
      team: r.team,
      prob: pickN(r[curField] as number | undefined, r[histField] as number | undefined, source) ?? 0,
      detail: gameLabel(r.matchup, r.team) ?? `@ ${r.park}`,
      href: `/player/hr/${r.player_id ?? encodeURIComponent(r.player)}`,
      player_id: r.player_id,
      time: gameTimeLabel(r.game_time),
      timeSort: r.game_time,
      matchup: r.matchup,
      gameId: r.game_id != null ? String(r.game_id) : undefined,
      hand: r.bats
        ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}`
        : undefined,
      playerHand: batHand(r.bats),
      opponent: r.vs
        ? { name: r.vs.name, hand: pitchHand(r.vs.throws) }
        : undefined,
      bvp: r.vs?.bvp,
      lean: lF(r.vs),
      hitProb: r.vs ? pN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
      kProb: r.vs ? pN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
      status: r.lineup_status,
      bat_order: r.bat_order,
      form: formTier(r.recent_form_mult),
      windOut: r.wind_out_mph,
      windMph: r.wind_mph,
      windDir: r.wind_dir,
      tempF: r.temp_f,
      precipPct: r.precip_pct,
    }));
  } else if (prop === "k") {
    rows = data.strikeouts.map((r) => ({
      id: `${r.player_id ?? r.player}-${r.game_id ?? ""}`,
      player: r.player,
      team: r.team,
      prob: pN(r.over_prob, r.over_prob_hist),
      detail: `line ${r.line.toFixed(1)}`,
      projection: (pickN(r.expected_ks, r.expected_ks_hist, source) ?? r.expected_ks).toFixed(1),
      line: r.line.toFixed(1),
      href: `/player/k/${r.player_id ?? encodeURIComponent(r.player)}`,
      player_id: r.player_id,
      time: gameTimeLabel(r.game_time),
      timeSort: r.game_time,
      matchup: r.matchup,
      gameId: r.game_id != null ? String(r.game_id) : undefined,
      hand: pitchHand(r.throws),
      playerHand: pitchHand(r.throws),
      opponent: oppTeam(r.matchup, r.team)
        ? { name: oppTeam(r.matchup, r.team)! }
        : undefined,
      status: r.pitcher_status,
      windOut: r.wind_out_mph,
      windMph: r.wind_mph,
      windDir: r.wind_dir,
      tempF: r.temp_f,
      precipPct: r.precip_pct,
    }));
  } else if (prop === "hits1" || prop === "hits2" || prop === "hits3") {
    const n = threshold as 1 | 2 | 3;
    rows = (data.hits ?? []).map((r) => {
      const base = n === 1 ? r.p_ge1 : n === 2 ? r.p_ge2 : r.p_ge3;
      const hist = n === 1 ? r.p_ge1_hist : n === 2 ? r.p_ge2_hist : r.p_ge3_hist;
      return {
        id: `hits-${r.player_id ?? r.player}-${r.game_id ?? ""}`,
        player: r.player,
        team: r.team,
        prob: pN(base, hist),
        detail: `${n}+ hits`,
        href: `/player/hits/${r.player_id ?? encodeURIComponent(r.player)}`,
        player_id: r.player_id,
        time: gameTimeLabel(r.game_time),
        timeSort: r.game_time,
        matchup: r.matchup,
        gameId: r.game_id != null ? String(r.game_id) : undefined,
        hand: r.bats
          ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}`
          : undefined,
        playerHand: batHand(r.bats),
        opponent: r.vs
          ? { name: r.vs.name, hand: pitchHand(r.vs.throws) }
          : undefined,
        bvp: r.vs?.bvp,
        lean: lF(r.vs),
        hitProb: r.vs ? pN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
        kProb: r.vs ? pN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
        status: r.lineup_status,
        bat_order: r.bat_order,
        form: formTier(r.recent_form_mult),
        windOut: r.wind_out_mph,
        windMph: r.wind_mph,
        windDir: r.wind_dir,
        tempF: r.temp_f,
        precipPct: r.precip_pct,
      };
    });
  } else if (prop === "tb2" || prop === "tb3" || prop === "tb4") {
    const n = threshold as 2 | 3 | 4;
    rows = (data.total_bases ?? []).map((r) => {
      const base = n === 2 ? r.p_ge2 : n === 3 ? r.p_ge3 : r.p_ge4;
      const hist = n === 2 ? r.p_ge2_hist : n === 3 ? r.p_ge3_hist : r.p_ge4_hist;
      return {
        id: `tb-${r.player_id ?? r.player}-${r.game_id ?? ""}`,
        player: r.player,
        team: r.team,
        prob: pN(base, hist),
        detail: `${n}+ bases`,
        href: `/player/tb/${r.player_id ?? encodeURIComponent(r.player)}`,
        player_id: r.player_id,
        time: gameTimeLabel(r.game_time),
        timeSort: r.game_time,
        matchup: r.matchup,
        gameId: r.game_id != null ? String(r.game_id) : undefined,
        hand: r.bats
          ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}`
          : undefined,
        playerHand: batHand(r.bats),
        opponent: r.vs
          ? { name: r.vs.name, hand: pitchHand(r.vs.throws) }
          : undefined,
        bvp: r.vs?.bvp,
        lean: lF(r.vs),
        hitProb: r.vs ? pN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
        kProb: r.vs ? pN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
        status: r.lineup_status,
        bat_order: r.bat_order,
        form: formTier(r.recent_form_mult),
        windOut: r.wind_out_mph,
        windMph: r.wind_mph,
        windDir: r.wind_dir,
        tempF: r.temp_f,
        precipPct: r.precip_pct,
      };
    });
  } else if (prop === "runs1" || prop === "runs2") {
    const n = threshold as 1 | 2;
    rows = (data.runs ?? []).map((r) => {
      const base = n === 1 ? r.p_ge1 : r.p_ge2;
      const hist = n === 1 ? r.p_ge1_hist : r.p_ge2_hist;
      return {
        id: `runs-${r.player_id ?? r.player}-${r.game_id ?? ""}`,
        player: r.player,
        team: r.team,
        prob: pN(base, hist),
        detail: `${n}+ runs`,
        href: `/player/runs/${r.player_id ?? encodeURIComponent(r.player)}`,
        player_id: r.player_id,
        time: gameTimeLabel(r.game_time),
        timeSort: r.game_time,
        matchup: r.matchup,
        gameId: r.game_id != null ? String(r.game_id) : undefined,
        hand: r.bats
          ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}`
          : undefined,
        playerHand: batHand(r.bats),
        opponent: r.vs
          ? { name: r.vs.name, hand: pitchHand(r.vs.throws) }
          : undefined,
        bvp: r.vs?.bvp,
        lean: lF(r.vs),
        hitProb: r.vs ? pN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
        kProb: r.vs ? pN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
        status: r.lineup_status,
        bat_order: r.bat_order,
        form: formTier(r.recent_form_mult),
        windOut: r.wind_out_mph,
        windMph: r.wind_mph,
        windDir: r.wind_dir,
        tempF: r.temp_f,
        precipPct: r.precip_pct,
      };
    });
  } else if (prop === "rbi1" || prop === "rbi2") {
    const n = threshold as 1 | 2;
    rows = (data.rbi ?? []).map((r) => {
      const base = n === 1 ? r.p_ge1 : r.p_ge2;
      const hist = n === 1 ? r.p_ge1_hist : r.p_ge2_hist;
      return {
        id: `rbi-${r.player_id ?? r.player}-${r.game_id ?? ""}`,
        player: r.player,
        team: r.team,
        prob: pN(base, hist),
        detail: `${n}+ RBI`,
        href: `/player/rbi/${r.player_id ?? encodeURIComponent(r.player)}`,
        player_id: r.player_id,
        time: gameTimeLabel(r.game_time),
        timeSort: r.game_time,
        matchup: r.matchup,
        gameId: r.game_id != null ? String(r.game_id) : undefined,
        hand: r.bats
          ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}`
          : undefined,
        playerHand: batHand(r.bats),
        opponent: r.vs
          ? { name: r.vs.name, hand: pitchHand(r.vs.throws) }
          : undefined,
        bvp: r.vs?.bvp,
        lean: lF(r.vs),
        hitProb: r.vs ? pN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
        kProb: r.vs ? pN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
        status: r.lineup_status,
        bat_order: r.bat_order,
        form: formTier(r.recent_form_mult),
        windOut: r.wind_out_mph,
        windMph: r.wind_mph,
        windDir: r.wind_dir,
        tempF: r.temp_f,
        precipPct: r.precip_pct,
      };
    });
  } else {
    // hrr2 | hrr3 | hrr4
    const n = threshold as 2 | 3 | 4;
    rows = (data.hrr ?? []).map((r) => {
      const base = n === 2 ? r.p_ge2 : n === 3 ? r.p_ge3 : r.p_ge4;
      const hist = n === 2 ? r.p_ge2_hist : n === 3 ? r.p_ge3_hist : r.p_ge4_hist;
      return {
        id: `hrr-${r.player_id ?? r.player}-${r.game_id ?? ""}`,
        player: r.player,
        team: r.team,
        prob: pN(base, hist),
        detail: `${n}+ H+R+RBI`,
        href: `/player/hrr/${r.player_id ?? encodeURIComponent(r.player)}`,
        player_id: r.player_id,
        time: gameTimeLabel(r.game_time),
        timeSort: r.game_time,
        matchup: r.matchup,
        gameId: r.game_id != null ? String(r.game_id) : undefined,
        hand: r.bats
          ? `${batHand(r.bats)}${r.vs ? ` vs ${pitchHand(r.vs.throws)}` : ""}`
          : undefined,
        playerHand: batHand(r.bats),
        opponent: r.vs
          ? { name: r.vs.name, hand: pitchHand(r.vs.throws) }
          : undefined,
        bvp: r.vs?.bvp,
        lean: lF(r.vs),
        hitProb: r.vs ? pN(r.vs.hit_prob, r.vs.hit_prob_hist) : undefined,
        kProb: r.vs ? pN(r.vs.k_prob, r.vs.k_prob_hist) : undefined,
        status: r.lineup_status,
        bat_order: r.bat_order,
        form: formTier(r.recent_form_mult),
        windOut: r.wind_out_mph,
        windMph: r.wind_mph,
        windDir: r.wind_dir,
        tempF: r.temp_f,
        precipPct: r.precip_pct,
      };
    });
  }

  // Sort by displayed probability descending (mirrors page.tsx post-mapping sorts)
  rows.sort((a, b) => b.prob - a.prob);
  return rows;
}
