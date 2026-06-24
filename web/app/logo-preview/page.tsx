// TEMPORARY brand-preview page — delete once the owner locks the mark.
// Visit http://localhost:3000/logo-preview
import { PPHex } from "../../components/Marks";

const ORB = "var(--font-orb)";

function Wordmark({ size = "1.7rem" }: { size?: string }) {
  return (
    <span style={{ fontFamily: ORB, fontWeight: 800, fontSize: size, fontStyle: "italic", letterSpacing: "-0.01em" }}>
      <span style={{ color: "var(--text)" }}>Prop </span><span style={{ color: "var(--green)" }}>Predict</span>
    </span>
  );
}

export default function LogoPreview() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "3rem 1.5rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>brand preview · hex chip + PP + cyan bolt · Orbitron wordmark</p>
      <h1 className="wordmark" style={{ marginBottom: "2.5rem" }}>
        <span className="lo">PP </span><span className="hi">logo · round 6</span>
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem", maxWidth: 760 }}>
        {/* header lockup */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div className="eyebrow" style={{ color: "var(--green)" }}>header lockup</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <PPHex size={50} />
            <Wordmark size="1.7rem" />
          </div>
        </div>

        {/* with vs without bolt + crop */}
        <div style={{ display: "flex", gap: "3rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "center" }}>
            <PPHex size={150} bolt />
            <span className="factor-note" style={{ margin: 0 }}>hex + bolt</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "center" }}>
            <PPHex size={150} bolt={false} />
            <span className="factor-note" style={{ margin: 0 }}>hex, no bolt</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "center" }}>
            <div style={{ width: 150, height: 150, borderRadius: 16, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)" }}>
              <PPHex size={120} />
            </div>
            <span className="factor-note" style={{ margin: 0 }}>profile-pic crop</span>
          </div>
        </div>
      </div>
    </main>
  );
}
