"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkClaimsaleLimit } from "@/lib/account-limits";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { checkAmountAllowed } from "@/lib/account-age";
import { resolveLocalCardSetId } from "@/lib/card-helpers";
import { redirect } from "next/navigation";
import { z } from "zod";

const claimsaleItemSchema = z.object({
  cardName: z.string(),
  cardNumber: z.string().optional(),
  sellerNote: z.string().optional(),
  cardSetId: z.string().optional(),
  tcgdexId: z.string().optional(),
  condition: z.string().min(1),
  price: z.coerce.number().min(0.01),
  imageUrls: z.array(z.string()).optional().default([]),
});

export async function createClaimsale(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || null;
  const coverImage = (formData.get("coverImage") as string) || null;
  const shippingCostRaw = formData.get("shippingCost") as string | null;
  const shippingCost = shippingCostRaw ? parseFloat(shippingCostRaw) : 0;
  const itemsJson = formData.get("items") as string;
  const shippingMethodIdsJson = formData.get("shippingMethodIds") as string | null;

  if (!title || title.length < 3) return { error: "Titel is te kort" };
  if (isNaN(shippingCost) || shippingCost < 0) return { error: "Ongeldige verzendkosten" };

  // Require at least one shipping method
  if (!shippingMethodIdsJson || JSON.parse(shippingMethodIdsJson).length === 0) {
    return { error: "Selecteer minimaal één verzendmethode" };
  }

  let items: z.infer<typeof claimsaleItemSchema>[];
  try {
    items = JSON.parse(itemsJson);
    if (!Array.isArray(items) || items.length === 0) throw new Error();
    items.forEach((item) => claimsaleItemSchema.parse(item));
  } catch {
    return { error: "Voeg minimaal één kaart toe" };
  }

  // Check limits
  const limit = await checkClaimsaleLimit(session.user.id);
  if (items.length > limit.maxItems) {
    return { error: `Maximum ${limit.maxItems} kaarten per claimsale` };
  }

  // Parse shipping method IDs
  let shippingMethodIds: string[] = [];
  if (shippingMethodIdsJson) {
    try {
      shippingMethodIds = JSON.parse(shippingMethodIdsJson);
    } catch { /* ignore */ }
  }

  // Validate: must have at least one non-LETTER method
  if (shippingMethodIds.length > 0) {
    const selectedMethods = await prisma.sellerShippingMethod.findMany({
      where: { id: { in: shippingMethodIds } },
      select: { shippingType: true },
    });
    const hasNonLetter = selectedMethods.some((m) => m.shippingType !== "LETTER");
    if (!hasNonLetter) {
      return { error: "Je moet naast briefpost minimaal één pakket- of brievenbuspakket-optie aanbieden." };
    }
  }

  // Lookup shipping methods for price snapshots
  let methodSnapshots: { id: string; price: number }[] = [];
  if (shippingMethodIds.length > 0) {
    const methods = await prisma.sellerShippingMethod.findMany({
      where: { id: { in: shippingMethodIds }, sellerId: userId },
    });
    methodSnapshots = methods.map((m) => ({ id: m.id, price: m.price }));
  }

  const claimsale = await prisma.$transaction(async (tx) => {
    const cs = await tx.claimsale.create({
      data: {
        title,
        description,
        coverImage,
        shippingCost,
        sellerId: userId,
        status: "DRAFT",
        items: {
          create: await Promise.all(items.map(async (item) => {
            const autoCardSetId = item.tcgdexId && !item.cardSetId
              ? await resolveLocalCardSetId(item.tcgdexId)
              : null;
            return {
              cardName: item.cardName || "Kaart",
              ...(item.cardSetId
                ? { cardSetId: item.cardSetId }
                : autoCardSetId
                  ? { cardSetId: autoCardSetId }
                  : {}),
              ...(item.cardNumber ? { reference: item.cardNumber } : {}),
              ...(item.sellerNote ? { sellerNote: item.sellerNote } : {}),
              ...(item.tcgdexId ? { tcgdexId: item.tcgdexId } : {}),
              condition: item.condition,
              price: item.price,
              imageUrls: JSON.stringify(item.imageUrls ?? []),
            };
          })),
        },
      },
    });

    // Create shipping method links
    for (const m of methodSnapshots) {
      await tx.claimsaleShippingMethod.create({
        data: {
          claimsaleId: cs.id,
          shippingMethodId: m.id,
          price: m.price,
        },
      });
    }

    return cs;
  });

  redirect(`/nl/claimsales/${claimsale.id}`);
}

