import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getBuyerCountry(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { country: true },
  });

  return user?.country ?? null;
}

export function getSellerCountryFilter(buyerCountry: string | null) {
  // NL buyers or unauthenticated visitors: show everything
  if (!buyerCountry || buyerCountry === "NL") return {};
  // Non-NL buyers: filter out NL_ONLY sellers
  return { seller: { sellingCountries: { not: "NL_ONLY" } } };
}
