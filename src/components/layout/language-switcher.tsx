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
    <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
      <button
        onClick={() => switchLocale("nl")}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          locale === "nl"
            ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        }`}
      >
        NL
      </button>
      <button
        onClick={() => switchLocale("en")}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          locale === "en"
            ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        }`}
      >
        EN
      </button>
    </div>
  );
}
