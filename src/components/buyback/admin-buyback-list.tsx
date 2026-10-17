"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BuybackStatusBadge } from "./buyback-status-badge";
import { Calculator, Package, ChevronRight, Search } from "lucide-react";
import type { BuybackRequest, BuybackItem, BulkBuybackItem } from "@prisma/client";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { INPUT, PILL_BTN_SM, SELECT, TABLE_HEAD } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";

type RequestWithUser = BuybackRequest & {
  user: { displayName: string; email: string };
  items: BuybackItem[];
  bulkItems: BulkBuybackItem[];
};

interface AdminBuybackListProps {
  requests: RequestWithUser[];
}

export function AdminBuybackList({ requests }: AdminBuybackListProps) {
  const t = useTranslations("buyback");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        r.user.displayName.toLowerCase().includes(q) ||
        r.user.email.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const statuses = ["all", "PENDING", "RECEIVED", "INSPECTING", "APPROVED", "PARTIALLY_APPROVED", "REJECTED", "RETURN_REQUESTED", "RETURNED", "PAID", "CANCELLED"];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek op gebruiker of ID..."
            className={cn(INPUT, "py-2.5 pl-9")}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={cn(SELECT, "w-auto py-2.5")}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? t("filterAll") : s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length > 0 && (
      <div className="dash-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={cn(TABLE_HEAD, "bg-[var(--background)]")}>
            <tr>
              <th className="px-4 py-3">Gebruiker</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-center">Items</th>
              <th className="px-4 py-3 text-right">Bedrag</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((req) => (
              <tr key={req.id} className="transition-colors hover:bg-[var(--background)]/60">
                <td className="px-4 py-3">
                  <p className="font-semibold">{req.user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{req.user.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    {req.type === "COLLECTION" ? (
                      <Calculator className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Package className="h-3.5 w-3.5 text-[var(--pastel-yellow-ink)]" />
                    )}
                    {req.type === "COLLECTION" ? t("typeCollection") : t("typeBulk")}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">{req.totalItems}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  €{(req.finalPayout ?? req.estimatedPayout).toFixed(2)}
                  {req.payoutMethod === "STORE_CREDIT" && (
                    <span className="ml-1 text-xs text-[var(--pastel-green-ink)]">+tegoed</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <BuybackStatusBadge status={req.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(req.createdAt).toLocaleDateString("nl-NL", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/admin/buybacks/${req.id}`}
                    className={PILL_BTN_SM}
                  >
                    {t("adminInspect")} <ChevronRight className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      )}
      {filtered.length === 0 && <EmptyState icon={Package} title={t("noRequests")} compact />}
    </div>
  );
}
