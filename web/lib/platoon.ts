/** True when the batter has the handedness (platoon) edge: opposite hands, or a
 *  switch hitter (who always bats opposite the pitcher). Mirrors the Python
 *  model's batter_advantage. */
export function platoonEdge(bats?: string, throws?: string): boolean {
  const s = (bats || "R").toUpperCase()[0];
  const h = (throws || "R").toUpperCase()[0];
  if (s === "S") return true;
  return s !== h;
}
