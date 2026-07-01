"use client";
import { useEffect } from "react";

/**
 * On phones, render the layout at one fixed logical width and let the browser
 * scale it to fit the screen — the "zoomed-out that fits" view.
 *
 * Why: the Game Hub batter breakdown is ~514px wide. With a normal
 * device-width viewport the browser balloons the viewport to fit that grid and
 * scales everything else down inconsistently (skewed pills, empty gaps, needing
 * to pinch). Pinning the viewport to the widest section's width makes the whole
 * app render at one uniform scale — Game Hub fits, and every other view fills
 * the same width. Tablets/desktop keep device-width (they're wide enough).
 */
const FIT_WIDTH = 520;

export function FitViewport() {
  useEffect(() => {
    const vp = document.querySelector('meta[name="viewport"]');
    if (!vp) return;
    const apply = () => {
      const s = window.screen;
      const phone = Math.min(s?.width || 9999, s?.height || 9999) <= 540;
      vp.setAttribute(
        "content",
        phone ? `width=${FIT_WIDTH}` : "width=device-width, initial-scale=1",
      );
    };
    apply();
    window.addEventListener("orientationchange", apply);
    return () => window.removeEventListener("orientationchange", apply);
  }, []);
  return null;
}
