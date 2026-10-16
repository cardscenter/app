import type { ReactNode } from "react";
import { BrailleIcon, type BrailleAnimation } from "./braille-icon";
import type { PastelColor } from "./pill";

export interface StoryRow {
  number?: string;
  title: string;
  text: ReactNode;
  /** Eigen beeld rechts; zonder beeld komt er een pastelvlak met het nummer. */
  visual?: ReactNode;
  color?: PastelColor;
  animation?: BrailleAnimation;
}

const BG: Record<PastelColor, string> = { pink: "var(--pastel-pink)", yellow: "var(--pastel-yellow)", blue: "var(--pastel-blue)", green: "var(--pastel-green)" };
const ORDER: PastelColor[] = ["blue", "yellow", "pink", "green"];
const ANIMS: BrailleAnimation[] = ["scan", "helix", "waves", "rain", "pulse"];

/**
 * Verhaalrijen (referentie Design/Build/Launch/Sustain/Grow): genummerde
 * rijen met tekst links en beeld rechts, om en om gespiegeld. Zonder eigen
 * beeld toont de rechterkant een pastelvlak met het nummer in de display-letter.
 */
export function StoryRows({ rows, className = "" }: { rows: StoryRow[]; className?: string }) {
  return (
    <section className={`flex justify-center px-4 pb-12 sm:px-5 lg:px-6 lg:pb-16 ${className}`}>
      <ol className="w-full max-w-6xl divide-y divide-[var(--border)]">
        {rows.map((r, i) => {
          const flip = i % 2 === 1;
          const color = r.color ?? ORDER[i % ORDER.length]!;
          const number = r.number ?? String(i + 1).padStart(2, "0");
          return (
            <li key={r.title} className={`grid items-center gap-8 py-10 lg:grid-cols-2 lg:gap-16 lg:py-14 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <div className="min-w-0">
                <span className="cc-display text-3xl text-[var(--primary)]">{number}</span>
                <h3 className="mt-3 text-[28px] font-semibold leading-[1.1] tracking-[-0.04em] text-[var(--foreground)] md:text-[34px]">{r.title}</h3>
                <div className="cc-prose mt-4 max-w-[34rem] text-base [&_strong]:font-semibold [&_strong]:text-[var(--foreground)] [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{r.text}</div>
              </div>
              <div className="min-w-0">
                {r.visual ?? (
                  <div className="relative flex min-h-[220px] items-end justify-between overflow-hidden rounded-[16px] p-6 sm:min-h-[280px]" style={{ background: BG[color] }}>
                    <span className="cc-display text-[120px] leading-[0.8] text-[var(--foreground)] sm:text-[160px]">{number}</span>
                    <BrailleIcon animation={r.animation ?? ANIMS[i % ANIMS.length]} color={BG[color]} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
