import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { PurchasesContent } from "@/components/dashboard/purchases-content";
import { CancellationsSection } from "@/components/dashboard/cancellations-section";
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
};
function groupBundleItems(items: RawItem[]) {
  const groups = new Map<string, RawItem & { quantity: number; subtotal: number }>();
  for (const it of items) {
    const key = `${it.cardName}|${it.condition}`;
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
  const t = await getTranslations("purchases");
  const userId = session!.user!.id!;

  const bundles = await prisma.shippingBundle.findMany({
    where: {
      buyerId: userId,
      status: { not: "PENDING" },
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
      conversationId: b.bundleProposal?.conversationId ?? null,
      listingId: b.listingId,
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
    trackingUrl: b.trackingUrl,
    shippedAt: b.shippedAt?.toISOString() ?? null,
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
      })),
    ]),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">
        {t("title")}
      </h1>
      {serialized.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {t("noPurchases")}
        </p>
      ) : (
        <>
          <ActivePickupsSection pickups={activePickups} />
          <CancellationsSection
            currentUserId={userId}
            paidBundles={serialized
              // Alleen bundles met een actief PENDING annuleringsverzoek —
              // anders zou de hele PAID-lijst hier dubbel verschijnen
              // (rommelige UX bij meer dan een paar aankopen).
              .filter((b) => b.status === "PAID" && b.hasActiveCancellation)
              .map((b) => ({
                id: b.id,
                orderNumber: b.orderNumber,
                status: b.status,
                totalCost: b.totalCost,
                counterpartyName: b.sellerName,
              }))}
          />
          <PurchasesContent bundles={serialized} />
        </>
      )}
    </div>
  );
}
