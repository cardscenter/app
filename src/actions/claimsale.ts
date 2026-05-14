"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkClaimsaleLimit } from "@/lib/account-limits";
import { deductBalance } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { resolveLocalCardSetId } from "@/lib/card-helpers";
import { requireNotSuspended } from "@/lib/suspension";
import { enrichMethod, deriveListingShippingMethodIds } from "@/lib/shipping/static-methods";
import { mailboxEligibleType } from "@/lib/listing-types";
import { publish, claimsaleChannel, userChannel } from "@/lib/realtime";
import { deriveClaimsaleStartTime, isClaimsaleScheduled } from "@/lib/claimsale/timing";
import {
  applyFreeUpsellsToCost,
  CLAIMSALE_UPSELL_TYPES_OFFERED,
  type ClaimsaleUpsellType,
} from "@/lib/upsell-config";
import {
  availableClaimsaleLabelsFor,
  calculateClaimsaleLabelCost,
  isValidClaimsaleLabelType,
  isValidLabelColor,
  MAX_LABELS_PER_CLAIMSALE,
  type ClaimsaleLabelType,
  type LabelColor,
} from "@/lib/claimsale/labels";

async function publishCartCount(userId: string) {
  const count = await prisma.cartItem.count({ where: { userId } });
  publish(userChannel(userId), { type: "cart-changed", payload: { count } });
}
import { redirect } from "next/navigation";
import { z } from "zod";

// CARDS-type: volledige card-flow met card-selector + kaart-condities + variant.
const claimsaleCardItemSchema = z.object({
  cardName: z.string(),
  cardNumber: z.string().optional(),
  sellerNote: z.string().max(30).optional(),
  cardSetId: z.string().optional(),
  tcgdexId: z.string().optional(),
  condition: z.string().min(1),
  price: z.coerce.number().min(0.01),
  imageUrls: z.array(z.string()).optional().default([]),
});

// ITEMS-type: vrije velden, geen card-selector. Afbeelding verplicht (geen
// catalogus-fallback mogelijk zonder gekoppelde kaart).
const claimsaleProductItemSchema = z.object({
  cardName: z.string().min(1, "Itemnaam is verplicht"),
  itemDescription: z.string().optional(),
  sellerNote: z.string().max(30).optional(),
  condition: z.string().min(1),
  price: z.coerce.number().min(0.01),
  imageUrls: z.array(z.string()).min(1, "Upload minimaal één afbeelding per item"),
});

const DAY_MS = 24 * 60 * 60 * 1000;

