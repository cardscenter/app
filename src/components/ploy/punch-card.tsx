import type { CSSProperties, ElementType, ReactNode } from "react";

/**
 * Kaart met vier stippen in de hoeken (design-pass). De stippen komen uit de
 * `.cc-punch`-regels in globals.css; `dot` kiest hun kleur.
 */
export function PunchCard({ children, as = "div", dot, className = "", style }: { children: ReactNode; as?: ElementType; dot?: string; className?: string; style?: CSSProperties }) {
  const Comp = as;
  return (
    <Comp className={`cc-punch rounded-[6px] border border-[var(--cc-border-subtle)] ${className}`} style={{ ...(dot ? ({ "--cc-dot": dot } as CSSProperties) : {}), ...style }}>
      <span className="cc-punch-dots" aria-hidden />
      {children}
    </Comp>
  );
}
