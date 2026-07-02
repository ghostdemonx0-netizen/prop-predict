/**
 * CommandBar.tsx — Sticky top header for the Mock 7 "Spatial Depth" skin.
 *
 * Transcribed from mock7.html's <header> / .cmd / .brand / .live / .wseg-wrap.
 * SVG ids use "sp-mk", "sp-mkb", "sp-mkg" to avoid global ID collisions.
 */
"use client";

import "./spatial.css";
import { UserButton } from "@clerk/nextjs";
import { SegmentedControl } from "./SegmentedControl";

export interface CommandBarProps {
  source: "current" | "blend" | "hist";
  onSourceChange: (v: "current" | "blend" | "hist") => void;
}

const SOURCE_OPTIONS = [
  { value: "current", label: "Current" },
  { value: "blend",   label: "Blend" },
  { value: "hist",    label: "History 3yr" },
];

export function CommandBar({ source, onSourceChange }: CommandBarProps) {
  return (
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

          {/* ── Weighting segmented control (hidden <880px) ─────────── */}
          <div className="sp-wseg-wrap">
            <span className="sp-eyebrow">Weighting</span>
            <SegmentedControl
              options={SOURCE_OPTIONS}
              value={source}
              onChange={(v) => onSourceChange(v as "current" | "blend" | "hist")}
              variant="ghost"
            />
          </div>

          {/* ── User avatar ─────────────────────────────────────────── */}
          <UserButton />

        </div>
      </div>
    </header>
  );
}

export default CommandBar;