export async function publishClaimsale(claimsaleId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const claimsale = await prisma.claimsale.findUnique({
    where: { id: claimsaleId },
    include: { _count: { select: { items: true } } },
  });

  if (!claimsale) return { error: "Claimsale niet gevonden" };
  if (claimsale.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (claimsale.status !== "DRAFT") return { error: "Kan alleen een concept publiceren" };

  // Check limits
  const limit = await checkClaimsaleLimit(session.user.id);
  if (!limit.allowed) {
    return { error: `Je hebt het maximum aantal actieve claimsales bereikt (${limit.max})` };
  }

  await prisma.claimsale.update({
    where: { id: claimsaleId },
    data: { status: "LIVE", publishedAt: new Date() },
  });

  // Award Ember for publishing a claimsale
  const { logActivity } = await import("@/actions/activity");
  logActivity(session.user.id, "CREATE_LISTING", { claimsaleId });

  return { success: true };
}

export async function deleteClaimsale(claimsaleId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const claimsale = await prisma.claimsale.findUnique({ where: { id: claimsaleId } });
  if (!claimsale) return { error: "Niet gevonden" };
  if (claimsale.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };

  // Check if any items are sold or currently claimed
  const blockingCount = await prisma.claimsaleItem.count({
    where: { claimsaleId, status: { in: ["SOLD", "CLAIMED"] } },
  });
  if (blockingCount > 0) {
    return {
      error:
        "Kan niet verwijderen: er zijn kaarten verkocht of momenteel geclaimd. Wacht tot lopende claims verlopen.",
    };
  }

  await prisma.claimsale.delete({ where: { id: claimsaleId } });
  redirect("/nl/dashboard/claimsales");
}

/**
 * Manually close a LIVE claimsale (owner only). Marks any remaining AVAILABLE
 * items as DELETED and sets the claimsale status to CLOSED. CLAIMED items
 * (= items in someone's cart) block closing — the seller must wait for those
 * to either expire or check out.
 */
export async function closeClaimsale(claimsaleId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const claimsale = await prisma.claimsale.findUnique({
    where: { id: claimsaleId },
    select: { sellerId: true, status: true, title: true },
  });
  if (!claimsale) return { error: "Niet gevonden" };
  if (claimsale.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (claimsale.status !== "LIVE") return { error: "Claimsale is niet actief" };

  // Atomic close: re-check CLAIMED inside the transaction so we don't race a
  // late claimItem call. If a buyer manages to claim between our outer check
  // and the transaction, the inner check catches them and we abort. We also
  // CAS the claimsale status with updateMany ({where: status: "LIVE"}) so two
  // concurrent close attempts can't both succeed.
  let raced = false;
  let hasClaimed = false;
  try {
    await prisma.$transaction(async (tx) => {
      const claimedCount = await tx.claimsaleItem.count({
        where: { claimsaleId, status: "CLAIMED" },
      });
      if (claimedCount > 0) {
        hasClaimed = true;
        throw new Error("HAS_CLAIMED");
      }

      const flipped = await tx.claimsale.updateMany({
        where: { id: claimsaleId, status: "LIVE" },
        data: { status: "CLOSED" },
      });
      if (flipped.count === 0) {
        raced = true;
        throw new Error("NOT_LIVE");
      }

      await tx.claimsaleItem.updateMany({
        where: { claimsaleId, status: "AVAILABLE" },
        data: { status: "DELETED" },
      });
    });
  } catch (err) {
    if (hasClaimed) {
      return {
        error:
          "Kan niet sluiten: er zijn nog items gereserveerd of in een winkelwagen. Wacht tot lopende claims verlopen of checkout afronden.",
      };
    }
    if (raced) {
      return { error: "Claimsale-status is al gewijzigd, vernieuw de pagina." };
    }
    throw err;
  }

  // Belt-and-braces: drop any cartItems for items in this claimsale that may
  // have slipped through during the race. These reference DELETED items now
  // and can't be checked out anyway (cart filters by claimsale.status=LIVE).
  await prisma.cartItem.deleteMany({
    where: { claimsaleItem: { claimsaleId } },
  });

  await createNotification(
    session.user.id,
    "ITEM_SOLD",
    "Claimsale gesloten",
    `Je hebt claimsale "${claimsale.title}" gesloten. Resterende items zijn verwijderd.`,
    `/nl/claimsales/${claimsaleId}`
  );

  return { success: true };
}

const CLAIM_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Expire all claimed items that have passed the 15-minute window.
 * Called lazily from status API + cron as backup.
 * Optional claimsaleId to scope expiration to a single claimsale.
 */
export async function expireClaimedItems(claimsaleId?: string) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - CLAIM_DURATION_MS);

  const where = {
    status: "CLAIMED",
    claimedAt: { lt: cutoff },
    ...(claimsaleId ? { claimsaleId } : {}),
  };

  // Find expired items to clean up cart items + notify sellers
  const expiredItems = await prisma.claimsaleItem.findMany({
    where,
    select: {
      id: true,
      claimsaleId: true,
      claimsale: { select: { sellerId: true, title: true } },
    },
  });

  if (expiredItems.length === 0) return { expired: 0 };

  const expiredIds = expiredItems.map((i) => i.id);

  // Reset items to AVAILABLE and delete associated cart items in transaction
  await prisma.$transaction([
    prisma.claimsaleItem.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: "AVAILABLE", claimedAt: null, claimedById: null },
    }),
    prisma.cartItem.deleteMany({
      where: { claimsaleItemId: { in: expiredIds } },
    }),
  ]);

  // One notification per (seller, claimsale) — batched so a sweep across
  // many items in the same claimsale doesn't flood the seller.
  const grouped = new Map<string, { sellerId: string; title: string; claimsaleId: string; count: number }>();
  for (const item of expiredItems) {
    const key = item.claimsaleId;
    const existing = grouped.get(key);
    if (existing) {
      existing.count++;
    } else {
      grouped.set(key, {
        sellerId: item.claimsale.sellerId,
        title: item.claimsale.title,
        claimsaleId: item.claimsaleId,
        count: 1,
      });
    }
  }

  for (const { sellerId, title, claimsaleId: csid, count } of grouped.values()) {
    const body =
      count === 1
        ? `Een gereserveerd item op "${title}" is vrijgegeven omdat de koper niet heeft afgerekend.`
        : `${count} gereserveerde items op "${title}" zijn vrijgegeven omdat de kopers niet hebben afgerekend.`;
    await createNotification(sellerId, "ITEM_SOLD", "Reservering verlopen", body, `/nl/claimsales/${csid}`);
  }

  return { expired: expiredIds.length };
}

