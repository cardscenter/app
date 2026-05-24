"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createListingSchema } from "@/lib/validations/listing";
import { applyFreeUpsellsToCost } from "@/lib/upsell-config";
import {
  availableLabelsFor,
  calculateLabelCost,
  isValidLabelColor,
  isValidLabelType,
  MAX_LABELS_PER_LISTING,
  type LabelColor,
  type LabelType,
} from "@/lib/listing/labels";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { generateOrderNumber } from "@/lib/order-number";
import { checkListingLimit } from "@/lib/account-limits";
import type { UpsellType } from "@/types";
import { PICKUP_RESERVATION_DAYS } from "@/lib/bundle-offer-config";
import { requiresSignedShipping } from "@/lib/shipping/tracked-threshold";
import { enrichMethod, deriveListingShippingMethodIds } from "@/lib/shipping/static-methods";
import { mailboxEligibleType } from "@/lib/listing-types";
import { resolveLocalCardSetId } from "@/lib/card-helpers";
import { requireNotSuspended } from "@/lib/suspension";
import { requireEmailVerified } from "@/lib/email-verification";
import { publish, listingChannel, userChannel } from "@/lib/realtime";

function publishListingChanged(listingId: string, status: string) {
  publish(listingChannel(listingId), {
    type: "listing-changed",
    payload: { listingId, status },
  });
}


