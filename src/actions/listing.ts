"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createListingSchema } from "@/lib/validations/listing";
import { calculateUpsellCost } from "@/lib/upsell-config";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { generateOrderNumber } from "@/lib/order-number";
import { checkListingLimit } from "@/lib/account-limits";
import type { UpsellType } from "@/types";
import { checkAmountAllowed } from "@/lib/account-age";
import { requiresSignedShipping, isUntrackedAllowed } from "@/lib/shipping/tracked-threshold";


export async function createListing(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const listingLimit = await checkListingLimit(session.user.id);
  if (!listingLimit.allowed) {
    return { error: `Je hebt het maximum aantal actieve advertenties bereikt (${listingLimit.max})` };
  }

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
    shippingMethodIds: formData.get("shippingMethodIds") || undefined,
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
    select: { balance: true, reservedBalance: true, accountType: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  if (upsellEntries.length > 0) {
    totalUpsellCost = upsellEntries.reduce(
      (sum, entry) => sum + calculateUpsellCost(entry.type, entry.days, user.accountType),
      0
    );

    const availableBalance = user.balance - user.reservedBalance;
    if (availableBalance < totalUpsellCost) {
      return { error: `Onvoldoende beschikbaar saldo. Benodigd: €${totalUpsellCost.toFixed(2)}, beschikbaar: €${availableBalance.toFixed(2)}` };
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

  // Parse shipping method IDs
  let shippingMethodIds: string[] = [];
  if (data.shippingMethodIds) {
    try {
      shippingMethodIds = JSON.parse(data.shippingMethodIds);
    } catch {
      // ignore
    }
  }

  // Look up methods for price snapshots
  let methodSnapshots: { id: string; price: number }[] = [];
  if (shippingMethodIds.length > 0) {
    const methods = await prisma.sellerShippingMethod.findMany({
      where: { id: { in: shippingMethodIds }, sellerId: userId },
    });
    methodSnapshots = methods.map((m) => ({ id: m.id, price: m.price }));
  }

  // Atomic transaction: create listing + shipping methods + upsells + deduct balance
  const listing = await prisma.$transaction(async (tx) => {
    const newListing = await tx.listing.create({ data: listingData as never });

    // Create shipping method links
    if (methodSnapshots.length > 0) {
      for (const m of methodSnapshots) {
        await tx.listingShippingMethod.create({
          data: {
            listingId: newListing.id,
            shippingMethodId: m.id,
            price: m.price,
          },
        });
      }
    }

    // Create upsell records and deduct balance
    if (upsellEntries.length > 0) {
      const now = new Date();

      for (const entry of upsellEntries) {
        const cost = calculateUpsellCost(entry.type, entry.days, user.accountType);
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

export async function buyListing(listingId: string, shippingMethodId?: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { shippingMethods: true },
  });
  if (!listing) return { error: "Advertentie niet gevonden" };
  if (listing.status !== "ACTIVE") return { error: "Advertentie is niet meer beschikbaar" };
  if (listing.sellerId === session.user.id) return { error: "Je kunt je eigen advertentie niet kopen" };
  if (listing.pricingType !== "FIXED" || !listing.price) return { error: "Deze advertentie heeft geen vaste prijs" };

  const buyer = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!buyer) return { error: "Gebruiker niet gevonden" };

  // Determine shipping cost
  let shippingCost = listing.shippingCost;
  let selectedMethodId: string | null = null;
  if (shippingMethodId && listing.shippingMethods.length > 0) {
    const method = listing.shippingMethods.find((m) => m.shippingMethodId === shippingMethodId);
    if (method) {
      shippingCost = method.price;
      selectedMethodId = method.shippingMethodId;
    }
  }
  if (listing.freeShipping) shippingCost = 0;

  const totalCost = listing.price + shippingCost;

  // Account age restriction check
  const ageCheck = checkAmountAllowed(buyer, totalCost);
  if (!ageCheck.allowed) return { error: ageCheck.error! };

  const buyerAvailable = buyer.balance - buyer.reservedBalance;
  if (buyerAvailable < totalCost) {
    return { error: `Onvoldoende beschikbaar saldo. Benodigd: €${totalCost.toFixed(2)}` };
  }

  // Check buyer has address
  if (!buyer.street || !buyer.postalCode || !buyer.city) {
    return { error: "Vul eerst je adres in via Dashboard → Verzending" };
  }

  // Shipping enforcement
  if (selectedMethodId) {
    const seller = await prisma.user.findUnique({
      where: { id: listing.sellerId },
      select: { country: true },
    });
    const isInternational = seller?.country !== buyer.country;

    const shippingMethod = await prisma.sellerShippingMethod.findUnique({
      where: { id: selectedMethodId },
      select: { isSigned: true, isTracked: true },
    });

    // Briefpost check: untracked not allowed above €25
    if (shippingMethod && !shippingMethod.isTracked && !isUntrackedAllowed(listing.price)) {
      return { error: "Briefpost is niet beschikbaar voor bestellingen boven €25. Kies een verzendmethode met tracking." };
    }

    // Signed shipping check
    if (requiresSignedShipping(listing.price, isInternational)) {
      if (shippingMethod && !shippingMethod.isSigned) {
        const reason = isInternational
          ? "Aangetekende verzending (met handtekening) is verplicht voor internationale zendingen"
          : `Aangetekende verzending is verplicht voor bestellingen boven €150`;
        return { error: reason };
      }
    }
  }

  // Deduct from buyer
  await deductBalance(session.user.id, totalCost, "PURCHASE", `Gekocht: ${listing.title}`, undefined, undefined, listingId);

  // Hold in escrow for seller
  await escrowCredit(listing.sellerId, totalCost, `Verkocht (escrow): ${listing.title}`);

  // Mark listing as sold
  await prisma.listing.update({
    where: { id: listingId },
    data: { status: "SOLD", buyerId: session.user.id },
  });

  // Create ShippingBundle
  await prisma.shippingBundle.create({
    data: {
      orderNumber: generateOrderNumber(),
      buyerId: session.user.id,
      sellerId: listing.sellerId,
      shippingCost,
      totalItemCost: listing.price,
      totalCost,
      status: "PAID",
      listingId,
      shippingMethodId: selectedMethodId,
      buyerStreet: buyer.street,
      buyerHouseNumber: buyer.houseNumber,
      buyerPostalCode: buyer.postalCode,
      buyerCity: buyer.city,
      buyerCountry: buyer.country,
    },
  });

  // Notify seller
  await createNotification(
    listing.sellerId,
    "ORDER_PAID",
    "Advertentie verkocht!",
    `"${listing.title}" is verkocht voor €${listing.price.toFixed(2)}. Bekijk je verkopen om te verzenden.`,
    "/dashboard/verkopen"
  );

  return { success: true };
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
