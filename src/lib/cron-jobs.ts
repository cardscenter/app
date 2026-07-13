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
import { syncSetCatalog } from "@/lib/pokewallet/set-mapping";
import { populateEmptyMappedSets, topUpGrowingSets } from "@/lib/pokewallet/populate-cards";
import { backfillTcgdexPricing } from "@/lib/pokewallet/tcgdex-pricing";
import { mirrorCardImage, mirrorSetLogo, mapPaced } from "@/lib/pokewallet/mirror-images";
import { createNotification } from "@/actions/notification";
import { syncReservedBalance } from "@/lib/balance-check";
import { createPendingBundle } from "@/lib/shipping-bundle";
import { PICKUP_RESERVATION_DAYS } from "@/lib/bundle-offer-config";
import { finalizeAuction } from "@/actions/auction";
import { refundEscrow, refundAuctionPremium } from "@/actions/wallet";
import { publish, userChannel, listingChannel, auctionChannel, claimsaleChannel } from "@/lib/realtime";
import {
  VERIFIED_BID_THRESHOLD,
  BID_FORFEIT_AMOUNT,
  PAYMENT_FAILURE_FEE_RATE,
  STRIKE_TEMP_SUSPEND_THRESHOLD,
  STRIKE_TEMP_SUSPEND_DAYS,
  STRIKE_PERMANENT_THRESHOLD,
  STRIKE_DECAY_DAYS,
  BID_IP_RETENTION_DAYS,
} from "@/lib/auction/bid-tiers";
import { suspendUserSystem } from "@/lib/suspension";
import { AUCTION_BUYER_PREMIUM_RATE } from "@/lib/auction/fees";
import { recordPendingFeeInTx } from "@/lib/pending-fees";
import { getBlockedUserIds } from "@/lib/blocking";
import { parseImageUrls, deleteUploadedFile } from "@/lib/upload";
import {
  STALE_PAID_SELLER_DEADLINE_DAYS,
  STALE_PAID_AUTO_CANCEL_AFTER_DAYS,
} from "@/lib/stale-order-config";

const CLEANUP_SOLD_IMAGES_DAYS = 30;
const RUNNER_UP_DECISION_HOURS = 72;
const PAYMENT_DEADLINE_DAYS = 5;
const MAX_RUNNER_UP_ATTEMPTS_CAP = 3;

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

/**
 * Finaliseer een veiling als PAYMENT_FAILED. Wordt aangeroepen wanneer er geen
 * runner-up-kandidaat meer beschikbaar is (cap bereikt of niemand meer eligible).
 * Idempotent: als de veiling al PAYMENT_FAILED is gebeurt er niks.
 */
async function finalizeAuctionAsPaymentFailed(auctionId: string): Promise<void> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { id: true, status: true, sellerId: true, title: true },
  });
  if (!auction) return;
  if (auction.status === "PAYMENT_FAILED") return;

  await prisma.auction.update({
    where: { id: auctionId },
    data: {
      status: "PAYMENT_FAILED",
      paymentStatus: "PAYMENT_FAILED",
      paymentDeadline: null,
    },
  });

  await createNotification(
    auction.sellerId,
    "ITEM_SOLD",
    "Veiling geannuleerd — niemand heeft betaald",
    `"${auction.title}" is afgesloten zonder betalende koper. Bekijk de flow op /dashboard/verkopen.`,
    "/nl/dashboard/verkopen",
  );

  publish(userChannel(auction.sellerId), {
    type: "auction-runner-up-decided",
    payload: { auctionId, status: "EXPIRED" },
  });
}

/**
 * Beslis wat er gebeurt met een veiling waarvan de huidige winnaar/runner-up
 * gefaald heeft (niet betaald binnen 5d, of decline/expired binnen 72u-window).
 *
 * - Als runnerUpEnabled false of cap bereikt → finaliseer als PAYMENT_FAILED.
 * - Anders zoek volgende kandidaat (hoogste bid niet in failedBidderIds, niet
 *   in eerdere DECLINED/EXPIRED offers, niet suspended). Vervolgens maak
 *   AuctionRunnerUpOffer aan met 72u-window. Geen PENDING-bundle, geen
 *   reserve — die komen pas bij accept.
 *
 * `previousBidderId` wordt aan failedBidderIds toegevoegd zodat hij niet
 * opnieuw als kandidaat wordt overwogen. Wordt typisch aangeroepen vanuit:
 *   - cron `auction-payment-deadline` (originele winnaar miste 5d-deadline)
 *   - cron `auction-runner-up-decision-deadline` (runner-up miste 72u-window)
 *   - action `declineRunnerUpOffer` (runner-up klikte actief weiger)
 */
