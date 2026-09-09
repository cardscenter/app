"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useFormScrollSpy, useChipStripAutoScroll } from "@/hooks/use-form-scroll-spy";
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

// Module-level zodat de scroll-spy-hook een stabiele referentie krijgt.
const STEP_KEYS = STEPS.map((s) => s.key);

export function ListingFormProgress({ completed }: ListingFormProgressProps) {
  const t = useTranslations("listing");
  const listRef = useRef<HTMLOListElement>(null);
  // Monotone anker-lijn-spy + strip-only auto-scroll. Zie de hook voor
  // waarom de oude IntersectionObserver + scrollIntoView de pagina liet haken.
  const { active, scrollToSection } = useFormScrollSpy<ListingStepKey>(STEP_KEYS);
  useChipStripAutoScroll(listRef, active);

  return (
    <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-border bg-background px-4 py-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border lg:bg-card lg:px-4 lg:shadow-sm">
      {/* Geen backdrop-blur: een geblurde sticky achtergrond hertekent elke
          scroll-frame (merkbaar schokkerig), en op iOS Safari maakt sticky +
          backdrop-filter een "atomic" stacking context waar dropdowns niet
          overheen kunnen. Solide bg lost beide op zonder visueel verlies. */}
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
                onClick={() => scrollToSection(step.key)}
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
