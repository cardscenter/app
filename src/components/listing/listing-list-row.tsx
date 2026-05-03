import Image from "next/image";
import Link from "next/link";
import { Truck, Package, Tag, Gavel } from "lucide-react";
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
  Mint:
    "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800",
  "Near Mint":
    "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800",
  Excellent:
    "bg-blue-100 text-blue-800 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:ring-blue-800",
  Good:
    "bg-blue-100 text-blue-800 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:ring-blue-800",
  "Light Played":
    "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800",
  Played:
    "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800",
  Poor:
    "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:ring-rose-800",
};

interface DeliveryBadgesProps {
  deliveryMethod: string | null;
  freeShipping: boolean;
  shippingCost: number;
  pickupCity: string | null;
  compact?: boolean;
}

/** Twee gekleurde pills voor verzenden/ophalen. BOTH-listings tonen beide
 *  zodat koper direct ziet dat ze de keuze heeft. Sky-blue voor verzenden,
 *  amber voor ophalen — consistent met overal in de app. */
function DeliveryBadges({
  deliveryMethod,
  freeShipping,
  shippingCost,
  pickupCity,
  compact = false,
}: DeliveryBadgesProps) {
  const allowsShip = deliveryMethod === "SHIP" || deliveryMethod === "BOTH" || !deliveryMethod;
  const allowsPickup = deliveryMethod === "PICKUP" || deliveryMethod === "BOTH";

  const sizeClasses = compact
    ? "px-1.5 py-0.5 text-[10px]"
    : "px-2 py-1 text-xs";
  const iconSize = compact ? "size-3" : "size-3.5";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allowsShip && (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-medium ring-1 ring-inset bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800 ${sizeClasses}`}
        >
          <Truck className={iconSize} />
          {freeShipping
            ? "Gratis verzending"
            : `Verzenden €${shippingCost.toFixed(2)}`}
        </span>
      )}
      {allowsPickup && (
        <span
          className={`inline-flex items-center gap-1 rounded-md font-medium ring-1 ring-inset bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800 ${sizeClasses}`}
        >
          <Package className={iconSize} />
          Ophalen
          {pickupCity ? ` · ${pickupCity}` : ""}
        </span>
      )}
    </div>
  );
}

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
    ? CONDITION_COLORS[listing.condition] ?? "bg-muted text-muted-foreground ring-border"
    : null;

  const typeLabel = TYPE_LABELS_NL[listing.listingType] ?? "Overig";
  const description = listing.description ? stripHtml(listing.description) : "";

  const isFixed = listing.pricingType === "FIXED";
  const showsDirectBuy = isFixed && (listing.allowDirectBuy ?? true);
  const showsOffer = !isFixed || (listing.acceptsOffers ?? false);

  const priceLabel =
    isFixed && listing.price !== null
      ? `€${listing.price.toFixed(2)}`
      : listing.suggestedPrice !== undefined && listing.suggestedPrice !== null
        ? `€${listing.suggestedPrice.toFixed(2)}`
        : "Voorstel";
  const priceSubtitle =
    isFixed && listing.price !== null
      ? null
      : listing.suggestedPrice !== undefined && listing.suggestedPrice !== null
        ? "Vraagprijs"
        : null;

  return (
    <article className="group flex flex-row gap-3 sm:gap-5 rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-card transition-shadow hover:shadow-card-hover">
      {/* IMAGE — met watchlist-overlay op mobile */}
      <div className="relative shrink-0">
        <Link
          href={`/${locale}/marktplaats/${listing.id}`}
          className="block relative w-24 h-32 sm:w-40 sm:h-48 overflow-hidden rounded-xl bg-muted"
        >
          {firstImage ? (
            <Image
              src={firstImage}
              alt={listing.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 96px, 160px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Geen foto
            </div>
          )}

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

        {/* Watchlist overlay — alleen mobile, op desktop staat hij rechts */}
        {showWatchlist && (
          <div className="absolute right-1 top-1 sm:hidden">
            <div className="rounded-full bg-background/90 p-0.5 shadow-md backdrop-blur">
              <WatchlistButton
                listingId={listing.id}
                initialWatched={initialWatched}
              />
            </div>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Top: titel + tijd-rechts (desktop) */}
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

          {/* Type + cardName + condition pills — dichter bij elkaar */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
              {typeLabel}
            </span>
            {listing.condition && conditionColor && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${conditionColor}`}
              >
                {listing.condition}
              </span>
            )}
            {listing.cardName && (
              <span className="text-xs text-muted-foreground line-clamp-1">
                {listing.cardName}
              </span>
            )}
          </div>

          {description && (
            <p className="mt-2 hidden sm:block text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
        </Link>

        {/* MOBILE-only blok: prijs + delivery + footer */}
        <div className="sm:hidden mt-2 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xl font-bold text-foreground">{priceLabel}</p>
            <div className="flex shrink-0 items-center gap-1">
              {showsDirectBuy && (
                <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <Tag className="size-2.5" />
                  Direct
                </span>
              )}
              {showsOffer && (
                <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  <Gavel className="size-2.5" />
                  Voorstel
                </span>
              )}
            </div>
          </div>
          <DeliveryBadges
            deliveryMethod={listing.deliveryMethod}
            freeShipping={listing.freeShipping}
            shippingCost={listing.shippingCost}
            pickupCity={listing.pickupCity}
            compact
          />
        </div>

        {/* DESKTOP-only delivery block — prominent, niet weggemoffeld in actie-kolom */}
        <div className="hidden sm:flex mt-3">
          <DeliveryBadges
            deliveryMethod={listing.deliveryMethod}
            freeShipping={listing.freeShipping}
            shippingCost={listing.shippingCost}
            pickupCity={listing.pickupCity}
          />
        </div>

        {/* FOOTER — bottom-aligned met scheidingslijn voor "professioneel" gevoel */}
        <div className="mt-auto pt-3 border-t border-border/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 truncate font-medium text-foreground/80">
                <span className="truncate">{listing.seller.displayName}</span>
                {listing.seller.isVerified && <VerifiedBadge size="sm" />}
              </span>
              {listing.seller.city && (
                <>
                  <span className="text-border">·</span>
                  <SellerLocationLine
                    pickupCity={listing.pickupCity}
                    deliveryMethod={listing.deliveryMethod}
                    seller={listing.seller}
                    buyer={buyer}
                    className="!mt-0"
                  />
                </>
              )}
            </div>
            <span className="sm:hidden tabular-nums shrink-0 text-xs text-muted-foreground">
              {relativeTime(new Date(listing.createdAt))}
            </span>
          </div>
        </div>
      </div>

      {/* DESKTOP RIGHT — pricing badges, prijs, watchlist + Bekijk */}
      <div className="hidden sm:flex w-44 shrink-0 flex-col items-end justify-between border-l border-border pl-5">
        <div className="flex w-full flex-col items-end gap-2">
          <div className="flex flex-col items-end gap-1">
            {showsDirectBuy && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                <Tag className="size-3" />
                Direct kopen
              </span>
            )}
            {showsOffer && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
                <Gavel className="size-3" />
                Voorstel doen
              </span>
            )}
          </div>

          <div className="text-right">
            <p className="text-2xl font-bold leading-tight text-foreground tabular-nums">
              {priceLabel}
            </p>
            {priceSubtitle && (
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {priceSubtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-2">
          {showWatchlist && (
            <WatchlistButton
              listingId={listing.id}
              initialWatched={initialWatched}
            />
          )}
          <Link
            href={`/${locale}/marktplaats/${listing.id}`}
            className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
          >
            Bekijk
          </Link>
        </div>
      </div>
    </article>
  );
}
