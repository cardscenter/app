import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export function getSellerCountryFilter(buyerCountry: string | null) {
  // NL buyers or unauthenticated visitors: show everything
  if (!buyerCountry || buyerCountry === "NL") return {};
  // BE buyers: filter out NL_ONLY sellers (NL_BE and ALL_EU both include BE)
  if (buyerCountry === "BE") {
    return { seller: { sellingCountries: { not: "NL_ONLY" } } };
  }
  // Other EU buyers: only show ALL_EU sellers
  return { seller: { sellingCountries: "ALL_EU" } };
}
