import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono, Chakra_Petch, Orbitron } from "next/font/google";
import "./globals.css";
import { FitViewport } from "../components/FitViewport";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// brand: Chakra Petch = PP monogram letters; Orbitron = wordmark
const cp = Chakra_Petch({ variable: "--font-cp", subsets: ["latin"], weight: ["600", "700"] });
const orb = Orbitron({ variable: "--font-orb", subsets: ["latin"], weight: ["700", "800", "900"] });

const body = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Prop Predict",
  description: "MLB player prop projections",
};

// Render at the phone's real width instead of a scaled-down ~980px desktop canvas.
// (Fixes the mobile zoom-to-read / skewed pills / off-screen tables.)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${display.variable} ${body.variable} ${mono.variable} ${cp.variable} ${orb.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col" suppressHydrationWarning><FitViewport />{children}</body>
      </html>
    </ClerkProvider>
  );
}
