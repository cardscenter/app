"use client";

import { useState, useTransition } from "react";
import { confirmBankTransfer } from "@/actions/wallet";
import { useRouter } from "@/i18n/navigation";
import { Check, X } from "lucide-react";
import { PLATFORM, PLATFORM_IBAN_DISPLAY } from "@/lib/platform-config";
import { cn } from "@/lib/utils";
import { PILL_BTN_SM, PILL_RED, PILL_RED_SM, INPUT } from "@/components/ploy/tile-styles";

export function BankTransferForm({
  userId,
  userName,
  currentBalance,
  userIban,
  isIbanVerified,
}: {
  userId: string;
  userName: string;
  currentBalance: number;
  /** IBAN op profiel — voor IBAN-match (Fase 32). Null = user heeft nog geen IBAN ingevuld. */
  userIban?: string | null;
  /** True = IBAN al eerder geverifieerd → input niet meer tonen. */
  isIbanVerified?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [senderIban, setSenderIban] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const showIbanField = !!userIban && !isIbanVerified;

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
      const result = await confirmBankTransfer(
        userId,
        amt,
        note.trim() || undefined,
        senderIban.trim() || undefined,
      );
      if ("error" in result) {
        setError(result.error ?? null);
      } else {
        const ibanMsg = result.ibanVerified ? " · IBAN-match: rekeningnummer geverifieerd ✓" : "";
        setSuccess(`Bevestigd. Nieuw saldo: €${result.newBalance.toFixed(2)}${ibanMsg}`);
        setAmount("");
        setNote("");
        setSenderIban("");
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={PILL_RED}
      >
        Bevestig storting
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[14px] bg-[var(--background)] p-4">
      <div className="text-xs text-muted-foreground">
        {userName} · huidig saldo €{currentBalance.toFixed(2)}
      </div>
      <div className="text-xs text-muted-foreground">
        Controleer de bijschrijving op <span className="font-mono">{PLATFORM_IBAN_DISPLAY}</span>{" "}
        ({PLATFORM.bank.accountHolder}). De referentiecode van de gebruiker moet in de omschrijving staan.
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
          <input
            type="number"
            step="0.01"
            min="15"
            placeholder="Bedrag"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${INPUT} pl-7`}
            autoFocus
          />
        </div>
        <input
          type="text"
          placeholder="Notitie (optioneel)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={cn(INPUT, "w-auto flex-1")}
        />
      </div>
      {showIbanField && (
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">
            IBAN-match (optioneel): verifieert het rekeningnummer als het overeenkomt met het profiel-IBAN
          </label>
          <input
            type="text"
            placeholder="NL00BANK0000000000"
            value={senderIban}
            onChange={(e) => setSenderIban(e.target.value)}
            className={`${INPUT} font-mono uppercase`}
          />
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs font-medium text-[var(--pastel-green-ink)]">{success}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setSuccess(null);
          }}
          className={PILL_BTN_SM}
        >
          <X className="h-3 w-3" /> Annuleer
        </button>
        <button
          type="submit"
          disabled={pending}
          className={`${PILL_RED_SM} disabled:opacity-50`}
        >
          <Check className="h-3 w-3" />
          {pending ? "Bezig…" : "Bevestig"}
        </button>
      </div>
    </form>
  );
}
