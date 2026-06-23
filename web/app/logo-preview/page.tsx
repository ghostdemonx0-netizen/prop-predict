// TEMPORARY logo-comparison page — delete once the owner picks a mark.
// Visit http://localhost:3000/logo-preview
import { PPBadge, PPCircle } from "../../components/Marks";

const cols = [
  { label: "Badge", Mark: PPBadge },
  { label: "Circle", Mark: PPCircle },
] as const;

export default function LogoPreview() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", padding: "3rem 1.5rem" }}>
      <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>brand preview · pick one</p>
      <h1 className="wordmark" style={{ marginBottom: "2rem" }}>
        <span className="lo">PP </span><span className="hi">logo concepts</span>
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5rem", maxWidth: 820 }}>
        {cols.map(({ label, Mark }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: "1.6rem", alignItems: "flex-start" }}>
            <div className="eyebrow" style={{ color: "var(--green)" }}>{label}</div>

            {/* header-size, next to the wordmark */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
              <Mark size={44} />
              <span className="wordmark" style={{ fontSize: "1.5rem" }}>
                <span className="lo">Prop </span><span className="hi">Predict</span>
              </span>
            </div>

            {/* large */}
            <Mark size={160} />

            {/* 400x400 profile-pic crop (scaled to 200 for the page) */}
            <div>
              <div className="factor-note" style={{ margin: "0 0 0.4rem" }}>profile-pic crop (Twitter)</div>
              <div style={{ width: 200, height: 200, borderRadius: 16, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)" }}>
                <Mark size={150} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
