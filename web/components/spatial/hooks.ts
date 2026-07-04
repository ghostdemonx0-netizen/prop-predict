/**
 * hooks.ts — Spatial micro-interaction hooks for the Mock 7 "Spatial Depth" skin.
 *
 * useTilt(ref)    — pointer-tracking card tilt + sheen; sets --rx/--ry/--mx/--my
 *                   CSS vars on the element and toggles .sp-lift on hover.
 * useParallax()   — eases the two depth-field glow layers toward the pointer
 *                   via a rAF loop; returns [field1Ref, field2Ref].
 *
 * Both hooks are no-ops on touch devices and when the user has requested
 * reduced motion (prefers-reduced-motion: reduce).
 *
 * Math source: mock7.html's attachTilt() and the parallax rAF loop.
 *   Tilt magnitudes : ±6° (X-axis / py) · ±8° (Y-axis / px)
 *   Parallax offsets: field1 → cx*−26 px · field2 → cx*+16 px
 *   Lerp factor     : 0.06
 */
"use client";

import { useEffect, useRef, type RefObject } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the user prefers reduced motion. Safe to call in useEffect. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Returns true on touch-primary devices (phones/tablets). Used to fully skip
 * the pointer-tracking tilt listeners and the parallax rAF loop, so no
 * per-frame GPU/DOM work runs on phones — where these effects aren't even
 * reachable (no hover pointer) and are the main source of mobile lag.
 */
function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

// ---------------------------------------------------------------------------
// useTilt
// ---------------------------------------------------------------------------

/**
 * Attach pointer-tilt behaviour to the element held by `ref`.
 *
 * On pointermove (non-touch):
 *   --rx  = (py * −6)deg   ← vertical tilt ±6°
 *   --ry  = (px *  8)deg   ← horizontal tilt ±8°
 *   --mx  = (px * 100 + 50)%  ← sheen X position
 *   --my  = (py * 100 + 50)%  ← sheen Y position
 *   .sp-lift is added so the elevated-state styles kick in.
 *
 * On pointerleave: --rx/--ry reset to 0deg, .sp-lift removed.
 *
 * The hook is a no-op when:
 *   • ref.current is null (element not mounted or tilt not requested)
 *   • pointerType === 'touch'
 *   • prefers-reduced-motion: reduce
 */
export function useTilt(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || isTouchDevice()) return;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r  = el.getBoundingClientRect();
      const px = (e.clientX - r.left)  / r.width  - 0.5;
      const py = (e.clientY - r.top)   / r.height - 0.5;
      el.style.setProperty("--rx", (py * -6).toFixed(2) + "deg");
      el.style.setProperty("--ry", (px *  8).toFixed(2) + "deg");
      el.style.setProperty("--mx", (px * 100 + 50).toFixed(1) + "%");
      el.style.setProperty("--my", (py * 100 + 50).toFixed(1) + "%");
      el.classList.add("sp-lift");
    };

    const onLeave = () => {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.classList.remove("sp-lift");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [ref]);
}

// ---------------------------------------------------------------------------
// useParallax
// ---------------------------------------------------------------------------

/**
 * Smoothly translate the two depth-field glow layers toward the pointer.
 *
 * Runs a rAF loop that lerps (cx, cy) toward the normalised pointer position
 * (tx, ty) with factor 0.06, then applies:
 *   field1.style.transform = translate3d(cx*−26 px, cy*−26 px, 0)
 *   field2.style.transform = translate3d(cx*+16 px, cy*+16 px, 0)
 *
 * Returns [field1Ref, field2Ref] — attach these to the two elements in
 * DepthField so the hook can drive them directly.
 *
 * The hook is a no-op on touch devices and with prefers-reduced-motion.
 */
export function useParallax(): [
  RefObject<HTMLDivElement | null>,
  RefObject<HTMLDivElement | null>,
] {
  const field1Ref = useRef<HTMLDivElement>(null);
  const field2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || isTouchDevice()) return;

    let tx = 0, ty = 0, cx = 0, cy = 0;
    let rafId: number;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      tx = e.clientX / innerWidth  - 0.5;
      ty = e.clientY / innerHeight - 0.5;
    };

    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;

      const f1 = field1Ref.current;
      const f2 = field2Ref.current;

      if (f1) {
        f1.style.transform = `translate3d(${(cx * -26).toFixed(2)}px,${(cy * -26).toFixed(2)}px,0)`;
      }
      if (f2) {
        f2.style.transform = `translate3d(${(cx * 16).toFixed(2)}px,${(cy * 16).toFixed(2)}px,0)`;
      }

      rafId = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove as EventListener);
    rafId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("pointermove", onMove as EventListener);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return [field1Ref, field2Ref];
}
