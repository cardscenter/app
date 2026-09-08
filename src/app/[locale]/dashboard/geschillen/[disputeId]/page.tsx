import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DisputeV2Detail } from "@/components/dashboard/dispute-v2-detail";
import { AdminDisputeDossier } from "@/components/admin/dispute-dossier";
import { RealtimePageRefresh } from "@/components/providers/realtime-page-refresh";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

function parseUrls(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseVisibility(metadata: string | null): "INTERNAL" | "PARTIES" | null {
  if (!metadata) return null;
  try {
    const m = JSON.parse(metadata);
    return m?.visibility === "INTERNAL" ? "INTERNAL" : m?.visibility === "PARTIES" ? "PARTIES" : null;
  } catch {
    return null;
  }
}

export default async function DisputePage({
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
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { displayName: true } } } },
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
          paymentMode: true,
          deliveryMethod: true,
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
    redirect(`/${locale}/dashboard`);
  }

  // Een admin die zelf partij is, handelt als partij (nooit rechter in eigen zaak).
  const role: "buyer" | "seller" | "admin" = isBuyer ? "buyer" : isSeller ? "seller" : "admin";

  // Interne admin-notities alleen voor admins.
  const events = dispute.events
    .map((e) => ({
      id: e.id,
      type: e.type,
      actorType: e.actorType,
      actorId: e.actorId,
      actorName: e.actor?.displayName ?? null,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
      visibility: parseVisibility(e.metadata),
    }))
    .filter((e) => role === "admin" || e.visibility !== "INTERNAL");

  const detail = (
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
        fundingSource: dispute.fundingSource,
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
          deliveredAt: dispute.bundle.deliveredAt?.toISOString() ?? null,
          trackingUrl: dispute.bundle.trackingUrl,
          shippingProofUrls: parseUrls(dispute.bundle.shippingProofUrls),
          paymentMode: dispute.bundle.paymentMode,
          deliveryMethod: dispute.bundle.deliveryMethod,
        },
        events,
      }}
    />
  );

  return (
    <div className="space-y-4">
      <RealtimePageRefresh events={["dispute-changed"]} />
      <Link
        href={role === "admin" ? "/dashboard/admin/disputes" : "/dashboard/geschillen"}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {role === "admin" ? "Terug naar de geschillen-wachtrij" : "Terug naar mijn geschillen"}
      </Link>

      {role === "admin" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-w-0">{detail}</div>
          <aside className="min-w-0">
            <AdminDisputeDossier disputeId={dispute.id} />
          </aside>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">{detail}</div>
      )}
    </div>
  );
}
