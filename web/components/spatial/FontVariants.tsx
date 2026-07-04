/**
 * FontVariants.tsx — TEMPORARY font-legibility comparison for the Mock 7 skin.
 *
 * The /next skin renders at a 600px logical viewport on phones, so real text ends
 * up small ("zoomed-out"). This page repeats ONE representative UI sample across
 * four font sets, each shown at the real app size AND a ~65%-scaled copy that
 * mimics the phone zoomed-out size, so the user can judge SMALL-SIZE readability.
 *
 * Fonts are loaded here via next/font/google (purely ADDITIVE — this does not touch
 * the app's real fonts in app/layout.tsx). Each set is applied to its sample block
 * via inline CSS vars (--f-disp / --f-body / --f-mono) scoped to that block; the
 * structural styles live in spatial.css under .sp-fontv-*.
 *
 * Delete this component + app/next/fonts/page.tsx once a font set is chosen.
 */
"use client";

import "./spatial.css";
import {
  Bricolage_Grotesque,
  Familjen_Grotesk,
  Spline_Sans_Mono,
  Inter,
  IBM_Plex_Mono,
  Space_Grotesk,
  JetBrains_Mono,
  Manrope,
} from "next/font/google";

// ── font loads (module scope — required by next/font) ─────────────────────────
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"] });
const familjen = Familjen_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const splineMono = Spline_Sans_Mono({ subsets: ["latin"], weight: ["400", "500", "600"] });
const inter = Inter({ subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });
const manrope = Manrope({ subsets: ["latin"] });

// ── the four font sets to compare ─────────────────────────────────────────────
interface FontSet {
  id: string;
  label: string;
  note: string;
  disp: string;
  body: string;
  mono: string;
}

const SETS: FontSet[] = [
  {
    id: "A",
    label: "Set A — Current",
    note: "Bricolage Grotesque · Familjen Grotesk · Spline Sans Mono",
    disp: bricolage.style.fontFamily,
    body: familjen.style.fontFamily,
    mono: splineMono.style.fontFamily,
  },
  {
    id: "B",
    label: "Set B — Inter clean",
    note: "Inter (display + body) · IBM Plex Mono — Inter is very legible small",
    disp: inter.style.fontFamily,
    body: inter.style.fontFamily,
    mono: plexMono.style.fontFamily,
  },
  {
    id: "C",
    label: "Set C — Geometric",
    note: "Space Grotesk · Inter (body) · JetBrains Mono",
    disp: spaceGrotesk.style.fontFamily,
    body: inter.style.fontFamily,
    mono: jetbrainsMono.style.fontFamily,
  },
  {
    id: "D",
    label: "Set D — Warm",
    note: "Manrope (display + body) · IBM Plex Mono",
    disp: manrope.style.fontFamily,
    body: manrope.style.fontFamily,
    mono: plexMono.style.fontFamily,
  },
];

// ── one representative UI sample (the block under test) ───────────────────────
function Sample() {
  return (
    <div className="sp-fontv-sample">
      <div className="sp-fontv-eyebrow">Top Plays</div>
      <div className="sp-fontv-name">Aaron Judge</div>
      <div className="sp-fontv-datarow">MIN @ NYY · 7:05 PM EDT</div>
      <div className="sp-fontv-statrow">
        <span className="sp-fontv-stat">
          64<i>%</i>
        </span>
        <div className="sp-fontv-chips">
          <span className="sp-fontv-chip">HR 0.5</span>
          <span className="sp-fontv-chip sp-fontv-chip--hot">Hot</span>
        </div>
      </div>
      <div className="sp-fontv-statlabel">HR probability · L15 games</div>
    </div>
  );
}

// ── a set = label + real-size sample + ~65% scaled sample ─────────────────────
function SetRow({ set }: { set: FontSet }) {
  const vars = {
    ["--f-disp" as string]: set.disp,
    ["--f-body" as string]: set.body,
    ["--f-mono" as string]: set.mono,
  } as React.CSSProperties;

  return (
    <section className="sp-fontv-set" style={vars}>
      <div className="sp-fontv-sethead">
        <h2 className="sp-fontv-setlabel">{set.label}</h2>
        <p className="sp-fontv-setnote">{set.note}</p>
      </div>
      <div className="sp-fontv-samples">
        <div className="sp-fontv-col">
          <span className="sp-fontv-sizetag">Real app size</span>
          <Sample />
        </div>
        <div className="sp-fontv-col">
          <span className="sp-fontv-sizetag">Phone zoomed-out (~65%)</span>
          <div className="sp-fontv-scalewrap">
            <div className="sp-fontv-scaled">
              <Sample />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FontVariants() {
  return (
    <div className="sp-fontv-page">
      <div className="sp-fontv-head">
        <h1>Font legibility — same UI sample across four font sets</h1>
        <p>
          Each set shows one representative block (eyebrow · player name · mono data row · big % ·
          chips · stat label) at the real app size and a ~65% copy that mimics the small,
          zoomed-out size on phones. The point is to judge <strong>small-size readability</strong>.
        </p>
      </div>
      {SETS.map((s) => (
        <SetRow key={s.id} set={s} />
      ))}
    </div>
  );
}

export default FontVariants;
