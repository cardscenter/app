// Registry of cron-job runners. The HTTP routes AND the admin "Run now" action
// both go through this registry, with `withCronLogging` wrapping the call so
// every execution lands in the CronRun table.
//
// Each runner returns a serializable summary; the wrappers persist
// `itemsProcessed` separately via the run handle.

import { prisma } from "@/lib/prisma";
import { autoConfirmDeliveries } from "@/actions/purchase";
import { autoResolveDisputes } from "@/actions/dispute";
import { checkAndDowngradeExpired } from "@/actions/subscription";
import { expireClaimedItems } from "@/actions/claimsale";
import { syncSetByPokewalletId } from "@/lib/pokewallet/sync";
import { createNotification } from "@/actions/notification";
import { syncReservedBalance } from "@/lib/balance-check";
import { createPendingBundle } from "@/lib/shipping-bundle";
import { PICKUP_RESERVATION_DAYS } from "@/lib/bundle-offer-config";
import { finalizeAuction } from "@/actions/auction";
import { refundEscrow, refundAuctionPremium } from "@/actions/wallet";
import { publish, userChannel, listingChannel } from "@/lib/realtime";
import {
  VERIFIED_BID_THRESHOLD,
  BID_FORFEIT_AMOUNT,
  STRIKE_TEMP_SUSPEND_THRESHOLD,
  STRIKE_TEMP_SUSPEND_DAYS,
  STRIKE_PERMANENT_THRESHOLD,
  STRIKE_DECAY_DAYS,
  BID_IP_RETENTION_DAYS,
} from "@/lib/auction/bid-tiers";
import { suspendUserSystem } from "@/lib/suspension";

