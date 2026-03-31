"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: "nl" | "en") {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border p-1">
      <button
        onClick={() => switchLocale("nl")}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          locale === "nl"
            ? "bg-primary text-white"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        NL
      </button>
      <button
        onClick={() => switchLocale("en")}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          locale === "en"
            ? "bg-primary text-white"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        EN
      </button>
    </div>
  );
}
