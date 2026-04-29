"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { approveWithdrawal, rejectWithdrawal, markWithdrawalPaid } from "@/actions/withdrawal";
import { formatIbanForDisplay } from "@/lib/validations/iban";

interface Row {
  id: string;
  amount: number;
  iban: string;
  accountHolderName: string;
  status: string;
  adminNote: string | null;
  rejectReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
  user: { id: string; displayName: string; email: string };
}

type Mode = "pending" | "approved" | "paid" | "rejected";

export function AdminWithdrawalsList({ rows, mode }: { rows: Row[]; mode: Mode }) {
  const t = useTranslations("withdrawal");

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noRecords")}</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <AdminWithdrawalRow key={r.id} row={r} mode={mode} />
      ))}
    </ul>
  );
}

function AdminWithdrawalRow({ row, mode }: { row: Row; mode: Mode }) {
  const t = useTranslations("withdrawal");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReasonText] = useState("");

  function refresh() {
    router.refresh();
  }

  function handleApprove() {
    startTransition(async () => {
      const res = await approveWithdrawal(row.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(t("approved"));
        refresh();
      }
    });
  }

  function handleMarkPaid() {
    if (!confirm(t("confirmMarkPaid"))) return;
    startTransition(async () => {
      const res = await markWithdrawalPaid(row.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success(t("markedPaid"));
        refresh();
      }
    });
  }

  function handleReject() {
    if (!rejectReason.trim()) {
      toast.error(t("rejectReasonRequired"));
      return;
    }
    startTransition(async () => {
      const res = await rejectWithdrawal(row.id, rejectReason);
      if (res.error) toast.error(res.error);
      else {
        toast.success(t("rejected"));
        setShowReject(false);
        setRejectReasonText("");
        refresh();
      }
    });
  }

  return (
    <li className="rounded-lg border border-border bg-white/40 px-4 py-3 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            €{row.amount.toFixed(2)} — {row.user.displayName}
          </p>
          <p className="text-xs text-muted-foreground">{row.user.email}</p>
          <p className="text-xs font-mono text-foreground">{formatIbanForDisplay(row.iban)}</p>
          <p className="text-xs text-muted-foreground">{row.accountHolderName}</p>
          <p className="text-xs text-muted-foreground">
            {t("requestedOn")}:{" "}
            {new Date(row.createdAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
          </p>
          {row.approvedAt && (
            <p className="text-xs text-muted-foreground">
              {t("approvedOn")}:{" "}
              {new Date(row.approvedAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
          {row.paidAt && (
            <p className="text-xs text-green-600 dark:text-green-400">
              {t("paidOn")}:{" "}
              {new Date(row.paidAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
          {row.rejectedAt && row.rejectReason && (
            <p className="text-xs text-red-500">
              {t("rejectReasonLabel")}: {row.rejectReason}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {mode === "pending" && (
            <>
              <button
                onClick={handleApprove}
                disabled={pending}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {t("approveAction")}
              </button>
              <button
                onClick={() => setShowReject((s) => !s)}
                disabled={pending}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                {t("rejectAction")}
              </button>
            </>
          )}
          {mode === "approved" && (
            <>
              <button
                onClick={handleMarkPaid}
                disabled={pending}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {t("markPaidAction")}
              </button>
              <button
                onClick={() => setShowReject((s) => !s)}
                disabled={pending}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                {t("rejectAction")}
              </button>
            </>
          )}
        </div>
      </div>

      {showReject && (mode === "pending" || mode === "approved") && (
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <label className="block text-xs font-medium text-foreground">{t("rejectReasonLabel")}</label>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReasonText(e.target.value)}
            placeholder={t("rejectReasonPlaceholder")}
            className="block w-full glass-input px-3 py-2 text-sm text-foreground"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={pending || !rejectReason.trim()}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {t("rejectConfirm")}
            </button>
            <button
              onClick={() => {
                setShowReject(false);
                setRejectReasonText("");
              }}
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
