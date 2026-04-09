"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shippingMethodSchema } from "@/lib/validations/shipping-method";
import { getDefaultMaxPrice } from "@/lib/shipping/defaults";

export async function createShippingMethod(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const countriesRaw = formData.get("countries") as string;
  let countries: string[];
  try {
    countries = JSON.parse(countriesRaw);
  } catch {
    return { error: "Ongeldige landen selectie" };
  }

  const result = shippingMethodSchema.safeParse({
    carrier: formData.get("carrier"),
    serviceName: formData.get("serviceName"),
    price: formData.get("price"),
    countries,
  });

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const isTracked = formData.get("isTracked") === "true";
  const isSigned = formData.get("isSigned") === "true";

  await prisma.sellerShippingMethod.create({
    data: {
      sellerId: session.user.id,
      carrier: result.data.carrier,
      serviceName: result.data.serviceName,
      price: result.data.price,
      countries: JSON.stringify(result.data.countries),
      isTracked,
      isSigned: isSigned ? true : false,
    },
  });

  return { success: true };
}

export async function updateShippingMethod(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const method = await prisma.sellerShippingMethod.findUnique({ where: { id } });
  if (!method || method.sellerId !== session.user.id) {
    return { error: "Verzendmethode niet gevonden" };
  }

  // Default methods: only price can be changed (with max cap)
  if (method.isDefault) {
    const price = parseFloat(formData.get("price") as string);
    if (isNaN(price) || price < 0) {
      return { error: "Ongeldige prijs" };
    }
    const maxPrice = getDefaultMaxPrice(method.carrier, method.serviceName);
    if (maxPrice != null && price > maxPrice) {
      return { error: `De maximale prijs voor deze verzendmethode is €${maxPrice.toFixed(2)} (175% van de standaardprijs).` };
    }
    await prisma.sellerShippingMethod.update({
      where: { id },
      data: { price },
    });
    return { success: true };
  }

  const countriesRaw = formData.get("countries") as string;
  let countries: string[];
  try {
    countries = JSON.parse(countriesRaw);
  } catch {
    return { error: "Ongeldige landen selectie" };
  }

  const result = shippingMethodSchema.safeParse({
    carrier: formData.get("carrier"),
    serviceName: formData.get("serviceName"),
    price: formData.get("price"),
    countries,
  });

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const isTracked = formData.get("isTracked") === "true";
  const isSigned = formData.get("isSigned") === "true";

  await prisma.sellerShippingMethod.update({
    where: { id },
    data: {
      carrier: result.data.carrier,
      serviceName: result.data.serviceName,
      price: result.data.price,
      countries: JSON.stringify(result.data.countries),
      isTracked,
      isSigned: isSigned ? true : false,
    },
  });

  return { success: true };
}

export async function deleteShippingMethod(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const method = await prisma.sellerShippingMethod.findUnique({ where: { id } });
  if (!method || method.sellerId !== session.user.id) {
    return { error: "Verzendmethode niet gevonden" };
  }

  // Default methods cannot be deleted, only deactivated
  if (method.isDefault) {
    return { error: "Standaard verzendmethoden kunnen niet verwijderd worden. Je kunt ze wel deactiveren." };
  }

  // Check if method is used in any LIVE claimsale, ACTIVE listing, or ACTIVE auction
  const inUse = await prisma.sellerShippingMethod.findFirst({
    where: {
      id,
      OR: [
        { claimsaleShippingMethods: { some: { claimsale: { status: "LIVE" } } } },
        { listingShippingMethods: { some: { listing: { status: "ACTIVE" } } } },
        { auctionShippingMethods: { some: { auction: { status: "ACTIVE" } } } },
      ],
    },
  });

  if (inUse) {
    return { error: "Deze methode is in gebruik bij een actieve verkoop. Deactiveer in plaats van verwijderen." };
  }

  await prisma.sellerShippingMethod.delete({ where: { id } });
  return { success: true };
}

export async function toggleShippingMethod(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const method = await prisma.sellerShippingMethod.findUnique({ where: { id } });
  if (!method || method.sellerId !== session.user.id) {
    return { error: "Verzendmethode niet gevonden" };
  }

  await prisma.sellerShippingMethod.update({
    where: { id },
    data: { isActive: !method.isActive },
  });

  return { success: true, isActive: !method.isActive };
}

export async function getSellerShippingMethods(sellerId?: string) {
  const session = await auth();
  const id = sellerId ?? session?.user?.id;
  if (!id) return [];

  return prisma.sellerShippingMethod.findMany({
    where: { sellerId: id },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateSellingCountries(preference: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  if (preference !== "NL_ONLY" && preference !== "NL_BE" && preference !== "ALL_EU") {
    return { error: "Ongeldige keuze" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { sellingCountries: preference },
  });

  return { success: true };
}

export async function getSellingCountries() {
  const session = await auth();
  if (!session?.user?.id) return "ALL_EU";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { sellingCountries: true },
  });

  return user?.sellingCountries ?? "ALL_EU";
}
