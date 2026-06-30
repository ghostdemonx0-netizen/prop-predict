// Status chips: yellow PROJ (projected/probable) -> green CONF (confirmed).
// `single` shows just the active chip (cards); `pair` shows both with the
// inactive one dimmed (Matchups + Game Hub team lines).
const CONFIRMED = new Set(["confirmed"]);

/** Pure label for a single-mode chip: "CONF" / "PROJ", with an optional
 *  batting-order suffix ("·#3"). Returns null when there's no status. Exported
 *  for unit testing without a DOM. */
export function chipLabel(status?: string, order?: number): string | null {
  if (!status) return null;
  const base = CONFIRMED.has(status) ? "CONF" : "PROJ";
  return typeof order === "number" ? `${base}·#${order}` : base;
}

export function StatusChip({ status, order, mode = "single" }: { status?: string; order?: number; mode?: "single" | "pair" }) {
  if (!status) return null; // no status (e.g. legacy data) -> show nothing, never a false PROJ
  const confirmed = CONFIRMED.has(status);
  if (mode === "single") {
    return (
      <span
        className={confirmed ? "chip-conf" : "chip-proj"}
        title={confirmed ? "official lineup confirmed" : "projected from the team's last game — not yet official"}
      >
        {chipLabel(status, order)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`chip-proj ${confirmed ? "chip-off" : ""}`}>PROJ</span>
      <span className={`chip-conf ${confirmed ? "" : "chip-off"}`}>CONF</span>
    </span>
  );
}
