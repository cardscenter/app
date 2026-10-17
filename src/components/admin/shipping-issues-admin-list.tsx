"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Truck, ExternalLink, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import {
  startInvestigatingShippingIssue,
  resolveShippingIssueGoodwill,
  resolveShippingIssueNoAction,
  escalateShippingIssueToDispute,
} from "@/actions/shipping-issue";
import {
  GOODWILL_REFUND_MAX,
  SHIPPING_ISSUE_TYPE_LABELS,
  type ShippingIssueType,
} from "@/lib/shipping-issue/config";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/dashboard/ui/status-badge";
import { cn } from "@/lib/utils";
import { PILL_BTN_SM, PILL_RED_SM, INPUT, TEXTAREA } from "@/components/ploy/tile-styles";

type IssueData = {
  id: string;
  type: string;
  status: string;
  description: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; displayName: string };
  bundle: {
    id: string;
    orderNumber: string;
    totalCost: number;
    status: string;
    shippedAt: string | null;
    trackingUrl: string | null;
    buyer: { id: string; displayName: string };
    seller: { id: string; displayName: string };
  };
};

const STATUS_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  OPEN: { label: "Open", tone: "warning" },
  INVESTIGATING: { label: "In onderzoek", tone: "info" },
  RESOLVED_GOODWILL: { label: "Goodwill", tone: "success" },
  RESOLVED_NO_ACTION: { label: "Geen actie", tone: "neutral" },
  ESCALATED_TO_DISPUTE: { label: "Geëscaleerd", tone: "danger" },
};

const STATUS_TABS = ["OPEN", "INVESTIGATING", "RESOLVED_GOODWILL", "RESOLVED_NO_ACTION", "ESCALATED_TO_DISPUTE", "ALL"] as const;

