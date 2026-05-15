"use client";

import { useState } from "react";
import { Clock, X, CheckCircle2, XCircle, AlertTriangle, Trophy } from "lucide-react";

interface RunnerUpOfferRow {
  id: string;
  bidderLabel: string;
  bidAmount: number;
  status: "AWAITING_DECISION" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  createdAt: string;
  decidedAt: string | null;
}

interface Props {
  auctionTitle: string;
  originalWinnerLabel: string;
  originalFinalPrice: number;
  finalStatus: "PAYMENT_FAILED" | "ACCEPTED" | "AWAITING_DECISION" | "AWAITING_PAYMENT" | "PAID" | null;
  finalWinnerLabel?: string;
  finalSalePrice?: number;
  paymentMissedAt: string | null;
  runnerUpOffers: RunnerUpOfferRow[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusIcon({ status }: { status: RunnerUpOfferRow["status"] }) {
  switch (status) {
    case "ACCEPTED":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    case "DECLINED":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "EXPIRED":
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    default:
      return <Clock className="h-4 w-4 text-blue-600" />;
  }
}

function statusLabel(status: RunnerUpOfferRow["status"]): string {
  switch (status) {
    case "ACCEPTED":
      return "Geaccepteerd";
    case "DECLINED":
      return "Afgewezen";
    case "EXPIRED":
      return "Verlopen (geen reactie)";
    default:
      return "Wacht op reactie";
  }
}

export function AuctionRotationTimelineButton(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        Bekijk flow
      </button>
      {open && <AuctionRotationTimelineModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function AuctionRotationTimelineModal(props: Props & { onClose: () => void }) {
  const isFinalized = props.finalStatus === "PAYMENT_FAILED" || props.finalStatus === "PAID";
  const finalAccepted = props.runnerUpOffers.find((o) => o.status === "ACCEPTED");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-card-hover">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-base font-semibold text-foreground">Veilingverloop</h3>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm font-medium text-foreground">{props.auctionTitle}</p>

          <ol className="mt-4 space-y-3">
            {/* Step 1: Original winner */}
            <li className="flex items-start gap-3">
              <div className="mt-0.5">
                <Trophy className="h-4 w-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {props.originalWinnerLabel} won voor €{props.originalFinalPrice.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Initiële winnaar</p>
              </div>
            </li>

            {/* Step 2: Payment missed */}
            {props.paymentMissedAt && (
              <li className="flex items-start gap-3">
                <div className="mt-0.5">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Betaaltermijn verlopen</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(props.paymentMissedAt)} · borg/fee ingehouden bij wanbetaler
                  </p>
                </div>
              </li>
            )}

            {/* Steps 3+: Runner-up offers */}
            {props.runnerUpOffers.map((offer, idx) => (
              <li key={offer.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  <StatusIcon status={offer.status} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Aanbod {idx + 1} aan {offer.bidderLabel} (€{offer.bidAmount.toFixed(2)})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {statusLabel(offer.status)}
                    {offer.decidedAt ? ` · ${fmtDate(offer.decidedAt)}` : ""}
                  </p>
                </div>
              </li>
            ))}

            {/* Final step */}
            {isFinalized && (
              <li className="flex items-start gap-3 border-t border-border pt-3">
                <div className="mt-0.5">
                  {finalAccepted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {finalAccepted
                      ? `Verkocht aan ${props.finalWinnerLabel ?? finalAccepted.bidderLabel} voor €${(props.finalSalePrice ?? finalAccepted.bidAmount).toFixed(2)}`
                      : "Veiling geannuleerd — niemand heeft betaald"}
                  </p>
                </div>
              </li>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}
