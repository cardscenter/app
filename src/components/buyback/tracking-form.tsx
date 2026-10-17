"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { Truck, CheckCircle2, AlertTriangle } from "lucide-react";
import { submitBuybackTracking } from "@/actions/buyback";
import { Callout } from "@/components/dashboard/ui/callout";
import { buttonVariants } from "@/components/ui/button-variants";
import { INPUT, SELECT } from "@/components/ploy/tile-styles";

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
        toast.success("Track & Trace opgeslagen, bedankt!");
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
    <section className="dash-card space-y-4 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">Verzending &amp; tracking</h2>
      </div>

      {/* Deadline banner */}
      {deadlineDate && !shippedAt && (
        <Callout tone={isOverdue ? "pink" : isUrgent ? "yellow" : "blue"} icon={AlertTriangle}>
          <div className="min-w-0">
            {isOverdue ? (
              <p>
                <strong>Verzenddeadline verstreken.</strong> Stuur je pakket zo snel mogelijk en vul Track &amp; Trace in, anders kunnen we de aanvraag niet meer verwerken.
              </p>
            ) : (
              <p>
                <strong>
                  Verzend binnen {daysLeft === 0 ? "vandaag" : `${daysLeft} ${daysLeft === 1 ? "dag" : "dagen"}`}
                </strong>
                , uiterlijk{" "}
                {deadlineDate.toLocaleDateString("nl-NL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                . Zo kunnen we je bulk vlot inspecteren en uitbetalen.
              </p>
            )}
          </div>
        </Callout>
      )}

      {/* Sender warning */}
      <Callout tone="pink" icon={AlertTriangle}>
        <p>
          <strong>Vergeet de afzender niet.</strong> Zonder duidelijk afzendadres of een briefje met je naam in de doos kunnen we de zending niet aan je aanvraag koppelen, en kunnen we ook geen uitbetaling doen.
        </p>
      </Callout>

      {/* Already shipped — show view-only confirmation if no longer editable */}
      {hasTracking && !canEdit && (
        <Callout tone="green" icon={CheckCircle2} title={`Verzonden via ${initialCarrier}`}>
          <div>
            <p className="text-xs">
              Track &amp; Trace: <span className="font-mono">{initialTrackingNumber}</span>
            </p>
            <p className="mt-1 text-xs opacity-80">
              Ingevuld op{" "}
              {shippedAt &&
                new Date(shippedAt).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
            </p>
          </div>
        </Callout>
      )}

      {/* Form (canEdit) */}
      {canEdit && (
        <form onSubmit={handleSubmit} className="space-y-3">
          {hasTracking && (
            <Callout tone="green" icon={CheckCircle2}>
              Tracking is opgeslagen. Je kunt het hieronder nog aanpassen totdat het pakket bij ons binnenkomt.
            </Callout>
          )}
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/70">Vervoerder</label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className={SELECT}
              >
                {CARRIERS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/70">Track &amp; Trace-code</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="bv. 3SDFC0123456789"
                className={`${INPUT} font-mono`}
                maxLength={100}
                required
                minLength={4}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending || !trackingNumber.trim()}
            className={buttonVariants()}
          >
            <Truck className="h-4 w-4" />
            {isPending ? "Bezig met opslaan..." : hasTracking ? "Tracking bijwerken" : "Tracking opslaan"}
          </button>
        </form>
      )}
    </section>
  );
}
