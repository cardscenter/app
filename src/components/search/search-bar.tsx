"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Search } from "lucide-react";
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

  // Header variant
  return (
    <form onSubmit={handleSubmit} className="hidden md:block flex-1 min-w-0 mx-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("placeholder")}
          className="w-full rounded-lg bg-white/10 pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-slate-400 transition-colors focus:bg-white/15 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>
    </form>
  );
}
