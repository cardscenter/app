import type { CSSProperties, ReactNode } from "react";

export type PanelColor = "pink" | "yellow" | "blue" | "green" | "ink" | "dark" | "white";

const BG: Record<PanelColor, string> = {
  pink: "var(--pastel-pink)",
  yellow: "var(--pastel-yellow)",
  blue: "var(--pastel-blue)",
  green: "var(--pastel-green)",
  ink: "var(--foreground)",
  dark: "var(--cc-dark)",
  white: "var(--card)",
};
const PAD = {
  sm: "px-5 py-10 sm:px-8 lg:px-12 lg:py-12",
  md: "px-5 py-14 sm:px-8 lg:px-24 lg:py-[76px]",
  lg: "px-5 py-14 sm:px-8 lg:px-24 lg:py-40",
} as const;

/**
 * Full-bleed gekleurd paneel met afgeronde hoeken (design-pass): de buitenkant
 * laat op mobiel geen zijmarge over, de binnenkant centreert op 72rem.
 */
export function Panel({ children, color = "white", padding = "md", innerClassName = "", className = "", style, clip = true, id }: { children: ReactNode; color?: PanelColor; padding?: keyof typeof PAD; innerClassName?: string; className?: string; style?: CSSProperties; clip?: boolean; id?: string }) {
  const onDark = color === "ink" || color === "dark";
  return (
    <section id={id} className={`px-0 pb-6 sm:px-5 lg:px-6 ${className}`}>
      <div className={`relative w-full rounded-[var(--radius-panel)] ${clip ? "overflow-hidden" : "overflow-visible"} ${PAD[padding]} ${onDark ? "text-white" : "text-[var(--foreground)]"}`} style={{ background: BG[color], ...style }}>
        <div className={`relative z-[1] mx-auto w-full max-w-6xl ${innerClassName}`}>{children}</div>
      </div>
    </section>
  );
}
