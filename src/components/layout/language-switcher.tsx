"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";

/**
 * NL/EN-wissel. `tone="dark"` voor op de donkere footer (witte rand/tekst).
 */
export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: "nl" | "en") {
    router.replace(pathname, { locale: newLocale });
  }

  const frame = tone === "dark" ? "border-white/20" : "border-border";
  const active = tone === "dark" ? "bg-white text-[var(--foreground)]" : "bg-primary text-white";
  const idle = tone === "dark" ? "text-white/65 hover:text-white" : "text-muted-foreground hover:text-foreground";

  return (
    <div className={`inline-flex items-center gap-1 rounded-full border p-1 ${frame}`}>
      {(["nl", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchLocale(l)}
          aria-pressed={locale === l}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${locale === l ? active : idle}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
