"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { setBidDepositExemption } from "@/actions/admin/users";
import { ShieldCheck, ShieldOff } from "lucide-react";

type Props = {
  userId: string;
  userName: string;
  currentlyExempt: boolean;
};

/**
 * Toggle voor borg-vrijstelling op BUSINESS-accounts (Fase 29).
 *
 * Effect: gebruiker mag bids ≥ €2500 plaatsen zonder geverifieerd ID. Borg-
 * forfait blijft gelden. UI wordt alleen gerenderd voor BUSINESS-accounts
 * met valide vatNumber + cocNumber (guard in parent page).
 */
export function BidDepositExemptionToggle({ userId, userName, currentlyExempt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (reason.trim().length < 5) {
      setError("Reden minimaal 5 tekens.");
      return;
    }
    startTransition(async () => {
      const res = await setBidDepositExemption(userId, !currentlyExempt, reason.trim());
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          currentlyExempt
            ? "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
        }`}
      >
        {currentlyExempt ? (
          <>
            <ShieldOff className="h-4 w-4" />
            Vrijstelling intrekken
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            Borg-vrijstelling toekennen
          </>
        )}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-md border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            {currentlyExempt
              ? `Vrijstelling voor ${userName} intrekken — bids ≥ €2500 vereisen weer een geverifieerd account.`
              : `${userName} vrijstellen van verified-eis bij bids ≥ €2500. Borg-forfait blijft van toepassing bij wanbetaling.`}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reden (minimaal 5 tekens) — bv. KvK-nummer geverifieerd door admin"
            rows={2}
            className="w-full rounded-md border border-border bg-card px-2 py-1 text-sm"
            disabled={pending}
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Bezig..." : currentlyExempt ? "Intrekken" : "Toekennen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setReason("");
                setError(null);
              }}
              className="rounded-md bg-muted px-3 py-1 text-xs hover:bg-muted/80"
            >
              Annuleren
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
