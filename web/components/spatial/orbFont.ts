/**
 * orbFont.ts — the probability-orb / glass-dot number font.
 *
 * IBM Plex Mono, loaded once here via next/font/google and shared by
 * ProbabilityOrb + GlassDot so every sphere's number/letter uses the same
 * monospace face. Tabular + lining figures are applied in CSS (.orbNum) so the
 * digits line up. ADDITIVE — this does NOT touch app/layout.tsx's app fonts.
 */
import { IBM_Plex_Mono } from "next/font/google";

export const orbMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
