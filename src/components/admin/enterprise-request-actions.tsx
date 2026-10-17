"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, X } from "lucide-react";
import { approveEnterpriseRequest, rejectEnterpriseRequest } from "@/actions/enterprise";
import { useRouter } from "@/i18n/navigation";
import { PILL_BTN, PILL_RED, INPUT, TEXTAREA } from "@/components/ploy/tile-styles";

interface Props {
  requestId: string;
}

export function EnterpriseRequestActions({ requestId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"none" | "approve" | "reject">("none");
  const [monthlyPrice, setMonthlyPrice] = useState(749);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveEnterpriseRequest({ requestId, monthlyPrice, billingCycle });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleReject = () => {
    setError(null);
    if (rejectionReason.trim().length < 5) {
      setError("Reden minstens 5 tekens");
      return;
    }
    startTransition(async () => {
      const result = await rejectEnterpriseRequest({ requestId, rejectionReason });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (mode === "none") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("approve")}
          className={PILL_RED}
        >
          <Check className="h-4 w-4" />
          Goedkeuren
        </button>
        <button
          type="button"
          onClick={() => setMode("reject")}
          className="cc-pill inline-flex items-center gap-1.5 border border-[var(--destructive)]/30 bg-white px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-[var(--pastel-pink)]/40"
        >
          <X className="h-4 w-4" />
          Afwijzen
        </button>
      </div>
    );
  }

  if (mode === "approve") {
    return (
      <div className="space-y-3 rounded-[14px] bg-[var(--pastel-green)]/50 p-4">
        <h4 className="text-sm font-semibold text-foreground">Goedkeuren</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground">Maandprijs (€)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(parseInt(e.target.value) || 0)}
              className={`${INPUT} mt-1`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground">Cyclus</label>
            <select
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as "MONTHLY" | "YEARLY")}
              className={`${INPUT} mt-1`}
            >
              <option value="MONTHLY">Maandelijks</option>
              <option value="YEARLY">Jaarlijks</option>
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className={`${PILL_RED} disabled:opacity-50`}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bevestig goedkeuring"}
          </button>
          <button
            type="button"
            onClick={() => setMode("none")}
            disabled={isPending}
            className={PILL_BTN}
          >
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[14px] bg-[var(--pastel-pink)]/50 p-4">
      <h4 className="text-sm font-semibold text-foreground">Afwijzen</h4>
      <textarea
        value={rejectionReason}
        onChange={(e) => setRejectionReason(e.target.value)}
        rows={3}
        minLength={5}
        maxLength={500}
        placeholder="Reden voor afwijzing (zichtbaar voor de aanvrager)..."
        className={TEXTAREA}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending}
          className={`${PILL_RED} disabled:opacity-50`}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bevestig afwijzing"}
        </button>
        <button
          type="button"
          onClick={() => setMode("none")}
          disabled={isPending}
          className={PILL_BTN}
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}
