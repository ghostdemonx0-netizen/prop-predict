"use client";

export type ViewMode = "cards" | "table" | "hybrid" | "list";
const MODES: ViewMode[] = ["hybrid", "cards", "table", "list"];

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
        <button
          key={m}
          onClick={() => onChange(m)}
          data-active={mode === m}
          className="pill capitalize"
        >
          {m}
        </button>
      ))}
    </div>
  );
}