export async function processRunnerUpDecision(
  auctionId: string,
  previousBidderId: string | null,
): Promise<{ outcome: "OFFERED" | "FINALIZED"; newOfferId?: string; newBidderId?: string }> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { seller: { select: { maxRunnerUpAttempts: true } } },
  });
  if (!auction) return { outcome: "FINALIZED" };
  if (auction.paymentStatus === "PAID" || auction.status === "PAYMENT_FAILED") {
    return { outcome: "FINALIZED" };
  }

  const failedBidderIds = parseFailedBidderIds(auction.failedBidderIds);
  const updatedFailedIds =
    previousBidderId && !failedBidderIds.includes(previousBidderId)
      ? [...failedBidderIds, previousBidderId]
      : failedBidderIds;

  const cappedMax = Math.min(
    Math.max(auction.seller.maxRunnerUpAttempts, 0),
    MAX_RUNNER_UP_ATTEMPTS_CAP,
  );

  if (!auction.runnerUpEnabled || auction.runnerUpAttempts >= cappedMax) {
    await prisma.auction.update({
      where: { id: auctionId },
      data: { failedBidderIds: JSON.stringify(updatedFailedIds) },
    });
    await finalizeAuctionAsPaymentFailed(auctionId);
    return { outcome: "FINALIZED" };
  }

  // Excludes: seller, eerder gefailde bidders, eerder declined/expired offers
  const excludeIds = new Set<string>([auction.sellerId, ...updatedFailedIds]);
  const previousOffers = await prisma.auctionRunnerUpOffer.findMany({
    where: { auctionId, status: { in: ["DECLINED", "EXPIRED"] } },
    select: { bidderId: true },
  });
  for (const o of previousOffers) excludeIds.add(o.bidderId);

  const candidates = await prisma.auctionBid.findMany({
    where: { auctionId },
    orderBy: { amount: "desc" },
    select: { bidderId: true, amount: true, deliveryChoice: true },
  });

  let chosen: (typeof candidates)[number] | null = null;
  for (const c of candidates) {
    if (excludeIds.has(c.bidderId)) continue;
    const u = await prisma.user.findUnique({
      where: { id: c.bidderId },
      select: { suspendedUntil: true, suspensionType: true },
    });
    const isSuspended =
      u?.suspensionType === "PERMANENT" ||
      (u?.suspendedUntil != null && u.suspendedUntil > new Date());
    if (isSuspended) {
      excludeIds.add(c.bidderId);
      continue;
    }
    // Block-filter (audit-fix #3): skip bidders die de seller hebben geblokt
    // of door seller zijn geblokt (symmetrisch). Anders krijgt iemand een
    // offer voor een transactie die hij sowieso niet wil.
    const blocked = await getBlockedUserIds(c.bidderId);
    if (blocked.has(auction.sellerId)) {
      excludeIds.add(c.bidderId);
      continue;
    }
    chosen = c;
    break;
  }

  if (!chosen) {
    await prisma.auction.update({
      where: { id: auctionId },
      data: { failedBidderIds: JSON.stringify(updatedFailedIds) },
    });
    await finalizeAuctionAsPaymentFailed(auctionId);
    return { outcome: "FINALIZED" };
  }

  const decisionDeadline = new Date();
  decisionDeadline.setHours(decisionDeadline.getHours() + RUNNER_UP_DECISION_HOURS);
  const premiumAmount =
    Math.round(chosen.amount * AUCTION_BUYER_PREMIUM_RATE * 100) / 100;
  const offerDelivery: "SHIP" | "PICKUP" =
    auction.deliveryMethod === "PICKUP"
      ? "PICKUP"
      : auction.deliveryMethod === "SHIP"
        ? "SHIP"
        : (chosen.deliveryChoice as "SHIP" | "PICKUP" | null) === "PICKUP"
          ? "PICKUP"
          : "SHIP";

  // Audit-fix: race-safe via optimistic concurrency op `runnerUpAttempts`.
  // Twee parallelle invocations (bv. cron-expired + actieve decline) zouden
  // anders beide een offer kunnen maken voor dezelfde auction. We lezen
  // `auction.runnerUpAttempts` aan het begin en updaten conditional met
  // `WHERE runnerUpAttempts: <gelezen waarde>`. Eerste schrijver doet
  // increment naar +1; tweede ziet count=0 (waarde is al +1) → bail
  // zonder offer-create.
  const offer = await prisma.$transaction(async (tx) => {
    // Optimistic concurrency: alleen door als (runnerUpAttempts ongewijzigd
    // sinds onze read) AND (paymentStatus = AWAITING_RUNNER_UP_DECISION).
    // Tweede check voorkomt dat we een nieuw offer maken op een auction die
    // intussen is gefinaliseerd als PAYMENT_FAILED (bv. via no-candidate-pad
    // van een parallelle invocation).
    const claim = await tx.auction.updateMany({
      where: {
        id: auctionId,
        runnerUpAttempts: auction.runnerUpAttempts,
        paymentStatus: "AWAITING_RUNNER_UP_DECISION",
      },
      data: {
        winnerId: chosen.bidderId,
        finalPrice: chosen.amount,
        paymentStatus: "AWAITING_RUNNER_UP_DECISION",
        paymentDeadline: null,
        failedBidderIds: JSON.stringify(updatedFailedIds),
        runnerUpAttempts: { increment: 1 },
      },
    });
    if (claim.count === 0) {
      return null; // race verloren — andere flow heeft offer al aangemaakt of finalize
    }
    return tx.auctionRunnerUpOffer.create({
      data: {
        auctionId,
        bidderId: chosen.bidderId,
        bidAmount: chosen.amount,
        premiumAmount,
        deliveryChoice: offerDelivery,
        decisionDeadline,
      },
    });
  });
  if (!offer) {
    // Andere caller heeft al een offer aangemaakt; we gebruiken die staat.
    return { outcome: "FINALIZED" };
  }

  await createNotification(
    chosen.bidderId,
    "AUCTION_WON",
    "Aanbod om veiling over te nemen",
    `De vorige bieder heeft niet betaald op "${auction.title}". Wil jij het overnemen voor €${chosen.amount.toFixed(2)} (+ €${premiumAmount.toFixed(2)} veilingkosten)? Je hebt 72 uur om te beslissen.`,
    "/nl/dashboard/biedingen",
  );
  await createNotification(
    auction.sellerId,
    "ITEM_SOLD",
    "Veiling — wacht op reactie van bieder",
    `"${auction.title}" wordt aangeboden aan de volgende hoogste bieder voor €${chosen.amount.toFixed(2)}. We wachten 72 uur op reactie.`,
    `/nl/veilingen/${auctionId}`,
  );

  publish(userChannel(chosen.bidderId), {
    type: "auction-runner-up-offered",
    payload: {
      auctionId,
      auctionTitle: auction.title,
      bidAmount: chosen.amount,
      decisionDeadline: decisionDeadline.toISOString(),
    },
  });

  return { outcome: "OFFERED", newOfferId: offer.id, newBidderId: chosen.bidderId };
}

