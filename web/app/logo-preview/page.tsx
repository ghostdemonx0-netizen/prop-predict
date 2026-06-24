// TEMPORARY brand-preview page — delete once the owner locks the mark + font.
// Visit http://localhost:3000/logo-preview
import { PPSport, PPSportBolt } from "../../components/Marks";

const fonts = [
  { label: "Orbitron — futuristic / geometric", v: "var(--font-orb)" },
  { label: "Saira — sleek / techy", v: "var(--font-saira)" },
  { label: "Chakra Petch — squared / sci-fi", v: "var(--font-cp)" },
] as const;

export default function LogoPreview() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "3rem 1.5rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>brand preview · advanced fonts · green P out + smaller bolt</p>
      <h1 className="wordmark" style={{ marginBottom: "2.5rem" }}>
        <span className="lo">PP </span><span className="hi">logo · round 4</span>
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: 760 }}>
        {fonts.map(({ label, v }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "1.6rem", flexWrap: "wrap", paddingBottom: "1.5rem", borderBottom: "1px solid var(--line)" }}>
            <div className="eyebrow" style={{ color: "var(--green)", width: "100%" }}>{label}</div>
            {/* with bolt */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", alignItems: "center" }}>
              <PPSportBolt size={120} font={v} />
              <span className="factor-note" style={{ margin: 0 }}>with bolt</span>
            </div>
            {/* no bolt */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", alignItems: "center" }}>
              <PPSport size={120} font={v} />
              <span className="factor-note" style={{ margin: 0 }}>no bolt</span>
            </div>
            {/* header lockup */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <PPSportBolt size={44} font={v} />
              <span style={{ fontFamily: v, fontWeight: 800, fontSize: "1.3rem", fontStyle: "italic" }}>
                <span style={{ color: "var(--text)" }}>Prop </span><span style={{ color: "var(--green)" }}>Predict</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
