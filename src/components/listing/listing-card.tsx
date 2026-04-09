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
      className={`group glass overflow-hidden rounded-2xl transition-all hover:scale-[1.01] hover:shadow-lg flex flex-row sm:flex-col ${
        hasSpotlight ? "ring-2 ring-yellow-400/50 shadow-yellow-400/10" : ""
      } ${hasHighlight ? "bg-primary/[0.02]" : ""}`}
    >
      {/* Image — mobile: fixed size, desktop: aspect-square with fill */}
      <div className="shrink-0 sm:relative sm:w-full sm:aspect-square bg-muted flex items-center justify-center">
        {firstImage ? (
          <>
            <Image src={firstImage} alt={listing.title} width={96} height={128} className="sm:hidden object-cover w-24 h-32" sizes="96px" />
            <Image src={firstImage} alt={listing.title} fill className="hidden sm:block object-cover" sizes="(max-width: 640px) 0px, (max-width: 1024px) 50vw, 25vw" />
          </>
        ) : (
          <div className="flex w-24 h-32 sm:w-full sm:h-full items-center justify-center text-muted-foreground text-sm">
            Geen foto
          </div>
        )}
        {hasUrgent && (
          <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white shadow-md">
            {locale === "en" ? "Close-Out Sale!" : "Moet nu weg!"}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-sm sm:text-base text-foreground line-clamp-2 sm:line-clamp-1">{listing.title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground line-clamp-1">{subtitle}</p>
          )}
        </div>

        <div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-foreground">
              {listing.pricingType === "FIXED"
                ? `€${listing.price?.toFixed(2)}`
                : "Bieden"
              }
            </span>
            {listing.freeShipping ? (
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Gratis verzending</span>
            ) : (
              <span className="text-xs text-muted-foreground">+ €{listing.shippingCost.toFixed(2)}</span>
            )}
          </div>

          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            {listing.seller.displayName}
            {listing.seller.isVerified && <VerifiedBadge size="sm" />}
          </p>
        </div>
      </div>
    </Link>
  );
}
