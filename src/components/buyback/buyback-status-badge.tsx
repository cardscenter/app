"use client";

import { useTranslations } from "next-intl";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";

const STATUS_TONES: Record<string, StatusTone> = {
  PENDING: "warning",
  RECEIVED: "info",
  INSPECTING: "info",
  APPROVED: "success",
  PARTIALLY_APPROVED: "warning",
  REJECTED: "danger",
  RETURN_REQUESTED: "info",
  RETURNED: "neutral",
  PAID: "success",
  CANCELLED: "neutral",
};

const STATUS_KEYS: Record<string, string> = {
  PENDING: "statusPending",
  RECEIVED: "statusReceived",
  INSPECTING: "statusInspecting",
  APPROVED: "statusApproved",
  PARTIALLY_APPROVED: "statusPartiallyApproved",
  REJECTED: "statusRejected",
  RETURN_REQUESTED: "statusReturnRequested",
  RETURNED: "statusReturned",
  PAID: "statusPaid",
  CANCELLED: "statusCancelled",
};

export function BuybackStatusBadge({ status }: { status: string }) {
  const t = useTranslations("buyback");
  const tone = STATUS_TONES[status] ?? STATUS_TONES.PENDING;
  const key = STATUS_KEYS[status] ?? "statusPending";

  return <StatusBadge tone={tone}>{t(key)}</StatusBadge>;
}