export const CRON_JOB_NAMES = [
  "auto-confirm",
  "auto-resolve-disputes",
  "auto-resolve-disputes-v2",
  "check-subscriptions",
  "expire-claims",
  "sync-pokewallet",
  "auction-finalize",
  "auction-activate",
  "claimsale-activate",
  "auction-payment-deadline",
  "auction-runner-up-decision-deadline",
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
  "cleanup-sold-images",
  "email-unread-messages",
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
  "auto-resolve-disputes-v2": {
    description:
      "Dispute v2 (Fase 40): OPEN-disputes waar verkoper >14d niet reageert → 100% refund + premium naar koper. SELLER_RESPONDED waar koper >14d niet reageert → escrow naar verkoper. Niet voor ESCALATED — die wachten op admin.",
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
  "auction-activate": {
    description:
      "Activeert SCHEDULED-veilingen waarvan startTime is bereikt (status flip naar ACTIVE + auction-started realtime event + bump van finalize-scheduler). Safety-net naast de in-process activator-scheduler die sub-seconde-nauwkeurig flipt. Race-safe via conditional updateMany — meermaals draaien is veilig.",
    schedule: "Elke minuut",
    allowManualRun: true,
  },
  "claimsale-activate": {
    description:
      "Activeert SCHEDULED-claimsales waarvan startTime is bereikt (status flip naar LIVE + claimsale-started realtime event). Safety-net naast de in-process claimsale-activator-scheduler die sub-seconde-nauwkeurig flipt. Race-safe via conditional updateMany — meermaals draaien is veilig.",
    schedule: "Elke minuut",
    allowManualRun: true,
  },
  "sync-pokewallet": {
    description:
      "Detecteert nieuwe PokeWallet-sets (maakt er CardSet-rijen voor aan onder een 'Onbekend'-Series), vult lege nieuwe sets met kaarten + afbeeldingen uit TCGdex, vernieuwt prijzen voor alle CardSets met een mapping, en mirrort tot 1500 nog niet gemirrorde kaartafbeeldingen + set-logo's naar R2 (weerbaarheid tegen TCGdex-storing; ~12 nachten tot de backfill klaar is, daarna alleen nieuwe kaarten). ~600 prijs-calls + tot ~3000 beeld-calls per pass.",
    schedule: "Dagelijks",
    allowManualRun: true,
    runWarning:
      "Heavy job: ~600 prijs-calls + tot ~3000 beeld-mirror-calls naar PokeWallet, kan 20-30 minuten duren. Raakt rate-limit-budget. Niet vaker dan 1× per uur draaien.",
  },
  "auction-payment-deadline": {
    description:
      "Verwerkt veilingen waarvan de 5-dagen betaaltermijn verlopen is: strike + 2,9%-fee + €200-borg op de wanbetaler (niet-inbare deel naar PendingPlatformFee). Daarna runner-up-aanbod (72u-window) of finaliseren als PAYMENT_FAILED.",
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "auction-runner-up-decision-deadline": {
    description:
      "Verwerkt AuctionRunnerUpOffers waarvan het 72u-beslissingsvenster verlopen is: status → EXPIRED, daarna probeer volgende kandidaat of finaliseer PAYMENT_FAILED. Geen straf voor de runner-up — het aanbod is een aanbod, geen verplichting.",
    schedule: "Per uur",
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
      `Vangnet: annuleert PAID SHIP-bundles die ${STALE_PAID_AUTO_CANCEL_AFTER_DAYS} dagen niet zijn verzonden én waar de koper zelf niet heeft ingegrepen (die mag vanaf dag ${STALE_PAID_SELLER_DEADLINE_DAYS} direct annuleren). Volledige refund naar koper, items terug op de markt, autoExpiredAt ingevuld zodat admin probleem-sellers kan filteren.`,
    schedule: "Elk uur (in-process order-maintenance-scheduler) + dagelijks extern",
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
  "cleanup-sold-images": {
    description:
      "Verwijdert 30 dagen na voltooide verkoop (deliveredAt) de geüploade foto-bestanden van die verkoop (R2/schijf) en maakt de DB-foto-velden leeg — alle tekstdata blijft. Slaat bestellingen met lopend geschil/ticket over. Idempotent via imagesPurgedAt. Gedeelde foto's (listing met restvoorraad, claimsale-cover) blijven tot ook die volledig klaar zijn.",
    schedule: "Dagelijks",
    allowManualRun: true,
  },
  "email-unread-messages": {
    description:
      "Mailt ontvangers van een chatbericht dat na 15 minuten nog ongelezen is (max 1 mail per ongelezen-episode per conversatie; respecteert e-mailvoorkeuren en alleen geverifieerde adressen). Ruimt ook EmailLog-rijen >90 dagen op. Draait primair in-process elke 5 min; deze route is safety-net + handmatige run.",
    schedule: "Elke 10 min",
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
  "auto-resolve-disputes-v2": async () => {
    const { autoResolveDisputesV2 } = await import("@/actions/dispute-v2");
    const r = await autoResolveDisputesV2();
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
    // Stap 1 — Set-catalogus: mapping verversen + nieuwe sets ontdekken
    let catalog: Awaited<ReturnType<typeof syncSetCatalog>> | null = null;
    let catalogError: string | null = null;
    try {
      catalog = await syncSetCatalog();
    } catch (e) {
      catalogError = (e as Error).message.slice(0, 200);
    }

    // Stap 1b — Kaarten aanmaken voor net-ontdekte (lege) gemapte sets.
    // discoverAndCreateNewSets() maakt alleen een lege set-shell; de prijs-sync
    // doet uitsluitend card.update (nooit create), dus zonder deze stap blijft
    // een nieuwe set eeuwig leeg. Bron = TCGdex (kaartlijst + afbeeldingen).
    // Na deze stap valt de set onder `cards: { some: {} }` en wordt 'ie meteen
    // in dezelfde run geprijsd.
    let populated: Awaited<ReturnType<typeof populateEmptyMappedSets>> | null = null;
    let populateError: string | null = null;
    try {
      populated = await populateEmptyMappedSets();
    } catch (e) {
      populateError = (e as Error).message.slice(0, 200);
    }

    // Stap 1c — Top-up voor groeiende sets (promo's + recente releases):
    // nieuwe kaarten aanvullen + imageUrl-refresh voor kaarten waarvan TCGdex
    // inmiddels wél een scan heeft. Idempotent, max 10 sets per run.
    let toppedUp: Awaited<ReturnType<typeof topUpGrowingSets>> | null = null;
    let topUpError: string | null = null;
    try {
      toppedUp = await topUpGrowingSets();
    } catch (e) {
      topUpError = (e as Error).message.slice(0, 200);
    }

    // Stap 2 — Prijs-sync per gemapte set met cards
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

    // Stap 2b — Beeld-mirror (PokeWallet → R2/schijf) voor kaarten/sets die nog
    // geen mirror-key hebben. Weerbaarheid tegen TCGdex-storing. Gecapt zodat de
    // dagelijkse job bounded blijft; de eenmalige bulk-lading doet
    // scripts/pw-mirror-images.ts. pokewalletId is in stap 2 al toegekend.
    // Incident-hardening (2026-07-07): DB-writes GEBUNDELD in $transactions van
    // 25 i.p.v. één update per item — minimale schrijfdruk op Turso.
    let mirror: { cards: number; logos: number; cardsFailed: number } | null = null;
    try {
      // 1500/nacht: hele backfill (~18k) in ~12 nachten, volledig autonoom op
      // Railway — geen lokale pc nodig. ~3000 beeld-calls + ~600 prijs-calls per
      // nacht = ruim onder de PokeWallet-limiet van 5000/uur; fetchBinary heeft
      // 429-backoff als vangnet. Na de backfill pakt deze stap alleen nog
      // nieuwe kaarten (paar per week).
      const MIRROR_CARDS_PER_RUN = 1500;
      const MIRROR_WRITE_BATCH = 25;
      const cardsToMirror = await prisma.card.findMany({
        where: { pokewalletId: { not: null }, imageMirrorKey: null },
        select: { id: true, pokewalletId: true },
        orderBy: { id: "asc" },
        take: MIRROR_CARDS_PER_RUN,
      });
      let cardsFailed = 0;
      const doneCards: { id: string; stem: string }[] = [];
      await mapPaced(
        cardsToMirror,
        async (c) => {
          const stem = await mirrorCardImage(c);
          if (stem) doneCards.push({ id: c.id, stem });
          else cardsFailed++;
        },
        { concurrency: 2, sleepMs: 400 },
      );
      for (let i = 0; i < doneCards.length; i += MIRROR_WRITE_BATCH) {
        const batch = doneCards.slice(i, i + MIRROR_WRITE_BATCH);
        await prisma.$transaction(
          batch.map((d) =>
            prisma.card.update({ where: { id: d.id }, data: { imageMirrorKey: d.stem } }),
          ),
        );
      }

      const setsToMirror = await prisma.cardSet.findMany({
        where: { pokewalletSetId: { not: null }, logoMirrorKey: null },
        select: { id: true, pokewalletSetId: true },
      });
      const doneLogos: { id: string; stem: string }[] = [];
      await mapPaced(
        setsToMirror,
        async (s) => {
          const stem = await mirrorSetLogo(s);
          if (stem) doneLogos.push({ id: s.id, stem });
        },
        { concurrency: 2, sleepMs: 400 },
      );
      for (let i = 0; i < doneLogos.length; i += MIRROR_WRITE_BATCH) {
        const batch = doneLogos.slice(i, i + MIRROR_WRITE_BATCH);
        await prisma.$transaction(
          batch.map((d) =>
            prisma.cardSet.update({ where: { id: d.id }, data: { logoMirrorKey: d.stem } }),
          ),
        );
      }
      mirror = { cards: doneCards.length, logos: doneLogos.length, cardsFailed };
    } catch (e) {
      failures.push({ setName: "(image-mirror)", error: (e as Error).message.slice(0, 200) });
    }

    // TCGdex CardMarket-fallback voor kaarten die PokeWallet niet kan prijzen.
    // NA de PW-sync zodat lege PW-prijzen deze niet overschrijven. Match op
    // exacte kaart-id (= TCGdex-id) → variant-veilig.
    let tcgdexFallback: Awaited<ReturnType<typeof backfillTcgdexPricing>> | null = null;
    try {
      tcgdexFallback = await backfillTcgdexPricing();
    } catch (e) {
      failures.push({ setName: "(tcgdex-fallback)", error: (e as Error).message.slice(0, 200) });
    }

    return {
      itemsProcessed:
        totalUpdated +
        (tcgdexFallback?.priced ?? 0) +
        (mirror ? mirror.cards + mirror.logos : 0),
      result: {
        mirror,
        tcgdexFallback: tcgdexFallback
          ? { checked: tcgdexFallback.checked, priced: tcgdexFallback.priced }
          : null,
        catalog: catalog
          ? {
              mapped: catalog.matched,
              mappedTotal: catalog.total,
              duplicates: catalog.duplicates.length,
              unmatched: catalog.unmatched.length,
              createdCount: catalog.created.length,
              createdSets: catalog.created.slice(0, 20).map((s) => ({ name: s.name, pokewalletSetId: s.pokewalletSetId })),
              needsReviewCount: catalog.needsReview.length,
              needsReview: catalog.needsReview.slice(0, 20),
            }
          : { error: catalogError },
        populate: populated
          ? {
              setsPopulated: populated.populated.filter((p) => p.created > 0).length,
              cardsCreated: populated.populated.reduce((sum, p) => sum + p.created, 0),
              details: populated.populated.slice(0, 20),
            }
          : { error: populateError },
        topUp: toppedUp
          ? {
              setsToppedUp: toppedUp.toppedUp.length,
              cardsCreated: toppedUp.toppedUp.reduce((sum, p) => sum + p.created, 0),
              details: toppedUp.toppedUp.slice(0, 20),
            }
          : { error: topUpError },
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
  "auction-activate": async () => {
    const now = new Date();
    const due = await prisma.auction.findMany({
      where: { status: "SCHEDULED", startTime: { lte: now } },
      select: { id: true },
      take: 200,
    });

    let activated = 0;
    let errors = 0;
    for (const a of due) {
      try {
        // Race-safe: alleen flippen als nog SCHEDULED. Voorkomt dubbele
        // events bij gelijktijdige in-process scheduler-fire.
        const claim = await prisma.auction.updateMany({
          where: { id: a.id, status: "SCHEDULED" },
          data: { status: "ACTIVE" },
        });
        if (claim.count > 0) {
          publish(auctionChannel(a.id), { type: "auction-started", payload: { auctionId: a.id } });
          activated++;
        }
      } catch {
        errors++;
      }
    }

    if (activated > 0) {
      try {
        const { scheduleNextAuctionFinalize } = await import("@/lib/auction-scheduler");
        await scheduleNextAuctionFinalize("post-activate-cron");
      } catch (err) {
        console.error("[auction-activate] finalize-scheduler bump failed", err);
      }
    }

    return { itemsProcessed: activated, result: { activated, errors, total: due.length } };
  },
  "claimsale-activate": async () => {
    const now = new Date();
    const due = await prisma.claimsale.findMany({
      where: { status: "SCHEDULED", startTime: { lte: now } },
      select: { id: true },
      take: 200,
    });

    let activated = 0;
    let errors = 0;
    for (const c of due) {
      try {
        // Race-safe: alleen flippen als nog SCHEDULED. Voorkomt dubbele
        // events bij gelijktijdige in-process scheduler-fire.
        const claim = await prisma.claimsale.updateMany({
          where: { id: c.id, status: "SCHEDULED" },
          data: { status: "LIVE" },
        });
        if (claim.count > 0) {
          publish(claimsaleChannel(c.id), {
            type: "claimsale-started",
            payload: { claimsaleId: c.id },
          });
          activated++;
        }
      } catch {
        errors++;
      }
    }

    return { itemsProcessed: activated, result: { activated, errors, total: due.length } };
  },
  "auction-payment-deadline": async () => {
    const now = new Date();
    const expiredAuctions = await prisma.auction.findMany({
      where: { paymentStatus: "AWAITING_PAYMENT", paymentDeadline: { lt: now } },
    });

    let processed = 0;
    let rotated = 0;
    let finalized = 0;

    for (const auction of expiredAuctions) {
      if (!auction.winnerId || !auction.finalPrice) continue;

      const previousWinnerId = auction.winnerId;
      const previousWinnerTitle = auction.title;
      const previousWinnerPrice = auction.finalPrice;

      // Audit-fix: race-safe pre-emptive claim. Voorheen was er een passive
      // race-guard (`fresh.paymentStatus === "AWAITING_PAYMENT"`) die NIET
      // race-veilig was — tussen de check en de strike-tx kon
      // completeAuctionPayment betalen waarna wanbetaler toch een strike +
      // 2,9% boete kreeg op een succesvol betaalde veiling.
      //
      // Nu: atomic `updateMany` flipt status naar AWAITING_RUNNER_UP_DECISION
      // alleen als hij nog AWAITING_PAYMENT was. Bij count=0 heeft een andere
      // flow (typisch completeAuctionPayment) de auction al gepakt — skip.
      // completeAuctionPayment doet z'n eigen conditional flip naar PAID met
      // dezelfde where-clause; één van beiden wint.
      const claim = await prisma.auction.updateMany({
        where: {
          id: auction.id,
          paymentStatus: "AWAITING_PAYMENT",
          paymentDeadline: { lt: now },
        },
        data: { paymentStatus: "AWAITING_RUNNER_UP_DECISION" },
      });
      if (claim.count === 0) {
        continue;
      }

      // Strike + fee + forfait op wanbetaler. Niet-inbare deel naar
      // PendingPlatformFee zodat het bij volgende inkomst wordt afgeroomd.
      const isHighBid = previousWinnerPrice >= VERIFIED_BID_THRESHOLD;
      const wanbetaler = await prisma.user.findUnique({
        where: { id: previousWinnerId },
        select: { balance: true },
      });

      let forfeitCharged = 0;
      let forfeitShortfall = 0;
      let feeCharged = 0;
      let feeShortfall = 0;
      const forfeitTarget = isHighBid ? BID_FORFEIT_AMOUNT : 0;
      const feeTarget = Math.round(previousWinnerPrice * PAYMENT_FAILURE_FEE_RATE * 100) / 100;

      if (wanbetaler) {
        const startBalance = Math.max(wanbetaler.balance, 0);
        forfeitCharged = Math.min(forfeitTarget, startBalance);
        forfeitShortfall = Math.max(forfeitTarget - forfeitCharged, 0);
        const balanceAfterForfeit = wanbetaler.balance - forfeitCharged;
        feeCharged = Math.min(feeTarget, Math.max(balanceAfterForfeit, 0));
        feeShortfall = Math.max(feeTarget - feeCharged, 0);
        const balanceAfterFee = balanceAfterForfeit - feeCharged;

        if (forfeitCharged > 0 || feeCharged > 0 || forfeitShortfall > 0 || feeShortfall > 0) {
          await prisma.$transaction(async (tx) => {
            if (forfeitCharged > 0 || feeCharged > 0) {
              await tx.user.update({
                where: { id: previousWinnerId },
                data: { balance: balanceAfterFee },
              });
            }
            if (forfeitCharged > 0) {
              await tx.transaction.create({
                data: {
                  userId: previousWinnerId,
                  type: "BID_DEPOSIT_FORFEIT",
                  amount: -forfeitCharged,
                  balanceBefore: wanbetaler.balance,
                  balanceAfter: balanceAfterForfeit,
                  description: `Borg verbeurd: niet betaald op veiling "${previousWinnerTitle}"`,
                  relatedAuctionId: auction.id,
                },
              });
            }
            if (feeCharged > 0) {
              await tx.transaction.create({
                data: {
                  userId: previousWinnerId,
                  type: "BID_PAYMENT_FAILURE_FEE",
                  amount: -feeCharged,
                  balanceBefore: balanceAfterForfeit,
                  balanceAfter: balanceAfterFee,
                  description: `Veilingkosten ${(PAYMENT_FAILURE_FEE_RATE * 100).toFixed(1).replace(/\.0$/, "")}% wegens niet-betaling: "${previousWinnerTitle}"`,
                  relatedAuctionId: auction.id,
                },
              });
            }
            // Niet-inbare deel als PendingPlatformFee — wordt bij volgende
            // inkomst van de wanbetaler automatisch afgeroomd.
            if (forfeitShortfall > 0) {
              await recordPendingFeeInTx(tx, {
                userId: previousWinnerId,
                type: "BID_DEPOSIT_FORFEIT",
                shortfallAmount: forfeitShortfall,
                originalAmount: forfeitTarget,
                description: `Borg verbeurd: niet betaald op veiling "${previousWinnerTitle}"`,
                relatedAuctionId: auction.id,
              });
            }
            if (feeShortfall > 0) {
              await recordPendingFeeInTx(tx, {
                userId: previousWinnerId,
                type: "BID_PAYMENT_FAILURE_FEE",
                shortfallAmount: feeShortfall,
                originalAmount: feeTarget,
                description: `Veilingkosten ${(PAYMENT_FAILURE_FEE_RATE * 100).toFixed(1).replace(/\.0$/, "")}%: niet betaald op veiling "${previousWinnerTitle}"`,
                relatedAuctionId: auction.id,
              });
            }
          });
        }
      }

      // Strike +1 + auto-suspend bij thresholds
      const updatedUser = await prisma.user.update({
        where: { id: previousWinnerId },
        data: {
          paymentFailureCount: { increment: 1 },
          paymentFailureLastAt: new Date(),
        },
        select: { paymentFailureCount: true },
      });

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

      // PENDING-bundle van wanbetaler opruimen (raceguard: alleen als nog PENDING)
      const failedBundle = await prisma.shippingBundle.findUnique({ where: { auctionId: auction.id } });
      if (failedBundle && failedBundle.status === "PENDING") {
        await prisma.shippingBundle.delete({ where: { id: failedBundle.id } });
      }

      // Reserve op vorige winner laten vrijvallen
      await syncReservedBalance(previousWinnerId);
      publish(userChannel(previousWinnerId), { type: "balance-changed", payload: {} });

      // Notify wanbetaler met breakdown (incl. shortfall-melding)
      const breakdownParts: string[] = [];
      if (forfeitCharged > 0) breakdownParts.push(`borg €${forfeitCharged.toFixed(2)}`);
      if (feeCharged > 0) breakdownParts.push(`veilingkosten €${feeCharged.toFixed(2)}`);
      const shortfallTotal = forfeitShortfall + feeShortfall;
      const breakdownText = breakdownParts.length > 0
        ? ` Ingehouden: ${breakdownParts.join(" + ")} = €${(forfeitCharged + feeCharged).toFixed(2)}.`
        : "";
      const shortfallText = shortfallTotal > 0
        ? ` Open schuld: €${shortfallTotal.toFixed(2)} (wordt verrekend bij je volgende inkomst).`
        : "";
      const strikeText = ` Je staat nu op ${updatedUser.paymentFailureCount} wanbetaling${updatedUser.paymentFailureCount === 1 ? "" : "en"}.`;
      await createNotification(
        previousWinnerId,
        "AUCTION_WON",
        "Betaaltermijn verlopen",
        `De betaaltermijn voor "${previousWinnerTitle}" (€${previousWinnerPrice.toFixed(2)}) is verlopen.${breakdownText}${shortfallText}${strikeText}`,
        `/nl/veilingen/${auction.id}`,
      );

      // Probeer de volgende kandidaat — geeft of een 72u-offer of finaliseert PAYMENT_FAILED
      const decision = await processRunnerUpDecision(auction.id, previousWinnerId);
      if (decision.outcome === "OFFERED") rotated++;
      else finalized++;

      processed++;
    }

    return { itemsProcessed: processed, result: { processed, rotated, finalized, total: expiredAuctions.length } };
  },
  "auction-runner-up-decision-deadline": async () => {
    const now = new Date();
    const expiredOffers = await prisma.auctionRunnerUpOffer.findMany({
      where: { status: "AWAITING_DECISION", decisionDeadline: { lt: now } },
      include: { auction: { select: { id: true, title: true, sellerId: true, paymentStatus: true } } },
    });

    let processed = 0;
    let advanced = 0;

    for (const offer of expiredOffers) {
      // Race-guard: als auction al PAYMENT_FAILED of PAID is, skip.
      if (
        !offer.auction ||
        offer.auction.paymentStatus === "PAID" ||
        offer.auction.paymentStatus === "PAYMENT_FAILED"
      ) {
        continue;
      }

      await prisma.auctionRunnerUpOffer.update({
        where: { id: offer.id },
        data: { status: "EXPIRED", decidedAt: now },
      });

      // Notify bidder dat hun window verlopen is — geen straf
      await createNotification(
        offer.bidderId,
        "AUCTION_WON",
        "Aanbod verlopen",
        `Je hebt niet binnen 72 uur gereageerd op het aanbod voor "${offer.auction.title}". Het aanbod is automatisch ingetrokken.`,
        `/nl/veilingen/${offer.auctionId}`,
      );

      publish(userChannel(offer.bidderId), {
        type: "auction-runner-up-decided",
        payload: { auctionId: offer.auctionId, status: "EXPIRED" },
      });
      publish(userChannel(offer.auction.sellerId), {
        type: "auction-runner-up-decided",
        payload: { auctionId: offer.auctionId, status: "EXPIRED" },
      });

      const decision = await processRunnerUpDecision(offer.auctionId, offer.bidderId);
      if (decision.outcome === "OFFERED") advanced++;
      processed++;
    }

    return { itemsProcessed: processed, result: { processed, advanced, total: expiredOffers.length } };
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
        shippingBundle: { select: { id: true, orderNumber: true, buyerId: true, sellerId: true, status: true, shippedAt: true } },
      },
    });
    let processed = 0;
    let escalated = 0;
    for (const r of expired) {
      // Claim-first (race-safe, Fase 44): markeer alleen EXPIRED als het
      // verzoek nú nog PENDING is. Sinds de in-process order-maintenance-
      // scheduler kan deze job overlappen met de route of een gelijktijdige
      // respondToCancellation — de verliezer slaat over, zodat er nooit een
      // dubbel ShippingIssue-ticket of dubbele notificatie ontstaat.
      const claim = await prisma.cancellationRequest.updateMany({
        where: { id: r.id, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      if (claim.count === 0) continue;

      // (Fase 40) PAID-bundles waar EXPIRED-cancel niet beantwoord werd én
      // er nog GEEN shipping is, krijgen automatisch een ShippingIssue ticket
      // zodat de bundle niet stil blijft hangen tot de auto-cancel-stale-paid
      // cron 14d later iets doet. Geen ticket voor SHIPPED-bundles — daar
      // gelden andere flows (dispute/tracking).
      const shouldEscalate =
        r.shippingBundle.status === "PAID" &&
        !r.shippingBundle.shippedAt;

      if (shouldEscalate) {
        const issue = await prisma.shippingIssue.create({
          data: {
            bundleId: r.shippingBundle.id,
            reporterId: r.proposedById,
            type: "TRACKING_STUCK",
            description: `Auto-geëscaleerd: annuleringsverzoek voor bestelling ${r.shippingBundle.orderNumber} is na 7 dagen verlopen zonder reactie van de wederpartij. De verkoper heeft (nog) niet verzonden.`,
            status: "OPEN",
          },
        });
        await prisma.cancellationRequest.update({
          where: { id: r.id },
          data: { escalatedShippingIssueId: issue.id },
        });
        escalated++;
      }

      await createNotification(
        r.proposedById,
        "NEW_MESSAGE",
        shouldEscalate ? "Annuleringsverzoek verlopen — admin onderzoekt" : "Annuleringsverzoek verlopen",
        shouldEscalate
          ? `Je annuleringsverzoek voor bestelling ${r.shippingBundle.orderNumber} is verlopen. We hebben een trackingticket geopend zodat admin het probleem onderzoekt.`
          : `Je annuleringsverzoek voor bestelling ${r.shippingBundle.orderNumber} is verlopen omdat de wederpartij niet heeft gereageerd. De bestelling staat nog open.`,
        "/dashboard/aankopen",
      );

      // Real-time: beide partijen zien PENDING-marker verdwijnen op /aankopen + /verkopen
      for (const uid of [r.shippingBundle.buyerId, r.shippingBundle.sellerId]) {
        publish(userChannel(uid), {
          type: "bundle-changed",
          payload: { bundleId: r.shippingBundle.id, status: r.shippingBundle.status },
        });
      }
      processed++;
    }
    return { itemsProcessed: processed, result: { processed, escalated, total: expired.length } };
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
    // Vangnet-fase van de stale-order-flow (Fase 44): de koper mag vanaf dag
    // 14 zelf direct annuleren (cancelOverdueOrder in cancellation.ts); doet
    // 'ie dat 7 dagen lang niet, dan annuleert deze cron alsnog automatisch
    // op dag 21. Symmetrisch met auction-payment-deadline: ene partij voldoet
    // niet aan z'n verplichting → andere partij wint automatisch.
    const cutoff = new Date(Date.now() - STALE_PAID_AUTO_CANCEL_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const stale = await prisma.shippingBundle.findMany({
      where: {
        status: "PAID",
        deliveryMethod: "SHIP",
        shippedAt: null,
        createdAt: { lt: cutoff },
        cancellationRequests: { none: { status: "PENDING" } },
      },
      select: { id: true, orderNumber: true },
    });

    let processed = 0;
    let failed = 0;
    for (const b of stale) {
      try {
        const result = await executeStalePaidCancel(b.id, "auto");
        if ("ok" in result) processed++;
      } catch (err) {
        // Per-bundle isoleren: één kapotte bundle mag de rest van de batch
        // niet blokkeren. LUID loggen — als dit ná de claim gebeurt staat de
        // bundle CANCELLED zonder (volledige) refund en moet een admin de
        // refund handmatig herstellen via het admin-panel.
        failed++;
        console.error(
          `[auto-cancel-stale-paid] KRITIEK: bundle ${b.orderNumber} (${b.id}) faalde na mogelijke claim — controleer refund handmatig:`,
          err,
        );
      }
    }

    return { itemsProcessed: processed, result: { processed, failed, total: stale.length } };
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
  "cleanup-sold-images": async () => {
    // 30 dagen ná voltooide verkoop (deliveredAt) verwijderen we de geüploade
    // foto-BESTANDEN van die verkoop (R2/schijf) en legen we de DB-foto-velden.
    // Alle tekstdata blijft. Idempotent via imagesPurgedAt; geschil-veilig
    // (skip lopende disputes/tickets, anders gooien we bewijs weg). Bewust 30d
    // ná deliveredAt (niet ná verzending): voorbij zowel de 30d refund-window
    // als het 10-30d geschil-venster.
    const cutoff = new Date(Date.now() - CLEANUP_SOLD_IMAGES_DAYS * 24 * 60 * 60 * 1000);
    const bundles = await prisma.shippingBundle.findMany({
      where: {
        status: "COMPLETED",
        deliveredAt: { lte: cutoff },
        imagesPurgedAt: null,
        dispute: null,
        disputeV2: null,
        shippingIssues: { none: { status: { in: ["OPEN", "INVESTIGATING"] } } },
      },
      select: {
        id: true,
        shippingProofUrls: true,
        auctionId: true,
        auction: { select: { imageUrls: true } },
        listing: { select: { id: true, status: true, imageUrls: true } },
        bundleListings: {
          select: { listing: { select: { id: true, status: true, imageUrls: true } } },
        },
        items: { select: { id: true, imageUrls: true, claimsaleId: true } },
      },
    });

    // Een listing-foto mag alleen weg als de listing volledig klaar is: status
    // SOLD én geen resterende voorraad (stocked/MULTI_CARD kan andere lopende
    // bundles hebben die dezelfde imageUrls delen).
    async function listingFullyDone(listingId: string, status: string): Promise<boolean> {
      if (status !== "SOLD") return false;
      const blocking = await prisma.listingCardItem.count({
        where: { listingId, status: { in: ["AVAILABLE", "RESERVED"] } },
      });
      return blocking === 0;
    }

    let processed = 0;
    let filesDeleted = 0;

    for (const b of bundles) {
      const filesToDelete: string[] = [];
      const listingIdsToClear: string[] = [];
      const claimsaleItemIdsToClear: string[] = [];
      const claimsaleCoverIdsToClear: string[] = [];
      let clearShippingProof = false;
      let clearAuction = false;

      // 1. Shipping-proof (per-bundle, altijd veilig)
      const proof = parseImageUrls(b.shippingProofUrls);
      if (proof.length > 0) {
        filesToDelete.push(...proof);
        clearShippingProof = true;
      }

      // 2. Auction (1:1 met de bundle)
      if (b.auctionId && b.auction) {
        const imgs = parseImageUrls(b.auction.imageUrls);
        if (imgs.length > 0) {
          filesToDelete.push(...imgs);
          clearAuction = true;
        }
      }

      // 3. Losse listing
      if (b.listing && (await listingFullyDone(b.listing.id, b.listing.status))) {
        const imgs = parseImageUrls(b.listing.imageUrls);
        if (imgs.length > 0) {
          filesToDelete.push(...imgs);
          listingIdsToClear.push(b.listing.id);
        }
      }

      // 4. Multi-listing bundle
      for (const bl of b.bundleListings) {
        if (await listingFullyDone(bl.listing.id, bl.listing.status)) {
          const imgs = parseImageUrls(bl.listing.imageUrls);
          if (imgs.length > 0) {
            filesToDelete.push(...imgs);
            listingIdsToClear.push(bl.listing.id);
          }
        }
      }

      // 5. Claimsale-items (elk 1:1 met buyer/bundle)
      for (const it of b.items) {
        const imgs = parseImageUrls(it.imageUrls);
        if (imgs.length > 0) {
          filesToDelete.push(...imgs);
          claimsaleItemIdsToClear.push(it.id);
        }
      }

      // 6. Claimsale coverImage — GEDEELD: alleen weg als de hele claimsale
      // CLOSED is en geen items meer AVAILABLE/CLAIMED zijn.
      const claimsaleIds = [...new Set(b.items.map((i) => i.claimsaleId))];
      for (const csId of claimsaleIds) {
        const cs = await prisma.claimsale.findUnique({
          where: { id: csId },
          select: {
            id: true,
            status: true,
            coverImage: true,
            items: {
              where: { status: { in: ["AVAILABLE", "CLAIMED"] } },
              select: { id: true },
              take: 1,
            },
          },
        });
        if (cs && cs.status === "CLOSED" && cs.items.length === 0 && cs.coverImage) {
          filesToDelete.push(cs.coverImage);
          claimsaleCoverIdsToClear.push(cs.id);
        }
      }

      // Bestanden verwijderen (best-effort, buiten tx). deleteUploadedFile is
      // niet-throwend + no-op op externe/seed-URLs.
      for (const url of filesToDelete) {
        if (await deleteUploadedFile(url)) filesDeleted++;
      }

      // DB-velden leegmaken + marker zetten in één tx. imagesPurgedAt pas ná
      // de DB-update → bij een gefaalde bestand-delete hooguit een wees-bestand
      // (gelogd), nooit een inconsistente state.
      await prisma.$transaction(async (tx) => {
        if (clearShippingProof) {
          await tx.shippingBundle.update({ where: { id: b.id }, data: { shippingProofUrls: null } });
        }
        if (clearAuction && b.auctionId) {
          await tx.auction.update({ where: { id: b.auctionId }, data: { imageUrls: "[]" } });
        }
        for (const lid of listingIdsToClear) {
          await tx.listing.update({ where: { id: lid }, data: { imageUrls: "[]" } });
        }
        for (const iid of claimsaleItemIdsToClear) {
          await tx.claimsaleItem.update({ where: { id: iid }, data: { imageUrls: "[]" } });
        }
        for (const cid of claimsaleCoverIdsToClear) {
          await tx.claimsale.update({ where: { id: cid }, data: { coverImage: null } });
        }
        await tx.shippingBundle.update({ where: { id: b.id }, data: { imagesPurgedAt: new Date() } });
      });

      processed++;
    }

    return { itemsProcessed: processed, result: { processed, total: bundles.length, filesDeleted } };
  },
  "email-unread-messages": async () => {
    const { sendUnreadChatEmails } = await import("@/lib/email/unread-chat-emails");
    const r = await sendUnreadChatEmails();
    return { itemsProcessed: r.emailsSent, result: r };
  },
};

/**
 * Gedeelde executor voor het annuleren van een stale PAID-bundle (Fase 44).
 * Twee callers met dezelfde side-effects maar eigen bewoording:
 *   - "buyer": de koper drukt vanaf dag 14 zelf op "Annuleer nu met
 *     terugbetaling" (cancelOverdueOrder in src/actions/cancellation.ts)
 *   - "auto":  de cron-vangnet op dag 21 als de koper niets deed
 *
 * Race-safe via claim-first updateMany (status PAID + shippedAt null):
 * overlappende runs (knop + scheduler + route + externe cron) kunnen nooit
 * dubbel refunden; een gelijktijdige markAsShipped wint terecht.
 * autoExpiredAt wordt in beide gevallen gezet — de admin-pagina
 * seller-warnings herkent daarmee sellers die hun leverplicht schonden.
 */
export async function executeStalePaidCancel(
  bundleId: string,
  initiatedBy: "auto" | "buyer",
): Promise<{ ok: true; refundAmount: number } | { error: string }> {
  const b = await prisma.shippingBundle.findUnique({
    where: { id: bundleId },
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
  if (!b) return { error: "Bestelling niet gevonden" };

  // Claim-first: flip alleen als de bundle nú nog PAID + onverzonden is.
  const claim = await prisma.shippingBundle.updateMany({
    where: { id: b.id, status: "PAID", shippedAt: null },
    data: { status: "CANCELLED", autoExpiredAt: new Date() },
  });
  if (claim.count === 0) {
    return { error: "Deze bestelling is inmiddels verzonden of al geannuleerd." };
  }

  // Open mutual-verzoeken vervallen — de directe/automatische annulering
  // vervangt ze (anders zou respondToCancellation op een CANCELLED bundle
  // kunnen refunden).
  await prisma.cancellationRequest.updateMany({
    where: { shippingBundleId: b.id, status: "PENDING" },
    data: { status: "EXPIRED" },
  });

  const refundAmount = Math.max(0, b.totalCost - b.refundedAmount);

  // Refund + heldBalance-decrement (alles in escrow sinds Fase 28-escrow-fix)
  await refundEscrow(
    b.sellerId,
    b.buyerId,
    refundAmount,
    refundAmount,
    initiatedBy === "buyer"
      ? `Geannuleerd door koper: verkoper verzond niet binnen ${STALE_PAID_SELLER_DEADLINE_DAYS} dagen (bestelling ${b.orderNumber})`
      : `Automatisch geannuleerd na ${STALE_PAID_AUTO_CANCEL_AFTER_DAYS} dagen zonder verzending: bestelling ${b.orderNumber}`,
    b.id,
  );

  // Auction-bundles: buyer's premium ook terugbetalen (Fase 31). De bundle
  // ging niet door, dus de platform-fee hoort niet bij ons te blijven.
  // refundAuctionPremium is idempotent (AUCTION_PREMIUM_REFUND-check).
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

  // Notificaties — koper positief, verkoper waarschuwing
  if (initiatedBy === "buyer") {
    await createNotification(
      b.buyerId,
      "ORDER_CANCELLED",
      "Bestelling geannuleerd",
      `Je hebt bestelling ${b.orderNumber} geannuleerd omdat de verkoper niet binnen ${STALE_PAID_SELLER_DEADLINE_DAYS} dagen heeft verzonden. Het volledige bedrag (€${refundAmount.toFixed(2)}) is teruggestort op je saldo.`,
      "/dashboard/aankopen",
    );
    await createNotification(
      b.sellerId,
      "ORDER_CANCELLED",
      "Bestelling geannuleerd door koper",
      `De koper heeft bestelling ${b.orderNumber} geannuleerd omdat je niet binnen ${STALE_PAID_SELLER_DEADLINE_DAYS} dagen hebt verzonden. Het bedrag is volledig terugbetaald. Herhaaldelijk niet-verzenden kan leiden tot account-suspensie.`,
      "/dashboard/verkopen",
    );
  } else {
    await createNotification(
      b.buyerId,
      "ORDER_CANCELLED",
      "Bestelling automatisch geannuleerd",
      `De verkoper heeft bestelling ${b.orderNumber} niet binnen ${STALE_PAID_SELLER_DEADLINE_DAYS} dagen verzonden. Het volledige bedrag (€${refundAmount.toFixed(2)}) is teruggestort op je saldo.`,
      "/dashboard/aankopen",
    );
    await createNotification(
      b.sellerId,
      "ORDER_CANCELLED",
      "Bestelling automatisch geannuleerd",
      `Bestelling ${b.orderNumber} is automatisch geannuleerd omdat je niet binnen ${STALE_PAID_SELLER_DEADLINE_DAYS} dagen hebt verzonden. Herhaaldelijk niet-verzenden kan leiden tot account-suspensie.`,
      "/dashboard/verkopen",
    );
  }

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

  return { ok: true, refundAmount };
}
