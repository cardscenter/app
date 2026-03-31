"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shippingMethodSchema } from "@/lib/validations/shipping-method";

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

  await prisma.sellerShippingMethod.create({
    data: {
      sellerId: session.user.id,
      carrier: result.data.carrier,
      serviceName: result.data.serviceName,
      price: result.data.price,
      countries: JSON.stringify(result.data.countries),
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

  await prisma.sellerShippingMethod.update({
    where: { id },
    data: {
      carrier: result.data.carrier,
      serviceName: result.data.serviceName,
      price: result.data.price,
      countries: JSON.stringify(result.data.countries),
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
