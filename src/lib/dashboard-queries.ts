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
    prisma.disputeV2.count({
      where: {
        status: { in: ["OPEN", "SELLER_RESPONDED", "MEDIATION", "ESCALATED"] },
        OR: [{ buyerId: userId }, { sellerId: userId }],
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

// ── Dashboard-home (fintech-stijl, sept 2026) ────────────────────────────────

import { getPeriodRange, bucketKey, calculatePeriodComparison } from "@/lib/statistics-helpers";

export type CashFlowPoint = { key: string; label: string; sales: number; purchases: number };
export type CashFlowTotals = { sales: number; purchases: number; net: number; salesCount: number; purchaseCount: number };
export type CashFlow = {
  period: string;
  range: { start: Date; end: Date };
  /** Per dag, alle dagen in de periode (ook zonder mutaties) zodat de as doorloopt. */
  days: CashFlowPoint[];
  /** Per week (maandag-start), afgeleid van `days`. */
  weeks: CashFlowPoint[];
  current: CashFlowTotals;
  previous: CashFlowTotals;
  comparison: {
    sales: ReturnType<typeof calculatePeriodComparison>;
    purchases: ReturnType<typeof calculatePeriodComparison>;
    net: ReturnType<typeof calculatePeriodComparison>;
  };
};

/**
 * Aankopen vs verkopen uit de wallet (Transaction) per dag/week, plus totalen
 * voor de huidige én vorige periode van gelijke lengte.
 * - verkopen  = `SALE` met amount > 0 (escrow-vrijgave naar de verkoper, netto na commissie)
 * - aankopen  = `PURCHASE` / `AUCTION_PREMIUM` met amount < 0 (betaling vanuit saldo)
 * Refunds (positieve PURCHASE) en balance-neutrale rijen (ESCROW_HOLD,
 * PLATFORM_FEE_SETTLEMENT) tellen bewust niet mee — dit is handel, geen saldo.
 */
export async function fetchCashFlow(userId: string, period: string): Promise<CashFlow> {
  const range = getPeriodRange(period);
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      createdAt: { gte: range.previousStart, lt: range.end },
      type: { in: ["SALE", "PURCHASE", "AUCTION_PREMIUM"] },
    },
    select: { type: true, amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const empty = (): CashFlowTotals => ({ sales: 0, purchases: 0, net: 0, salesCount: 0, purchaseCount: 0 });
  const current = empty();
  const previous = empty();
  const dayMap = new Map<string, CashFlowPoint>();

  // Alle dagen van de huidige periode vooraf vullen. Bij open-einde-periodes
  // ("all" = 10 jaar) starten we bij de eerste transactie in de periode, en
  // nooit meer dan ~400 dagen terug — anders krijgt de grafiek duizenden lege
  // staven en vallen recente mutaties buiten de gevulde buckets.
  const MAX_FILL_DAYS = 400;
  const firstCurrentTx = rows.find((r) => r.createdAt >= range.start)?.createdAt ?? null;
  const minFillStart = new Date(range.end.getTime() - MAX_FILL_DAYS * 24 * 60 * 60 * 1000);
  let fillStart = range.start;
  if (fillStart < minFillStart) fillStart = firstCurrentTx && firstCurrentTx > minFillStart ? firstCurrentTx : minFillStart;
  const cursor = new Date(fillStart.getFullYear(), fillStart.getMonth(), fillStart.getDate());
  let guard = 0;
  while (cursor < range.end && guard < MAX_FILL_DAYS + 1) {
    const { key, label } = bucketKey(cursor, "day");
    dayMap.set(key, { key, label, sales: 0, purchases: 0 });
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }

  for (const r of rows) {
    const isSale = r.type === "SALE" && r.amount > 0;
    const isPurchase = (r.type === "PURCHASE" || r.type === "AUCTION_PREMIUM") && r.amount < 0;
    if (!isSale && !isPurchase) continue;
    const inCurrent = r.createdAt >= range.start;
    const bucket = inCurrent ? current : previous;
    if (isSale) {
      bucket.sales += r.amount;
      bucket.salesCount += 1;
    } else {
      bucket.purchases += Math.abs(r.amount);
      bucket.purchaseCount += 1;
    }
    if (inCurrent) {
      const { key } = bucketKey(r.createdAt, "day");
      const p = dayMap.get(key);
      if (p) {
        if (isSale) p.sales += r.amount;
        else p.purchases += Math.abs(r.amount);
      }
    }
  }
  for (const b of [current, previous]) {
    b.sales = Math.round(b.sales * 100) / 100;
    b.purchases = Math.round(b.purchases * 100) / 100;
    b.net = Math.round((b.sales - b.purchases) * 100) / 100;
  }

  const days = Array.from(dayMap.values());
  const weekMap = new Map<string, CashFlowPoint>();
  for (const d of days) {
    const { key, label } = bucketKey(d.key, "week");
    const w = weekMap.get(key) ?? { key, label, sales: 0, purchases: 0 };
    w.sales += d.sales;
    w.purchases += d.purchases;
    weekMap.set(key, w);
  }

  return {
    period,
    range: { start: range.start, end: range.end },
    days,
    weeks: Array.from(weekMap.values()),
    current,
    previous,
    comparison: {
      sales: calculatePeriodComparison(current.sales, previous.sales),
      purchases: calculatePeriodComparison(current.purchases, previous.purchases),
      net: calculatePeriodComparison(current.net, previous.net),
    },
  };
}

export type RecentOrderRow = BundleRow & { role: "sale" | "purchase" };

/** Laatste N orders (verkopen + aankopen samen, nieuwste eerst) voor de activiteitentabel. */
export async function fetchRecentOrders(userId: string, take = 8): Promise<RecentOrderRow[]> {
  const { sales, purchases } = await fetchRecentBundles(userId);
  return [
    ...sales.map((b) => ({ ...b, role: "sale" as const })),
    ...purchases.map((b) => ({ ...b, role: "purchase" as const })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, take);
}
