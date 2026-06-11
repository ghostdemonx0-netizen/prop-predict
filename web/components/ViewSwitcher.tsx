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
    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
      {MODES.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 text-sm capitalize ${
            mode === m ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
