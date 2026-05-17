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

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  OPEN: { label: "Open", tone: "amber" },
  INVESTIGATING: { label: "In onderzoek", tone: "sky" },
  RESOLVED_GOODWILL: { label: "Goodwill", tone: "emerald" },
  RESOLVED_NO_ACTION: { label: "Geen actie", tone: "slate" },
  ESCALATED_TO_DISPUTE: { label: "Geëscaleerd", tone: "rose" },
};

function toneClass(tone: string): string {
  switch (tone) {
    case "amber": return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
    case "sky": return "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300";
    case "emerald": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
    case "rose": return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
    default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

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
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              currentStatus === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {s === "ALL" ? "Alle" : STATUS_LABELS[s]?.label ?? s}
          </button>
        ))}
      </div>

      {issues.length === 0 ? (
        <div className="rounded-xl glass-subtle p-8 text-center">
          <Truck className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Geen tickets in deze status.</p>
        </div>
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

  const statusMeta = STATUS_LABELS[issue.status] ?? { label: issue.status, tone: "slate" };
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
    <div className="rounded-xl glass overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/20"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClass(statusMeta.tone)}`}>
              {statusMeta.label}
            </span>
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
        <div className="space-y-4 border-t border-border/50 p-4">
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
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground">Admin-onderbouwing</p>
              <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{issue.resolution}</p>
            </div>
          )}

          {/* Admin actions */}
          {isActive && (
            <div className="space-y-3 border-t border-border/50 pt-3">
              {issue.status === "OPEN" && (
                <button
                  onClick={handleStartInvestigating}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  <Clock className="h-3 w-3" /> Markeer als onder onderzoek
                </button>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAction(action === "goodwill" ? null : "goodwill")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    action === "goodwill" ? "bg-emerald-600 text-white" : "border border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" /> Goodwill-credit
                </button>
                <button
                  onClick={() => setAction(action === "noaction" ? null : "noaction")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    action === "noaction" ? "bg-slate-600 text-white" : "border border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  <XCircle className="h-3 w-3" /> Sluit zonder actie
                </button>
                <button
                  onClick={() => setAction(action === "escalate" ? null : "escalate")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    action === "escalate" ? "bg-rose-600 text-white" : "border border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" /> Escaleer naar geschil
                </button>
              </div>

              {action && (
                <div className="space-y-2 rounded-md border border-border/60 p-3">
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
                        className="mt-1 block w-32 glass-input px-3 py-1.5 text-sm text-foreground"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-foreground">Onderbouwing (min 20 tekens)</label>
                    <textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      rows={3}
                      className="mt-1 block w-full glass-input px-3 py-2 text-sm text-foreground resize-none"
                      placeholder={action === "escalate" ? "Reden voor escalatie naar geschil..." : "Onderbouwing voor de partijen..."}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{resolution.length}/20</p>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || resolution.length < 20}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
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
