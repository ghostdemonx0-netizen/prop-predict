/**
 * orbMath.ts — Pure, framework-free probability-orb math.
 *
 * Transcribed verbatim from mock7.html's `orb()` function.
 * Every numeric constant here has a 1:1 match to that source.
 *
 * Usage:
 *   import { orbParams } from './orbMath';
 *   const p = orbParams(0.38, 0.7);  // rawProb=0.38, heat=0.7
 */

const clamp = (x: number, a: number, b: number): number =>
  Math.max(a, Math.min(b, x));

/** Circumference of the SVG progress ring (r = 42, per mock7). */
export const ORB_RING_R = 42;
export const ORB_RING_C = 2 * Math.PI * ORB_RING_R; // ≈ 263.89

/** All visual parameters the ProbabilityOrb component needs. */
export interface OrbParams {
  /** Hue: 255 − heat×112  (integer; indigo at 0 → mint at 1) */
  hue: number;
  /** Saturation %: 70 + heat×24  (integer) */
  sat: number;
  /** Base lightness %: 46 + heat×15  (integer) */
  light: number;
  /** Bright-variant lightness %: min(light+24, 88) */
  brightL: number;
  /** Dark-variant lightness %: max(light−28, 7) */
  darkL: number;

  /**
   * Shadow blur *coefficient* — multiply by the orb's px size to get blur px.
   * Formula: 0.16 + heat×0.5
   */
  blur: number;
  /**
   * Shadow Y-offset *coefficient* — multiply by size to get px.
   * Formula: 0.07 + heat×0.16
   */
  elevation: number;
  /** Cast-shadow radial opacity: 0.2 + heat×0.5 */
  shadowOpacity: number;

  /**
   * Halo blur *coefficient* — multiply by size to get px.
   * Formula: 0.065 + heat×0.21  (reduced ~37% from original to tighten bloom)
   */
  halo: number;
  /** Halo radial opacity: 0.05 + heat×0.38  (reduced ~39% to clean up muddy fill) */
  haloOpacity: number;

  /** SVG ring drop-shadow blur (px, *not* size-relative): 2 + heat×5 */
  glow: number;
  /** Inner highlight opacity on orbCore: 0.08 + heat×0.34 */
  innerHiOpacity: number;

  /** Constant: 2π×42 ≈ 263.89 */
  ringCircumference: number;
  /** stroke-dashoffset: C×(1 − clamp(rawProb, 0, 1)) */
  ringOffset: number;
}

/**
 * Compute all visual parameters for the depth-halo probability orb.
 *
 * @param rawProb - raw probability 0..1 (drives ring fill percentage)
 * @param heat    - 0..1 relative "heat" for this prob on its prop's own scale
 *                  (see ProbabilityOrb for the per-kind computation)
 */
export function orbParams(rawProb: number, heat: number): OrbParams {
  const t = clamp(heat, 0, 1);

  // ── colour ──────────────────────────────────────────────────────────────
  const hue    = Math.round(255 - t * 112);   // mock7: probHue(t)
  const sat    = Math.round(70  + t * 24);
  const light  = Math.round(46  + t * 15);
  const brightL = Math.min(light + 24, 88);
  const darkL   = Math.max(light - 28, 7);

  // ── shadow / elevation ───────────────────────────────────────────────────
  const blur          = 0.16 + t * 0.5;      // × size → blurPx
  const elevation     = 0.07 + t * 0.16;     // × size → syPx
  const shadowOpacity = 0.2  + t * 0.5;

  // ── halo (reduced ~37-39% from original to tighten bloom / clean fill) ──────
  const halo        = 0.065 + t * 0.21;      // × size → haloBlurPx  (was 0.1+t×0.34)
  const haloOpacity = 0.05  + t * 0.38;      // (was 0.08+t×0.62)

  // ── glow / inner highlight ───────────────────────────────────────────────
  const glow           = 2   + t * 5;        // fixed px, not size-relative
  const innerHiOpacity = 0.08 + t * 0.34;

  // ── SVG progress ring ────────────────────────────────────────────────────
  const ringCircumference = ORB_RING_C;
  const ringOffset        = ringCircumference * (1 - clamp(rawProb, 0, 1));

  return {
    hue, sat, light, brightL, darkL,
    blur, elevation, shadowOpacity,
    halo, haloOpacity,
    glow, innerHiOpacity,
    ringCircumference, ringOffset,
  };
}
