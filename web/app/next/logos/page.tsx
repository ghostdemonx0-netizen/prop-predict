"use client";

// TEMP logo comparison page — renders all 12 candidate marks next to the wordmark
// so the user can pick. Delete once a logo is chosen.
import { LOGOS_SIGNAL } from "../../../components/spatial/logos/LogosSignal";
import { LOGOS_BALLPARK } from "../../../components/spatial/logos/LogosBallpark";
import { LOGOS_MARK } from "../../../components/spatial/logos/LogosMark";

const SECTIONS = [
  { title: "Signal — data / model (most on-brand)", logos: LOGOS_SIGNAL },
  { title: "Ballpark — baseball / heritage", logos: LOGOS_BALLPARK },
  { title: "Mark — abstract / monogram", logos: LOGOS_MARK },
];

export default function LogosPage() {
  return (
    <div style={{ padding: "34px 20px 80px", maxWidth: 940, margin: "0 auto" }}>
      <h1
        style={{
          fontFamily: "var(--f-disp)",
          fontWeight: 800,
          fontSize: "1.5rem",
          marginBottom: 4,
        }}
      >
        Logo options
      </h1>
      <p style={{ color: "var(--ink-faint)", fontSize: ".8rem", marginBottom: 26 }}>
        Each mark shown at command-bar size next to the wordmark. Pick a name.
      </p>

      {SECTIONS.map((s) => (
        <section key={s.title} style={{ marginBottom: 30 }}>
          <div
            style={{
              fontFamily: "var(--f-mono)",
              fontSize: ".62rem",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              marginBottom: 10,
            }}
          >
            {s.title}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            {s.logos.map(({ name, El }) => (
              <div
                key={name}
                className="sp-float"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 18px",
                  borderRadius: 16,
                }}
              >
                <El size={36} />
                <span
                  className="sp-iristext"
                  style={{
                    fontFamily: "var(--f-disp)",
                    fontWeight: 800,
                    fontSize: "1.16rem",
                    lineHeight: 1,
                  }}
                >
                  Prop Predict
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: ".56rem",
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: "var(--ink-faint)",
                    fontFamily: "var(--f-mono)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
