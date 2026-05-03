import { MapPin } from "lucide-react";
import { distanceKm, formatDistance, countryFlag } from "@/lib/distance";

export interface SellerLocationLineProps {
  /** Voor PICKUP/BOTH listings: pickupCity wint als label. Anders seller's eigen plaats. */
  pickupCity?: string | null;
  /** Indien set en deliveryMethod ∈ {PICKUP, BOTH} → pickupCity gebruiken. */
  deliveryMethod?: string | null;
  seller: {
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  buyer?: { country: string | null; postalCode: string | null } | null;
  /** Extra classes voor de wrapper-tekst (bv. tekstgrootte aanpassen). */
  className?: string;
}

/** Toont "📍 Plaats · 12 km" onder de seller-naam op item-cards.
 *  Distance alleen voor same-country (NL ↔ NL); cross-border → vlaggetje. */
export function SellerLocationLine({
  pickupCity,
  deliveryMethod,
  seller,
  buyer,
  className = "",
}: SellerLocationLineProps) {
  const allowsPickup = deliveryMethod === "PICKUP" || deliveryMethod === "BOTH";
  const displayCity = (allowsPickup && pickupCity) || seller.city || null;
  if (!displayCity) return null;

  const sellerCountry = seller.country ?? null;
  const flag = countryFlag(sellerCountry, buyer?.country ?? null);
  const km = buyer
    ? distanceKm({
        buyerCountry: buyer.country,
        buyerPostalCode: buyer.postalCode,
        sellerCountry,
        sellerPostalCode: seller.postalCode ?? null,
      })
    : null;

  return (
    <p className={`mt-0.5 flex items-center gap-1 text-xs text-muted-foreground truncate ${className}`}>
      <MapPin className="size-3 shrink-0" />
      <span className="truncate">{displayCity}</span>
      {flag && <span className="ml-0.5">{flag}</span>}
      {km !== null && (
        <span className="shrink-0 tabular-nums">· {formatDistance(km)}</span>
      )}
    </p>
  );
}
