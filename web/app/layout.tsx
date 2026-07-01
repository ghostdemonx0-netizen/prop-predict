import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono, Chakra_Petch, Orbitron } from "next/font/google";
import "./globals.css";

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

// Detect phones server-side (from the request user-agent) and render the
// viewport meta STATICALLY in the HTML — the only mechanism iOS honors (it
// ignores JS viewport changes). Phones get `width=600, maximum-scale=1`:
//  - PORTRAIT (~390px screen): scales the 600 layout DOWN to fit → uniform
//    "zoom-to-fit", no skew, no manual pinch.
//  - LANDSCAPE (~844px screen): fitting 600 would require zooming IN, but
//    maximum-scale=1 caps zoom at 1.0, so the browser falls back to the wider
//    device-width (844) → native, untouched. This is how ONE static meta stays
//    orientation-aware (portrait fits, landscape native) without JS.
// Do NOT add initial-scale (Next adds it by default → forces 100% zoom → lands
// zoomed-in with the right edge cut off). Return initialScale: undefined.
// Tablets/desktop keep device-width.
const PHONE_FIT_WIDTH = 600;
export async function generateViewport(): Promise<Viewport> {
  const ua = (await headers()).get("user-agent") || "";
  const isPhone = /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua);
  return isPhone
    ? { width: PHONE_FIT_WIDTH, initialScale: undefined, maximumScale: 1 }
    : { width: "device-width", initialScale: 1 };
}

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
        <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
      </html>
    </ClerkProvider>
  );
}
