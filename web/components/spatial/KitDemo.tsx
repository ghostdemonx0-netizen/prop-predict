/**
 * KitDemo.tsx — Visual QA harness for all Mock 7 "Spatial Depth" kit components.
 *
 * Renders every component from the spatial design system so the full kit can be
 * inspected on the /next route.  This is the placeholder body for page.tsx until
 * the real board view is wired up.
 */
"use client";

import "./spatial.css";
import { useState } from "react";

import { CommandBar }       from "./CommandBar";
import { NavDock }          from "./NavDock";
import { HeroTiles }        from "./HeroTiles";
import { ProbabilityOrb }   from "./ProbabilityOrb";
import { CatDot, EnvDot, LeanPair } from "./GlassDot";
import { Badge, TagChip, HandChip, FormChip, FBox, Bvp } from "./chips";
import { SegmentedControl } from "./SegmentedControl";
import { FactorBar }        from "./FactorBar";
import { GlassCard }        from "./GlassCard";
import { LiveChip }         from "./LiveChipSpatial";
import type { NavSection }  from "./NavDock";

// ── Section heading ──────────────────────────────────────────────────────────

function QaHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: "32px 0 12px", display: "flex", alignItems: "center", gap: 12 }}>
      <span className="sp-eyebrow" style={{ whiteSpace: "nowrap" }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
    </div>
  );
}

// ── Demo KPI tiles ───────────────────────────────────────────────────────────

const DEMO_TILES = [
  { label: "Strong edges", value: "12",  sub: "props"  },
  { label: "Avg edge",     value: "+8",  sub: "%"      },
  { label: "Games today",  value: "9",   sub: "slates" },
  { label: "Model conf.",  value: "84",  sub: "%"      },
];

const DEMO_DATES = ["2026-07-02", "2026-07-01", "2026-06-30"];

// ── Main component ───────────────────────────────────────────────────────────

