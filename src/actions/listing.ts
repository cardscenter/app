"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createListingSchema, draftListingSchema } from "@/lib/validations/listing";
import { calculateUpsellCost } from "@/lib/upsell-config";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { generateOrderNumber } from "@/lib/order-number";
import { checkListingLimit } from "@/lib/account-limits";
import type { UpsellType } from "@/types";
import { checkAmountAllowed } from "@/lib/account-age";
import { requiresSignedShipping, isUntrackedAllowed } from "@/lib/shipping/tracked-threshold";
import { resolveLocalCardSetId } from "@/lib/card-helpers";
import { requireNotSuspended } from "@/lib/suspension";


export async function createListing(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

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
    tcgdexId: formData.get("tcgdexId") || undefined,
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
    allowPartialSale: formData.get("allowPartialSale") === "true",
    stockQuantity: formData.get("stockQuantity") || "1",
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

  // Get user for balance check, premium status, and city (voor pickup-listings)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, reservedBalance: true, accountType: true, city: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Pickup-listings: User.city is verplicht en wordt automatisch overgenomen.
  // Geen handmatige invoer in de form — privacy + minder vinger-werk.
  if ((data.deliveryMethod === "PICKUP" || data.deliveryMethod === "BOTH") && !user.city) {
    return { error: "Vul eerst je woonplaats in via Dashboard → Verzending voordat je een ophaal-advertentie plaatst" };
  }

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
    pickupCity: (data.deliveryMethod === "PICKUP" || data.deliveryMethod === "BOTH") ? user.city : null,
    allowPartialSale: data.listingType === "MULTI_CARD" ? data.allowPartialSale : false,
    // stockQuantity is alleen betekenisvol voor SEALED_PRODUCT/OTHER. Voor
    // andere types blijft het 1 (default).
    stockQuantity: (data.listingType === "SEALED_PRODUCT" || data.listingType === "OTHER")
      ? Math.max(1, data.stockQuantity ?? 1)
      : 1,
    // Koop-toggles + vraagprijs (Fase 27.31). suggestedPrice alleen bij
    // NEGOTIABLE; allowDirectBuy alleen bij FIXED nuttig (NEGOTIABLE heeft
    // geen knop), maar we slaan beide op zodat een wissel later niet de
    // toggle wist.
    suggestedPrice: data.pricingType === "NEGOTIABLE" && data.suggestedPrice
      ? data.suggestedPrice
      : null,
    allowDirectBuy: data.allowDirectBuy ?? true,
    acceptsOffers: data.acceptsOffers ?? true,
    tradeable: data.tradeable ?? false,
    sellerId: userId,
  };

  // Type-specific fields
  switch (data.listingType) {
    case "SINGLE_CARD":
      listingData.cardName = data.cardName;
      listingData.condition = data.condition;
      if (data.tcgdexId) {
        listingData.tcgdexId = data.tcgdexId;
        // Auto-link to local CardSet via TCGdex set mapping
        if (!data.cardSetId) {
          const resolved = await resolveLocalCardSetId(data.tcgdexId);
          if (resolved) listingData.cardSetId = resolved;
        }
      }
      if (data.cardSetId && !listingData.cardSetId) listingData.cardSetId = data.cardSetId;
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

    // Validate: must have at least one non-LETTER method
    const hasNonLetter = methods.some((m) => m.shippingType !== "LETTER");
    if (!hasNonLetter) {
      return { error: "Je moet naast briefpost minimaal één pakket- of brievenbuspakket-optie aanbieden." };
    }
  }

  // Atomic transaction: create listing + shipping methods + upsells + deduct balance
  const listing = await prisma.$transaction(async (tx) => {
    const newListing = await tx.listing.create({ data: listingData as never });

    // MULTI_CARD: leid per-item ListingCardItem-rows af uit het cardItems-JSON
    // (Fase 27.13). Vereist voor partial-sale-flow; voor non-MULTI_CARD wordt
    // dit overgeslagen.
    //
    // Fase 27.17: een entry met quantity > 1 wordt geëxpandeerd naar N rijen
    // van qty 1 zodat partial-sale precies kan kiezen hoeveel exemplaren
    // (UI groepeert bij display + biedt een stepper). De originele cardItems-
    // JSON blijft ongewijzigd voor compatibility en als snapshot.
    if (data.listingType === "MULTI_CARD" && data.cardItems) {
      try {
        const items: Array<{ cardName: string; cardSetId?: string; tcgdexId?: string; condition?: string; quantity?: number }> =
          JSON.parse(data.cardItems);
        for (const item of items) {
          if (!item.cardName) continue;
          const qty = Math.max(1, item.quantity ?? 1);
          for (let i = 0; i < qty; i++) {
            await tx.listingCardItem.create({
              data: {
                listingId: newListing.id,
                cardName: item.cardName,
                cardSetId: item.cardSetId || null,
                tcgdexId: item.tcgdexId || null,
                condition: item.condition || null,
                quantity: 1,
                status: "AVAILABLE",
              },
            });
          }
        }
      } catch {
        // Ongeldige JSON al door zod afgevangen; defensieve catch.
      }
    }

    // Fase 27.23: SEALED_PRODUCT en OTHER met stockQuantity > 1 krijgen
    // ook N rijen voor stock-tracking + buy-quantity-flow. Bij stock=1
    // wordt 1 rij aangemaakt voor uniformiteit (buyListing routeert op
    // basis van rijen i.p.v. listing-status).
    //
    // cardName = listing-titel zodat de items-lijst in /aankopen + /verkopen
    // de productnaam toont (bv. "Destined Rivals booster pack") in plaats
    // van een type-code als "BOOSTER".
    if (data.listingType === "SEALED_PRODUCT" || data.listingType === "OTHER") {
      const stock = Math.max(1, data.stockQuantity ?? 1);
      for (let i = 0; i < stock; i++) {
        await tx.listingCardItem.create({
          data: {
            listingId: newListing.id,
            cardName: data.title,
            quantity: 1,
            status: "AVAILABLE",
          },
        });
      }
    }

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

  // Award Ember for creating a listing
  const { logActivity } = await import("@/actions/activity");
  logActivity(session.user.id, "CREATE_LISTING", { listingId: listing.id });

  return { success: true, listingId: listing.id };
}

export async function buyListing(listingId: string, shippingMethodId?: string, quantity: number = 1) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      shippingMethods: true,
      cardItemRows: { where: { status: "AVAILABLE" }, select: { id: true } },
    },
  });
  if (!listing) return { error: "Advertentie niet gevonden" };
  if (listing.sellerId === session.user.id) return { error: "Je kunt je eigen advertentie niet kopen" };
  if (listing.pricingType !== "FIXED" || !listing.price) return { error: "Deze advertentie heeft geen vaste prijs" };

  // Stock-based flow voor SEALED_PRODUCT en OTHER (Fase 27.23). Alleen wanneer
  // de listing daadwerkelijk gematerialiseerde rijen heeft — zo blijven legacy
  // listings zonder rijen werken via het direct-flip pad hieronder.
  const hasStockRows =
    (listing.listingType === "SEALED_PRODUCT" || listing.listingType === "OTHER") &&
    listing.cardItemRows.length > 0;

  if (hasStockRows) {
    return buyListingStocked({
      session,
      listing,
      quantity,
      shippingMethodId,
    });
  }

  // === Single-flip flow (SINGLE_CARD, COLLECTION, of legacy SEALED/OTHER) ===
  if (listing.status === "PARTIALLY_SOLD") {
    return { error: "Deze advertentie is gedeeltelijk verkocht — vraag de overgebleven items aan via chat." };
  }
  if (listing.status !== "ACTIVE") return { error: "Advertentie is niet meer beschikbaar" };

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

  // Atomically claim the listing — guards against two concurrent buyers passing
  // the status check above. updateMany returns count=0 if another transaction
  // beat us to it, and we abort before touching wallets.
  const claimed = await prisma.listing.updateMany({
    where: { id: listingId, status: "ACTIVE" },
    data: { status: "SOLD", buyerId: session.user.id },
  });
  if (claimed.count === 0) {
    return { error: "Advertentie is net door iemand anders gekocht" };
  }

  try {
    // Deduct from buyer
    await deductBalance(session.user.id, totalCost, "PURCHASE", `Gekocht: ${listing.title}`, undefined, undefined, listingId);

    // Hold in escrow for seller
    await escrowCredit(listing.sellerId, totalCost, `Verkocht (escrow): ${listing.title}`);
  } catch (e) {
    // Roll back the status claim so the listing becomes buyable again
    await prisma.listing.updateMany({
      where: { id: listingId, status: "SOLD", buyerId: session.user.id },
      data: { status: "ACTIVE", buyerId: null },
    });
    throw e;
  }

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

