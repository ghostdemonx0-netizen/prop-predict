import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono, Chakra_Petch, Orbitron } from "next/font/google";
import "./globals.css";

// Landscape lock. The server sends a static phone viewport (width=600) that's
// right for portrait but wrong for landscape, where we want plain device-width
// (native, "gets bigger" — like ballparkpal). iOS ignores meta CHANGES made via
// setAttribute, but it does re-read the viewport when the <meta> element is
// REMOVED and a fresh one is appended — so do that on load and on every
// rotation. Portrait phones keep width=600; landscape phones + tablets/desktop
// get device-width.
const ORIENT_VIEWPORT = `(function(){function apply(){try{var s=window.screen;var phone=Math.min(s.width,s.height)<=540;if(!phone)return;var land=window.matchMedia('(orientation: landscape)').matches;var c=land?'width=device-width, initial-scale=1':'width=600';var olds=document.querySelectorAll('meta[name="viewport"]');for(var i=0;i<olds.length;i++){if(olds[i].parentNode)olds[i].parentNode.removeChild(olds[i]);}var m=document.createElement('meta');m.name='viewport';m.setAttribute('content',c);document.head.appendChild(m);}catch(e){}}apply();window.addEventListener('orientationchange',function(){setTimeout(apply,60);setTimeout(apply,300);});window.addEventListener('pageshow',apply);})();`;

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
        <Script id="orient-viewport" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: ORIENT_VIEWPORT }} />
        <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
      </html>
    </ClerkProvider>
  );
}
