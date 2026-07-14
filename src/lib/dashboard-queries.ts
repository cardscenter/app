import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type ActionItemsCounts = {
  unreadConversations: number;
  unreadNotifications: number;
  openDisputes: number;
  awaitingPaymentAuctions: number;
  /** Openstaande runner-up-aanboden (72u-window) — accepteren of afslaan. */
  runnerUpOffers: number;
  bundlesToShip: number;
  pendingCancellations: number;
  pendingPickups: number;
};

export async function fetchActionItems(userId: string): Promise<ActionItemsCounts> {
  const [
    myParticipations,
    unreadNotifications,
    openDisputes,
    awaitingPaymentAuctions,
    runnerUpOffers,
    bundlesToShip,
    pendingCancellations,
    pendingPickups,
  ] = await Promise.all([
    prisma.conversationParticipant.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        lastReadAt: true,
        conversation: {
          select: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true, senderId: true },
            },
          },
        },
      },
    }),
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.dispute.count({
      where: {
        status: { in: ["OPEN", "SELLER_RESPONDED", "ESCALATED"] },
        OR: [
          { openedById: userId },
          { shippingBundle: { sellerId: userId } },
        ],
      },
    }),
    prisma.auction.count({
      where: { winnerId: userId, paymentStatus: "AWAITING_PAYMENT" },
    }),
    // Runner-up-aanboden binnen het 72u-beslisvenster: de winnaar betaalde
    // niet en deze user mag de veiling overnemen — tijdgevoelig, dus
    // prominent in de action-items widget (zelfde filter als
    // getActiveRunnerUpOffersForUser; de cron zet verlopen offers op EXPIRED).
    prisma.auctionRunnerUpOffer.count({
      where: { bidderId: userId, status: "AWAITING_DECISION" },
    }),
    prisma.shippingBundle.count({
      where: { sellerId: userId, status: "PAID" },
    }),
    prisma.cancellationRequest.count({
      where: {
        status: "PENDING",
        proposedById: { not: userId },
        shippingBundle: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      },
    }),
    // Pickup-bundles waar nog actie nodig is voor zowel buyer als seller:
    // SCHEDULED (bevestig of wacht op bevestiging) of PENDING+EXTERNAL
    // (afspraak nog vast te leggen). Telt voor allebei zodat beide partijen
    // het zien in hun action-items widget.
    prisma.shippingBundle.count({
      where: {
        deliveryMethod: "PICKUP",
        OR: [{ buyerId: userId }, { sellerId: userId }],
        AND: [
          { status: { notIn: ["COMPLETED", "CANCELLED"] } },
          {
            OR: [
              { status: "SCHEDULED" },
              { AND: [{ status: "PENDING" }, { paymentMode: "EXTERNAL" }] },
              { AND: [{ status: "PAID" }, { paymentMode: "PLATFORM" }, { pickupSchedule: null }] },
            ],
          },
        ],
      },
    }),
  ]);

  const unreadConversations = myParticipations.filter((p) => {
    const last = p.conversation.messages[0];
    if (!last || last.senderId === userId) return false;
    return !p.lastReadAt || last.createdAt > p.lastReadAt;
  }).length;

  return {
    unreadConversations,
    unreadNotifications,
    openDisputes,
    awaitingPaymentAuctions,
    runnerUpOffers,
    bundlesToShip,
    pendingCancellations,
    pendingPickups,
  };
}

export type RecentTransaction = {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: Date;
};

export type BalanceOverview = {
  available: number;
  reserved: number;
  escrow: number;
  recentTransactions: RecentTransaction[];
};

export async function fetchBalanceOverview(userId: string): Promise<BalanceOverview> {
  const [user, transactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, reservedBalance: true, heldBalance: true },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, amount: true, description: true, createdAt: true },
    }),
  ]);

  if (!user) {
    return { available: 0, reserved: 0, escrow: 0, recentTransactions: [] };
  }

  return {
    available: Math.max(0, user.balance - user.reservedBalance),
    reserved: user.reservedBalance,
    escrow: user.heldBalance,
    recentTransactions: transactions,
  };
}

