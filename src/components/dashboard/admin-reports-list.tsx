"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ExternalLink, Flag, AlertOctagon } from "lucide-react";
import { toast } from "sonner";
import { reviewReport } from "@/actions/block-report";
import { suspendUser, liftSuspension } from "@/actions/admin-suspension";

interface Report {
  id: string;
  reason: string;
  details: string;
  evidenceUrl: string | null;
  status: string;
  adminNote: string | null;
  reporterName: string;
  reviewerName: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface Group {
  reportedId: string;
  reportedName: string;
  reportedAccountType: string;
  reportedSuspended: boolean;
  openCount: number;
  reports: Report[];
}

export function AdminReportsList({ groups }: { groups: Group[] }) {
  const t = useTranslations("blockReport");

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noReports")}</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <ReportedUserGroup key={group.reportedId} group={group} />
      ))}
    </div>
  );
}

function ReportedUserGroup({ group }: { group: Group }) {
  const t = useTranslations("blockReport");

  return (
    <section className="glass rounded-xl p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            <Flag className="inline h-4 w-4 mr-1" />
            {group.reportedName}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {group.reportedAccountType}
            </span>
            {group.reportedSuspended && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                <AlertOctagon className="h-3 w-3" />
                {t("suspended")}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("totalReports", { count: group.reports.length })} —{" "}
            {t("openReports", { count: group.openCount })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/nl/verkoper/${group.reportedId}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            {t("viewProfile")}
          </a>
          <SuspendUserActions
            targetId={group.reportedId}
            targetName={group.reportedName}
            isSuspended={group.reportedSuspended}
          />
        </div>
      </div>

      <div className="space-y-3">
        {group.reports.map((r) => (
          <ReportRow key={r.id} report={r} />
        ))}
      </div>
    </section>
  );
}

function SuspendUserActions({
  targetId,
  targetName,
  isSuspended,
}: {
  targetId: string;
  targetName: string;
  isSuspended: boolean;
}) {
  const t = useTranslations("blockReport");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"TEMPORARY" | "PERMANENT">("TEMPORARY");
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");

  function handleSuspend(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("type", type);
    formData.set("reason", reason);
    if (type === "TEMPORARY") formData.set("days", days);

    startTransition(async () => {
      const result = await suspendUser(targetId, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("suspendSuccess", { name: targetName }));
      setShowForm(false);
      setReason("");
      router.refresh();
    });
  }

  function handleLift() {
    if (!confirm(t("confirmLift"))) return;
    startTransition(async () => {
      const result = await liftSuspension(targetId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("liftSuccess"));
      router.refresh();
    });
  }

  if (isSuspended) {
    return (
      <button
        onClick={handleLift}
        disabled={pending}
        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      >
        {t("liftSuspension")}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowForm((s) => !s)}
        disabled={pending}
        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950"
      >
        {t("suspendUser")}
      </button>
      {showForm && (
        <form
          onSubmit={handleSuspend}
          className="mt-3 w-full space-y-2 rounded-lg border border-red-300 bg-red-50/50 p-3 dark:border-red-800 dark:bg-red-950/30"
        >
          <div className="flex flex-wrap gap-2 text-xs">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={type === "TEMPORARY"}
                onChange={() => setType("TEMPORARY")}
              />
              {t("temporary")}
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={type === "PERMANENT"}
                onChange={() => setType("PERMANENT")}
              />
              {t("permanent")}
            </label>
          </div>
          {type === "TEMPORARY" && (
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor={`days-${targetId}`}>{t("days")}:</label>
              <input
                id={`days-${targetId}`}
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-20 glass-input px-2 py-1 text-foreground"
              />
            </div>
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder={t("suspendReasonPlaceholder")}
            className="block w-full glass-input px-2 py-1.5 text-sm text-foreground"
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || reason.trim().length < 5}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "..." : t("confirmSuspend")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function ReportRow({ report }: { report: Report }) {
  const t = useTranslations("blockReport");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showNote, setShowNote] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  const isClosed = report.status === "DISMISSED" || report.status === "ACTION_TAKEN";

  function handleAction(action: "DISMISS" | "ACTION_TAKEN") {
    startTransition(async () => {
      const result = await reviewReport(report.id, action, adminNote);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(action === "DISMISS" ? t("reportDismissed") : t("actionTaken"));
      setShowNote(false);
      setAdminNote("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-white/40 p-3 text-sm dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
              {t(`reason.${report.reason}` as never)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                report.status === "OPEN"
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                  : report.status === "REVIEWING"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                    : report.status === "ACTION_TAKEN"
                      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
              }`}
            >
              {t(`status.${report.status}` as never)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("byReporter", { name: report.reporterName })} —{" "}
              {new Date(report.createdAt).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </div>

          <p className="text-foreground">{report.details}</p>

          {report.evidenceUrl && (
            <a
              href={report.evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {t("evidenceLink")}
            </a>
          )}

          {report.adminNote && (
            <p className="mt-1 text-xs text-muted-foreground italic">
              {t("adminNoteLabel")}: {report.adminNote}
              {report.reviewerName && ` — ${report.reviewerName}`}
            </p>
          )}
        </div>
      </div>

      {!isClosed && (
        <div className="mt-3 space-y-2">
          {showNote && (
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder={t("adminNotePlaceholder")}
              className="block w-full glass-input px-3 py-2 text-sm text-foreground"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowNote((s) => !s)}
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              {showNote ? t("hideNote") : t("addNote")}
            </button>
            <button
              onClick={() => handleAction("ACTION_TAKEN")}
              disabled={pending}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {t("markActionTaken")}
            </button>
            <button
              onClick={() => handleAction("DISMISS")}
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              {t("dismissReport")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
