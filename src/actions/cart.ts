"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { generateOrderNumber } from "@/lib/order-number";
import { expireClaimedItems, unclaimItem, closeClaimsaleIfDepleted } from "@/actions/claimsale";
import { requireNotSuspended } from "@/lib/suspension";
import { requiresSignedShipping } from "@/lib/shipping/tracked-threshold";
import { publish, claimsaleChannel, userChannel } from "@/lib/realtime";

async function publishCartCount(userId: string) {
  const count = await prisma.cartItem.count({ where: { userId } });
  publish(userChannel(userId), { type: "cart-changed", payload: { count } });
}

/**
 * Remove item from cart. This also unclaims the item so it becomes available again.
 */
export async function removeFromCart(cartItemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const cartItem = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    select: { userId: true, claimsaleItemId: true },
  });

  if (!cartItem) return { error: "Item niet gevonden" };
  if (cartItem.userId !== session.user.id) return { error: "Niet geautoriseerd" };

  // Unclaim the item (resets to AVAILABLE + deletes cart item)
  return unclaimItem(cartItem.claimsaleItemId);
}

export async function getCartCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  return prisma.cartItem.count({
    where: { userId: session.user.id },
  });
}

export type CartShippingMethod = {
  id: string;
  carrier: string;
  service: string; // ShippingService: MAILBOX_PARCEL | PARCEL_STANDARD | PARCEL_SIGNED
  zone: string;    // ShippingZone: DOMESTIC | EU_NEAR | EU_FAR
  price: number;   // snapshot
};

export type CartSellerGroup = {
  sellerId: string;
  sellerName: string;
  shippingCost: number;
  shippingMethods: CartShippingMethod[];
  items: {
    cartItemId: string;
    claimsaleItemId: string;
    cardName: string;
    condition: string;
    price: number;
    imageUrls: string[];
    cardSetName: string | null;
    status: string;
    // Claim timer data
    claimedAt: string | null;
    expiresAt: string | null;
    // Change detection (snapshot vs current)
    snapshotPrice: number | null;
    snapshotCardName: string | null;
    priceChanged: boolean;
    nameChanged: boolean;
  }[];
};

const CLAIM_DURATION_MS = 15 * 60 * 1000;

