"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  locale: string;
  extraParams?: Record<string, string>;
}

export function Pagination({ currentPage, totalPages, baseUrl, locale, extraParams }: PaginationProps) {
  const t = useTranslations("listing");

  if (totalPages <= 1) return null;

  // Generate page numbers to show: first, last, current +/- 2, with ellipsis
  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  function pageUrl(page: number) {
    const params = new URLSearchParams(extraParams);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/${locale}${baseUrl}${qs ? `?${qs}` : ""}`;
  }

  return (
    <nav className="flex items-center justify-center gap-2 mt-8">
      {currentPage > 1 ? (
        <Link
          href={pageUrl(currentPage - 1)}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("previousPage")}
        </Link>
      ) : (
        <span className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/40">
          <ChevronLeft className="h-4 w-4" />
          {t("previousPage")}
        </span>
      )}

      {pages.map((page, idx) =>
        page === "..." ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
            &hellip;
          </span>
        ) : (
          <Link
            key={page}
            href={pageUrl(page)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              page === currentPage
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-white/60 dark:hover:bg-white/5"
            }`}
          >
            {page}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          href={pageUrl(currentPage + 1)}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
        >
          {t("nextPage")}
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/40">
          {t("nextPage")}
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
