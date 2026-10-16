import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface BuybackFaqItem {
  q: string;
  a: string | ReactNode;
}

// Generieke <details>-accordion voor de inkoop-FAQ's in de calculators.
// Items zijn bewust hardcoded NL (support-copy die zonder vertaalronde
// evolueert), zie bulk-faq.tsx en collection-faq-items.tsx. Design-pass:
// witte kaart met rijen en chevrons, zoals FaqSection op de landing.
export function BuybackFaq({ title, items, headingLevel = "h2" }: { title: string; items: BuybackFaqItem[]; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <section className="rounded-[12px] bg-white p-5 shadow-[0_2px_8px_0_var(--cc-border-subtle)] sm:p-6">
      <Heading className="text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{title}</Heading>
      <div className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {items.map((item, i) => (
          <details key={i} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
              <span>{item.q}</span>
              <ChevronDown className="size-5 shrink-0 text-[var(--foreground)]/50 transition-transform group-open:rotate-180" />
            </summary>
            <div className="cc-prose max-w-[42rem] pb-5 text-sm">{item.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
