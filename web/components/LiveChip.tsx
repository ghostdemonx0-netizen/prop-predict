import type { LiveState } from "../lib/live";

// ───────────────────────────────────────────────────────────────────────────
// LiveChip — the in-game "did it clear?" indicator. Four states:
//   pregame  — game not started yet (neutral grey)
//   live     — in play (steady amber + dot, NO blink)
//   cleared  — hit the line (green); count may EXCEED need, e.g. 2/1, 8/6
//   missed   — game final and short (red)
// ───────────────────────────────────────────────────────────────────────────
export type { LiveState };

const base: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
  fontWeight: 700,
  fontSize: "0.62rem",
  lineHeight: 1,
  padding: "2px 6px",
  borderRadius: 6,
  border: "1px solid var(--line)",
  background: "#0a0e14",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

export function LiveChip({ state, have, need, sm }: { state: LiveState; have: number; need: number; sm?: boolean }) {
  const label = `${have}/${need}`; // true count — not clamped (2/1, 8/6 all valid)
  const s: React.CSSProperties = sm
    ? { ...base, fontSize: "0.5rem", padding: "1px 4px", gap: 3, borderRadius: 5 }
    : base;
  const dot = sm ? 4 : 5;
  if (state === "cleared") {
    return <span style={{ ...s, color: "var(--green)", borderColor: "var(--green)", background: "rgba(62,224,127,0.09)" }}>{label}</span>;
  }
  if (state === "missed") {
    return <span style={{ ...s, color: "#ff6b6b", borderColor: "#5a2b2b", background: "rgba(255,107,107,0.08)" }}>{label}</span>;
  }
  if (state === "live") {
    return (
      <span style={{ ...s, color: "var(--amber, #ffcf5c)", borderColor: "#5a4a1f" }}>
        <span style={{ width: dot, height: dot, borderRadius: "50%", background: "var(--amber, #ffcf5c)" }} />
        {label}
      </span>
    );
  }
  // pregame — neutral grey, no dot, no strike
  return <span style={{ ...s, color: "#7d8aa0", borderColor: "#2b3543" }}>{label}</span>;
}
