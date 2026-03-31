import Image from "next/image";
import Link from "next/link";
import { parseImageUrls } from "@/lib/upload";
import { VerifiedBadge } from "@/components/ui/verified-badge";

interface ListingUpsellInfo {
  type: string;
  expiresAt: Date;
}

interface ListingCardProps {
  listing: {
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
    upsells?: ListingUpsellInfo[];
  };
  locale: string;
}

export function ListingCard({ listing, locale }: ListingCardProps) {
  const images = parseImageUrls(listing.imageUrls);
  const firstImage = images[0];

  const activeUpsells = (listing.upsells ?? []).filter(
    (u) => new Date(u.expiresAt) > new Date()
  );
  const hasUrgent = activeUpsells.some((u) => u.type === "URGENT_LABEL");
  const hasSpotlight = activeUpsells.some((u) => u.type === "HOMEPAGE_SPOTLIGHT");
  const hasHighlight = activeUpsells.some((u) => u.type === "CATEGORY_HIGHLIGHT");

  const subtitle = listing.cardName
    ? `${listing.cardName}${listing.condition ? ` — ${listing.condition}` : ""}`
    : listing.listingType === "COLLECTION"
      ? "Collectie"
      : listing.listingType === "SEALED_PRODUCT"
        ? "Geseald product"
        : listing.listingType === "OTHER"
          ? "Collectible"
          : "";

  return (
    <Link
      href={`/${locale}/marktplaats/${listing.id}`}
      className={`glass overflow-hidden rounded-2xl transition-all hover:scale-[1.01] hover:shadow-lg ${
        hasSpotlight ? "ring-2 ring-yellow-400/50 shadow-yellow-400/10" : ""
      } ${hasHighlight ? "bg-primary/[0.02]" : ""}`}
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted">
        {firstImage ? (
          <Image src={firstImage} alt={listing.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Geen foto
          </div>
        )}
        {hasUrgent && (
          <span className="absolute right-2 top-2 rounded-full bg-red-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
            {locale === "en" ? "Close-Out Sale!" : "Moet nu weg!"}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-1">{listing.title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{subtitle}</p>
        )}

        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-bold text-foreground">
            {listing.pricingType === "FIXED"
              ? `€${listing.price?.toFixed(2)}`
              : "Bieden"
            }
          </span>
          <span className="text-xs text-muted-foreground">
            {listing.freeShipping
              ? "Gratis verzending"
              : `+ €${listing.shippingCost.toFixed(2)} verzending`
            }
          </span>
        </div>

        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
          {listing.seller.displayName}
          {listing.seller.isVerified && <VerifiedBadge size="sm" />}
        </p>
      </div>
    </Link>
  );
}
