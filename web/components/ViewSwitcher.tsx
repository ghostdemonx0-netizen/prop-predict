"use client";

export type ViewMode = "cards" | "table" | "hybrid" | "list" | "parks" | "hub";
const MODES: ViewMode[] = ["hybrid", "cards", "table", "list", "parks", "hub"];
const LABELS: Record<ViewMode, string> = {
  hybrid: "Hybrid",
  cards: "Cards",
  table: "Table",
  list: "Matchups",
  parks: "Parks",
  hub: "Game Hub",
};

export function ViewSwitcher({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="pillbar">
      {MODES.map((m) => (
        <button key={m} onClick={() => onChange(m)} data-active={mode === m} className="pill">
          {LABELS[m]}
        </button>
      ))}
    </div>
  );
}
