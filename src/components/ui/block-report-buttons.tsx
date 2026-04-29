"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Ban, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { blockUser, unblockUser, reportUser } from "@/actions/block-report";
import { REPORT_REASONS, type ReportReason } from "@/lib/blocking";

interface BlockReportButtonsProps {
  targetUserId: string;
  targetDisplayName: string;
  initiallyBlocked: boolean;
}

export function BlockReportButtons({ targetUserId, targetDisplayName, initiallyBlocked }: BlockReportButtonsProps) {
  const t = useTranslations("blockReport");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isBlocked, setIsBlocked] = useState(initiallyBlocked);
  const [showReport, setShowReport] = useState(false);
  const [reason, setReason] = useState<ReportReason>("SCAM");
  const [details, setDetails] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function toggleBlock() {
    startTransition(async () => {
      const result = isBlocked
        ? await unblockUser(targetUserId)
        : await blockUser(targetUserId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setIsBlocked(!isBlocked);
      toast.success(isBlocked ? t("unblocked") : t("blocked"));
      router.refresh();
    });
  }

  function handleReport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("reason", reason);
    formData.set("details", details);
    if (evidenceUrl) formData.set("evidenceUrl", evidenceUrl);

    startTransition(async () => {
      const result = await reportUser(targetUserId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(t("reportSubmitted"));
      setShowReport(false);
      setReason("SCAM");
      setDetails("");
      setEvidenceUrl("");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={toggleBlock}
          disabled={pending}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
            isBlocked
              ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-border text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <Ban className="h-3.5 w-3.5" />
          {isBlocked ? t("unblockButton") : t("blockButton")}
        </button>

        <button
          onClick={() => setShowReport((s) => !s)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950"
        >
          <CircleAlert className="h-3.5 w-3.5" />
          {t("reportButton")}
        </button>
      </div>

      {showReport && (
        <form
          onSubmit={handleReport}
          className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm"
        >
          <p className="text-xs text-muted-foreground">
            {t("reportingUser", { name: targetDisplayName })}
          </p>

          <div>
            <label className="block text-xs font-medium text-foreground">{t("reasonLabel")}</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="mt-1 block w-full glass-input px-3 py-2 text-sm text-foreground"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reason.${r}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground">{t("detailsLabel")}</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t("detailsPlaceholder")}
              className="mt-1 block w-full glass-input px-3 py-2 text-sm text-foreground"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground">{t("evidenceLabel")}</label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 block w-full glass-input px-3 py-2 text-sm text-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("evidenceHint")}</p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || details.trim().length < 10}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "..." : t("submitReport")}
            </button>
            <button
              type="button"
              onClick={() => setShowReport(false)}
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
