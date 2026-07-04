/**
 * GlassDot.tsx — Ringless glass sphere atoms for the Mock 7 "Spatial Depth" skin.
 *
 * Exports: CatDot, EnvDot, LeanPair.
 *
 * Ported from mock7.html's glassDot() / catDot() / envDot() / leanPair() /
 * leanCell() functions, now wearing the same "Deep glass" finish as
 * ProbabilityOrb (neon glowing rim + a dark, deep translucent glass fill) so the
 * dots read as one family — but RINGLESS (these aren't probabilities). The dot:
 *   • No orbShadow / no orbHalo layer
 *   • orbCore fills inset:0 (the full dot area) with the deep-glass fill + neon rim
 *   • No orbRing (no SVG arc)
 *   • Number/letter in IBM Plex Mono, WHITE with a dark halo (see .orbNum)
 * Cheap to render: no backdrop-filter, no blurred halo — just a radial glass
 * gradient + a small neon rim box-shadow + one subtle top gloss.
 *
 * Fixed hues per mock7 (not adjustable):
 *   K = hue  8 (red-ish)
 *   C = hue 150 (mint)
 *   N = hue 224 (blue)
 */
"use client";

import "./spatial.css";
import { orbMono } from "./orbFont";

// ─────────────────────────────────────────────────────────────────────────────
//  Internal helper — compute inline styles for a glassDot at (hue, size, t)
// ─────────────────────────────────────────────────────────────────────────────

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

interface DotStyles {
  wrapper: React.CSSProperties;
  core:    React.CSSProperties;
  num:     React.CSSProperties;
}

