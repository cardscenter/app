"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ShoppingBag,
  Store,
  Clock,
  CheckCircle2,
  Scale,
  Hourglass,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";
import {
  DISPUTE_V2_REASON_LABELS,
  DISPUTE_V2_STATUS_LABELS,
  DISPUTE_V2_OPEN_STATUSES,
  type DisputeV2ReasonCategory,
  type DisputeV2Status,
} from "@/lib/dispute-v2/config";

export type DisputeListItem = {
  id: string;
  orderNumber: string;
  reasonCategory: string;
  status: string;
  resolution: string | null;
  finalRefund: number | null;
  proposedRefund: number | null;
  proposedByMe: boolean;
  createdAt: string;
  resolvedAt: string | null;
  responseDeadline: string;
  reviewDeadline: string | null;
  adminSLADeadline: string | null;
  isBuyer: boolean;
  otherPartyName: string;
  totalCost: number;
};

const STATUS_TONE: Record<string, StatusTone> = {
  OPEN: "warning",
  SELLER_RESPONDED: "info",
  MEDIATION: "primary",
  ESCALATED: "danger",
  RESOLVED_BUYER: "success",
  RESOLVED_SELLER: "neutral",
  RESOLVED_MUTUAL: "success",
  RESOLVED_ADMIN: "success",
  CANCELLED: "neutral",
};

/**
 * Wat moet IK nu doen? — per status + rol één zin, zodat de lijst zelf al
 * vertelt bij wie de bal ligt (en tot wanneer).
 */
function nextStep(d: DisputeListItem, fmt: (iso: string) => string): { text: string; urgent: boolean } | null {
  switch (d.status) {
    case "OPEN":
      return d.isBuyer
        ? { text: `Wacht op reactie van de verkoper (tot ${fmt(d.responseDeadline)})`, urgent: false }
        : { text: `Reageer vóór ${fmt(d.responseDeadline)} — anders krijgt de koper automatisch alles terug`, urgent: true };
    case "SELLER_RESPONDED":
      return d.isBuyer
        ? { text: `Jouw beurt: intrekken, voorstel doen of beheerder inschakelen (tot ${d.reviewDeadline ? fmt(d.reviewDeadline) : "—"})`, urgent: true }
        : { text: `Wacht op de koper (tot ${d.reviewDeadline ? fmt(d.reviewDeadline) : "—"})`, urgent: false };
    case "MEDIATION":
      return d.proposedByMe
        ? { text: `Je voorstel van €${(d.proposedRefund ?? 0).toFixed(2)} wacht op antwoord (tot ${d.reviewDeadline ? fmt(d.reviewDeadline) : "—"})`, urgent: false }
        : { text: `Reageer op het voorstel van €${(d.proposedRefund ?? 0).toFixed(2)} (tot ${d.reviewDeadline ? fmt(d.reviewDeadline) : "—"})`, urgent: true };
    case "ESCALATED":
      return { text: `De beheerder beoordeelt het geschil${d.adminSLADeadline ? ` (streefdatum ${fmt(d.adminSLADeadline)})` : ""}`, urgent: false };
    default:
      return null;
  }
}

export function DisputesOverview({ disputes }: { disputes: DisputeListItem[] }) {
  const t = useTranslations("disputes");
  const locale = useLocale();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "short" });

  const buyerDisputes = disputes.filter((d) => d.isBuyer);
  const sellerDisputes = disputes.filter((d) => !d.isBuyer);

  const [activeTab, setActiveTab] = useState<"buyer" | "seller">(
    buyerDisputes.length > 0 ? "buyer" : sellerDisputes.length > 0 ? "seller" : "buyer",
  );

  const activeDisputes = activeTab === "buyer" ? buyerDisputes : sellerDisputes;
  const isOpen = (s: string) => DISPUTE_V2_OPEN_STATUSES.has(s as DisputeV2Status);
  const openList = activeDisputes.filter((d) => isOpen(d.status));
  const closedList = activeDisputes.filter((d) => !isOpen(d.status));

  if (disputes.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title={t("noDisputes")}
        description={t("noDisputesHint")}
      />
    );
  }

  const tabButton = (key: "buyer" | "seller", label: string, Icon: typeof ShoppingBag, count: number) => (
    <button
      onClick={() => setActiveTab(key)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        activeTab === key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count > 0 && (
        <span className="rounded-full bg-background px-1.5 py-0.5 text-xs font-semibold text-foreground">{count}</span>
      )}
    </button>
  );

  const renderRow = (d: DisputeListItem) => {
    const open = isOpen(d.status);
    const step = nextStep(d, fmt);
    const tone = STATUS_TONE[d.status] ?? "neutral";
    const Icon = d.status === "ESCALATED" ? Scale : open ? Clock : d.status === "CANCELLED" ? Hourglass : CheckCircle2;
    return (
      <Link
        key={d.id}
        href={`/dashboard/geschillen/${d.id}`}
        className={`block dash-card p-4 transition-colors hover:bg-muted/40 ${step?.urgent ? "border-l-4 border-l-amber-400 dark:border-l-amber-500" : ""}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                open ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{d.otherPartyName}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                  {d.orderNumber}
                </span>
                <StatusBadge tone={tone}>{DISPUTE_V2_STATUS_LABELS[d.status as DisputeV2Status] ?? d.status}</StatusBadge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span>{DISPUTE_V2_REASON_LABELS[d.reasonCategory as DisputeV2ReasonCategory] ?? d.reasonCategory}</span>
                <span>&middot;</span>
                <span>{fmt(d.createdAt)}</span>
                <span>&middot;</span>
                <span>&euro;{d.totalCost.toFixed(2)}</span>
                {d.finalRefund !== null && d.finalRefund > 0 && (
                  <>
                    <span>&middot;</span>
                    <span className="text-emerald-700 dark:text-emerald-400">terugbetaald &euro;{d.finalRefund.toFixed(2)}</span>
                  </>
                )}
              </div>
              {step && (
                <p className={`mt-1.5 text-xs ${step.urgent ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {step.urgent && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                  {step.text}
                </p>
              )}
            </div>
          </div>
          <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex w-full gap-1 dash-card p-1">
        {tabButton("buyer", t("tabAsBuyer"), ShoppingBag, buyerDisputes.length)}
        {tabButton("seller", t("tabAsSeller"), Store, sellerDisputes.length)}
      </div>

      {activeDisputes.length === 0 ? (
        <EmptyState icon={Scale} title={t("noDisputes")} compact />
      ) : (
        <>
          {openList.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[15px] font-semibold text-foreground">
                {t("sectionOpen")} <span className="text-muted-foreground">({openList.length})</span>
              </h2>
              {openList.map(renderRow)}
            </section>
          )}
          {closedList.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[15px] font-semibold text-foreground">
                {t("sectionClosed")} <span className="text-muted-foreground">({closedList.length})</span>
              </h2>
              {closedList.map(renderRow)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
