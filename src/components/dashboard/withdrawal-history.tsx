"use client";

import { useTranslations } from "next-intl";
import { Clock, Check, CheckCircle2, XCircle } from "lucide-react";
import { maskIban } from "@/lib/validations/iban";

interface WithdrawalRow {
  id: string;
  amount: number;
  iban: string;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  paidAt: string | null;
  rejectedAt: string | null;
}

export function WithdrawalHistory({ requests }: { requests: WithdrawalRow[] }) {
  const t = useTranslations("withdrawal");

  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noHistory")}</p>;
  }

  return (
    <ul className="space-y-3">
      {requests.map((r) => {
        const created = new Date(r.createdAt);
        return (
          <li
            key={r.id}
            className="rounded-lg border border-border bg-white/40 px-4 py-3 text-sm dark:bg-white/5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">€{r.amount.toFixed(2)}</p>
                <p className="text-xs font-mono text-muted-foreground">{maskIban(r.iban)}</p>
                <p className="text-xs text-muted-foreground">
                  {created.toLocaleDateString("nl-NL", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {r.status === "REJECTED" && r.rejectReason && (
                  <p className="mt-1 text-xs text-red-500">
                    {t("rejectReasonLabel")}: {r.rejectReason}
                  </p>
                )}
              </div>
              <StatusBadge status={r.status} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("withdrawal");

  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
        <Clock className="h-3 w-3" />
        {t("statusPending")}
      </span>
    );
  }
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
        <Check className="h-3 w-3" />
        {t("statusApproved")}
      </span>
    );
  }
  if (status === "PAID") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        {t("statusPaid")}
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
        <XCircle className="h-3 w-3" />
        {t("statusRejected")}
      </span>
    );
  }
  return null;
}
