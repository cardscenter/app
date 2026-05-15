import Image from "next/image";
import { XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AuctionRotationTimelineButton } from "@/components/auction/auction-rotation-timeline";

interface RunnerUpOfferData {
  id: string;
  bidderLabel: string;
  bidAmount: number;
  status: "AWAITING_DECISION" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  createdAt: string;
  decidedAt: string | null;
}

export interface CancelledAuctionData {
  id: string;
  title: string;
  imageUrl: string | null;
  originalWinnerLabel: string;
  originalFinalPrice: number;
  paymentMissedAt: string | null;
  finalStatus: "PAYMENT_FAILED" | null;
  runnerUpOffers: RunnerUpOfferData[];
}

interface Props {
  auctions: CancelledAuctionData[];
  perspective: "seller" | "buyer";
}

export function CancelledAuctionsSection({ auctions, perspective }: Props) {
  if (auctions.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
        <XCircle className="h-5 w-5 text-red-600" />
        Geannuleerde veilingen ({auctions.length})
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {perspective === "seller"
          ? "Veilingen waar geen koper de betaling heeft afgerond. De runner-up-rotatie is uitgeput of niemand heeft geaccepteerd."
          : "Veilingen waar je in betrokken was, maar niemand heeft betaald."}
      </p>
      <div className="space-y-2">
        {auctions.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            {a.imageUrl && (
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                <Image src={a.imageUrl} alt={a.title} fill className="object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link
                href={`/veilingen/${a.id}`}
                className="line-clamp-1 text-sm font-medium text-foreground hover:underline"
              >
                {a.title}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Initieel €{a.originalFinalPrice.toFixed(2)} · {a.runnerUpOffers.length} runner-up{a.runnerUpOffers.length === 1 ? "" : "s"} geprobeerd
              </p>
            </div>
            <AuctionRotationTimelineButton
              auctionTitle={a.title}
              originalWinnerLabel={a.originalWinnerLabel}
              originalFinalPrice={a.originalFinalPrice}
              finalStatus={a.finalStatus}
              paymentMissedAt={a.paymentMissedAt}
              runnerUpOffers={a.runnerUpOffers}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
