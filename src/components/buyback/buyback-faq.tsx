import type { ReactNode } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";

export interface BuybackFaqItem {
  q: string;
  a: string | ReactNode;
}

// Generieke <details>-accordion voor de inkoop-FAQ's. Items zijn bewust
// hardcoded NL (support-copy die zonder vertaalronde evolueert) — zie
// bulk-faq.tsx en collection-faq-items.tsx.
export function BuybackFaq({
  title,
  items,
  headingLevel = "h2",
}: {
  title: string;
  items: BuybackFaqItem[];
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-muted-foreground" />
        <Heading className="text-lg font-bold text-foreground">{title}</Heading>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <details
            key={i}
            className="group rounded-xl border border-border bg-card transition-colors open:border-primary/40"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
              <span>{item.q}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/50 px-4 py-3 text-sm text-muted-foreground">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
