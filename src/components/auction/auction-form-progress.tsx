"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Tag, Image as ImageIcon, FileText, DollarSign, Clock, Truck, Check, Megaphone } from "lucide-react";

export type AuctionStepKey =
  | "type"
  | "photos"
  | "details"
  | "pricing"
  | "timing"
  | "delivery"
  | "promotion";

interface AuctionFormProgressProps {
  /** Welke stappen zijn lokaal "compleet" volgens form-state. */
  completed: Set<AuctionStepKey>;
}

const STEPS: Array<{ key: AuctionStepKey; labelKey: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "type", labelKey: "progressType", icon: Tag },
  { key: "photos", labelKey: "progressPhotos", icon: ImageIcon },
  { key: "details", labelKey: "progressDetails", icon: FileText },
  { key: "pricing", labelKey: "progressPricing", icon: DollarSign },
  { key: "timing", labelKey: "progressTiming", icon: Clock },
  { key: "delivery", labelKey: "progressDelivery", icon: Truck },
  { key: "promotion", labelKey: "progressPromotion", icon: Megaphone },
];

export function AuctionFormProgress({ completed }: AuctionFormProgressProps) {
  const t = useTranslations("auction");
  const [active, setActive] = useState<AuctionStepKey>("type");
  const listRef = useRef<HTMLOListElement>(null);

  // IntersectionObserver markeert welke sectie momenteel ~midden in de viewport
  // staat. Threshold 0.4 voorkomt flikkering tussen aangrenzende secties.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const first = visible.sort(
          (a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop
        )[0];
        const key = first.target.getAttribute("data-section") as AuctionStepKey | null;
        if (key) setActive(key);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
    );

    const sections = document.querySelectorAll<HTMLElement>("[data-section]");
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Auto-scroll de actieve chip in view zodra je een nieuwe sectie in de
  // page-flow raakt. `block: "nearest"` voorkomt dat de page mee-scrollt;
  // `inline: "center"` centreert de chip in de scrollable strip. Werkt op
  // alle breakpoints — strip is horizontaal overal.
  useEffect(() => {
    if (!listRef.current) return;
    const btn = listRef.current.querySelector<HTMLButtonElement>(`[data-step="${active}"]`);
    if (!btn) return;
    btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  const scrollTo = (key: AuctionStepKey) => {
    const el = document.querySelector<HTMLElement>(`[data-section="${key}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-border bg-background px-4 py-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border lg:bg-card lg:px-4 lg:shadow-sm">
      {/* Geen backdrop-blur — op iOS Safari creëert sticky + backdrop-filter
          een "atomic" stacking context die de CardSearchSelect-dropdown niet
          netjes laat overlappen, zelfs met z-[100]. Solide bg lost het op
          zonder visueel verlies. */}
      <ol
        ref={listRef}
        className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {STEPS.map((step) => {
          const isActive = active === step.key;
          const isCompleted = completed.has(step.key);
          const Icon = step.icon;
          return (
            <li key={step.key} className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                data-step={step.key}
                onClick={() => scrollTo(step.key)}
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border-primary bg-primary text-white shadow-sm"
                    : isCompleted
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {isCompleted && !isActive ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span>{t(step.labelKey)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