// Fase 27.23: stock-based buyListing voor SEALED_PRODUCT/OTHER met
// gematerialiseerde rijen. Buyer kiest hoeveel exemplaren; we flippen
// N rijen atomair AVAILABLE → SOLD en plakken ze aan een nieuwe bundle.
// Verzending = één keer (niet keer N) — sellers verzenden de bestelling
// als één pakket.
async function buyListingStocked(args: {
  session: { user?: { id?: string } };
  listing: {
    id: string;
    title: string;
    price: number | null;
    shippingCost: number;
    freeShipping: boolean;
    sellerId: string;
    status: string;
    listingType: string;
    shippingMethods: Array<{ shippingMethodId: string; price: number }>;
    cardItemRows: Array<{ id: string }>;
  };
  quantity: number;
  shippingMethodId?: string;
}) {
  const { session, listing } = args;
  const userId = session.user!.id!;
  const qty = Math.max(1, Math.floor(args.quantity));

  if (listing.status !== "ACTIVE" && listing.status !== "PARTIALLY_SOLD") {
    return { error: "Advertentie niet meer beschikbaar" };
  }
  const available = listing.cardItemRows.length;
  if (available === 0) return { error: "Geen voorraad meer beschikbaar" };
  if (qty > available) return { error: `Slechts ${available} stuks beschikbaar` };

  const buyer = await prisma.user.findUnique({ where: { id: userId } });
  if (!buyer) return { error: "Gebruiker niet gevonden" };
  if (!buyer.street || !buyer.postalCode || !buyer.city) {
    return { error: "Vul eerst je adres in via Dashboard → Verzending" };
  }

  // Shipping
  let shippingCost = listing.shippingCost;
  let selectedMethodId: string | null = null;
  if (args.shippingMethodId && listing.shippingMethods.length > 0) {
    const method = listing.shippingMethods.find((m) => m.shippingMethodId === args.shippingMethodId);
    if (method) {
      shippingCost = method.price;
      selectedMethodId = method.shippingMethodId;
    }
  }
  if (listing.freeShipping) shippingCost = 0;

  const itemSubtotal = (listing.price ?? 0) * qty;
  const totalCost = itemSubtotal + shippingCost;

  // Account-age + balance
  const ageCheck = checkAmountAllowed(buyer, totalCost);
  if (!ageCheck.allowed) return { error: ageCheck.error! };
  const buyerAvailable = buyer.balance - buyer.reservedBalance;
  if (buyerAvailable < totalCost) {
    return { error: `Onvoldoende beschikbaar saldo. Benodigd: €${totalCost.toFixed(2)}` };
  }

  // Shipping enforcement (op TOTAAL, want het is één pakket)
  if (selectedMethodId) {
    const seller = await prisma.user.findUnique({ where: { id: listing.sellerId }, select: { country: true } });
    const isInternational = seller?.country !== buyer.country;
    const shippingMethod = await prisma.sellerShippingMethod.findUnique({
      where: { id: selectedMethodId },
      select: { isSigned: true, isTracked: true },
    });
    if (shippingMethod && !shippingMethod.isTracked && !isUntrackedAllowed(itemSubtotal)) {
      return { error: "Briefpost is niet beschikbaar voor bestellingen boven €25. Kies een verzendmethode met tracking." };
    }
    if (requiresSignedShipping(itemSubtotal, isInternational)) {
      if (shippingMethod && !shippingMethod.isSigned) {
        return {
          error: isInternational
            ? "Aangetekende verzending (met handtekening) is verplicht voor internationale zendingen"
            : "Aangetekende verzending is verplicht voor bestellingen boven €150",
        };
      }
    }
  }

  // Pak de eerste N AVAILABLE rijen — alle rows zijn equivalent qua product
  const targetIds = listing.cardItemRows.slice(0, qty).map((r) => r.id);

  // Atomair: flip rijen + maak bundle. Wallet-mutaties buiten de tx omdat
  // deductBalance/escrowCredit zelf transacties zijn.
  const bundle = await prisma.$transaction(async (tx) => {
    const flipped = await tx.listingCardItem.updateMany({
      where: { id: { in: targetIds }, status: "AVAILABLE" },
      data: { status: "SOLD", buyerId: userId, soldAt: new Date() },
    });
    if (flipped.count !== qty) {
      throw new Error("Eén of meer items zijn net door iemand anders gekocht");
    }

    const created = await tx.shippingBundle.create({
      data: {
        orderNumber: generateOrderNumber(),
        buyerId: userId,
        sellerId: listing.sellerId,
        shippingCost,
        totalItemCost: itemSubtotal,
        totalCost,
        status: "PAID",
        // listingId blijft null — `listingId @unique` blokkeert anders
        // meerdere onafhankelijke koop-bundles op dezelfde listing.
        listingId: null,
        shippingMethodId: selectedMethodId,
        buyerStreet: buyer.street,
        buyerHouseNumber: buyer.houseNumber,
        buyerPostalCode: buyer.postalCode,
        buyerCity: buyer.city,
        buyerCountry: buyer.country,
      },
    });

    await tx.listingCardItem.updateMany({
      where: { id: { in: targetIds } },
      data: { shippingBundleId: created.id },
    });

    // Listing-status bijwerken op basis van resterende voorraad.
    const remaining = await tx.listingCardItem.count({
      where: { listingId: listing.id, status: { in: ["AVAILABLE", "RESERVED"] } },
    });
    await tx.listing.update({
      where: { id: listing.id },
      data: { status: remaining === 0 ? "SOLD" : "PARTIALLY_SOLD" },
    });

    return created;
  });

  try {
    await deductBalance(userId, totalCost, "PURCHASE", `Gekocht: ${qty}× ${listing.title}`, undefined, undefined, listing.id);
    await escrowCredit(listing.sellerId, totalCost, `Verkocht (escrow): ${qty}× ${listing.title}`, bundle.id);
  } catch (e) {
    // Best-effort rollback: rijen + listing-status terug, bundle weg
    await prisma.listingCardItem.updateMany({
      where: { id: { in: targetIds }, status: "SOLD", buyerId: userId },
      data: { status: "AVAILABLE", buyerId: null, soldAt: null, shippingBundleId: null },
    });
    await prisma.shippingBundle.delete({ where: { id: bundle.id } }).catch(() => {});
    const remaining = await prisma.listingCardItem.count({
      where: { listingId: listing.id, status: { in: ["AVAILABLE", "RESERVED"] } },
    });
    const sold = await prisma.listingCardItem.count({
      where: { listingId: listing.id, status: "SOLD" },
    });
    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: remaining === 0 ? "SOLD" : sold > 0 ? "PARTIALLY_SOLD" : "ACTIVE" },
    });
    throw e;
  }

  await createNotification(
    listing.sellerId,
    "ORDER_PAID",
    qty > 1 ? `${qty}× verkocht!` : "Advertentie verkocht!",
    `${qty}× "${listing.title}" verkocht voor €${itemSubtotal.toFixed(2)}. Bekijk je verkopen om te verzenden.`,
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

  // D4: when the seller deletes the listing, auto-reject any PENDING proposals
  // on it. We use REJECTED (not WITHDRAWN) because the proposer didn't pull
  // their offer — the listing they were negotiating on is gone. Each proposal
  // gets a system message in the chat and the proposer gets a notification.
  if (status === "DELETED") {
    await cascadeRejectProposalsAndBundleOffers({
      listingId,
      listingTitle: listing.title,
      systemMessageReason: "verwijderd door de verkoper",
      sellerId: session.user.id,
    });
  }

  return { success: true };
}

