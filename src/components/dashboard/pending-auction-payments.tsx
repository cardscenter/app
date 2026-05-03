"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { completeAuctionPayment } from "@/actions/auction";
import { PaymentMethodModal } from "@/components/checkout/payment-method-modal";
import { CreditCard, Clock, AlertCircle, Lock } from "lucide-react";

interface PendingAuction {
  id: string;
  title: string;
  finalPrice: number | null;
  paymentDeadline: Date | null;
}

interface PendingAuctionPaymentsProps {
  auctions: PendingAuction[];
  /** Beschikbaar saldo NA aftrek van alle reserves (balance - reservedBalance). */
  availableBalance: number;
  /** Totale reservedBalance — gebruikt om de eigen 40%-reserve op deze auction
   *  terug te rekenen voor de "echte" betaalcapaciteit. */
  reservedBalance: number;
  /** Optionele callback die wordt aangeroepen na een succesvolle betaling.
   *  PurchasesContent gebruikt dit om naar de Betaald-tab te schakelen zodat
   *  de koper zijn nieuwe aankoop direct ziet. */
  onPaymentComplete?: () => void;
}

const RESERVE_PERCENTAGE = 0.4;

function daysUntil(date: Date): number {
  const ms = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function PendingAuctionPayments({
  auctions,
  availableBalance,
  reservedBalance,
  onPaymentComplete,
}: PendingAuctionPaymentsProps) {
  const t = useTranslations("wallet");
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [openModalId, setOpenModalId] = useState<string | null>(null);

  const handlePay = async (auctionId: string) => {
    setLoadingId(auctionId);
    setError(null);
    const result = await completeAuctionPayment(auctionId);
    setLoadingId(null);
    if (result?.error) {
      setError(result.error);
      setOpenModalId(null);
    } else {
      setPaidIds((prev) => new Set([...prev, auctionId]));
      setOpenModalId(null);
      // Schakel parent over naar de Betaald-tab vóór de refresh, anders blijft
      // activeTab op een verborgen PENDING-tab hangen na server-data update.
      onPaymentComplete?.();
      router.refresh();
    }
  };

  const remaining = auctions.filter((a) => !paidIds.has(a.id));
  if (remaining.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <CreditCard className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200">
            {t("pendingPayments")} ({remaining.length})
          </h3>
          <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">
            Je hebt veilingen gewonnen waarvoor de restbetaling nog open staat.
            Vul je saldo aan en betaal voor de deadline.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {remaining.map((auction) => {
          const total = auction.finalPrice ?? 0;
          // 40% van finalPrice zit al gereserveerd in reservedBalance en komt
          // automatisch vrij bij payment. De koper hoeft alleen het verschil
          // (totaal - reservering) uit z'n vrije saldo aan te vullen.
          const ownReserve = Math.round(total * RESERVE_PERCENTAGE * 100) / 100;
          const stillNeeded = Math.max(0, total - ownReserve);
          // Tekort = wat de koper nog te kort komt om de stillNeeded te dekken
          // uit z'n echte beschikbare saldo (reservering komt sowieso vrij).
          const shortage = Math.max(0, stillNeeded - availableBalance);
          const canPay = shortage === 0;

          const days = auction.paymentDeadline ? daysUntil(auction.paymentDeadline) : null;
          const isUrgent = days !== null && days <= 2;

          return (
            <div
              key={auction.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              {/* Kop: titel + deadline */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{auction.title}</p>
                  {auction.paymentDeadline && (
                    <div className={`mt-0.5 flex items-center gap-1 text-xs ${isUrgent ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                      <Clock className="h-3 w-3" />
                      {days !== null && days > 0
                        ? `Nog ${days} dag${days === 1 ? "" : "en"} (tot ${new Date(auction.paymentDeadline).toLocaleDateString("nl-NL")})`
                        : `Verlopen op ${new Date(auction.paymentDeadline).toLocaleDateString("nl-NL")}`}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Totaal</p>
                  <p className="text-xl font-bold text-foreground">€{total.toFixed(2)}</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    Al vastgehouden
                  </div>
                  <p className="mt-0.5 font-semibold text-foreground">€{ownReserve.toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground">40% reservering</p>
                </div>
                <div className="rounded-lg bg-muted/30 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Nog te betalen</div>
                  <p className="mt-0.5 font-semibold text-foreground">€{stillNeeded.toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground">Wordt afgeschreven</p>
                </div>
                <div className={`rounded-lg px-3 py-2 ${shortage > 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-emerald-50 dark:bg-emerald-950/30"}`}>
                  <div className={`text-xs ${shortage > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {shortage > 0 ? "Tekort op je saldo" : "Beschikbaar saldo"}
                  </div>
                  <p className={`mt-0.5 font-semibold ${shortage > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    €{shortage > 0 ? shortage.toFixed(2) : availableBalance.toFixed(2)}
                  </p>
                  <p className={`text-[11px] ${shortage > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {shortage > 0 ? "Vul saldo aan" : "Klaar om te betalen"}
                  </p>
                </div>
              </div>

              {/* Actie */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-3">
                {!canPay && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Vul minimaal €{shortage.toFixed(2)} aan voor je kunt betalen
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setOpenModalId(auction.id)}
                  disabled={loadingId === auction.id}
                  className="ml-auto rounded-xl bg-primary px-5 py-2 text-sm font-medium text-white shadow-md transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {loadingId === auction.id ? "..." : "Nu betalen"}
                </button>
              </div>

              {/* Payment-modal — hetzelfde patroon als cart-checkout / direct-buy.
                  availableBalance is het ECHTE vrije saldo (matcht /saldo).
                  extraCredit telt de eigen 40%-reserve mee voor de kan-ik-betalen
                  check, en wordt apart in de modal getoond zodat de koper begrijpt
                  waar het vandaan komt. */}
              {openModalId === auction.id && (
                <PaymentMethodModal
                  totalCost={total}
                  availableBalance={availableBalance}
                  extraCredit={ownReserve}
                  loading={loadingId === auction.id}
                  onCancel={() => setOpenModalId(null)}
                  onConfirm={() => handlePay(auction.id)}
                  summary={
                    <div className="space-y-1.5 text-sm">
                      <p className="font-medium text-foreground">{auction.title}</p>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Eindbedrag veiling</span>
                        <span>€{total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Al vastgehouden (40%)</span>
                        <span>−€{ownReserve.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium text-foreground">
                        <span>Nog af te schrijven</span>
                        <span>€{stillNeeded.toFixed(2)}</span>
                      </div>
                    </div>
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Voet: totaal openstaand + reservedBalance hint */}
      {remaining.length > 1 && (
        <div className="rounded-lg bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          Totaal vastgehouden voor openstaande betalingen: €{reservedBalance.toFixed(2)}
        </div>
      )}
    </div>
  );
}