const STALE_PAID_DAYS = 14;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseFailedBidderIds(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export const CRON_JOB_NAMES = [
  "auto-confirm",
  "auto-resolve-disputes",
  "check-subscriptions",
  "expire-claims",
  "sync-pokewallet",
  "auction-finalize",
  "auction-payment-deadline",
  "proposal-payment-deadline",
  "cancellation-expiry",
  "cleanup-archived-chats",
  "bundle-offer-expiry",
  "bundle-offer-payment-deadline",
  "pickup-reservation-timeout",
  "pickup-reminder",
  "auto-cancel-stale-paid",
  "payment-failure-decay",
  "prune-bid-ips",
  "reset-free-upsells",
] as const;
export type CronJobName = (typeof CRON_JOB_NAMES)[number];

export type CronJobMeta = {
  description: string;
  schedule: string;
  allowManualRun: boolean;
  runWarning?: string;
};

export const CRON_JOB_META: Record<CronJobName, CronJobMeta> = {
  "auto-confirm": {
    description:
      "Markeert SHIPPED bestellingen die 30 dagen geleden zijn verzonden als COMPLETED en geeft de escrow vrij aan de verkoper. Verwerkt alleen wat al rijp is — meermaals draaien is veilig.",
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "auto-resolve-disputes": {
    description:
      "Sluit disputes die de wederpartij niet binnen de termijn beantwoord heeft, met de standaard-uitkomst (terugbetaling of vrijgave volgens de regels).",
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "check-subscriptions": {
    description:
      "Downgrade-t verlopen PRO/UNLIMITED-abonnementen terug naar FREE. Vergelijkt premiumExpiresAt met nu.",
    schedule: "Elk uur",
    allowManualRun: true,
  },
  "expire-claims": {
    description:
      "Verloopt CLAIMED claimsale-items die >15 minuten in iemands cart staan zonder checkout. Items komen weer beschikbaar.",
    schedule: "Elke minuut",
    allowManualRun: true,
  },
  "auction-finalize": {
    description:
      "Sluit alle ACTIVE veilingen waarvan endTime is verstreken (status flip naar ENDED_SOLD/RESERVE_NOT_MET/NO_BIDS, escrow + bundle creation, notificaties). Safety-net naast de page-view en client-side countdown triggers — vangt veilingen op die anders zouden blijven hangen. Idempotent — meermaals draaien is veilig.",
    schedule: "Elke 5 minuten",
    allowManualRun: true,
  },
  "sync-pokewallet": {
    description:
      "Vernieuwt prijzen voor alle CardSets met een PokeWallet-mapping via de api.pokewallet.io API. Kan enkele minuten duren en doet ~600 API-calls.",
    schedule: "Dagelijks",
    allowManualRun: true,
    runWarning:
      "Heavy job: ~600 API-calls naar PokeWallet, kan 5+ minuten duren. Raakt rate-limit-budget. Alleen draaien als prijzen écht stale zijn.",
  },
  "auction-payment-deadline": {
    description:
      "Verwerkt veilingen waarvan de 5-dagen betaaltermijn verlopen is: rotatie naar runner-up of markering als PAYMENT_FAILED + escrow-release.",
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "proposal-payment-deadline": {
    description:
      "Idem voor chat-proposals: verlopen ACCEPTED-AWAITING_PAYMENT proposals worden PAYMENT_FAILED, listing terug op ACTIVE, beide partijen genotificeerd.",
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "cancellation-expiry": {
    description:
      "Markeert PENDING annuleringsverzoeken die meer dan 7 dagen open staan als EXPIRED. Verkoper blijft leveringsplichtig.",
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "cleanup-archived-chats": {
    description:
      "Permanent verwijderen van conversations + messages + proposals voor participants die >60 dagen ARCHIVED zijn. Dit is destructief en niet reversibel.",
    schedule: "Dagelijks",
    allowManualRun: false,
    runWarning:
      "Hard-delete van conversations en messages — kan niet teruggedraaid worden. Wordt alleen door de scheduler gedraaid.",
  },
  "bundle-offer-expiry": {
    description:
      "Markeert PENDING bundle-voorstellen die meer dan 3 dagen open staan als EXPIRED. Listings blijven ACTIVE (stonden nooit op RESERVED tijdens PENDING-fase).",
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "bundle-offer-payment-deadline": {
    description:
      "Verlopen ACCEPTED-AWAITING_PAYMENT bundle-voorstellen (PLATFORM-mode): paymentStatus → PAYMENT_FAILED, listings RESERVED → ACTIVE, PENDING bundle weg, beide partijen genotificeerd.",
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "pickup-reservation-timeout": {
    description:
      "EXTERNAL pickup-bundles waarvan de reservering verlopen is (>5 dagen, configurable via PICKUP_RESERVATION_DAYS) en niet bevestigd: bundle CANCELLED, listings + items RESERVED → AVAILABLE/ACTIVE, beide partijen genotificeerd. Voorkomt dat listings eeuwig vastzitten.",
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "pickup-reminder": {
    description:
      "Stuurt 24-uur-reminder aan beide partijen voor ACCEPTED ophaalmomenten die binnen ~1 dag plaatsvinden. Set reminderSentAt zodat dezelfde afspraak niet dubbel pingt.",
    schedule: "Elke uur",
    allowManualRun: true,
  },
  "auto-cancel-stale-paid": {
    description:
      "Annuleert PAID-bundles automatisch die ${STALE_PAID_DAYS} dagen niet zijn verzonden (SHIP-flow, geen actief PENDING cancel-verzoek). Volledige refund naar koper, items terug op de markt, autoExpiredAt ingevuld zodat admin probleem-sellers kan filteren.".replace("${STALE_PAID_DAYS}", String(STALE_PAID_DAYS)),
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "payment-failure-decay": {
    description:
      `Verlaagt User.paymentFailureCount met 1 voor users wiens laatste wanbetaling >${STRIKE_DECAY_DAYS} dagen geleden is. Suspend wordt niet automatisch opgeheven — alleen de strike-counter verzacht na een jaar zonder problemen.`,
    schedule: "Wekelijks",
    allowManualRun: true,
  },
  "prune-bid-ips": {
    description:
      `Anonimiseert AuctionBid.bidderIp voor bids ouder dan ${BID_IP_RETENTION_DAYS} dagen (privacy/retentie). Login-IPs op User worden bij elke nieuwe login overschreven, dus geen apart prune nodig.`,
    schedule: "Wekelijks",
    allowManualRun: true,
  },
  "reset-free-upsells": {
    description:
      "Reset op de 1e van de maand de gratis HOMEPAGE_SPOTLIGHT-quota voor alle PRO/Unlimited/Enterprise-abonnees naar de tier-default (1 / 5 / 999). Schedule deze cron op de 1e om 00:05 zodat alle users tegelijk hun nieuwe quota krijgen.",
    schedule: "Maandelijks (1e)",
    allowManualRun: true,
  },
};

export const CRON_JOBS: Record<CronJobName, () => Promise<{ itemsProcessed: number; result: object }>> = {
  "auto-confirm": async () => {
    const r = await autoConfirmDeliveries();
    return { itemsProcessed: r.confirmed, result: r };
  },
  "auto-resolve-disputes": async () => {
    const r = await autoResolveDisputes();
    return { itemsProcessed: r.resolved, result: r };
  },
  "check-subscriptions": async () => {
    const r = await checkAndDowngradeExpired();
    return { itemsProcessed: r.downgraded, result: r };
  },
  "expire-claims": async () => {
    const r = await expireClaimedItems();
    return { itemsProcessed: r.expired, result: r };
  },
  "sync-pokewallet": async () => {
    const sets = await prisma.cardSet.findMany({
      where: { pokewalletSetId: { not: null }, cards: { some: {} } },
      select: { id: true, name: true },
    });

    let totalUpdated = 0;
    let totalUnmatched = 0;
    let totalSetsOk = 0;
    const failures: { setName: string; error: string }[] = [];

    for (const set of sets) {
      try {
        const r = await syncSetByPokewalletId(set.id);
        totalUpdated += r.updated;
        totalUnmatched += r.unmatched;
        totalSetsOk++;
      } catch (e) {
        failures.push({ setName: set.name, error: (e as Error).message.slice(0, 200) });
      }
      await sleep(100);
    }

    return {
      itemsProcessed: totalUpdated,
      result: {
        totalSets: sets.length,
        setsOk: totalSetsOk,
        totalUpdated,
        totalUnmatched,
        failureCount: failures.length,
        failures: failures.slice(0, 10),
      },
    };
  },
  "auction-finalize": async () => {
    const now = new Date();
    const expired = await prisma.auction.findMany({
      where: { status: "ACTIVE", endTime: { lt: now } },
      select: { id: true },
      take: 200, // Safety-cap voor het geval een lange downtime een backlog opbouwt
    });

    let processed = 0;
    let errors = 0;
    for (const a of expired) {
      try {
        await finalizeAuction(a.id);
        processed++;
      } catch {
        errors++;
      }
    }

    return { itemsProcessed: processed, result: { processed, errors, total: expired.length } };
  },
  "auction-payment-deadline": async () => {
    const now = new Date();
    const expiredAuctions = await prisma.auction.findMany({
      where: { paymentStatus: "AWAITING_PAYMENT", paymentDeadline: { lt: now } },
    });

    let processed = 0;
    let rotated = 0;

    for (const auction of expiredAuctions) {
      if (!auction.winnerId || !auction.finalPrice) continue;

      const seller = await prisma.user.findUnique({
        where: { id: auction.sellerId },
        select: { maxRunnerUpAttempts: true },
      });
      const maxAttempts = seller?.maxRunnerUpAttempts ?? 5;
      const failedBidderIds = parseFailedBidderIds(auction.failedBidderIds);
      const previousWinnerId = auction.winnerId;
      const previousWinnerTitle = auction.title;
      const previousWinnerPrice = auction.finalPrice;

      // Fase 27.96: deliveryChoice meenemen zodat de nieuwe bundle de juiste
      // bezorg-mode krijgt (vooral relevant bij BOTH-veilingen).
      let runnerUpBid: { bidderId: string; amount: number; deliveryChoice: string | null } | null = null;
      if (auction.runnerUpEnabled && auction.runnerUpAttempts < maxAttempts) {
        const excludedIds = new Set<string>([...failedBidderIds, previousWinnerId]);
        const candidates = await prisma.auctionBid.findMany({
          where: { auctionId: auction.id },
          orderBy: { amount: "desc" },
          select: { bidderId: true, amount: true, deliveryChoice: true },
        });
        for (const c of candidates) {
          if (!excludedIds.has(c.bidderId)) { runnerUpBid = c; break; }
        }
      }

      if (runnerUpBid) {
        const newDeadline = new Date();
        newDeadline.setDate(newDeadline.getDate() + 5);
        const newFailedBidders = [...failedBidderIds, previousWinnerId];

        await prisma.auction.update({
          where: { id: auction.id },
          data: {
            status: "ENDED_SOLD",
            paymentStatus: "AWAITING_PAYMENT",
            winnerId: runnerUpBid.bidderId,
            finalPrice: runnerUpBid.amount,
            paymentDeadline: newDeadline,
            failedBidderIds: JSON.stringify(newFailedBidders),
            runnerUpAttempts: { increment: 1 },
          },
        });

        await syncReservedBalance(previousWinnerId);

        // Fase 27.98 + 29: nieuwe winner krijgt sync zodat AWAITING_PAYMENT-tak
        // in recalculateTotalReserved 15% van finalPrice voor 'm reserveert.
        await syncReservedBalance(runnerUpBid.bidderId);

        const oldBundle = await prisma.shippingBundle.findUnique({ where: { auctionId: auction.id } });
        if (oldBundle && oldBundle.status === "PENDING") {
          await prisma.shippingBundle.delete({ where: { id: oldBundle.id } });
        }
        const newWinner = await prisma.user.findUnique({
          where: { id: runnerUpBid.bidderId },
          select: { street: true, houseNumber: true, postalCode: true, city: true, country: true },
        });
        // Fase 27.96: bepaal delivery uit auction.deliveryMethod (SHIP/PICKUP)
        // of uit runner-up's bid.deliveryChoice (BOTH). Address alleen voor SHIP.
        const runnerUpDelivery: "SHIP" | "PICKUP" =
          auction.deliveryMethod === "PICKUP"
            ? "PICKUP"
            : auction.deliveryMethod === "SHIP"
              ? "SHIP"
              : (runnerUpBid.deliveryChoice as "SHIP" | "PICKUP" | null) === "PICKUP"
                ? "PICKUP"
                : "SHIP";
        await createPendingBundle({
          buyerId: runnerUpBid.bidderId,
          sellerId: auction.sellerId,
          totalItemCost: runnerUpBid.amount,
          shippingCost: 0,
          auctionId: auction.id,
          deliveryMethod: runnerUpDelivery,
          address: runnerUpDelivery === "SHIP" ? (newWinner ?? undefined) : undefined,
        });

        await createNotification(runnerUpBid.bidderId, "AUCTION_WON", "Je bent de nieuwe winnaar",
          `De vorige bieder heeft niet betaald. Je hebt nu "${auction.title}" gewonnen voor €${runnerUpBid.amount.toFixed(2)}. Rond de betaling af binnen 5 dagen.`,
          `/nl/veilingen/${auction.id}`);
        await createNotification(auction.sellerId, "ITEM_SOLD", "Veiling doorgeschoven naar tweede bieder",
          `"${previousWinnerTitle}" is doorgeschoven naar de volgende bieder voor €${runnerUpBid.amount.toFixed(2)} (was €${previousWinnerPrice.toFixed(2)}).`,
          `/nl/veilingen/${auction.id}`);

        // Real-time events (Fase 30A): runner-up krijgt auction-won-toast
        // direct, vorige winner ziet z'n reservering vrijvallen.
        publish(userChannel(runnerUpBid.bidderId), {
          type: "auction-won",
          payload: {
            auctionId: auction.id,
            auctionTitle: auction.title,
            finalPrice: runnerUpBid.amount,
            paymentDeadline: newDeadline.toISOString(),
          },
        });
        publish(userChannel(runnerUpBid.bidderId), { type: "balance-changed", payload: {} });
        publish(userChannel(previousWinnerId), { type: "balance-changed", payload: {} });

        rotated++;
        processed++;
        continue;
      }

      await prisma.auction.update({
        where: { id: auction.id },
        data: { status: "PAYMENT_FAILED", paymentStatus: "PAYMENT_FAILED" },
      });

      // Fase 29: borg-forfait + strike + auto-suspend voor wanbetaler
      const isHighBid = previousWinnerPrice >= VERIFIED_BID_THRESHOLD;
      let forfeitAmount = 0;

      if (isHighBid) {
        const wanbetaler = await prisma.user.findUnique({
          where: { id: previousWinnerId },
          select: { balance: true },
        });
        if (wanbetaler) {
          // Clamp op beschikbare balance (≥ 0). De 10%-reserve van finalPrice
          // staat tijdens AWAITING_PAYMENT al vast — dat geeft een minimum
          // buffer van 10% × €2000 = €200, dus de €200 forfeit past altijd
          // mits de user geen reservering heeft uitgegeven na winnen.
          forfeitAmount = Math.min(BID_FORFEIT_AMOUNT, Math.max(wanbetaler.balance, 0));
          if (forfeitAmount > 0) {
            const balanceAfter = wanbetaler.balance - forfeitAmount;
            await prisma.$transaction([
              prisma.user.update({
                where: { id: previousWinnerId },
                data: { balance: balanceAfter },
              }),
              prisma.transaction.create({
                data: {
                  userId: previousWinnerId,
                  type: "BID_DEPOSIT_FORFEIT",
                  amount: -forfeitAmount,
                  balanceBefore: wanbetaler.balance,
                  balanceAfter,
                  description: `Borg verbeurd: niet betaald op veiling "${previousWinnerTitle}"`,
                  relatedAuctionId: auction.id,
                },
              }),
            ]);
          }
        }
      }

      // Strike +1 (geldt ook voor low-value-bids — anti-griefing)
      const updatedUser = await prisma.user.update({
        where: { id: previousWinnerId },
        data: {
          paymentFailureCount: { increment: 1 },
          paymentFailureLastAt: new Date(),
        },
        select: { paymentFailureCount: true },
      });

      // Auto-suspend bij thresholds
      if (updatedUser.paymentFailureCount >= STRIKE_PERMANENT_THRESHOLD) {
        await suspendUserSystem(
          previousWinnerId,
          "PERMANENT",
          null,
          `Auto-suspend: ${STRIKE_PERMANENT_THRESHOLD}× wanbetaling op veiling`,
        );
      } else if (updatedUser.paymentFailureCount >= STRIKE_TEMP_SUSPEND_THRESHOLD) {
        await suspendUserSystem(
          previousWinnerId,
          "TEMPORARY",
          STRIKE_TEMP_SUSPEND_DAYS,
          `Auto-suspend: ${STRIKE_TEMP_SUSPEND_THRESHOLD}× wanbetaling op veiling`,
        );
      }

      // syncReservedBalance daarna — auction is PAYMENT_FAILED, dus reserve
      // op deze auction valt automatisch vrij. Surplus boven forfait keert
      // terug naar `available`.
      await syncReservedBalance(previousWinnerId);

      // Real-time balance-changed (Fase 30A) — wanbetaler ziet zijn saldo
      // direct dalen (forfait) en de reserve weer vrijvallen.
      publish(userChannel(previousWinnerId), { type: "balance-changed", payload: {} });

      const failedBundle = await prisma.shippingBundle.findUnique({ where: { auctionId: auction.id } });
      if (failedBundle && failedBundle.status === "PENDING") {
        await prisma.shippingBundle.delete({ where: { id: failedBundle.id } });
      }

      const forfeitText = forfeitAmount > 0
        ? ` Een borg van €${forfeitAmount.toFixed(2)} is verbeurd.`
        : "";
      const strikeText = ` Je staat nu op ${updatedUser.paymentFailureCount} wanbetaling${updatedUser.paymentFailureCount === 1 ? "" : "en"}.`;
      await createNotification(previousWinnerId, "AUCTION_WON", "Betaaltermijn verlopen",
        `De betaaltermijn voor "${previousWinnerTitle}" (€${previousWinnerPrice.toFixed(2)}) is verlopen.${forfeitText}${strikeText}`,
        `/nl/veilingen/${auction.id}`);
      await createNotification(auction.sellerId, "ITEM_SOLD", "Betaling niet ontvangen",
        `De koper heeft "${previousWinnerTitle}" niet betaald binnen de termijn. De veiling is geannuleerd.`,
        `/nl/veilingen/${auction.id}`);

      processed++;
    }

    return { itemsProcessed: processed, result: { processed, rotated, total: expiredAuctions.length } };
  },
  "proposal-payment-deadline": async () => {
    const now = new Date();
    const expiredProposals = await prisma.proposal.findMany({
      where: { status: "ACCEPTED", paymentStatus: "AWAITING_PAYMENT", paymentDeadline: { lt: now } },
      include: {
        listing: { select: { id: true, title: true, sellerId: true } },
        conversation: { include: { participants: true } },
      },
    });

    let processed = 0;
    for (const proposal of expiredProposals) {
      const buyerId = proposal.type === "BUY"
        ? proposal.proposerId
        : proposal.conversation.participants.find((p) => p.userId !== proposal.proposerId)?.userId;
      const sellerId = proposal.listing?.sellerId
        ?? proposal.conversation.participants.find((p) => p.userId !== buyerId)?.userId;

      await prisma.proposal.update({ where: { id: proposal.id }, data: { paymentStatus: "PAYMENT_FAILED" } });
      if (proposal.listing) {
        const partialItemIds: string[] | null = proposal.itemIds ? JSON.parse(proposal.itemIds) : null;
        if (partialItemIds && partialItemIds.length > 0) {
          // Partial-sale: items terug naar AVAILABLE + listing-status hercomputeren
          await prisma.listingCardItem.updateMany({
            where: { id: { in: partialItemIds }, status: "RESERVED" },
            data: { status: "AVAILABLE", buyerId: null, shippingBundleId: null },
          });
          const sold = await prisma.listingCardItem.count({
            where: { listingId: proposal.listing.id, status: "SOLD" },
          });
          await prisma.listing.update({
            where: { id: proposal.listing.id },
            data: { status: sold > 0 ? "PARTIALLY_SOLD" : "ACTIVE" },
          });
          // Pending bundle (partial) opruimen
          const pending = await prisma.shippingBundle.findFirst({
            where: { buyerId: buyerId!, sellerId: sellerId!, status: "PENDING", listingId: null },
            orderBy: { createdAt: "desc" },
          });
          if (pending) await prisma.shippingBundle.delete({ where: { id: pending.id } });
        } else {
          // Full-listing flow (bestaand)
          await prisma.listing.update({ where: { id: proposal.listing.id }, data: { status: "ACTIVE", buyerId: null } });
          const bundle = await prisma.shippingBundle.findUnique({ where: { listingId: proposal.listing.id } });
          if (bundle && bundle.status === "PENDING") {
            await prisma.shippingBundle.delete({ where: { id: bundle.id } });
          }
        }
      }
      const contextTitle = proposal.listing?.title ?? "betaalverzoek";
      const amountStr = proposal.amount.toFixed(2);
      if (buyerId) {
        await createNotification(buyerId, "NEW_MESSAGE", "Betaaltermijn verlopen",
          `De betaaltermijn voor het voorstel "${contextTitle}" (€${amountStr}) is verlopen.`,
          `/nl/berichten/${proposal.conversationId}`);
      }
      if (sellerId) {
        await createNotification(sellerId, "NEW_MESSAGE", "Betaaltermijn verlopen",
          `De koper heeft het voorstel voor "${contextTitle}" (€${amountStr}) niet betaald binnen de termijn.`,
          `/nl/berichten/${proposal.conversationId}`);
      }
      // Real-time: listing terug op markt voor watchers + balance-update voor buyer
      if (proposal.listing) {
        publish(listingChannel(proposal.listing.id), {
          type: "listing-changed",
          payload: { listingId: proposal.listing.id, status: "ACTIVE" },
        });
      }
      if (buyerId) publish(userChannel(buyerId), { type: "balance-changed", payload: {} });
      processed++;
    }
    return { itemsProcessed: processed, result: { processed, total: expiredProposals.length } };
  },
  "cancellation-expiry": async () => {
    const now = new Date();
    const expired = await prisma.cancellationRequest.findMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      include: {
        shippingBundle: { select: { id: true, orderNumber: true, buyerId: true, sellerId: true, status: true } },
      },
    });
    let processed = 0;
    for (const r of expired) {
      await prisma.cancellationRequest.update({ where: { id: r.id }, data: { status: "EXPIRED" } });
      await createNotification(r.proposedById, "NEW_MESSAGE", "Annuleringsverzoek verlopen",
        `Je annuleringsverzoek voor bestelling ${r.shippingBundle.orderNumber} is verlopen omdat de wederpartij niet heeft gereageerd. De bestelling staat nog open.`,
        "/dashboard/aankopen");
      // Real-time: beide partijen zien PENDING-marker verdwijnen op /aankopen + /verkopen
      for (const uid of [r.shippingBundle.buyerId, r.shippingBundle.sellerId]) {
        publish(userChannel(uid), {
          type: "bundle-changed",
          payload: { bundleId: r.shippingBundle.id, status: r.shippingBundle.status },
        });
      }
      processed++;
    }
    return { itemsProcessed: processed, result: { processed, total: expired.length } };
  },
  "cleanup-archived-chats": async () => {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const staleParticipants = await prisma.conversationParticipant.findMany({
      where: { status: "ARCHIVED", archivedAt: { lt: cutoff } },
      select: { id: true, conversationId: true },
    });
    if (staleParticipants.length === 0) {
      return { itemsProcessed: 0, result: { participantsRemoved: 0, conversationsDeleted: 0 } };
    }
    const deleted = await prisma.conversationParticipant.deleteMany({
      where: { id: { in: staleParticipants.map((p) => p.id) } },
    });
    const convoIds = [...new Set(staleParticipants.map((p) => p.conversationId))];
    let conversationsDeleted = 0;
    for (const convoId of convoIds) {
      const remaining = await prisma.conversationParticipant.count({ where: { conversationId: convoId } });
      if (remaining === 0) {
        await prisma.message.deleteMany({ where: { conversationId: convoId } });
        await prisma.proposal.deleteMany({ where: { conversationId: convoId } });
        // Fase 27: bundle-proposals zonder cascade — handmatig opruimen voor de
        // conversation-delete door FK kan.
        await prisma.bundleProposal.deleteMany({ where: { conversationId: convoId } });
        await prisma.conversation.delete({ where: { id: convoId } });
        conversationsDeleted++;
      }
    }
    return {
      itemsProcessed: deleted.count + conversationsDeleted,
      result: { participantsRemoved: deleted.count, conversationsDeleted },
    };
  },
  "bundle-offer-expiry": async () => {
    const now = new Date();
    const result = await prisma.bundleProposal.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED", respondedAt: now },
    });
    // Notificaties voor de geëxpireerde voorstellen — apart fetch om buyer/seller
    // te kennen (updateMany returnt geen rijen).
    if (result.count > 0) {
      const expired = await prisma.bundleProposal.findMany({
        where: { status: "EXPIRED", respondedAt: now },
        select: { id: true, buyerId: true, sellerId: true, conversationId: true, totalAmount: true },
      });
      for (const bp of expired) {
        await createNotification(bp.buyerId, "NEW_MESSAGE", "Bundel-voorstel verlopen",
          `Je bundel-voorstel van €${bp.totalAmount.toFixed(2)} is verlopen.`,
          `/nl/berichten/${bp.conversationId}`);
        await createNotification(bp.sellerId, "NEW_MESSAGE", "Bundel-voorstel verlopen",
          `Een bundel-voorstel van €${bp.totalAmount.toFixed(2)} is verlopen zonder antwoord.`,
          `/nl/berichten/${bp.conversationId}`);
      }
    }
    return { itemsProcessed: result.count, result: { processed: result.count } };
  },
  "bundle-offer-payment-deadline": async () => {
    const now = new Date();
    const expired = await prisma.bundleProposal.findMany({
      where: {
        status: "ACCEPTED",
        paymentStatus: "AWAITING_PAYMENT",
        paymentMode: "PLATFORM",
        paymentDeadline: { lt: now },
      },
      include: {
        listings: { select: { listingId: true } },
        shippingBundle: { select: { id: true, status: true } },
      },
    });

    let processed = 0;
    for (const bp of expired) {
      const listingIds = bp.listings.map((l) => l.listingId);

      await prisma.$transaction(async (tx) => {
        // Listings RESERVED → ACTIVE (alleen die nog RESERVED zijn)
        await tx.listing.updateMany({
          where: { id: { in: listingIds }, status: "RESERVED" },
          data: { status: "ACTIVE", buyerId: null },
        });

        // PENDING bundle weg
        if (bp.shippingBundle && bp.shippingBundle.status === "PENDING") {
          await tx.shippingBundle.delete({ where: { id: bp.shippingBundle.id } });
        }

        await tx.bundleProposal.update({
          where: { id: bp.id },
          data: { paymentStatus: "PAYMENT_FAILED" },
        });
      });

      await createNotification(bp.buyerId, "NEW_MESSAGE", "Betaaltermijn verlopen",
        `Je bundel-voorstel van €${bp.totalAmount.toFixed(2)} is verlopen omdat de betaling niet op tijd binnen was.`,
        `/nl/berichten/${bp.conversationId}`);
      await createNotification(bp.sellerId, "NEW_MESSAGE", "Betaaltermijn verlopen",
        `De koper heeft een geaccepteerd bundel-voorstel van €${bp.totalAmount.toFixed(2)} niet betaald binnen de termijn. De advertenties staan weer actief.`,
        `/nl/berichten/${bp.conversationId}`);
      // Real-time: balance-update voor buyer + listings terug op markt
      publish(userChannel(bp.buyerId), { type: "balance-changed", payload: {} });
      for (const lid of listingIds) {
        publish(listingChannel(lid), {
          type: "listing-changed",
          payload: { listingId: lid, status: "ACTIVE" },
        });
      }
      processed++;
    }

    return { itemsProcessed: processed, result: { processed, total: expired.length } };
  },
  "pickup-reservation-timeout": async () => {
    const now = new Date();
    const expired = await prisma.shippingBundle.findMany({
      where: {
        paymentMode: "EXTERNAL",
        pickupReservationExpiresAt: { lt: now },
        status: { in: ["PENDING", "SCHEDULED"] },
      },
      include: {
        bundleListings: { select: { listingId: true } },
        bundleProposal: { select: { id: true, conversationId: true } },
      },
    });

    let processed = 0;
    for (const bundle of expired) {
      const listingIds = bundle.bundleListings.map((bl) => bl.listingId);
      await prisma.$transaction(async (tx) => {
        await tx.shippingBundle.updateMany({
          where: { id: bundle.id, paymentMode: "EXTERNAL", status: { in: ["PENDING", "SCHEDULED"] } },
          data: { status: "CANCELLED" },
        });
        // Listing-rollback voor multi-listing bundles
        if (listingIds.length > 0) {
          await tx.listing.updateMany({
            where: { id: { in: listingIds }, status: "RESERVED" },
            data: { status: "ACTIVE", buyerId: null },
          });
        } else if (bundle.listingId) {
          await tx.listing.updateMany({
            where: { id: bundle.listingId, status: "RESERVED" },
            data: { status: "ACTIVE", buyerId: null },
          });
        }
        // Stocked / MULTI_CARD partial: items RESERVED → AVAILABLE (Fase 27.78
        // — was missing). Items zijn aan de bundle gekoppeld via shippingBundleId.
        // Daarnaast listing-status hercomputeren per geraakte listing want
        // PARTIALLY_SOLD kan terug naar ACTIVE als nul SOLD items overblijven.
        const releasedItems = await tx.listingCardItem.findMany({
          where: { shippingBundleId: bundle.id, status: "RESERVED" },
          select: { listingId: true },
        });
        const affectedListingIds = Array.from(new Set(releasedItems.map((i) => i.listingId)));
        if (releasedItems.length > 0) {
          await tx.listingCardItem.updateMany({
            where: { shippingBundleId: bundle.id, status: "RESERVED" },
            data: { status: "AVAILABLE", buyerId: null, shippingBundleId: null },
          });
        }
        for (const lid of affectedListingIds) {
          const remainingSold = await tx.listingCardItem.count({
            where: { listingId: lid, status: "SOLD" },
          });
          // Als geen SOLD-items meer: terug naar ACTIVE; anders blijft PARTIALLY_SOLD.
          if (remainingSold === 0) {
            await tx.listing.updateMany({
              where: { id: lid, status: "PARTIALLY_SOLD" },
              data: { status: "ACTIVE" },
            });
          }
        }
        if (bundle.bundleProposal) {
          await tx.bundleProposal.update({
            where: { id: bundle.bundleProposal.id },
            data: { status: "EXPIRED" },
          });
        }
      });

      await createNotification(bundle.buyerId, "NEW_MESSAGE", "Reservering verlopen",
        `De ophaal-reservering voor bestelling ${bundle.orderNumber} is verlopen na ${PICKUP_RESERVATION_DAYS} dagen zonder bevestiging.`,
        bundle.bundleProposal?.conversationId
          ? `/nl/berichten/${bundle.bundleProposal.conversationId}`
          : "/dashboard/aankopen");
      await createNotification(bundle.sellerId, "NEW_MESSAGE", "Reservering verlopen",
        `De ophaal-reservering voor bestelling ${bundle.orderNumber} is verlopen. De advertenties staan weer actief.`,
        bundle.bundleProposal?.conversationId
          ? `/nl/berichten/${bundle.bundleProposal.conversationId}`
          : "/dashboard/verkopen");
      // Real-time: bundle CANCELLED + listings terug op markt
      for (const uid of [bundle.buyerId, bundle.sellerId]) {
        publish(userChannel(uid), {
          type: "bundle-changed",
          payload: { bundleId: bundle.id, status: "CANCELLED" },
        });
      }
      const allListingIds = listingIds.length > 0 ? listingIds : (bundle.listingId ? [bundle.listingId] : []);
      for (const lid of allListingIds) {
        publish(listingChannel(lid), {
          type: "listing-changed",
          payload: { listingId: lid, status: "ACTIVE" },
        });
      }
      processed++;
    }
    return { itemsProcessed: processed, result: { processed, total: expired.length } };
  },
  "pickup-reminder": async () => {
    const in23h = new Date(Date.now() + 23 * 60 * 60 * 1000);
    const in25h = new Date(Date.now() + 25 * 60 * 60 * 1000);

    const due = await prisma.pickupSchedule.findMany({
      where: {
        status: "ACCEPTED",
        proposedFor: { gte: in23h, lte: in25h },
        reminderSentAt: null,
      },
      include: {
        shippingBundle: {
          select: {
            id: true,
            buyerId: true,
            sellerId: true,
            orderNumber: true,
            bundleProposal: { select: { conversationId: true } },
          },
        },
      },
    });

    let processed = 0;
    for (const sched of due) {
      const link = sched.shippingBundle.bundleProposal?.conversationId
        ? `/nl/berichten/${sched.shippingBundle.bundleProposal.conversationId}`
        : null;
      const dateStr = sched.proposedFor.toLocaleDateString("nl-NL");
      const timeStr = `${sched.windowStart}-${sched.windowEnd}`;
      const body = `Herinnering: ophaalmoment morgen ${dateStr} (${timeStr}) voor bestelling ${sched.shippingBundle.orderNumber}.`;

      await createNotification(sched.shippingBundle.buyerId, "NEW_MESSAGE", "Ophaal-herinnering", body, link ?? "/dashboard/aankopen");
      await createNotification(sched.shippingBundle.sellerId, "NEW_MESSAGE", "Ophaal-herinnering", body, link ?? "/dashboard/verkopen");

      await prisma.pickupSchedule.update({
        where: { id: sched.id },
        data: { reminderSentAt: new Date() },
      });
      processed++;
    }
    return { itemsProcessed: processed, result: { processed, total: due.length } };
  },
  "auto-cancel-stale-paid": async () => {
    // Vindt PAID SHIP-bundles die 14d na createdAt nog niet zijn verzonden en
    // waarop geen actief annuleringsverzoek loopt. Refundt volledig + zet
    // status CANCELLED + autoExpiredAt. Symmetrisch met auction-payment-deadline:
    // ene partij voldoet niet aan z'n verplichting → andere partij wint automatisch.
    const cutoff = new Date(Date.now() - STALE_PAID_DAYS * 24 * 60 * 60 * 1000);
    const stale = await prisma.shippingBundle.findMany({
      where: {
        status: "PAID",
        deliveryMethod: "SHIP",
        shippedAt: null,
        createdAt: { lt: cutoff },
        cancellationRequests: { none: { status: "PENDING" } },
      },
      select: {
        id: true,
        orderNumber: true,
        buyerId: true,
        sellerId: true,
        totalCost: true,
        refundedAmount: true,
        listingId: true,
        auctionId: true,
      },
    });

    let processed = 0;
    for (const b of stale) {
      const refundAmount = Math.max(0, b.totalCost - b.refundedAmount);

      // Refund + heldBalance-decrement (alles in escrow sinds Fase 28-escrow-fix)
      await refundEscrow(
        b.sellerId,
        b.buyerId,
        refundAmount,
        refundAmount,
        `Automatisch geannuleerd na ${STALE_PAID_DAYS} dagen zonder verzending: bestelling ${b.orderNumber}`,
        b.id,
      );

      // Auction-bundles: buyer's premium ook terugbetalen (Fase 31).
      // Bundle ging niet door, dus de platform-fee hoort niet bij ons te
      // blijven. Voor listing/claimsale-bundles is geen premium afgeschreven.
      if (b.auctionId) {
        await refundAuctionPremium(b.buyerId, b.auctionId);
      }

      // Items terug naar AVAILABLE
      await prisma.claimsaleItem.updateMany({
        where: { shippingBundleId: b.id },
        data: { status: "AVAILABLE", buyerId: null, shippingBundleId: null },
      });

      // Listing terug op ACTIVE als die nog SOLD stond
      if (b.listingId) {
        await prisma.listing.updateMany({
          where: { id: b.listingId, status: "SOLD" },
          data: { status: "ACTIVE", buyerId: null },
        });
      }

      // Multi-listing bundle: alle bundleListings → ACTIVE
      const bundleListings = await prisma.bundleListing.findMany({
        where: { shippingBundleId: b.id },
        select: { listingId: true },
      });
      if (bundleListings.length > 0) {
        await prisma.listing.updateMany({
          where: { id: { in: bundleListings.map((bl) => bl.listingId) }, status: "SOLD" },
          data: { status: "ACTIVE", buyerId: null },
        });
      }

      // Bundle markeren — autoExpiredAt scheidt deze van mutual-akkoord-cancels
      await prisma.shippingBundle.update({
        where: { id: b.id },
        data: { status: "CANCELLED", autoExpiredAt: new Date() },
      });

      // Notificaties — buyer krijgt positieve melding, seller waarschuwing
      await createNotification(
        b.buyerId,
        "ORDER_CANCELLED",
        "Bestelling automatisch geannuleerd",
        `De verkoper heeft bestelling ${b.orderNumber} niet binnen ${STALE_PAID_DAYS} dagen verzonden. Het volledige bedrag (€${refundAmount.toFixed(2)}) is teruggestort op je saldo.`,
        "/dashboard/aankopen",
      );
      await createNotification(
        b.sellerId,
        "ORDER_CANCELLED",
        "Bestelling automatisch geannuleerd",
        `Bestelling ${b.orderNumber} is automatisch geannuleerd omdat je niet binnen ${STALE_PAID_DAYS} dagen hebt verzonden. Herhaaldelijk niet-verzenden kan leiden tot account-suspensie.`,
        "/dashboard/verkopen",
      );

      // Real-time: bundle CANCELLED + balance-changed (refund) + listings ACTIVE
      for (const uid of [b.buyerId, b.sellerId]) {
        publish(userChannel(uid), {
          type: "bundle-changed",
          payload: { bundleId: b.id, status: "CANCELLED" },
        });
        publish(userChannel(uid), { type: "balance-changed", payload: {} });
      }
      if (b.listingId) {
        publish(listingChannel(b.listingId), {
          type: "listing-changed",
          payload: { listingId: b.listingId, status: "ACTIVE" },
        });
      }
      for (const bl of bundleListings) {
        publish(listingChannel(bl.listingId), {
          type: "listing-changed",
          payload: { listingId: bl.listingId, status: "ACTIVE" },
        });
      }

      processed++;
    }

    return { itemsProcessed: processed, result: { processed, total: stale.length } };
  },
  "payment-failure-decay": async () => {
    // Verlaag paymentFailureCount met 1 voor users die >365d geen nieuwe
    // wanbetaling hebben gehad. Suspend wordt NIET automatisch opgeheven —
    // alleen de strike-counter zakt. Een geschorste user blijft geschorst
    // tot een admin handmatig liftSuspension uitvoert.
    const cutoff = new Date(Date.now() - STRIKE_DECAY_DAYS * 24 * 60 * 60 * 1000);
    const eligible = await prisma.user.findMany({
      where: {
        paymentFailureCount: { gt: 0 },
        paymentFailureLastAt: { lt: cutoff },
      },
      select: { id: true, paymentFailureCount: true },
    });
    let processed = 0;
    for (const u of eligible) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          paymentFailureCount: { decrement: 1 },
          // paymentFailureLastAt updaten zodat de volgende decay weer 365d
          // verder kan starten (anders zou een user met count=3 in één tick
          // helemaal naar 0 gaan).
          paymentFailureLastAt: new Date(),
        },
      });
      processed++;
    }
    return { itemsProcessed: processed, result: { processed, total: eligible.length } };
  },
  "prune-bid-ips": async () => {
    // Privacy-retentie: anonimiseer AuctionBid.bidderIp ouder dan 90d.
    // Behoudt de bid-rij intact, alleen de IP-string wordt genull't.
    const cutoff = new Date(Date.now() - BID_IP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await prisma.auctionBid.updateMany({
      where: {
        bidderIp: { not: null },
        createdAt: { lt: cutoff },
      },
      data: { bidderIp: null },
    });
    return { itemsProcessed: result.count, result: { pruned: result.count } };
  },
  "reset-free-upsells": async () => {
    // Maandelijkse reset van gratis HOMEPAGE_SPOTLIGHT-quota per tier.
    // Drie aparte updateMany ipv een loop omdat het aantal verschilt per tier
    // en SQLite/Prisma geen CASE WHEN-update kent.
    const now = new Date();
    const [pro, unlim, ent] = await prisma.$transaction([
      prisma.user.updateMany({
        where: { accountType: "PRO" },
        data: { freeUpsellsRemaining: 1, freeUpsellsResetAt: now },
      }),
      prisma.user.updateMany({
        where: { accountType: "UNLIMITED" },
        data: { freeUpsellsRemaining: 5, freeUpsellsResetAt: now },
      }),
      prisma.user.updateMany({
        where: { accountType: { in: ["ENTERPRISE", "ADMIN"] } },
        data: { freeUpsellsRemaining: 999, freeUpsellsResetAt: now },
      }),
    ]);
    const total = pro.count + unlim.count + ent.count;
    return {
      itemsProcessed: total,
      result: { pro: pro.count, unlimited: unlim.count, enterprise: ent.count, total },
    };
  },
};
