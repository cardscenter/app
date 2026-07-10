"use client";

import { useTransition } from "react";
import { Trash2, ExternalLink, Pencil, Clock, CheckCircle2, XCircle, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { deleteEvent } from "@/actions/event";

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  PENDING: { label: "Wacht op goedkeuring", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", icon: Clock },
  LIVE: { label: "Live", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", icon: CheckCircle2 },
  REJECTED: { label: "Afgewezen", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", icon: XCircle },
  ENDED: { label: "Afgelopen", cls: "bg-muted text-muted-foreground", icon: CalendarOff },
};

interface MyEvent {
  id: string;
  title: string;
  city: string;
  status: string;
  startTime: string;
  rejectionReason: string | null;
}

export function MyEventRow({ event }: { event: MyEvent }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const meta = STATUS_META[event.status] ?? STATUS_META.PENDING;
  const Icon = meta.icon;

  function handleDelete() {
    if (!confirm("Weet je zeker dat je dit evenement wilt verwijderen?")) return;
    startTransition(async () => {
      const res = await deleteEvent(event.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Evenement verwijderd");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{event.title}</p>
        <p className="text-sm text-muted-foreground">
          {event.city} · {new Date(event.startTime).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        {event.status === "REJECTED" && event.rejectionReason && (
          <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">Reden: {event.rejectionReason}</p>
        )}
      </div>

      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>
        <Icon className="h-3.5 w-3.5" /> {meta.label}
      </span>

      {event.status === "LIVE" && (
        <Link href={`/evenementen/${event.id}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm text-foreground transition hover:bg-muted">
          <ExternalLink className="h-4 w-4" /> Bekijk
        </Link>
      )}
      {(event.status === "LIVE" || event.status === "PENDING" || event.status === "REJECTED") && (
        <Link href={`/dashboard/evenementen/${event.id}/bewerken`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm text-foreground transition hover:bg-muted">
          <Pencil className="h-4 w-4" /> Bewerken
        </Link>
      )}
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-rose-500 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
