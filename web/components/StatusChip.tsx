// Status chips: yellow PROJ (projected/probable) -> green CONF (confirmed).
// `single` shows just the active chip (cards); `pair` shows both with the
// inactive one dimmed (Matchups + Game Hub team lines).
const CONFIRMED = new Set(["confirmed"]);

export function StatusChip({ status, mode = "single" }: { status?: string; mode?: "single" | "pair" }) {
  if (!status) return null; // no status (e.g. legacy data) -> show nothing, never a false PROJ
  const confirmed = CONFIRMED.has(status);
  if (mode === "single") {
    return (
      <span
        className={confirmed ? "chip-conf" : "chip-proj"}
        title={confirmed ? "official lineup confirmed" : "projected from the team's last game — not yet official"}
      >
        {confirmed ? "CONF" : "PROJ"}
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