export function ShippingIssuesAdminList({
  issues,
  currentStatus,
}: {
  issues: IssueData[];
  currentStatus: string;
}) {
  const router = useRouter();

  return (
    <div className="mt-6 space-y-4">
      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => router.push(`/dashboard/admin/shipping-issues?status=${s}`)}
            className={
              currentStatus === s
                ? "cc-pill inline-flex h-9 items-center px-4 text-sm font-semibold whitespace-nowrap bg-foreground text-white"
                : "cc-pill inline-flex h-9 items-center px-4 text-sm font-semibold whitespace-nowrap bg-white text-foreground/70 transition-colors hover:text-foreground"
            }
          >
            {s === "ALL" ? "Alle" : STATUS_LABELS[s]?.label ?? s}
          </button>
        ))}
      </div>

      {issues.length === 0 ? (
        <EmptyState icon={Truck} title="Geen tickets in deze status." compact />
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue }: { issue: IssueData }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<"goodwill" | "noaction" | "escalate" | null>(null);
  const [goodwillAmount, setGoodwillAmount] = useState("");
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(false);

  const statusMeta = STATUS_LABELS[issue.status] ?? { label: issue.status, tone: "neutral" as StatusTone };
  const isActive = issue.status === "OPEN" || issue.status === "INVESTIGATING";

  async function handleStartInvestigating() {
    setLoading(true);
    const result = await startInvestigatingShippingIssue(issue.id);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Markeerd als onder onderzoek");
    router.refresh();
  }

  async function handleSubmit() {
    if (resolution.length < 20) {
      toast.error("Vul minimaal 20 tekens onderbouwing in");
      return;
    }
    setLoading(true);
    let result;
    if (action === "goodwill") {
      const parsed = parseFloat(goodwillAmount);
      if (!isFinite(parsed) || parsed <= 0 || parsed > GOODWILL_REFUND_MAX) {
        toast.error(`Bedrag tussen €0,01 en €${GOODWILL_REFUND_MAX.toFixed(2)}`);
        setLoading(false);
        return;
      }
      result = await resolveShippingIssueGoodwill({
        issueId: issue.id,
        amount: parsed,
        resolution,
      });
    } else if (action === "noaction") {
      result = await resolveShippingIssueNoAction({ issueId: issue.id, resolution });
    } else if (action === "escalate") {
      result = await escalateShippingIssueToDispute({ issueId: issue.id, adminStatement: resolution });
    } else {
      setLoading(false);
      return;
    }
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Ticket afgerond");
    router.refresh();
  }

  return (
    <div className="overflow-hidden dash-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-[var(--background)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
            <span className="text-xs font-medium text-foreground">
              {SHIPPING_ISSUE_TYPE_LABELS[issue.type as ShippingIssueType] ?? issue.type}
            </span>
            <span className="text-xs text-muted-foreground">
              {issue.bundle.buyer.displayName} ↔ {issue.bundle.seller.displayName}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {issue.bundle.orderNumber}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{issue.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-foreground tabular-nums">&euro;{issue.bundle.totalCost.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">
            {new Date(issue.createdAt).toLocaleDateString("nl-NL")}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border p-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Beschrijving van {issue.reporter.displayName}:</p>
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{issue.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Verzonden op</p>
              <p className="font-medium text-foreground">
                {issue.bundle.shippedAt ? new Date(issue.bundle.shippedAt).toLocaleDateString("nl-NL") : "onbekend"}
              </p>
            </div>
            {issue.bundle.trackingUrl && (
              <div>
                <p className="text-xs text-muted-foreground">Tracking</p>
                <a href={issue.bundle.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Open
                </a>
              </div>
            )}
          </div>

          {issue.resolution && (
            <div className="rounded-[12px] bg-[var(--background)] p-3">
              <p className="text-xs font-semibold text-muted-foreground">Admin-onderbouwing</p>
              <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{issue.resolution}</p>
            </div>
          )}

          {/* Admin actions */}
          {isActive && (
            <div className="space-y-3 border-t border-border pt-3">
              {issue.status === "OPEN" && (
                <button
                  onClick={handleStartInvestigating}
                  disabled={loading}
                  className={`${PILL_BTN_SM} disabled:opacity-50`}
                >
                  <Clock className="h-3 w-3" /> Markeer als onder onderzoek
                </button>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAction(action === "goodwill" ? null : "goodwill")}
                  className={`cc-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                    action === "goodwill" ? "bg-[var(--pastel-green)] text-[var(--pastel-green-ink)]" : "border border-border bg-white text-foreground hover:bg-[var(--background)]"
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" /> Goodwill-credit
                </button>
                <button
                  onClick={() => setAction(action === "noaction" ? null : "noaction")}
                  className={`cc-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                    action === "noaction" ? "bg-foreground text-white" : "border border-border bg-white text-foreground hover:bg-[var(--background)]"
                  }`}
                >
                  <XCircle className="h-3 w-3" /> Sluit zonder actie
                </button>
                <button
                  onClick={() => setAction(action === "escalate" ? null : "escalate")}
                  className={`cc-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                    action === "escalate" ? "cc-grad text-white" : "border border-border bg-white text-foreground hover:bg-[var(--background)]"
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" /> Escaleer naar geschil
                </button>
              </div>

              {action && (
                <div className="space-y-3 rounded-[14px] bg-[var(--background)] p-3">
                  {action === "goodwill" && (
                    <div>
                      <label className="text-xs font-medium text-foreground">Bedrag (max €{GOODWILL_REFUND_MAX.toFixed(2)})</label>
                      <input
                        type="number"
                        min="0.01"
                        max={GOODWILL_REFUND_MAX}
                        step="0.01"
                        value={goodwillAmount}
                        onChange={(e) => setGoodwillAmount(e.target.value)}
                        className={cn(INPUT, "mt-1 w-32")}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-foreground">Onderbouwing (min 20 tekens)</label>
                    <textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      rows={3}
                      className={cn(TEXTAREA, "mt-1 resize-none")}
                      placeholder={action === "escalate" ? "Reden voor escalatie naar geschil..." : "Onderbouwing voor de partijen..."}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{resolution.length}/20</p>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || resolution.length < 20}
                    className={`${PILL_RED_SM} disabled:opacity-50`}
                  >
                    {loading ? "Bezig..." : "Bevestig"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
