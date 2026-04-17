"use client";

import { useTranslations } from "next-intl";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  RECEIVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  INSPECTING: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  PARTIALLY_APPROVED: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const STATUS_KEYS: Record<string, string> = {
  PENDING: "statusPending",
  RECEIVED: "statusReceived",
  INSPECTING: "statusInspecting",
  APPROVED: "statusApproved",
  PARTIALLY_APPROVED: "statusPartiallyApproved",
  REJECTED: "statusRejected",
  PAID: "statusPaid",
  CANCELLED: "statusCancelled",
};

export function BuybackStatusBadge({ status }: { status: string }) {
  const t = useTranslations("buyback");
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING;
  const key = STATUS_KEYS[status] ?? "statusPending";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {t(key)}
    </span>
  );
}
