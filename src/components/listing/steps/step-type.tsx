"use client";

import { useTranslations } from "next-intl";
import { CreditCard, Layers, Archive, Package, Sparkles } from "lucide-react";
import type { ListingType } from "@/types";

const TYPE_OPTIONS: { value: ListingType; icon: typeof CreditCard }[] = [
  { value: "SINGLE_CARD", icon: CreditCard },
  { value: "MULTI_CARD", icon: Layers },
  { value: "COLLECTION", icon: Archive },
  { value: "SEALED_PRODUCT", icon: Package },
  { value: "OTHER", icon: Sparkles },
];

const TYPE_KEYS: Record<ListingType, { label: string; desc: string }> = {
  SINGLE_CARD: { label: "typeSingleCard", desc: "typeSingleCardDesc" },
  MULTI_CARD: { label: "typeMultiCard", desc: "typeMultiCardDesc" },
  COLLECTION: { label: "typeCollection", desc: "typeCollectionDesc" },
  SEALED_PRODUCT: { label: "typeSealedProduct", desc: "typeSealedProductDesc" },
  OTHER: { label: "typeOther", desc: "typeOtherDesc" },
};

interface StepTypeProps {
  value: ListingType;
  onChange: (type: ListingType) => void;
}

export function StepType({ value, onChange }: StepTypeProps) {
  const t = useTranslations("listing");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("selectType")}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TYPE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const keys = TYPE_KEYS[opt.value];
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-6 text-center transition-all ${
                selected
                  ? "border-primary bg-primary/10 shadow-md"
                  : "glass-subtle border-transparent hover:border-primary/30 hover:bg-white/60 dark:hover:bg-white/5"
              }`}
            >
              <Icon className={`h-8 w-8 ${selected ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <div className={`font-medium ${selected ? "text-primary" : "text-foreground"}`}>
                  {t(keys.label)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{t(keys.desc)}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
