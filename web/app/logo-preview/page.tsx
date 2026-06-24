// TEMPORARY logo-comparison page — delete once the owner picks a mark.
// Visit http://localhost:3000/logo-preview
import { PPChip, PPTerminal, PPEdge } from "../../components/Marks";

const cols = [
  { label: "Chip — hex / data", Mark: PPChip },
  { label: "Terminal — hacker", Mark: PPTerminal },
  { label: "Edge — speed/italic", Mark: PPEdge },
] as const;

export default function LogoPreview() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "3rem 1.5rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>brand preview · round 2 · techy / edgy</p>
      <h1 className="wordmark" style={{ marginBottom: "2rem" }}>
        <span className="lo">PP </span><span className="hi">logo concepts</span>
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2rem", maxWidth: 920 }}>
        {cols.map(({ label, Mark }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: "1.4rem", alignItems: "flex-start" }}>
            <div className="eyebrow" style={{ color: "var(--green)" }}>{label}</div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Mark size={42} />
              <span className="wordmark" style={{ fontSize: "1.2rem" }}>
                <span className="lo">Prop </span><span className="hi">Predict</span>
              </span>
            </div>

            <Mark size={140} />

            <div>
              <div className="factor-note" style={{ margin: "0 0 0.4rem" }}>profile-pic crop</div>
              <div style={{ width: 180, height: 180, borderRadius: 16, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)" }}>
                <Mark size={138} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
