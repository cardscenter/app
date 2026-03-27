"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createListingSchema } from "@/lib/validations/listing";
import { calculateUpsellCost, PREMIUM_UPSELL_DISCOUNT } from "@/lib/upsell-config";
import type { UpsellType } from "@/types";


export async function createListing(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const raw = {
    listingType: formData.get("listingType"),
    imageUrls: formData.get("imageUrls") || "[]",
    title: formData.get("title"),
    description: formData.get("description"),
    cardName: formData.get("cardName") || undefined,
    cardSetId: formData.get("cardSetId") || undefined,
    cardItems: formData.get("cardItems") || undefined,
    estimatedCardCount: formData.get("estimatedCardCount") || undefined,
    conditionRange: formData.get("conditionRange") || undefined,
    productType: formData.get("productType") || undefined,
    itemCategory: formData.get("itemCategory") || undefined,
    condition: formData.get("condition") || undefined,
    pricingType: formData.get("pricingType"),
    price: formData.get("price") || undefined,
    deliveryMethod: formData.get("deliveryMethod"),
    freeShipping: formData.get("freeShipping") === "true",
    shippingCost: formData.get("shippingCost") || "0",
    carriers: formData.get("carriers") || undefined,
    packageSize: formData.get("packageSize") || undefined,
    packageCount: formData.get("packageCount") || "1",
    upsells: formData.get("upsells") || undefined,
  };

  const result = createListingSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const data = result.data;
  const userId = session.user.id;

  // Parse upsells and calculate total cost
  let upsellEntries: { type: UpsellType; days: number }[] = [];
  let totalUpsellCost = 0;

  if (data.upsells) {
    try {
      upsellEntries = JSON.parse(data.upsells);
    } catch {
      return { error: "Ongeldige upsell-gegevens" };
    }
  }

  // Get user for balance check and premium status
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, accountType: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  const isPremium = user.accountType === "PREMIUM";

  if (upsellEntries.length > 0) {
    totalUpsellCost = upsellEntries.reduce(
      (sum, entry) => sum + calculateUpsellCost(entry.type, entry.days, isPremium),
      0
    );

    if (user.balance < totalUpsellCost) {
      return { error: `Onvoldoende saldo. Benodigd: €${totalUpsellCost.toFixed(2)}, beschikbaar: €${user.balance.toFixed(2)}` };
    }
  }

  // Build listing data
  const listingData: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    imageUrls: data.imageUrls || "[]",
    listingType: data.listingType,
    pricingType: data.pricingType,
    price: data.pricingType === "FIXED" ? data.price! : null,
    deliveryMethod: data.deliveryMethod,
    freeShipping: data.freeShipping,
    shippingCost: data.freeShipping ? 0 : data.shippingCost,
    carriers: data.carriers || null,
    packageSize: data.packageSize || null,
    packageCount: data.packageCount,
    sellerId: userId,
  };

  // Type-specific fields
  switch (data.listingType) {
    case "SINGLE_CARD":
      listingData.cardName = data.cardName;
      listingData.cardSetId = data.cardSetId;
      listingData.condition = data.condition;
      break;
    case "MULTI_CARD":
      listingData.cardItems = data.cardItems;
      break;
    case "COLLECTION":
      listingData.estimatedCardCount = data.estimatedCardCount;
      listingData.conditionRange = data.conditionRange || null;
      break;
    case "SEALED_PRODUCT":
      listingData.productType = data.productType;
      break;
    case "OTHER":
      listingData.itemCategory = data.itemCategory;
      break;
  }

  // Atomic transaction: create listing + upsells + deduct balance
  const listing = await prisma.$transaction(async (tx) => {
    const newListing = await tx.listing.create({ data: listingData as never });

    // Create upsell records and deduct balance
    if (upsellEntries.length > 0) {
      const now = new Date();

      for (const entry of upsellEntries) {
        const cost = calculateUpsellCost(entry.type, entry.days, isPremium);
        const expiresAt = new Date(now.getTime() + entry.days * 24 * 60 * 60 * 1000);

        await tx.listingUpsell.create({
          data: {
            listingId: newListing.id,
            type: entry.type,
            startsAt: now,
            expiresAt,
            dailyCost: cost / entry.days,
            totalCost: cost,
          },
        });
      }

      // Deduct total upsell cost from balance
      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore - totalUpsellCost;

      await tx.user.update({
        where: { id: userId },
        data: { balance: balanceAfter },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "FEE",
          amount: -totalUpsellCost,
          balanceBefore,
          balanceAfter,
          description: `Promotiekosten advertentie: ${upsellEntries.map((e) => e.type).join(", ")}`,
          relatedListingId: newListing.id,
        },
      });
    }

    return newListing;
  });

  return { success: true, listingId: listing.id };
}

export async function updateListingStatus(listingId: string, status: "SOLD" | "DELETED") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return { error: "Advertentie niet gevonden" };
  if (listing.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (listing.status !== "ACTIVE") return { error: "Advertentie is niet actief" };

  await prisma.listing.update({
    where: { id: listingId },
    data: { status },
  });

  return { success: true };
}
