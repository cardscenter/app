"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Pill, type PastelColor } from "./pill";
import { DisplayHeading } from "./display-heading";

export interface FaqItem {
  q: string;
  a: ReactNode;
}

/**
 * Vragenlijst (referentie "…, answered."): wit paneel met eyebrow-pil, grote
 * kop en uitklapbare rijen. Eén tegelijk open; animatie via grid-rows.
 */
export function FaqSection({ eyebrow, eyebrowColor = "yellow", title, items, id, defaultOpen = 0 }: { eyebrow?: string; eyebrowColor?: PastelColor; title: string; items: FaqItem[]; id?: string; defaultOpen?: number | null }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  return (
    <section id={id} className="px-0 pb-6 sm:px-5 lg:px-6">
      <div className="rounded-[var(--radius-panel)] bg-white px-5 py-12 sm:px-8 lg:px-24 lg:py-[76px]">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-col items-center gap-5 text-center">
            {eyebrow && <Pill color={eyebrowColor}>{eyebrow}</Pill>}
            <DisplayHeading tag="h2" size={3} text={title} className="max-w-[40rem] text-center" />
          </div>
          <div className="mt-10 divide-y divide-[var(--border)] border-y border-[var(--border)] lg:mt-14">
            {items.map((it, i) => {
              const isOpen = open === i;
              return (
                <div key={i}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-6 py-5 text-left">
                    <span className="text-lg font-semibold leading-snug tracking-[-0.03em] text-[var(--foreground)]">{it.q}</span>
                    <ChevronDown className={`size-5 shrink-0 text-[var(--foreground)]/50 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div className="cc-acc-body" data-open={isOpen} aria-hidden={!isOpen}>
                    <div className="overflow-hidden">
                      <div className="cc-prose max-w-[42rem] pb-6 text-base">{it.a}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
