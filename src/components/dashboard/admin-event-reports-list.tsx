"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Flag, Check, EyeOff, ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { reviewEventReport } from "@/actions/admin/events";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";

const REASON_LABELS: Record<string, string> = {
  MISLEADING: "Misleidend",
  OFFENSIVE: "Aanstootgevend",
  SPAM: "Spam",
  INAPPROPRIATE: "Ongepast",
  OTHER: "Overig",
};

interface ReportRow {
  id: string;
  reason: string;
  details: string;
  createdAt: string;
  reporter: { displayName: string | null; email: string };
  event: {
    id: string;
    title: string;
    city: string;
    country: string;
    status: string;
    organizer: { displayName: string | null };
  };
}

export function AdminEventReportsList({ reports }: { reports: ReportRow[] }) {
  if (reports.length === 0) {
    return (
      <EmptyState icon={Flag} title="Geen openstaande meldingen." compact />
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((r) => (
        <ReportCard key={r.id} report={r} />
      ))}
    </div>
  );
}

function ReportCard({ report }: { report: ReportRow }) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  function handle(action: "DISMISS" | "ACTION_TAKEN") {
    startTransition(async () => {
      const res = await reviewEventReport(report.id, action, note);
      if (res?.error) toast.error(res.error);
      else toast.success(action === "DISMISS" ? "Melding afgewezen" : "Evenement verborgen");
    });
  }

  return (
    <div className="dash-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="danger" icon={Flag}>{REASON_LABELS[report.reason] ?? report.reason}</StatusBadge>
        <Link href={`/evenementen/${report.event.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary">
          {report.event.title} <ExternalLink className="h-3 w-3" />
        </Link>
        <span className="text-xs text-muted-foreground">
          {report.event.city} · door {report.event.organizer.displayName ?? "onbekend"}
          {report.event.status !== "LIVE" && ` · status: ${report.event.status}`}
        </span>
      </div>

      <p className="mt-2 text-sm text-foreground/90">&ldquo;{report.details}&rdquo;</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Gemeld door {report.reporter.displayName ?? report.reporter.email}
      </p>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Interne notitie (optioneel)…"
        rows={1}
        className="mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={() => handle("DISMISS")}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> Afwijzen (geen actie)
        </button>
        <button
          onClick={() => handle("ACTION_TAKEN")}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
        >
          <EyeOff className="h-4 w-4" /> Evenement verbergen
        </button>
      </div>
    </div>
  );
}
