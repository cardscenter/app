import { MapPin } from "lucide-react";
import { distanceKm, formatDistance } from "@/lib/distance";
import { CountryFlag } from "@/components/ui/country-flag";

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

/** Toont "📍 Plaats 🇳🇱 · 12 km" onder de seller-naam op item-cards.
 *  Vlag wordt altijd getoond als de seller een land heeft; afstand alleen
 *  voor same-country (NL ↔ NL) waar de haversine-data beschikbaar is. */
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
      {sellerCountry && <CountryFlag code={sellerCountry} size="xs" className="ml-0.5" />}
      {km !== null && (
        <span className="shrink-0 tabular-nums">· {formatDistance(km)}</span>
      )}
    </p>
  );
}
