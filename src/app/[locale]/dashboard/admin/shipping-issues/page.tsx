import { prisma } from "@/lib/prisma";
import { ShippingIssuesAdminList } from "@/components/admin/shipping-issues-admin-list";

export default async function AdminShippingIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = status ?? "OPEN";

  const issues = await prisma.shippingIssue.findMany({
    where: statusFilter === "ALL" ? {} : { status: statusFilter },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reporter: { select: { id: true, displayName: true } },
      bundle: {
        select: {
          id: true,
          orderNumber: true,
          totalCost: true,
          status: true,
          shippedAt: true,
          trackingUrl: true,
          buyer: { select: { id: true, displayName: true } },
          seller: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  const serialized = issues.map((i) => ({
    id: i.id,
    type: i.type,
    status: i.status,
    description: i.description,
    resolution: i.resolution,
    createdAt: i.createdAt.toISOString(),
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
    reporter: { id: i.reporter.id, displayName: i.reporter.displayName },
    bundle: {
      id: i.bundle.id,
      orderNumber: i.bundle.orderNumber,
      totalCost: i.bundle.totalCost,
      status: i.bundle.status,
      shippedAt: i.bundle.shippedAt?.toISOString() ?? null,
      trackingUrl: i.bundle.trackingUrl,
      buyer: { id: i.bundle.buyer.id, displayName: i.bundle.buyer.displayName },
      seller: { id: i.bundle.seller.id, displayName: i.bundle.seller.displayName },
    },
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Trackingtickets (ShippingIssue)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Lichtgewicht tickets voor tracking-problemen — voor scenario&apos;s waar een zware geschillen-flow disproportioneel zou zijn.
      </p>

      <ShippingIssuesAdminList issues={serialized} currentStatus={statusFilter} />
    </div>
  );
}
