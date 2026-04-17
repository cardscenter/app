"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BuybackStatusBadge } from "./buyback-status-badge";
import { Calculator, Package, ChevronRight, Search } from "lucide-react";
import type { BuybackRequest, BuybackItem, BulkBuybackItem } from "@prisma/client";

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

  const statuses = ["all", "PENDING", "RECEIVED", "INSPECTING", "APPROVED", "PARTIALLY_APPROVED", "REJECTED", "PAID"];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek op gebruiker of ID..."
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? t("filterAll") : s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass overflow-hidden rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Gebruiker</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-center">Items</th>
              <th className="px-4 py-3 text-right">Bedrag</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.map((req) => (
              <tr key={req.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">
                  <p className="font-medium">{req.user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{req.user.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    {req.type === "COLLECTION" ? (
                      <Calculator className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Package className="h-3.5 w-3.5 text-amber-600" />
                    )}
                    {req.type === "COLLECTION" ? t("typeCollection") : t("typeBulk")}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">{req.totalItems}</td>
                <td className="px-4 py-3 text-right font-medium">
                  €{(req.finalPayout ?? req.estimatedPayout).toFixed(2)}
                  {req.payoutMethod === "STORE_CREDIT" && (
                    <span className="ml-1 text-xs text-emerald-600">+tegoed</span>
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
                    href={`/dashboard/inkoop/admin/${req.id}`}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    {t("adminInspect")} <ChevronRight className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t("noRequests")}
          </div>
        )}
      </div>
    </div>
  );
}
