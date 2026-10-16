import type { ReactNode } from "react";
import { BrailleIcon, type BrailleAnimation } from "./braille-icon";

export interface TileItem {
  title: string;
  text: ReactNode;
  color: "pink" | "yellow" | "blue" | "green" | "ink";
  animation?: BrailleAnimation;
  action?: ReactNode;
  id?: string;
}

const BG: Record<TileItem["color"], string> = { pink: "var(--pastel-pink)", yellow: "var(--pastel-yellow)", blue: "var(--pastel-blue)", green: "var(--pastel-green)", ink: "var(--foreground)" };
const ACCENT: Record<TileItem["color"], string> = { pink: "var(--pastel-pink)", yellow: "var(--pastel-yellow)", blue: "var(--pastel-blue)", green: "var(--pastel-green)", ink: "var(--pastel-yellow)" };

/**
 * Tegels (referentie "One CLI. Three ways to work."): pastelvlakken met een
 * braille-icoon, titel en tekst; de inkt-tegel is de donkere uitschieter.
 */
export function TileQuad({ items, columns = 2, className = "" }: { items: TileItem[]; columns?: 2 | 3; className?: string }) {
  return (
    <section className={`flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16 ${className}`}>
      <div className={`grid w-full max-w-6xl gap-4 ${columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {items.map((it) => {
          const dark = it.color === "ink";
          return (
            <div key={it.title} id={it.id} className={`flex min-h-[220px] flex-col justify-between gap-10 rounded-[16px] p-6 sm:p-8 ${dark ? "text-white" : "text-[var(--foreground)]"}`} style={{ background: BG[it.color] }}>
              <BrailleIcon animation={it.animation ?? "scan"} color={ACCENT[it.color]} className={dark ? "bg-white/10" : ""} />
              <div>
                <h3 className="text-2xl font-semibold leading-tight tracking-[-0.04em]">{it.title}</h3>
                <div className={`mt-2 text-sm leading-relaxed ${dark ? "text-white/70" : "text-[var(--foreground)]/70"}`}>{it.text}</div>
                {it.action && <div className="mt-4">{it.action}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
