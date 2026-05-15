"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Tag, Image as ImageIcon, FileText, DollarSign, Truck, Check, Megaphone } from "lucide-react";

// Sticky chip-nav voor de marktplaats-aanmaakflow. Spiegel van
// `auction-form-progress.tsx` — zelfde IntersectionObserver-patroon, zelfde
// styling. Verschil: 6 stappen i.p.v. 7 (geen Timing — listings hebben geen
// vooraf-gepland startmoment), en "Bezorging" zit vóór "Promotie" omdat de
// SHIP/PICKUP-keuze invloed heeft op welke upsells je toont.

export type ListingStepKey =
  | "type"
  | "photos"
  | "details"
  | "pricing"
  | "delivery"
  | "promotion";

interface ListingFormProgressProps {
  completed: Set<ListingStepKey>;
}

const STEPS: Array<{ key: ListingStepKey; labelKey: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "type", labelKey: "progressType", icon: Tag },
  { key: "photos", labelKey: "progressPhotos", icon: ImageIcon },
  { key: "details", labelKey: "progressDetails", icon: FileText },
  { key: "pricing", labelKey: "progressPricing", icon: DollarSign },
  { key: "delivery", labelKey: "progressDelivery", icon: Truck },
  { key: "promotion", labelKey: "progressPromotion", icon: Megaphone },
];

export function ListingFormProgress({ completed }: ListingFormProgressProps) {
  const t = useTranslations("listing");
  const [active, setActive] = useState<ListingStepKey>("type");
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const first = visible.sort(
          (a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop
        )[0];
        const key = first.target.getAttribute("data-section") as ListingStepKey | null;
        if (key) setActive(key);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
    );

    const sections = document.querySelectorAll<HTMLElement>("[data-section]");
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const btn = listRef.current.querySelector<HTMLButtonElement>(`[data-step="${active}"]`);
    if (!btn) return;
    btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  const scrollTo = (key: ListingStepKey) => {
    const el = document.querySelector<HTMLElement>(`[data-section="${key}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-border bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border lg:bg-card/95 lg:px-4 lg:shadow-sm">
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
