import postcodesNL from "./data/postcodes-nl.json";

type CoordTable = Record<string, [number, number]>;

const COORD_TABLES: Record<string, CoordTable> = {
  NL: postcodesNL as CoordTable,
};

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = toRadians(b[0] - a[0]);
  const dLon = toRadians(b[1] - a[1]);
  const lat1 = toRadians(a[0]);
  const lat2 = toRadians(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function pc4(postalCode: string | null | undefined): string | null {
  if (!postalCode) return null;
  const digits = postalCode.replace(/\s+/g, "").slice(0, 4);
  if (!/^\d{4}$/.test(digits)) return null;
  return digits;
}

export interface DistanceInput {
  buyerPostalCode: string | null | undefined;
  buyerCountry: string | null | undefined;
  sellerPostalCode: string | null | undefined;
  sellerCountry: string | null | undefined;
}

/** Vogelvlucht-afstand in km, of null als niet berekenbaar.
 *  Returnt null bij: ontbrekende postcode, verschillende landen, land niet
 *  ondersteund, of postcode niet in dataset. Same-country only — cross-border
 *  afstanden zijn ruis (je rijdt niet 600 km voor een kaart). */
export function distanceKm(input: DistanceInput): number | null {
  const { buyerCountry, sellerCountry } = input;
  if (!buyerCountry || !sellerCountry) return null;
  if (buyerCountry !== sellerCountry) return null;

  const table = COORD_TABLES[buyerCountry];
  if (!table) return null;

  const buyerPC = pc4(input.buyerPostalCode);
  const sellerPC = pc4(input.sellerPostalCode);
  if (!buyerPC || !sellerPC) return null;

  const buyerCoord = table[buyerPC];
  const sellerCoord = table[sellerPC];
  if (!buyerCoord || !sellerCoord) return null;

  return haversineKm(buyerCoord, sellerCoord);
}

/** Format afstand voor UI. <1 km wordt "<1 km" zodat seller's exacte adres
 *  niet via meerdere listings te narrowen is. Verder exact afgerond. */
export function formatDistance(km: number): string {
  if (km < 1) return "<1 km";
  return `${Math.round(km)} km`;
}

const COUNTRY_FLAGS: Record<string, string> = {
  NL: "🇳🇱",
  BE: "🇧🇪",
  DE: "🇩🇪",
  FR: "🇫🇷",
  LU: "🇱🇺",
  AT: "🇦🇹",
  ES: "🇪🇸",
  IT: "🇮🇹",
  PT: "🇵🇹",
  PL: "🇵🇱",
  DK: "🇩🇰",
  SE: "🇸🇪",
  FI: "🇫🇮",
  IE: "🇮🇪",
  CZ: "🇨🇿",
};

/** Vlaggetje voor cross-border listings. Returnt lege string voor onbekend
 *  land of voor het buyer's eigen land (geen vlag bij same-country). */
export function countryFlag(
  sellerCountry: string | null | undefined,
  buyerCountry: string | null | undefined,
): string {
  if (!sellerCountry) return "";
  if (sellerCountry === buyerCountry) return "";
  return COUNTRY_FLAGS[sellerCountry] ?? "";
}
