import { useTranslations } from "next-intl";
import { Sparkles, Info } from "lucide-react";
import { AuctionCard } from "@/components/auction/auction-card";
import { ListingCard } from "@/components/listing/listing-card";
import { AnimatedSection } from "@/components/home/animated-section";

interface SponsoredSpotlightProps {
  auctions: Array<{
    id: string;
    title: string;
    auctionType: string;
    currentBid: number | null;
    startingBid: number;
    buyNowPrice: number | null;
    endTime: Date;
    imageUrls: string | null;
    seller: { displayName: string };
    _count: { bids: number };
  }>;
  listings: Array<{
    id: string;
    title: string;
    imageUrls: string;
    listingType: string;
    cardName: string | null;
    condition: string | null;
    pricingType: string;
    price: number | null;
    shippingCost: number;
    freeShipping: boolean;
    seller: { displayName: string; isVerified: boolean };
    upsells: Array<{ type: string; expiresAt: Date }>;
  }>;
  locale: string;
}

export function SponsoredSpotlight({ auctions, listings, locale }: SponsoredSpotlightProps) {
  const t = useTranslations("home");

  if (auctions.length === 0 && listings.length === 0) return null;

  return (
    <section className="py-8 sm:py-12 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
              <Sparkles className="size-4" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{t("featured")}</h2>
            <div className="group relative">
              <Info className="size-4 text-muted-foreground cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-48 rounded-lg bg-popover p-2 text-xs text-popover-foreground shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                {t("featuredTooltip")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {auctions.map((auction) => (
              <div key={auction.id} className="glass-sponsored-glow rounded-2xl">
                <AuctionCard auction={auction} sponsored />
              </div>
            ))}
            {listings.map((listing) => (
              <div key={listing.id} className="glass-sponsored-glow rounded-2xl">
                <ListingCard listing={listing} locale={locale} />
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
