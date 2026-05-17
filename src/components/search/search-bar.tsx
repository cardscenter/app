"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Search, X } from "lucide-react";
import { useState } from "react";

interface SearchBarProps {
  variant: "header" | "hero";
  defaultValue?: string;
}

export function SearchBar({ variant, defaultValue = "" }: SearchBarProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      router.push(`/zoeken?q=${encodeURIComponent(trimmed)}`);
    }
  }

  if (variant === "hero") {
    return (
      <form onSubmit={handleSubmit} className="w-full max-w-lg">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("heroPlaceholder")}
            className="w-full rounded-xl border border-border bg-card pl-12 pr-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </form>
    );
  }

  // Header variant: always-visible inline bar (lg+ only — header.tsx renders
  // a collapsible icon-toggle for md→lg widths)
  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("placeholder")}
          className="w-full rounded-lg bg-white/5 pl-9 pr-9 py-2 text-base text-white ring-1 ring-white/10 placeholder:text-slate-400 transition-colors hover:bg-white/10 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Wis"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
}
