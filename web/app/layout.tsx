import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";

// The server sets a static width=600 for phones (below), which is right for
// PORTRAIT. In LANDSCAPE a phone screen is ~844px wide, so forcing 600 blows it
// up. This refines the viewport by orientation on the client: portrait phones
// keep the 600 fit; landscape (and tablets/desktop) use device-width. Runs
// before paint and on every rotation.
const ORIENT_VIEWPORT = `(function(){function set(){try{var phone=Math.min(screen.width,screen.height)<=540;if(!phone)return;var land=window.matchMedia('(orientation: landscape)').matches;var c=land?'width=device-width, initial-scale=1':'width=600';var m=document.querySelector('meta[name="viewport"]');if(m)m.setAttribute('content',c);else{m=document.createElement('meta');m.name='viewport';m.content=c;document.head.appendChild(m);}}catch(e){}}set();window.addEventListener('orientationchange',function(){setTimeout(set,120);});window.addEventListener('resize',function(){setTimeout(set,150);});})();`;
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
// viewport meta STATICALLY in the HTML — so iOS applies it at first paint with
// no JS-timing games. Phones render the whole app at one fixed logical width
// (590px = the widest section, the board table) and the browser scales it to
// fit the screen: uniform "zoom-to-fit", no skew, no manual pinch. Tablets and
// desktop keep the normal device-width layout.
const PHONE_FIT_WIDTH = 600;
export async function generateViewport(): Promise<Viewport> {
  const ua = (await headers()).get("user-agent") || "";
  const isPhone = /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua);
  return isPhone
    ? { width: PHONE_FIT_WIDTH, initialScale: undefined }
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
        <Script id="orient-viewport" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: ORIENT_VIEWPORT }} />
        <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
      </html>
    </ClerkProvider>
  );
}