// Shared cascade voor zowel DELETED als PAUSED. Rejecteert PENDING enkel-listing
// proposals én PENDING multi-listing bundle-offers waar deze listing in zit,
// met systeembericht in chat en notificatie naar de proposer/buyer.
async function cascadeRejectProposalsAndBundleOffers({
  listingId,
  listingTitle,
  systemMessageReason,
  sellerId,
}: {
  listingId: string;
  listingTitle: string;
  systemMessageReason: string;
  sellerId: string;
}) {
  // 1. Single-listing proposals
  const pendingProposals = await prisma.proposal.findMany({
    where: { listingId, status: "PENDING" },
    select: { id: true, conversationId: true, proposerId: true, amount: true },
  });

  for (const p of pendingProposals) {
    await prisma.proposal.update({
      where: { id: p.id },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    await prisma.message.create({
      data: {
        conversationId: p.conversationId,
        senderId: sellerId,
        body: `De advertentie "${listingTitle}" is ${systemMessageReason}. Dit voorstel is automatisch afgewezen.`,
      },
    });

    await createNotification(
      p.proposerId,
      "NEW_MESSAGE",
      "Voorstel afgewezen",
      `De advertentie "${listingTitle}" is ${systemMessageReason}. Je voorstel van €${p.amount.toFixed(2)} is automatisch afgewezen.`,
      `/nl/berichten/${p.conversationId}`
    );
  }

  // 2. Multi-listing bundle-offers (Fase 27)
  const affectedBundleOffers = await prisma.bundleProposal.findMany({
    where: {
      status: "PENDING",
      listings: { some: { listingId } },
    },
    select: { id: true, conversationId: true, buyerId: true, totalAmount: true },
  });

  for (const bp of affectedBundleOffers) {
    await prisma.bundleProposal.update({
      where: { id: bp.id },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    await prisma.message.create({
      data: {
        conversationId: bp.conversationId,
        senderId: sellerId,
        body: `Een advertentie in dit bundel-voorstel ("${listingTitle}") is ${systemMessageReason}. Het bundel-voorstel is automatisch afgewezen.`,
      },
    });

    await createNotification(
      bp.buyerId,
      "NEW_MESSAGE",
      "Bundel-voorstel afgewezen",
      `Een advertentie ("${listingTitle}") in je bundel-voorstel van €${bp.totalAmount.toFixed(2)} is ${systemMessageReason}. Het voorstel is automatisch afgewezen.`,
      `/nl/berichten/${bp.conversationId}`
    );
  }
}

// Fase 27: opslaan als concept. Permissieve validatie (alleen titel +
// listingType verplicht); volledige check pas bij `publishDraft`.
// Account-limits worden NIET gecheckt voor DRAFT — een gebruiker mag
// onbeperkt concepten hebben, alleen ACTIVE telt mee.
export async function saveDraft(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const listingId = (formData.get("listingId") as string | null) || null;

  const raw = {
    listingType: formData.get("listingType") || "SINGLE_CARD",
    imageUrls: formData.get("imageUrls") || "[]",
    title: formData.get("title") || "Concept",
    description: formData.get("description") || undefined,
    cardName: formData.get("cardName") || undefined,
    cardSetId: formData.get("cardSetId") || undefined,
    tcgdexId: formData.get("tcgdexId") || undefined,
    cardItems: formData.get("cardItems") || undefined,
    estimatedCardCount: formData.get("estimatedCardCount") || undefined,
    conditionRange: formData.get("conditionRange") || undefined,
    productType: formData.get("productType") || undefined,
    itemCategory: formData.get("itemCategory") || undefined,
    condition: formData.get("condition") || undefined,
    pricingType: formData.get("pricingType") || undefined,
    price: formData.get("price") || undefined,
    deliveryMethod: formData.get("deliveryMethod") || undefined,
    freeShipping: formData.get("freeShipping") === "true",
    shippingCost: formData.get("shippingCost") || "0",
    carriers: formData.get("carriers") || undefined,
    packageSize: formData.get("packageSize") || undefined,
    packageCount: formData.get("packageCount") || "1",
    shippingMethodIds: formData.get("shippingMethodIds") || undefined,
    allowPartialSale: formData.get("allowPartialSale") === "true",
    stockQuantity: formData.get("stockQuantity") || "1",
  };

  const result = draftListingSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const data = result.data;
  const userId = session.user.id;

  // Auto-fill pickupCity uit User.city wanneer deliveryMethod PICKUP/BOTH is.
  // DRAFTs hoeven geen city te hebben — die check gebeurt pas bij publishDraft.
  const draftUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { city: true },
  });
  const isPickupMode = data.deliveryMethod === "PICKUP" || data.deliveryMethod === "BOTH";

  const listingData: Record<string, unknown> = {
    title: data.title,
    description: data.description ?? "",
    imageUrls: data.imageUrls || "[]",
    listingType: data.listingType,
    pricingType: data.pricingType ?? "FIXED",
    price: data.pricingType === "FIXED" ? data.price ?? null : null,
    deliveryMethod: data.deliveryMethod ?? "SHIP",
    freeShipping: data.freeShipping,
    shippingCost: data.freeShipping ? 0 : data.shippingCost,
    carriers: data.carriers || null,
    packageSize: data.packageSize || null,
    packageCount: data.packageCount,
    pickupCity: isPickupMode ? draftUser?.city ?? null : null,
    allowPartialSale: data.listingType === "MULTI_CARD" ? data.allowPartialSale : false,
    stockQuantity: (data.listingType === "SEALED_PRODUCT" || data.listingType === "OTHER")
      ? Math.max(1, data.stockQuantity ?? 1)
      : 1,
    suggestedPrice: data.pricingType === "NEGOTIABLE" && data.suggestedPrice
      ? data.suggestedPrice
      : null,
    allowDirectBuy: data.allowDirectBuy ?? true,
    acceptsOffers: data.acceptsOffers ?? true,
    tradeable: data.tradeable ?? false,
    cardName: data.cardName || null,
    cardSetId: data.cardSetId || null,
    tcgdexId: data.tcgdexId || null,
    cardItems: data.cardItems || null,
    estimatedCardCount: data.estimatedCardCount ?? null,
    conditionRange: data.conditionRange || null,
    productType: data.productType || null,
    itemCategory: data.itemCategory || null,
    condition: data.condition || null,
    sellerId: userId,
    status: "DRAFT",
  };

  let listing;
  if (listingId) {
    // Updating existing draft: ownership + status guard
    const existing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { sellerId: true, status: true },
    });
    if (!existing || existing.sellerId !== userId) return { error: "Niet geautoriseerd" };
    if (existing.status !== "DRAFT") return { error: "Alleen concepten kunnen bewerkt worden via deze actie" };

    listing = await prisma.listing.update({
      where: { id: listingId },
      data: listingData as never,
    });
  } else {
    listing = await prisma.listing.create({ data: listingData as never });
  }

  return { success: true, listingId: listing.id };
}

