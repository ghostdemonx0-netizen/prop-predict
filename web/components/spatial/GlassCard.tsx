/**
 * GlassCard.tsx — Floating glass-panel primitive for the Mock 7 "Spatial Depth" skin.
 *
 * Implements mock7.html's .float glass surface — gradient glass fill, --line-2
 * border, ambient + contact shadow, inset top highlight, backdrop blur/saturate,
 * and a ::after top-gloss highlight.
 *
 * When `tilt` is true, the card also gains:
 *   • .sp-tilt — pointer-tracking 3-D perspective rotation via CSS vars
 *                --rx / --ry (set by useTilt)
 *   • .sp-sheen — radial gloss that follows the pointer (--mx / --my)
 *   • .sp-lift-layer — inner wrapper that translateZ(34px)-pops the content
 *
 * Usage:
 *   <GlassCard>plain glass panel</GlassCard>
 *   <GlassCard tilt>tilt-interactive card</GlassCard>
 *   <GlassCard tilt className="p-4" style={{ maxWidth: 320 }}>…</GlassCard>
 */
"use client";

import {
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTilt } from "./hooks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GlassCardProps {
  /**
   * Enable pointer-tilt + sheen interaction.
   * Automatically disabled on touch and when prefers-reduced-motion is set.
   */
  tilt?: boolean;

  /** Extra class names merged onto the root element. */
  className?: string;

  /** Inline styles applied to the root element. */
  style?: CSSProperties;

  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GlassCard({
  tilt = false,
  className,
  style,
  children,
}: GlassCardProps) {
  // useTilt must be called unconditionally (rules of hooks).
  // When tilt=false we don't attach the ref to a DOM node, so ref.current
  // stays null and useTilt becomes a no-op.
  const cardRef = useRef<HTMLDivElement>(null);
  useTilt(cardRef);

  // Build class list
  const classes = ["sp-float", tilt ? "sp-tilt" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={tilt ? cardRef : undefined}
      className={classes}
      style={style}
    >
      {/* Pointer-tracking gloss — visible only while the card is sp-lift */}
      {tilt && <span className="sp-sheen" aria-hidden="true" />}

      {/* Content elevation — translateZ(34px) pops the inner content forward */}
      {tilt ? (
        <div className="sp-lift-layer">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

export default GlassCard;
