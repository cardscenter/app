import { ListingCard } from "@/components/listing/listing-card";
import { Info } from "lucide-react";

interface SponsoredListing {
  id: string;
  title: string;
  imageUrls: string;
  listingType?: string;
  cardName: string | null;
  condition: string | null;
  pricingType: string;
  price: number | null;
  shippingCost: number;
  freeShipping?: boolean;
  deliveryMethod?: string | null;
  pickupCity?: string | null;
  seller: {
    displayName: string;
    isVerified?: boolean;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  upsells?: { type: string; expiresAt: Date }[];
}

interface SponsoredRowProps {
  listings: SponsoredListing[];
  locale: string;
  title: string;
  tooltip: string;
  buyer?: { country: string | null; postalCode: string | null } | null;
}

export function SponsoredRow({ listings, locale, title, tooltip, buyer }: SponsoredRowProps) {
  if (listings.length === 0) return null;

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 [@media(min-width:1600px)]:grid-cols-6">
        {listings.slice(0, 6).map((listing, i) => {
          // Progressive disclosure matching the grid: 1 / 2 / 3 / 4 / 5 / 6 cols
          const visibility =
            i === 0 ? "" :
            i === 1 ? "hidden sm:block" :
            i === 2 ? "hidden lg:block" :
            i === 3 ? "hidden xl:block" :
            i === 4 ? "hidden 2xl:block" :
            "hidden [@media(min-width:1600px)]:block";
          return (
            <div key={listing.id} className={visibility}>
              <ListingCard listing={listing} locale={locale} buyer={buyer} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
