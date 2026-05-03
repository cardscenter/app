"use client";

import { useTranslations } from "next-intl";
import type { ListingStatus } from "@/types";

interface Props {
  status: ListingStatus;
  className?: string;
}

const STATUS_STYLES: Record<ListingStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  PAUSED: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  RESERVED: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  PARTIALLY_SOLD: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  SOLD: "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  DELETED: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
};

// Mapping naar i18n-keys — toLowerCase() werkt niet voor PARTIALLY_SOLD omdat
// dat dan "partially_sold" wordt en de keys zijn camelCase.
const STATUS_KEYS: Record<ListingStatus, string> = {
  ACTIVE: "status.active",
  PAUSED: "status.paused",
  RESERVED: "status.reserved",
  PARTIALLY_SOLD: "status.partiallySold",
  SOLD: "status.sold",
  DELETED: "status.deleted",
};

export function ListingStatusBadge({ status, className }: Props) {
  const t = useTranslations("listing");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]} ${className ?? ""}`}
    >
      {t(STATUS_KEYS[status])}
    </span>
  );
}
