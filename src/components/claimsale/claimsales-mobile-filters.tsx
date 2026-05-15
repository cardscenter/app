"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { ClaimsalesFilterSidebar } from "./claimsales-filter-sidebar";
import {
  countActiveClaimsaleFilters,
  parseClaimsaleFilters,
} from "@/lib/claimsale-filters";

interface ClaimsalesMobileFiltersProps {
  buyerHasPostcode: boolean;
}

export function ClaimsalesMobileFilters({ buyerHasPostcode }: ClaimsalesMobileFiltersProps) {
  const [open, setOpen] = useState(false);
  const sp = useSearchParams();
  const filters = parseClaimsaleFilters(
    Object.fromEntries(sp.entries()) as Record<string, string>,
  );
  const activeCount = countActiveClaimsaleFilters(filters);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <SlidersHorizontal className="size-4" />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative ml-auto h-full w-full max-w-sm overflow-y-auto bg-card shadow-xl">
            <ClaimsalesFilterSidebar
              buyerHasPostcode={buyerHasPostcode}
              variant="drawer"
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
