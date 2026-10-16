import type { ReactNode } from "react";

export type PastelColor = "pink" | "yellow" | "blue" | "green";

const PASTEL_BG: Record<PastelColor, string> = {
  pink: "var(--pastel-pink)",
  yellow: "var(--pastel-yellow)",
  blue: "var(--pastel-blue)",
  green: "var(--pastel-green)",
};

/**
 * Kleine ronde pil (design-pass): inkt met pastelkleurige tekst (eyebrow),
 * wit, of pastel met inkt-tekst (categorie-label).
 */
export function Pill({ children, tone = "ink", color = "pink", className = "" }: { children: ReactNode; tone?: "ink" | "white" | "pastel"; color?: PastelColor; className?: string }) {
  const base = "cc-pill inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-semibold leading-none";
  if (tone === "pastel") {
    return (
      <span className={`${base} text-[var(--foreground)] ${className}`} style={{ background: PASTEL_BG[color] }}>
        {children}
      </span>
    );
  }
  if (tone === "white") {
    return <span className={`${base} bg-white text-[var(--foreground)] ${className}`}>{children}</span>;
  }
  return (
    <span className={`${base} bg-[var(--foreground)] ${className}`} style={{ color: PASTEL_BG[color] }}>
      {children}
    </span>
  );
}
