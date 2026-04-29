"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Truck, CheckCircle2, AlertTriangle } from "lucide-react";
import { submitBuybackTracking } from "@/actions/buyback";

interface TrackingFormProps {
  requestId: string;
  initialCarrier: string | null;
  initialTrackingNumber: string | null;
  shippedAt: string | null;
  shippingDeadline: string | null;
  /** Geldig in PENDING/RECEIVED — anders alleen view-only weergave */
  canEdit: boolean;
}

const CARRIERS = [
  { value: "PostNL", label: "PostNL" },
  { value: "DPD", label: "DPD" },
  { value: "DHL", label: "DHL" },
  { value: "UPS", label: "UPS" },
  { value: "OTHER", label: "Anders" },
] as const;

export function TrackingForm({
  requestId,
  initialCarrier,
  initialTrackingNumber,
  shippedAt,
  shippingDeadline,
  canEdit,
}: TrackingFormProps) {
  const router = useRouter();
  const [carrier, setCarrier] = useState(initialCarrier ?? "PostNL");
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber ?? "");
  const [isPending, startTransition] = useTransition();

  const hasTracking = !!shippedAt && !!initialTrackingNumber;
  const isEditing = canEdit && (!hasTracking || !!isEditingFromState());

  function isEditingFromState() {
    return false; // simple — we always show editable inputs when canEdit and submit overwrites
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await submitBuybackTracking(requestId, carrier, trackingNumber);
      if (result?.success) {
        toast.success("Track & Trace opgeslagen — bedankt!");
        router.refresh();
      } else {
        toast.error(result?.error ?? "Er ging iets mis");
      }
    });
  }

  // Deadline display logic
  const deadlineDate = shippingDeadline ? new Date(shippingDeadline) : null;
  const now = new Date();
  const msLeft = deadlineDate ? deadlineDate.getTime() - now.getTime() : 0;
  const daysLeft = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  const isOverdue = msLeft < 0;
  const isUrgent = !isOverdue && daysLeft <= 1;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Truck className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">Verzending &amp; tracking</h2>
      </div>

      {/* Deadline banner */}
      {deadlineDate && !shippedAt && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg p-3 text-sm ${
            isOverdue
              ? "border-l-4 border-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100"
              : isUrgent
              ? "border-l-4 border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
              : "border-l-4 border-sky-400 bg-sky-50 text-sky-900 dark:bg-sky-950/30 dark:text-sky-100"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            {isOverdue ? (
              <p>
                <strong>Verzenddeadline verstreken.</strong> Stuur je pakket zo snel mogelijk en vul Track &amp; Trace in — anders kunnen we de aanvraag niet meer verwerken.
              </p>
            ) : (
              <p>
                <strong>
                  Verzend binnen {daysLeft === 0 ? "vandaag" : `${daysLeft} ${daysLeft === 1 ? "dag" : "dagen"}`}
                </strong>{" "}
                — uiterlijk{" "}
                {deadlineDate.toLocaleDateString("nl-NL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                . Zo kunnen we je bulk vlot inspecteren en uitbetalen.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sender warning */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border-l-4 border-red-400 bg-red-50/70 p-3 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Vergeet de afzender niet.</strong> Zonder duidelijk afzendadres of een briefje met je naam in de doos kunnen we de zending niet aan je aanvraag koppelen — en kunnen we ook geen uitbetaling doen.
        </p>
      </div>

      {/* Already shipped — show view-only confirmation if no longer editable */}
      {hasTracking && !canEdit && (
        <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-900 dark:text-emerald-100">
              Verzonden via {initialCarrier}
            </p>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
              Track &amp; Trace: <span className="font-mono">{initialTrackingNumber}</span>
            </p>
            <p className="mt-1 text-xs text-emerald-800/70 dark:text-emerald-200/70">
              Ingevuld op{" "}
              {shippedAt &&
                new Date(shippedAt).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
            </p>
          </div>
        </div>
      )}

      {/* Form (canEdit) */}
      {canEdit && (
        <form onSubmit={handleSubmit} className="space-y-3">
          {hasTracking && (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs dark:bg-emerald-950/30">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-emerald-900 dark:text-emerald-100">
                Tracking is opgeslagen. Je kunt het hieronder nog aanpassen totdat het pakket bij ons binnenkomt.
              </span>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Vervoerder</label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {CARRIERS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Track &amp; Trace-code</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="bv. 3SDFC0123456789"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                maxLength={100}
                required
                minLength={4}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending || !trackingNumber.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Truck className="h-4 w-4" />
            {isPending ? "Bezig met opslaan..." : hasTracking ? "Tracking bijwerken" : "Tracking opslaan"}
          </button>
        </form>
      )}
    </section>
  );
}
