import { prisma } from "@/lib/prisma";
import { BID_RESERVE_RATE } from "@/lib/auction/bid-tiers";
import { getMinimumNextBid } from "@/lib/auction/bid-increments";
import { calculateBidTotalFromBid } from "@/lib/auction/fees";
import { publish, userChannel } from "@/lib/realtime";

/**
 * Calculate the available balance (what the user can actually spend/bid with).
 */
export function getAvailableBalance(user: { balance: number; reservedBalance: number }): number {
  return Math.max(0, user.balance - user.reservedBalance);
}

/**
 * Calculate how much should be reserved for a bid amount (NOT a total!).
 *
 * **WAARSCHUWING — semantiek is misleidend (Fase 31)**: deze functie
 * accepteert het BOD (zonder fee) en berekent intern `total = bid +
 * buyer's premium`, dan returnt `total × 10%`. De naam zegt "reserve voor
 * een bid", de implementatie doet impliciet de premium-expansion. Geef
 * NOOIT een vooraf-berekende total door — dan reken je dubbel.
 *
 * Voorbeelden:
 *   calculateReserveAmount(1000)  // 1000 × 1.03 × 0.10 = 103.00 ✓
 *   calculateReserveAmount(1030)  // 1030 × 1.03 × 0.10 = 106.09 ✗ (DUBBEL FEE)
 *
 * Fase 30A: één rate (10%) over de hele linie — geldt voor zowel ACTIVE bids
 * als AWAITING_PAYMENT-winnaars. Was eerst 40% (te hoog), toen 15% (Fase 29),
 * nu 10%. 10% × (€2000 × 1.03) = €206 borg op een €2000-bod.
 *
 * Fase 31: reserve gaat over `bid + premium` ipv alleen bid — koper moet
 * uiteindelijk total kunnen betalen als hij wint.
 */
export function calculateReserveAmount(bidAmount: number): number {
  const total = calculateBidTotalFromBid(bidAmount);
  return Math.round(total * BID_RESERVE_RATE * 100) / 100;
}

/**
 * Alias met expliciete naam voor toekomstige callers — accepteert bid-amount,
 * returnt reserve over (bid + premium). Identiek aan `calculateReserveAmount`,
 * maar de naam geeft duidelijkheid over wat de input/output is.
 */
export const calculateReserveForBid = calculateReserveAmount;

/**
 * Get the current reserved amount for a specific user on a specific auction.
 * Mirrort de logica van recalculateTotalReserved voor één auction:
 * - ACTIVE + user is hoogste bieder: 10% × max(userBid, autobidMax)
 * - ACTIVE + user is overboden maar heeft active autobid: 10% × autobidMax
 * - AWAITING_PAYMENT + user is winner: 10% × finalPrice
 * - Anders: 0
 */
export async function getReservedForAuction(userId: string, auctionId: string): Promise<number> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: {
      status: true,
      paymentStatus: true,
      winnerId: true,
      finalPrice: true,
      bids: { orderBy: { amount: "desc" }, take: 1, select: { bidderId: true } },
    },
  });
  if (!auction) return 0;

  // AWAITING_PAYMENT-pad
  if (auction.paymentStatus === "AWAITING_PAYMENT" && auction.winnerId === userId) {
    return calculateReserveAmount(auction.finalPrice ?? 0);
  }
  if (auction.status !== "ACTIVE") return 0;

  // User's highest bid + autobid op deze auction
  const highestBid = await prisma.auctionBid.findFirst({
    where: { auctionId, bidderId: userId },
    orderBy: { amount: "desc" },
    select: { amount: true },
  });
  const autoBid = await prisma.autoBid.findUnique({
    where: { userId_auctionId: { userId, auctionId } },
    select: { maxAmount: true, isActive: true },
  });

  const userBidAmount = highestBid?.amount ?? 0;
  const autobidMax = autoBid?.isActive ? autoBid.maxAmount : 0;
  const isHighestBidder = auction.bids[0]?.bidderId === userId;

  if (isHighestBidder) {
    return calculateReserveAmount(Math.max(userBidAmount, autobidMax));
  }
  if (autobidMax > 0) {
    return calculateReserveAmount(autobidMax);
  }
  return 0;
}

/**
 * Recalculate total reserved balance from scratch for a user.
 *
 * Wat reserveert (alle takken: 10% × bedrag, Fase 30A):
 * 1. ACTIVE auctions waar user de **huidige hoogste bieder** is — 10% van
 *    max(user's highest bid, user's autobid max).
 * 2. ACTIVE auctions waar user is overboden maar een **actieve autobid** heeft —
 *    10% van autobid max (kan elk moment getriggerd worden door een nieuwe
 *    bid, dus commitment moet vastgehouden worden).
 * 3. AWAITING_PAYMENT auctions waar user de **winner** is — 10% van finalPrice
 *    (commitment tot completeAuctionPayment of cron-driven PAYMENT_FAILED).
 *
 * Wat NIET reserveert (bug-fix Fase 27.98):
 * - Overboden bids zonder autobid — geld is vrij. Voorheen werden deze
 *   ten onrechte als reserve gerekend, waardoor users geld bevroren zagen
 *   na een outbid (bv. 27 buyer met €103.21 stale reserve).
 * - PAID auctions of CANCELLED/PAYMENT_FAILED — afgehandeld of geen
 *   commitment meer.
 */