export async function getCart(): Promise<CartSellerGroup[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Expire any stale claims before fetching cart
  await expireClaimedItems();

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: {
      claimsaleItem: {
        include: {
          cardSet: true,
          claimsale: {
            include: {
              seller: { select: { id: true, displayName: true } },
              shippingMethods: {
                include: { shippingMethod: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by seller
  const groupMap = new Map<string, CartSellerGroup>();
  // Track claimsale shipping methods per seller for intersection
  const sellerMethodMaps = new Map<string, Map<string, CartShippingMethod>[]>();

  for (const ci of cartItems) {
    const seller = ci.claimsaleItem.claimsale.seller;
    const sellerId = seller.id;

    if (!groupMap.has(sellerId)) {
      groupMap.set(sellerId, {
        sellerId,
        sellerName: seller.displayName,
        shippingCost: ci.claimsaleItem.claimsale.shippingCost,
        shippingMethods: [],
        items: [],
      });
      sellerMethodMaps.set(sellerId, []);
    }

    // Collect shipping methods from this claimsale (Fase 33: alleen rijen met service+zone).
    const claimsaleMethods = new Map<string, CartShippingMethod>();
    for (const csm of ci.claimsaleItem.claimsale.shippingMethods) {
      const sm = csm.shippingMethod;
      if (!sm.service || !sm.zone || !sm.isActive) continue;
      claimsaleMethods.set(csm.shippingMethodId, {
        id: csm.shippingMethodId,
        carrier: sm.carrier,
        service: sm.service,
        zone: sm.zone,
        price: csm.price, // snapshot price uit join-tabel
      });
    }
    if (claimsaleMethods.size > 0) {
      sellerMethodMaps.get(sellerId)!.push(claimsaleMethods);
    }

    const group = groupMap.get(sellerId)!;

    let imageUrls: string[] = [];
    try {
      imageUrls = JSON.parse(ci.claimsaleItem.imageUrls);
    } catch {
      // ignore parse errors
    }

    const claimedAt = ci.claimsaleItem.claimedAt?.toISOString() ?? null;
    // Visible deadline = max(claim-cutoff, checkout-lock). Bij actieve lock
    // (during checkout) staan items in feite gemarkeerd-vastgezet, dus de
    // timer mag de werkelijke server-side deadline weerspiegelen.
    let expiresAt: string | null = null;
    if (ci.claimsaleItem.claimedAt) {
      const claimCutoff = new Date(
        ci.claimsaleItem.claimedAt.getTime() + CLAIM_DURATION_MS,
      );
      const lockExpiry = ci.claimsaleItem.checkoutLockExpiresAt;
      const effective =
        lockExpiry && lockExpiry > claimCutoff ? lockExpiry : claimCutoff;
      expiresAt = effective.toISOString();
    }

    group.items.push({
      cartItemId: ci.id,
      claimsaleItemId: ci.claimsaleItem.id,
      cardName: ci.claimsaleItem.cardName,
      condition: ci.claimsaleItem.condition,
      price: ci.claimsaleItem.price,
      imageUrls,
      cardSetName: ci.claimsaleItem.cardSet?.name ?? null,
      status: ci.claimsaleItem.status,
      claimedAt,
      expiresAt,
      snapshotPrice: ci.snapshotPrice,
      snapshotCardName: ci.snapshotCardName,
      priceChanged: ci.snapshotPrice != null && ci.snapshotPrice !== ci.claimsaleItem.price,
      nameChanged: ci.snapshotCardName != null && ci.snapshotCardName !== ci.claimsaleItem.cardName,
    });
  }

  // Calculate intersection of shipping methods per seller (available on ALL claimsales)
  for (const [sellerId, methodMaps] of sellerMethodMaps) {
    const group = groupMap.get(sellerId)!;
    if (methodMaps.length === 0) continue;

    // Start with first claimsale's methods, intersect with rest
    const firstMap = methodMaps[0];
    const intersected: CartShippingMethod[] = [];
    for (const [methodId, method] of firstMap) {
      const availableInAll = methodMaps.every((m) => m.has(methodId));
      if (availableInAll) {
        // Use the max price across claimsales (conservative)
        let maxPrice = method.price;
        for (const m of methodMaps) {
          const p = m.get(methodId)!.price;
          if (p > maxPrice) maxPrice = p;
        }
        intersected.push({ ...method, price: maxPrice });
      }
    }
    group.shippingMethods = intersected;
  }

  return Array.from(groupMap.values());
}

// shippingSelections: Record<sellerId, shippingMethodId> — chosen method per seller
// mergeIntoBundles:    Record<sellerId, existingBundleId> — voeg items toe aan
//                      een bestaande claimsale-bundle ipv een nieuwe maken
//                      (bespaart verzendkosten). Server hercheckt of de bundle
//                      nog combinable is.
export async function checkout(
  shippingSelections?: Record<string, string>,
  mergeIntoBundles?: Record<string, string>
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const susp = await requireNotSuspended(session.user.id);
  if ("error" in susp) return { error: susp.error };

  // Check buyer has address
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "Gebruiker niet gevonden" };
  if (!user.street || !user.city || !user.country) {
    return { error: "NO_ADDRESS" };
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: {
      claimsaleItem: {
        include: {
          claimsale: {
            include: {
              shippingMethods: {
                include: { shippingMethod: true },
              },
            },
          },
        },
      },
    },
  });

  if (cartItems.length === 0) return { error: "Winkelwagen is leeg" };

  // Lock de items die deze user gaat afrekenen 5 minuten lang tegen de
  // expire-claims sweep — anders kan de cron midden in de checkout-flow
  // items naar AVAILABLE flippen waardoor de gebruiker een "items niet
  // beschikbaar"-error krijgt voor items die hij net had geselecteerd.
  //
  // STRICT ONE-SHOT per claim-cycle: lock kan alleen worden gezet als
  // `checkoutLockExpiresAt` nog null is. Zodra de lock een keer is gezet
  // (zelfs als 'ie verlopen is) kan deze user 'm niet opnieuw zetten —
  // pas wanneer het item een nieuwe claim-cycle ingaat (status flip naar
  // AVAILABLE → opnieuw geclaimd) wordt de lock-state gereset naar null.
  //
  // Dit dicht de oneindige-renew-exploit waarbij een user elke 5 min op
  // afrekenen kan klikken om items voor altijd vast te houden.
  //
  // SAFETY-FLOOR op claimedAt: items waar de basis 15-min claim-cycle al
  // is verstreken, krijgen geen lock — ze zijn al de facto verlopen en
  // de cron mag ze in de volgende tick opruimen.
  const lockNow = new Date();
  const checkoutLockExpiresAt = new Date(lockNow.getTime() + 5 * 60 * 1000);
  const claimCutoffFloor = new Date(lockNow.getTime() - 15 * 60 * 1000);
  await prisma.claimsaleItem.updateMany({
    where: {
      claimedById: session.user.id,
      status: "CLAIMED",
      checkoutLockExpiresAt: null, // one-shot
      claimedAt: { gte: claimCutoffFloor },
    },
    data: { checkoutLockExpiresAt },
  });

  // Expire stale claims before checkout — onze net-gelockte items worden
  // hier overgeslagen door de checkoutLockExpiresAt-OR clause.
  await expireClaimedItems();

  // Re-fetch to get updated statuses after expiration
  const freshCartItems = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: {
      claimsaleItem: {
        include: {
          claimsale: {
            include: {
              shippingMethods: {
                include: { shippingMethod: true },
              },
            },
          },
        },
      },
    },
  });

  if (freshCartItems.length === 0) return { error: "Alle claims zijn verlopen" };

  const userId = session.user.id;

  // Split: CLAIMED by this user + LIVE claimsale = valid for checkout
  const availableItems = freshCartItems.filter(
    (ci) =>
      ci.claimsaleItem.status === "CLAIMED" &&
      ci.claimsaleItem.claimedById === userId &&
      ci.claimsaleItem.claimsale.status === "LIVE"
  );
  const conflictedItems = freshCartItems.filter(
    (ci) =>
      ci.claimsaleItem.status !== "CLAIMED" ||
      ci.claimsaleItem.claimedById !== userId ||
      ci.claimsaleItem.claimsale.status !== "LIVE"
  );

  if (availableItems.length === 0) {
    await prisma.cartItem.deleteMany({
      where: { userId: session.user.id },
    });
    return {
      error: "Alle items zijn niet meer beschikbaar",
      conflictedItems: conflictedItems.map((ci) => ({
        id: ci.claimsaleItemId,
        cardName: ci.claimsaleItem.cardName,
      })),
    };
  }

  // Group available items by seller
  const sellerGroups = new Map<string, typeof availableItems>();
  for (const ci of availableItems) {
    const sellerId = ci.claimsaleItem.claimsale.sellerId;
    if (!sellerGroups.has(sellerId)) {
      sellerGroups.set(sellerId, []);
    }
    sellerGroups.get(sellerId)!.push(ci);
  }

  // Verifieer merge-keuzes upfront: bundle moet bestaan, van deze koper-
  // verkoper zijn, PAID + unlocked, en puur een claimsale-bundle (geen
  // listing/auction/proposal). Falen vóór side-effects.
  const mergeVerified = new Map<string, string>(); // sellerId → bundleId
  if (mergeIntoBundles) {
    for (const [sellerId, bundleId] of Object.entries(mergeIntoBundles)) {
      if (!sellerGroups.has(sellerId)) continue;
      const b = await prisma.shippingBundle.findUnique({
        where: { id: bundleId },
        select: {
          id: true, sellerId: true, buyerId: true, status: true,
          lockedForPackingAt: true, paymentMode: true, deliveryMethod: true,
          listingId: true, auctionId: true, bundleProposalId: true,
        },
      });
      if (!b || b.sellerId !== sellerId || b.buyerId !== session.user.id) {
        return { error: "Ongeldige bestelling-merge gekozen — vernieuw de pagina." };
      }
      const stillCombinable =
        b.status === "PAID" &&
        b.lockedForPackingAt === null &&
        b.paymentMode === "PLATFORM" &&
        b.deliveryMethod === "SHIP" &&
        b.listingId === null &&
        b.auctionId === null &&
        b.bundleProposalId === null;
      if (!stillCombinable) {
        return {
          error: "De vorige bestelling kan niet meer worden uitgebreid (verkoper is begonnen met inpakken). Vernieuw de winkelwagen.",
        };
      }
      mergeVerified.set(sellerId, bundleId);
    }
  }

  // Calculate total cost needed
  let totalNeeded = 0;
  const sellerShippingInfo = new Map<string, { cost: number; methodId: string | null }>();

  for (const [sellerId, items] of sellerGroups) {
    const itemTotal = items.reduce((sum, ci) => sum + ci.claimsaleItem.price, 0);

    let shippingCost = 0;
    let methodId: string | null = null;

    if (mergeVerified.has(sellerId)) {
      // Merge in bestaande bundle: verzendkosten zijn al betaald in die order.
      // Methode + signed-eis zijn op de oorspronkelijke order al gevalideerd.
      // Geen extra check hier nodig.
    } else {
      // Determine shipping cost: new method system or legacy fallback
      const selectedMethodId = shippingSelections?.[sellerId];
      if (selectedMethodId) {
        // Find the method's snapshotted price from any of this seller's claimsales
        const firstItem = items[0];
        const csm = firstItem.claimsaleItem.claimsale.shippingMethods.find(
          (m) => m.shippingMethodId === selectedMethodId
        );
        shippingCost = csm ? csm.price : 0;
        methodId = selectedMethodId;
      } else {
        // Legacy fallback: use claimsale's flat shippingCost
        shippingCost = items[0].claimsaleItem.claimsale.shippingCost;
      }

      // Signed shipping enforcement (Fase 33: alleen op orderwaarde, niet op zone).
      // Fase 33 v2: MAILBOX_PARCEL niet toegestaan ≥€150 (anti-fraude).
      if (methodId) {
        const method = await prisma.sellerShippingMethod.findUnique({
          where: { id: methodId },
          select: { service: true },
        });

        if (itemTotal >= 150 && method?.service === "MAILBOX_PARCEL") {
          return { error: "Brievenbuspakket niet toegestaan voor bestellingen boven €150" };
        }
        if (requiresSignedShipping(itemTotal) && method?.service !== "PARCEL_SIGNED") {
          return { error: "Aangetekende verzending is verplicht voor bestellingen boven €150" };
        }
      }
    }

    sellerShippingInfo.set(sellerId, { cost: shippingCost, methodId });
    totalNeeded += itemTotal + shippingCost;
  }

  const availableBalance = user.balance - user.reservedBalance;
  if (availableBalance < totalNeeded) {
    return { error: `Onvoldoende beschikbaar saldo. Nodig: €${totalNeeded.toFixed(2)}, beschikbaar: €${availableBalance.toFixed(2)}` };
  }

  // Process each seller group
  let claimedCount = 0;
  const newConflicts: { id: string; cardName: string }[] = [];

  for (const [sellerId, items] of sellerGroups) {
    const { cost: shippingCost, methodId: shippingMethodId } = sellerShippingInfo.get(sellerId)!;
    const mergeBundleId = mergeVerified.get(sellerId);
    const appendedThisSeller: { name: string; price: number }[] = [];

    let bundle;
    if (mergeBundleId) {
      // Race-safe claim van de bestaande bundle: filter op nog steeds
      // unlocked + PAID. Increment van 0 is een no-op write die wel de
      // WHERE-filter triggert + updatedAt bumpt. Faalt 'ie, dan is de
      // bundle in de tussentijd gelockt/verzonden.
      const claim = await prisma.shippingBundle.updateMany({
        where: {
          id: mergeBundleId,
          sellerId,
          buyerId: session.user.id,
          status: "PAID",
          lockedForPackingAt: null,
        },
        data: { totalItemCost: { increment: 0 } },
      });
      if (claim.count === 0) {
        return {
          error: "De vorige bestelling kan niet meer worden uitgebreid (verkoper is begonnen met inpakken). Vernieuw de winkelwagen.",
        };
      }
      bundle = await prisma.shippingBundle.findUniqueOrThrow({ where: { id: mergeBundleId } });
    } else {
      // Nieuwe bundle per checkout (PAID — betaling is direct via wallet).
      bundle = await prisma.shippingBundle.create({
        data: {
          orderNumber: generateOrderNumber(),
          buyerId: session.user.id,
          sellerId,
          shippingCost,
          totalItemCost: 0,
          totalCost: shippingCost,
          status: "PAID",
          shippingMethodId: shippingMethodId,
          buyerStreet: user.street,
          buyerHouseNumber: user.houseNumber,
          buyerPostalCode: user.postalCode,
          buyerCity: user.city,
          buyerCountry: user.country,
        },
      });
    }

    for (const ci of items) {
      // Atomically move from CLAIMED to SOLD (race condition protection)
      const updated = await prisma.claimsaleItem.updateMany({
        where: {
          id: ci.claimsaleItemId,
          status: "CLAIMED",
          claimedById: session.user.id,
        },
        data: {
          status: "SOLD",
          buyerId: session.user.id,
          shippingBundleId: bundle.id,
          claimedAt: null,
          claimedById: null,
        },
      });

      if (updated.count === 0) {
        newConflicts.push({
          id: ci.claimsaleItemId,
          cardName: ci.claimsaleItem.cardName,
        });
        continue;
      }

      // Real-time broadcast: item is nu definitief verkocht (Fase 30B)
      publish(claimsaleChannel(ci.claimsaleItem.claimsaleId), {
        type: "claimsale-item-claimed",
        payload: { claimsaleId: ci.claimsaleItem.claimsaleId, itemId: ci.claimsaleItemId, status: "SOLD" },
      });

      // Deduct from buyer
      const isFirstItemInBundle = items.indexOf(ci) === 0 && shippingCost > 0;
      const deductAmount = isFirstItemInBundle
        ? ci.claimsaleItem.price + shippingCost
        : ci.claimsaleItem.price;

      await deductBalance(
        session.user.id,
        deductAmount,
        "PURCHASE",
        isFirstItemInBundle
          ? `Gekocht: ${ci.claimsaleItem.cardName} + verzendkosten`
          : `Gekocht: ${ci.claimsaleItem.cardName}`,
        undefined,
        ci.claimsaleItemId
      );

      // Hold payment in escrow (released when buyer confirms delivery).
      // Voor de eerste item in een bundle voegen we de shippingCost ook toe,
      // zodat heldBalance de volledige bundle.totalCost dekt — dat zorgt dat
      // refunds en cancels het verzendbedrag uit escrow kunnen halen ipv het
      // uit het niets te creëren. Commissie wordt bij `releaseEscrow` alleen
      // over de items berekend (commissionableAmount = totalItemCost).
      const escrowAmount = isFirstItemInBundle
        ? ci.claimsaleItem.price + shippingCost
        : ci.claimsaleItem.price;
      await escrowCredit(
        sellerId,
        escrowAmount,
        isFirstItemInBundle
          ? `Escrow: ${ci.claimsaleItem.cardName} + verzending`
          : `Escrow: ${ci.claimsaleItem.cardName}`,
        bundle.id
      );

      // Update bundle totals
      await prisma.shippingBundle.update({
        where: { id: bundle.id },
        data: {
          totalItemCost: { increment: ci.claimsaleItem.price },
          totalCost: { increment: ci.claimsaleItem.price },
        },
      });

      appendedThisSeller.push({ name: ci.claimsaleItem.cardName, price: ci.claimsaleItem.price });
      claimedCount++;
    }

    // Bij merge: schrijf een append-event naar de tijdlijn en stuur een
    // "uitgebreid"-notificatie ipv "nieuwe bestelling". Zo ziet de verkoper
    // direct dat z'n lopende order is uitgebreid en wat erbij is gekomen.
    if (mergeBundleId && appendedThisSeller.length > 0) {
      const existing = bundle.appendHistory ? JSON.parse(bundle.appendHistory) as unknown[] : [];
      existing.push({
        at: new Date().toISOString(),
        itemNames: appendedThisSeller.map((i) => i.name),
        itemCount: appendedThisSeller.length,
        itemTotal: appendedThisSeller.reduce((sum, i) => sum + i.price, 0),
      });
      await prisma.shippingBundle.update({
        where: { id: bundle.id },
        data: { appendHistory: JSON.stringify(existing) },
      });

      await createNotification(
        sellerId,
        "ORDER_PAID",
        "Bestelling uitgebreid",
        `${appendedThisSeller.length} extra ${appendedThisSeller.length === 1 ? "item" : "items"} toegevoegd aan bestelling ${bundle.orderNumber}.`,
        "/dashboard/verkopen"
      );
    } else if (appendedThisSeller.length > 0) {
      await createNotification(
        sellerId,
        "ORDER_PAID",
        "Nieuwe bestelling ontvangen!",
        "Er is een nieuwe bestelling binnengekomen. Bekijk deze in je verkopen.",
        "/dashboard/verkopen"
      );
    }

    // D5: auto-close affected claimsales if every item is now SOLD/DELETED.
    const affectedClaimsaleIds = new Set(items.map((ci) => ci.claimsaleItem.claimsaleId));
    for (const cid of affectedClaimsaleIds) {
      await closeClaimsaleIfDepleted(cid);
    }
  }

  // Clean up cart items — for this user AND other users who had now-sold items
  const claimedItemIds = availableItems
    .filter((ci) => !newConflicts.some((c) => c.id === ci.claimsaleItemId))
    .map((ci) => ci.claimsaleItemId);

  // Pak vóór de delete welke andere users hun cart-content kwijt raken,
  // zodat we per affected-user een cart-changed event kunnen publishen.
  const affectedOtherUsers = await prisma.cartItem.findMany({
    where: {
      userId: { not: session.user.id },
      claimsaleItemId: { in: claimedItemIds },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  await prisma.cartItem.deleteMany({
    where: {
      OR: [
        { userId: session.user.id },
        { claimsaleItemId: { in: claimedItemIds } },
      ],
    },
  });

  // Real-time cart-changed events (Fase 30C)
  await publishCartCount(session.user.id);
  for (const u of affectedOtherUsers) await publishCartCount(u.userId);

  const allConflicts = [
    ...conflictedItems.map((ci) => ({
      id: ci.claimsaleItemId,
      cardName: ci.claimsaleItem.cardName,
    })),
    ...newConflicts,
  ];

  return {
    success: true,
    claimedCount,
    conflictedItems: allConflicts,
  };
}
