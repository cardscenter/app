import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { DisputeDetailContent } from "@/components/dashboard/dispute-detail-content";

export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = await params;
  const session = await auth();
  const userId = session!.user!.id!;

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      openedBy: { select: { id: true, displayName: true } },
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, type: true, actorId: true, detail: true, createdAt: true },
      },
      shippingBundle: {
        include: {
          buyer: { select: { id: true, displayName: true } },
          seller: { select: { id: true, displayName: true } },
          shippingMethod: { select: { carrier: true, serviceName: true } },
          items: {
            select: { id: true, cardName: true, condition: true, price: true, imageUrls: true },
          },
          auction: { select: { id: true, title: true } },
          listing: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!dispute) notFound();

  const bundle = dispute.shippingBundle;
  const isBuyer = bundle.buyerId === userId;
  const isSeller = bundle.sellerId === userId;
  if (!isBuyer && !isSeller) notFound();

  const serialized = {
    id: dispute.id,
    reason: dispute.reason,
    description: dispute.description,
    evidenceUrls: JSON.parse(dispute.evidenceUrls) as string[],
    sellerResponse: dispute.sellerResponse,
    sellerEvidenceUrls: dispute.sellerEvidenceUrls ? JSON.parse(dispute.sellerEvidenceUrls) as string[] : [],
    sellerRespondedAt: dispute.sellerRespondedAt?.toISOString() ?? null,
    status: dispute.status,
    resolution: dispute.resolution,
    partialRefundAmount: dispute.partialRefundAmount,
    proposedById: dispute.proposedById,
    resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
    resolvedById: dispute.resolvedById,
    adminNotes: dispute.adminNotes,
    buyerAcceptsEscalation: dispute.buyerAcceptsEscalation,
    sellerAcceptsEscalation: dispute.sellerAcceptsEscalation,
    responseDeadline: dispute.responseDeadline.toISOString(),
    buyerReviewDeadline: dispute.buyerReviewDeadline?.toISOString() ?? null,
    createdAt: dispute.createdAt.toISOString(),
    bundle: {
      id: bundle.id,
      totalCost: bundle.totalCost,
      totalItemCost: bundle.totalItemCost,
      shippingCost: bundle.shippingCost,
      trackingUrl: bundle.trackingUrl,
      shippedAt: bundle.shippedAt?.toISOString() ?? null,
      buyerName: bundle.buyer.displayName,
      buyerId: bundle.buyer.id,
      sellerName: bundle.seller.displayName,
      sellerId: bundle.seller.id,
      shippingMethodCarrier: bundle.shippingMethod?.carrier ?? null,
      shippingMethodService: bundle.shippingMethod?.serviceName ?? null,
      sourceTitle: bundle.auction?.title ?? bundle.listing?.title ?? null,
      items: bundle.items.map((i) => ({
        id: i.id,
        cardName: i.cardName,
        condition: i.condition,
        price: i.price,
        imageUrl: (() => {
          try { return JSON.parse(i.imageUrls)[0] ?? null; } catch { return null; }
        })(),
      })),
    },
    events: dispute.events.map((e) => ({
      id: e.id,
      type: e.type,
      actorId: e.actorId,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    })),
    isBuyer,
    isSeller,
  };

  return (
    <div>
      <DisputeDetailContent dispute={serialized} />
    </div>
  );
}
