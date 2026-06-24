// TEMPORARY brand-preview page — delete once the owner locks the mark.
// Visit http://localhost:3000/logo-preview
import { PPSport, PPSportBolt } from "../../components/Marks";

const opts = [
  { label: "PP — no lightning", Mark: PPSport },
  { label: "PP — with lightning", Mark: PPSportBolt },
] as const;

export default function LogoPreview() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "3rem 1.5rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>brand preview · bold sporty PP (mix of your 3 refs)</p>
      <h1 className="wordmark" style={{ marginBottom: "2.5rem" }}>
        <span className="lo">PP </span><span className="hi">logo · round 3</span>
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5rem", maxWidth: 760 }}>
        {opts.map(({ label, Mark }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: "1.4rem", alignItems: "flex-start", paddingBottom: "1.5rem", borderRight: "1px solid var(--line)" }}>
            <div className="eyebrow" style={{ color: "var(--green)" }}>{label}</div>

            {/* header size + wordmark */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Mark size={48} />
              <span className="wordmark" style={{ fontFamily: "var(--font-cp)", fontSize: "1.4rem", fontStyle: "italic" }}>
                <span className="lo">Prop </span><span className="hi">Predict</span>
              </span>
            </div>

            {/* large */}
            <Mark size={150} />

            {/* profile-pic crop */}
            <div>
              <div className="factor-note" style={{ margin: "0 0 0.4rem" }}>profile-pic crop</div>
              <div style={{ width: 180, height: 180, borderRadius: 16, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)" }}>
                <Mark size={140} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
