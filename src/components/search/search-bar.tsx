"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Search, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  variant: "header" | "hero";
  defaultValue?: string;
}

export function SearchBar({ variant, defaultValue = "" }: SearchBarProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      router.push(`/zoeken?q=${encodeURIComponent(trimmed)}`);
      setOpen(false);
    }
  }

  // Auto-focus when expanded
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on outside click + ESC
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

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

  // Header variant: collapsible icon → expanding search
  return (
    <div ref={wrapperRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={t("placeholder")}
      >
        <Search className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, width: 40 }}
            animate={{ opacity: 1, width: 420 }}
            exit={{ opacity: 0, width: 40 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="absolute right-0 top-1/2 z-50 -translate-y-1/2"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t("placeholder")}
                className="w-full rounded-lg bg-slate-800/95 pl-9 pr-9 py-2 text-sm text-white shadow-lg ring-1 ring-white/20 placeholder:text-slate-400 backdrop-blur-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Sluit zoekbalk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