export async function recalculateTotalReserved(userId: string): Promise<number> {
  // Eligible auctions: ACTIVE waar user heeft geboden, of AWAITING_PAYMENT
  // waar user de winner is. Pak top-bid mee om "is hoogste bieder?"-check
  // te doen zonder extra round-trip.
  const eligible = await prisma.auction.findMany({
    where: {
      OR: [
        { status: "ACTIVE", bids: { some: { bidderId: userId } } },
        { paymentStatus: "AWAITING_PAYMENT", winnerId: userId },
      ],
    },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      winnerId: true,
      finalPrice: true,
      currentBid: true,
      startingBid: true,
      bids: {
        orderBy: { amount: "desc" },
        take: 1,
        select: { bidderId: true, amount: true },
      },
    },
  });

  if (eligible.length === 0) return 0;

  const auctionIds = eligible.map((a) => a.id);

  // User's eigen highest bid per auction (voor reserve-berekening)
  const userBids = await prisma.auctionBid.findMany({
    where: { bidderId: userId, auctionId: { in: auctionIds } },
    orderBy: { amount: "desc" },
    select: { auctionId: true, amount: true },
  });
  const userHighestBidByAuction = new Map<string, number>();
  for (const b of userBids) {
    if (!userHighestBidByAuction.has(b.auctionId)) {
      userHighestBidByAuction.set(b.auctionId, b.amount);
    }
  }

  // User's actieve autobids op deze auctions
  const activeAutoBids = await prisma.autoBid.findMany({
    where: { userId, isActive: true, auctionId: { in: auctionIds } },
    select: { auctionId: true, maxAmount: true },
  });
  const autoMaxByAuction = new Map<string, number>();
  for (const ab of activeAutoBids) autoMaxByAuction.set(ab.auctionId, ab.maxAmount);

  let totalReserved = 0;
  for (const a of eligible) {
    // AWAITING_PAYMENT-pad: winner reserveert 10% van finalPrice (Fase 30A)
    if (a.paymentStatus === "AWAITING_PAYMENT" && a.winnerId === userId) {
      totalReserved += calculateReserveAmount(a.finalPrice ?? 0);
      continue;
    }

    // ACTIVE-pad: alleen als user huidige hoogste bieder is, OF autobid actief
    const isHighestBidder = a.bids[0]?.bidderId === userId;
    const userBid = userHighestBidByAuction.get(a.id) ?? 0;
    const autoMax = autoMaxByAuction.get(a.id) ?? 0;

    // Een autobid telt alleen als hij nog kan triggeren: maxAmount moet
    // het volgende minimum-bod halen. Als de huidige currentBid al boven
    // de autobid-max staat, is de autobid functioneel dood en mag geen
    // geld meer vasthouden — hij wordt nooit meer ingezet (Fase 30A).
    const currentTopAmount = a.bids[0]?.amount ?? a.currentBid ?? a.startingBid;
    const minNextBid = getMinimumNextBid(currentTopAmount);
    const autoCanTrigger = autoMax >= minNextBid;

    if (isHighestBidder) {
      // Eigen autobid telt alleen als die echt boven huidige bid kan komen.
      const effectiveAutoMax = autoCanTrigger ? autoMax : 0;
      totalReserved += calculateReserveAmount(Math.max(userBid, effectiveAutoMax));
    } else if (autoCanTrigger) {
      // Overboden maar autobid kan triggeren → reserve max-amount
      totalReserved += calculateReserveAmount(autoMax);
    }
    // Anders: niets — overboden zonder bruikbare autobid = geld vrij
  }

  return Math.round(totalReserved * 100) / 100;
}

/**
 * Sync the user's reservedBalance field with the actual calculated value.
 * Use this as a safety check or after complex operations.
 *
 * Publishet altijd een `balance-changed`-event op de user-channel — daardoor
 * hoeven callers dit zelf niet meer te doen en is "reserve verandert →
 * header-saldo updatet live" universeel gegarandeerd voor elk pad
 * (placeBid, autobid-trigger, cancelAutoBid, finalizeAuction, runner-up-flow,
 * auto-cancel cron, admin sync-knop, ...).
 */
export async function syncReservedBalance(userId: string): Promise<number> {
  const calculated = await recalculateTotalReserved(userId);
  await prisma.user.update({
    where: { id: userId },
    data: { reservedBalance: calculated },
  });
  // Fire-and-forget — geen await, kost niets als er geen subscribers zijn.
  publish(userChannel(userId), { type: "balance-changed", payload: {} });
  return calculated;
}

