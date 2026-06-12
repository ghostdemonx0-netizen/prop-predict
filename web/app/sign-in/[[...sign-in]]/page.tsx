import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-5">
      <div style={{ textAlign: "center" }}>
        <h1 className="wordmark" style={{ fontSize: "2rem" }}>
          <span className="lo">Prop </span><span className="hi">Predict</span>
        </h1>
        <p className="eyebrow" style={{ marginTop: "0.4rem" }}>members only · access by invite</p>
      </div>
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#3ee07f",
            colorBackground: "#0e1613",
            // colorForeground = colorText in older Clerk API
            colorForeground: "#e9f1ec",
            // colorMutedForeground = colorTextSecondary in older Clerk API
            colorMutedForeground: "#87a096",
            // colorInput = colorInputBackground in older Clerk API
            colorInput: "#1d2f26",
            // colorInputForeground = colorInputText in older Clerk API
            colorInputForeground: "#e9f1ec",
            borderRadius: "10px",
          },
          elements: {
            card: { boxShadow: "0 0 40px rgba(62, 224, 127, 0.08)", border: "1px solid rgba(120, 200, 150, 0.14)" },
            footer: { display: "none" },
            formFieldInput: {
              background: "#1d2f26",
              border: "1px solid rgba(62, 224, 127, 0.4)",
            },
            otpCodeFieldInput: {
              background: "#1d2f26",
              border: "1px solid rgba(62, 224, 127, 0.5)",
              color: "#e9f1ec",
              fontSize: "1.25rem",
              fontWeight: 700,
            },
          },
        }}
      />
    </main>
  );
}
