"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkClaimsaleLimit } from "@/lib/account-limits";
import { deductBalance, escrowCredit } from "@/actions/wallet";
import { createNotification } from "@/actions/notification";
import { redirect } from "next/navigation";
import { z } from "zod";

const claimsaleItemSchema = z.object({
  cardName: z.string().min(1),
  cardSetId: z.string().min(1),
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
  const shippingCost = parseFloat(formData.get("shippingCost") as string);
  const itemsJson = formData.get("items") as string;
  const shippingMethodIdsJson = formData.get("shippingMethodIds") as string | null;

  if (!title || title.length < 3) return { error: "Titel is te kort" };
  if (isNaN(shippingCost) || shippingCost < 0) return { error: "Ongeldige verzendkosten" };

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
          create: items.map((item) => ({
            cardName: item.cardName,
            cardSetId: item.cardSetId,
            condition: item.condition,
            price: item.price,
            imageUrls: JSON.stringify(item.imageUrls ?? []),
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

  return { success: true };
}

export async function deleteClaimsale(claimsaleId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const claimsale = await prisma.claimsale.findUnique({ where: { id: claimsaleId } });
  if (!claimsale) return { error: "Niet gevonden" };
  if (claimsale.sellerId !== session.user.id) return { error: "Niet geautoriseerd" };

  // Check if any items are sold
  const soldCount = await prisma.claimsaleItem.count({
    where: { claimsaleId, status: "SOLD" },
  });
  if (soldCount > 0) return { error: "Kan niet verwijderen: er zijn al kaarten verkocht" };

  await prisma.claimsale.delete({ where: { id: claimsaleId } });
  redirect("/nl/dashboard/claimsales");
}

export async function claimItem(claimsaleItemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Niet ingelogd" };

  const item = await prisma.claimsaleItem.findUnique({
    where: { id: claimsaleItemId },
    include: { claimsale: true },
  });

  if (!item) return { error: "Kaart niet gevonden" };
  if (item.status !== "AVAILABLE") return { error: "Kaart is niet meer beschikbaar" };
  if (item.claimsale.status !== "LIVE") return { error: "Claimsale is niet actief" };
  if (item.claimsale.sellerId === session.user.id) return { error: "Je kunt niet je eigen kaarten kopen" };

  // Check balance
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "Gebruiker niet gevonden" };

  // Find or create shipping bundle for this buyer-seller pair
  let bundle = await prisma.shippingBundle.findFirst({
    where: {
      buyerId: session.user.id,
      sellerId: item.claimsale.sellerId,
      status: "PENDING",
    },
  });

  const totalCost = bundle
    ? item.price // Only item cost, shipping already covered
    : item.price + item.claimsale.shippingCost; // First item: include shipping

  if (user.balance < totalCost) {
    return { error: `Onvoldoende saldo. Nodig: €${totalCost.toFixed(2)}` };
  }

  if (!bundle) {
    bundle = await prisma.shippingBundle.create({
      data: {
        buyerId: session.user.id,
        sellerId: item.claimsale.sellerId,
        shippingCost: item.claimsale.shippingCost,
        totalItemCost: item.price,
        totalCost: item.price + item.claimsale.shippingCost,
        status: "PAID",
        buyerStreet: user.street,
        buyerHouseNumber: user.houseNumber,
        buyerPostalCode: user.postalCode,
        buyerCity: user.city,
        buyerCountry: user.country,
      },
    });

    // Deduct shipping + item cost
    await deductBalance(
      session.user.id,
      totalCost,
      "PURCHASE",
      `Gekocht: ${item.cardName} + verzendkosten`,
      undefined,
      claimsaleItemId
    );
  } else {
    // Update existing bundle
    await prisma.shippingBundle.update({
      where: { id: bundle.id },
      data: {
        totalItemCost: { increment: item.price },
        totalCost: { increment: item.price },
      },
    });

    // Deduct only item cost
    await deductBalance(
      session.user.id,
      item.price,
      "PURCHASE",
      `Gekocht: ${item.cardName}`,
      undefined,
      claimsaleItemId
    );
  }

  // Mark item as sold and link to buyer + bundle
  await prisma.claimsaleItem.update({
    where: { id: claimsaleItemId },
    data: {
      status: "SOLD",
      buyerId: session.user.id,
      shippingBundleId: bundle.id,
    },
  });

  // Hold in escrow for seller
  await escrowCredit(
    item.claimsale.sellerId,
    item.price,
    `Verkocht (escrow): ${item.cardName}`,
    bundle.id
  );

  // Notify seller
  await createNotification(
    item.claimsale.sellerId,
    "ITEM_SOLD",
    "Kaart verkocht!",
    `"${item.cardName}" is verkocht voor €${item.price.toFixed(2)}.`,
    `/nl/claimsales/${item.claimsaleId}`
  );

  return { success: true };
}
