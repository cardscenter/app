"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Search, Undo2, UserCheck, Phone } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { checkInRegistrationById, undoTicketCheckIn } from "@/actions/staff/check-in";
import { REGISTRATION_STATUS_LABEL, type RegistrationStatus } from "@/lib/shop-events/config";
import { formatEventTime } from "@/lib/shop-events/format";

export interface CheckInRow {
  id: string;
  status: string;
  ticketCode: string;
  displayName: string;
  fullName: string;
  avatarUrl: string | null;
  division: string | null;
  supervised: boolean;
  guardianPhone: string | null;
  checkedInAt: string | null;
  note: string | null;
}

const TONE: Record<string, "success" | "warning" | "neutral" | "info" | "danger"> = {
  CHECKED_IN: "success",
  CONFIRMED: "info",
  RESERVED: "warning",
  OFFERED: "warning",
  WAITLIST: "neutral",
  NO_SHOW: "danger",
};

/** Deelnemerslijst met zoekveld en handmatige check-in/terugdraaien. */
export function CheckInList({ rows }: { rows: CheckInRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => [r.displayName, r.fullName, r.ticketCode, r.division ?? ""].some((v) => v.toLowerCase().includes(s)));
  }, [rows, q]);

  function checkIn(id: string, force = false) {
    startTransition(async () => {
      const r = await checkInRegistrationById(id, force);
      if ("error" in r) {
        if (r.code === "window" && !force && confirm(`${r.error}. Toch inchecken?`)) return checkIn(id, true);
        toast.error(r.error);
        return;
      }
      toast.success(r.already ? "Stond al ingecheckt" : `${r.registration.displayName} ingecheckt`);
      router.refresh();
    });
  }

  function undo(id: string) {
    startTransition(async () => {
      const r = await undoTicketCheckIn(id);
      if ("error" in r) toast.error(r.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op naam, code of divisie" className="glass-input w-full rounded-lg py-2 pl-9 pr-3 text-sm" />
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Geen deelnemers gevonden.</p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar src={r.avatarUrl} name={r.displayName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{r.fullName || r.displayName}</span>
                  {r.fullName && <span className="text-xs text-muted-foreground">@{r.displayName}</span>}
                  <StatusBadge tone={TONE[r.status] ?? "neutral"}>{REGISTRATION_STATUS_LABEL[r.status as RegistrationStatus] ?? r.status}</StatusBadge>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">{r.ticketCode}</span>
                  {r.division && <span>{r.division}</span>}
                  {r.supervised && <span className="text-amber-600 dark:text-amber-400">Met begeleider</span>}
                  {r.guardianPhone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" /> {r.guardianPhone}
                    </span>
                  )}
                  {r.checkedInAt && <span>Ingecheckt {formatEventTime(new Date(r.checkedInAt))}</span>}
                  {r.note && <span className="italic">{r.note}</span>}
                </div>
              </div>
              {r.status === "CONFIRMED" && (
                <button type="button" disabled={pending} onClick={() => checkIn(r.id)} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  <UserCheck className="size-3.5" /> Check in
                </button>
              )}
              {r.status === "CHECKED_IN" && (
                <button type="button" disabled={pending} onClick={() => undo(r.id)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60" title="Check-in terugdraaien">
                  <Undo2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
