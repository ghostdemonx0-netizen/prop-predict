import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono, Space_Grotesk, Chakra_Petch, Rajdhani, Orbitron, Saira } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

// brand-refresh candidates (logo/wordmark) — comparison on /logo-preview
const sg = Space_Grotesk({ variable: "--font-sg", subsets: ["latin"], weight: ["500", "600", "700"] });
const cp = Chakra_Petch({ variable: "--font-cp", subsets: ["latin"], weight: ["600", "700"] });
const raj = Rajdhani({ variable: "--font-raj", subsets: ["latin"], weight: ["600", "700"] });
const orb = Orbitron({ variable: "--font-orb", subsets: ["latin"], weight: ["700", "800", "900"] });
const saira = Saira({ variable: "--font-saira", subsets: ["latin"], weight: ["700", "800"] });

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${display.variable} ${body.variable} ${mono.variable} ${sg.variable} ${cp.variable} ${raj.variable} ${orb.variable} ${saira.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
      </html>
    </ClerkProvider>
  );
}
