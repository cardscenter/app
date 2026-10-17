"use client";

import { useTranslations } from "next-intl";
import { Star, TrendingUp, LayoutGrid, Gift } from "lucide-react";
import {
  CLAIMSALE_UPSELL_PRICING,
  CLAIMSALE_UPSELL_TYPES_OFFERED,
  applyFreeUpsellsToCost,
  type ClaimsaleUpsellType,
} from "@/lib/upsell-config";
import { getUpsellDiscount } from "@/lib/subscription-tiers";
import type { ClaimsaleUpsellEntry } from "../wizard-types";

const UPSELL_ICONS: Record<ClaimsaleUpsellType, typeof Star> = {
  HOMEPAGE_SPOTLIGHT: Star,
  CATEGORY_HIGHLIGHT: TrendingUp,
  ITEM_PREVIEW: LayoutGrid,
};

const UPSELL_LABELS: Record<ClaimsaleUpsellType, { label: string; desc: string }> = {
  HOMEPAGE_SPOTLIGHT: {
    label: "Homepage Spotlight",
    desc: "Je claimsale verschijnt in de uitgelichte rij op de homepage.",
  },
  CATEGORY_HIGHLIGHT: {
    label: "Categorie-uitlichting",
    desc: "Je claimsale staat in de 'Gesponsord'-rij op de claimsales-pagina.",
  },
  ITEM_PREVIEW: {
    label: "Geavanceerde Kaart-Preview-Rij",
    desc: "Toon 2 rijen kaart-thumbnails (tot 50 kaarten) als carousel onder je claimsale in de lijst.",
  },
};

const UPSELL_CTR: Record<ClaimsaleUpsellType, number> = {
  HOMEPAGE_SPOTLIGHT: 15,
  CATEGORY_HIGHLIGHT: 8,
  ITEM_PREVIEW: 4,
};

interface StepPromotieProps {
  upsells: ClaimsaleUpsellEntry[];
  userBalance: number;
  accountType: string;
  freeUpsellsRemaining: number;
  onUpsellsChange: (upsells: ClaimsaleUpsellEntry[]) => void;
}

export function StepPromotie({
  upsells,
  userBalance,
  accountType,
  freeUpsellsRemaining,
  onUpsellsChange,
}: StepPromotieProps) {
  const t = useTranslations("claimsale");
  const discount = getUpsellDiscount(accountType);

  const toggleUpsell = (type: ClaimsaleUpsellType) => {
    const existing = upsells.find((u) => u.type === type);
    if (existing) {
      onUpsellsChange(upsells.filter((u) => u.type !== type));
    } else {
      onUpsellsChange([...upsells, { type }]);
    }
  };

  const allocation = applyFreeUpsellsToCost(
    upsells.map((u) => ({ type: u.type })),
    accountType,
    freeUpsellsRemaining,
    "claimsale"
  );
  const upsellCost = allocation.total;
  const totalCost = upsellCost;
  const remainingBalance = userBalance - totalCost;
  const insufficientBalance = remainingBalance < 0;
  const freeQuotaLeft = freeUpsellsRemaining - allocation.freeUsed;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-foreground">{t("stepPromotie")}</h2>
      <p className="text-sm text-muted-foreground">{t("promotieIntro")}</p>

      <div className="space-y-3">
        {CLAIMSALE_UPSELL_TYPES_OFFERED.map((type) => {
          const Icon = UPSELL_ICONS[type];
          const meta = UPSELL_LABELS[type];
          const flatPrice = CLAIMSALE_UPSELL_PRICING[type].flatPrice * (1 - discount);
          const idx = upsells.findIndex((u) => u.type === type);
          const active = idx >= 0;
          const entryCost = idx >= 0 ? allocation.perEntry[idx] : 0;
          const isFree = active && entryCost === 0 && type === "HOMEPAGE_SPOTLIGHT";

          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleUpsell(type)}
              className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                active ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className={`rounded-lg p-2 ${active ? "bg-primary/10" : "bg-muted"}`}>
                <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{meta.label}</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    tot {UPSELL_CTR[type]}× meer klikken
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{meta.desc}</div>
                <div className="mt-2">
                  {isFree ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                      <Gift className="h-3.5 w-3.5" />
                      Gratis (gratis quota)
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      &euro;{flatPrice.toFixed(2)} (eenmalig)
                    </span>
                  )}
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    geldt de hele claimsale (max 14 dagen)
                  </span>
                </div>
              </div>
              <input type="checkbox" checked={active} readOnly className="mt-1 h-4 w-4 accent-primary" />
            </button>
          );
        })}

      </div>

      {freeUpsellsRemaining > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700">
          <span className="inline-flex items-center gap-1.5">
            <Gift className="h-4 w-4" />
            Je hebt nog {freeQuotaLeft} van {freeUpsellsRemaining} gratis Homepage-spotlight
            {freeUpsellsRemaining === 1 ? "" : "s"} deze maand.
          </span>
        </div>
      )}

      {upsells.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          {upsells.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Promotie</span>
              <span className="font-medium text-foreground">&euro;{upsellCost.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border/50 pt-2 text-sm">
            <span className="text-muted-foreground">Totaal</span>
            <span className="font-semibold text-foreground">&euro;{totalCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Beschikbaar saldo</span>
            <span className="text-foreground">&euro;{userBalance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-border/50 pt-2 text-sm">
            <span className="text-muted-foreground">Resterend saldo</span>
            <span className={`font-semibold ${insufficientBalance ? "text-red-500" : "text-foreground"}`}>
              &euro;{remainingBalance.toFixed(2)}
            </span>
          </div>
          {insufficientBalance && (
            <div className="mt-1 text-xs text-red-500">{t("insufficientBalance")}</div>
          )}
        </div>
      )}
    </div>
  );
}
