"use client";

import { useState } from "react";
import { CtaButton } from "./cta-button";

export interface AudienceItem {
  title: string;
  description: string;
  color: "pink" | "yellow" | "blue" | "green";
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
}

const ACCENT: Record<AudienceItem["color"], string> = { pink: "var(--cc-pink)", yellow: "var(--cc-yellow)", blue: "var(--cc-blue)", green: "var(--cc-green)" };

/**
 * "Voor wie"-sectie: links een vaste (sticky) kop met pil, rechts een
 * accordeon van punch-cards. De open kaart kleurt in haar accentkleur; de
 * inhoud schuift open via grid-template-rows.
 */
export function AudienceAccordion({ eyebrow, title, items }: { eyebrow: string; title: string; items: AudienceItem[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="flex justify-center px-4 pb-24 sm:px-5 lg:px-6 lg:pb-44">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-2 lg:gap-6">
        <div>
          <div className="flex flex-col items-start gap-6 lg:sticky lg:top-32">
            <span className="cc-pill inline-flex h-8 items-center bg-[var(--cc-ink)] px-3 text-sm font-semibold text-[var(--cc-blue)]">{eyebrow}</span>
            <p className="text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] text-[var(--cc-ink)] md:text-[42px] lg:text-[48px]">{title}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1 lg:pt-14">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div
                key={it.title}
                className="cc-punch cursor-pointer rounded-[6px] border border-[var(--cc-border-subtle)] p-6 transition-[background] duration-300 lg:p-[32px_24px]"
                style={{ background: isOpen ? ACCENT[it.color] : "transparent" }}
                onClick={() => setOpen(i)}
              >
                <span className="cc-punch-dots" aria-hidden />
                <button type="button" aria-expanded={isOpen} className="flex w-full flex-col items-start gap-3 text-left" onClick={(e) => { e.stopPropagation(); setOpen(i); }}>
                  <span className="cc-display text-[40px] text-[var(--cc-ink)] lg:text-[52px] xl:text-[60px]">{it.title}</span>
                  <span className="cc-prose max-w-[26rem] text-base">{it.description}</span>
                </button>
                <div className="cc-acc-body w-full" data-open={isOpen} aria-hidden={!isOpen}>
                  <div className="overflow-hidden">
                    <div className="flex flex-col items-start gap-6 pt-8 lg:pt-14">
                      <div className="h-px w-full bg-[var(--cc-ink)]/10" />
                      <ul className="flex flex-col gap-4">
                        {it.bullets.map((b) => (
                          <li key={b} className="flex items-center gap-4">
                            <span className="size-1 shrink-0 rounded-full bg-[var(--cc-ink)]" aria-hidden />
                            <span className="cc-prose text-base">{b}</span>
                          </li>
                        ))}
                      </ul>
                      <CtaButton href={it.ctaHref} variant="dark">
                        {it.ctaLabel}
                      </CtaButton>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
