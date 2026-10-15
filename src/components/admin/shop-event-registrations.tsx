"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { UserPlus, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { adminAddRegistration, adminCancelRegistration } from "@/actions/admin/shop-events";
import { REGISTRATION_STATUS_LABEL, type RegistrationStatus } from "@/lib/shop-events/config";
import { formatEventDateShort, formatEventTime, formatPrice } from "@/lib/shop-events/format";

export interface AdminRegistrationRow {
  id: string;
  status: string;
  ticketCode: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  division: string | null;
  amount: number;
  paymentStatus: string | null;
  createdAt: string;
  checkedInAt: string | null;
  note: string | null;
}

const TONE: Record<string, "success" | "warning" | "neutral" | "info" | "danger"> = {
  CHECKED_IN: "success",
  CONFIRMED: "success",
  RESERVED: "warning",
  OFFERED: "warning",
  WAITLIST: "info",
  NO_SHOW: "danger",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
  EXPIRED: "neutral",
};

/** Admin-tabel met inschrijvingen + handmatig toevoegen + annuleren (met terugbetaling). */
export function ShopEventRegistrations({ eventId, rows, canAdd }: { eventId: string; rows: AdminRegistrationRow[]; canAdd: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [who, setWho] = useState("");
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  function add() {
    startTransition(async () => {
      const r = await adminAddRegistration(eventId, who, Number(amount) || 0, note);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Toegevoegd, ticket ${r.ticketCode}`);
      setWho("");
      setNote("");
      setAddOpen(false);
      router.refresh();
    });
  }

  function cancel(id: string) {
    startTransition(async () => {
      const r = await adminCancelRegistration(id, cancelReason);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(r.refunded ? "Geannuleerd en terugbetaald" : "Geannuleerd");
      setCancelId(null);
      setCancelReason("");
      router.refresh();
    });
  }

  return (
    <div>
      {canAdd && (
        <div className="border-b border-border p-3">
          {!addOpen ? (
            <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              <UserPlus className="size-4" /> Speler handmatig toevoegen
            </button>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto]">
              <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="E-mail of gebruikersnaam" className="glass-input rounded-md px-3 py-2 text-sm" />
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="0" placeholder="Bedrag" className="glass-input rounded-md px-3 py-2 text-sm" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notitie (bv. contant aan de balie)" className="glass-input rounded-md px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button type="button" disabled={pending || !who.trim()} onClick={add} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  Toevoegen
                </button>
                <button type="button" onClick={() => setAddOpen(false)} className="rounded-md px-2 py-2 text-sm text-muted-foreground">
                  Sluit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nog geen inschrijvingen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Speler</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Divisie</th>
                <th className="px-4 py-3 text-left">Betaling</th>
                <th className="px-4 py-3 text-left">Ticket</th>
                <th className="px-4 py-3 text-left">Ingeschreven</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar src={r.avatarUrl} name={r.displayName} size="xs" />
                      <div>
                        <div className="font-medium text-foreground">{r.displayName}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={TONE[r.status] ?? "neutral"}>{REGISTRATION_STATUS_LABEL[r.status as RegistrationStatus] ?? r.status}</StatusBadge>
                    {r.checkedInAt && <div className="mt-1 text-xs text-muted-foreground">{formatEventTime(new Date(r.checkedInAt))}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.division ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{formatPrice(r.amount)}</div>
                    <div className="text-xs text-muted-foreground">{r.paymentStatus ?? (r.amount === 0 ? "gratis" : "balie")}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.ticketCode}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatEventDateShort(new Date(r.createdAt))} {formatEventTime(new Date(r.createdAt))}
                    {r.note && <div className="mt-1 italic">{r.note}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {["RESERVED", "CONFIRMED", "WAITLIST", "OFFERED"].includes(r.status) &&
                      (cancelId === r.id ? (
                        <div className="flex flex-col items-end gap-1">
                          <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reden (optioneel)" className="glass-input w-44 rounded-md px-2 py-1 text-xs" />
                          <div className="flex gap-1">
                            <button type="button" disabled={pending} onClick={() => cancel(r.id)} className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60">
                              Annuleer + terugbetalen
                            </button>
                            <button type="button" onClick={() => setCancelId(null)} className="rounded-md px-2 py-1 text-xs text-muted-foreground">
                              Nee
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setCancelId(r.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-rose-600" title="Annuleren">
                          <XCircle className="size-4" />
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
