import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COUNTRY_CODES } from "./countries";
import { zoneFor } from "./zones";
import { normalizeSellingScope } from "./static-methods";

export async function getBuyerCountry(): Promise<string | null> {
  const location = await getBuyerLocation();
  return location?.country ?? null;
}

/** Buyer's location voor distance-display op listings/auctions. Null als
 *  niet ingelogd of profiel onvolledig (geen country gezet). PostalCode mag
 *  ontbreken — dan toont de UI alleen de city zonder afstand. */
export async function getBuyerLocation(): Promise<{
  country: string | null;
  postalCode: string | null;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { country: true, postalCode: true },
  });

  if (!user) return null;
  return { country: user.country ?? null, postalCode: user.postalCode ?? null };
}

/** Filter sellers op basis van buyer-country + seller's selling-scope (Fase 33).
 *
 *  Logica per seller-country relatief tot buyer-country:
 *  - DOMESTIC (zelfde land): altijd zichtbaar
 *  - EU_NEAR: zichtbaar bij scope DOMESTIC_AND_NEAR of ALL_EU
 *  - EU_FAR: zichtbaar bij scope ALL_EU
 *
 *  We pre-computeren per buyer-country welke seller-countries in welke zone vallen,
 *  en bouwen een Prisma OR-where op basis daarvan. Sellers met `country = null` worden
 *  uitgesloten (kunnen niet verzenden zonder origin).
 */
export function getSellerCountryFilter(buyerCountry: string | null) {
  if (!buyerCountry || !COUNTRY_CODES.includes(buyerCountry)) return {};

  const domesticOrigins: string[] = [];
  const nearOrigins: string[] = [];
  const farOrigins: string[] = [];

  for (const sellerCountry of COUNTRY_CODES) {
    const zone = zoneFor(sellerCountry, buyerCountry);
    if (zone === "DOMESTIC") domesticOrigins.push(sellerCountry);
    else if (zone === "EU_NEAR") nearOrigins.push(sellerCountry);
    else if (zone === "EU_FAR") farOrigins.push(sellerCountry);
  }

  // Legacy + nieuwe scope-waardes: legacy NL_BE telt als DOMESTIC_AND_NEAR, NL_ONLY als DOMESTIC_ONLY.
  const allScopes = ["DOMESTIC_ONLY", "DOMESTIC_AND_NEAR", "ALL_EU", "NL_ONLY", "NL_BE"];
  const scopesIncludingNear = allScopes.filter(
    (s) => normalizeSellingScope(s) !== "DOMESTIC_ONLY",
  );
  const scopesIncludingFar = allScopes.filter(
    (s) => normalizeSellingScope(s) === "ALL_EU",
  );

  return {
    seller: {
      OR: [
        { country: { in: domesticOrigins } },
        {
          AND: [
            { country: { in: nearOrigins } },
            { sellingCountries: { in: scopesIncludingNear } },
          ],
        },
        {
          AND: [
            { country: { in: farOrigins } },
            { sellingCountries: { in: scopesIncludingFar } },
          ],
        },
      ],
    },
  };
}
