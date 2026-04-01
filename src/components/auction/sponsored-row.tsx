import { AuctionCard } from "@/components/auction/auction-card";
import type { AuctionCardData } from "@/components/auction/auction-card";
import { Info } from "lucide-react";

interface SponsoredAuctionRowProps {
  auctions: AuctionCardData[];
  title: string;
  tooltip: string;
}

export function SponsoredAuctionRow({ auctions, title, tooltip }: SponsoredAuctionRowProps) {
  if (auctions.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </h2>
        <div className="group relative">
          <Info className="h-4 w-4 text-muted-foreground/60 cursor-help" />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 rounded-lg bg-foreground text-background text-xs p-3 shadow-lg z-50">
            {tooltip}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-foreground rotate-45 -mt-1" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {auctions.map((auction) => (
          <AuctionCard key={auction.id} auction={auction} />
        ))}
      </div>
    </div>
  );
}
