import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { parseImageUrls } from "@/lib/upload";
import { Trophy, X, Clock, AlertCircle } from "lucide-react";

/** Compacte rij voor afgelopen veilingen op /dashboard/veilingen. Status-pill
 *  rechts + eindprijs in meta. Geen payout-info — daarvoor doorklikken naar
 *  detail of /dashboard/saldo. */
export type EndedAuctionStatus =
  | "ENDED_SOLD"
  | "BOUGHT_NOW"
  | "ENDED_RESERVE_NOT_MET"
  | "ENDED_NO_BIDS"
  | "CANCELLED"
  | "AWAITING_PAYMENT"
  | "AWAITING_RUNNER_UP_DECISION"
  | "PAYMENT_FAILED";

interface EndedAuctionRowProps {
  auction: {
    id: string;
    title: string;
    imageUrls: string | null;
    status: string;
    finalPrice: number | null;
    currentBid: number | null;
  };
}

const STATUS_META: Record<EndedAuctionStatus, { label: string; tone: string; Icon: typeof Trophy }> = {
  ENDED_SOLD: {
    label: "Verkocht",
    tone: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
    Icon: Trophy,
  },
  BOUGHT_NOW: {
    label: "Direct gekocht",
    tone: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
    Icon: Trophy,
  },
  ENDED_RESERVE_NOT_MET: {
    label: "Reserve niet gehaald",
    tone: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
    Icon: AlertCircle,
  },
  ENDED_NO_BIDS: {
    label: "Geen biedingen",
    tone: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30",
    Icon: Clock,
  },
  CANCELLED: {
    label: "Geannuleerd",
    tone: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30",
    Icon: X,
  },
  AWAITING_PAYMENT: {
    label: "Wacht op betaling",
    tone: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
    Icon: Clock,
  },
  AWAITING_RUNNER_UP_DECISION: {
    label: "Wacht op runner-up",
    tone: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
    Icon: Clock,
  },
  PAYMENT_FAILED: {
    label: "Betaling mislukt",
    tone: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
    Icon: X,
  },
};

function formatEuro(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `€${n.toFixed(2).replace(".", ",")}`;
}

function isKnownStatus(s: string): s is EndedAuctionStatus {
  return s in STATUS_META;
}

export function EndedAuctionRow({ auction }: EndedAuctionRowProps) {
  const images = auction.imageUrls ? parseImageUrls(auction.imageUrls) : [];
  const firstImage = images[0];
  const meta = isKnownStatus(auction.status)
    ? STATUS_META[auction.status]
    : STATUS_META.ENDED_NO_BIDS;
  const Icon = meta.Icon;

  // finalPrice is gevuld voor ENDED_SOLD / BOUGHT_NOW. Voor CANCELLED of
  // PAYMENT_FAILED is currentBid de meest informatieve waarde. ENDED_NO_BIDS
  // → "—" (geen prijs te tonen).
  const showPrice = auction.status === "ENDED_SOLD" || auction.status === "BOUGHT_NOW"
    ? auction.finalPrice
    : auction.status === "ENDED_NO_BIDS"
      ? null
      : auction.finalPrice ?? auction.currentBid;
  const priceLabel = auction.status === "BOUGHT_NOW" ? "Direct gekocht" : "Eindprijs";

  return (
    <Link
      href={`/veilingen/${auction.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {firstImage ? (
          <Image src={firstImage} alt={auction.title} fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
            Geen foto
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
          {auction.title}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {showPrice !== null ? (
            <>
              <span>{priceLabel}: <span className="font-medium text-foreground tabular-nums">{formatEuro(showPrice)}</span></span>
            </>
          ) : (
            <span>—</span>
          )}
        </p>
      </div>

      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${meta.tone}`}
      >
        <Icon className="h-3 w-3" />
        {meta.label}
      </span>
    </Link>
  );
}
