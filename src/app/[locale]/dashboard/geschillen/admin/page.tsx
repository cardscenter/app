import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { AdminDisputesList } from "@/components/dashboard/admin-disputes-list";

export default async function AdminDisputesPage() {
  const session = await auth();
  const t = await getTranslations("disputes");
  const userId = session!.user!.id!;

  // Check admin role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountType: true },
  });
  if (user?.accountType !== "ADMIN") notFound();

  // Fetch all ESCALATED disputes
  const disputes = await prisma.dispute.findMany({
    where: { status: "ESCALATED" },
    orderBy: { createdAt: "asc" },
    include: {
      openedBy: { select: { id: true, displayName: true } },
      shippingBundle: {
        include: {
          buyer: { select: { id: true, displayName: true } },
          seller: { select: { id: true, displayName: true } },
          shippingMethod: { select: { carrier: true, serviceName: true } },
          items: {
            select: { id: true, cardName: true, condition: true, price: true, imageUrls: true },
          },
        },
      },
    },
  });

  const serialized = disputes.map((d) => ({
    id: d.id,
    reason: d.reason,
    description: d.description,
    evidenceUrls: JSON.parse(d.evidenceUrls) as string[],
    sellerResponse: d.sellerResponse,
    sellerEvidenceUrls: d.sellerEvidenceUrls ? JSON.parse(d.sellerEvidenceUrls) as string[] : [],
    createdAt: d.createdAt.toISOString(),
    bundle: {
      id: d.shippingBundle.id,
      totalCost: d.shippingBundle.totalCost,
      totalItemCost: d.shippingBundle.totalItemCost,
      shippingCost: d.shippingBundle.shippingCost,
      trackingUrl: d.shippingBundle.trackingUrl,
      buyerName: d.shippingBundle.buyer.displayName,
      sellerName: d.shippingBundle.seller.displayName,
      carrier: d.shippingBundle.shippingMethod?.carrier ?? null,
      items: d.shippingBundle.items.map((i) => ({
        cardName: i.cardName,
        condition: i.condition,
        price: i.price,
      })),
    },
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{t("adminPanel")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("adminSubtitle")}
      </p>
      <AdminDisputesList disputes={serialized} />
    </div>
  );
}