/**
 * Claim a single item (15-minute reservation).
 * No balance deduction — that happens at checkout.
 */
export async function claimItem(claimsaleItemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const item = await prisma.claimsaleItem.findUnique({
    where: { id: claimsaleItemId },
    include: { claimsale: true },
  });

  if (!item) return { error: "Kaart niet gevonden" };
  if (item.status !== "AVAILABLE") return { error: "Kaart is niet meer beschikbaar" };
  if (item.claimsale.status !== "LIVE") return { error: "Claimsale is niet actief" };
  if (item.claimsale.sellerId === userId) return { error: "Je kunt niet je eigen kaarten claimen" };

  // Account-age cap: claiming reserves a financial commitment, so apply the
  // same cap as direct purchases.
  const buyer = await prisma.user.findUnique({ where: { id: userId } });
  if (!buyer) return { error: "Gebruiker niet gevonden" };
  const ageCheck = checkAmountAllowed(buyer, item.price);
  if (!ageCheck.allowed) return { error: ageCheck.error! };

  // Check if already in user's cart
  const existingCartItem = await prisma.cartItem.findUnique({
    where: { userId_claimsaleItemId: { userId, claimsaleItemId } },
  });
  if (existingCartItem) return { error: "Dit item zit al in je winkelwagen" };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CLAIM_DURATION_MS);

  try {
    await prisma.$transaction(async (tx) => {
      // Atomically claim the item (race condition protection)
      const updated = await tx.claimsaleItem.updateMany({
        where: { id: claimsaleItemId, status: "AVAILABLE" },
        data: { status: "CLAIMED", claimedAt: now, claimedById: userId },
      });

      if (updated.count === 0) {
        throw new Error("ALREADY_CLAIMED");
      }

      // Note: each claim keeps its own per-item timer. We intentionally do NOT
      // refresh other claimed items' timers — that would let a user keep an
      // unlimited cart open indefinitely by claiming a new item every 14m.

      // Create cart item with snapshot
      await tx.cartItem.create({
        data: {
          userId,
          claimsaleItemId,
          snapshotPrice: item.price,
          snapshotCardName: item.cardName,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_CLAIMED") {
      return { error: "Dit item is zojuist door iemand anders geclaimd" };
    }
    throw e;
  }

  return { success: true, expiresAt: expiresAt.toISOString(), cardName: item.cardName };
}

/**
 * Claim all available items in a claimsale at once.
 */
export async function claimAllItems(claimsaleId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const claimsale = await prisma.claimsale.findUnique({
    where: { id: claimsaleId },
  });

  if (!claimsale) return { error: "Claimsale niet gevonden" };
  if (claimsale.status !== "LIVE") return { error: "Claimsale is niet actief" };
  if (claimsale.sellerId === userId) return { error: "Je kunt niet je eigen kaarten claimen" };

  // Find all available items not already in user's cart
  const availableItems = await prisma.claimsaleItem.findMany({
    where: {
      claimsaleId,
      status: "AVAILABLE",
    },
    select: { id: true, price: true, cardName: true },
  });

  if (availableItems.length === 0) return { error: "Geen beschikbare items" };

  // Filter out items already in cart
  const existingCartItems = await prisma.cartItem.findMany({
    where: { userId, claimsaleItemId: { in: availableItems.map((i) => i.id) } },
    select: { claimsaleItemId: true },
  });
  const existingSet = new Set(existingCartItems.map((ci) => ci.claimsaleItemId));
  const itemsToClaim = availableItems.filter((i) => !existingSet.has(i.id));

  if (itemsToClaim.length === 0) return { error: "Alle items zitten al in je winkelwagen" };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CLAIM_DURATION_MS);
  const itemIds = itemsToClaim.map((i) => i.id);

  await prisma.$transaction(async (tx) => {
    // Atomically claim all items
    const updated = await tx.claimsaleItem.updateMany({
      where: { id: { in: itemIds }, status: "AVAILABLE" },
      data: { status: "CLAIMED", claimedAt: now, claimedById: userId },
    });

    // Reset ALL existing claim timers for this user (items not in this batch)
    await tx.claimsaleItem.updateMany({
      where: {
        claimedById: userId,
        status: "CLAIMED",
        id: { notIn: itemIds },
      },
      data: { claimedAt: now },
    });

    // Create cart items with snapshots
    for (const item of itemsToClaim) {
      await tx.cartItem.create({
        data: {
          userId,
          claimsaleItemId: item.id,
          snapshotPrice: item.price,
          snapshotCardName: item.cardName,
        },
      });
    }

    return updated.count;
  });

  return {
    success: true,
    claimedCount: itemsToClaim.length,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Unclaim an item (remove from cart, make available again).
 */
export async function unclaimItem(claimsaleItemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const item = await prisma.claimsaleItem.findUnique({
    where: { id: claimsaleItemId },
  });

  if (!item) return { error: "Item niet gevonden" };
  if (item.status !== "CLAIMED" || item.claimedById !== userId) {
    return { error: "Dit item is niet door jou geclaimd" };
  }

  await prisma.$transaction([
    prisma.claimsaleItem.update({
      where: { id: claimsaleItemId },
      data: { status: "AVAILABLE", claimedAt: null, claimedById: null },
    }),
    prisma.cartItem.deleteMany({
      where: { userId, claimsaleItemId },
    }),
  ]);

  return { success: true };
}

// ============================================================
// OWNER EDITING (LIVE claimsales)
// ============================================================

/**
 * Update an item on a LIVE claimsale (owner only).
 */
export async function updateClaimsaleItem(
  itemId: string,
  data: { cardName?: string; condition?: string; price?: number; imageUrls?: string[] }
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const item = await prisma.claimsaleItem.findUnique({
    where: { id: itemId },
    include: { claimsale: true },
  });

  if (!item) return { error: "Item niet gevonden" };
  if (item.claimsale.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (item.status === "SOLD") return { error: "Kan een verkocht item niet bewerken" };
  if (item.status === "CLAIMED") return { error: "Kan een geclaimd item niet bewerken \u2014 wacht tot de claim verloopt of de koper afrekent" };
  if (item.claimsale.status !== "LIVE") return { error: "Claimsale is niet actief" };

  const updateData: Record<string, unknown> = {};
  if (data.cardName !== undefined) updateData.cardName = data.cardName;
  if (data.condition !== undefined) updateData.condition = data.condition;
  if (data.price !== undefined && data.price > 0) updateData.price = data.price;
  if (data.imageUrls !== undefined) updateData.imageUrls = JSON.stringify(data.imageUrls);

  if (Object.keys(updateData).length === 0) return { error: "Niets om bij te werken" };

  // Atomic guard: only update if still AVAILABLE (defends against a race where
  // a buyer claims the item between our read above and this write).
  const result = await prisma.claimsaleItem.updateMany({
    where: { id: itemId, status: "AVAILABLE" },
    data: updateData,
  });
  if (result.count === 0) {
    return { error: "Item is niet meer beschikbaar voor bewerken" };
  }

  return { success: true };
}

/**
 * Soft-delete an item from a LIVE claimsale (owner only).
 * If item is CLAIMED: unclaim first, then mark DELETED.
 */
export async function deleteClaimsaleItem(itemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const item = await prisma.claimsaleItem.findUnique({
    where: { id: itemId },
    include: { claimsale: true },
  });

  if (!item) return { error: "Item niet gevonden" };
  if (item.claimsale.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (item.status === "SOLD") return { error: "Kan een verkocht item niet verwijderen" };
  if (item.status === "CLAIMED") return { error: "Kan een geclaimd item niet verwijderen \u2014 wacht tot de claim verloopt of de koper afrekent" };
  if (item.claimsale.status !== "LIVE") return { error: "Claimsale is niet actief" };

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { claimsaleItemId: itemId } }),
    prisma.claimsaleItem.update({
      where: { id: itemId },
      data: { status: "DELETED", claimedAt: null, claimedById: null },
    }),
  ]);

  await closeClaimsaleIfDepleted(item.claimsaleId);

  return { success: true };
}

/**
 * Auto-close a claimsale once every item is SOLD or DELETED. Called after any
 * status mutation on a ClaimsaleItem. Idempotent — safe to call repeatedly.
 * Returns true if the claimsale was just closed, false otherwise.
 */
export async function closeClaimsaleIfDepleted(claimsaleId: string): Promise<boolean> {
  const claimsale = await prisma.claimsale.findUnique({
    where: { id: claimsaleId },
    select: { status: true, sellerId: true, title: true },
  });
  if (!claimsale || claimsale.status !== "LIVE") return false;

  const remaining = await prisma.claimsaleItem.count({
    where: {
      claimsaleId,
      status: { notIn: ["SOLD", "DELETED"] },
    },
  });

  if (remaining > 0) return false;

  await prisma.claimsale.update({
    where: { id: claimsaleId },
    data: { status: "CLOSED" },
  });

  await createNotification(
    claimsale.sellerId,
    "ITEM_SOLD",
    "Claimsale gesloten",
    `Alle items op je claimsale "${claimsale.title}" zijn verkocht of verwijderd. De claimsale is automatisch gesloten.`,
    `/nl/claimsales/${claimsaleId}`
  );

  return true;
}

/**
 * Add a new item to a LIVE claimsale (owner only).
 */
export async function addClaimsaleItem(
  claimsaleId: string,
  data: { cardName: string; condition: string; price: number; imageUrls?: string[]; cardSetId?: string; reference?: string }
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const claimsale = await prisma.claimsale.findUnique({
    where: { id: claimsaleId },
    include: { _count: { select: { items: true } } },
  });

  if (!claimsale) return { error: "Claimsale niet gevonden" };
  if (claimsale.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };
  if (claimsale.status !== "LIVE") return { error: "Claimsale is niet actief" };

  const limit = await checkClaimsaleLimit(session.user.id);
  if (claimsale._count.items >= limit.maxItems) {
    return { error: `Maximum ${limit.maxItems} items per claimsale bereikt` };
  }

  if (data.price <= 0) return { error: "Prijs moet groter zijn dan 0" };

  const item = await prisma.claimsaleItem.create({
    data: {
      claimsaleId,
      cardName: data.cardName || "Kaart",
      condition: data.condition,
      price: data.price,
      imageUrls: JSON.stringify(data.imageUrls ?? []),
      ...(data.cardSetId ? { cardSetId: data.cardSetId } : {}),
      ...(data.reference ? { reference: data.reference } : {}),
    },
  });

  return { success: true, itemId: item.id };
}
