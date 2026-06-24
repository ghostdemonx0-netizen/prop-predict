// TEMPORARY logo-comparison page — delete once the owner locks the mark.
// Visit http://localhost:3000/logo-preview
import { PPChip } from "../../components/Marks";

export default function LogoPreview() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "3rem 1.5rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>brand preview · Chip (refined) · first P white, second P green</p>
      <h1 className="wordmark" style={{ marginBottom: "2.5rem" }}>
        <span className="lo">PP </span><span className="hi">logo</span>
      </h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "3rem", alignItems: "flex-end" }}>
        {/* header size next to wordmark */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <div className="factor-note" style={{ margin: 0 }}>in the header</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <PPChip size={44} />
            <span className="wordmark" style={{ fontSize: "1.6rem" }}>
              <span className="lo">Prop </span><span className="hi">Predict</span>
            </span>
          </div>
        </div>

        {/* large */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <div className="factor-note" style={{ margin: 0 }}>large</div>
          <PPChip size={170} />
        </div>

        {/* profile-pic crop */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <div className="factor-note" style={{ margin: 0 }}>Twitter profile-pic crop</div>
          <div style={{ width: 200, height: 200, borderRadius: 18, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)" }}>
            <PPChip size={150} />
          </div>
        </div>
      </div>
    </main>
  );
}
