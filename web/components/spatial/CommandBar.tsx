/**
 * CommandBar.tsx — Sticky top header for the Mock 7 "Spatial Depth" skin.
 *
 * Transcribed from mock7.html's <header> / .cmd / .brand / .live / .wseg-wrap.
 * SVG ids use "sp-mk", "sp-mkb", "sp-mkg" to avoid global ID collisions.
 *
 * Changes vs original:
 *  - The date picker lives here in the command bar (compact glass pill), beside
 *    the user avatar on the right.
 *  - Weighting SegmentedControl has moved to its own centered row between
 *    the KPI tiles and the NavDock in page.tsx.
 */
"use client";

import "./spatial.css";
import { UserButton } from "@clerk/nextjs";
import { LogoMark } from "./LogoMark";

export interface CommandBarProps {
  dates: string[];
  selectedDate: string;
  onDate: (d: string) => void;
}

export function CommandBar({
  dates,
  selectedDate,
  onDate,
}: CommandBarProps) {
  return (
    <header className="sp-header">
      <div className="sp-wrap">
        <div className="sp-cmd sp-float">

          {/* ── Brand ──────────────────────────────────────────────── */}
          <div className="sp-brand">
            <LogoMark size={40} />

            <div className="sp-bcol">
              <div className="sp-wm">
                <span className="sp-iristext">Prop Predict</span>
                <small>MLB PLAYER PROPS · MODEL-DRIVEN</small>
              </div>
            </div>
          </div>

          {/* ── Spacer ──────────────────────────────────────────────── */}
          <div className="sp-grow" />

          {/* ── Date select pill — compact glass, beside the avatar ── */}
          {dates.length > 0 && (
            <div className="sp-datepick sp-datepick--cmd sp-float">
              <select
                value={selectedDate}
                onChange={(e) => onDate(e.target.value)}
                aria-label="Select date"
              >
                {dates.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {/* ── User avatar ─────────────────────────────────────────── */}
          <UserButton />

        </div>
      </div>
    </header>
  );
}

export default CommandBar;