export async function createClaimsale(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };
  const userId = session.user.id;

  const susp = await requireNotSuspended(userId);
  if ("error" in susp) return { error: susp.error };

  const limit = await checkClaimsaleLimit(userId);
  if (!limit.allowed) {
    return { error: `Je hebt het maximum aantal actieve claimsales bereikt (${limit.max})` };
  }

  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || null;
  const coverImage = (formData.get("coverImage") as string) || null;
  const type = formData.get("type") === "ITEMS" ? "ITEMS" : "CARDS";
  const allowMailbox = formData.get("allowMailbox") === "true";
  const startDateRaw = formData.get("startDate") as string | null;
  const itemsJson = formData.get("items") as string;
  const upsellsRaw = formData.get("upsells");
  const labelsRaw = formData.get("labels");

  if (!title || title.length < 3) return { error: "Titel is te kort" };

  // ── Items parsen + valideren (vorm afhankelijk van type) ──────────────
  type CardItem = z.infer<typeof claimsaleCardItemSchema>;
  type ProductItem = z.infer<typeof claimsaleProductItemSchema>;
  let cardItems: CardItem[] = [];
  let productItems: ProductItem[] = [];
  try {
    const parsed = JSON.parse(itemsJson);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error();
    if (type === "CARDS") {
      cardItems = parsed.map((i) => claimsaleCardItemSchema.parse(i));
    } else {
      productItems = parsed.map((i) => claimsaleProductItemSchema.parse(i));
    }
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: type === "CARDS" ? "Voeg minimaal één kaart toe" : "Voeg minimaal één item toe" };
  }

  const itemCount = type === "CARDS" ? cardItems.length : productItems.length;
  if (itemCount > limit.maxItems) {
    return { error: `Maximum ${limit.maxItems} items per claimsale` };
  }

  // Afbeelding-fallback-guard voor CARDS: een item zonder eigen upload moet
  // minstens een gekoppelde kaart (tcgdexId) hebben zodat we de catalogus-
  // afbeelding kunnen tonen. ITEMS dwingt upload al af via zod (.min(1)).
  if (type === "CARDS") {
    for (const item of cardItems) {
      if ((item.imageUrls?.length ?? 0) === 0 && !item.tcgdexId) {
        return { error: "Upload een afbeelding of kies een kaart bij elk item" };
      }
    }
  }

  // ── Verzending (server-side derivation, mirror createAuction) ─────────
  const seller = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true, accountType: true, balance: true, reservedBalance: true, freeUpsellsRemaining: true },
  });
  if (!seller?.country) {
    return { error: "Vul eerst je land in op je profiel." };
  }

  // Hoogste prijspunt voor mailbox-eligibility (<€150). CARDS-claimsales
  // gedragen zich als multi-card listings; ITEMS sluiten mailbox uit.
  const allPrices = type === "CARDS" ? cardItems.map((i) => i.price) : productItems.map((i) => i.price);
  const maxItemPrice = allPrices.length > 0 ? Math.max(...allPrices) : null;
  const shippingListingType = type === "CARDS" ? "MULTI_CARD" : "OTHER";

  const derivedIds = await deriveListingShippingMethodIds({
    prisma,
    sellerId: userId,
    allowMailbox,
    listingType: shippingListingType,
    price: maxItemPrice,
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
  const methodSnapshots = methods
    .map((m) => {
      const enriched = enrichMethod(m, seller.country!);
      return enriched ? { id: m.id, price: enriched.effectivePrice } : null;
    })
    .filter((s): s is { id: string; price: number } => s !== null);
  if (methodSnapshots.length === 0) {
    return { error: "Geen geldige verzendmethodes beschikbaar." };
  }
  // shippingCost-kolom = goedkoopste afgeleide methode (claimsale-card leest dit).
  const shippingCost = Math.min(...methodSnapshots.map((m) => m.price));

  // ── Timing: direct LIVE of gepland (SCHEDULED) ───────────────────────
  const startDate = startDateRaw ? new Date(startDateRaw) : new Date();
  if (Number.isNaN(startDate.getTime())) return { error: "Ongeldige startdatum" };
  const startTime = deriveClaimsaleStartTime(startDate);
  const scheduled = isClaimsaleScheduled(startTime);
  const initialStatus = scheduled ? "SCHEDULED" : "LIVE";

  // ── Upsells (3 types, vast dagtarief × dagen) ────────────────────────
  const accountType = seller.accountType ?? "FREE";
  let upsellEntries: { type: ClaimsaleUpsellType; days: number }[] = [];
  let perEntryCosts: number[] = [];
  let totalUpsellCost = 0;
  let freeUsed = 0;
  if (typeof upsellsRaw === "string" && upsellsRaw.length > 0) {
    try {
      const parsed = JSON.parse(upsellsRaw) as Array<{ type: string; days?: number }>;
      upsellEntries = parsed
        .filter((e) => CLAIMSALE_UPSELL_TYPES_OFFERED.includes(e.type as ClaimsaleUpsellType))
        .map((e) => ({
          type: e.type as ClaimsaleUpsellType,
          days: Math.max(1, Math.min(30, Math.floor(e.days ?? 1))),
        }));
      const allocation = applyFreeUpsellsToCost(
        upsellEntries,
        accountType,
        seller.freeUpsellsRemaining ?? 0,
        "claimsale"
      );
      perEntryCosts = allocation.perEntry;
      totalUpsellCost = allocation.total;
      freeUsed = allocation.freeUsed;
    } catch {
      upsellEntries = [];
    }
  }

  // ── Labels (max 2, anti-tamper availability-hercheck) ────────────────
  let parsedLabels: { type: ClaimsaleLabelType; colorKey: LabelColor }[] = [];
  let labelsCost = 0;
  if (typeof labelsRaw === "string" && labelsRaw.length > 0) {
    try {
      const raw = JSON.parse(labelsRaw) as Array<{ type: string; colorKey: string }>;
      const cleaned = raw
        .filter(
          (l) =>
            typeof l?.type === "string" &&
            typeof l?.colorKey === "string" &&
            isValidClaimsaleLabelType(l.type) &&
            isValidLabelColor(l.colorKey)
        )
        .slice(0, MAX_LABELS_PER_CLAIMSALE) as { type: ClaimsaleLabelType; colorKey: LabelColor }[];

      const hasMintItem =
        type === "CARDS" &&
        cardItems.some((i) => i.condition === "Near Mint" || i.condition === "Mint");
      const availability = availableClaimsaleLabelsFor({ claimsaleType: type, hasMintItem });
      const availSet = new Set(availability.filter((a) => a.available).map((a) => a.type));
      for (const l of cleaned) {
        if (!availSet.has(l.type)) {
          return { error: `Label "${l.type}" is niet beschikbaar voor deze claimsale` };
        }
      }
      const seen = new Set<ClaimsaleLabelType>();
      parsedLabels = cleaned.filter((l) => {
        if (seen.has(l.type)) return false;
        seen.add(l.type);
        return true;
      });
      labelsCost = calculateClaimsaleLabelCost(parsedLabels.length);
    } catch {
      parsedLabels = [];
    }
  }

  // Balance-check op upsells + labels samen.
  const totalPromotionCost = totalUpsellCost + labelsCost;
  if (totalPromotionCost > 0) {
    const availableBalance = (seller.balance ?? 0) - (seller.reservedBalance ?? 0);
    if (totalPromotionCost > availableBalance) {
      return { error: "Onvoldoende saldo voor promotie-opties" };
    }
  }

  // Upsell startsAt: LIVE → nu, SCHEDULED → claimsale-startTime.
  const upsellStartsAt = scheduled ? startTime : new Date();

  // ── Atomic create: claimsale + items + shipping + upsells + labels ───
  const claimsale = await prisma.$transaction(async (tx) => {
    const cs = await tx.claimsale.create({
      data: {
        title,
        description,
        coverImage,
        type,
        shippingCost,
        sellerId: userId,
        status: initialStatus,
        startTime,
        publishedAt: startTime,
        items: {
          create:
            type === "CARDS"
              ? await Promise.all(
                  cardItems.map(async (item) => {
                    const autoCardSetId =
                      item.tcgdexId && !item.cardSetId
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
                  })
                )
              : productItems.map((item) => ({
                  cardName: item.cardName,
                  ...(item.itemDescription ? { itemDescription: item.itemDescription } : {}),
                  ...(item.sellerNote ? { sellerNote: item.sellerNote } : {}),
                  condition: item.condition,
                  price: item.price,
                  imageUrls: JSON.stringify(item.imageUrls),
                })),
        },
      },
    });

    for (const m of methodSnapshots) {
      await tx.claimsaleShippingMethod.create({
        data: { claimsaleId: cs.id, shippingMethodId: m.id, price: m.price },
      });
    }

    for (let i = 0; i < upsellEntries.length; i++) {
      const entry = upsellEntries[i];
      const cost = perEntryCosts[i] ?? 0;
      await tx.claimsaleUpsell.create({
        data: {
          claimsaleId: cs.id,
          type: entry.type,
          startsAt: upsellStartsAt,
          expiresAt: new Date(upsellStartsAt.getTime() + entry.days * DAY_MS),
          dailyCost: entry.days > 0 ? cost / entry.days : 0,
          totalCost: cost,
        },
      });
    }

    if (parsedLabels.length > 0) {
      const perLabelCost = labelsCost / parsedLabels.length;
      await tx.claimsaleLabel.createMany({
        data: parsedLabels.map((l) => ({
          claimsaleId: cs.id,
          type: l.type,
          colorKey: l.colorKey,
          cost: Math.round(perLabelCost * 100) / 100,
        })),
      });
    }

    return cs;
  });

  // Balance-deduct voor upsells + labels samen (na de create, mirror createAuction).
  if (totalPromotionCost > 0) {
    await deductBalance(
      userId,
      totalPromotionCost,
      "UPSELL",
      `Promotie-opties claimsale: ${title}`,
      claimsale.id
    );
  }

  // Race-safe free-upsell quota-decrement.
  if (freeUsed > 0) {
    const updated = await prisma.user.updateMany({
      where: { id: userId, freeUpsellsRemaining: { gte: freeUsed } },
      data: { freeUpsellsRemaining: { decrement: freeUsed } },
    });
    if (updated.count === 0) {
      console.warn(
        `[createClaimsale] Free-upsell quota race for user ${userId}: claimed ${freeUsed} but quota was depleted.`
      );
    }
  }

  // Ember voor het aanmaken van een claimsale.
  const { logActivity } = await import("@/actions/activity");
  logActivity(userId, "CREATE_LISTING", { claimsaleId: claimsale.id });

  // SCHEDULED: bump de activator-scheduler zodat 'ie op startTime flipt.
  if (initialStatus === "SCHEDULED") {
    import("@/lib/claimsale-activator-scheduler")
      .then(({ scheduleNextClaimsaleActivation }) =>
        scheduleNextClaimsaleActivation("create-claimsale")
      )
      .catch((err) => console.error("[createClaimsale] activator bump failed", err));
  }

  return { success: true, claimsaleId: claimsale.id };
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

  // Skip items met een actieve checkout-lock — die staan momenteel in
  // betalings-flow en mogen niet midden-flight worden opgeruimd. Lock
  // verloopt na 5 min zodat vastgelopen checkouts niet permanent blokkeren.
  const where = {
    status: "CLAIMED",
    claimedAt: { lt: cutoff },
    OR: [
      { checkoutLockExpiresAt: null },
      { checkoutLockExpiresAt: { lt: now } },
    ],
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

  // Pak vóór de delete welke users hun cart-content kwijt raken zodat we
  // per user een cart-changed event kunnen publishen na de transaction.
  const affectedUsers = await prisma.cartItem.findMany({
    where: { claimsaleItemId: { in: expiredIds } },
    select: { userId: true },
    distinct: ["userId"],
  });

  // Reset items to AVAILABLE and delete associated cart items in transaction.
  // checkoutLockExpiresAt op null zetten zodat een volgende claimer een
  // nieuwe one-shot lock kan zetten bij hun checkout.
  await prisma.$transaction([
    prisma.claimsaleItem.updateMany({
      where: { id: { in: expiredIds } },
      data: {
        status: "AVAILABLE",
        claimedAt: null,
        claimedById: null,
        checkoutLockExpiresAt: null,
      },
    }),
    prisma.cartItem.deleteMany({
      where: { claimsaleItemId: { in: expiredIds } },
    }),
  ]);

  // Cart-count event per user die items kwijt is (Fase 30C)
  for (const u of affectedUsers) await publishCartCount(u.userId);

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

  // Real-time broadcast per vrijgegeven item zodat viewers van die claimsale
  // direct zien dat het weer beschikbaar is (Fase 30B).
  for (const item of expiredItems) {
    publish(claimsaleChannel(item.claimsaleId), {
      type: "claimsale-item-claimed",
      payload: { claimsaleId: item.claimsaleId, itemId: item.id, status: "AVAILABLE" },
    });
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

  const susp = await requireNotSuspended(userId);
  if ("error" in susp) return { error: susp.error };

  const item = await prisma.claimsaleItem.findUnique({
    where: { id: claimsaleItemId },
    include: { claimsale: true },
  });

  if (!item) return { error: "Kaart niet gevonden" };
  if (item.status !== "AVAILABLE") return { error: "Kaart is niet meer beschikbaar" };
  if (item.claimsale.status !== "LIVE") return { error: "Claimsale is niet actief" };
  if (item.claimsale.sellerId === userId) return { error: "Je kunt niet je eigen kaarten claimen" };

  // Check if already in user's cart
  const existingCartItem = await prisma.cartItem.findUnique({
    where: { userId_claimsaleItemId: { userId, claimsaleItemId } },
  });
  if (existingCartItem) return { error: "Dit item zit al in je winkelwagen" };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CLAIM_DURATION_MS);

  try {
    await prisma.$transaction(async (tx) => {
      // Atomically claim the item (race condition protection). Reset
      // checkoutLockExpiresAt: defensief, voor het geval een eerdere
      // claim-cycle de lock niet had opgeruimd. Nieuwe claimer krijgt
      // bij z'n checkout een verse one-shot lock.
      const updated = await tx.claimsaleItem.updateMany({
        where: { id: claimsaleItemId, status: "AVAILABLE" },
        data: {
          status: "CLAIMED",
          claimedAt: now,
          claimedById: userId,
          checkoutLockExpiresAt: null,
        },
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

  // Real-time broadcast naar iedereen die op de claimsale-page kijkt (Fase 30B)
  publish(claimsaleChannel(item.claimsaleId), {
    type: "claimsale-item-claimed",
    payload: { claimsaleId: item.claimsaleId, itemId: claimsaleItemId, status: "CLAIMED" },
  });
  // Cart count update naar de claimer (Fase 30C)
  await publishCartCount(userId);

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
    // Atomically claim all items. Reset checkoutLockExpiresAt defensief
    // (zie claimItem voor uitleg).
    const updated = await tx.claimsaleItem.updateMany({
      where: { id: { in: itemIds }, status: "AVAILABLE" },
      data: {
        status: "CLAIMED",
        claimedAt: now,
        claimedById: userId,
        checkoutLockExpiresAt: null,
      },
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
      data: {
        status: "AVAILABLE",
        claimedAt: null,
        claimedById: null,
        checkoutLockExpiresAt: null,
      },
    }),
    prisma.cartItem.deleteMany({
      where: { userId, claimsaleItemId },
    }),
  ]);

  // Real-time: item terug op de markt + cart-count update voor de user (Fase 30C)
  publish(claimsaleChannel(item.claimsaleId), {
    type: "claimsale-item-claimed",
    payload: { claimsaleId: item.claimsaleId, itemId: claimsaleItemId, status: "AVAILABLE" },
  });
  await publishCartCount(userId);

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
