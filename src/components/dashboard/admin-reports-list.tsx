"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ExternalLink, Flag, AlertOctagon } from "lucide-react";
import { toast } from "sonner";
import { reviewReport } from "@/actions/block-report";
import { suspendUser, liftSuspension } from "@/actions/admin-suspension";
import { DashboardSection } from "@/components/dashboard/ui/section";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";
import { cn } from "@/lib/utils";
import { PILL_BTN_SM, PILL_RED_SM, INPUT, TEXTAREA } from "@/components/ploy/tile-styles";

const REPORT_STATUS_TONE: Record<string, StatusTone> = {
  OPEN: "warning",
  REVIEWING: "info",
  ACTION_TAKEN: "success",
  DISMISSED: "neutral",
};

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
    return <EmptyState icon={Flag} title={t("noReports")} compact />;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <ReportedUserGroup key={group.reportedId} group={group} />
      ))}
    </div>
  );
}

function ReportedUserGroup({ group }: { group: Group }) {
  const t = useTranslations("blockReport");
  const [showSuspendForm, setShowSuspendForm] = useState(false);

  return (
    <DashboardSection
      title={group.reportedName}
      icon={<Flag className="h-4 w-4" />}
      description={`${t("totalReports", { count: group.reports.length })} · ${t("openReports", { count: group.openCount })}`}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge tone="neutral">{group.reportedAccountType}</StatusBadge>
          {group.reportedSuspended && (
            <StatusBadge tone="danger" icon={AlertOctagon}>
              {t("suspended")}
            </StatusBadge>
          )}
          <a
            href={`/nl/spelers/${group.reportedId}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            {t("viewProfile")}
          </a>
          <SuspendUserActions
            targetId={group.reportedId}
            isSuspended={group.reportedSuspended}
            formOpen={showSuspendForm}
            onToggleForm={() => setShowSuspendForm((s) => !s)}
          />
        </div>
      }
      contentClassName="space-y-3"
    >
      {showSuspendForm && !group.reportedSuspended && (
        <SuspendUserForm
          targetId={group.reportedId}
          targetName={group.reportedName}
          onClose={() => setShowSuspendForm(false)}
        />
      )}
      {group.reports.map((r) => (
        <ReportRow key={r.id} report={r} />
      ))}
    </DashboardSection>
  );
}

/** Header-knop: opschorting opheffen (isSuspended) of het opschort-formulier togglen. */
function SuspendUserActions({
  targetId,
  isSuspended,
  formOpen,
  onToggleForm,
}: {
  targetId: string;
  isSuspended: boolean;
  formOpen: boolean;
  onToggleForm: () => void;
}) {
  const t = useTranslations("blockReport");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
        className="cc-pill inline-flex items-center bg-[var(--pastel-yellow)] px-3 py-1.5 text-xs font-semibold text-[var(--pastel-yellow-ink)] transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {t("liftSuspension")}
      </button>
    );
  }

  return (
    <button
      onClick={onToggleForm}
      disabled={pending}
      aria-expanded={formOpen}
      className={`${PILL_RED_SM} disabled:opacity-50`}
    >
      {t("suspendUser")}
    </button>
  );
}

/** Opschort-formulier — gerenderd in de kaart-body (niet in de header-slot) zodat het volle breedte krijgt. */
function SuspendUserForm({
  targetId,
  targetName,
  onClose,
}: {
  targetId: string;
  targetName: string;
  onClose: () => void;
}) {
  const t = useTranslations("blockReport");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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
      setReason("");
      onClose();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSuspend}
      className="space-y-3 rounded-[14px] bg-[var(--pastel-pink)] p-4 text-[var(--pastel-pink-ink)]"
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
            className={cn(INPUT, "w-20")}
          />
        </div>
      )}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        placeholder={t("suspendReasonPlaceholder")}
        className={TEXTAREA}
        required
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || reason.trim().length < 5}
          className={`${PILL_RED_SM} disabled:opacity-50`}
        >
          {pending ? "..." : t("confirmSuspend")}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={`${PILL_BTN_SM} disabled:opacity-50`}
        >
          {t("cancel")}
        </button>
      </div>
    </form>
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
    <div className="rounded-[12px] bg-[var(--background)] p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="danger">{t(`reason.${report.reason}` as never)}</StatusBadge>
            <StatusBadge tone={REPORT_STATUS_TONE[report.status] ?? "neutral"}>
              {t(`status.${report.status}` as never)}
            </StatusBadge>
            <span className="text-xs text-muted-foreground">
              {t("byReporter", { name: report.reporterName })} ·{" "}
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
              {report.reviewerName && ` · ${report.reviewerName}`}
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
              className={INPUT}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowNote((s) => !s)}
              disabled={pending}
              className={`${PILL_BTN_SM} disabled:opacity-50`}
            >
              {showNote ? t("hideNote") : t("addNote")}
            </button>
            <button
              onClick={() => handleAction("ACTION_TAKEN")}
              disabled={pending}
              className={`${PILL_RED_SM} disabled:opacity-50`}
            >
              {t("markActionTaken")}
            </button>
            <button
              onClick={() => handleAction("DISMISS")}
              disabled={pending}
              className={`${PILL_BTN_SM} disabled:opacity-50`}
            >
              {t("dismissReport")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
