import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { parseImageUrls } from "@/lib/upload";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { distanceKm, formatDistance, countryFlag } from "@/lib/distance";

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
    status?: string;
    deliveryMethod?: string | null;
    pickupCity?: string | null;
    seller: {
      displayName: string;
      isVerified?: boolean;
      city?: string | null;
      postalCode?: string | null;
      country?: string | null;
    };
    upsells?: ListingUpsellInfo[];
    // Voor stocked SEALED_PRODUCT/OTHER (Fase 27.36): aantal AVAILABLE rijen.
    // Toont "X stuks beschikbaar"-badge wanneer > 1. Optioneel — caller kan
    // het overslaan als hij de count niet heeft gequery'd.
    availableStock?: number;
  };
  locale: string;
  /** Buyer's land + postcode voor distance-display. Null als niet ingelogd of
   *  profiel onvolledig — dan toont de card alleen de plaats zonder afstand. */
  buyer?: { country: string | null; postalCode: string | null } | null;
}

export function ListingCard({ listing, locale, buyer }: ListingCardProps) {
  const images = parseImageUrls(listing.imageUrls);
  const firstImage = images[0];

  // Locatie-resolutie: pickup-city wint als label (PICKUP/BOTH), anders seller's
  // algemene plaats. PostalCode komt altijd van seller — Listing heeft geen eigen
  // postcode-veld; pickupCity wordt auto-fill uit User.city dus seller.postalCode
  // dekt de pickup-locatie altijd.
  const allowsPickup =
    listing.deliveryMethod === "PICKUP" || listing.deliveryMethod === "BOTH";
  const displayCity = (allowsPickup && listing.pickupCity) || listing.seller.city || null;
  const sellerCountry = listing.seller.country ?? null;
  const flag = countryFlag(sellerCountry, buyer?.country ?? null);
  const km = buyer
    ? distanceKm({
        buyerCountry: buyer.country,
        buyerPostalCode: buyer.postalCode,
        sellerCountry,
        sellerPostalCode: listing.seller.postalCode ?? null,
      })
    : null;

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
        {/* Partial-sale badge (Fase 27.15) — alleen als status meegestuurd is */}
        {listing.status === "PARTIALLY_SOLD" && (
          <span className="absolute left-2 top-2 rounded-full bg-violet-600 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white shadow-md">
            {locale === "en" ? "Partially sold" : "Gedeeltelijk verkocht"}
          </span>
        )}
        {/* Stock-badge (Fase 27.36) — voor stocked SEALED/OTHER met > 1
            stuks. Toont alleen als caller de count meegestuurd heeft, anders
            blijft de card visueel identiek aan een single-stuk listing. */}
        {listing.availableStock !== undefined && listing.availableStock > 1 && listing.status !== "PARTIALLY_SOLD" && (
          <span className="absolute left-2 top-2 rounded-full bg-blue-600 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white shadow-md">
            {listing.availableStock}× {locale === "en" ? "in stock" : "op voorraad"}
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

          {displayCity && (
            <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 truncate">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{displayCity}</span>
                {flag && <span className="ml-0.5">{flag}</span>}
              </span>
              {km !== null && (
                <span className="shrink-0 tabular-nums">{formatDistance(km)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