// Fase 27: concept publiceren. Volledige createListingSchema-validatie + limit-check.
// Geen upsells/wallet-deduct in deze flow (upsells alleen via createListing).
export async function publishDraft(listingId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { shippingMethods: true },
  });
  if (!listing) return { error: "Advertentie niet gevonden" };
  if (listing.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (listing.status !== "DRAFT") return { error: "Alleen concepten kunnen gepubliceerd worden" };

  const limit = await checkListingLimit(session.user.id);
  if (!limit.allowed) {
    return { error: `Je hebt het maximum aantal actieve advertenties bereikt (${limit.max})` };
  }

  // Re-valideren met volledige createListingSchema. We bouwen pseudo-FormData uit
  // de huidige Listing-velden zodat we exact dezelfde regels afdwingen.
  const result = createListingSchema.safeParse({
    listingType: listing.listingType,
    imageUrls: listing.imageUrls,
    title: listing.title,
    description: listing.description,
    cardName: listing.cardName ?? undefined,
    cardSetId: listing.cardSetId ?? undefined,
    tcgdexId: listing.tcgdexId ?? undefined,
    cardItems: listing.cardItems ?? undefined,
    estimatedCardCount: listing.estimatedCardCount ?? undefined,
    conditionRange: listing.conditionRange ?? undefined,
    productType: listing.productType ?? undefined,
    itemCategory: listing.itemCategory ?? undefined,
    condition: listing.condition ?? undefined,
    pricingType: listing.pricingType,
    price: listing.price ?? undefined,
    deliveryMethod: listing.deliveryMethod,
    freeShipping: listing.freeShipping,
    shippingCost: listing.shippingCost,
    carriers: listing.carriers ?? undefined,
    packageSize: listing.packageSize ?? undefined,
    packageCount: listing.packageCount,
  });
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  // Pickup-mode: synchroniseer pickupCity met huidige User.city (kan tussen
  // saveDraft en publishDraft gewijzigd zijn). Vereist dat de seller een city
  // heeft ingevuld in zijn account.
  let pickupCityToSet: string | null = null;
  if (listing.deliveryMethod === "PICKUP" || listing.deliveryMethod === "BOTH") {
    const seller = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { city: true },
    });
    if (!seller?.city) {
      return { error: "Vul eerst je woonplaats in via Dashboard → Verzending voordat je een ophaal-advertentie publiceert" };
    }
    pickupCityToSet = seller.city;
  }

  // Atomic publish: listing → ACTIVE + pickup-locatie sync + (voor MULTI_CARD)
  // ListingCardItem-rows materialiseren uit cardItems JSON. Eerdere rows
  // worden weggegooid voor een schone state — DRAFTs hebben geen sales dus
  // veilig.
  await prisma.$transaction(async (tx) => {
    await tx.listing.update({
      where: { id: listingId },
      data: pickupCityToSet ? { status: "ACTIVE", pickupCity: pickupCityToSet } : { status: "ACTIVE" },
    });

    if (listing.listingType === "MULTI_CARD") {
      await tx.listingCardItem.deleteMany({ where: { listingId } });
      if (listing.cardItems) {
        try {
          const items: Array<{ cardName: string; cardSetId?: string; tcgdexId?: string; condition?: string; quantity?: number }> =
            JSON.parse(listing.cardItems);
          for (const item of items) {
            if (!item.cardName) continue;
            // Fase 27.17: split quantity-N naar N rijen van qty 1
            const qty = Math.max(1, item.quantity ?? 1);
            for (let i = 0; i < qty; i++) {
              await tx.listingCardItem.create({
                data: {
                  listingId,
                  cardName: item.cardName,
                  cardSetId: item.cardSetId || null,
                  tcgdexId: item.tcgdexId || null,
                  condition: item.condition || null,
                  quantity: 1,
                  status: "AVAILABLE",
                },
              });
            }
          }
        } catch {
          // Defensieve catch
        }
      }
    }

    // Fase 27.23: SEALED_PRODUCT/OTHER materialiseren bij publish.
    // cardName = listing-titel (zie ook createListing).
    if (listing.listingType === "SEALED_PRODUCT" || listing.listingType === "OTHER") {
      await tx.listingCardItem.deleteMany({ where: { listingId } });
      const stock = Math.max(1, listing.stockQuantity);
      for (let i = 0; i < stock; i++) {
        await tx.listingCardItem.create({
          data: {
            listingId,
            cardName: listing.title,
            quantity: 1,
            status: "AVAILABLE",
          },
        });
      }
    }
  });

  return { success: true };
}

