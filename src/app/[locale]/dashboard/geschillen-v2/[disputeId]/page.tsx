import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { DisputeV2Detail } from "@/components/dashboard/dispute-v2-detail";

export default async function DisputeV2Page({
  params,
}: {
  params: Promise<{ locale: string; disputeId: string }>;
}) {
  const { locale, disputeId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const dispute = await prisma.disputeV2.findUnique({
    where: { id: disputeId },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      bundle: {
        select: {
          id: true,
          orderNumber: true,
          totalCost: true,
          totalItemCost: true,
          shippingCost: true,
          refundedAmount: true,
          status: true,
          shippedAt: true,
          deliveredAt: true,
          trackingUrl: true,
          shippingProofUrls: true,
        },
      },
      buyer: { select: { id: true, displayName: true } },
      seller: { select: { id: true, displayName: true } },
    },
  });

  if (!dispute) notFound();

  const isBuyer = dispute.buyerId === session.user.id;
  const isSeller = dispute.sellerId === session.user.id;
  const isAdmin = session.user.accountType === "ADMIN";

  if (!isBuyer && !isSeller && !isAdmin) {
    // Niet geautoriseerd → home
    redirect(`/${locale}/dashboard`);
  }

  const role: "buyer" | "seller" | "admin" = isAdmin && !isBuyer && !isSeller ? "admin" : isBuyer ? "buyer" : "seller";

  // Parse JSON-evidence
  const parseUrls = (s: string | null) => {
    if (!s) return [] as string[];
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <DisputeV2Detail
        role={role}
        currentUserId={session.user.id}
        dispute={{
          id: dispute.id,
          status: dispute.status,
          reasonCategory: dispute.reasonCategory,
          reasonSubCategory: dispute.reasonSubCategory,
          buyerStatement: dispute.buyerStatement,
          sellerStatement: dispute.sellerStatement,
          evidenceBuyer: parseUrls(dispute.evidenceBuyer),
          evidenceSeller: parseUrls(dispute.evidenceSeller),
          proposedRefund: dispute.proposedRefund,
          proposedById: dispute.proposedById,
          finalRefund: dispute.finalRefund,
          resolution: dispute.resolution,
          adminNotes: dispute.adminNotes,
          responseDeadline: dispute.responseDeadline.toISOString(),
          buyerReviewDeadline: dispute.buyerReviewDeadline?.toISOString() ?? null,
          adminSLADeadline: dispute.adminSLADeadline?.toISOString() ?? null,
          createdAt: dispute.createdAt.toISOString(),
          resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
          buyer: { id: dispute.buyer.id, displayName: dispute.buyer.displayName },
          seller: { id: dispute.seller.id, displayName: dispute.seller.displayName },
          bundle: {
            id: dispute.bundle.id,
            orderNumber: dispute.bundle.orderNumber,
            totalCost: dispute.bundle.totalCost,
            totalItemCost: dispute.bundle.totalItemCost,
            shippingCost: dispute.bundle.shippingCost,
            refundedAmount: dispute.bundle.refundedAmount ?? 0,
            status: dispute.bundle.status,
            shippedAt: dispute.bundle.shippedAt?.toISOString() ?? null,
            trackingUrl: dispute.bundle.trackingUrl,
            shippingProofUrls: parseUrls(dispute.bundle.shippingProofUrls ?? null),
          },
          events: dispute.events.map((e) => ({
            id: e.id,
            type: e.type,
            actorType: e.actorType,
            actorId: e.actorId,
            message: e.message,
            createdAt: e.createdAt.toISOString(),
          })),
        }}
      />
    </div>
  );
}
