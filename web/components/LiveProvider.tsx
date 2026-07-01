"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { BoardRow } from "./PropBoard";
import { deriveLive, isActiveWindow, type LivePayload, type LiveKind, type LiveGame } from "../lib/live";

const EMPTY: LivePayload = { updated: "", games: {}, players: {} };
const Ctx = createContext<LivePayload>(EMPTY);

/** Polls /api/live for real in-game counts. Cost controls: only while a game is
 *  live, paused when the tab is hidden, every 60s. */
export function LiveProvider({ date, games, children }: { date: string; games: LiveGame[]; children: React.ReactNode }) {
  const [payload, setPayload] = useState<LivePayload>(EMPTY);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const gamesKey = games.map((g) => `${g.id}:${g.startMs ?? ""}`).join(",");

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const qs = date ? `?date=${date}` : "";
    const fetchNow = async () => {
      try {
        const r = await fetch(`/api/live${qs}`, { cache: "no-store", signal: ctrl.signal });
        const p = (await r.json()) as LivePayload;
        if (!cancelled) setPayload(p);
      } catch { /* keep last good map on any blip */ }
    };
    const tick = () => {
      if (!document.hidden && isActiveWindow(games, payloadRef.current.games, Date.now())) fetchNow();
    };
    // bootstrap: one fetch if we're already in the game window
    if (isActiveWindow(games, {}, Date.now())) fetchNow();
    const timer = setInterval(tick, 60_000);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, gamesKey]);

  return <Ctx.Provider value={payload}>{children}</Ctx.Provider>;
}

/** Returns a helper that maps a board row + prop kind to its live chip state
 *  (or null when the row has no player id). */
export function useLiveFor() {
  const payload = useContext(Ctx);
  return (row: BoardRow, kind: LiveKind) => {
    const pid = row.player_id != null ? String(row.player_id) : undefined;
    if (!pid) return null;
    const status = row.gameId ? payload.games[row.gameId] : undefined;
    return deriveLive(payload.players[pid], kind, status, row.line);
  };
}
