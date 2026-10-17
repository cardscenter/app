"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { UserPlus, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { INPUT, PILL_BTN, PILL_BTN_SM, PILL_RED, TABLE_CELL, TABLE_HEAD } from "@/components/ploy/tile-styles";
import { cn } from "@/lib/utils";
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
        <div className="px-5 pb-4 sm:px-6">
          {!addOpen ? (
            <button type="button" onClick={() => setAddOpen(true)} className={PILL_BTN}>
              <UserPlus className="size-4" /> Speler handmatig toevoegen
            </button>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto]">
              <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="E-mail of gebruikersnaam" className={INPUT} />
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="0" placeholder="Bedrag" className={INPUT} />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notitie (bv. contant aan de balie)" className={INPUT} />
              <div className="flex gap-2">
                <button type="button" disabled={pending || !who.trim()} onClick={add} className={cn(PILL_RED, "px-4 py-2 disabled:opacity-60")}>
                  Toevoegen
                </button>
                <button type="button" onClick={() => setAddOpen(false)} className={PILL_BTN}>
                  Sluit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="px-6 pb-8 pt-4 text-center text-sm text-muted-foreground">Nog geen inschrijvingen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={cn(TABLE_HEAD, "bg-[var(--background)]")}>
              <tr>
                <th className={TABLE_CELL}>Speler</th>
                <th className={TABLE_CELL}>Status</th>
                <th className={TABLE_CELL}>Divisie</th>
                <th className={TABLE_CELL}>Betaling</th>
                <th className={TABLE_CELL}>Ticket</th>
                <th className={TABLE_CELL}>Ingeschreven</th>
                <th className={TABLE_CELL} />
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
                          <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reden (optioneel)" className={cn(INPUT, "w-44 px-2 py-1 text-xs")} />
                          <div className="flex gap-1">
                            <button type="button" disabled={pending} onClick={() => cancel(r.id)} className="cc-pill inline-flex items-center bg-destructive px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-60">
                              Annuleer + terugbetalen
                            </button>
                            <button type="button" onClick={() => setCancelId(null)} className={PILL_BTN_SM}>
                              Nee
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setCancelId(r.id)} className="cc-pill inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-[var(--background)] hover:text-destructive" title="Annuleren">
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
