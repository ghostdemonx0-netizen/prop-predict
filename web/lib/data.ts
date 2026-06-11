import type { Projections } from "./types";

export async function loadIndex(): Promise<string[]> {
  const res = await fetch("/data/index.json", { cache: "no-store" });
  if (!res.ok) return [];
  const json = (await res.json()) as { dates?: string[] };
  return json.dates ?? [];
}

export async function loadProjections(date?: string): Promise<Projections> {
  const url = date ? `/data/${date}.json` : "/data/latest.json";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load projections: ${res.status}`);
  return (await res.json()) as Projections;
}
