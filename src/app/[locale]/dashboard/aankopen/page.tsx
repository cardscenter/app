import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { PurchasesContent } from "@/components/dashboard/purchases-content";
import { ActivePickupsSection } from "@/components/dashboard/active-pickups-section";

// Groepeer items met dezelfde cardName + conditie tot één rij met aantal +
// subtotaal. Voor stocked-buy ("5× Destined Rivals booster pack") en voor
// partial-sale waarbij dezelfde kaart vaker voorkomt. Items met unieke
// namen blijven elk een eigen rij.
type RawItem = {
  id: string;
  cardName: string;
  condition: string;
  price: number;
  imageUrl: string | null;
  reference: string | null;
  sellerNote: string | null;
  refundedAt: string | null;
};
function groupBundleItems(items: RawItem[]) {
  const groups = new Map<string, RawItem & { quantity: number; subtotal: number }>();
  for (const it of items) {
    // Refunded items niet meegroeperen met niet-refunded "zelfde" items —
    // anders zien koper/verkoper niet dat 2 van de 5 boosters al refund zijn.
    const key = `${it.cardName}|${it.condition}|${it.refundedAt ? "R" : "A"}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.subtotal += it.price;
    } else {
      groups.set(key, { ...it, quantity: 1, subtotal: it.price });
    }
  }
  return Array.from(groups.values());
}

export default async function MyPurchasesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("purchases");
  const userId = session.user.id;

  // Veilingen die wachten op restbetaling (Fase 27.93). Treedt op bij Nu-Kopen
  // of Auction-Win met partial-balance (15-99% sinds Fase 29): de winner heeft
  // een 5d payment-deadline. Voorheen alleen zichtbaar op /dashboard/saldo, wat
  // verwarrend was — koper verwacht 'm bij /aankopen.
  const pendingAuctions = await prisma.auction.findMany({
    where: { winnerId: userId, paymentStatus: "AWAITING_PAYMENT" },
    select: { id: true, title: true, finalPrice: true, paymentDeadline: true },
  });

  // Balance voor de payment-modal breakdown (Fase 27.99).
  const userBal = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true, reservedBalance: true },
  });
  const availableBalance = Math.max(0, (userBal?.balance ?? 0) - (userBal?.reservedBalance ?? 0));
  const reservedBalance = userBal?.reservedBalance ?? 0;

  const bundles = await prisma.shippingBundle.findMany({
    where: {
      buyerId: userId,
      // PENDING bundles uitsluiten BEHALVE EXTERNAL pickup-reserveringen.
      // Die staan in afspreek-fase en moeten zichtbaar zijn in de top-sectie
      // (ActivePickupsSection). Andere PENDING bundles (auction awaiting
      // payment, etc.) hebben hun eigen flows en worden hier overgeslagen.
      OR: [
        { status: { not: "PENDING" } },
        {
          AND: [
            { status: "PENDING" },
            { paymentMode: "EXTERNAL" },
            { deliveryMethod: "PICKUP" },
          ],
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      seller: { select: { id: true, displayName: true } },
      shippingMethod: { select: { carrier: true, serviceName: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cardName: true,
          condition: true,
          price: true,
          imageUrls: true,
          reference: true,
          sellerNote: true,
          refundedAt: true,
        },
      },
      auction: {
        select: { id: true, title: true, imageUrls: true, finalPrice: true },
      },
      listing: {
        select: { id: true, title: true, imageUrls: true, price: true },
      },
      bundleListings: {
        include: {
          listing: { select: { id: true, title: true, imageUrls: true, condition: true } },
        },
      },
      // ListingCardItem-rijen voor stocked-buy en partial-sale flows.
      // Bundle.listingId is bij die flows null; items linken via
      // shippingBundleId op cardItem-niveau (Fase 27.13 + 27.23).
      cardItems: {
        include: {
          listing: { select: { id: true, title: true, imageUrls: true, price: true } },
        },
      },
      // Voor de "Lopende annuleringsverzoeken"-sectie: we hoeven alleen
      // de bundles te tonen waar daadwerkelijk een actief PENDING verzoek
      // op staat. Een lege array betekent geen actieve cancellation-flow.
      cancellationRequests: {
        where: { status: "PENDING" },
        select: { id: true },
      },
      // Pickup-schedule: voor SCHEDULED bundles met ACCEPTED schedule tonen
      // we de code prominent in een aparte sectie bovenaan zodat de koper
      // hem niet uit de chat hoeft te zoeken.
      pickupSchedule: {
        select: {
          status: true,
          pickupCode: true,
          proposedFor: true,
          windowStart: true,
          windowEnd: true,
        },
      },
      // Bundle-proposal voor conversation-link in pickup-sectie chat-knop.
      bundleProposal: { select: { conversationId: true } },
    },
  });

  // Refund-events per bundle (Fase 28). Eén Transaction-rij per refund op
  // buyer-side — geschreven door zowel SHIPPED-pad (partialRefundEscrow) als
  // COMPLETED-pad (manueel uit balance). Description-prefix "Gedeeltelijke
  // terugbetaling" identificeert ze. Reden zit als suffix " — <reden>".
  const bundleIds = bundles.map((b) => b.id);
  const refundTransactions = bundleIds.length > 0
    ? await prisma.transaction.findMany({
        where: {
          userId,
          relatedShippingBundleId: { in: bundleIds },
          description: { startsWith: "Gedeeltelijke terugbetaling" },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, amount: true, createdAt: true, description: true, relatedShippingBundleId: true },
      })
    : [];
  const refundEventsByBundle = new Map<string, { id: string; amount: number; createdAt: string; reason: string | null }[]>();
  for (const tx of refundTransactions) {
    if (!tx.relatedShippingBundleId) continue;
    const reasonMatch = tx.description.match(/—\s*(.+?)$/);
    const reason = reasonMatch ? reasonMatch[1].trim() : null;
    const list = refundEventsByBundle.get(tx.relatedShippingBundleId) ?? [];
    list.push({ id: tx.id, amount: tx.amount, createdAt: tx.createdAt.toISOString(), reason });
    refundEventsByBundle.set(tx.relatedShippingBundleId, list);
  }

  // Voor pickup-bundles zonder bundle-proposal-conversation: zoek bestaande
  // listing-conversation tussen (buyer, seller, listing) zodat de chat-knop
  // direct naar de juiste chat navigeert. Niet voor multi-listing bundles.
  const pickupListingIds = bundles
    .filter((b) => b.deliveryMethod === "PICKUP")
    .map((b) => b.listingId ?? b.cardItems[0]?.listingId ?? null)
    .filter((id): id is string => id !== null);
  const pickupConversations = pickupListingIds.length > 0
    ? await prisma.conversation.findMany({
        where: {
          listingId: { in: pickupListingIds },
          participants: { some: { userId } },
        },
        select: { id: true, listingId: true },
      })
    : [];
  const conversationByListing = new Map(pickupConversations.map((c) => [c.listingId!, c.id]));

  // Pickup-bundles voor de prominente sectie. Twee soorten:
  // - SCHEDULED + ACCEPTED schedule → afspraak vast, ofwel code-toon (PLATFORM)
  //   ofwel confirm-knop (EXTERNAL)
  // - PENDING (EXTERNAL) of SCHEDULED zonder ACCEPTED schedule → nog afspreken,
  //   chat-knop "Spreek af in chat"
  const activePickups = bundles
    .filter((b) => {
      const isPickupBundle = b.deliveryMethod === "PICKUP";
      if (!isPickupBundle) return false;
      // Toon SCHEDULED met ACCEPTED schedule of PENDING/SCHEDULED zonder.
      if (b.status === "COMPLETED" || b.status === "CANCELLED") return false;
      if (b.status === "PAID" && b.paymentMode === "PLATFORM" && !b.pickupSchedule) return true;
      if (b.status === "SCHEDULED") return true;
      if (b.status === "PENDING" && b.paymentMode === "EXTERNAL") return true;
      return false;
    })
    .map((b) => ({
      id: b.id,
      orderNumber: b.orderNumber,
      counterpartyName: b.seller.displayName,
      counterpartyId: b.seller.id,
      pickupCode: b.pickupSchedule?.pickupCode ?? null,
      proposedFor: b.pickupSchedule?.proposedFor?.toISOString() ?? null,
      windowStart: b.pickupSchedule?.windowStart ?? null,
      windowEnd: b.pickupSchedule?.windowEnd ?? null,
      paymentMode: b.paymentMode,
      scheduleStatus: b.pickupSchedule?.status ?? null,
      conversationId: b.bundleProposal?.conversationId
        ?? conversationByListing.get(b.listingId ?? b.cardItems[0]?.listingId ?? "")
        ?? null,
      listingId: b.listingId ?? b.cardItems[0]?.listingId ?? null,
      perspective: "buyer" as const,
    }));

  const serialized = bundles.map((b) => ({
    id: b.id,
    orderNumber: b.orderNumber,
    sellerName: b.seller.displayName,
    sellerId: b.seller.id,
    status: b.status,
    hasActiveCancellation: b.cancellationRequests.length > 0,
    shippingCost: b.shippingCost,
    totalItemCost: b.totalItemCost,
    totalCost: b.totalCost,
    shippingMethodCarrier: b.shippingMethod?.carrier ?? null,
    shippingMethodService: b.shippingMethod?.serviceName ?? null,
    deliveryMethod: b.deliveryMethod,
    paymentMode: b.paymentMode,
    trackingUrl: b.trackingUrl,
    shippedAt: b.shippedAt?.toISOString() ?? null,
    deliveredAt: b.deliveredAt?.toISOString() ?? null,
    refundedAmount: b.refundedAmount ?? 0,
    refundEvents: refundEventsByBundle.get(b.id) ?? [],
    pickupScheduleStatus: b.pickupSchedule?.status ?? null,
    createdAt: b.createdAt.toISOString(),
    sourceType: b.auctionId
      ? "auction" as const
      : (b.listingId || b.bundleListings.length > 0 || b.cardItems.length > 0)
        ? "listing" as const
        : "claimsale" as const,
    // Titel: directe listing > auction > bundle-offer-titel >
    // listing afgeleid uit eerste cardItem (stocked-buy/partial-sale).
    sourceTitle: b.auction?.title
      ?? b.listing?.title
      ?? (b.bundleListings.length > 0 ? `Bundel: ${b.bundleListings.length} advertenties` : null)
      ?? b.cardItems[0]?.listing?.title
      ?? null,
    sourceImageUrl: (() => {
      const raw = b.auction?.imageUrls
        ?? b.listing?.imageUrls
        ?? b.bundleListings[0]?.listing?.imageUrls
        ?? b.cardItems[0]?.listing?.imageUrls
        ?? null;
      if (!raw) return null;
      try { const urls = JSON.parse(raw); return urls[0] ?? null; } catch { return null; }
    })(),
    // Items: claimsale-items (legacy) + ListingCardItem-rijen (stocked-buy
    // en partial-sale). Identieke regels worden gegroepeerd per (cardName +
    // conditie) zodat 5× dezelfde booster één rij wordt met aantal +
    // subtotaal i.p.v. 5 identieke regels onder elkaar.
    items: groupBundleItems([
      ...b.items.map((i) => ({
        id: i.id,
        cardName: i.cardName,
        condition: i.condition,
        price: i.price,
        imageUrl: (() => {
          try { const urls = JSON.parse(i.imageUrls); return urls[0] ?? null; } catch { return null; }
        })(),
        reference: i.reference ?? null,
        sellerNote: null, // Private: only visible to seller
        refundedAt: i.refundedAt?.toISOString() ?? null,
      })),
      ...b.cardItems.map((ci) => ({
        id: ci.id,
        cardName: ci.cardName,
        condition: ci.condition ?? "",
        price: ci.listing?.price ?? 0,
        imageUrl: (() => {
          const raw = ci.listing?.imageUrls;
          if (!raw) return null;
          try { const urls = JSON.parse(raw); return urls[0] ?? null; } catch { return null; }
        })(),
        reference: null,
        sellerNote: null,
        refundedAt: null,
      })),
      // Multi-listing bundle (Fase 27.38): elke listing in de bundle als
      // eigen item-rij zodat koper precies ziet welke advertenties hij heeft
      // gekocht i.p.v. "Bundel: N advertenties".
      ...b.bundleListings.map((bl) => ({
        id: bl.id,
        cardName: bl.listing.title,
        condition: bl.listing.condition ?? "",
        price: bl.priceSnapshot,
        imageUrl: (() => {
          const raw = bl.listing.imageUrls;
          if (!raw) return null;
          try { const urls = JSON.parse(raw); return urls[0] ?? null; } catch { return null; }
        })(),
        reference: null,
        sellerNote: null,
        refundedAt: null,
      })),
    ]),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {t("title")}
      </h1>

      {serialized.length === 0 && pendingAuctions.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {t("noPurchases")}
        </p>
      ) : (
        <>
          <ActivePickupsSection pickups={activePickups} />
          {/* Pending-payments verschijnen als eigen tab in PurchasesContent
              (Fase 27.94). Default-tab springt naar PENDING als die items heeft. */}
          <PurchasesContent
            bundles={serialized}
            pendingAuctionPayments={pendingAuctions.map((a) => ({
              id: a.id,
              title: a.title,
              finalPrice: a.finalPrice,
              paymentDeadline: a.paymentDeadline,
            }))}
            availableBalance={availableBalance}
            reservedBalance={reservedBalance}
            currentUserId={userId}
          />
        </>
      )}
    </div>
  );
}
