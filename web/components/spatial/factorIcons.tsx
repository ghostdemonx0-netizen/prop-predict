/**
 * factorIcons.tsx — Thin-line SVG icons for the "what's driving it" factor rows
 * of the Mock 7 "Spatial Depth" modal. These replace the old iPhone emoji icons
 * (🏟️ 🌬️ 🎯 💥 📈 🔥 ⚾ 🔄 📜 📋 📊 …) with a cohesive stroke-based set that
 * matches the existing kit icons (WindIcon / TempIcon / ClockIcon in ../Icons).
 *
 * All icons inherit their colour via `currentColor` and take a `size` + optional
 * `style` / `className`, so they read as subtle monochrome UI marks, not emoji.
 *
 * Icons that already exist in ../Icons are re-exported here so the modal can pull
 * every factor glyph from one place:
 *   Weather        → WindIcon
 *   Recent form    → FlameIcon
 *   Pitcher        → PitcherIcon
 *   Park           → ParkIcon
 *   Park & weather → ParkWeatherIcon
 */
import type { CSSProperties } from "react";

export {
  WindIcon,
  FlameIcon,
  PitcherIcon,
  ParkIcon,
  ParkWeatherIcon,
} from "../Icons";

type IconProps = { size?: number; style?: CSSProperties; className?: string };

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/** Spray — a target / scatter of concentric rings with a centre dot. */
export function SprayIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 12h.01" />
    </svg>
  );
}

/** Hard-hit form — an impact spark / 4-point burst. */
export function HardHitIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M12 2.5l2 6.5 6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2z" />
    </svg>
  );
}

/** Production form / Season pace — an upward trend line with arrow head. */
export function ProductionIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M3 17l5-5 3 3 7-8" />
      <path d="M15 7h5v5" />
    </svg>
  );
}

/** Platoon — two opposing swap arrows (batter-hand vs pitcher-hand). */
export function PlatoonIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M4 8h13l-3.5-3.5" />
      <path d="M20 16H7l3.5 3.5" />
    </svg>
  );
}

/** History / BvP — crossed bats with knobs (career vs this pitcher). */
export function HistoryIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M5.5 19l11-13.5" />
      <path d="M18.5 19l-11-13.5" />
      <circle cx="5.5" cy="19" r="1.1" />
      <circle cx="18.5" cy="19" r="1.1" />
    </svg>
  );
}

/** Lineup — a bulleted batting-order list. */
export function LineupIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />
    </svg>
  );
}

/** Baseline — a level gauge / bar set (his usual rate). */
export function BaselineIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M3.5 20h17" />
      <path d="M6.5 20v-6M12 20V7M17.5 20v-9" />
    </svg>
  );
}
