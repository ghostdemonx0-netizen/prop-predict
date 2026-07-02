/**
 * SegmentedControl.tsx — Sliding-pill segmented toggle for the Mock 7 "Spatial Depth" skin.
 *
 * Transcribed from mock7.html's .seg / .props CSS and movePill() JS.
 *
 * The pill's left + width are measured from the active button via per-button
 * refs + useLayoutEffect so the animation starts before the first paint.
 * A resize listener re-measures whenever the layout changes.
 *
 * Variants:
 *   "default"  — cyan → violet gradient pill with glow (weighting, view, threshold)
 *   "ghost"    — translucent pill with border  (secondary / overlay controls)
 *   "sm"       — compact font + padding (threshold rows)
 *
 * scroll=true  — wraps in a horizontal-scroll strip and switches the pill to
 *                mint → cyan (the 7-prop selector look from mock7's .props class)
 */
"use client";

import {
  useRef,
  useLayoutEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SegmentedControlOption {
  value: string;
  label: string;
  node?: ReactNode;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (v: string) => void;
  /**
   * "default" = cyan → violet pill (default)
   * "ghost"   = translucent pill with inset border
   * "sm"      = smaller font + padding
   */
  variant?: "default" | "ghost" | "sm";
  /**
   * Wraps the track in a horizontal-scroll strip and switches the pill to the
   * props-selector style (mint → cyan, slightly larger radii).
   * Use for the 7-prop selector.
   */
  scroll?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SegmentedControl({
  options,
  value,
  onChange,
  variant = "default",
  scroll = false,
}: SegmentedControlProps) {
  // Per-button DOM refs, keyed by option value
  const btnRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  // Pill geometry set by measuring the active button
  const [pillGeo, setPillGeo] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  // Read offsetLeft / offsetWidth from the currently active button
  const measure = useCallback(() => {
    const btn = btnRefs.current.get(value);
    if (btn) {
      setPillGeo({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [value]);

  // Fire before paint on every value change; also re-measure on resize
  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Build track class list
  const trackClasses = [
    "sp-seg",
    variant === "ghost" ? "sp-seg--ghost" : null,
    variant === "sm"    ? "sp-seg--sm"    : null,
    scroll              ? "sp-seg--props"  : null,
  ]
    .filter(Boolean)
    .join(" ");

  const track = (
    <div className={trackClasses}>
      {/* Absolutely-positioned pill — CSS transitions handle the animation */}
      <span
        className="sp-seg-pill"
        aria-hidden="true"
        style={{ left: pillGeo.left, width: pillGeo.width }}
      />

      {options.map((opt) => (
        <button
          key={opt.value}
          /* Store / clear the ref in the Map on mount / unmount */
          ref={(el) => {
            if (el) {
              btnRefs.current.set(opt.value, el);
            } else {
              btnRefs.current.delete(opt.value);
            }
          }}
          type="button"
          className={[
            "sp-seg-btn",
            opt.value === value ? "sp-seg-btn--on" : null,
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange(opt.value)}
          aria-pressed={opt.value === value}
        >
          {opt.node ?? opt.label}
        </button>
      ))}
    </div>
  );

  if (scroll) {
    return <div className="sp-seg-scroll">{track}</div>;
  }

  return track;
}

export default SegmentedControl;
