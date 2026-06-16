"use client";

import { useState, useTransition } from "react";
import { Flag, X } from "lucide-react";
import { toast } from "sonner";
import { reportEvent } from "@/actions/event-report";

const REASONS = [
  { value: "MISLEADING", label: "Misleidend / klopt niet" },
  { value: "OFFENSIVE", label: "Aanstootgevend" },
  { value: "SPAM", label: "Spam" },
  { value: "INAPPROPRIATE", label: "Ongepast" },
  { value: "OTHER", label: "Anders" },
];

export function EventReportButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("MISLEADING");
  const [details, setDetails] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (details.trim().length < 10) {
      toast.error("Geef wat meer details (min. 10 tekens)");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("reason", reason);
      fd.set("details", details);
      const res = await reportEvent(eventId, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Bedankt — je melding is doorgegeven.");
        setOpen(false);
        setDetails("");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-rose-500"
      >
        <Flag className="h-4 w-4" /> Meld dit evenement
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-foreground">Evenement melden</p>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Sluiten">
          <X className="h-4 w-4" />
        </button>
      </div>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={3}
        placeholder="Wat is er aan de hand?"
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <button
        onClick={submit}
        disabled={isPending}
        className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
      >
        Versturen
      </button>
    </div>
  );
}
