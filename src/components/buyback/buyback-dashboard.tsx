"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BuybackStatusBadge } from "./buyback-status-badge";
import { Calculator, Package, ChevronRight } from "lucide-react";
import type { BuybackRequest, BuybackItem, BulkBuybackItem } from "@prisma/client";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { TONE_ICON } from "@/components/dashboard/ui/tones";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type RequestWithItems = BuybackRequest & {
  items: BuybackItem[];
  bulkItems: BulkBuybackItem[];
};

interface BuybackDashboardProps {
  requests: RequestWithItems[];
}

type FilterTab = "all" | "pending" | "in_progress" | "completed";

const TAB_STATUSES: Record<FilterTab, string[]> = {
  all: [],
  pending: ["PENDING"],
  in_progress: ["RECEIVED", "INSPECTING", "PARTIALLY_APPROVED", "REJECTED", "RETURN_REQUESTED"],
  completed: ["APPROVED", "RETURNED", "PAID", "CANCELLED"],
};

export function BuybackDashboard({ requests }: BuybackDashboardProps) {
  const t = useTranslations("buyback");
  const [tab, setTab] = useState<FilterTab>("all");

  const filtered = tab === "all"
    ? requests
    : requests.filter((r) => TAB_STATUSES[tab].includes(r.status));

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "pending", label: t("filterPending") },
    { key: "in_progress", label: t("filterInProgress") },
    { key: "completed", label: t("filterCompleted") },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            aria-pressed={tab === tb.key}
            className={cn(
              "cc-pill inline-flex h-9 shrink-0 items-center px-4 text-sm font-semibold whitespace-nowrap transition-colors",
              tab === tb.key
                ? "bg-foreground text-white"
                : "bg-white text-foreground/70 hover:text-foreground"
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Requests list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("noRequests")}
          description={t("noRequestsDesc")}
          action={
            <Link href="/verkopen" className={buttonVariants()}>
              <Calculator className="h-4 w-4" /> {t("createNew")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <Link
              key={req.id}
              href={`/dashboard/inkoop/${req.id}`}
              className="dash-card flex items-center gap-4 p-4 transition-shadow hover:shadow-card-hover"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  req.type === "COLLECTION" ? TONE_ICON.blue : TONE_ICON.yellow
                )}
              >
                {req.type === "COLLECTION" ? (
                  <Calculator className="h-5 w-5" />
                ) : (
                  <Package className="h-5 w-5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {req.type === "COLLECTION" ? t("typeCollection") : t("typeBulk")} ·{" "}
                  {req.totalItems} {req.totalItems === 1 ? "kaart" : "kaarten"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(req.createdAt).toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1 text-right">
                <p className="text-sm font-bold tabular-nums">
                  €{(req.finalPayout ?? req.estimatedPayout).toFixed(2)}
                </p>
                <BuybackStatusBadge status={req.status} />
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
