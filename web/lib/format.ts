export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function windLabel(windOutMph: number): string {
  const v = Math.round(windOutMph);
  if (v > 0) return `${v}mph wind out`;
  if (v < 0) return `${Math.abs(v)}mph wind in`;
  return "calm";
}

export function strengthLabel(prob: number): string {
  if (prob >= 0.25) return "STRONG";
  if (prob >= 0.12) return "Lean";
  return "Pass";
}

export function sortByProb<T>(rows: T[], key: keyof T): T[] {
  return [...rows].sort((a, b) => Number(b[key]) - Number(a[key]));
}
