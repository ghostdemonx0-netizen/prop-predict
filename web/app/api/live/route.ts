import { buildPayload } from "../../../lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // we set our own CDN cache header below

/** YYYY-MM-DD in America/New_York (the baseball day). */
function etDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = url.searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : etDate();
  try {
    const sched = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`, { cache: "no-store" }).then((r) => r.json());
    const pks: string[] = [];
    for (const d of sched?.dates ?? []) {
      for (const g of d?.games ?? []) {
        const st = g?.status?.abstractGameState;
        if (st === "Live" || st === "Final") pks.push(String(g.gamePk));
      }
    }
    const boxes: Record<string, unknown> = {};
    await Promise.all(pks.map(async (pk) => {
      try {
        boxes[pk] = await fetch(`https://statsapi.mlb.com/api/v1/game/${pk}/boxscore`, { cache: "no-store" }).then((r) => r.json());
      } catch {
        /* skip a failed game — the rest still return */
      }
    }));
    const payload = buildPayload(sched, boxes, new Date().toISOString());
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json", "cache-control": "s-maxage=45, stale-while-revalidate=30" },
    });
  } catch {
    return new Response(JSON.stringify({ updated: new Date().toISOString(), games: {}, players: {} }), {
      headers: { "content-type": "application/json", "cache-control": "s-maxage=15" },
    });
  }
}
