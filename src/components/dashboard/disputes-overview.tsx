"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ShoppingBag,
  Store,
  Clock,
  CheckCircle2,
  Scale,
} from "lucide-react";

type DisputeItem = {
  id: string;
  reason: string;
  status: string;
  resolution: string | null;
  partialRefundAmount: number | null;
  createdAt: string;
  resolvedAt: string | null;
  responseDeadline: string;
  buyerReviewDeadline: string | null;
  isBuyer: boolean;
  otherPartyName: string;
  totalCost: number;
  hasTracking: boolean;
};

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  SELLER_RESPONDED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  RESOLVED_BUYER: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  RESOLVED_SELLER: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  RESOLVED_MUTUAL: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  ESCALATED: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
};

const STATUS_ICONS: Record<string, typeof AlertTriangle> = {
  OPEN: Clock,
  SELLER_RESPONDED: AlertTriangle,
  RESOLVED_BUYER: CheckCircle2,
  RESOLVED_SELLER: CheckCircle2,
  RESOLVED_MUTUAL: CheckCircle2,
  ESCALATED: Scale,
};

const REASON_KEYS: Record<string, string> = {
  NOT_RECEIVED: "reasonNotReceived",
  NOT_AS_DESCRIBED: "reasonNotAsDescribed",
  DAMAGED_IN_TRANSIT: "reasonDamagedInTransit",
};

const STATUS_KEYS: Record<string, string> = {
  OPEN: "statusOpen",
  SELLER_RESPONDED: "statusSellerResponded",
  RESOLVED_BUYER: "statusResolvedBuyer",
  RESOLVED_SELLER: "statusResolvedSeller",
  RESOLVED_MUTUAL: "statusResolvedMutual",
  ESCALATED: "statusEscalated",
};

export function DisputesOverview({ disputes }: { disputes: DisputeItem[] }) {
  const t = useTranslations("disputes");
  const locale = useLocale();

  const buyerDisputes = disputes.filter((d) => d.isBuyer);
  const sellerDisputes = disputes.filter((d) => !d.isBuyer);

  const [activeTab, setActiveTab] = useState<"buyer" | "seller">(
    buyerDisputes.length > 0 ? "buyer" : sellerDisputes.length > 0 ? "seller" : "buyer"
  );

  const activeDisputes = activeTab === "buyer" ? buyerDisputes : sellerDisputes;
  const activeCount = activeDisputes.filter((d) => !d.status.startsWith("RESOLVED_")).length;
  const resolvedCount = activeDisputes.filter((d) => d.status.startsWith("RESOLVED_")).length;

  if (disputes.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted-foreground">{t("noDisputes")}</p>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Tabs: Als koper / Als verkoper */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
        <button
          onClick={() => setActiveTab("buyer")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "buyer"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingBag className={`h-4 w-4 ${activeTab === "buyer" ? "text-blue-500" : ""}`} />
          {t("tabAsBuyer")}
          {buyerDisputes.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
              activeTab === "buyer" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" : "bg-muted text-muted-foreground"
            }`}>
              {buyerDisputes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("seller")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "seller"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Store className={`h-4 w-4 ${activeTab === "seller" ? "text-purple-500" : ""}`} />
          {t("tabAsSeller")}
          {sellerDisputes.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
              activeTab === "seller" ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400" : "bg-muted text-muted-foreground"
            }`}>
              {sellerDisputes.length}
            </span>
          )}
        </button>
      </div>

      {/* Description */}
      <div className="glass-subtle rounded-xl p-4">
        <p className="text-sm text-muted-foreground">
          {activeTab === "buyer"
            ? "Geschillen die je als koper hebt geopend over bestellingen die je hebt gedaan."
            : "Geschillen die kopers hebben geopend over bestellingen die je als verkoper hebt afgehandeld."}
        </p>
      </div>

      {/* Dispute list */}
      {activeDisputes.length === 0 ? (
        <div className="rounded-xl glass-subtle p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("noDisputes")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeDisputes.map((dispute) => {
            const StatusIcon = STATUS_ICONS[dispute.status] ?? AlertTriangle;
            const isActive = !dispute.status.startsWith("RESOLVED_");
            const formattedDate = new Date(dispute.createdAt).toLocaleDateString(
              locale === "nl" ? "nl-NL" : "en-GB",
              { day: "numeric", month: "short", year: "numeric" }
            );

            return (
              <Link
                key={dispute.id}
                href={`/dashboard/geschillen/${dispute.id}`}
                className={`block rounded-xl glass p-4 transition-colors hover:bg-muted/30 ${
                  isActive ? "border-l-4 border-l-amber-400 dark:border-l-amber-500" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                      isActive
                        ? "bg-amber-100 dark:bg-amber-950"
                        : "bg-green-100 dark:bg-green-950"
                    }`}>
                      <StatusIcon className={`h-5 w-5 ${
                        isActive ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {dispute.otherPartyName}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${dispute.resolution === "ADMIN_DECISION" ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400" : (STATUS_BADGE[dispute.status] ?? STATUS_BADGE.OPEN)}`}>
                          {dispute.resolution === "ADMIN_DECISION" ? t("statusResolvedAdmin") : t(STATUS_KEYS[dispute.status] ?? "statusOpen")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{t(REASON_KEYS[dispute.reason] ?? "reasonNotReceived")}</span>
                        <span>&middot;</span>
                        <span>{formattedDate}</span>
                        <span>&middot;</span>
                        <span>&euro;{dispute.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
