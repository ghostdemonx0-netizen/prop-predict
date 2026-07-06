/**
 * NavDock.tsx — Floating navigation dock for the Mock 7 "Spatial Depth" skin.
 *
 * Transcribed from mock7.html's .dockrow / .dock / .glow JS.
 * The glowing pill is positioned via useLayoutEffect + per-button ref map,
 * mirroring the same technique used in SegmentedControl.tsx.
 */
"use client";

import "./spatial.css";
import { useRef, useLayoutEffect, useState, useCallback, type ReactElement } from "react";

export type NavSection = "board" | "hub" | "top" | "parks" | "boards";

export interface NavDockProps {
  section: NavSection;
  onSection: (s: NavSection) => void;
}

// ── Inline SVG icons ────────────────────────────────────────────────────────

function IconBoard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h11a2 2 0 0 1 2 2v12M6 4a2 2 0 0 0-2 2v1h4M6 4a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2" />
    </svg>
  );
}

function IconHub() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20a9 9 0 0 1 18 0" />
      <path d="M3 20h18" />
      <circle cx="12" cy="9.5" r="2" />
    </svg>
  );
}

function IconTop() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M21 7v5h-5" />
    </svg>
  );
}

function IconParks() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20a9 9 0 0 1 18 0" />
      <path d="M3 20h18" />
    </svg>
  );
}

function IconBoards() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M3 14h18M9 4v16M15 4v16" />
    </svg>
  );
}

const NAV_ITEMS: { id: NavSection; label: string; Icon: () => ReactElement }[] = [
  { id: "board",  label: "Props",     Icon: IconBoard  },
  { id: "hub",    label: "Game Hub",  Icon: IconHub    },
  { id: "top",    label: "Top Plays", Icon: IconTop    },
  { id: "parks",  label: "Parks",     Icon: IconParks  },
  { id: "boards", label: "Boards",    Icon: IconBoards },
];

export function NavDock({ section, onSection }: NavDockProps) {
  const btnRefs = useRef<Map<NavSection, HTMLButtonElement | null>>(new Map());
  const [glowGeo, setGlowGeo] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const btn = btnRefs.current.get(section);
    if (btn) {
      setGlowGeo({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [section]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => { window.removeEventListener("resize", measure); };
  }, [measure]);

  return (
    <div className="sp-dockrow">
      <nav className="sp-dock sp-float">
        {/* Animated glow pill */}
        <span
          className="sp-dock-glow"
          aria-hidden="true"
          style={{ left: glowGeo.left, width: glowGeo.width }}
        />

        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            ref={(el) => {
              if (el) { btnRefs.current.set(id, el); } else { btnRefs.current.delete(id); }
            }}
            type="button"
            className={["sp-dock-btn", id === section ? "sp-dock-btn--on" : ""].filter(Boolean).join(" ")}
            onClick={() => onSection(id)}
            aria-current={id === section ? "page" : undefined}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default NavDock;
