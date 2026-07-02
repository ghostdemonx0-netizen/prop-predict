/**
 * orbMath.test.ts
 *
 * Asserts that orbParams() transcribes mock7's exact formulas.
 * Expected values were derived by hand from the orb() function in
 * .superpowers/design-library/mock7.html.
 */
import { describe, it, expect } from "vitest";
import { orbParams, ORB_RING_C } from "../orbMath";

// ── constants ─────────────────────────────────────────────────────────────────
// 2π × 42 (r=42, per mock7 SVG viewBox 0 0 100 100)
const C = ORB_RING_C; // ≈ 263.8938...

// ── hue (most critical formula: hue = 255 − heat×112) ────────────────────────
describe("orbParams → hue", () => {
  it("is 255 at heat=0 (coolest / indigo)", () => {
    expect(orbParams(0.5, 0).hue).toBe(255);
    expect(orbParams(0.1, 0).hue).toBe(255);
  });

  it("is 143 at heat=1 (hottest / mint) — 255−112", () => {
    expect(orbParams(0.5, 1).hue).toBe(143);
    expect(orbParams(0.9, 1).hue).toBe(143);
  });

  it("interpolates linearly between 255 and 143", () => {
    // heat=0.5 → Math.round(255 − 0.5×112) = Math.round(199) = 199
    expect(orbParams(0.5, 0.5).hue).toBe(199);
  });
});

// ── saturation & lightness ────────────────────────────────────────────────────
describe("orbParams → sat / light", () => {
  it("sat=70 at heat=0, sat=94 at heat=1  (70+heat×24)", () => {
    expect(orbParams(0.5, 0).sat).toBe(70);
    expect(orbParams(0.5, 1).sat).toBe(94);
  });

  it("light=46 at heat=0, light=61 at heat=1  (46+heat×15)", () => {
    expect(orbParams(0.5, 0).light).toBe(46);
    expect(orbParams(0.5, 1).light).toBe(61);
  });

  it("brightL = min(light+24, 88)", () => {
    // heat=0: light=46  → brightL=min(70,88)=70
    expect(orbParams(0.5, 0).brightL).toBe(70);
    // heat=1: light=61  → brightL=min(85,88)=85
    expect(orbParams(0.5, 1).brightL).toBe(85);
  });

  it("darkL = max(light−28, 7)", () => {
    // heat=0: light=46  → darkL=max(18,7)=18
    expect(orbParams(0.5, 0).darkL).toBe(18);
    // heat=1: light=61  → darkL=max(33,7)=33
    expect(orbParams(0.5, 1).darkL).toBe(33);
  });
});

// ── blur / halo increase monotonically with heat ──────────────────────────────
describe("orbParams → blur & halo monotonically increase with heat", () => {
  it("blur at heat=1 > blur at heat=0", () => {
    // heat=0: 0.16; heat=1: 0.66
    expect(orbParams(0.5, 1).blur).toBeGreaterThan(orbParams(0.5, 0).blur);
  });

  it("blur exact values: 0.16 at heat=0, 0.66 at heat=1", () => {
    expect(orbParams(0.5, 0).blur).toBeCloseTo(0.16, 10);
    expect(orbParams(0.5, 1).blur).toBeCloseTo(0.66, 10);
  });

  it("halo at heat=1 > halo at heat=0", () => {
    // heat=0: 0.065; heat=1: 0.275  (reduced ~37% from original to tighten bloom)
    expect(orbParams(0.5, 1).halo).toBeGreaterThan(orbParams(0.5, 0).halo);
  });

  it("halo exact values: 0.065 at heat=0, 0.275 at heat=1  (0.065+heat×0.21)", () => {
    expect(orbParams(0.5, 0).halo).toBeCloseTo(0.065, 10);
    expect(orbParams(0.5, 1).halo).toBeCloseTo(0.275, 10);
  });

  it("glow: 2 at heat=0, 7 at heat=1", () => {
    expect(orbParams(0.5, 0).glow).toBeCloseTo(2, 10);
    expect(orbParams(0.5, 1).glow).toBeCloseTo(7, 10);
  });
});

// ── shadow / elevation ────────────────────────────────────────────────────────
describe("orbParams → shadow opacity & elevation", () => {
  it("shadowOpacity: 0.2 at heat=0, 0.7 at heat=1", () => {
    expect(orbParams(0.5, 0).shadowOpacity).toBeCloseTo(0.2, 10);
    expect(orbParams(0.5, 1).shadowOpacity).toBeCloseTo(0.7, 10);
  });

  it("elevation: 0.07 at heat=0, 0.23 at heat=1", () => {
    expect(orbParams(0.5, 0).elevation).toBeCloseTo(0.07, 10);
    expect(orbParams(0.5, 1).elevation).toBeCloseTo(0.23, 10);
  });
});

// ── halo opacity ─────────────────────────────────────────────────────────────
describe("orbParams → haloOpacity", () => {
  it("0.05 at heat=0, 0.43 at heat=1  (0.05+heat×0.38 — reduced ~39% to clean fill)", () => {
    expect(orbParams(0.5, 0).haloOpacity).toBeCloseTo(0.05, 10);
    expect(orbParams(0.5, 1).haloOpacity).toBeCloseTo(0.43, 10);
  });
});

// ── ring offset (controls arc fill) ──────────────────────────────────────────
describe("orbParams → ringOffset differs for rawProb 0 vs 1", () => {
  it("ringCircumference is always 2π×42", () => {
    expect(orbParams(0.5, 0.5).ringCircumference).toBeCloseTo(C, 5);
  });

  it("ringOffset at rawProb=0 equals full circumference (ring empty)", () => {
    // C × (1 − 0) = C
    expect(orbParams(0, 0.5).ringOffset).toBeCloseTo(C, 5);
  });

  it("ringOffset at rawProb=1 is 0 (ring fully filled)", () => {
    // C × (1 − 1) = 0
    expect(orbParams(1, 0.5).ringOffset).toBeCloseTo(0, 10);
  });

  it("ringOffset at rawProb=0 !== ringOffset at rawProb=1", () => {
    const lo = orbParams(0, 0.5).ringOffset;
    const hi = orbParams(1, 0.5).ringOffset;
    expect(lo).not.toBe(hi);
  });

  it("ringOffset at rawProb=0.5 is C/2", () => {
    expect(orbParams(0.5, 0.5).ringOffset).toBeCloseTo(C / 2, 5);
  });
});

// ── clamp guard ───────────────────────────────────────────────────────────────
describe("orbParams clamps inputs", () => {
  it("heat below 0 treated as 0", () => {
    expect(orbParams(0.5, -1).hue).toBe(255);
  });

  it("heat above 1 treated as 1", () => {
    expect(orbParams(0.5, 2).hue).toBe(143);
  });

  it("rawProb below 0 gives ringOffset = C (ring empty)", () => {
    expect(orbParams(-0.5, 0.5).ringOffset).toBeCloseTo(C, 5);
  });

  it("rawProb above 1 gives ringOffset = 0 (ring full)", () => {
    expect(orbParams(1.5, 0.5).ringOffset).toBeCloseTo(0, 10);
  });
});
