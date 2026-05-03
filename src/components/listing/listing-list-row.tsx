import Image from "next/image";
import Link from "next/link";
import { Truck, Tag, Gavel, Package } from "lucide-react";
import { parseImageUrls } from "@/lib/upload";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { SellerLocationLine } from "@/components/ui/seller-location-line";
import { WatchlistButton } from "@/components/ui/watchlist-button";

const TYPE_LABELS_NL: Record<string, string> = {
  SINGLE_CARD: "Enkele kaart",
  MULTI_CARD: "Meerdere kaarten",
  COLLECTION: "Collectie",
  SEALED_PRODUCT: "Sealed product",
  OTHER: "Overig",
};

interface ListingListRowProps {
  listing: {
    id: string;
    title: string;
    description: string | null;
    imageUrls: string;
    listingType: string;
    cardName: string | null;
    condition: string | null;
    pricingType: string;
    price: number | null;
    shippingCost: number;
    freeShipping: boolean;
    deliveryMethod: string | null;
    pickupCity: string | null;
    status?: string;
    createdAt: Date;
    allowDirectBuy?: boolean;
    acceptsOffers?: boolean;
    suggestedPrice?: number | null;
    seller: {
      id?: string;
      displayName: string;
      isVerified?: boolean;
      city?: string | null;
      postalCode?: string | null;
      country?: string | null;
    };
    availableStock?: number;
  };
  locale: string;
  buyer?: { country: string | null; postalCode: string | null } | null;
  initialWatched?: boolean;
  /** Verberg de watchlist-knop (bv. op eigen listings of als gast). */
  showWatchlist?: boolean;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function relativeTime(date: Date): string {
  const ms = Date.now() - date.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Net nu";
  if (min < 60) return `${min} min geleden`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} uur geleden`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} dag${d === 1 ? "" : "en"} geleden`;
  if (d < 30) {
    const w = Math.floor(d / 7);
    return `${w} week${w === 1 ? "" : "en"} geleden`;
  }
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} maand${mo === 1 ? "" : "en"} geleden`;
  const y = Math.floor(d / 365);
  return `${y} jaar geleden`;
}

const CONDITION_COLORS: Record<string, string> = {
  Mint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Near Mint":
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Excellent:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Good: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Light Played":
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Played:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Poor: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

export function ListingListRow({
  listing,
  locale,
  buyer,
  initialWatched = false,
  showWatchlist = true,
}: ListingListRowProps) {
  const images = parseImageUrls(listing.imageUrls);
  const firstImage = images[0];

  const conditionColor = listing.condition
    ? CONDITION_COLORS[listing.condition] ?? "bg-muted text-muted-foreground"
    : null;

  const typeLabel = TYPE_LABELS_NL[listing.listingType] ?? "Overig";
  const description = listing.description ? stripHtml(listing.description) : "";

  // Pricing-mode badges. FIXED + allowDirectBuy=true → "Direct kopen" prominent;
  // FIXED + acceptsOffers → ook "Bieden mogelijk"; NEGOTIABLE → "Bieden".
  const isFixed = listing.pricingType === "FIXED";
  const showsDirectBuy = isFixed && (listing.allowDirectBuy ?? true);
  const showsOffer = !isFixed || (listing.acceptsOffers ?? false);

  return (
    <article className="group flex flex-row gap-3 sm:gap-4 rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-card transition-shadow hover:shadow-card-hover">
      {/* Image — link wikkelt alleen image + body, niet de rechter actie-kolom */}
      <Link
        href={`/${locale}/marktplaats/${listing.id}`}
        className="shrink-0 block relative w-24 h-32 sm:w-36 sm:h-44 overflow-hidden rounded-xl bg-muted"
      >
        {firstImage ? (
          <Image
            src={firstImage}
            alt={listing.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 96px, 144px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Geen foto
          </div>
        )}

        {/* Stock-badge voor SEALED/OTHER met >1 stuks (Fase 27.36) */}
        {listing.availableStock !== undefined && listing.availableStock > 1 && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
            {listing.availableStock}× voorraad
          </span>
        )}
        {listing.status === "PARTIALLY_SOLD" && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
            Deels verkocht
          </span>
        )}
      </Link>

      {/* Body — flex-grow */}
      <div className="flex flex-1 min-w-0 flex-col">
        <Link
          href={`/${locale}/marktplaats/${listing.id}`}
          className="block"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm sm:text-base font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
              {listing.title}
            </h3>
            <span className="hidden sm:block shrink-0 text-xs text-muted-foreground tabular-nums">
              {relativeTime(new Date(listing.createdAt))}
            </span>
          </div>

          {/* Pills: type + cardName + condition */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {typeLabel}
            </span>
            {listing.cardName && (
              <span className="text-xs text-muted-foreground line-clamp-1">
                {listing.cardName}
              </span>
            )}
            {listing.condition && conditionColor && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${conditionColor}`}
              >
                {listing.condition}
              </span>
            )}
          </div>

          {description && (
            <p className="mt-2 hidden sm:block text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}

          <SellerLocationLine
            pickupCity={listing.pickupCity}
            deliveryMethod={listing.deliveryMethod}
            seller={listing.seller}
            buyer={buyer}
            className="mt-2"
          />
        </Link>

        {/* Voet: seller + relatieve tijd op mobile */}
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 truncate">
            <span className="truncate">{listing.seller.displayName}</span>
            {listing.seller.isVerified && <VerifiedBadge size="sm" />}
          </span>
          <span className="sm:hidden tabular-nums shrink-0">
            {relativeTime(new Date(listing.createdAt))}
          </span>
        </div>
      </div>

      {/* Rechter actie-kolom — alleen ≥sm */}
      <div className="hidden sm:flex w-44 shrink-0 flex-col items-end justify-between border-l border-border pl-4">
        <div className="flex w-full flex-col items-end gap-1.5">
          {/* Pricing-mode pills */}
          <div className="flex items-center gap-1">
            {showsDirectBuy && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <Tag className="size-3" />
                Direct kopen
              </span>
            )}
            {showsOffer && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                <Gavel className="size-3" />
                Bieden
              </span>
            )}
          </div>

          {/* Prijs */}
          <p className="text-xl font-bold text-foreground">
            {isFixed && listing.price !== null
              ? `€${listing.price.toFixed(2)}`
              : listing.suggestedPrice !== undefined && listing.suggestedPrice !== null
                ? `Vraagprijs €${listing.suggestedPrice.toFixed(2)}`
                : "Bieden"}
          </p>

          {/* Verzending */}
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {listing.deliveryMethod === "PICKUP" ? (
              <>
                <Package className="size-3" />
                Alleen ophalen
              </>
            ) : listing.freeShipping ? (
              <>
                <Truck className="size-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Gratis verzending
                </span>
              </>
            ) : (
              <>
                <Truck className="size-3" />+ €{listing.shippingCost.toFixed(2)}
              </>
            )}
          </p>
        </div>

        {/* Acties onderaan */}
        <div className="flex w-full items-center justify-end gap-2">
          {showWatchlist && (
            <WatchlistButton
              listingId={listing.id}
              initialWatched={initialWatched}
            />
          )}
          <Link
            href={`/${locale}/marktplaats/${listing.id}`}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary-hover transition-colors"
          >
            Bekijk
          </Link>
        </div>
      </div>
    </article>
  );
}
