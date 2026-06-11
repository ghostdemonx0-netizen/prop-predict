import type { Projections } from "./types";

export async function loadProjections(): Promise<Projections> {
  const res = await fetch("/data/latest.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load projections: ${res.status}`);
  return (await res.json()) as Projections;
}