export function KitDemo() {
  const [source, setSource]   = useState<"current" | "blend" | "hist">("current");
  const [section, setSection] = useState<NavSection>("board");
  const [date, setDate]       = useState(DEMO_DATES[0]);
  const [segDemo, setSegDemo] = useState("a");
  const [segGhost, setSegGhost] = useState("x");
  const [segSm, setSegSm]     = useState("p");
  const [segScroll, setSegScroll] = useState("hr");

  return (
    <>
      {/* ── Sticky command bar ──────────────────────────────────── */}
      <CommandBar source={source} onSourceChange={setSource} />

      <main className="sp-wrap" style={{ paddingBottom: 80 }}>

        {/* ── Hero section ──────────────────────────────────────── */}
        <HeroTiles
          dates={DEMO_DATES}
          selectedDate={date}
          onDate={setDate}
          tiles={DEMO_TILES}
        />

        {/* ── Nav dock ──────────────────────────────────────────── */}
        <NavDock section={section} onSection={setSection} />

        {/* ══════════════════════════════════════════════════════════
            Kit Components – Visual QA
            ══════════════════════════════════════════════════════ */}

        {/* ── Probability Orbs ──────────────────────────────────── */}
        <QaHeading>ProbabilityOrb — sizes 80 / 64 / 48, multiple kinds</QaHeading>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <ProbabilityOrb prob={0.34} kind="hr"    size={80} label="HR" />
          <ProbabilityOrb prob={0.55} kind="k"     size={80} label="K"  />
          <ProbabilityOrb prob={0.72} kind="hits1"  size={64} label="H1" />
          <ProbabilityOrb prob={0.44} kind="hits2"  size={64} label="H2" />
          <ProbabilityOrb prob={0.61} kind="tb2"   size={48} label="TB" />
          <ProbabilityOrb prob={0.18} kind="hr"    size={48} />
        </div>

        {/* ── Glass Dots ────────────────────────────────────────── */}
        <QaHeading>CatDot / EnvDot / LeanPair</QaHeading>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <CatDot kind="K" prob={0.42} size={48} />
          <CatDot kind="C" prob={0.31} size={48} />
          <CatDot kind="N" prob={0}    size={48} />
          <EnvDot pct={1.09} size={56} />
          <EnvDot pct={0.93} size={56} />
          <EnvDot pct={1.01} size={56} />
          <LeanPair k={0.42} h={0.28} size={46} />
          <LeanPair k={0.22} h={0.39} size={46} />
          <LeanPair k={0.30} h={0.31} compact />
          <LeanPair k={0.42} h={0.18} compact />
        </div>

        {/* ── Chips ────────────────────────────────────────────── */}
        <QaHeading>Chips — Badge, TagChip, HandChip, FormChip, FBox, Bvp</QaHeading>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Badge kind="strong" />
          <Badge kind="lean"   />
          <Badge kind="pass"   />
          <TagChip status="conf" />
          <TagChip status="proj" />
          <TagChip status="conf" order={3} />
          <HandChip hand="R" />
          <HandChip hand="L" adv />
          <HandChip hand="SW" />
          <FormChip kind="hot"    />
          <FormChip kind="cold"   />
          <FormChip kind="steady" />
          <FBox label="PA" value="4" />
          <FBox icon={<span>⚡</span>} label="K%" value="38%" />
          <Bvp hits={3} ab={8} hr={1} />
          <Bvp hits={0} ab={4} />
        </div>

        {/* ── Segmented Controls ────────────────────────────────── */}
        <QaHeading>SegmentedControl — default / ghost / sm / scroll</QaHeading>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <SegmentedControl
            options={[{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }, { value: "c", label: "Gamma" }]}
            value={segDemo}
            onChange={setSegDemo}
            variant="default"
          />
          <SegmentedControl
            options={[{ value: "x", label: "Current" }, { value: "y", label: "Blend" }, { value: "z", label: "History 3yr" }]}
            value={segGhost}
            onChange={setSegGhost}
            variant="ghost"
          />
          <SegmentedControl
            options={[{ value: "p", label: "1+" }, { value: "q", label: "2+" }, { value: "r", label: "3+" }]}
            value={segSm}
            onChange={setSegSm}
            variant="sm"
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <SegmentedControl
            options={[
              { value: "hr",   label: "Home Run"   },
              { value: "k",    label: "Strikeout"  },
              { value: "hits", label: "Hits"        },
              { value: "tb",   label: "Total Bases" },
              { value: "runs", label: "Runs"        },
              { value: "rbi",  label: "RBI"         },
              { value: "hrr",  label: "H+R+RBI"     },
            ]}
            value={segScroll}
            onChange={setSegScroll}
            scroll
          />
        </div>

        {/* ── Factor Bars ───────────────────────────────────────── */}
        <QaHeading>FactorBar — positive / negative / neutral</QaHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
          <FactorBar label="Park factor"      mult={1.08} note="Coors is a hitter-friendly park" />
          <FactorBar label="Weather"          mult={0.93} note="Wind blowing in, −7% HR env" />
          <FactorBar label="Recent form"      mult={1.00} note="No significant form deviation" />
        </div>

        {/* ── Glass Cards ───────────────────────────────────────── */}
        <QaHeading>GlassCard — flat + tilt</QaHeading>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <GlassCard style={{ padding: 20, minWidth: 180 }}>
            <div className="sp-eyebrow" style={{ marginBottom: 8 }}>Flat card</div>
            <p style={{ fontSize: ".84rem", color: "var(--ink-dim)", margin: 0 }}>
              No interaction, static glass surface.
            </p>
          </GlassCard>
          <GlassCard tilt style={{ padding: 20, minWidth: 180 }}>
            <div className="sp-eyebrow" style={{ marginBottom: 8 }}>Tilt card</div>
            <p style={{ fontSize: ".84rem", color: "var(--ink-dim)", margin: 0 }}>
              Pointer-tracking 3-D tilt + gloss.
            </p>
          </GlassCard>
        </div>

        {/* ── Live Chips ────────────────────────────────────────── */}
        <QaHeading>LiveChip — pregame / live / cleared / missed + sm</QaHeading>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <LiveChip state="pregame" have={0} need={1} />
          <LiveChip state="live"    have={0} need={1} />
          <LiveChip state="cleared" have={1} need={1} />
          <LiveChip state="missed"  have={0} need={1} />
          <LiveChip state="cleared" have={2} need={1} />
          <LiveChip state="live"    have={3} need={6} sm />
          <LiveChip state="cleared" have={8} need={6} sm />
        </div>

      </main>
    </>
  );
}

export default KitDemo;
