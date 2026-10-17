"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { setBidDepositExemption } from "@/actions/admin/users";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { TEXTAREA, PILL_RED_SM, PILL_BTN_SM } from "@/components/ploy/tile-styles";

type Props = {
  userId: string;
  userName: string;
  currentlyExempt: boolean;
};

/**
 * Toggle voor borg-vrijstelling op BUSINESS-accounts (Fase 29).
 *
 * Effect: gebruiker mag bids ≥ €2000 plaatsen zonder geverifieerd ID. Borg-
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
        setError(res.error ?? null);
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
        className={`cc-pill inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
          currentlyExempt
            ? "bg-[var(--pastel-pink)] text-[var(--pastel-pink-ink)] hover:opacity-85"
            : "bg-[var(--pastel-green)] text-[var(--pastel-green-ink)] hover:opacity-85"
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
        <form onSubmit={handleSubmit} className="space-y-2 rounded-[14px] bg-[var(--background)] p-3">
          <p className="text-xs text-muted-foreground">
            {currentlyExempt
              ? `Vrijstelling voor ${userName} intrekken. Bids ≥ €2000 vereisen weer een geverifieerd account.`
              : `${userName} vrijstellen van verified-eis bij bids ≥ €2000. Borg-forfait blijft van toepassing bij wanbetaling.`}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reden (minimaal 5 tekens), bv. KvK-nummer geverifieerd door admin"
            rows={2}
            className={TEXTAREA}
            disabled={pending}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className={`${PILL_RED_SM} disabled:opacity-50`}
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
              className={PILL_BTN_SM}
            >
              Annuleren
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
