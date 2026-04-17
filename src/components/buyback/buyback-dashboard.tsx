"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BuybackStatusBadge } from "./buyback-status-badge";
import { Calculator, Package, ChevronRight } from "lucide-react";
import type { BuybackRequest, BuybackItem, BulkBuybackItem } from "@prisma/client";

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
  in_progress: ["RECEIVED", "INSPECTING"],
  completed: ["APPROVED", "PARTIALLY_APPROVED", "REJECTED", "PAID", "CANCELLED"],
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
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === tb.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Requests list */}
      {filtered.length === 0 ? (
        <div className="glass flex flex-col items-center gap-4 rounded-xl p-10 text-center">
          <Package className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="font-medium">{t("noRequests")}</p>
            <p className="text-sm text-muted-foreground">{t("noRequestsDesc")}</p>
          </div>
          <Link
            href="/verkoop-calculator"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Calculator className="h-4 w-4" /> {t("createNew")}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <Link
              key={req.id}
              href={`/dashboard/inkoop/${req.id}`}
              className="glass flex items-center gap-4 rounded-xl p-4 transition-all hover:ring-1 hover:ring-primary/30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                {req.type === "COLLECTION" ? (
                  <Calculator className="h-5 w-5 text-primary" />
                ) : (
                  <Package className="h-5 w-5 text-amber-600" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {req.type === "COLLECTION" ? t("typeCollection") : t("typeBulk")} —{" "}
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

              <div className="text-right">
                <p className="text-sm font-bold">
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
