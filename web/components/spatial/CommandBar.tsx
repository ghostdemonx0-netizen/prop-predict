/**
 * CommandBar.tsx — Sticky top header for the Mock 7 "Spatial Depth" skin.
 *
 * Transcribed from mock7.html's <header> / .cmd / .brand / .live / .wseg-wrap.
 * SVG ids use "sp-mk", "sp-mkb", "sp-mkg" to avoid global ID collisions.
 *
 * Changes vs original:
 *  - Accepts optional `dates` / `selectedDate` / `onDate` for the date picker
 *    (moved here from HeroTiles).
 *  - Weighting SegmentedControl is visible on all viewports: in-bar on desktop
 *    (≥881px) and in a full-width row just below the bar on mobile (≤880px).
 */
"use client";

import "./spatial.css";
import { UserButton } from "@clerk/nextjs";
import { SegmentedControl } from "./SegmentedControl";

export interface CommandBarProps {
  source: "current" | "blend" | "hist";
  onSourceChange: (v: "current" | "blend" | "hist") => void;
  /** Ordered list of date strings for the date picker (e.g. "2026-07-02"). */
  dates?: string[];
  /** Currently selected date. */
  selectedDate?: string;
  /** Called when the user picks a different date. */
  onDate?: (d: string) => void;
}

const SOURCE_OPTIONS = [
  { value: "current", label: "Current szn" },
  { value: "blend",   label: "Blend" },
  { value: "hist",    label: "History 3yr" },
];

export function CommandBar({
  source,
  onSourceChange,
  dates,
  selectedDate,
  onDate,
}: CommandBarProps) {
  const weightingControl = (
    <SegmentedControl
      options={SOURCE_OPTIONS}
      value={source}
      onChange={(v) => onSourceChange(v as "current" | "blend" | "hist")}
      variant="ghost"
    />
  );

  return (
    <>
      <header className="sp-header">
        <div className="sp-wrap">
          <div className="sp-cmd sp-float">

            {/* ── Brand ──────────────────────────────────────────────── */}
            <div className="sp-brand">
              <svg
                className="sp-mark"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <defs>
                  <radialGradient id="sp-mk" cx="34%" cy="28%" r="80%">
                    <stop offset="0"    stopColor="hsl(150 90% 78%)" />
                    <stop offset="42%"  stopColor="hsl(168 86% 56%)" />
                    <stop offset="100%" stopColor="hsl(255 80% 40%)" />
                  </radialGradient>
                  <linearGradient id="sp-mkb" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="hsl(188 92% 64%)" />
                    <stop offset="1" stopColor="hsl(264 88% 70%)" />
                  </linearGradient>
                  <filter id="sp-mkg" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="1" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <circle cx="24" cy="24" r="19" fill="url(#sp-mk)" opacity=".22" />
                <circle
                  cx="24" cy="24" r="14.5"
                  fill="none"
                  stroke="hsl(0 0% 100% / .1)"
                  strokeWidth="3"
                />
                <circle
                  cx="24" cy="24" r="14.5"
                  fill="none"
                  stroke="url(#sp-mkb)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="91"
                  strokeDashoffset="30"
                  transform="rotate(-90 24 24)"
                  filter="url(#sp-mkg)"
                />
                <circle cx="24" cy="24" r="7" fill="url(#sp-mk)" />
                <circle cx="20.5" cy="20" r="2.4" fill="hsl(0 0% 100% / .7)" />
                <path
                  d="M26 16 L20.5 24 L24 24 L21 31 L28.5 22 L25 22 Z"
                  fill="hsl(0 0% 100% / .92)"
                  filter="url(#sp-mkg)"
                />
              </svg>

              <div className="sp-bcol">
                <div className="sp-wm">
                  <span className="sp-iristext">Prop Predict</span>
                  <small>Spatial · MLB intel</small>
                </div>
              </div>
            </div>

            {/* ── Spacer ──────────────────────────────────────────────── */}
            <div className="sp-grow" />

            {/* ── Live pill ───────────────────────────────────────────── */}
            <div className="sp-live">
              <span className="sp-dot-live" />
              <span className="sp-lt">LIVE</span>
            </div>

            {/* ── Date picker (compact glass pill) ────────────────────── */}
            {dates && dates.length > 0 && (
              <div className="sp-datepick sp-float sp-datepick--cmd">
                <select
                  value={selectedDate}
                  onChange={(e) => onDate?.(e.target.value)}
                  aria-label="Select date"
                >
                  {dates.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Weighting segmented control — desktop (≥881px) ──────── */}
            <div className="sp-wseg-wrap">
              <span className="sp-eyebrow sp-wseg-label">WEIGHTING</span>
              {weightingControl}
            </div>

            {/* ── User avatar ─────────────────────────────────────────── */}
            <UserButton />

          </div>
        </div>
      </header>

      {/* ── Weighting — mobile fallback (≤880px), full-width row below bar ── */}
      <div className="sp-wseg-mobile-row" aria-label="Data weighting">
        <div className="sp-wrap">
          <div className="sp-wseg-mobile-inner">
            <span className="sp-eyebrow">WEIGHTING</span>
            {weightingControl}
          </div>
        </div>
      </div>
    </>
  );
}

export default CommandBar;
