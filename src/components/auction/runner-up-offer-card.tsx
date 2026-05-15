"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { Link, useRouter } from "@/i18n/navigation";
import { Clock, AlertTriangle, MapPin, Wallet } from "lucide-react";
import { toast } from "sonner";
import { acceptRunnerUpOffer, declineRunnerUpOffer } from "@/actions/auction";

interface RunnerUpOffer {
  id: string;
  auctionId: string;
  auctionTitle: string;
  auctionImageUrls: string | null;
  bidAmount: number;
  premiumAmount: number;
  totalAmount: number;
  deliveryChoice: string | null;
  decisionDeadline: Date | string;
  createdAt: Date | string;
  requiresAddress: boolean;
}

interface Props {
  offer: RunnerUpOffer;
  availableBalance: number;
}

function parseImageUrl(json: string | null): string | null {
  if (!json) return null;
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) && arr.length > 0 ? String(arr[0]) : null;
  } catch {
    return null;
  }
}

function formatCountdown(deadline: Date): {
  text: string;
  urgent: boolean;
  expired: boolean;
} {
  const ms = deadline.getTime() - Date.now();
  if (ms <= 0) return { text: "Verlopen", urgent: true, expired: true };
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const urgent = hours < 6;
  if (hours < 1) return { text: `${minutes} min`, urgent, expired: false };
  if (hours < 24) return { text: `${hours}u ${minutes}m`, urgent, expired: false };
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return { text: `${days}d ${remHours}u`, urgent, expired: false };
}

export function RunnerUpOfferCard({ offer, availableBalance }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [, setTick] = useState(0);

  // Tick once a minute zodat countdown live updatet
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const deadline = typeof offer.decisionDeadline === "string"
    ? new Date(offer.decisionDeadline)
    : offer.decisionDeadline;
  const countdown = formatCountdown(deadline);

  const imageUrl = parseImageUrl(offer.auctionImageUrls);
  const insufficientBalance = availableBalance < offer.totalAmount;
  const blockedByAddress = offer.requiresAddress;
  const acceptDisabled = blockedByAddress || pending;

  function handleAcceptClick() {
    if (acceptDisabled) return;
    setShowConfirm(true);
  }

  function handleAcceptConfirm() {
    startTransition(async () => {
      const r = await acceptRunnerUpOffer(offer.id);
      if (r?.error) {
        if (r.error === "NO_ADDRESS") {
          toast.error("Vul eerst je adres in op je profielpagina");
        } else if (r.error === "OFFER_EXPIRED") {
          toast.error("Aanbod is verlopen");
        } else {
          toast.error(r.error);
        }
        setShowConfirm(false);
        return;
      }
      toast.success("Aanbod geaccepteerd. Rond de betaling af binnen 5 dagen.");
      setShowConfirm(false);
      router.refresh();
    });
  }

  function handleDecline() {
    if (pending) return;
    if (!confirm("Weet je zeker dat je dit aanbod wilt weigeren?")) return;
    startTransition(async () => {
      const r = await declineRunnerUpOffer(offer.id);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Aanbod afgewezen");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-card dark:border-amber-900 dark:bg-amber-950/30 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {imageUrl && (
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-card sm:h-32 sm:w-32">
            <Image src={imageUrl} alt={offer.auctionTitle} fill className="object-cover" />
          </div>
        )}

        <div className="flex flex-1 flex-col gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Aanbod om veiling over te nemen
            </p>
            <Link
              href={`/veilingen/${offer.auctionId}`}
              className="mt-0.5 line-clamp-2 text-base font-semibold text-foreground hover:underline sm:text-lg"
            >
              {offer.auctionTitle}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Jouw bod</p>
              <p className="font-semibold text-foreground">€{offer.bidAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Veilingkosten</p>
              <p className="font-semibold text-foreground">€{offer.premiumAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Totaal</p>
              <p className="font-bold text-foreground">€{offer.totalAmount.toFixed(2)}</p>
            </div>
          </div>

          <div
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              countdown.urgent
                ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                : "bg-card text-muted-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Beslis binnen {countdown.text}</span>
          </div>

          {blockedByAddress && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/30">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-400" />
              <div className="flex-1">
                <p className="font-medium text-red-900 dark:text-red-200">Adres ontbreekt</p>
                <p className="mt-0.5 text-xs text-red-800 dark:text-red-300">
                  Voeg je adres toe op /dashboard/profiel om dit aanbod te accepteren.
                </p>
                <Link
                  href="/dashboard/profiel"
                  className="mt-1 inline-block text-xs font-semibold text-red-900 underline dark:text-red-200"
                >
                  Naar adresgegevens →
                </Link>
              </div>
            </div>
          )}

          {!blockedByAddress && insufficientBalance && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-100 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/50">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Saldo onvoldoende (beschikbaar €{availableBalance.toFixed(2)})
                </p>
                <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                  Je kunt nog accepteren — bij accept krijg je 5 dagen om te betalen. Mis je die deadline, dan
                  volgt een 2,9% boete + €200 borg (≥€2000) + strike.
                </p>
                <Link
                  href="/dashboard/saldo"
                  className="mt-1 inline-block text-xs font-semibold text-amber-900 underline dark:text-amber-200"
                >
                  Naar saldo →
                </Link>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Bij accept moet je binnen 5 dagen betalen. Bij wanbetaling: strike + 2,9% boete
              {offer.bidAmount >= 2000 ? " + €200 borg" : ""}. Weigeren is gratis en heeft geen gevolgen.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAcceptClick}
              disabled={acceptDisabled}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Accepteren
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={pending}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Weigeren
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card-hover">
            <h3 className="text-lg font-semibold text-foreground">Aanbod accepteren?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Je gaat &quot;{offer.auctionTitle}&quot; overnemen voor:
            </p>
            <div className="mt-4 space-y-1 rounded-xl bg-muted p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bod</span>
                <span className="font-medium text-foreground">€{offer.bidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Veilingkosten 2,9%</span>
                <span className="font-medium text-foreground">€{offer.premiumAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1">
                <span className="font-semibold text-foreground">Totaal</span>
                <span className="font-bold text-foreground">€{offer.totalAmount.toFixed(2)}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Je hebt 5 dagen om te betalen na acceptatie. Bij wanbetaling: strike + 2,9% boete
              {offer.bidAmount >= 2000 ? " + €200 borg" : ""}.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleAcceptConfirm}
                disabled={pending}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Bezig..." : "Bevestig accept"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={pending}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
