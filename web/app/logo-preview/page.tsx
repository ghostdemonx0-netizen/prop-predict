// TEMPORARY brand-preview page — delete once the owner locks the font + mark.
// Visit http://localhost:3000/logo-preview
import { PPChip } from "../../components/Marks";

const fonts = [
  { label: "Space Grotesk — clean / cool", v: "var(--font-sg)" },
  { label: "Chakra Petch — squared / sci-fi / edgy", v: "var(--font-cp)" },
  { label: "Rajdhani — condensed / sporty / techy", v: "var(--font-raj)" },
] as const;

export default function LogoPreview() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "3rem 1.5rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>brand preview · Chip logo + wordmark in 3 techy fonts · pick a vibe</p>
      <h1 className="wordmark" style={{ marginBottom: "2.5rem" }}>
        <span className="lo">PP </span><span className="hi">typography</span>
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem", maxWidth: 720 }}>
        {fonts.map(({ label, v }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingBottom: "1.5rem", borderBottom: "1px solid var(--line)" }}>
            <div className="eyebrow" style={{ color: "var(--green)" }}>{label}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", flexWrap: "wrap" }}>
              <PPChip size={56} font={v} />
              <span style={{ fontFamily: v, fontWeight: 700, fontSize: "2rem", letterSpacing: "-0.01em" }}>
                <span style={{ color: "var(--text)" }}>Prop </span><span style={{ color: "var(--green)" }}>Predict</span>
              </span>
              {/* profile-pic crop */}
              <div style={{ width: 96, height: 96, borderRadius: 14, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)", marginLeft: "auto" }}>
                <PPChip size={74} font={v} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
