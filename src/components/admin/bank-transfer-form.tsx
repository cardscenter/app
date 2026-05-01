"use client";

import { useState, useTransition } from "react";
import { confirmBankTransfer } from "@/actions/wallet";
import { useRouter } from "@/i18n/navigation";
import { Check, X } from "lucide-react";

export function BankTransferForm({
  userId,
  userName,
  currentBalance,
}: {
  userId: string;
  userName: string;
  currentBalance: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Vul een geldig bedrag in.");
      return;
    }
    startTransition(async () => {
      const result = await confirmBankTransfer(userId, amt, note.trim() || undefined);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess(
          `Bevestigd. Nieuw saldo: €${result.newBalance.toFixed(2)}`
        );
        setAmount("");
        setNote("");
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Bevestig storting
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-border bg-muted p-3">
      <div className="text-xs text-muted-foreground">
        {userName} — huidig saldo €{currentBalance.toFixed(2)}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
          <input
            type="number"
            step="0.01"
            min="15"
            placeholder="Bedrag"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-border bg-card pl-6 pr-2 py-1.5 text-sm"
            autoFocus
          />
        </div>
        <input
          type="text"
          placeholder="Notitie (optioneel)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm"
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {success && <p className="text-xs text-emerald-600">{success}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setSuccess(null);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted"
        >
          <X className="h-3 w-3" /> Annuleer
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          {pending ? "Bezig…" : "Bevestig"}
        </button>
      </div>
    </form>
  );
}
