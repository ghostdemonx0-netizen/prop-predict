"use client";

import { useEffect, useState } from "react";
import { loadIndex, loadProjections } from "../../lib/data";
import { LiveProvider } from "../../components/LiveProvider";
import type { LiveGame } from "../../lib/live";
import type { Projections } from "../../lib/types";
// toBoardRows is imported here so later tasks can call it without re-importing.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { toBoardRows } from "../../lib/weighting";

export default function NextPage() {
  const [data, setData] = useState<Projections | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [source, setSource] = useState<"current" | "blend" | "hist">("current");
  const [prop, setProp] = useState<
    "hr" | "k" | "hits" | "tb" | "runs" | "rbi" | "hrr"
  >("hr");
  const [threshold, setThreshold] = useState<{
    hits: 1 | 2 | 3;
    tb: 2 | 3 | 4;
    runs: 1 | 2;
    rbi: 1 | 2;
    hrr: 2 | 3 | 4;
  }>({ hits: 1, tb: 2, runs: 1, rbi: 1, hrr: 2 });
  // player param preserved for future player-detail deeplinks from this skin
  const [player, setPlayer] = useState<string>("");

  // Read URL params and load the date index once on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const want = params.get("date");

    const propParam = params.get("prop");
    if (propParam === "k") setProp("k");
    else if (propParam === "hits") setProp("hits");
    else if (propParam === "tb") setProp("tb");
    else if (propParam === "runs") setProp("runs");
    else if (propParam === "rbi") setProp("rbi");
    else if (propParam === "hrr") setProp("hrr");

    // Restore threshold from back-link query params.
    const tp = params.get("threshold");
    if (propParam === "hits" && (tp === "1" || tp === "2" || tp === "3")) {
      setThreshold((t) => ({ ...t, hits: Number(tp) as 1 | 2 | 3 }));
    }
    if (propParam === "tb" && (tp === "2" || tp === "3" || tp === "4")) {
      setThreshold((t) => ({ ...t, tb: Number(tp) as 2 | 3 | 4 }));
    }
    if (propParam === "runs" && (tp === "1" || tp === "2")) {
      setThreshold((t) => ({ ...t, runs: Number(tp) as 1 | 2 }));
    }
    if (propParam === "rbi" && (tp === "1" || tp === "2")) {
      setThreshold((t) => ({ ...t, rbi: Number(tp) as 1 | 2 }));
    }
    if (propParam === "hrr" && (tp === "2" || tp === "3" || tp === "4")) {
      setThreshold((t) => ({ ...t, hrr: Number(tp) as 2 | 3 | 4 }));
    }

    const src = params.get("source");
    if (src === "hist") setSource("hist");
    else if (src === "blend") setSource("blend");

    const pl = params.get("player");
    if (pl) setPlayer(pl);

    loadIndex().then((ds) => {
      setDates(ds);
      setSelectedDate(want && ds.includes(want) ? want : ds[0] ?? "");
    });
  }, []);

  // Reload projections whenever the selected date changes.
  useEffect(() => {
    loadProjections(selectedDate || undefined)
      .then(setData)
      .catch(console.error);
  }, [selectedDate]);

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p>loading the board…</p>
      </main>
    );
  }

  // Unique games (id + first-pitch ms) for the live poller's active-window gate.
  // Pattern mirrors app/page.tsx exactly.
  const liveGames: LiveGame[] = Array.from(
    new Map(
      [...data.hr, ...data.strikeouts]
        .filter((r) => r.game_id != null)
        .map((r) => [
          String(r.game_id),
          {
            id: String(r.game_id),
            startMs: r.game_time ? Date.parse(r.game_time) : undefined,
          },
        ])
    ).values()
  );

  return (
    <LiveProvider date={selectedDate} games={liveGames}>
      <div className="sp-scaffold">
        next skin — data loaded: {data ? "yes" : "no"}
      </div>
    </LiveProvider>
  );
}
