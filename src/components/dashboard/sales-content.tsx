"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  AlertTriangle,
  MapPin,
  Receipt,
} from "lucide-react";
import Image from "next/image";
import { ShipBundleForm } from "./ship-bundle-form";

type BundleItem = {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  imageUrl: string | null;
};

type DisputeInfo = {
  id: string;
  status: string;
  reason: string;
};

type SaleBundle = {
  id: string;
  buyerName: string;
  buyerId: string;
  status: string;
  shippingCost: number;
  totalItemCost: number;
  totalCost: number;
  shippingMethodCarrier: string | null;
  shippingMethodService: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  createdAt: string;
  sourceType: "claimsale" | "auction" | "listing";
  sourceTitle: string | null;
  sourceImageUrl: string | null;
  buyerStreet: string | null;
  buyerHouseNumber: string | null;
  buyerPostalCode: string | null;
  buyerCity: string | null;
  buyerCountry: string | null;
  disputeInfo: DisputeInfo | null;
  items: BundleItem[];
};

type Stats = {
  totalRevenue: number;
  itemsSold: number;
  pendingShipments: number;
};

const TABS = ["PAID", "SHIPPED", "COMPLETED", "CANCELLED", "DISPUTED"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, typeof Package> = {
  PAID: Package,
  SHIPPED: Truck,
  COMPLETED: CheckCircle2,
  CANCELLED: XCircle,
  DISPUTED: AlertTriangle,
};

const TAB_COLORS: Record<Tab, string> = {
  PAID: "text-blue-600 dark:text-blue-400",
  SHIPPED: "text-purple-600 dark:text-purple-400",
  COMPLETED: "text-green-600 dark:text-green-400",
  CANCELLED: "text-red-600 dark:text-red-400",
  DISPUTED: "text-amber-600 dark:text-amber-400",
};

const STATUS_BADGE: Record<Tab, string> = {
  PAID: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  SHIPPED: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  DISPUTED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
};

const AUTO_CONFIRM_DAYS = 30;

const TAB_KEYS: Record<Tab, string> = {
  PAID: "tabPaid",
  SHIPPED: "tabShipped",
  COMPLETED: "tabCompleted",
  CANCELLED: "tabCancelled",
  DISPUTED: "tabDisputed",
};

const STATUS_KEYS: Record<Tab, string> = {
  PAID: "statusPaid",
  SHIPPED: "statusShipped",
  COMPLETED: "statusCompleted",
  CANCELLED: "statusCancelled",
  DISPUTED: "statusDisputed",
};

export function SalesContent({ bundles, stats }: { bundles: SaleBundle[]; stats: Stats }) {
  const t = useTranslations("sales");
  const locale = useLocale();

  const counts: Record<Tab, number> = {
    PAID: bundles.filter((b) => b.status === "PAID").length,
    SHIPPED: bundles.filter((b) => b.status === "SHIPPED").length,
    COMPLETED: bundles.filter((b) => b.status === "COMPLETED").length,
    CANCELLED: bundles.filter((b) => b.status === "CANCELLED").length,
    DISPUTED: bundles.filter((b) => b.status === "DISPUTED").length,
  };

  // Hide tabs with 0 items (except PAID/SHIPPED/COMPLETED which always show)
  const visibleTabs = TABS.filter(
    (tab) => counts[tab] > 0 || tab === "PAID" || tab === "SHIPPED" || tab === "COMPLETED"
  );

  const defaultTab = visibleTabs.find((tab) => counts[tab] > 0) ?? "PAID";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const filtered = bundles.filter((b) => b.status === activeTab);

  return (
    <div className="mt-6 space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-muted-foreground">{t("totalRevenue")}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">&euro;{stats.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-muted-foreground">{t("itemsSold")}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.itemsSold}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-sm text-muted-foreground">{t("pendingShipments")}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.pendingShipments}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 overflow-x-auto">
        {visibleTabs.map((tab) => {
          const Icon = TAB_ICONS[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? TAB_COLORS[tab] : ""}`} />
              <span className="hidden sm:inline">{t(TAB_KEYS[tab])}</span>
              {counts[tab] > 0 && (
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    isActive ? STATUS_BADGE[tab] : "bg-muted text-muted-foreground"
                  }`}
                >
                  {counts[tab]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bundle list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl glass-subtle p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("noSales")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((bundle) => (
            <SaleBundleCard key={bundle.id} bundle={bundle} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function SaleBundleCard({ bundle, locale }: { bundle: SaleBundle; locale: string }) {
  const t = useTranslations("sales");
  const [expanded, setExpanded] = useState(false);

  const date = new Date(bundle.createdAt);
  const formattedDate = date.toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const autoConfirmDate = bundle.shippedAt
    ? new Date(new Date(bundle.shippedAt).getTime() + AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const autoConfirmFormatted = autoConfirmDate?.toLocaleDateString(
    locale === "nl" ? "nl-NL" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" }
  );

  const shippingLabel = bundle.shippingMethodCarrier
    ? `${bundle.shippingMethodCarrier} — ${bundle.shippingMethodService}`
    : t("noShippingMethod");

  const statusTab = bundle.status as Tab;

  const hasAddress = bundle.buyerStreet && bundle.buyerCity;

  return (
    <div className="rounded-xl glass overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/verkoper/${bundle.buyerId}`}
                className="text-sm font-semibold text-foreground hover:text-primary truncate"
              >
                {bundle.buyerName}
              </Link>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_BADGE[statusTab] ?? STATUS_BADGE.PAID
                }`}
              >
                {t(STATUS_KEYS[statusTab] ?? "statusPaid")}
              </span>
              {bundle.disputeInfo && (
                <Link
                  href={`/dashboard/geschillen/${bundle.disputeInfo.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {t("viewDispute")}
                </Link>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              <span>{formattedDate}</span>
              {bundle.sourceType === "claimsale" ? (
                <span>{t("items", { count: bundle.items.length })}</span>
              ) : (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                  {bundle.sourceType === "auction" ? t("sourceAuction") : t("sourceListing")}
                </span>
              )}
              <span>{shippingLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-foreground">
            &euro;{bundle.totalCost.toFixed(2)}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Collapsed hints */}
      {!expanded && bundle.status === "PAID" && (
        <div className="border-t border-border/50 px-4 py-2">
          <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
            <Package className="h-3.5 w-3.5" />
            <span>{t("statusPaid")}</span>
          </div>
        </div>
      )}

      {!expanded && bundle.status === "SHIPPED" && (
        <div className="border-t border-border/50 px-4 py-2 flex items-center gap-3">
          {bundle.trackingUrl && (
            <a
              href={bundle.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {t("trackingLink")}
            </a>
          )}
          {autoConfirmFormatted && (
            <span className="text-xs text-muted-foreground">
              {t("autoConfirmInfo", { date: autoConfirmFormatted })}
            </span>
          )}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border/50">
          {/* Buyer address */}
          {hasAddress && (bundle.status === "PAID" || bundle.status === "SHIPPED" || bundle.status === "DISPUTED") && (
            <div className="px-4 py-3 border-b border-border/50">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t("shippingAddress")}</p>
                  <p className="text-sm text-foreground">
                    {bundle.buyerStreet} {bundle.buyerHouseNumber}
                  </p>
                  <p className="text-sm text-foreground">
                    {bundle.buyerPostalCode} {bundle.buyerCity}
                  </p>
                  {bundle.buyerCountry && (
                    <p className="text-sm text-muted-foreground">{bundle.buyerCountry}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="divide-y divide-border/50">
            {bundle.items.length > 0 ? (
              bundle.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  {item.imageUrl ? (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <Image src={item.imageUrl} alt={item.cardName} fill className="object-cover" sizes="48px" />
                    </div>
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.cardName}</p>
                    <p className="text-xs text-muted-foreground">{item.condition}</p>
                  </div>
                  <span className="text-sm font-medium text-foreground shrink-0">
                    &euro;{item.price.toFixed(2)}
                  </span>
                </div>
              ))
            ) : bundle.sourceTitle ? (
              <div className="flex items-center gap-3 px-4 py-3">
                {bundle.sourceImageUrl ? (
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Image src={bundle.sourceImageUrl} alt={bundle.sourceTitle} fill className="object-cover" sizes="48px" />
                  </div>
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{bundle.sourceTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {bundle.sourceType === "auction" ? t("sourceAuction") : t("sourceListing")}
                  </p>
                </div>
                <span className="text-sm font-medium text-foreground shrink-0">
                  &euro;{bundle.totalItemCost.toFixed(2)}
                </span>
              </div>
            ) : null}
          </div>

          {/* Cost summary */}
          <div className="border-t border-border/50 px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t("itemsCost")}</span>
              <span>&euro;{bundle.totalItemCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t("shippingCost")}</span>
              <span>&euro;{bundle.shippingCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-foreground pt-1.5 border-t border-border/50">
              <span>{t("totalCost")}</span>
              <span>&euro;{bundle.totalCost.toFixed(2)}</span>
            </div>
          </div>

          {/* PAID: Ship bundle form */}
          {bundle.status === "PAID" && (
            <div className="border-t border-border/50 px-4 py-3">
              <ShipBundleForm bundleId={bundle.id} />
            </div>
          )}

          {/* SHIPPED: tracking + auto-confirm info */}
          {bundle.status === "SHIPPED" && (
            <div className="border-t border-border/50 px-4 py-3 space-y-2">
              {bundle.trackingUrl && (
                <a
                  href={bundle.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("trackingLink")}
                </a>
              )}
              {autoConfirmFormatted && (
                <p className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {t("autoConfirmInfo", { date: autoConfirmFormatted })}
                </p>
              )}
            </div>
          )}

          {/* Escrow info for PAID/SHIPPED */}
          {(bundle.status === "PAID" || bundle.status === "SHIPPED") && (
            <div className="border-t border-border/50 px-4 py-2">
              <p className="text-xs text-muted-foreground italic">{t("escrowInfo")}</p>
            </div>
          )}

          {/* Dispute info for DISPUTED */}
          {bundle.status === "DISPUTED" && bundle.disputeInfo && (
            <div className="border-t border-border/50 px-4 py-3">
              <Link
                href={`/dashboard/geschillen/${bundle.disputeInfo.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900"
              >
                <AlertTriangle className="h-4 w-4" />
                {t("viewDispute")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
