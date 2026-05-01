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
  "auction-payment-deadline",
  "proposal-payment-deadline",
  "cancellation-expiry",
  "cleanup-archived-chats",
  "bundle-offer-expiry",
  "bundle-offer-payment-deadline",
  "pickup-reservation-timeout",
  "pickup-reminder",
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
      "EXTERNAL pickup-bundles waarvan de reservering >14 dagen geleden is gemaakt en niet bevestigd: bundle CANCELLED, listings RESERVED → ACTIVE, beide partijen genotificeerd. Voorkomt dat listings eeuwig vastzitten.",
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "pickup-reminder": {
    description:
      "Stuurt 24-uur-reminder aan beide partijen voor ACCEPTED ophaalmomenten die binnen ~1 dag plaatsvinden. Set reminderSentAt zodat dezelfde afspraak niet dubbel pingt.",
    schedule: "Elke uur",
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

      let runnerUpBid: { bidderId: string; amount: number } | null = null;
      if (auction.runnerUpEnabled && auction.runnerUpAttempts < maxAttempts) {
        const excludedIds = new Set<string>([...failedBidderIds, previousWinnerId]);
        const candidates = await prisma.auctionBid.findMany({
          where: { auctionId: auction.id },
          orderBy: { amount: "desc" },
          select: { bidderId: true, amount: true },
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

        const oldBundle = await prisma.shippingBundle.findUnique({ where: { auctionId: auction.id } });
        if (oldBundle && oldBundle.status === "PENDING") {
          await prisma.shippingBundle.delete({ where: { id: oldBundle.id } });
        }
        const newWinner = await prisma.user.findUnique({
          where: { id: runnerUpBid.bidderId },
          select: { street: true, houseNumber: true, postalCode: true, city: true, country: true },
        });
        await createPendingBundle({
          buyerId: runnerUpBid.bidderId,
          sellerId: auction.sellerId,
          totalItemCost: runnerUpBid.amount,
          shippingCost: 0,
          auctionId: auction.id,
          address: newWinner ?? undefined,
        });

        await createNotification(runnerUpBid.bidderId, "AUCTION_WON", "Je bent de nieuwe winnaar",
          `De vorige bieder heeft niet betaald. Je hebt nu "${auction.title}" gewonnen voor €${runnerUpBid.amount.toFixed(2)}. Rond de betaling af binnen 5 dagen.`,
          `/nl/veilingen/${auction.id}`);
        await createNotification(auction.sellerId, "ITEM_SOLD", "Veiling doorgeschoven naar tweede bieder",
          `"${previousWinnerTitle}" is doorgeschoven naar de volgende bieder voor €${runnerUpBid.amount.toFixed(2)} (was €${previousWinnerPrice.toFixed(2)}).`,
          `/nl/veilingen/${auction.id}`);

        rotated++;
        processed++;
        continue;
      }

      await prisma.auction.update({
        where: { id: auction.id },
        data: { status: "PAYMENT_FAILED", paymentStatus: "PAYMENT_FAILED" },
      });
      await syncReservedBalance(previousWinnerId);
      const failedBundle = await prisma.shippingBundle.findUnique({ where: { auctionId: auction.id } });
      if (failedBundle && failedBundle.status === "PENDING") {
        await prisma.shippingBundle.delete({ where: { id: failedBundle.id } });
      }
      await createNotification(previousWinnerId, "AUCTION_WON", "Betaaltermijn verlopen",
        `De betaaltermijn voor "${previousWinnerTitle}" (€${previousWinnerPrice.toFixed(2)}) is verlopen.`,
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
        await prisma.listing.update({ where: { id: proposal.listing.id }, data: { status: "ACTIVE", buyerId: null } });
        const bundle = await prisma.shippingBundle.findUnique({ where: { listingId: proposal.listing.id } });
        if (bundle && bundle.status === "PENDING") {
          await prisma.shippingBundle.delete({ where: { id: bundle.id } });
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
      processed++;
    }
    return { itemsProcessed: processed, result: { processed, total: expiredProposals.length } };
  },
  "cancellation-expiry": async () => {
    const now = new Date();
    const expired = await prisma.cancellationRequest.findMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      include: { shippingBundle: { select: { orderNumber: true } } },
    });
    let processed = 0;
    for (const r of expired) {
      await prisma.cancellationRequest.update({ where: { id: r.id }, data: { status: "EXPIRED" } });
      await createNotification(r.proposedById, "NEW_MESSAGE", "Annuleringsverzoek verlopen",
        `Je annuleringsverzoek voor bestelling ${r.shippingBundle.orderNumber} is verlopen omdat de wederpartij niet heeft gereageerd. De bestelling staat nog open.`,
        "/dashboard/aankopen");
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
        if (bundle.bundleProposal) {
          await tx.bundleProposal.update({
            where: { id: bundle.bundleProposal.id },
            data: { status: "EXPIRED" },
          });
        }
      });

      await createNotification(bundle.buyerId, "NEW_MESSAGE", "Reservering verlopen",
        `De ophaal-reservering voor bestelling ${bundle.orderNumber} is verlopen na 14 dagen zonder bevestiging.`,
        bundle.bundleProposal?.conversationId
          ? `/nl/berichten/${bundle.bundleProposal.conversationId}`
          : "/dashboard/aankopen");
      await createNotification(bundle.sellerId, "NEW_MESSAGE", "Reservering verlopen",
        `De ophaal-reservering voor bestelling ${bundle.orderNumber} is verlopen. De advertenties staan weer actief.`,
        bundle.bundleProposal?.conversationId
          ? `/nl/berichten/${bundle.bundleProposal.conversationId}`
          : "/dashboard/verkopen");
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
};
