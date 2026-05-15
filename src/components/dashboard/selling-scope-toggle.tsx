"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe, MapPin, Users } from "lucide-react";
import { updateSellingScope } from "@/actions/shipping-method";
import type { SellingScope } from "@/lib/shipping/static-methods";
import { getCountryName } from "@/lib/shipping/countries";

interface Props {
  current: SellingScope;
  originCountry: string;
  neighbors: string[];
}

/** Selling-scope-toggle (Fase 33). Origin-aware labels: optie 2 toont werkelijke buurlanden,
 *  disabled voor origins zonder EU_NEAR (IE, GR, MT, CY). */
export function SellingScopeToggle({ current, originCountry, neighbors }: Props) {
  const t = useTranslations("shipping");
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState<SellingScope>(current);

  const originName = getCountryName(originCountry, locale);
  const neighborNames = neighbors.map((c) => getCountryName(c, locale));
  const hasNeighbors = neighbors.length > 0;

  async function handleChange(scope: SellingScope) {
    setLoading(true);
    setValue(scope);
    await updateSellingScope({ scope });
    setLoading(false);
    router.refresh();
  }

  function formatScopeLabel(originName: string, neighborNames: string[]): string {
    const all = [originName, ...neighborNames];
    if (all.length === 1) return all[0];
    if (all.length === 2) return `${all[0]} ${t("listAnd")} ${all[1]}`;
    return `${all.slice(0, -1).join(", ")} ${t("listAnd")} ${all[all.length - 1]}`;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      <button
        type="button"
        disabled={loading}
        onClick={() => handleChange("DOMESTIC_ONLY")}
        className={`flex flex-1 items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
          value === "DOMESTIC_ONLY"
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/30"
        }`}
      >
        <MapPin className={`h-5 w-5 shrink-0 ${value === "DOMESTIC_ONLY" ? "text-primary" : "text-muted-foreground"}`} />
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("scopeDomesticOnly", { country: originName })}
          </p>
          <p className="text-xs text-muted-foreground">{t("scopeDomesticOnlyDescription")}</p>
        </div>
      </button>

      <button
        type="button"
        disabled={loading || !hasNeighbors}
        onClick={() => hasNeighbors && handleChange("DOMESTIC_AND_NEAR")}
        title={!hasNeighbors ? t("scopeNoNeighborsTooltip") : undefined}
        className={`flex flex-1 items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
          !hasNeighbors
            ? "cursor-not-allowed border-border opacity-50"
            : value === "DOMESTIC_AND_NEAR"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/30"
        }`}
      >
        <Users className={`h-5 w-5 shrink-0 ${value === "DOMESTIC_AND_NEAR" ? "text-primary" : "text-muted-foreground"}`} />
        <div>
          <p className="text-sm font-medium text-foreground">
            {hasNeighbors
              ? formatScopeLabel(originName, neighborNames)
              : t("scopeNoNeighbors")}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasNeighbors
              ? t("scopeDomesticAndNearDescription", { label: formatScopeLabel(originName, neighborNames) })
              : t("scopeNoNeighborsTooltip")}
          </p>
        </div>
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={() => handleChange("ALL_EU")}
        className={`flex flex-1 items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
          value === "ALL_EU"
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/30"
        }`}
      >
        <Globe className={`h-5 w-5 shrink-0 ${value === "ALL_EU" ? "text-primary" : "text-muted-foreground"}`} />
        <div>
          <p className="text-sm font-medium text-foreground">{t("scopeAllEu")}</p>
          <p className="text-xs text-muted-foreground">{t("scopeAllEuDescription")}</p>
        </div>
      </button>
    </div>
  );
}
