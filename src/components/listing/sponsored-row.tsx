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
  seller: { displayName: string; isVerified?: boolean };
  upsells?: { type: string; expiresAt: Date }[];
}

interface SponsoredRowProps {
  listings: SponsoredListing[];
  locale: string;
  title: string;
  tooltip: string;
}

export function SponsoredRow({ listings, locale, title, tooltip }: SponsoredRowProps) {
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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} locale={locale} />
        ))}
      </div>
    </div>
  );
}