export async function createListing(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const verified = await requireEmailVerified(session.user.id);
  if ("error" in verified) return { error: verified.error };

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
    allowMailbox: formData.get("allowMailbox") === "true",
    stockQuantity: formData.get("stockQuantity") || "1",
    suggestedPrice: formData.get("suggestedPrice") || undefined,
    allowDirectBuy: formData.get("allowDirectBuy") === "true",
    acceptsOffers: formData.get("acceptsOffers") === "true",
    allowPlatformPickup: formData.get("allowPlatformPickup") === "true",
    allowExternalPickup: formData.get("allowExternalPickup") === "true",
  };

  const result = createListingSchema.safeParse(raw);
  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const data = result.data;
  const userId = session.user.id;

  // Labels gaan buiten zod-schema om (apart parsen + valideren), zelfde patroon
  // als createAuction. Server-side hercheck van availability is anti-tamper.
  const labelsRaw = formData.get("labels");

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
    select: { balance: true, reservedBalance: true, accountType: true, city: true, freeUpsellsRemaining: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Pickup-listings: User.city is verplicht en wordt automatisch overgenomen.
  // Geen handmatige invoer in de form — privacy + minder vinger-werk.
  if ((data.deliveryMethod === "PICKUP" || data.deliveryMethod === "BOTH") && !user.city) {
    return { error: "Vul eerst je woonplaats in via Dashboard → Verzending voordat je een ophaal-advertentie plaatst" };
  }

  // Free-upsell-quota (Fase 31): tier-abonnement geeft N gratis HOMEPAGE_SPOTLIGHTs
  // per maand. Helper verdeelt quota greedy lineair en geeft per-entry-cost terug.
  let perEntryCosts: number[] = [];
  let freeUsed = 0;
  if (upsellEntries.length > 0) {
    const allocation = applyFreeUpsellsToCost(
      upsellEntries,
      user.accountType,
      user.freeUpsellsRemaining,
      "listing"
    );
    perEntryCosts = allocation.perEntry;
    totalUpsellCost = allocation.total;
    freeUsed = allocation.freeUsed;
  }

  // Parse + valideer labels (max 2 per listing, conditional availability,
  // bundle-prijs 1=€0,99 / 2=€1,69). Anti-tamper hercheck.
  let parsedLabels: { type: LabelType; colorKey: LabelColor }[] = [];
  let labelsCost = 0;
  if (typeof labelsRaw === "string" && labelsRaw.length > 0) {
    try {
      const rawLabels = JSON.parse(labelsRaw) as Array<{ type: string; colorKey: string }>;
      const cleaned = rawLabels
        .filter(
          (l) =>
            typeof l?.type === "string" &&
            typeof l?.colorKey === "string" &&
            isValidLabelType(l.type) &&
            isValidLabelColor(l.colorKey),
        )
        .slice(0, MAX_LABELS_PER_LISTING) as {
        type: LabelType;
        colorKey: LabelColor;
      }[];

      const availability = availableLabelsFor({
        condition: data.condition ?? null,
        listingType: data.listingType,
      });
      const availSet = new Set(
        availability.filter((a) => a.available).map((a) => a.type),
      );
      for (const l of cleaned) {
        if (!availSet.has(l.type)) {
          return { error: `Label "${l.type}" is niet beschikbaar voor deze advertentie` };
        }
      }

      const seen = new Set<LabelType>();
      parsedLabels = cleaned.filter((l) => {
        if (seen.has(l.type)) return false;
        seen.add(l.type);
        return true;
      });

      labelsCost = calculateLabelCost(parsedLabels.length);
    } catch {
      parsedLabels = [];
    }
  }

  // Combined balance-check (upsells + labels in één keer)
  const totalPromotionCost = totalUpsellCost + labelsCost;
  if (totalPromotionCost > 0) {
    const availableBalance = user.balance - user.reservedBalance;
    if (availableBalance < totalPromotionCost) {
      return { error: `Onvoldoende beschikbaar saldo. Benodigd: €${totalPromotionCost.toFixed(2)}, beschikbaar: €${availableBalance.toFixed(2)}` };
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
    allowPartialSale: false,
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
    // Pickup-modi (Fase 27.39): alleen relevant voor PICKUP/BOTH; voor SHIP
    // is altijd PLATFORM verplicht en EXTERNAL niet toegestaan.
    allowPlatformPickup: data.allowPlatformPickup ?? true,
    allowExternalPickup: data.allowExternalPickup ?? true,
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
      // Geen extra velden — bundle wordt als geheel verkocht (Fase 33 v2).
      break;
    case "COLLECTION":
      // Geen extra velden — alle info hoort in description (Fase 33 v2).
      break;
    case "SEALED_PRODUCT":
      listingData.productType = data.productType;
      break;
    case "OTHER":
      listingData.itemCategory = data.itemCategory;
      break;
  }

  // Server-side derivation van shipping methods (Fase 33 v2). STANDARD+SIGNED
  // altijd inbegrepen; MAILBOX_PARCEL alleen voor SINGLE/MULTI listings onder
  // €150 én als seller `allowMailbox=true` heeft aangevinkt.
  let methodSnapshots: { id: string; price: number }[] = [];
  const isShipDelivery = data.deliveryMethod === "SHIP" || data.deliveryMethod === "BOTH";
  if (isShipDelivery) {
    const seller = await prisma.user.findUnique({
      where: { id: userId },
      select: { country: true },
    });
    if (!seller?.country) {
      return { error: "Vul eerst je land in op je profiel voordat je kunt verkopen." };
    }

    const derivedIds = await deriveListingShippingMethodIds({
      prisma,
      sellerId: userId,
      allowMailbox: data.allowMailbox,
      listingType: data.listingType,
      price: data.pricingType === "FIXED" ? data.price ?? null : null,
      mailboxEligible: mailboxEligibleType,
    });

    if (derivedIds.length === 0) {
      return {
        error: "Configureer eerst je verzending via Dashboard → Verzending — er zijn geen actieve verzendmethoden.",
      };
    }

    const methods = await prisma.sellerShippingMethod.findMany({
      where: { id: { in: derivedIds }, sellerId: userId, isActive: true },
    });

    methodSnapshots = methods
      .map((m) => {
        const enriched = enrichMethod(m, seller.country!);
        return enriched ? { id: m.id, price: enriched.effectivePrice } : null;
      })
      .filter((s): s is { id: string; price: number } => s !== null);
  }

  // Atomic transaction: create listing + shipping methods + upsells + deduct balance
  let listing;
  try {
    listing = await prisma.$transaction(async (tx) => {
    const newListing = await tx.listing.create({ data: listingData as never });

    // MULTI_CARD heeft geen per-kaart-rows meer (Fase 33 v2): de bundel wordt
    // altijd als geheel verkocht. Geen partial-sale-flow.

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

    // Create upsell records
    if (upsellEntries.length > 0) {
      const now = new Date();

      for (let i = 0; i < upsellEntries.length; i++) {
        const entry = upsellEntries[i];
        const cost = perEntryCosts[i];
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

      // Race-safe quota-decrement (audit-fix Fase 31).
      if (freeUsed > 0) {
        const updated = await tx.user.updateMany({
          where: { id: userId, freeUpsellsRemaining: { gte: freeUsed } },
          data: { freeUpsellsRemaining: { decrement: freeUsed } },
        });
        if (updated.count === 0) {
          throw new Error("FREE_UPSELL_QUOTA_RACE");
        }
      }
    }

    // Create label-records (max 2, bundle-cost al berekend).
    if (parsedLabels.length > 0) {
      const perLabelCost = labelsCost / parsedLabels.length;
      await tx.listingLabel.createMany({
        data: parsedLabels.map((l) => ({
          listingId: newListing.id,
          type: l.type,
          colorKey: l.colorKey,
          cost: Math.round(perLabelCost * 100) / 100,
        })),
      });
    }

    // Eén balance-deduct voor upsells + labels samen — minder Transaction-rijen.
    if (totalPromotionCost > 0) {
      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore - totalPromotionCost;

      await tx.user.update({
        where: { id: userId },
        data: { balance: balanceAfter },
      });

      const description = (() => {
        const parts: string[] = [];
        if (upsellEntries.length > 0) parts.push(upsellEntries.map((e) => e.type).join(", "));
        if (parsedLabels.length > 0) parts.push(`${parsedLabels.length} label${parsedLabels.length === 1 ? "" : "s"}`);
        return `Promotiekosten advertentie: ${parts.join(" + ")}`;
      })();

      await tx.transaction.create({
        data: {
          userId,
          type: "FEE",
          amount: -totalPromotionCost,
          balanceBefore,
          balanceAfter,
          description,
          relatedListingId: newListing.id,
        },
      });
    }

    return newListing;
    });
  } catch (e) {
    // Quota-race: een parallelle createListing claimde de gratis upsell-quota
    // tussen onze read en write. User moet opnieuw proberen — bij retry
    // ziet allocator de bijgewerkte freeUpsellsRemaining en rekent de upsell
    // gewoon als betaald aan.
    if (e instanceof Error && e.message === "FREE_UPSELL_QUOTA_RACE") {
      return { error: "Je gratis homepage-spotlight is intussen gebruikt door een andere actie. Probeer opnieuw, de upsell wordt nu in rekening gebracht." };
    }
    throw e;
  }

  // Award Ember for creating a listing
  const { logActivity } = await import("@/actions/activity");
  logActivity(session.user.id, "CREATE_LISTING", { listingId: listing.id });

  return { success: true, listingId: listing.id };
}

import type { DeliveryChoice } from "@/lib/listing-types";

export async function buyListing(
  listingId: string,
  shippingMethodId?: string,
  quantity: number = 1,
  deliveryChoice: DeliveryChoice = "SHIP"
) {
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

  // Validatie deliveryChoice tegen listing-instellingen.
  const wantsPickup = deliveryChoice === "PICKUP_PLATFORM" || deliveryChoice === "PICKUP_EXTERNAL";
  const wantsShip = deliveryChoice === "SHIP";
  if (wantsShip && listing.deliveryMethod === "PICKUP") {
    return { error: "Deze advertentie is alleen op te halen — geen verzend-aankoop mogelijk." };
  }
  if (wantsPickup && listing.deliveryMethod === "SHIP") {
    return { error: "Deze advertentie is alleen te verzenden — geen ophalen mogelijk." };
  }
  if (deliveryChoice === "PICKUP_PLATFORM" && !listing.allowPlatformPickup) {
    return { error: "Verkoper accepteert geen wallet-betaling voor ophalen." };
  }
  if (deliveryChoice === "PICKUP_EXTERNAL" && !listing.allowExternalPickup) {
    return { error: "Verkoper accepteert geen ophaal-betaling — kies wallet-vooraf." };
  }
  // allowDirectBuy enforcement (Fase 27.78) — seller-toggle moet ook op
  // backend gerespecteerd worden, niet alleen UI. Voor PICKUP_EXTERNAL is
  // de toggle niet relevant (reserveer-flow gaat altijd door).
  if (deliveryChoice !== "PICKUP_EXTERNAL" && !listing.allowDirectBuy) {
    return { error: "Verkoper accepteert geen Direct Kopen — neem contact op via chat." };
  }

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
      deliveryChoice,
    });
  }

  // === Single-flip flow (SINGLE_CARD, COLLECTION, of legacy SEALED/OTHER) ===
  if (listing.status === "PARTIALLY_SOLD") {
    return { error: "Deze advertentie is gedeeltelijk verkocht — vraag de overgebleven items aan via chat." };
  }
  if (listing.status !== "ACTIVE") return { error: "Advertentie is niet meer beschikbaar" };

  const buyer = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!buyer) return { error: "Gebruiker niet gevonden" };

  // === PICKUP_EXTERNAL: reserveer listing zonder wallet-mutatie ===
  if (deliveryChoice === "PICKUP_EXTERNAL") {
    return reserveListingForExternalPickup({
      buyerId: session.user.id,
      listing,
    });
  }

  // === SHIP en PICKUP_PLATFORM: PLATFORM-flow met escrow ===
  // Determine shipping cost — voor PICKUP_PLATFORM altijd 0 (geen verzending).
  let shippingCost = wantsShip ? listing.shippingCost : 0;
  let selectedMethodId: string | null = null;
  if (wantsShip && shippingMethodId && listing.shippingMethods.length > 0) {
    const method = listing.shippingMethods.find((m) => m.shippingMethodId === shippingMethodId);
    if (method) {
      shippingCost = method.price;
      selectedMethodId = method.shippingMethodId;
    }
  }
  if (wantsShip && listing.freeShipping) shippingCost = 0;

  const totalCost = listing.price + shippingCost;

  const buyerAvailable = buyer.balance - buyer.reservedBalance;
  if (buyerAvailable < totalCost) {
    return { error: `Onvoldoende beschikbaar saldo. Benodigd: €${totalCost.toFixed(2)}` };
  }

  // Check buyer has address — voor SHIP verplicht (verzendadres). Voor
  // PICKUP_PLATFORM is een verzendadres niet strict nodig maar handig voor
  // facturatie; we vereisen het toch zodat bundle-snapshots consistent blijven.
  if (!buyer.street || !buyer.postalCode || !buyer.city) {
    return { error: "Vul eerst je adres in via Dashboard → Verzending" };
  }

  // Shipping enforcement — alleen voor SHIP-aankopen (PICKUP heeft geen carrier).
  // Fase 33: alle methodes zijn getracked. SIGNED is verplicht ≥€150 (alle zones).
  // Fase 33 v2: MAILBOX_PARCEL niet toegestaan ≥€150 (anti-fraude).
  if (wantsShip && selectedMethodId) {
    const shippingMethod = await prisma.sellerShippingMethod.findUnique({
      where: { id: selectedMethodId },
      select: { service: true },
    });

    if (listing.price >= 150 && shippingMethod?.service === "MAILBOX_PARCEL") {
      return {
        error: "Brievenbuspakket niet toegestaan voor bestellingen boven €150",
      };
    }
    if (requiresSignedShipping(listing.price) && shippingMethod?.service !== "PARCEL_SIGNED") {
      return {
        error: "Aangetekende verzending is verplicht voor bestellingen boven €150",
      };
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

  // Create ShippingBundle. Voor PICKUP_PLATFORM: deliveryMethod=PICKUP,
  // paymentMode=PLATFORM, geen shippingMethodId. Bundle status PAID — escrow
  // wordt vrijgegeven bij confirmPickup met code (zoals bestaande PLATFORM-flow).
  await prisma.shippingBundle.create({
    data: {
      orderNumber: generateOrderNumber(),
      buyerId: session.user.id,
      sellerId: listing.sellerId,
      shippingCost,
      totalItemCost: listing.price,
      totalCost,
      status: "PAID",
      paymentMode: "PLATFORM",
      deliveryMethod: wantsShip ? "SHIP" : "PICKUP",
      listingId,
      shippingMethodId: wantsShip ? selectedMethodId : null,
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

  publishListingChanged(listingId, "SOLD");

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
  deliveryChoice: DeliveryChoice;
}) {
  const { session, listing, deliveryChoice } = args;
  const userId = session.user!.id!;
  const qty = Math.max(1, Math.floor(args.quantity));
  const wantsShip = deliveryChoice === "SHIP";

  // Self-purchase blokkering (Fase 27.78) — buyListing heeft deze check al,
  // maar de stocked-route had hem niet. Voorkomt fake sales / balance-juggling.
  if (listing.sellerId === userId) {
    return { error: "Je kunt je eigen advertentie niet kopen" };
  }
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

  // PICKUP_EXTERNAL → reserveer N rijen zonder wallet-mutatie
  if (deliveryChoice === "PICKUP_EXTERNAL") {
    return reserveStockedListingForExternalPickup({
      buyer,
      listing,
      quantity: qty,
    });
  }

  // SHIP en PICKUP_PLATFORM → wallet/escrow flow
  // Shipping cost: voor PICKUP_PLATFORM altijd 0 (geen verzending).
  let shippingCost = wantsShip ? listing.shippingCost : 0;
  let selectedMethodId: string | null = null;
  if (wantsShip && args.shippingMethodId && listing.shippingMethods.length > 0) {
    const method = listing.shippingMethods.find((m) => m.shippingMethodId === args.shippingMethodId);
    if (method) {
      shippingCost = method.price;
      selectedMethodId = method.shippingMethodId;
    }
  }
  if (wantsShip && listing.freeShipping) shippingCost = 0;

  const itemSubtotal = (listing.price ?? 0) * qty;
  const totalCost = itemSubtotal + shippingCost;

  const buyerAvailable = buyer.balance - buyer.reservedBalance;
  if (buyerAvailable < totalCost) {
    return { error: `Onvoldoende beschikbaar saldo. Benodigd: €${totalCost.toFixed(2)}` };
  }

  // Shipping enforcement (op TOTAAL, want het is één pakket) — alleen SHIP.
  // Fase 33: SIGNED verplicht ≥€150 (alle zones).
  // Fase 33 v2: MAILBOX_PARCEL niet toegestaan ≥€150 (anti-fraude).
  if (wantsShip && selectedMethodId) {
    const shippingMethod = await prisma.sellerShippingMethod.findUnique({
      where: { id: selectedMethodId },
      select: { service: true },
    });
    if (itemSubtotal >= 150 && shippingMethod?.service === "MAILBOX_PARCEL") {
      return { error: "Brievenbuspakket niet toegestaan voor bestellingen boven €150" };
    }
    if (requiresSignedShipping(itemSubtotal) && shippingMethod?.service !== "PARCEL_SIGNED") {
      return { error: "Aangetekende verzending is verplicht voor bestellingen boven €150" };
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
        paymentMode: "PLATFORM",
        deliveryMethod: wantsShip ? "SHIP" : "PICKUP",
        // listingId blijft null — `listingId @unique` blokkeert anders
        // meerdere onafhankelijke koop-bundles op dezelfde listing.
        listingId: null,
        shippingMethodId: wantsShip ? selectedMethodId : null,
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

// Fase 27.39: reserveer een non-stocked listing voor EXTERNAL pickup. Geen
// wallet-mutatie, listing → RESERVED, bundle PENDING+EXTERNAL met
// PICKUP_RESERVATION_DAYS-timeout. Cron `pickup-reservation-timeout` ruimt op
// als koper niet komt opdagen of moment niet wordt afgesproken.
async function reserveListingForExternalPickup(args: {
  buyerId: string;
  listing: {
    id: string;
    title: string;
    price: number | null;
    sellerId: string;
    status: string;
  };
}) {
  const { buyerId, listing } = args;
  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) return { error: "Gebruiker niet gevonden" };

  const claimed = await prisma.listing.updateMany({
    where: { id: listing.id, status: "ACTIVE" },
    data: { status: "RESERVED", buyerId },
  });
  if (claimed.count === 0) {
    return { error: "Advertentie is net door iemand anders gereserveerd of gekocht" };
  }

  const expiresAt = new Date(Date.now() + PICKUP_RESERVATION_DAYS * 24 * 60 * 60 * 1000);
  // Try-catch rollback (Fase 27.79) — als bundle.create faalt (DB-error,
  // constraint), zou de listing eeuwig in RESERVED hangen zonder bundle.
  // Geen cron pikt dat op want pickup-reservation-timeout filtert op bundle.
  try {
    await prisma.shippingBundle.create({
      data: {
        orderNumber: generateOrderNumber(),
        buyerId,
        sellerId: listing.sellerId,
        shippingCost: 0,
        totalItemCost: listing.price ?? 0,
        totalCost: listing.price ?? 0,
        status: "PENDING",
        paymentMode: "EXTERNAL",
        deliveryMethod: "PICKUP",
        pickupReservationExpiresAt: expiresAt,
        listingId: listing.id,
        buyerStreet: buyer.street,
        buyerHouseNumber: buyer.houseNumber,
        buyerPostalCode: buyer.postalCode,
        buyerCity: buyer.city,
        buyerCountry: buyer.country,
      },
    });
  } catch (e) {
    await prisma.listing.updateMany({
      where: { id: listing.id, status: "RESERVED", buyerId },
      data: { status: "ACTIVE", buyerId: null },
    });
    throw e;
  }

  await createNotification(
    listing.sellerId,
    "ORDER_PAID",
    "Ophaal-reservering",
    `"${listing.title}" is gereserveerd voor ophalen — koper betaalt aan jou bij ophalen.`,
    "/dashboard/verkopen"
  );

  return { success: true };
}

// Fase 27.39: idem voor stocked listings (SEALED/OTHER met cardItemRows).
// Flipt N rijen AVAILABLE → RESERVED en koppelt ze aan een EXTERNAL bundle.
async function reserveStockedListingForExternalPickup(args: {
  buyer: { id: string; street: string | null; houseNumber: string | null; postalCode: string | null; city: string | null; country: string | null };
  listing: {
    id: string;
    title: string;
    price: number | null;
    sellerId: string;
    cardItemRows: Array<{ id: string }>;
  };
  quantity: number;
}) {
  const { buyer, listing, quantity } = args;
  const targetIds = listing.cardItemRows.slice(0, quantity).map((r) => r.id);
  const itemSubtotal = (listing.price ?? 0) * quantity;
  const expiresAt = new Date(Date.now() + PICKUP_RESERVATION_DAYS * 24 * 60 * 60 * 1000);

  const bundle = await prisma.$transaction(async (tx) => {
    const flipped = await tx.listingCardItem.updateMany({
      where: { id: { in: targetIds }, status: "AVAILABLE" },
      data: { status: "RESERVED", buyerId: buyer.id },
    });
    if (flipped.count !== quantity) {
      throw new Error("Eén of meer items zijn net door iemand anders gereserveerd");
    }

    const created = await tx.shippingBundle.create({
      data: {
        orderNumber: generateOrderNumber(),
        buyerId: buyer.id,
        sellerId: listing.sellerId,
        shippingCost: 0,
        totalItemCost: itemSubtotal,
        totalCost: itemSubtotal,
        status: "PENDING",
        paymentMode: "EXTERNAL",
        deliveryMethod: "PICKUP",
        pickupReservationExpiresAt: expiresAt,
        listingId: null,
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

    // Listing-status: PARTIALLY_SOLD als er nog AVAILABLE rijen zijn na deze
    // reservering, anders blijft hij ACTIVE — RESERVED zou misleidend zijn
    // want andere kopers kunnen nog wel andere stuks kopen. Status-filter
    // include PARTIALLY_SOLD zodat de update slaagt als listing al partial
    // was van een eerdere koop (Fase 27.79 fix).
    const remainingAvailable = await tx.listingCardItem.count({
      where: { listingId: listing.id, status: "AVAILABLE" },
    });
    if (remainingAvailable === 0) {
      await tx.listing.updateMany({
        where: { id: listing.id, status: { in: ["ACTIVE", "PARTIALLY_SOLD"] } },
        data: { status: "PARTIALLY_SOLD" },
      });
    }

    return created;
  });

  await createNotification(
    listing.sellerId,
    "ORDER_PAID",
    quantity > 1 ? `${quantity}× gereserveerd voor ophaal` : "Ophaal-reservering",
    `${quantity}× "${listing.title}" gereserveerd — koper betaalt aan jou bij ophalen.`,
    "/dashboard/verkopen"
  );

  return { success: true, bundleId: bundle.id };
}

// Fase 27.40: alleen DELETED-flow blijft. "Markeer als verkocht" knop is
// teruggetrokken — alle echte verkoop-flows zetten SOLD automatisch (Direct
// Kopen, proposal-accept, bundle-accept, pickup-confirm). Een handmatige
// SOLD-flip zou cascade-rejection van pendings missen en seller-stats
// verstoren zonder echte transactie.
export async function updateListingStatus(listingId: string, status: "DELETED") {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return { error: "Advertentie niet gevonden" };
  if (listing.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (listing.status === "SOLD" || listing.status === "DELETED") {
    return { error: "Deze advertentie kan niet meer worden gewijzigd" };
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: { status },
  });

  await cascadeRejectProposalsAndBundleOffers({
    listingId,
    listingTitle: listing.title,
    systemMessageReason: "verwijderd door de verkoper",
    sellerId: session.user.id,
  });

  publishListingChanged(listingId, status);

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

// Fase 27.83: saveDraft / publishDraft / deleteDraft verwijderd. Concept-flow
// gaf in de praktijk weinig waarde — verkopers vullen het form in één keer in.

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

  publishListingChanged(listingId, "PAUSED");

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

  publishListingChanged(listingId, restoreStatus);

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

// Fase 27.34: "Rest sluiten" voor PARTIALLY_SOLD listing. Markeert de listing
// als SOLD zonder de overgebleven AVAILABLE items naar een buyer te koppelen
// (er is geen koper voor de rest — seller geeft aan dat ze op zijn of niet
// meer verkocht hoeven te worden). Cascade-rejects lopende proposals zoals
// bij DELETED. Items blijven historisch op AVAILABLE staan; de listing-status
// is leidend voor zichtbaarheid (SOLD = niet meer publiek koopbaar).
export async function closePartiallySoldListing(listingId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return { error: "Advertentie niet gevonden" };
  if (listing.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (listing.status !== "PARTIALLY_SOLD") {
    return { error: "Alleen gedeeltelijk verkochte advertenties kunnen op deze manier gesloten worden" };
  }

  const flipped = await prisma.listing.updateMany({
    where: { id: listingId, status: "PARTIALLY_SOLD" },
    data: { status: "SOLD" },
  });
  if (flipped.count === 0) {
    return { error: "Advertentie kon niet gesloten worden — status is gewijzigd" };
  }

  await cascadeRejectProposalsAndBundleOffers({
    listingId,
    listingTitle: listing.title,
    systemMessageReason: "afgesloten door de verkoper (overige items niet meer beschikbaar)",
    sellerId: session.user.id,
  });

  publishListingChanged(listingId, "SOLD");

  return { success: true };
}

// Bulk-import van listings via CSV (Fase 31, PRO+ feature). Per rij wordt
// een minimale listing aangemaakt — sellers vullen images en specifieke
// velden achteraf aan via de standaard edit-flow. Geen one-big-transaction
// (timeout-risico bij 50+ rijen) — per-rij Prisma create + per-rij error capture.
import { hasFeature } from "@/lib/subscription-tiers";
import { parseCsvText, type BulkRow } from "@/lib/listing-bulk-import";

export async function bulkImportListings(csvText: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountType: true, city: true },
  });
  if (!user) return { error: "Gebruiker niet gevonden" };

  if (!hasFeature(user.accountType, "bulkUpload")) {
    return { error: "Bulk-upload is alleen beschikbaar voor PRO en hogere abonnementen." };
  }

  const parsed = parseCsvText(csvText);
  if (parsed.rows.length === 0) {
    return {
      error: parsed.errors.length > 0
        ? `Geen geldige rijen gevonden (${parsed.errors.length} fouten).`
        : "Geen rijen in CSV.",
      errors: parsed.errors,
    };
  }

  // Account-limit check vooraf — voorkom dat we 30 rijen importeren tot we
  // op rij 31 tegen de limit aanlopen. Tel actieve listings + nieuwe rijen.
  const limitCheck = await checkListingLimit(session.user.id);
  const remaining = limitCheck.max === Infinity ? Infinity : limitCheck.max - limitCheck.current;
  if (!limitCheck.allowed) {
    return { error: `Listing-limiet bereikt (${limitCheck.current}/${limitCheck.max}). Upgrade je abonnement of verwijder oude listings.` };
  }
  if (remaining !== Infinity && parsed.rows.length > remaining) {
    return {
      error: `Te veel rijen voor je tier-limiet. Je kunt nog ${remaining} listings aanmaken, CSV bevat er ${parsed.rows.length}.`,
    };
  }

  // Voor PICKUP/BOTH: User.city is verplicht zoals in createListing
  const hasPickupRows = parsed.rows.some(
    (r) => r.data.deliveryMethod === "PICKUP" || r.data.deliveryMethod === "BOTH",
  );
  if (hasPickupRows && !user.city) {
    return { error: "Vul eerst je woonplaats in via Dashboard → Verzending voor ophaal-listings." };
  }

  // Per-rij creatie. Errors per rij geaggregeerd; geen rollback bij partial failure.
  // Audit-fix: per-rij re-check van listing-limit zodat parallelle creations
  // tijdens import niet de tier-cap kunnen overschrijden. Initial limit-check
  // is alleen pre-flight; tussen pre-flight en per-rij create kunnen andere
  // listings de cap raken.
  const created: { row: number; listingId: string; title: string }[] = [];
  const errors: { row: number; field?: string; message: string }[] = [...parsed.errors];

  for (let i = 0; i < parsed.rows.length; i++) {
    const { row, data } = parsed.rows[i];

    // Re-check limit voor elke rij — pakt parallelle creations vanuit
    // andere acties (gewone createListing, andere bulk-import-call) op.
    const liveLimit = await checkListingLimit(session.user.id);
    if (!liveLimit.allowed) {
      errors.push({
        row,
        message: `Tier-limiet bereikt tijdens import (${liveLimit.current}/${liveLimit.max}). Resterende rijen overgeslagen.`,
      });
      for (let j = i + 1; j < parsed.rows.length; j++) {
        errors.push({ row: parsed.rows[j].row, message: "Tier-limiet bereikt, overgeslagen." });
      }
      break;
    }

    try {
      const listing = await createSingleBulkListing(session.user.id, data, user.city);
      created.push({ row, listingId: listing.id, title: data.title });
    } catch (e) {
      errors.push({
        row,
        message: e instanceof Error ? e.message : "Onbekende fout",
      });
    }
  }

  return { success: true, createdCount: created.length, created, errors };
}

async function createSingleBulkListing(
  sellerId: string,
  data: BulkRow,
  userCity: string | null,
) {
  const isPickup = data.deliveryMethod === "PICKUP" || data.deliveryMethod === "BOTH";
  const isShipping = data.deliveryMethod === "SHIP" || data.deliveryMethod === "BOTH";

  let methodSnapshots: { id: string; price: number }[] = [];
  if (data.shippingMethodIds.length > 0) {
    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
      select: { country: true },
    });
    if (!seller?.country) {
      throw new Error("Vul eerst je land in op je profiel voordat je bulk-uploads doet");
    }

    const methods = await prisma.sellerShippingMethod.findMany({
      where: { id: { in: data.shippingMethodIds }, sellerId, isActive: true },
    });

    // Fase 33 v2: filter MAILBOX_PARCEL als prijs ≥€150 of type niet eligible
    const blockMailbox =
      (data.pricingType === "FIXED" && data.price >= 150) ||
      !mailboxEligibleType(data.listingType);

    methodSnapshots = methods
      .filter((m) => !(blockMailbox && m.service === "MAILBOX_PARCEL"))
      .map((m) => {
        const enriched = enrichMethod(m, seller.country!);
        return enriched ? { id: m.id, price: enriched.effectivePrice } : null;
      })
      .filter((s): s is { id: string; price: number } => s !== null);

    if (isShipping && methodSnapshots.length === 0) {
      throw new Error("Geen geldige verzendmethodes geselecteerd voor deze rij");
    }
  } else if (isShipping) {
    // SHIP/BOTH-rijen MOETEN minstens één shipping-method opgeven.
    throw new Error("shippingMethodIds verplicht voor SHIP/BOTH-listings");
  }

  return await prisma.$transaction(async (tx) => {
    const listing = await tx.listing.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrls: "[]",
        listingType: data.listingType,
        pricingType: data.pricingType,
        price: data.pricingType === "FIXED" ? data.price : null,
        deliveryMethod: data.deliveryMethod,
        freeShipping: false,
        shippingCost: 0,
        pickupCity: isPickup ? userCity : null,
        condition: data.condition ?? null,
        sellerId,
        allowDirectBuy: true,
        acceptsOffers: true,
        allowPlatformPickup: true,
        allowExternalPickup: true,
      },
    });

    for (const m of methodSnapshots) {
      await tx.listingShippingMethod.create({
        data: { listingId: listing.id, shippingMethodId: m.id, price: m.price },
      });
    }

    return listing;
  });
}

