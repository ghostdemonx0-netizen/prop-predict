// Cohesive thin-line icon set (replaces the emoji "AI look").
// All inherit text color via currentColor; pass a size + optional style.
import type { CSSProperties } from "react";

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

export function ClockIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

/** Wind direction arrow. deg = compass-style rotation (0 = pointing up / "out"). */
export function WindIcon({ size = 14, deg = 0, style, className }: IconProps & { deg?: number }) {
  return (
    <svg {...base(size)} style={{ transform: `rotate(${deg}deg)`, ...style }} className={className}>
      <path d="M12 20V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

export function TempIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z" />
      <path d="M12 9v7" />
    </svg>
  );
}

export function RainIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M12 3c3.5 4 5.5 6.4 5.5 9a5.5 5.5 0 1 1-11 0c0-2.6 2-5 5.5-9Z" />
    </svg>
  );
}

export function FlameIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M12 3c1 3 4 4.2 4 7.5a4 4 0 0 1-8 0c0-1.2.4-2 1-2.8.3 1 .9 1.5 1.7 1.6C10 7.5 11 5.3 12 3Z" />
    </svg>
  );
}

/** Opposing pitcher — a baseball with stitches. */
export function PitcherIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M7 6.5c2 2 2 9 0 11M17 6.5c-2 2-2 9 0 11" />
    </svg>
  );
}

/** Park + weather (ballpark arch with a sun/cloud hint). */
export function ParkWeatherIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M3 20a9 9 0 0 1 18 0" />
      <path d="M3 20h18" />
      <circle cx="12" cy="9.5" r="2" />
    </svg>
  );
}

export function ParkIcon({ size = 14, style, className }: IconProps) {
  return (
    <svg {...base(size)} style={style} className={className}>
      <path d="M3 20a9 9 0 0 1 18 0" />
      <path d="M3 20h18" />
    </svg>
  );
}
