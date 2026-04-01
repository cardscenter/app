"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { checkAmountAllowed } from "@/lib/account-age";

export async function addToCart(claimsaleItemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const item = await prisma.claimsaleItem.findUnique({
    where: { id: claimsaleItemId },
    include: { claimsale: true },
  });

  if (!item) return { error: "Kaart niet gevonden" };
  if (item.status !== "AVAILABLE") return { error: "Kaart is niet meer beschikbaar" };
  if (item.claimsale.status !== "LIVE") return { error: "Claimsale is niet actief" };
  if (item.claimsale.sellerId === session.user.id) return { error: "Je kunt niet je eigen kaarten toevoegen" };

  // Check if already in cart
  const existing = await prisma.cartItem.findUnique({
    where: {
      userId_claimsaleItemId: {
        userId: session.user.id,
        claimsaleItemId,
      },
    },
  });

  if (existing) return { error: "Dit item zit al in je winkelwagen" };

  await prisma.cartItem.create({
    data: {
      userId: session.user.id,
      claimsaleItemId,
    },
  });

  return { success: true, cardName: item.cardName };
}

export async function removeFromCart(cartItemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const cartItem = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
  });

  if (!cartItem) return { error: "Item niet gevonden" };
  if (cartItem.userId !== session.user.id) return { error: "Niet geautoriseerd" };

  await prisma.cartItem.delete({ where: { id: cartItemId } });

  return { success: true };
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
  serviceName: string;
  price: number;
  countries: string[];
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
  }[];
};

export async function getCart(): Promise<CartSellerGroup[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

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

    // Collect shipping methods from this claimsale
    const claimsaleMethods = new Map<string, CartShippingMethod>();
    for (const csm of ci.claimsaleItem.claimsale.shippingMethods) {
      let countries: string[] = [];
      try {
        countries = JSON.parse(csm.shippingMethod.countries);
      } catch { /* ignore */ }
      claimsaleMethods.set(csm.shippingMethodId, {
        id: csm.shippingMethodId,
        carrier: csm.shippingMethod.carrier,
        serviceName: csm.shippingMethod.serviceName,
        price: csm.price, // snapshot price
        countries,
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

    group.items.push({
      cartItemId: ci.id,
      claimsaleItemId: ci.claimsaleItem.id,
      cardName: ci.claimsaleItem.cardName,
      condition: ci.claimsaleItem.condition,
      price: ci.claimsaleItem.price,
      imageUrls,
      cardSetName: ci.claimsaleItem.cardSet?.name ?? null,
      status: ci.claimsaleItem.status,
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
export async function checkout(shippingSelections?: Record<string, string>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

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

  // Split into available and conflicted items
  const availableItems = cartItems.filter(
    (ci) => ci.claimsaleItem.status === "AVAILABLE" && ci.claimsaleItem.claimsale.status === "LIVE"
  );
  const conflictedItems = cartItems.filter(
    (ci) => ci.claimsaleItem.status !== "AVAILABLE" || ci.claimsaleItem.claimsale.status !== "LIVE"
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

  // Calculate total cost needed
  let totalNeeded = 0;
  const sellerShippingInfo = new Map<string, { cost: number; methodId: string | null }>();

  for (const [sellerId, items] of sellerGroups) {
    const itemTotal = items.reduce((sum, ci) => sum + ci.claimsaleItem.price, 0);

    // Check if there's already a paid bundle for this buyer-seller pair
    const existingBundle = await prisma.shippingBundle.findFirst({
      where: {
        buyerId: session.user.id,
        sellerId,
        status: "PAID",
      },
    });

    let shippingCost = 0;
    let methodId: string | null = null;

    if (!existingBundle) {
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
    }

    sellerShippingInfo.set(sellerId, { cost: shippingCost, methodId });
    totalNeeded += itemTotal + shippingCost;
  }

  // Account age restriction check
  const ageCheck = checkAmountAllowed(user, totalNeeded);
  if (!ageCheck.allowed) return { error: ageCheck.error! };

  const availableBalance = user.balance - user.reservedBalance;
  if (availableBalance < totalNeeded) {
    return { error: `Onvoldoende beschikbaar saldo. Nodig: €${totalNeeded.toFixed(2)}, beschikbaar: €${availableBalance.toFixed(2)}` };
  }

  // Process each seller group
  let claimedCount = 0;
  const newConflicts: { id: string; cardName: string }[] = [];

  for (const [sellerId, items] of sellerGroups) {
    const { cost: shippingCost, methodId: shippingMethodId } = sellerShippingInfo.get(sellerId)!;

    // Find or create shipping bundle (PAID because payment is instant via wallet)
    let bundle = await prisma.shippingBundle.findFirst({
      where: {
        buyerId: session.user.id,
        sellerId,
        status: "PAID",
      },
    });

    if (!bundle) {
      bundle = await prisma.shippingBundle.create({
        data: {
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
      // Atomically try to claim the item (race condition protection)
      const updated = await prisma.claimsaleItem.updateMany({
        where: {
          id: ci.claimsaleItemId,
          status: "AVAILABLE",
        },
        data: {
          status: "SOLD",
          buyerId: session.user.id,
          shippingBundleId: bundle.id,
        },
      });

      if (updated.count === 0) {
        newConflicts.push({
          id: ci.claimsaleItemId,
          cardName: ci.claimsaleItem.cardName,
        });
        continue;
      }

      // Deduct from buyer
      const isFirstItemInBundle = claimedCount === 0 && shippingCost > 0 &&
        items.indexOf(ci) === 0;
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

      // Hold payment in escrow (released when buyer confirms delivery)
      await escrowCredit(
        sellerId,
        ci.claimsaleItem.price,
        `Escrow: ${ci.claimsaleItem.cardName}`,
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

      claimedCount++;
    }
  }

  // Clean up cart items — for this user AND other users who had now-sold items
  const claimedItemIds = availableItems
    .filter((ci) => !newConflicts.some((c) => c.id === ci.claimsaleItemId))
    .map((ci) => ci.claimsaleItemId);

  await prisma.cartItem.deleteMany({
    where: {
      OR: [
        { userId: session.user.id },
        { claimsaleItemId: { in: claimedItemIds } },
      ],
    },
  });

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