/** Detail-rij voor admin-uitleg: één lopende veiling die geld vasthoudt. */
export interface ReserveBreakdownRow {
  auctionId: string;
  title: string;
  /** "highest-bidder" | "autobid-armed" | "awaiting-payment" */
  reason: "highest-bidder" | "autobid-armed" | "awaiting-payment";
  /** Het bedrag waarover gereserveerd wordt (bod of finalPrice). */
  baseAmount: number;
  /** Berekende reserve (10% × base × 1,029). */
  reserveAmount: number;
}

/** Breakdown van de reservedBalance per actieve veiling — voor de admin-UI.
 *  Returnt zowel de live-berekende totaal als de DB-waarde + de individuele
 *  rijen, zodat admins direct kunnen zien WAAROM geld vastgehouden wordt
 *  (en of de DB synchroon loopt met de werkelijke biedingen). */
export async function getReserveBreakdown(userId: string): Promise<{
  dbReserved: number;
  liveReserved: number;
  drift: number;
  rows: ReserveBreakdownRow[];
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reservedBalance: true },
  });

  // Spiegel van recalculateTotalReserved-query, maar met titel + bid-detail
  const eligible = await prisma.auction.findMany({
    where: {
      OR: [
        { status: "ACTIVE", bids: { some: { bidderId: userId } } },
        { paymentStatus: "AWAITING_PAYMENT", winnerId: userId },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      paymentStatus: true,
      winnerId: true,
      finalPrice: true,
      currentBid: true,
      startingBid: true,
      bids: {
        orderBy: { amount: "desc" },
        take: 1,
        select: { bidderId: true, amount: true },
      },
    },
  });

  if (eligible.length === 0) {
    return { dbReserved: user?.reservedBalance ?? 0, liveReserved: 0, drift: (user?.reservedBalance ?? 0), rows: [] };
  }

  const auctionIds = eligible.map((a) => a.id);
  const userBids = await prisma.auctionBid.findMany({
    where: { bidderId: userId, auctionId: { in: auctionIds } },
    orderBy: { amount: "desc" },
    select: { auctionId: true, amount: true },
  });
  const userHighestBidByAuction = new Map<string, number>();
  for (const b of userBids) {
    if (!userHighestBidByAuction.has(b.auctionId)) {
      userHighestBidByAuction.set(b.auctionId, b.amount);
    }
  }

  const activeAutoBids = await prisma.autoBid.findMany({
    where: { userId, isActive: true, auctionId: { in: auctionIds } },
    select: { auctionId: true, maxAmount: true },
  });
  const autoMaxByAuction = new Map<string, number>();
  for (const ab of activeAutoBids) autoMaxByAuction.set(ab.auctionId, ab.maxAmount);

  const rows: ReserveBreakdownRow[] = [];
  let liveTotal = 0;

  for (const a of eligible) {
    if (a.paymentStatus === "AWAITING_PAYMENT" && a.winnerId === userId) {
      const reserve = calculateReserveAmount(a.finalPrice ?? 0);
      if (reserve > 0) {
        rows.push({
          auctionId: a.id,
          title: a.title,
          reason: "awaiting-payment",
          baseAmount: a.finalPrice ?? 0,
          reserveAmount: reserve,
        });
        liveTotal += reserve;
      }
      continue;
    }

    const isHighestBidder = a.bids[0]?.bidderId === userId;
    const userBid = userHighestBidByAuction.get(a.id) ?? 0;
    const autoMax = autoMaxByAuction.get(a.id) ?? 0;
    const currentTopAmount = a.bids[0]?.amount ?? a.currentBid ?? a.startingBid;
    const minNextBid = getMinimumNextBid(currentTopAmount);
    const autoCanTrigger = autoMax >= minNextBid;

    if (isHighestBidder) {
      const effectiveAutoMax = autoCanTrigger ? autoMax : 0;
      const base = Math.max(userBid, effectiveAutoMax);
      const reserve = calculateReserveAmount(base);
      if (reserve > 0) {
        rows.push({
          auctionId: a.id,
          title: a.title,
          reason: "highest-bidder",
          baseAmount: base,
          reserveAmount: reserve,
        });
        liveTotal += reserve;
      }
    } else if (autoCanTrigger) {
      const reserve = calculateReserveAmount(autoMax);
      if (reserve > 0) {
        rows.push({
          auctionId: a.id,
          title: a.title,
          reason: "autobid-armed",
          baseAmount: autoMax,
          reserveAmount: reserve,
        });
        liveTotal += reserve;
      }
    }
  }

  liveTotal = Math.round(liveTotal * 100) / 100;
  const db = user?.reservedBalance ?? 0;
  return { dbReserved: db, liveReserved: liveTotal, drift: Math.round((db - liveTotal) * 100) / 100, rows };
}