// "Deep glass" finish, ringless. Same recipe as ProbabilityOrb's orbCore: a dark,
// deep translucent glass fill (radial, darkens toward the bottom) + a thin inset
// top highlight + a small neon rim box-shadow in the dot's fixed hue. `t` (0..1
// intensity) only lifts saturation/brightness of the rim/glow. The number/letter
// is drawn in white (see .orbNum) for contrast on the dark fill.
function glassDotStyles(hue: number, size: number, t: number): DotStyles {
  const tc  = clamp(t, 0, 1);
  const sat = Math.round(64 + tc * 26);
  const lig = Math.round(46 + tc * 14);

  const brightL = Math.min(lig + 24, 88);
  const rim     = Math.min(brightL + 4, 82);

  return {
    wrapper: { width: size, height: size },
    core: {
      background: `radial-gradient(120% 120% at 50% 36%, hsl(${hue} ${sat}% 20% / .5) 0%, hsl(${hue} ${sat}% 11% / .68) 58%, hsl(${hue} ${sat}% 7% / .82) 100%)`,
      boxShadow: [
        `inset 0 1px 1px hsl(0 0% 100% / .1)`,                   // thin top highlight
        `inset 0 0 0 1.5px hsl(${hue} ${sat}% ${rim}% / .92)`,   // bright neon rim line
        `inset 0 0 6px hsl(${hue} ${sat}% ${brightL}% / .22)`,   // small inner rim glow
        `0 0 8px hsl(${hue} ${sat}% ${brightL}% / .4)`,          // small outer bloom
      ].join(", "),
    },
    num: { fontSize: `${(size * 0.3).toFixed(1)}px`, fontFamily: orbMono.style.fontFamily },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  CatDot — K (red) / C (mint) / N (blue) categorical glass orb
//
//  K / C: shows percentage + letter label in column layout
//  N:     shows "N" only, fixed intensity t=0.34
// ─────────────────────────────────────────────────────────────────────────────

const HUE = { K: 8, C: 150, N: 224 } as const;

export function CatDot({
  kind,
  prob,
  size = 42,
}: {
  kind: "K" | "C" | "N";
  prob: number;
  size?: number;
}) {
  // N: fixed t=0.34 per mock7; K/C: heat scales at p/0.42
  const t  = kind === "N" ? 0.34 : clamp(prob / 0.42, 0, 1);
  const s  = glassDotStyles(HUE[kind], size, t);

  return (
    <span
      className="sp-dot"
      style={s.wrapper}
      title={
        kind === "K"
          ? "strikeout chance, one at-bat"
          : kind === "C"
          ? "hit (contact) chance, one at-bat"
          : "no strong edge"
      }
    >
      {/* Core — near-clear glass sphere body with neon rim + thin top gloss */}
      <span className="orbCore" style={s.core}>
        <span className="orbSpec" />
      </span>
      {/* Label — column layout: "41%" over "K" */}
      <span className="orbNum col" style={s.num}>
        {kind === "N" ? (
          "N"
        ) : (
          <>
            {Math.round(prob * 100)}
            <i>%</i>
            <b>{kind}</b>
          </>
        )}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  EnvDot — park + weather combined environment multiplier
//
//  pct > 1.05 → green (hue 150)
//  pct < 0.95 → red   (hue 8)
//  otherwise  → amber (hue 40)
//  Label: "+8%" / "−3%"
// ─────────────────────────────────────────────────────────────────────────────

function signed(env: number) {
  const v = Math.round((env - 1) * 100);
  return (v >= 0 ? "+" : "") + v + "%";
}

export function EnvDot({ pct, size = 56 }: { pct: number; size?: number }) {
  const b   = pct - 1;
  const hue = b >= 0.05 ? 150 : b <= -0.05 ? 8 : 40;
  const t   = clamp(Math.abs(b) / 0.15, 0.25, 1);
  const s   = glassDotStyles(hue, size, t);

  return (
    <span
      className="sp-dot"
      style={s.wrapper}
      title="park + weather, combined"
    >
      <span className="orbCore" style={s.core}>
        <span className="orbSpec" />
      </span>
      <span className="orbNum col" style={s.num}>
        {signed(pct)}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  LeanPair — pitcher matchup lean visualisation
//
//  compact=false (default / modal): both K + C dots side-by-side
//    + a "◀ leans K" / "leans C ▶" / "● neutral" tag
//  compact=true (hub cell): dominant dot only + small other-side caption below
//    if neutral: N dot + "K__  C__" sub-row
//
//  Props:
//    k        — per-AB strikeout probability
//    h        — per-AB hit (contact) probability
//    lean     — optional override for the lean-tag text (string)
//    size     — dot diameter in px (default 46 full, 40 compact)
//    compact  — switch to the hub-cell variant
// ─────────────────────────────────────────────────────────────────────────────

export function LeanPair({
  k,
  h,
  lean,
  size,
  compact = false,
}: {
  k:        number;
  h:        number;
  lean?:    string;
  size?:    number;
  compact?: boolean;
}) {
  const neutral = Math.abs(k - h) < 0.04;
  const kDom    = k >= h;
  const dotSize = size ?? (compact ? 40 : 46);

  // ── Compact (hub-cell) variant ────────────────────────────────────────────
  if (compact) {
    if (neutral) {
      return (
        <span className="sp-lean-cell">
          <CatDot kind="N" prob={0} size={dotSize} />
          <span className="sp-lean-cell-both">
            <span className="sp-lean-cell-sub sp-lean-cell-sub-k">
              K{Math.round(k * 100)}%
            </span>
            <span className="sp-lean-cell-sub sp-lean-cell-sub-c">
              C{Math.round(h * 100)}%
            </span>
          </span>
        </span>
      );
    }
    return (
      <span className="sp-lean-cell">
        {kDom ? (
          <CatDot kind="K" prob={k} size={dotSize} />
        ) : (
          <CatDot kind="C" prob={h} size={dotSize} />
        )}
        <span
          className="sp-lean-cell-sub"
          style={{ color: kDom ? "hsl(150 70% 72%)" : "hsl(8 90% 76%)" }}
        >
          {kDom ? "C" : "K"} {Math.round((kDom ? h : k) * 100)}%
        </span>
      </span>
    );
  }

  // ── Full (modal) variant — both dots + lean tag ───────────────────────────
  const tagColor = neutral
    ? "hsl(224 40% 78%)"
    : kDom
    ? "hsl(8 90% 78%)"
    : "hsl(150 70% 74%)";

  const tagText = lean
    ? lean
    : neutral
    ? "● neutral"
    : kDom
    ? "◀ leans K"
    : "leans C ▶";

  return (
    <span className="sp-lean-pair">
      <CatDot kind="K" prob={k} size={dotSize} />
      <CatDot kind="C" prob={h} size={dotSize} />
      <span className="sp-lean-tag" style={{ color: tagColor }}>
        {tagText}
      </span>
    </span>
  );
}