export type ActiveActivity = {
  counts: { auctions: number; listings: number; claimsales: number; events: number };
  bids: { highest: number; outbid: number; totalActive: number };
};

// React cache(): dashboard-layout (nav-badges) én OfferTabs (Fase 44) roepen
// dit per request aan — dedupe voorkomt dubbele queries.
export const fetchActiveActivity = cache(async function fetchActiveActivity(
  userId: string
): Promise<ActiveActivity> {
  const [auctions, listings, claimsales, events, myAuctions] = await Promise.all([
    // Auctions + claimsales tellen ook SCHEDULED mee — die zijn "in de pijplijn"
    // en horen in de nav-badge naast de echt-lopende items. Listings hebben geen
    // SCHEDULED-state.
    prisma.auction.count({ where: { sellerId: userId, status: { in: ["ACTIVE", "SCHEDULED"] } } }),
    prisma.listing.count({ where: { sellerId: userId, status: "ACTIVE" } }),
    prisma.claimsale.count({ where: { sellerId: userId, status: { in: ["LIVE", "SCHEDULED"] } } }),
    // Events: alles behalve DELETED — het nav-item is verborgen zolang de user
    // nog nooit een event heeft aangemaakt.
    prisma.event.count({ where: { organizerId: userId, status: { not: "DELETED" } } }),
    prisma.auction.findMany({
      where: { status: "ACTIVE", bids: { some: { bidderId: userId } } },
      select: {
        id: true,
        bids: {
          orderBy: { amount: "desc" },
          take: 1,
          select: { bidderId: true },
        },
      },
    }),
  ]);

  let highest = 0;
  let outbid = 0;
  for (const a of myAuctions) {
    if (a.bids[0]?.bidderId === userId) highest++;
    else outbid++;
  }

  return {
    counts: { auctions, listings, claimsales, events },
    bids: { highest, outbid, totalActive: myAuctions.length },
  };
});

export type BundleRow = {
  id: string;
  orderNumber: string;
  totalCost: number;
  status: string;
  createdAt: Date;
  counterpartyName: string;
  itemTitle: string | null;
};

export type RecentBundles = {
  sales: BundleRow[];
  purchases: BundleRow[];
};

export async function fetchRecentBundles(userId: string): Promise<RecentBundles> {
  const [sales, purchases] = await Promise.all([
    prisma.shippingBundle.findMany({
      where: { sellerId: userId, status: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        totalCost: true,
        status: true,
        createdAt: true,
        buyer: { select: { displayName: true } },
        auction: { select: { title: true } },
        listing: { select: { title: true } },
        items: { select: { cardName: true }, take: 1 },
      },
    }),
    prisma.shippingBundle.findMany({
      where: { buyerId: userId, status: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        totalCost: true,
        status: true,
        createdAt: true,
        seller: { select: { displayName: true } },
        auction: { select: { title: true } },
        listing: { select: { title: true } },
        items: { select: { cardName: true }, take: 1 },
      },
    }),
  ]);

  return {
    sales: sales.map((b) => ({
      id: b.id,
      orderNumber: b.orderNumber,
      totalCost: b.totalCost,
      status: b.status,
      createdAt: b.createdAt,
      counterpartyName: b.buyer.displayName,
      itemTitle: b.auction?.title ?? b.listing?.title ?? b.items[0]?.cardName ?? null,
    })),
    purchases: purchases.map((b) => ({
      id: b.id,
      orderNumber: b.orderNumber,
      totalCost: b.totalCost,
      status: b.status,
      createdAt: b.createdAt,
      counterpartyName: b.seller.displayName,
      itemTitle: b.auction?.title ?? b.listing?.title ?? b.items[0]?.cardName ?? null,
    })),
  };
}
