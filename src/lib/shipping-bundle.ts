import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/order-number";

export interface CombinableBundle {
  id: string;
  orderNumber: string;
  totalCost: number;
  shippingCost: number;
  itemCount: number;
  createdAt: Date;
}

/**
 * Per verkoper de bestaande claimsale-bundle waar de koper bij een volgende
 * claimsale-checkout items aan kan toevoegen. Voorwaarden:
 *   - PAID, geen lockedForPackingAt
 *   - puur claimsale (geen listingId/auctionId/bundleProposalId)
 *   - PLATFORM-escrow + SHIP-delivery (geen pickup/EXTERNAL)
 * Levert max één bundle per verkoper op (de oudste, zodat een lopende
 * bestelling z'n verzendkosten "houdt").
 */
export async function getCombinableClaimsaleBundles(
  buyerId: string
): Promise<Record<string, CombinableBundle>> {
  const bundles = await prisma.shippingBundle.findMany({
    where: {
      buyerId,
      status: "PAID",
      lockedForPackingAt: null,
      listingId: null,
      auctionId: null,
      bundleProposalId: null,
      paymentMode: "PLATFORM",
      deliveryMethod: "SHIP",
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderNumber: true,
      sellerId: true,
      totalCost: true,
      shippingCost: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  const out: Record<string, CombinableBundle> = {};
  for (const b of bundles) {
    if (out[b.sellerId]) continue; // first (oldest) wins
    out[b.sellerId] = {
      id: b.id,
      orderNumber: b.orderNumber,
      totalCost: b.totalCost,
      shippingCost: b.shippingCost,
      itemCount: b._count.items,
      createdAt: b.createdAt,
    };
  }
  return out;
}

interface BuyerAddress {
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}

interface CreatePendingBundleInput {
  buyerId: string;
  sellerId: string;
  totalItemCost: number;
  shippingCost: number;
  auctionId?: string | null;
  listingId?: string | null;
  /** Snapshot van delivery-keuze (SHIP/PICKUP). Default SHIP voor backwards-compat. */
  deliveryMethod?: "SHIP" | "PICKUP";
  address?: BuyerAddress;
}

// Pre-creates a ShippingBundle in PENDING state for purchases that haven't
// been fully paid yet (auction AWAITING_PAYMENT, proposal partial balance).
// At payment completion the caller should `update` this row to PAID instead
// of creating a fresh one — the unique constraints on auctionId/listingId
// would block that anyway.
//
// Address fields are optional: an auction winner may not have a saved
// address yet at the point we set AWAITING_PAYMENT, so we accept nulls and
// fill them in at completion time.
export async function createPendingBundle(input: CreatePendingBundleInput) {
  const totalCost = input.totalItemCost + input.shippingCost;

  return prisma.shippingBundle.create({
    data: {
      orderNumber: generateOrderNumber(),
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      shippingCost: input.shippingCost,
      totalItemCost: input.totalItemCost,
      totalCost,
      status: "PENDING",
      auctionId: input.auctionId ?? null,
      listingId: input.listingId ?? null,
      deliveryMethod: input.deliveryMethod ?? "SHIP",
      buyerStreet: input.address?.street ?? null,
      buyerHouseNumber: input.address?.houseNumber ?? null,
      buyerPostalCode: input.address?.postalCode ?? null,
      buyerCity: input.address?.city ?? null,
      buyerCountry: input.address?.country ?? null,
    },
  });
}