// Fase 27: tijdelijk verbergen. PENDING proposals + bundle-offers worden
// gerejecteerd zoals bij DELETED — de seller heeft duidelijk aangegeven nu
// niet te willen verkopen. Resume zet alleen de listing weer ACTIVE; oude
// proposals zijn dan al weg.
export async function pauseListing(listingId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return { error: "Advertentie niet gevonden" };
  if (listing.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (listing.status !== "ACTIVE" && listing.status !== "PARTIALLY_SOLD") {
    return { error: "Alleen actieve advertenties kunnen gepauzeerd worden" };
  }

  // Race-safe flip — sta zowel ACTIVE als PARTIALLY_SOLD toe (Fase 27.14).
  // Bij PARTIALLY_SOLD: AVAILABLE items blijven AVAILABLE op de items-rows;
  // de listing-status zelf gaat naar PAUSED. Bij resume wordt status
  // hercomputeerd: PARTIALLY_SOLD als er nog SOLD items zijn, anders ACTIVE.
  const flipped = await prisma.listing.updateMany({
    where: { id: listingId, status: { in: ["ACTIVE", "PARTIALLY_SOLD"] } },
    data: { status: "PAUSED" },
  });
  if (flipped.count === 0) {
    return { error: "Advertentie kon niet gepauzeerd worden — status is gewijzigd" };
  }

  await cascadeRejectProposalsAndBundleOffers({
    listingId,
    listingTitle: listing.title,
    systemMessageReason: "tijdelijk gepauzeerd door de verkoper",
    sellerId: session.user.id,
  });

  return { success: true };
}

// Fase 27: pauze opheffen. Geen cascade — eerdere proposals zijn al gerejecteerd.
// Status-restore (Fase 27.14): PARTIALLY_SOLD als er nog SOLD items zijn,
// anders ACTIVE.
export async function resumeListing(listingId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return { error: "Advertentie niet gevonden" };
  if (listing.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (listing.status !== "PAUSED") return { error: "Alleen gepauzeerde advertenties kunnen hervat worden" };

  // Account-limit check bij hervatten — de seller zou tussentijds andere actieve
  // listings hebben kunnen aanmaken. Anders kan een seller met PAUSED de cap omzeilen.
  const limit = await checkListingLimit(session.user.id);
  if (!limit.allowed) {
    return { error: `Je hebt het maximum aantal actieve advertenties bereikt (${limit.max})` };
  }

  // Voor MULTI_CARD-listings met al verkochte items: terug naar PARTIALLY_SOLD
  // i.p.v. ACTIVE, anders zou de listing claimen "alle items beschikbaar".
  let restoreStatus: "ACTIVE" | "PARTIALLY_SOLD" = "ACTIVE";
  if (listing.listingType === "MULTI_CARD") {
    const sold = await prisma.listingCardItem.count({
      where: { listingId, status: "SOLD" },
    });
    if (sold > 0) restoreStatus = "PARTIALLY_SOLD";
  }

  const flipped = await prisma.listing.updateMany({
    where: { id: listingId, status: "PAUSED" },
    data: { status: restoreStatus },
  });
  if (flipped.count === 0) {
    return { error: "Advertentie kon niet hervat worden — status is gewijzigd" };
  }

  return { success: true };
}

// Fase 27.14: alleen-beschrijving update. Voor PARTIALLY_SOLD listings staat
// edit van het description-veld toe zodat seller kan clarificeren wat er nog
// in zit. Titel/foto's/prijs blijven gelocked om misbruik te voorkomen.
// Werkt op ACTIVE en PARTIALLY_SOLD.
export async function updateListingDescription(listingId: string, description: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const trimmed = description.trim();
  if (trimmed.length < 10) return { error: "Beschrijving moet minimaal 10 tekens zijn" };
  if (trimmed.length > 2000) return { error: "Beschrijving mag maximaal 2000 tekens zijn" };

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { sellerId: true, status: true },
  });
  if (!listing) return { error: "Advertentie niet gevonden" };
  if (listing.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (listing.status !== "ACTIVE" && listing.status !== "PARTIALLY_SOLD") {
    return { error: "Beschrijving alleen aanpasbaar bij actieve advertenties" };
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: { description: trimmed },
  });

  return { success: true };
}

// Fase 27: hard-delete van een DRAFT-listing (concept). Geen cascade nodig
// omdat een DRAFT nooit publiek is geweest, dus geen proposals/bundle-offers.
export async function deleteDraft(listingId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return { error: "Advertentie niet gevonden" };
  if (listing.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (listing.status !== "DRAFT") return { error: "Alleen concepten kunnen via deze actie verwijderd worden" };

  await prisma.listing.delete({ where: { id: listingId } });

  return { success: true };
}
