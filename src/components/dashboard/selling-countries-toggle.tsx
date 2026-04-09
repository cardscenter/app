"use client";

import { useTranslations } from "next-intl";
import { updateSellingCountries } from "@/actions/shipping-method";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, MapPin } from "lucide-react";

export function SellingCountriesToggle({ current }: { current: string }) {
  const t = useTranslations("shipping");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState(current);

  async function handleChange(preference: string) {
    setLoading(true);
    setValue(preference);
    await updateSellingCountries(preference);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      <button
        type="button"
        disabled={loading}
        onClick={() => handleChange("NL_ONLY")}
        className={`flex flex-1 items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
          value === "NL_ONLY"
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/30"
        }`}
      >
        <MapPin className={`h-5 w-5 shrink-0 ${value === "NL_ONLY" ? "text-primary" : "text-muted-foreground"}`} />
        <div>
          <p className="text-sm font-medium text-foreground">{t("nlOnly")}</p>
          <p className="text-xs text-muted-foreground">{t("nlOnlyDescription")}</p>
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
          <p className="text-sm font-medium text-foreground">{t("allEu")}</p>
          <p className="text-xs text-muted-foreground">{t("allEuDescription")}</p>
        </div>
      </button>
    </div>
  );
}
